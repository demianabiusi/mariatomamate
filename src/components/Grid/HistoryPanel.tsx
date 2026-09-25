import React, { useState, useMemo } from 'react';
import { QueryHistoryItem } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import {
  Star,
  Trash2,
  Search,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Server,
  Sparkles,
} from 'lucide-react';

interface HistoryPanelProps {
  history: QueryHistoryItem[];
  onSelectHistorySql: (sql: string) => void;
  onClearHistory: (keepFavorites?: boolean, forConnectionOnly?: boolean) => void;
  onToggleFavorite?: (id: string) => void;
  onDeleteHistoryItem?: (id: string) => void;
  currentConnectionId?: string | null;
  currentConnectionName?: string | null;
}

type StatusFilter = 'all' | 'favorites' | 'success' | 'error';
type ScopeFilter = 'current' | 'all';

function formatTimestamp(timestamp: string, createdAt?: number): string {
  if (!createdAt) return timestamp;
  const now = new Date();
  const date = new Date(createdAt);

  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (isToday) {
    return `Hoy ${timeStr}`;
  }
  if (isYesterday) {
    return `Ayer ${timeStr}`;
  }

  const dayMonth = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  return `${dayMonth} ${timeStr}`;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onSelectHistorySql,
  onClearHistory,
  onToggleFavorite,
  onDeleteHistoryItem,
  currentConnectionId,
  currentConnectionName,
}) => {
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(currentConnectionId ? 'current' : 'all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearDropdown, setShowClearDropdown] = useState(false);

  // Cantidad de favoritos
  const favoritesCount = useMemo(() => history.filter((i) => i.isFavorite).length, [history]);

  // Si hay más de una conexión registrada en el historial
  const hasMultipleConnections = useMemo(() => {
    const connIds = new Set(history.map((i) => i.connectionId).filter(Boolean));
    return connIds.size > 1;
  }, [history]);

  // Filtrado de elementos
  const filteredHistory = useMemo(() => {
    let list = history;

    // 1. Filtro por scope (conexión actual o todas)
    if (scopeFilter === 'current' && currentConnectionId) {
      list = list.filter((i) => !i.connectionId || i.connectionId === currentConnectionId);
    }

    // 2. Filtro por estado / favoritos
    if (statusFilter === 'favorites') {
      list = list.filter((i) => i.isFavorite);
    } else if (statusFilter === 'success') {
      list = list.filter((i) => i.status === 'success');
    } else if (statusFilter === 'error') {
      list = list.filter((i) => i.status === 'error');
    }

    // 3. Filtro por búsqueda de texto
    const q = searchText.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.sql.toLowerCase().includes(q) ||
          (i.database && i.database.toLowerCase().includes(q)) ||
          (i.error && i.error.toLowerCase().includes(q)) ||
          (i.connectionName && i.connectionName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [history, scopeFilter, currentConnectionId, statusFilter, searchText]);

  // Conteo para las pestañas
  const counts = useMemo(() => {
    let scoped = history;
    if (scopeFilter === 'current' && currentConnectionId) {
      scoped = scoped.filter((i) => !i.connectionId || i.connectionId === currentConnectionId);
    }
    return {
      all: scoped.length,
      favorites: scoped.filter((i) => i.isFavorite).length,
      success: scoped.filter((i) => i.status === 'success').length,
      error: scoped.filter((i) => i.status === 'error').length,
    };
  }, [history, scopeFilter, currentConnectionId]);

  const handleCopy = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 select-none text-xs">
      {/* Barra superior de herramientas y filtros */}
      <div className="p-2 border-b border-zinc-800 bg-zinc-900/60 space-y-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder={t('grid.historySearchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-8 pr-7 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Scope (Esta conexión vs Todas) si aplica */}
          {currentConnectionId && hasMultipleConnections && (
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setScopeFilter('current')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  scopeFilter === 'current'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t('grid.historyScopeCurrent')}
              </button>
              <button
                onClick={() => setScopeFilter('all')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  scopeFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t('grid.historyScopeAll')}
              </button>
            </div>
          )}

          {/* Botón de limpiar historial */}
          <div className="relative">
            <button
              onClick={() => {
                if (favoritesCount > 0) {
                  setShowClearDropdown((prev) => !prev);
                } else {
                  if (confirm(t('grid.clearHistory') + '?')) {
                    onClearHistory(false, scopeFilter === 'current');
                  }
                }
              }}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
              title={t('grid.clearHistory')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('grid.clearHistory')}</span>
              {favoritesCount > 0 && <ChevronDown className="w-3 h-3 text-zinc-500" />}
            </button>

            {showClearDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowClearDropdown(false)} />
                <div className="absolute right-0 mt-1 z-50 w-56 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1 divide-y divide-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      onClearHistory(true, scopeFilter === 'current');
                      setShowClearDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">{t('grid.clearHistoryKeepFavorites')}</span>
                      <span className="text-[10px] text-zinc-500">
                        {favoritesCount} {favoritesCount === 1 ? 'favorita guardada' : 'favoritas guardadas'}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('grid.clearHistory') + ' ' + t('grid.clearHistoryAll') + '?')) {
                        onClearHistory(false, scopeFilter === 'current');
                        setShowClearDropdown(false);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-xs">{t('grid.clearHistoryAll')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Píldoras de estado (Todos, Favoritas, Éxito, Error) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {/* Todos */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
              }`}
            >
              <span>{t('grid.historyFilterAll')}</span>
              <span className="text-[10px] opacity-70 font-mono">({counts.all})</span>
            </button>

            {/* Favoritas */}
            <button
              onClick={() => setStatusFilter('favorites')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === 'favorites'
                  ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300 font-semibold shadow-xs'
                  : 'bg-zinc-950/80 text-zinc-400 hover:text-amber-300 border border-zinc-800/80'
              }`}
            >
              <Star
                className={`w-3 h-3 ${
                  statusFilter === 'favorites' ? 'text-amber-400 fill-amber-400' : 'text-amber-400/80'
                }`}
              />
              <span>{t('grid.historyFilterFavorites')}</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.favorites})</span>
            </button>

            {/* Éxito */}
            <button
              onClick={() => setStatusFilter('success')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-zinc-950/80 text-zinc-400 hover:text-emerald-300 border border-zinc-800/80'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{t('grid.historyFilterSuccess')}</span>
              <span className="text-[10px] opacity-70 font-mono">({counts.success})</span>
            </button>

            {/* Error */}
            <button
              onClick={() => setStatusFilter('error')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === 'error'
                  ? 'bg-red-950/60 border border-red-500/50 text-red-300 font-semibold'
                  : 'bg-zinc-950/80 text-zinc-400 hover:text-red-300 border border-zinc-800/80'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span>{t('grid.historyFilterError')}</span>
              <span className="text-[10px] opacity-70 font-mono">({counts.error})</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-500 font-mono shrink-0 hidden sm:block">
            {filteredHistory.length} {filteredHistory.length === 1 ? 'consulta' : 'consultas'}
          </div>
        </div>
      </div>

      {/* Lista de consultas del historial */}
      <div className="flex-1 overflow-auto p-3 space-y-2 select-text">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2 select-none">
            <Clock className="w-10 h-10 stroke-1 text-zinc-600 mb-1" />
            <p className="font-semibold text-zinc-300 text-sm">{t('grid.historyEmpty')}</p>
            <p className="text-[11px] max-w-sm text-center leading-relaxed text-zinc-500">
              {t('grid.historyEmptyDesc')}
            </p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-zinc-500 space-y-2 select-none">
            <Search className="w-8 h-8 stroke-1 text-zinc-600 mb-1" />
            <p className="text-zinc-300 text-xs font-medium">{t('grid.historyNoSearchResults')}</p>
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="text-xs text-emerald-400 hover:underline pt-1"
              >
                Limpiar término de búsqueda
              </button>
            )}
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isExpanded = expandedIds.has(item.id);
            const isCopied = copiedId === item.id;
            const lineCount = item.sql.split('\n').length;
            const isMultiLine = lineCount > 2 || item.sql.length > 130;

            return (
              <div
                key={item.id}
                className={`group rounded-xl border transition-all ${
                  item.isFavorite
                    ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50 shadow-xs'
                    : item.status === 'error'
                    ? 'bg-zinc-900/40 border-red-950/60 hover:border-red-900/60'
                    : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700/80'
                }`}
              >
                {/* Cabecera del ítem */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/60 select-none">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botón de Favorito ⭐ */}
                    {onToggleFavorite && (
                      <button
                        onClick={() => onToggleFavorite(item.id)}
                        className={`p-1 rounded-md transition-colors ${
                          item.isFavorite
                            ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                            : 'text-zinc-600 hover:text-amber-400 hover:bg-zinc-800/60'
                        }`}
                        title={t('grid.historyToggleFavorite')}
                      >
                        <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-amber-400' : ''}`} />
                      </button>
                    )}

                    {/* Estado: Éxito o Error */}
                    {item.status === 'success' ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>OK</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Error</span>
                      </span>
                    )}

                    {/* Base de Datos */}
                    {item.database && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/90 text-teal-300 font-mono text-[10px] border border-teal-500/20" title={`Base de datos: ${item.database}`}>
                        <Database className="w-2.5 h-2.5" />
                        <span>{item.database}</span>
                      </span>
                    )}

                    {/* Conexión (si se visualizan todas) */}
                    {scopeFilter === 'all' && item.connectionName && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/90 text-indigo-300 font-sans text-[10px] border border-indigo-500/20">
                        <Server className="w-2.5 h-2.5" />
                        <span>{item.connectionName}</span>
                      </span>
                    )}

                    {/* Timestamp relativo / formateado */}
                    <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>{formatTimestamp(item.timestamp, item.createdAt)}</span>
                    </span>

                    {/* Duración */}
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {item.durationMs} ms
                    </span>

                    {/* Conteo de filas */}
                    {item.rowCount !== undefined && (
                      <span className="text-[10px] bg-zinc-800/90 text-zinc-300 px-1.5 py-0.2 rounded font-mono border border-zinc-700/60">
                        {item.rowCount} {item.rowCount === 1 ? 'fila' : 'filas'}
                      </span>
                    )}
                  </div>

                  {/* Acciones del ítem (Cargar, Copiar, Eliminar) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botón Cargar en editor */}
                    <button
                      onClick={() => onSelectHistorySql(item.sql)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white rounded text-[11px] font-medium transition-colors"
                      title={t('grid.historyLoadSql')}
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      <span className="hidden sm:inline">{t('grid.historyLoadSql')}</span>
                    </button>

                    {/* Copiar SQL */}
                    <button
                      onClick={() => handleCopy(item.sql, item.id)}
                      className="p-1 hover:text-emerald-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                      title={t('common.copy')}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {/* Eliminar ítem */}
                    {onDeleteHistoryItem && (
                      <button
                        onClick={() => onDeleteHistoryItem(item.id)}
                        className="p-1 hover:text-red-400 text-zinc-500 hover:bg-zinc-800 rounded transition-colors"
                        title={t('grid.historyDeleteEntry')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cuerpo del ítem: Código SQL */}
                <div className="p-3 font-mono text-xs">
                  <div
                    onClick={() => {
                      if (isMultiLine) toggleExpand(item.id);
                      else onSelectHistorySql(item.sql);
                    }}
                    className={`text-zinc-200 cursor-pointer hover:text-white transition-colors leading-relaxed whitespace-pre-wrap select-text ${
                      !isExpanded && isMultiLine ? 'line-clamp-2 max-h-12 overflow-hidden' : ''
                    }`}
                  >
                    {item.sql}
                  </div>

                  {/* Botón de expandir / contraer si es multilínea */}
                  {isMultiLine && (
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="flex items-center gap-1 text-[11px] text-emerald-400/90 hover:text-emerald-300 mt-1.5 select-none font-sans"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>{t('grid.historyShowLess')}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>{t('grid.historyShowMore')} ({lineCount} líneas)</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Detalle de error si falló */}
                  {item.error && (
                    <div className="mt-2 p-2 bg-red-950/30 border border-red-900/40 rounded-lg text-red-300 text-[11px] flex items-start gap-1.5 font-sans">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{item.error}</span>
                    </div>
                  )}

                  {/* Notificación de copiado en la propia tarjeta */}
                  {isCopied && (
                    <div className="mt-1 text-[11px] text-emerald-400 font-sans flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3 h-3" />
                      <span>{t('grid.historyCopied')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
