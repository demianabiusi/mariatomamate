import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useTranslation } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';
import { DbProcessItem, ProcessListResponse } from '../../types';
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  Search,
  Filter,
  X,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Clock,
  Database,
  User,
  XCircle,
  Eye,
  Sliders,
  CheckCircle2,
  Lock,
  Zap,
  Server
} from 'lucide-react';

loader.config({ monaco });

interface ProcessViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInSqlEditor: (sql: string, title?: string) => void;
}

export const ProcessViewerModal: React.FC<ProcessViewerModalProps> = ({
  isOpen,
  onClose,
  onOpenInSqlEditor
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Polling state
  const [isPolling, setIsPolling] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState(2000);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Data state
  const [data, setData] = useState<ProcessListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter state
  const [searchFilter, setSearchFilter] = useState('');
  const [hideSleep, setHideSleep] = useState(false);
  const [hideSelf, setHideSelf] = useState(false);
  const [selectedDbFilter, setSelectedDbFilter] = useState<string>('ALL');

  // Selected process for detailed inspection
  const [selectedProcess, setSelectedProcess] = useState<DbProcessItem | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Confirmation modal for KILL
  const [killConfirmTarget, setKillConfirmTarget] = useState<{
    id: number;
    user: string;
    type: 'CONNECTION' | 'QUERY';
    isSelf: boolean;
  } | null>(null);
  const [isKilling, setIsKilling] = useState(false);

  // Polling timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch process list
  const fetchProcesses = useCallback(async (isManual: boolean = false) => {
    if (!window.electronAPI) return;
    if (isManual) setIsLoading(true);
    try {
      const res = await window.electronAPI.getProcessList();
      if (res.success && res.data) {
        setData(res.data);
        setLastUpdatedTime(res.data.serverTime || new Date().toLocaleTimeString());
        setError(null);

        // Keep selectedProcess synchronized if it's still alive
        if (selectedProcess) {
          const updated = res.data.processes.find(p => p.id === selectedProcess.id);
          if (updated) {
            setSelectedProcess(updated);
          }
        }
      } else {
        setError(res.error || 'Error al obtener procesos');
      }
    } catch (err: any) {
      setError(err.message || 'Error al consultar procesos del servidor');
    } finally {
      if (isManual) setIsLoading(false);
    }
  }, [selectedProcess]);

  // Handle polling lifecycle
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Initial fetch
    fetchProcesses(true);

    if (isPolling && pollIntervalMs > 0) {
      timerRef.current = setInterval(() => {
        fetchProcesses(false);
      }, pollIntervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPolling, pollIntervalMs, fetchProcesses]);

  // Kill Process or Query
  const handleExecuteKill = async () => {
    if (!killConfirmTarget || !window.electronAPI) return;
    setIsKilling(true);
    setError(null);
    try {
      const res = await window.electronAPI.killProcess(killConfirmTarget.id, killConfirmTarget.type);
      if (res.success) {
        setActionSuccess(
          killConfirmTarget.type === 'QUERY'
            ? `Consulta del proceso #${killConfirmTarget.id} cancelada.`
            : `Conexión del proceso #${killConfirmTarget.id} terminada.`
        );
        setTimeout(() => setActionSuccess(null), 3000);
        if (selectedProcess?.id === killConfirmTarget.id) {
          setSelectedProcess(null);
        }
        setKillConfirmTarget(null);
        await fetchProcesses(false);
      } else {
        throw new Error(res.error || 'Error al terminar proceso');
      }
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar KILL');
    } finally {
      setIsKilling(false);
    }
  };

  // Unique databases in active process list
  const availableDbs = useMemo(() => {
    if (!data?.processes) return [];
    const set = new Set<string>();
    for (const p of data.processes) {
      if (p.db) set.add(p.db);
    }
    return Array.from(set).sort();
  }, [data?.processes]);

  // Filtered processes list
  const filteredProcesses = useMemo(() => {
    if (!data?.processes) return [];
    return data.processes.filter(p => {
      if (hideSleep && p.command.toLowerCase() === 'sleep') return false;
      if (hideSelf && p.isCurrentConnection) return false;
      if (selectedDbFilter !== 'ALL' && p.db !== selectedDbFilter) return false;

      if (!searchFilter.trim()) return true;
      const term = searchFilter.toLowerCase();
      return (
        String(p.id).includes(term) ||
        p.user.toLowerCase().includes(term) ||
        p.host.toLowerCase().includes(term) ||
        (p.db && p.db.toLowerCase().includes(term)) ||
        p.command.toLowerCase().includes(term) ||
        (p.state && p.state.toLowerCase().includes(term)) ||
        (p.info && p.info.toLowerCase().includes(term))
      );
    });
  }, [data?.processes, hideSleep, hideSelf, selectedDbFilter, searchFilter]);

  const copySql = () => {
    if (!selectedProcess?.info) return;
    navigator.clipboard.writeText(selectedProcess.info);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-7xl h-[92vh] max-h-[880px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">
                  {t('process.title') || 'Visor de Procesos en Tiempo Real (Processlist)'}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5 border ${
                  isPolling 
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span>{isPolling ? 'Poleo Activo' : 'Pausado'}</span>
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {t('process.subtitle') || 'Monitorea consultas en ejecución, hilos durmientes y finaliza procesos bloqueados del servidor.'}
              </p>
            </div>
          </div>

          {/* Polling & Interval Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setIsPolling(!isPolling)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors font-medium text-xs ${
                  isPolling 
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' 
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
                title={isPolling ? 'Pausar actualización automática' : 'Reanudar actualización automática'}
              >
                {isPolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isPolling ? 'Pausar' : 'Reanudar'}</span>
              </button>

              <div className="h-4 w-px bg-zinc-800 mx-1" />

              <div className="flex items-center gap-1 px-1.5 text-zinc-400 text-[11px]">
                <Clock className="w-3 h-3 text-zinc-500" />
                <select
                  value={pollIntervalMs}
                  onChange={(e) => {
                    const ms = Number(e.target.value);
                    setPollIntervalMs(ms);
                    if (ms === 0) setIsPolling(false);
                    else setIsPolling(true);
                  }}
                  className="bg-transparent border-0 text-zinc-200 text-xs focus:ring-0 cursor-pointer"
                >
                  <option value={1000} className="bg-zinc-900">Cada 1s</option>
                  <option value={2000} className="bg-zinc-900">Cada 2s</option>
                  <option value={3000} className="bg-zinc-900">Cada 3s</option>
                  <option value={5000} className="bg-zinc-900">Cada 5s</option>
                  <option value={10000} className="bg-zinc-900">Cada 10s</option>
                  <option value={0} className="bg-zinc-900">Manual</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchProcesses(true)}
              disabled={isLoading}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs transition-colors disabled:opacity-50"
              title="Refrescar ahora"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors ml-2"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status / Alert Bar */}
        {error && (
          <div className="px-4 py-2 bg-red-950/40 border-b border-red-500/30 text-red-200 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-zinc-400 hover:text-zinc-200 text-xs">✕</button>
          </div>
        )}

        {actionSuccess && (
          <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-zinc-400 hover:text-zinc-200 text-xs">✕</button>
          </div>
        )}

        {/* Live Server Metrics KPIs */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/60 grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0 text-xs">
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Conexiones</span>
              <span className="text-sm font-bold font-mono text-zinc-100">{data?.summary.total ?? 0}</span>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Ejecutando (Active)</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{data?.summary.active ?? 0}</span>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Inactivos (Sleep)</span>
              <span className="text-sm font-bold font-mono text-zinc-400">{data?.summary.sleeping ?? 0}</span>
            </div>
          </div>

          <div className={`border rounded-lg p-2.5 flex items-center gap-3 ${
            (data?.summary.locked ?? 0) > 0 
              ? 'bg-red-500/10 border-red-500/40 text-red-200' 
              : 'bg-zinc-900/70 border-zinc-800/80'
          }`}>
            <div className={`p-2 rounded-lg ${
              (data?.summary.locked ?? 0) > 0 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'
            }`}>
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Bloqueos (Locks)</span>
              <span className={`text-sm font-bold font-mono ${
                (data?.summary.locked ?? 0) > 0 ? 'text-red-400 font-extrabold animate-pulse' : 'text-zinc-400'
              }`}>
                {data?.summary.locked ?? 0}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2.5 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              (data?.summary.maxTime ?? 0) > 30 
                ? 'bg-red-500/20 text-red-400' 
                : (data?.summary.maxTime ?? 0) > 5 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Mayor Tiempo Activo</span>
              <span className={`text-sm font-bold font-mono ${
                (data?.summary.maxTime ?? 0) > 30 
                  ? 'text-red-400' 
                  : (data?.summary.maxTime ?? 0) > 5 
                  ? 'text-amber-400' 
                  : 'text-zinc-200'
              }`}>
                {data?.summary.maxTime ? `${data.summary.maxTime}s` : '0s'}
              </span>
            </div>
          </div>
        </div>

        {/* Filters and search toolstrip */}
        <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar por ID, usuario, host, base de datos o consulta..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-xs text-zinc-300">
            {/* Filter by DB */}
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={selectedDbFilter}
                onChange={(e) => setSelectedDbFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="ALL">Todas las bases de datos</option>
                {availableDbs.map(db => (
                  <option key={db} value={db}>{db}</option>
                ))}
              </select>
            </div>

            {/* Toggle Hide Sleep */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={hideSleep}
                onChange={(e) => setHideSleep(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <span>Ocultar Sleep (Inactivos)</span>
            </label>

            {/* Toggle Hide Self */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={hideSelf}
                onChange={(e) => setHideSelf(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <span>Ocultar mi propia sesión</span>
            </label>

            <span className="text-[11px] text-zinc-500 font-mono">
              Mostrando: <strong>{filteredProcesses.length}</strong> / {data?.processes.length ?? 0}
            </span>
          </div>
        </div>

        {/* Processlist Data Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-900/90 text-zinc-400 sticky top-0 z-10 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-3 w-16">ID</th>
                  <th className="py-2 px-3 w-32">Usuario</th>
                  <th className="py-2 px-3 w-40">Host</th>
                  <th className="py-2 px-3 w-32">Base de Datos</th>
                  <th className="py-2 px-3 w-28">Comando</th>
                  <th className="py-2 px-3 w-24">Tiempo</th>
                  <th className="py-2 px-3 w-44">Estado</th>
                  <th className="py-2 px-3 min-w-[200px]">Consulta SQL (Info)</th>
                  <th className="py-2 px-3 w-28 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-200">
                {filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-zinc-500">
                      No se encontraron procesos activos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredProcesses.map((p) => {
                    const isSelected = selectedProcess?.id === p.id;
                    const isSleep = p.command.toLowerCase() === 'sleep';
                    const isLongRunning = p.time > 10 && !isSleep;
                    const isCriticalRunning = p.time > 60 && !isSleep;
                    const isLock = p.state?.toLowerCase().includes('lock');

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProcess(p)}
                        className={`cursor-pointer transition-colors font-mono text-[11px] ${
                          isSelected
                            ? 'bg-emerald-500/15 text-zinc-100'
                            : isLock
                            ? 'bg-red-500/10 hover:bg-red-500/20'
                            : isCriticalRunning
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : 'hover:bg-zinc-900/60'
                        }`}
                      >
                        {/* ID */}
                        <td className="py-2 px-3 font-bold text-zinc-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{p.id}</span>
                            {p.isCurrentConnection && (
                              <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-sans font-bold rounded">
                                Tú
                              </span>
                            )}
                          </div>
                        </td>

                        {/* User */}
                        <td className="py-2 px-3 truncate max-w-[130px]" title={p.user}>
                          {p.user}
                        </td>

                        {/* Host */}
                        <td className="py-2 px-3 text-zinc-400 truncate max-w-[160px]" title={p.host}>
                          {p.host}
                        </td>

                        {/* Database */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {p.db ? (
                            <span className="px-1.5 py-0.5 bg-zinc-800/80 rounded text-emerald-300 font-bold text-[10px]">
                              {p.db}
                            </span>
                          ) : (
                            <span className="text-zinc-600 italic">null</span>
                          )}
                        </td>

                        {/* Command */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isSleep 
                              ? 'bg-zinc-800 text-zinc-500' 
                              : p.command.toLowerCase() === 'query' 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}>
                            {p.command}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="py-2 px-3 whitespace-nowrap font-bold">
                          <span className={
                            isCriticalRunning 
                              ? 'text-red-400 font-extrabold flex items-center gap-1' 
                              : isLongRunning 
                              ? 'text-amber-400 flex items-center gap-1' 
                              : isSleep 
                              ? 'text-zinc-500 font-normal' 
                              : 'text-zinc-300'
                          }>
                            {(isLongRunning || isCriticalRunning) && <AlertTriangle className="w-3 h-3 shrink-0" />}
                            {p.time}s
                          </span>
                        </td>

                        {/* State */}
                        <td className="py-2 px-3 text-zinc-400 truncate max-w-[180px]" title={p.state || ''}>
                          {isLock ? (
                            <span className="text-red-400 font-bold flex items-center gap-1 truncate">
                              <Lock className="w-3 h-3 shrink-0" />
                              {p.state}
                            </span>
                          ) : (
                            p.state || <span className="text-zinc-600">-</span>
                          )}
                        </td>

                        {/* Info / SQL */}
                        <td className="py-2 px-3 max-w-[350px] truncate font-sans text-zinc-300" title={p.info || ''}>
                          {p.info ? (
                            <span className="font-mono text-[11px] text-zinc-200">{p.info}</span>
                          ) : (
                            <span className="text-zinc-600 italic">null</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedProcess(p)}
                              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                              title="Ver detalles y SQL completo"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {p.command.toLowerCase() === 'query' && (
                              <button
                                type="button"
                                onClick={() => setKillConfirmTarget({
                                  id: p.id,
                                  user: p.user,
                                  type: 'QUERY',
                                  isSelf: p.isCurrentConnection
                                })}
                                className="p-1 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded transition-colors"
                                title="Cancelar solo la consulta (KILL QUERY)"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setKillConfirmTarget({
                                id: p.id,
                                user: p.user,
                                type: 'CONNECTION',
                                isSelf: p.isCurrentConnection
                              })}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
                              title="Cerrar la conexión completa (KILL)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Lower Drawer: Detailed Query Inspector */}
          {selectedProcess && (
            <div className="h-64 border-t border-zinc-800 bg-zinc-900/90 flex flex-col shrink-0 animate-in slide-in-from-bottom-2 duration-150">
              <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-zinc-200">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Proceso #{selectedProcess.id}</span>
                  </div>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">Usuario: <strong className="text-zinc-200">{selectedProcess.user}</strong></span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">Host: <strong className="text-zinc-200">{selectedProcess.host}</strong></span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">BD: <strong className="text-emerald-300">{selectedProcess.db || 'ninguna'}</strong></span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">Tiempo: <strong className="text-zinc-200">{selectedProcess.time}s</strong></span>
                  {selectedProcess.state && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400">Estado: <strong className="text-zinc-200">{selectedProcess.state}</strong></span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {selectedProcess.info && (
                    <>
                      <button
                        type="button"
                        onClick={copySql}
                        className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors"
                        title="Copiar SQL de la consulta"
                      >
                        {sqlCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{sqlCopied ? '¡Copiado!' : 'Copiar SQL'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenInSqlEditor(selectedProcess.info!, `Proceso #${selectedProcess.id}`);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs rounded transition-colors"
                        title="Abrir en el editor SQL para inspeccionar o ejecutar EXPLAIN"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir en Pestaña SQL</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setKillConfirmTarget({
                      id: selectedProcess.id,
                      user: selectedProcess.user,
                      type: 'CONNECTION',
                      isSelf: selectedProcess.isCurrentConnection
                    })}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-500/30 text-xs rounded transition-colors"
                    title="Terminar este proceso"
                  >
                    <X className="w-3 h-3 text-red-400" />
                    <span>Terminar Proceso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProcess(null)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 ml-2"
                    title="Cerrar panel de detalles"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Monaco Editor with SQL Info */}
              <div className="flex-1 bg-[#1e1e1e] overflow-hidden">
                {selectedProcess.info ? (
                  <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme={theme === 'light' ? 'vs' : 'vs-dark'}
                    value={selectedProcess.info}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 12,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic">
                    Este hilo no está ejecutando ninguna consulta SQL actualmente ({selectedProcess.command}).
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-900/70 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <div>
            <span>Última actualización: <strong>{lastUpdatedTime || '-'}</strong></span>
            {pollIntervalMs > 0 && isPolling && (
              <span className="ml-2 font-mono text-[11px] text-zinc-400">
                (refrescando cada {pollIntervalMs / 1000}s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* KILL Confirmation Modal */}
        {killConfirmTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-red-500/15 text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    {killConfirmTarget.type === 'QUERY' ? '¿Cancelar consulta activa?' : '¿Terminar conexión del proceso?'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Proceso ID: <strong className="font-mono text-zinc-200">#{killConfirmTarget.id}</strong> ({killConfirmTarget.user})
                  </p>
                </div>
              </div>

              {killConfirmTarget.isSelf && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span><strong>¡Advertencia!</strong> Estás a punto de terminar tu propia conexión activa. Esto desconectará tu sesión actual en la aplicación.</span>
                </div>
              )}

              <p className="text-xs text-zinc-400">
                {killConfirmTarget.type === 'QUERY'
                  ? 'Se enviará la instrucción KILL QUERY para detener la consulta en ejecución sin desconectar al cliente.'
                  : 'Se enviará la instrucción KILL para abortar la conexión del cliente por completo.'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setKillConfirmTarget(null)}
                  disabled={isKilling}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-lg border border-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteKill}
                  disabled={isKilling}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isKilling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{killConfirmTarget.type === 'QUERY' ? 'Sí, Cancelar Consulta' : 'Sí, Terminar Conexión'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
