import React, { useState, useEffect } from 'react';
import { TableDetails } from '../../types';
import { 
  Table, 
  Key, 
  Layers, 
  Zap, 
  Code, 
  X, 
  Copy, 
  Check, 
  RefreshCw,
  Link,
  Cpu,
  Hash
} from 'lucide-react';

interface TableDetailsModalProps {
  tableName: string | null;
  onClose: () => void;
}

export const TableDetailsModal: React.FC<TableDetailsModalProps> = ({
  tableName,
  onClose
}) => {
  const [details, setDetails] = useState<TableDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'columns' | 'indices' | 'foreignKeys' | 'triggers' | 'ddl'>('columns');
  const [copiedDdl, setCopiedDdl] = useState(false);

  useEffect(() => {
    if (!tableName) {
      setDetails(null);
      return;
    }

    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (window.electronAPI?.getTableDetails) {
          const res = await window.electronAPI.getTableDetails(tableName);
          if (res.success && res.data) {
            setDetails(res.data);
          } else {
            setError(res.error || 'Error al obtener detalles de la tabla');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error inesperado');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [tableName]);

  if (!tableName) return null;

  const handleCopyDdl = () => {
    if (details?.ddl) {
      navigator.clipboard.writeText(details.ddl);
      setCopiedDdl(true);
      setTimeout(() => setCopiedDdl(false), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 font-mono">Tabla: {tableName}</h3>
                {details?.engine && (
                  <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-emerald-400 rounded-full font-mono border border-zinc-700">
                    {details.engine}
                  </span>
                )}
                {details?.rows !== undefined && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ~{details.rows.toLocaleString()} filas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">Columnas, índices, claves foráneas y DDL nativo</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-zinc-950/60 px-4 border-b border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'columns'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Columnas ({details?.columns.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('indices')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'indices'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Índices ({details?.indices.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('foreignKeys')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'foreignKeys'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Claves Foráneas ({details?.foreignKeys.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('triggers')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'triggers'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Triggers ({details?.triggers.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('ddl')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'ddl'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>DDL Script</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-900/60 text-xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Consultando metadatos de {tableName}...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300">
              {error}
            </div>
          ) : (
            <>
              {/* TAB 1: Columns */}
              {activeTab === 'columns' && (
                <div className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-950 font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Columna</th>
                        <th className="px-3 py-2">Tipo de Dato</th>
                        <th className="px-3 py-2">Nullable</th>
                        <th className="px-3 py-2">Clave</th>
                        <th className="px-3 py-2">Predeterminado</th>
                        <th className="px-3 py-2">Extra</th>
                        <th className="px-3 py-2">Comentario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {details?.columns.map((col) => (
                        <tr key={col.columnName} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-1.5 text-zinc-600">{col.position}</td>
                          <td className="px-3 py-1.5 font-bold text-zinc-100">{col.columnName}</td>
                          <td className="px-3 py-1.5 text-emerald-400">{col.fieldType}</td>
                          <td className="px-3 py-1.5">
                            {col.isNullable ? (
                              <span className="text-zinc-500">NULL</span>
                            ) : (
                              <span className="text-amber-400 font-semibold">NOT NULL</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {col.isPrimaryKey ? (
                              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-[10px] font-bold">
                                PRIMARY KEY
                              </span>
                            ) : col.isUnique ? (
                              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                                UNIQUE
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400 truncate max-w-xs">
                            {col.defaultValue !== null ? col.defaultValue : <span className="text-zinc-600 italic">NULL</span>}
                          </td>
                          <td className="px-3 py-1.5 text-cyan-400">
                            {col.isAutoIncrement ? 'auto_increment' : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-500 italic truncate max-w-xs">
                            {col.comment || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: Indices */}
              {activeTab === 'indices' && (
                <div className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-950 font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2">Nombre del Índice</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Único</th>
                        <th className="px-3 py-2">Columnas Asociadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {details?.indices.map((idx) => (
                        <tr key={idx.name} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2 font-bold text-zinc-100 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-yellow-400" />
                            <span>{idx.name}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-400">{idx.type}</td>
                          <td className="px-3 py-2">
                            {idx.unique ? (
                              <span className="text-emerald-400 font-semibold">SÍ (UNIQUE)</span>
                            ) : (
                              <span className="text-zinc-500">NO</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-emerald-400 font-semibold">
                            {idx.fields.join(', ')}
                          </td>
                        </tr>
                      ))}
                      {(!details?.indices || details.indices.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 italic">
                            No hay índices definidos para esta tabla.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: Foreign Keys */}
              {activeTab === 'foreignKeys' && (
                <div className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-950 font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2">Constraint</th>
                        <th className="px-3 py-2">Columna Local</th>
                        <th className="px-3 py-2">Tabla Referenciada</th>
                        <th className="px-3 py-2">Columna Referenciada</th>
                        <th className="px-3 py-2">ON UPDATE</th>
                        <th className="px-3 py-2">ON DELETE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {details?.foreignKeys.map((fk) => (
                        <tr key={fk.name} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2 font-bold text-zinc-100">{fk.name}</td>
                          <td className="px-3 py-2 text-emerald-400">{fk.column}</td>
                          <td className="px-3 py-2 text-blue-400">{fk.referencedTable}</td>
                          <td className="px-3 py-2 text-cyan-400">{fk.referencedColumn}</td>
                          <td className="px-3 py-2 text-zinc-400">{fk.updateRule || 'RESTRICT'}</td>
                          <td className="px-3 py-2 text-zinc-400">{fk.deleteRule || 'RESTRICT'}</td>
                        </tr>
                      ))}
                      {(!details?.foreignKeys || details.foreignKeys.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 italic">
                            No hay claves foráneas para esta tabla.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: Triggers */}
              {activeTab === 'triggers' && (
                <div className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-950 font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2">Nombre del Trigger</th>
                        <th className="px-3 py-2">Momento (Timing)</th>
                        <th className="px-3 py-2">Evento (Event)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {details?.triggers.map((tr) => (
                        <tr key={tr.name} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2 font-bold text-zinc-100 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                            <span>{tr.name}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{tr.timing}</td>
                          <td className="px-3 py-2 text-emerald-400 font-semibold">{tr.event}</td>
                        </tr>
                      ))}
                      {(!details?.triggers || details.triggers.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-zinc-500 italic">
                            No hay triggers asociados a esta tabla.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 5: DDL Script */}
              {activeTab === 'ddl' && (
                <div className="flex flex-col h-full space-y-2">
                  <div className="flex justify-end">
                    <button
                      onClick={handleCopyDdl}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs transition-colors border border-zinc-700"
                    >
                      {copiedDdl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDdl ? '¡Copiado!' : 'Copiar DDL'}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-emerald-300 overflow-auto whitespace-pre-wrap select-text leading-relaxed">
                    {details?.ddl || '-- No hay DDL disponible'}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
