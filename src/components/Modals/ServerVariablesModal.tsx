import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import {
  ServerVariableItem,
  ServerStatusItem,
  ServerVariablesResponse,
  ConnectionConfig,
} from '../../types';
import {
  Sliders,
  Search,
  X,
  RefreshCw,
  Copy,
  Check,
  Pencil,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  Cpu,
  Zap,
  BarChart2,
  Layers,
  Lock,
  Shield,
  FileSpreadsheet,
  FileJson,
  ExternalLink,
  Table2,
} from 'lucide-react';

interface ServerVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConfig: ConnectionConfig | null;
  onOpenInSqlEditor?: (sql: string, title?: string) => void;
}

type MainTab = 'variables' | 'status';

export const ServerVariablesModal: React.FC<ServerVariablesModalProps> = ({
  isOpen,
  onClose,
  activeConfig,
  onOpenInSqlEditor,
}) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<MainTab>('variables');
  const [data, setData] = useState<ServerVariablesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit Variable Modal state
  const [editingVariable, setEditingVariable] = useState<ServerVariableItem | null>(null);
  const [editNewValue, setEditNewValue] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Fetch variables & status
  const fetchVariables = useCallback(async () => {
    if (!window.electronAPI?.getServerVariables) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.getServerVariables();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Error al obtener variables del servidor');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchVariables();
      setSearchFilter('');
      setSelectedCategory('all');
      setError(null);
      setActionSuccess(null);
    }
  }, [isOpen, fetchVariables]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Categories definitions
  const variableCategories = useMemo(
    () => [
      { id: 'all', label: t('serverVariables.categoryAll') },
      { id: 'innodb', label: t('serverVariables.categoryInnodb') },
      { id: 'network', label: t('serverVariables.categoryNetwork') },
      { id: 'memory', label: t('serverVariables.categoryMemory') },
      { id: 'logs', label: t('serverVariables.categoryLogs') },
      { id: 'charset', label: t('serverVariables.categoryCharset') },
      { id: 'replication', label: t('serverVariables.categoryReplication') },
      { id: 'security', label: t('serverVariables.categorySecurity') },
      { id: 'performance', label: t('serverVariables.categoryPerformance') },
      { id: 'general', label: t('serverVariables.categoryGeneral') },
    ],
    [t]
  );

  const statusCategories = useMemo(
    () => [
      { id: 'all', label: t('serverVariables.categoryAll') },
      { id: 'traffic', label: t('serverVariables.categoryTraffic') },
      { id: 'innodb', label: t('serverVariables.categoryInnodb') },
      { id: 'connections', label: t('serverVariables.categoryConnections') },
      { id: 'memory', label: t('serverVariables.categoryMemory') },
      { id: 'tables_locks', label: t('serverVariables.categoryTables') },
      { id: 'temporary', label: t('serverVariables.categoryTemp') },
      { id: 'general', label: t('serverVariables.categoryGeneral') },
    ],
    [t]
  );

  // Filtered variables
  const filteredVariables = useMemo(() => {
    if (!data?.variables) return [];
    let list = data.variables;

    if (selectedCategory !== 'all') {
      list = list.filter((v) => v.category === selectedCategory);
    }

    const q = searchFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data?.variables, selectedCategory, searchFilter]);

  // Filtered status
  const filteredStatus = useMemo(() => {
    if (!data?.status) return [];
    let list = data.status;

    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    const q = searchFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data?.status, selectedCategory, searchFilter]);

  // Edit variable submission
  const handleSaveVariable = async () => {
    if (!editingVariable || !window.electronAPI?.setServerVariable) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      const res = await window.electronAPI.setServerVariable(editingVariable.name, editNewValue);
      if (res.success) {
        setActionSuccess(`${t('serverVariables.editSuccess')} ${editingVariable.name} = ${editNewValue}`);
        setTimeout(() => setActionSuccess(null), 3500);
        setEditingVariable(null);
        await fetchVariables();
      } else {
        setEditError(res.error || 'No se pudo aplicar el cambio a la variable');
      }
    } catch (err: any) {
      setEditError(err.message || 'Error inesperado al modificar variable');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Export handlers
  const handleExport = (type: 'csv' | 'json') => {
    setShowExportMenu(false);
    const items = activeTab === 'variables' ? filteredVariables : filteredStatus;
    if (items.length === 0) return;

    let content = '';
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;
    const filename = `server_${activeTab}_${ts}.${type}`;

    if (type === 'csv') {
      const header = '"Variable","Valor","Categoria"';
      const rows = items.map(
        (i) =>
          `"${i.name.replace(/"/g, '""')}","${i.value.replace(/"/g, '""')}","${i.category.replace(
            /"/g,
            '""'
          )}"`
      );
      content = [header, ...rows].join('\r\n');
    } else {
      content = JSON.stringify(items, null, 2);
    }

    if (window.electronAPI?.exportData) {
      window.electronAPI.exportData(content, filename, type);
    }
  };

  if (!isOpen) return null;

  const overview = data?.overview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">{t('serverVariables.title')}</h2>
                {overview && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      overview.flavor === 'mariadb'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {overview.flavor} {overview.version.split('-')[0]}
                  </span>
                )}
                {activeConfig && (
                  <span className="text-zinc-500 text-xs font-mono hidden sm:inline">
                    ({activeConfig.host}:{activeConfig.port})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                {t('serverVariables.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Refrescar */}
            <button
              onClick={fetchVariables}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs border border-zinc-700 transition-colors disabled:opacity-50"
              title="Refrescar variables y métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </button>

            {/* Exportar */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs border border-zinc-700 transition-colors"
                title="Exportar listado"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">{t('grid.export')}</span>
              </button>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1 z-50 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 divide-y divide-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>{t('serverVariables.exportCsv')}</span>
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <FileJson className="w-4 h-4 text-amber-400" />
                      <span>{t('serverVariables.exportJson')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Cerrar */}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificación de éxito al modificar variable */}
        {actionSuccess && (
          <div className="mx-5 mt-3 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono">{actionSuccess}</span>
          </div>
        )}

        {/* Error global */}
        {error && (
          <div className="mx-5 mt-3 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KPIs Banner (Métricas destacadas de rendimiento) */}
        {overview && (
          <div className="px-5 pt-3 pb-1 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* Uptime */}
              <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold mb-1">
                  <span>{t('serverVariables.kpiUptime')}</span>
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-sm font-bold font-mono text-zinc-100">
                  {overview.uptimeFormatted}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {overview.uptimeSeconds.toLocaleString()} seg
                </div>
              </div>

              {/* Conexiones */}
              <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold mb-1">
                  <span>{t('serverVariables.kpiConnections')}</span>
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold font-mono text-zinc-100">
                    {overview.threadsConnected}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    / {overview.maxConnections}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        overview.connectionUsagePct > 80
                          ? 'bg-red-500'
                          : overview.connectionUsagePct > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, overview.connectionUsagePct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {overview.connectionUsagePct}%
                  </span>
                </div>
              </div>

              {/* Consultas (QPS) */}
              <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold mb-1">
                  <span>{t('serverVariables.kpiQps')}</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-sm font-bold font-mono text-amber-400">
                  {overview.queriesPerSecond.toLocaleString()} QPS
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {overview.queriesTotal.toLocaleString()} totales
                </div>
              </div>

              {/* Buffer Pool Hit Ratio */}
              <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold mb-1">
                  <span>{t('serverVariables.kpiBufferPool')}</span>
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-sm font-bold font-mono text-zinc-100">
                  {overview.bufferPoolSizeFormatted}
                </div>
                <div className="text-[10px] font-mono">
                  {overview.bufferPoolHitRatio !== null ? (
                    <span
                      className={
                        overview.bufferPoolHitRatio >= 99
                          ? 'text-emerald-400'
                          : overview.bufferPoolHitRatio >= 95
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {overview.bufferPoolHitRatio}% acierto
                    </span>
                  ) : (
                    <span className="text-zinc-500">Hit ratio N/D</span>
                  )}
                </div>
              </div>

              {/* Tráfico & Consultas Lentas */}
              <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold mb-1">
                  <span>{t('serverVariables.kpiTraffic')}</span>
                  <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-[11px] font-mono text-zinc-200">
                  ↓ {overview.bytesReceivedFormatted} / ↑ {overview.bytesSentFormatted}
                </div>
                <div className="text-[10px] font-mono">
                  {overview.slowQueries > 0 ? (
                    <span className="text-amber-400 font-bold">
                      {overview.slowQueries} lentas
                    </span>
                  ) : (
                    <span className="text-zinc-500">0 consultas lentas</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pestañas Principales (Variables vs Estado) */}
        <div className="flex items-center justify-between px-5 border-b border-zinc-800 bg-zinc-950/40 shrink-0 mt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setActiveTab('variables');
                setSelectedCategory('all');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'variables'
                  ? 'border-cyan-500 text-cyan-400 bg-zinc-900/50'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{t('serverVariables.tabVariables')}</span>
              {data?.variables && (
                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono text-zinc-300">
                  {data.variables.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('status');
                setSelectedCategory('all');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'status'
                  ? 'border-cyan-500 text-cyan-400 bg-zinc-900/50'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{t('serverVariables.tabStatus')}</span>
              {data?.status && (
                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono text-zinc-300">
                  {data.status.length}
                </span>
              )}
            </button>
          </div>

          {/* Contador de filas mostradas */}
          <div className="text-[11px] text-zinc-500 font-mono hidden sm:block">
            {activeTab === 'variables' ? filteredVariables.length : filteredStatus.length}{' '}
            {t('grid.rows')}
          </div>
        </div>

        {/* Barra de Búsqueda y Píldoras de Categorías */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-900/40 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder={t('serverVariables.searchPlaceholder')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categorías en píldoras */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(activeTab === 'variables' ? variableCategories : statusCategories).map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="flex-1 overflow-auto bg-zinc-950 select-text">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10 select-none shadow-xs text-zinc-400">
              <tr>
                <th className="w-12 px-3 py-2 text-center text-zinc-500 font-normal border-r border-zinc-800">
                  #
                </th>
                <th className="px-4 py-2 font-semibold border-r border-zinc-800">
                  {t('serverVariables.colVariable')}
                </th>
                <th className="px-4 py-2 font-semibold border-r border-zinc-800">
                  {t('serverVariables.colValue')}
                </th>
                <th className="w-32 px-3 py-2 font-semibold border-r border-zinc-800 hidden md:table-cell">
                  {t('serverVariables.colCategory')}
                </th>
                <th className="w-28 px-3 py-2 text-center font-semibold">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-300">
              {activeTab === 'variables' ? (
                filteredVariables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500 select-none">
                      {isLoading ? 'Cargando variables...' : 'No se encontraron variables con el filtro actual.'}
                    </td>
                  </tr>
                ) : (
                  filteredVariables.map((item, idx) => {
                    const isCopied = copiedKey === item.name;
                    return (
                      <tr key={item.name} className="hover:bg-zinc-900/60 transition-colors group">
                        <td className="w-12 px-3 py-1.5 text-center text-zinc-500 border-r border-zinc-900 select-none bg-zinc-950/40">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-1.5 border-r border-zinc-900/80 font-bold text-zinc-200">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{item.name}</span>
                            <button
                              onClick={() => copyToClipboard(item.name, item.name)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-cyan-400 text-zinc-500 transition-opacity"
                              title="Copiar nombre de variable"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-1.5 border-r border-zinc-900/80 text-zinc-300 break-all">
                          <span
                            className={
                              item.value === 'ON'
                                ? 'text-emerald-400 font-bold'
                                : item.value === 'OFF'
                                ? 'text-zinc-500'
                                : !isNaN(Number(item.value))
                                ? 'text-cyan-300'
                                : 'text-zinc-200'
                            }
                          >
                            {item.value || <span className="text-zinc-600 italic">(vacío)</span>}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 border-r border-zinc-900/80 hidden md:table-cell select-none">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center select-none">
                          <div className="flex items-center justify-center gap-1">
                            {/* Editar variable */}
                            <button
                              onClick={() => {
                                setEditingVariable(item);
                                setEditNewValue(item.value);
                                setEditError(null);
                              }}
                              className="p-1 hover:text-cyan-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                              title="Modificar variable (SET GLOBAL)"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            {/* Copiar sentencia SQL */}
                            <button
                              onClick={() =>
                                copyToClipboard(`SET GLOBAL \`${item.name}\` = '${item.value}';`, `${item.name}_sql`)
                              }
                              className="p-1 hover:text-emerald-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                              title="Copiar sentencia SET GLOBAL"
                            >
                              {copiedKey === `${item.name}_sql` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : filteredStatus.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500 select-none">
                    {isLoading ? 'Cargando métricas de estado...' : 'No se encontraron métricas con el filtro actual.'}
                  </td>
                </tr>
              ) : (
                filteredStatus.map((item, idx) => {
                  const isCopied = copiedKey === item.name;
                  return (
                    <tr key={item.name} className="hover:bg-zinc-900/60 transition-colors group">
                      <td className="w-12 px-3 py-1.5 text-center text-zinc-500 border-r border-zinc-900 select-none bg-zinc-950/40">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-1.5 border-r border-zinc-900/80 font-bold text-zinc-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{item.name}</span>
                          <button
                            onClick={() => copyToClipboard(item.name, item.name)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-cyan-400 text-zinc-500 transition-opacity"
                            title="Copiar nombre"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-1.5 border-r border-zinc-900/80 text-zinc-300 break-all">
                        <span
                          className={
                            item.value === 'ON'
                              ? 'text-emerald-400 font-bold'
                              : item.value === 'OFF'
                              ? 'text-zinc-500'
                              : item.numericValue !== undefined
                              ? 'text-amber-300 font-bold'
                              : 'text-zinc-200'
                          }
                        >
                          {item.numericValue !== undefined
                            ? item.numericValue.toLocaleString()
                            : item.value || <span className="text-zinc-600 italic">(vacío)</span>}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-zinc-900/80 hidden md:table-cell select-none">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center select-none">
                        <button
                          onClick={() => copyToClipboard(item.value, `${item.name}_val`)}
                          className="p-1 hover:text-cyan-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                          title="Copiar valor"
                        >
                          {copiedKey === `${item.name}_val` ? (
                            <Check className="w-3 h-3 text-cyan-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs shrink-0 select-none">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="font-mono text-[11px]">
              Actualizado: {data?.serverTime || new Date().toLocaleTimeString()}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Modal / Diálogo de edición de variable SET GLOBAL */}
      {editingVariable && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-100">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-zinc-100">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-xs uppercase tracking-wide">
                  {t('serverVariables.editVariableTitle')}
                </h3>
              </div>
              <button
                onClick={() => setEditingVariable(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div>
                <span className="text-zinc-400 text-[11px]">Variable:</span>
                <div className="font-mono font-bold text-cyan-300 text-sm mt-0.5">
                  {editingVariable.name}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 text-[11px]">{t('serverVariables.currentValue')}</span>
                <div className="font-mono text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800 mt-1 break-all select-text">
                  {editingVariable.value || <span className="text-zinc-600 italic">(vacío)</span>}
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium text-[11px] mb-1">
                  {t('serverVariables.newValue')}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editNewValue}
                  onChange={(e) => setEditNewValue(e.target.value)}
                  className="w-full px-3 py-1.5 font-mono text-xs rounded bg-zinc-950 border border-zinc-700 focus:outline-none focus:border-cyan-500 text-zinc-100"
                />
              </div>

              {/* Vista previa SQL */}
              <div className="p-2.5 bg-zinc-950/80 rounded border border-zinc-800 text-[11px]">
                <div className="text-zinc-500 uppercase font-semibold text-[10px] mb-1">
                  Comando SQL generado:
                </div>
                <div className="font-mono text-cyan-400 select-text">
                  SET GLOBAL `{editingVariable.name}` = {/^-?\d+(\.\d+)?$/.test(editNewValue.trim()) || ['ON', 'OFF', 'DEFAULT'].includes(editNewValue.trim().toUpperCase()) ? editNewValue.trim() : `'${editNewValue.replace(/'/g, "''")}'`};
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 leading-normal">
                {t('serverVariables.readOnlyNotice')}
              </div>

              {editError && (
                <div className="p-2.5 bg-red-950/40 border border-red-900/50 rounded text-red-300 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
              {onOpenInSqlEditor && (
                <button
                  type="button"
                  onClick={() => {
                    const sql = `SET GLOBAL \`${editingVariable.name}\` = '${editNewValue}';`;
                    onOpenInSqlEditor(sql, `SET ${editingVariable.name}`);
                    setEditingVariable(null);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-cyan-300"
                  title="Abrir sentencia en el editor de consultas SQL"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en editor</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingVariable(null)}
                  disabled={isSavingEdit}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveVariable}
                  disabled={isSavingEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{t('serverVariables.applyChange')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
