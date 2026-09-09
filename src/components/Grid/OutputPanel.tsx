import React from 'react';
import { QueryResult, QueryHistoryItem } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { DataGrid } from './DataGrid';
import { 
  Table as TableIcon, 
  Terminal, 
  History, 
  AlertCircle, 
  CheckCircle, 
  Copy, 
  Trash2 
} from 'lucide-react';

interface OutputPanelProps {
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
  activeTab: 'grid' | 'messages' | 'history';
  onSelectTab: (tab: 'grid' | 'messages' | 'history') => void;
  history: QueryHistoryItem[];
  onSelectHistorySql: (sql: string) => void;
  onClearHistory: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  result,
  isRunning,
  error,
  activeTab,
  onSelectTab,
  history,
  onSelectHistorySql,
  onClearHistory
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-t border-zinc-800 overflow-hidden">
      
      {/* Bottom Panel Tab Header */}
      <div className="flex items-center justify-between bg-zinc-950 px-3 border-b border-zinc-800 select-none">
        
        <div className="flex items-center gap-1">
          {/* Results Tab */}
          <button
            onClick={() => onSelectTab('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'grid'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{t('grid.gridTab')}</span>
            {result?.rowCount !== undefined && (
              <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded text-zinc-300 font-mono">
                {result.rowCount}
              </span>
            )}
          </button>

          {/* Messages / Console Tab */}
          <button
            onClick={() => onSelectTab('messages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'messages'
                ? error
                  ? 'border-red-500 text-red-400 bg-zinc-900/60'
                  : 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                : error
                  ? 'border-transparent text-red-400 hover:text-red-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t('grid.messagesTab')}</span>
            {error && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          {/* History Tab */}
          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('grid.historyTab')} ({history.length})</span>
          </button>
        </div>

      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-hidden">
        
        {/* 1. Data Grid View */}
        {activeTab === 'grid' && (
          <DataGrid result={result} isRunning={isRunning} />
        )}

        {/* 2. Messages Console View */}
        {activeTab === 'messages' && (
          <div className="p-4 overflow-auto h-full bg-zinc-950 font-mono text-xs select-text">
            {isRunning ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Ejecutando sentencia en MariaDB / MySQL...</span>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Error en la ejecución de la consulta</span>
                </div>
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-300 whitespace-pre-wrap">
                  {error}
                </div>
              </div>
            ) : result ? (
              <div className="space-y-2 text-zinc-300">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Consulta ejecutada con éxito</span>
                </div>
                <div className="text-zinc-400 space-y-1 text-[11px]">
                  <p>• Tiempo transcurrido: <span className="text-zinc-200 font-bold">{result.executionTimeMs} ms</span></p>
                  <p>• Filas recuperadas: <span className="text-zinc-200 font-bold">{result.rowCount}</span></p>
                  {result.affectedRows !== undefined && (
                    <p>• Filas afectadas: <span className="text-zinc-200 font-bold">{result.affectedRows}</span></p>
                  )}
                  {result.insertId !== undefined && (
                    <p>• Último ID autogenerado: <span className="text-zinc-200 font-bold">{result.insertId}</span></p>
                  )}
                </div>
                <div className="pt-2">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Sentencia ejecutada:</span>
                  <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 whitespace-pre-wrap mt-1">
                    {result.sql}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500">No hay mensajes recientes de ejecución.</div>
            )}
          </div>
        )}

        {/* 3. History View */}
        {activeTab === 'history' && (
          <div className="flex flex-col h-full bg-zinc-950 select-none">
            <div className="p-2 border-b border-zinc-800 flex justify-end">
              <button
                onClick={onClearHistory}
                disabled={history.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-900 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('grid.clearHistory')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3 divide-y divide-zinc-900">
              {history.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs">
                  {t('grid.historyEmpty')}
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="py-2 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-[11px] text-zinc-500 font-mono">{item.timestamp}</span>
                        <span className="text-[11px] text-zinc-400 font-mono">({item.durationMs} ms)</span>
                        {item.rowCount !== undefined && (
                          <span className="text-[10px] bg-zinc-800 px-1 py-0.2 rounded text-zinc-400">
                            {item.rowCount} filas
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-zinc-300 truncate group-hover:text-emerald-300 cursor-pointer" onClick={() => onSelectHistorySql(item.sql)}>
                        {item.sql.replace(/\s+/g, ' ')}
                      </div>
                      {item.error && (
                        <div className="text-[11px] text-red-400 truncate mt-0.5">
                          {item.error}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onSelectHistorySql(item.sql)}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded transition-colors"
                      >
                        Cargar
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(item.sql)}
                        className="p-1 hover:text-emerald-400 text-zinc-400 transition-colors"
                        title={t('common.copy')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
