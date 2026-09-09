import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Download, 
  Database, 
  FileText, 
  FolderOpen, 
  Play, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Search, 
  RefreshCw, 
  ExternalLink 
} from 'lucide-react';
import { DumpOptions, DumpProgress } from '../../types';

interface DumpDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  databaseName?: string;
  tables: string[];
}

export const DumpDatabaseModal: React.FC<DumpDatabaseModalProps> = ({
  isOpen,
  onClose,
  databaseName = 'DATABASE',
  tables = []
}) => {
  const { t } = useTranslation();
  
  // Dump settings
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [includeViews, setIncludeViews] = useState(true);
  const [includeProcedures, setIncludeProcedures] = useState(true);
  const [includeTriggers, setIncludeTriggers] = useState(true);
  const [includeForeignKeys, setIncludeForeignKeys] = useState(true);
  const [batchCommitSize, setBatchCommitSize] = useState(500);

  // Table selection
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  // Destination path
  const [outputPath, setOutputPath] = useState('');

  // Running state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<DumpProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ filePath: string; totalStatements: number; durationMs: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccessResult(null);
    setIsExporting(false);
    setProgress(null);
    setSelectedTables(tables);

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const cleanDb = databaseName || 'mariadb';
    setOutputPath(`dump_${cleanDb}_${dateStr}.sql`);
  }, [isOpen, databaseName, tables]);

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.onDumpProgress) return;

    const unsubscribe = window.electronAPI.onDumpProgress((prog: DumpProgress) => {
      setProgress(prog);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const filteredTables = tables.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase().trim()));

  const handleSelectAllTables = () => {
    setSelectedTables(tables);
  };

  const handleDeselectAllTables = () => {
    setSelectedTables([]);
  };

  const handleToggleTable = (tbl: string) => {
    if (selectedTables.includes(tbl)) {
      setSelectedTables(selectedTables.filter(t => t !== tbl));
    } else {
      setSelectedTables([...selectedTables, tbl]);
    }
  };

  const handleBrowseFile = async () => {
    if (window.electronAPI?.selectDumpFile) {
      const file = await window.electronAPI.selectDumpFile(outputPath);
      if (file) {
        setOutputPath(file);
      }
    }
  };

  const handleStartExport = async () => {
    if (!outputPath.trim()) {
      setError('Debes especificar la ruta de destino para el archivo .sql.');
      return;
    }
    if (includeData && selectedTables.length === 0 && tables.length > 0) {
      setError('Debes seleccionar al menos una tabla para exportar datos.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccessResult(null);

    const options: DumpOptions = {
      outputPath: outputPath.trim(),
      includeStructure,
      includeData,
      includeViews,
      includeProcedures,
      includeTriggers,
      includeForeignKeys,
      selectedTables,
      batchCommitSize: Number(batchCommitSize) || 500
    };

    try {
      if (window.electronAPI?.startDump) {
        const res = await window.electronAPI.startDump(options);
        if (res.success && res.data) {
          setSuccessResult(res.data);
        } else {
          setError(res.error || 'Error al exportar base de datos.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado durante la exportación.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancelExport = async () => {
    if (window.electronAPI?.cancelDump) {
      await window.electronAPI.cancelDump();
    }
  };

  const handleShowInFolder = async () => {
    if (successResult?.filePath && window.electronAPI?.showItemInFolder) {
      await window.electronAPI.showItemInFolder(successResult.filePath);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Exportar Base de Datos (Dump SQL)</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 bg-emerald-950/60 text-emerald-300 rounded-full border border-emerald-500/30">
                  {databaseName}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Genera un script SQL completo listo para respaldar o restaurar</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-5 text-xs">
          
          {/* Options Checklist */}
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Contenido del Respaldo
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeStructure}
                  onChange={(e) => setIncludeStructure(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span className="font-medium">Estructura (DDL)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeData}
                  onChange={(e) => setIncludeData(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span className="font-medium">Datos (INSERTs)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeViews}
                  onChange={(e) => setIncludeViews(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Vistas</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeProcedures}
                  onChange={(e) => setIncludeProcedures(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Procedimientos y Funciones</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeTriggers}
                  onChange={(e) => setIncludeTriggers(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Triggers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeForeignKeys}
                  onChange={(e) => setIncludeForeignKeys(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Claves Foráneas</span>
              </label>
            </div>
          </div>

          {/* Table Selection */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
            <div className="p-3 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-300">Tablas a Exportar</span>
                <span className="text-[11px] text-zinc-500">
                  ({selectedTables.length} de {tables.length} seleccionadas)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllTables}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
                >
                  Todas
                </button>
                <span className="text-zinc-600">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllTables}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                >
                  Ninguna
                </button>
              </div>
            </div>

            <div className="p-2 border-b border-zinc-800">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filtrar tablas..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="max-h-44 overflow-auto p-2 grid grid-cols-2 sm:grid-cols-3 gap-1 font-mono text-[11px]">
              {filteredTables.map((tbl) => {
                const isChecked = selectedTables.includes(tbl);
                return (
                  <label
                    key={tbl}
                    className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                      isChecked ? 'bg-emerald-950/30 text-emerald-200' : 'text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleTable(tbl)}
                      className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="truncate">{tbl}</span>
                  </label>
                );
              })}
              {filteredTables.length === 0 && (
                <div className="col-span-3 text-center py-4 text-zinc-500 italic">
                  No se encontraron tablas.
                </div>
              )}
            </div>
          </div>

          {/* Output Path */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Ruta del Archivo de Destino (.sql)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="/ruta/al/archivo/dump.sql"
                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleBrowseFile}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Examinar...</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {isExporting && progress && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400">{progress.message}</span>
                <span className="font-mono text-zinc-300">{progress.percentage}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successResult && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>¡Dump generado exitosamente!</span>
              </div>
              <p className="text-zinc-300 font-mono text-[11px] break-all">
                Archivo: {successResult.filePath}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-400 text-[11px]">
                  {successResult.totalStatements} sentencias escritas en {(successResult.durationMs / 1000).toFixed(1)} segundos.
                </span>
                <button
                  type="button"
                  onClick={handleShowInFolder}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mostrar en Carpeta</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div>
            {isExporting && (
              <button
                type="button"
                onClick={handleCancelExport}
                className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded-lg text-xs border border-red-500/40 transition-colors"
              >
                Cancelar Exportación
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              {successResult ? 'Cerrar' : 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={handleStartExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Exportando...' : 'Iniciar Dump'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
