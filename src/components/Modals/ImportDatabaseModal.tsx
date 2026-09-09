import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Upload, 
  Database, 
  FolderOpen, 
  Play, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  FileCode, 
  AlertTriangle,
  RefreshCw 
} from 'lucide-react';
import { ImportOptions, ImportProgress, ImportResult } from '../../types';

interface ImportDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  databaseName?: string;
  onSuccessRefresh?: () => void;
}

export const ImportDatabaseModal: React.FC<ImportDatabaseModalProps> = ({
  isOpen,
  onClose,
  databaseName = 'DATABASE',
  onSuccessRefresh
}) => {
  const { t } = useTranslation();
  
  const [filePath, setFilePath] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');
  const [stopOnError, setStopOnError] = useState(false);

  // Execution states
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setFilePath('');
    setFileSize(null);
    setFileName('');
    setIsImporting(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.onImportProgress) return;

    const unsubscribe = window.electronAPI.onImportProgress((prog: ImportProgress) => {
      setProgress(prog);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const handleSelectFile = async () => {
    if (window.electronAPI?.selectImportFile) {
      const fileInfo = await window.electronAPI.selectImportFile();
      if (fileInfo) {
        setFilePath(fileInfo.filePath);
        setFileSize(fileInfo.size);
        setFileName(fileInfo.name);
        setError(null);
        setResult(null);
      }
    }
  };

  const handleStartImport = async () => {
    if (!filePath.trim()) {
      setError('Debes seleccionar un archivo SQL para importar.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setResult(null);

    const options: ImportOptions = {
      filePath: filePath.trim(),
      stopOnError
    };

    try {
      if (window.electronAPI?.startImport) {
        const res = await window.electronAPI.startImport(options);
        if (res.success && res.data) {
          setResult(res.data);
          if (onSuccessRefresh) onSuccessRefresh();
        } else {
          setError(res.error || 'Error al ejecutar la importación');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelImport = async () => {
    if (window.electronAPI?.cancelImport) {
      await window.electronAPI.cancelImport();
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Importar Archivo SQL / Dump</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 bg-emerald-950/60 text-emerald-300 rounded-full border border-emerald-500/30">
                  {databaseName}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Ejecuta scripts SQL o volcados de cualquier tamaño en streaming</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4 text-xs">
          
          {/* Target Database Info */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-400">Base de datos de destino:</span>
            </div>
            <span className="font-mono font-bold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
              {databaseName}
            </span>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Archivo SQL a Importar (.sql)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={filePath}
                placeholder="Selecciona un archivo .sql..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none cursor-pointer"
                onClick={handleSelectFile}
              />
              <button
                type="button"
                onClick={handleSelectFile}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>Examinar...</span>
              </button>
            </div>

            {fileSize !== null && (
              <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                <span>{fileName}</span>
                <span>•</span>
                <span>{formatBytes(fileSize)}</span>
              </div>
            )}
          </div>

          {/* Import Options */}
          <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
              <input
                type="checkbox"
                checked={stopOnError}
                onChange={(e) => setStopOnError(e.target.checked)}
                className="rounded bg-zinc-900 border-zinc-700 text-teal-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="font-semibold block text-zinc-200">Detener importación al encontrar un error</span>
                <span className="text-[11px] text-zinc-500 block">
                  Si se desmarca, los errores se registrarán pero el script continuará ejecutándose.
                </span>
              </div>
            </label>
          </div>

          {/* Real-time Progress Bar */}
          {isImporting && progress && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-teal-400">{progress.message}</span>
                <span className="font-mono text-zinc-300">{progress.percentage}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-500 transition-all duration-150"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-1">
                <span>Ejecutadas: {progress.statementsExecuted.toLocaleString()}</span>
                {progress.errorsCount > 0 && (
                  <span className="text-red-400 font-bold">Errores: {progress.errorsCount}</span>
                )}
                <span>{formatBytes(progress.bytesProcessed)} de {formatBytes(progress.totalBytes)}</span>
              </div>
            </div>
          )}

          {/* Result Banner */}
          {result && (
            <div className={`p-4 rounded-xl space-y-2 text-xs animate-in fade-in border ${
              result.errorsCount === 0
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-amber-950/40 border-amber-500/40'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {result.errorsCount === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">¡Importación completada con éxito sin errores!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300">
                      Importación finalizada con {result.errorsCount} errores ({result.executedStatements} sentencias ejecutadas)
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Tiempo total: {(result.durationMs / 1000).toFixed(1)} segundos • Total de sentencias procesadas: {result.totalStatements}
              </div>

              {/* Error details */}
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-36 overflow-auto bg-zinc-950/80 p-2 rounded border border-zinc-800 space-y-1.5 font-mono text-[11px]">
                  {result.errors.slice(0, 50).map((err, i) => (
                    <div key={i} className="text-red-400">
                      <span className="font-bold text-red-300">Línea {err.lineNumber}:</span> {err.error}
                      <div className="text-zinc-500 truncate">{err.statementSnippet}</div>
                    </div>
                  ))}
                  {result.errors.length > 50 && (
                    <div className="text-zinc-500 italic">... y {result.errors.length - 50} errores más.</div>
                  )}
                </div>
              )}
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
            {isImporting && (
              <button
                type="button"
                onClick={handleCancelImport}
                className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded-lg text-xs border border-red-500/40 transition-colors"
              >
                Cancelar Importación
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {result ? 'Cerrar' : 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              disabled={isImporting || !filePath.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-lg shadow-teal-600/20 transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Importando...' : 'Iniciar Importación'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
