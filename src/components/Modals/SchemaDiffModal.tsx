import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useTranslation } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';
import { 
  ConnectionConfig, 
  SchemaDiffResult, 
  TableDiffItem, 
  GenericObjectDiffItem,
  MigrationScriptOptions,
  MigrationExecutionResult,
  CompareProgress,
  MigrationProgress
} from '../../types';
import { 
  GitCompare, 
  X, 
  Play, 
  Copy, 
  Check, 
  Save, 
  FileCode, 
  Layers, 
  ArrowRight, 
  ArrowLeftRight, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Table, 
  Eye, 
  Zap, 
  Sliders, 
  Code2, 
  Database,
  Filter,
  ShieldAlert,
  Clock,
  CheckSquare,
  Square,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

loader.config({ monaco });

interface SchemaDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedConnections: ConnectionConfig[];
  activeConfig: ConnectionConfig | null;
  activeDatabase: string | null;
  onOpenInSqlEditor: (sql: string, title?: string) => void;
  onRefreshActiveSchema?: () => void;
}

export const SchemaDiffModal: React.FC<SchemaDiffModalProps> = ({
  isOpen,
  onClose,
  savedConnections = [],
  activeConfig,
  activeDatabase,
  onOpenInSqlEditor,
  onRefreshActiveSchema
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // All available connections (active connection if not in saved list, plus saved list)
  const connectionList = useMemo(() => {
    const list = [...savedConnections];
    if (activeConfig && !list.some(c => c.id === activeConfig.id)) {
      list.unshift(activeConfig);
    }
    return list;
  }, [savedConnections, activeConfig]);

  // Source & Target connection states
  const [sourceConnId, setSourceConnId] = useState<string>('');
  const [sourceDb, setSourceDb] = useState<string>('');
  const [sourceDatabases, setSourceDatabases] = useState<string[]>([]);
  const [isLoadingSourceDbs, setIsLoadingSourceDbs] = useState(false);

  const [targetConnId, setTargetConnId] = useState<string>('');
  const [targetDb, setTargetDb] = useState<string>('');
  const [targetDatabases, setTargetDatabases] = useState<string[]>([]);
  const [isLoadingTargetDbs, setIsLoadingTargetDbs] = useState(false);

  // Script options
  const [options, setOptions] = useState<MigrationScriptOptions>({
    includeDropTables: false,
    includeDropColumns: false,
    includeDropIndexes: true,
    includeDropForeignKeys: true,
    includeDropRoutines: false,
    includeDropTriggers: false,
    includeDropEvents: false
  });
  const [showOptionsDrawer, setShowOptionsDrawer] = useState(false);

  // Comparison states
  const [isComparing, setIsComparing] = useState(false);
  const [compareProgress, setCompareProgress] = useState<CompareProgress | null>(null);
  const [diffResult, setDiffResult] = useState<SchemaDiffResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Selection states for generated script: keys like "table:users", "view:v_active"
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  // Generated script
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Active Tab: 'diff' or 'script'
  const [activeModalTab, setActiveModalTab] = useState<'diff' | 'script'>('diff');

  // Inspector selected item
  const [selectedObjectKey, setSelectedObjectKey] = useState<string | null>(null);
  const [tableInspectorTab, setTableInspectorTab] = useState<'columns' | 'indexes' | 'fks' | 'ddl'>('columns');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hideIdentical, setHideIdentical] = useState(true);

  // Copy feedback
  const [isCopied, setIsCopied] = useState(false);

  // Target Execution states
  const [isConfirmApplyOpen, setIsConfirmApplyOpen] = useState(false);
  const [isExecutingTarget, setIsExecutingTarget] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<MigrationExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Helper to load databases for a given connection id
  const fetchDatabasesForConn = useCallback(async (connId: string): Promise<string[]> => {
    const conn = connectionList.find(c => c.id === connId);
    if (!conn) return [];
    try {
      const res = await window.electronAPI.getDatabasesForConnection(conn);
      if (res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.error('Error fetching databases for conn:', err);
    }
    return [];
  }, [connectionList]);

  // Clean initialization whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    // Reset results & state
    setComparisonError(null);
    setExecutionResult(null);
    setExecutionError(null);
    setIsConfirmApplyOpen(false);
    setDiffResult(null);
    setGeneratedScript('');
    setSelectedItems({});
    setCompareProgress(null);
    setMigrationProgress(null);
    setActiveModalTab('diff');
    setSelectedObjectKey(null);

    const init = async () => {
      // 1. Determine initial source connection
      const initialSourceId = activeConfig?.id || (connectionList[0]?.id || '');
      setSourceConnId(initialSourceId);
      setIsLoadingSourceDbs(true);

      // 2. Determine initial target connection
      const initialTargetId = connectionList.length > 1
        ? connectionList.find(c => c.id !== initialSourceId)?.id || initialSourceId
        : initialSourceId;
      setTargetConnId(initialTargetId);
      setIsLoadingTargetDbs(true);

      // Fetch both in parallel
      const [srcDbs, tgtDbs] = await Promise.all([
        fetchDatabasesForConn(initialSourceId),
        fetchDatabasesForConn(initialTargetId)
      ]);

      if (!isMounted) return;

      setSourceDatabases(srcDbs);
      setIsLoadingSourceDbs(false);

      // Pick source database: prefer activeDatabase if source is active connection
      let chosenSrcDb = '';
      if (activeDatabase && initialSourceId === activeConfig?.id && srcDbs.includes(activeDatabase)) {
        chosenSrcDb = activeDatabase;
      } else if (srcDbs.length > 0) {
        chosenSrcDb = srcDbs[0];
      }
      setSourceDb(chosenSrcDb);

      setTargetDatabases(tgtDbs);
      setIsLoadingTargetDbs(false);

      // Pick target database: if same connection, pick a different database if available
      let chosenTgtDb = '';
      if (initialSourceId === initialTargetId && tgtDbs.length > 1) {
        const diffDb = tgtDbs.find(d => d !== chosenSrcDb);
        chosenTgtDb = diffDb || tgtDbs[0] || '';
      } else if (tgtDbs.length > 0) {
        chosenTgtDb = tgtDbs[0];
      }
      setTargetDb(chosenTgtDb);
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Subscribe to progress events from main process
  useEffect(() => {
    if (!isOpen) return;

    const unregCompare = window.electronAPI?.onCompareProgress?.((prog: CompareProgress) => {
      setCompareProgress(prog);
    });

    const unregMigration = window.electronAPI?.onMigrationProgress?.((prog: MigrationProgress) => {
      setMigrationProgress(prog);
    });

    return () => {
      if (unregCompare) unregCompare();
      if (unregMigration) unregMigration();
    };
  }, [isOpen]);

  // Manual source connection change handler
  const handleSourceConnChange = async (newConnId: string) => {
    setSourceConnId(newConnId);
    setSourceDb('');
    setDiffResult(null);
    setGeneratedScript('');
    setComparisonError(null);
    setIsLoadingSourceDbs(true);

    const dbs = await fetchDatabasesForConn(newConnId);
    setSourceDatabases(dbs);
    setIsLoadingSourceDbs(false);

    let chosen = '';
    if (activeDatabase && newConnId === activeConfig?.id && dbs.includes(activeDatabase)) {
      chosen = activeDatabase;
    } else if (dbs.length > 0) {
      chosen = dbs[0];
    }
    setSourceDb(chosen);
  };

  // Manual target connection change handler
  const handleTargetConnChange = async (newConnId: string) => {
    setTargetConnId(newConnId);
    setTargetDb('');
    setDiffResult(null);
    setGeneratedScript('');
    setComparisonError(null);
    setIsLoadingTargetDbs(true);

    const dbs = await fetchDatabasesForConn(newConnId);
    setTargetDatabases(dbs);
    setIsLoadingTargetDbs(false);

    let chosen = '';
    if (newConnId === sourceConnId && dbs.length > 1) {
      const diffDb = dbs.find(d => d !== sourceDb);
      chosen = diffDb || dbs[0] || '';
    } else if (dbs.length > 0) {
      chosen = dbs[0];
    }
    setTargetDb(chosen);
  };

  // Manual database change handlers
  const handleSourceDbChange = (newDb: string) => {
    setSourceDb(newDb);
    setDiffResult(null);
    setGeneratedScript('');
    setComparisonError(null);
  };

  const handleTargetDbChange = (newDb: string) => {
    setTargetDb(newDb);
    setDiffResult(null);
    setGeneratedScript('');
    setComparisonError(null);
  };

  // Swap source and target
  const handleSwap = () => {
    const prevSrcConn = sourceConnId;
    const prevSrcDb = sourceDb;
    const prevSrcDbs = sourceDatabases;

    setSourceConnId(targetConnId);
    setSourceDb(targetDb);
    setSourceDatabases(targetDatabases);

    setTargetConnId(prevSrcConn);
    setTargetDb(prevSrcDb);
    setTargetDatabases(prevSrcDbs);

    setDiffResult(null);
    setGeneratedScript('');
    setComparisonError(null);
  };

  // Run metadata comparison
  const handleRunComparison = async () => {
    if (!sourceConnId || !sourceDb) {
      setComparisonError('Selecciona la conexión y base de datos de origen.');
      return;
    }
    if (!targetConnId || !targetDb) {
      setComparisonError('Selecciona la conexión y base de datos de destino.');
      return;
    }
    if (sourceConnId === targetConnId && sourceDb === targetDb) {
      setComparisonError(t('schemaDiff.sameDbWarning'));
      return;
    }

    const sConn = connectionList.find(c => c.id === sourceConnId);
    const tConn = connectionList.find(c => c.id === targetConnId);

    if (!sConn || !tConn) {
      setComparisonError('Configuración de conexión no encontrada.');
      return;
    }

    setIsComparing(true);
    setCompareProgress({
      stage: 'connect_source',
      percentage: 10,
      message: `Iniciando análisis entre ${sourceDb} y ${targetDb}...`
    });
    setComparisonError(null);
    setExecutionResult(null);

    try {
      const res = await window.electronAPI.compareSchemas({
        sourceConfig: sConn,
        sourceDatabase: sourceDb,
        targetConfig: tConn,
        targetDatabase: targetDb,
        options: {
          ignoreComments: false,
          ignoreCollation: false
        }
      });

      if (res.success && res.data) {
        setDiffResult(res.data);

        // Select all items that have differences by default
        const initialSelections: Record<string, boolean> = {};
        for (const tbl of res.data.tables) {
          if (tbl.status !== 'identical') {
            initialSelections[`table:${tbl.name}`] = true;
          }
        }
        for (const v of res.data.views) {
          if (v.status !== 'identical') initialSelections[`view:${v.name}`] = true;
        }
        for (const p of res.data.procedures) {
          if (p.status !== 'identical') initialSelections[`procedure:${p.name}`] = true;
        }
        for (const f of res.data.functions) {
          if (f.status !== 'identical') initialSelections[`function:${f.name}`] = true;
        }
        for (const tr of res.data.triggers) {
          if (tr.status !== 'identical') initialSelections[`trigger:${tr.name}`] = true;
        }
        for (const ev of res.data.events) {
          if (ev.status !== 'identical') initialSelections[`event:${ev.name}`] = true;
        }
        setSelectedItems(initialSelections);

        // Select first different item for inspector
        const firstDiffTable = res.data.tables.find(t => t.status !== 'identical');
        if (firstDiffTable) {
          setSelectedObjectKey(`table:${firstDiffTable.name}`);
        } else if (res.data.tables.length > 0) {
          setSelectedObjectKey(`table:${res.data.tables[0].name}`);
        }

        // Generate script
        generateScript(res.data, initialSelections, options);
      } else {
        setComparisonError(res.error || 'Error desconocido al comparar metadatos.');
      }
    } catch (err: any) {
      setComparisonError(err.message || 'Error inesperado al comparar metadatos.');
    } finally {
      setIsComparing(false);
      setCompareProgress(null);
    }
  };

  // Generate migration SQL from diff and current selections
  const generateScript = useCallback(async (
    diff: SchemaDiffResult,
    selections: Record<string, boolean>,
    scriptOpts: MigrationScriptOptions
  ) => {
    setIsGeneratingScript(true);
    try {
      const selectedTables: Record<string, boolean> = {};
      const selectedViews: Record<string, boolean> = {};
      const selectedProcedures: Record<string, boolean> = {};
      const selectedFunctions: Record<string, boolean> = {};
      const selectedTriggers: Record<string, boolean> = {};
      const selectedEvents: Record<string, boolean> = {};

      for (const [key, selected] of Object.entries(selections)) {
        const [type, name] = key.split(':');
        if (type === 'table') selectedTables[name] = selected;
        if (type === 'view') selectedViews[name] = selected;
        if (type === 'procedure') selectedProcedures[name] = selected;
        if (type === 'function') selectedFunctions[name] = selected;
        if (type === 'trigger') selectedTriggers[name] = selected;
        if (type === 'event') selectedEvents[name] = selected;
      }

      const res = await window.electronAPI.generateMigrationScript(diff, {
        ...scriptOpts,
        selectedTables,
        selectedViews,
        selectedProcedures,
        selectedFunctions,
        selectedTriggers,
        selectedEvents,
        targetDatabaseOverride: diff.targetDb
      });

      if (res.success && res.data) {
        setGeneratedScript(res.data);
      }
    } catch (err) {
      console.error('Error generating migration script:', err);
    } finally {
      setIsGeneratingScript(false);
    }
  }, []);

  // Update script whenever selections or options change
  const handleToggleItem = (key: string) => {
    const updated = { ...selectedItems, [key]: !selectedItems[key] };
    setSelectedItems(updated);
    if (diffResult) {
      generateScript(diffResult, updated, options);
    }
  };

  const handleSelectAll = (select: boolean) => {
    if (!diffResult) return;
    const updated: Record<string, boolean> = {};
    for (const t of diffResult.tables) {
      if (!hideIdentical || t.status !== 'identical') {
        updated[`table:${t.name}`] = select;
      }
    }
    for (const v of diffResult.views) {
      if (!hideIdentical || v.status !== 'identical') updated[`view:${v.name}`] = select;
    }
    for (const p of diffResult.procedures) {
      if (!hideIdentical || p.status !== 'identical') updated[`procedure:${p.name}`] = select;
    }
    for (const f of diffResult.functions) {
      if (!hideIdentical || f.status !== 'identical') updated[`function:${f.name}`] = select;
    }
    for (const tr of diffResult.triggers) {
      if (!hideIdentical || tr.status !== 'identical') updated[`trigger:${tr.name}`] = select;
    }
    for (const ev of diffResult.events) {
      if (!hideIdentical || ev.status !== 'identical') updated[`event:${ev.name}`] = select;
    }
    setSelectedItems(updated);
    generateScript(diffResult, updated, options);
  };

  const handleOptionChange = (key: keyof MigrationScriptOptions, value: boolean) => {
    const updated = { ...options, [key]: value };
    setOptions(updated);
    if (diffResult) {
      generateScript(diffResult, selectedItems, updated);
    }
  };

  // Copy SQL script to clipboard
  const handleCopyScript = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Save SQL script to file
  const handleSaveSqlFile = async () => {
    if (!generatedScript) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `sync_${sourceDb}_to_${targetDb}_${dateStr}.sql`;
    await window.electronAPI.saveSqlFile(generatedScript, filename);
  };

  // Open SQL script in Editor Tab
  const handleOpenInEditor = () => {
    if (!generatedScript) return;
    onOpenInSqlEditor(generatedScript, `Sync: ${sourceDb} → ${targetDb}`);
    onClose();
  };

  // Execute migration directly against target
  const handleApplyToTarget = async () => {
    setIsConfirmApplyOpen(false);
    if (!generatedScript || !targetConnId || !targetDb) return;

    const tConn = connectionList.find(c => c.id === targetConnId);
    if (!tConn) return;

    setIsExecutingTarget(true);
    setMigrationProgress({
      totalStatements: 0,
      executedStatements: 0,
      percentage: 0,
      currentStatementSnippet: '',
      errorsCount: 0,
      message: `Iniciando ejecución sobre ${targetDb}...`
    });
    setExecutionError(null);
    setExecutionResult(null);

    try {
      const res = await window.electronAPI.applyMigrationScript({
        targetConfig: tConn,
        targetDatabase: targetDb,
        script: generatedScript
      });

      if (res.data) {
        setExecutionResult(res.data);
      }
      if (!res.success) {
        setExecutionError(res.error || 'Errores durante la ejecución de las sentencias DDL.');
      } else {
        if (onRefreshActiveSchema) {
          onRefreshActiveSchema();
        }
      }
    } catch (err: any) {
      setExecutionError(err.message || 'Error inesperado al aplicar la migración en destino.');
    } finally {
      setIsExecutingTarget(false);
    }
  };

  // Filtered objects for display in Diff Explorer
  const filteredObjects = useMemo(() => {
    if (!diffResult) return { tables: [], views: [], procedures: [], functions: [], triggers: [], events: [] };
    const q = searchQuery.toLowerCase().trim();

    const match = (name: string, status: string) => {
      if (hideIdentical && status === 'identical') return false;
      if (!q) return true;
      return name.toLowerCase().includes(q);
    };

    return {
      tables: diffResult.tables.filter(t => match(t.name, t.status)),
      views: diffResult.views.filter(v => match(v.name, v.status)),
      procedures: diffResult.procedures.filter(p => match(p.name, p.status)),
      functions: diffResult.functions.filter(f => match(f.name, f.status)),
      triggers: diffResult.triggers.filter(t => match(t.name, t.status)),
      events: diffResult.events.filter(e => match(e.name, e.status))
    };
  }, [diffResult, searchQuery, hideIdentical]);

  // Currently inspected object
  const currentInspectedObject = useMemo(() => {
    if (!diffResult || !selectedObjectKey) return null;
    const [type, name] = selectedObjectKey.split(':');
    if (type === 'table') {
      return { type: 'TABLE', data: diffResult.tables.find(t => t.name === name) };
    }
    if (type === 'view') {
      return { type: 'VIEW', data: diffResult.views.find(v => v.name === name) };
    }
    if (type === 'procedure') {
      return { type: 'PROCEDURE', data: diffResult.procedures.find(p => p.name === name) };
    }
    if (type === 'function') {
      return { type: 'FUNCTION', data: diffResult.functions.find(f => f.name === name) };
    }
    if (type === 'trigger') {
      return { type: 'TRIGGER', data: diffResult.triggers.find(tr => tr.name === name) };
    }
    if (type === 'event') {
      return { type: 'EVENT', data: diffResult.events.find(ev => ev.name === name) };
    }
    return null;
  }, [diffResult, selectedObjectKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  {t('schemaDiff.title')}
                </h2>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-mono font-semibold">
                  Metadata Diff & Sync
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {t('schemaDiff.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOptionsDrawer(!showOptionsDrawer)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showOptionsDrawer 
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('schemaDiff.optionsTitle')}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Picker Bar (Source & Target) */}
        <div className="px-6 py-3 bg-zinc-950/70 border-b border-zinc-800 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center">
            
            {/* Source Database Selector */}
            <div className="p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                    {t('schemaDiff.sourceSection')} - {t('schemaDiff.connection')}
                  </label>
                  <select
                    value={sourceConnId}
                    onChange={(e) => handleSourceConnChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-emerald-500 text-xs font-medium truncate"
                  >
                    {connectionList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || `${c.host}:${c.port}`} {c.id === activeConfig?.id ? '(Activa)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                    {t('schemaDiff.database')}
                  </label>
                  <select
                    value={sourceDb}
                    disabled={isLoadingSourceDbs || sourceDatabases.length === 0}
                    onChange={(e) => handleSourceDbChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-emerald-300 font-mono font-semibold focus:outline-none focus:border-emerald-500 text-xs truncate disabled:opacity-50"
                  >
                    {isLoadingSourceDbs ? (
                      <option value="">Cargando bases...</option>
                    ) : sourceDatabases.length === 0 ? (
                      <option value="">(Sin bases disponibles)</option>
                    ) : (
                      sourceDatabases.map((db) => (
                        <option key={db} value={db}>{db}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-lg border border-zinc-700 transition-colors"
                title={t('schemaDiff.swapConnections')}
              >
                <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
              </button>
            </div>

            {/* Target Database Selector */}
            <div className="p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                    {t('schemaDiff.targetSection')} - {t('schemaDiff.connection')}
                  </label>
                  <select
                    value={targetConnId}
                    onChange={(e) => handleTargetConnChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-amber-500 text-xs font-medium truncate"
                  >
                    {connectionList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || `${c.host}:${c.port}`} {c.id === activeConfig?.id ? '(Activa)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                    {t('schemaDiff.database')}
                  </label>
                  <select
                    value={targetDb}
                    disabled={isLoadingTargetDbs || targetDatabases.length === 0}
                    onChange={(e) => handleTargetDbChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-amber-300 font-mono font-semibold focus:outline-none focus:border-amber-500 text-xs truncate disabled:opacity-50"
                  >
                    {isLoadingTargetDbs ? (
                      <option value="">Cargando bases...</option>
                    ) : targetDatabases.length === 0 ? (
                      <option value="">(Sin bases disponibles)</option>
                    ) : (
                      targetDatabases.map((db) => (
                        <option key={db} value={db}>{db}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Action Compare Button */}
            <div>
              <button
                type="button"
                onClick={handleRunComparison}
                disabled={isComparing || !sourceDb || !targetDb}
                className="w-full h-11 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
              >
                {isComparing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('schemaDiff.comparing')}</span>
                  </>
                ) : (
                  <>
                    <GitCompare className="w-4 h-4" />
                    <span>{t('schemaDiff.compareBtn')}</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Optional Options Drawer */}
          {showOptionsDrawer && (
            <div className="mt-3 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in zoom-in-95 duration-100">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={options.includeDropTables}
                  onChange={(e) => handleOptionChange('includeDropTables', e.target.checked)}
                  className="rounded border-zinc-700 text-indigo-500 focus:ring-0"
                />
                <span>{t('schemaDiff.optDropTables')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={options.includeDropColumns}
                  onChange={(e) => handleOptionChange('includeDropColumns', e.target.checked)}
                  className="rounded border-zinc-700 text-indigo-500 focus:ring-0"
                />
                <span>{t('schemaDiff.optDropColumns')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={options.includeDropIndexes}
                  onChange={(e) => handleOptionChange('includeDropIndexes', e.target.checked)}
                  className="rounded border-zinc-700 text-indigo-500 focus:ring-0"
                />
                <span>{t('schemaDiff.optDropIndexes')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={options.includeDropRoutines}
                  onChange={(e) => handleOptionChange('includeDropRoutines', e.target.checked)}
                  className="rounded border-zinc-700 text-indigo-500 focus:ring-0"
                />
                <span>{t('schemaDiff.optDropRoutines')}</span>
              </label>
            </div>
          )}

          {/* Comparison Error */}
          {comparisonError && (
            <div className="mt-2.5 p-2.5 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{comparisonError}</span>
            </div>
          )}

          {/* Real-time Comparison Progress Bar */}
          {isComparing && (
            <div className="mt-2.5 p-3 bg-zinc-900 border border-indigo-500/30 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>{compareProgress?.message || t('schemaDiff.comparing')}</span>
                </div>
                <span className="font-mono text-indigo-300 font-bold">
                  {compareProgress?.percentage ?? 15}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-teal-400 transition-all duration-300 ease-out"
                  style={{ width: `${compareProgress?.percentage ?? 15}%` }}
                />
              </div>
            </div>
          )}

          {/* Real-time Migration Progress Bar during execution */}
          {isExecutingTarget && (
            <div className="mt-2.5 p-3 bg-zinc-900 border border-amber-500/40 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>{migrationProgress?.message || t('schemaDiff.applying')}</span>
                </div>
                <span className="font-mono text-amber-300 font-bold">
                  {migrationProgress?.percentage ?? 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-150 ease-out"
                  style={{ width: `${migrationProgress?.percentage ?? 0}%` }}
                />
              </div>
              {migrationProgress && migrationProgress.currentStatementSnippet && (
                <div className="text-[11px] font-mono text-zinc-400 truncate pt-0.5">
                  {migrationProgress.currentStatementSnippet}
                </div>
              )}
            </div>
          )}

          {/* Execution Result Banner */}
          {executionResult && !isExecutingTarget && (
            <div className="mt-2.5 p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {t('schemaDiff.applySuccess', {
                    count: executionResult.statementsExecuted,
                    ms: executionResult.durationMs
                  })}
                </span>
              </div>
            </div>
          )}

          {executionError && !isExecutingTarget && (
            <div className="mt-2.5 p-2.5 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{executionError}</span>
            </div>
          )}
        </div>

        {/* Tab Selector & Stats Header */}
        <div className="px-6 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setActiveModalTab('diff')}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium transition-colors ${
                activeModalTab === 'diff'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <GitCompare className="w-4 h-4" />
              <span>{t('schemaDiff.tabDiff')}</span>
              {diffResult && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                  {diffResult.summary.totalDifferences}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveModalTab('script')}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium transition-colors ${
                activeModalTab === 'script'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>{t('schemaDiff.tabScript')}</span>
              {generatedScript && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                  SQL
                </span>
              )}
            </button>
          </div>

          {/* Quick Summary Badges if diffResult is loaded */}
          {diffResult && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                +{diffResult.summary.missingInTarget} {t('schemaDiff.missingInTarget')}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300">
                ~{diffResult.summary.modified} {t('schemaDiff.modified')}
              </span>
              {diffResult.summary.extraInTarget > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-500/30 text-red-300">
                  -{diffResult.summary.extraInTarget} {t('schemaDiff.extraInTarget')}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                ={diffResult.summary.identical} {t('schemaDiff.identical')}
              </span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden">
          {activeModalTab === 'diff' ? (
            /* TAB 1: Diff Explorer & Object Inspector */
            diffResult ? (
              diffResult.summary.totalDifferences === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-100 mb-1">
                    {t('schemaDiff.identicalNotice')}
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md">
                    Todas las tablas, columnas, índices, vistas y rutinas coinciden exactamente entre ambas bases de datos.
                  </p>
                </div>
              ) : (
                <div className="h-full flex flex-col md:flex-row overflow-hidden">
                  
                  {/* Left Column: Objects list */}
                  <div className="w-full md:w-80 border-r border-zinc-800 bg-zinc-950/40 flex flex-col shrink-0 overflow-hidden">
                    
                    {/* List Toolbar (Search, filter, select all) */}
                    <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t('schemaDiff.searchPlaceholder')}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg pl-8 pr-2 py-1.5 text-xs text-zinc-200 focus:outline-none placeholder-zinc-500"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200 select-none">
                          <input
                            type="checkbox"
                            checked={hideIdentical}
                            onChange={(e) => setHideIdentical(e.target.checked)}
                            className="rounded border-zinc-700 text-indigo-500 focus:ring-0"
                          />
                          <span>{t('schemaDiff.hideIdentical')}</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAll(true)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            {t('schemaDiff.selectAll')}
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAll(false)}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            {t('schemaDiff.deselectAll')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable list of objects */}
                    <div className="flex-1 overflow-y-auto p-2 divide-y divide-zinc-800/40">
                      
                      {/* Tables */}
                      {filteredObjects.tables.length > 0 && (
                        <div className="py-2">
                          <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                            <span className="flex items-center gap-1.5">
                              <Table className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Tablas ({filteredObjects.tables.length})</span>
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {filteredObjects.tables.map((tbl) => {
                              const key = `table:${tbl.name}`;
                              const isSelected = selectedItems[key] !== false;
                              const isInspected = selectedObjectKey === key;
                              return (
                                <div
                                  key={tbl.name}
                                  onClick={() => setSelectedObjectKey(key)}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    isInspected 
                                      ? 'bg-indigo-500/20 text-indigo-200 font-semibold border border-indigo-500/30' 
                                      : 'hover:bg-zinc-800/70 text-zinc-300'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleItem(key);
                                    }}
                                    className="text-zinc-400 hover:text-indigo-400 shrink-0"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                                    ) : (
                                      <Square className="w-4 h-4 text-zinc-600" />
                                    )}
                                  </button>

                                  <span className="flex-1 font-mono truncate">{tbl.name}</span>

                                  {/* Status badge */}
                                  <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded shrink-0 ${
                                    tbl.status === 'missing_in_target'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : tbl.status === 'different'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : tbl.status === 'extra_in_target'
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                      : 'bg-zinc-800 text-zinc-500'
                                  }`}>
                                    {tbl.status === 'missing_in_target' && '+ Faltante'}
                                    {tbl.status === 'different' && '~ Modif.'}
                                    {tbl.status === 'extra_in_target' && '- Sobrante'}
                                    {tbl.status === 'identical' && '✓'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Views */}
                      {filteredObjects.views.length > 0 && (
                        <div className="py-2">
                          <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                            <span className="flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5 text-teal-400" />
                              <span>Vistas ({filteredObjects.views.length})</span>
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {filteredObjects.views.map((v) => {
                              const key = `view:${v.name}`;
                              const isSelected = selectedItems[key] !== false;
                              const isInspected = selectedObjectKey === key;
                              return (
                                <div
                                  key={v.name}
                                  onClick={() => setSelectedObjectKey(key)}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    isInspected 
                                      ? 'bg-indigo-500/20 text-indigo-200 font-semibold border border-indigo-500/30' 
                                      : 'hover:bg-zinc-800/70 text-zinc-300'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleItem(key);
                                    }}
                                    className="text-zinc-400 hover:text-indigo-400 shrink-0"
                                  >
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-zinc-600" />}
                                  </button>
                                  <span className="flex-1 font-mono truncate">{v.name}</span>
                                  <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-zinc-800 text-zinc-400">
                                    {v.status === 'missing_in_target' ? '+ Nueva' : v.status === 'different' ? '~ Modif.' : '- Sobrante'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Procedures */}
                      {filteredObjects.procedures.length > 0 && (
                        <div className="py-2">
                          <div className="px-2 mb-1.5 text-[11px] font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Procedimientos ({filteredObjects.procedures.length})</span>
                          </div>
                          <div className="space-y-0.5">
                            {filteredObjects.procedures.map((p) => {
                              const key = `procedure:${p.name}`;
                              const isSelected = selectedItems[key] !== false;
                              const isInspected = selectedObjectKey === key;
                              return (
                                <div
                                  key={p.name}
                                  onClick={() => setSelectedObjectKey(key)}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    isInspected ? 'bg-indigo-500/20 text-indigo-200 font-semibold border border-indigo-500/30' : 'hover:bg-zinc-800/70 text-zinc-300'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleToggleItem(key); }}
                                    className="text-zinc-400 hover:text-indigo-400 shrink-0"
                                  >
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-zinc-600" />}
                                  </button>
                                  <span className="flex-1 font-mono truncate">{p.name}</span>
                                  <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400">{p.status}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Functions */}
                      {filteredObjects.functions.length > 0 && (
                        <div className="py-2">
                          <div className="px-2 mb-1.5 text-[11px] font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Funciones ({filteredObjects.functions.length})</span>
                          </div>
                          <div className="space-y-0.5">
                            {filteredObjects.functions.map((f) => {
                              const key = `function:${f.name}`;
                              const isSelected = selectedItems[key] !== false;
                              const isInspected = selectedObjectKey === key;
                              return (
                                <div
                                  key={f.name}
                                  onClick={() => setSelectedObjectKey(key)}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    isInspected ? 'bg-indigo-500/20 text-indigo-200 font-semibold border border-indigo-500/30' : 'hover:bg-zinc-800/70 text-zinc-300'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleToggleItem(key); }}
                                    className="text-zinc-400 hover:text-indigo-400 shrink-0"
                                  >
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-zinc-600" />}
                                  </button>
                                  <span className="flex-1 font-mono truncate">{f.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* Right Column: Detailed Inspector */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900/60">
                    {currentInspectedObject ? (
                      <div className="h-full flex flex-col overflow-hidden">
                        
                        {/* Inspector Header */}
                        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-800 text-zinc-200 rounded-lg">
                              {currentInspectedObject.type === 'TABLE' && <Table className="w-5 h-5 text-indigo-400" />}
                              {currentInspectedObject.type === 'VIEW' && <Eye className="w-5 h-5 text-teal-400" />}
                              {currentInspectedObject.type === 'PROCEDURE' && <Zap className="w-5 h-5 text-amber-400" />}
                              {currentInspectedObject.type === 'FUNCTION' && <Code2 className="w-5 h-5 text-blue-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400 uppercase font-semibold">
                                  {currentInspectedObject.type}:
                                </span>
                                <span className="text-sm font-bold font-mono text-zinc-100">
                                  {currentInspectedObject.data?.name}
                                </span>
                                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                                  currentInspectedObject.data?.status === 'missing_in_target'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : currentInspectedObject.data?.status === 'different'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : currentInspectedObject.data?.status === 'extra_in_target'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {currentInspectedObject.data?.status.replace(/_/g, ' ').toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Sub-tabs if table */}
                          {currentInspectedObject.type === 'TABLE' && (
                            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
                              <button
                                onClick={() => setTableInspectorTab('columns')}
                                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                                  tableInspectorTab === 'columns'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {t('schemaDiff.columnsTab')} ({(currentInspectedObject.data as TableDiffItem)?.columnDiffs?.length || 0})
                              </button>
                              <button
                                onClick={() => setTableInspectorTab('indexes')}
                                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                                  tableInspectorTab === 'indexes'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {t('schemaDiff.indexesTab')} ({(currentInspectedObject.data as TableDiffItem)?.indexDiffs?.length || 0})
                              </button>
                              <button
                                onClick={() => setTableInspectorTab('fks')}
                                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                                  tableInspectorTab === 'fks'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {t('schemaDiff.fksTab')} ({(currentInspectedObject.data as TableDiffItem)?.fkDiffs?.length || 0})
                              </button>
                              <button
                                onClick={() => setTableInspectorTab('ddl')}
                                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                                  tableInspectorTab === 'ddl'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {t('schemaDiff.ddlTab')}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inspector Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                          {currentInspectedObject.type === 'TABLE' ? (
                            (() => {
                              const tbl = currentInspectedObject.data as TableDiffItem;
                              if (tbl.status === 'missing_in_target') {
                                return (
                                  <div className="space-y-4">
                                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-semibold">Esta tabla existe en Origen pero no en Destino.</p>
                                        <p className="text-zinc-400 mt-0.5">Se creará la tabla completa en la base destino con el siguiente DDL nativo:</p>
                                      </div>
                                    </div>
                                    <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-emerald-300 overflow-auto whitespace-pre-wrap select-text leading-relaxed">
                                      {tbl.createSql}
                                    </pre>
                                  </div>
                                );
                              }

                              if (tbl.status === 'extra_in_target') {
                                return (
                                  <div className="space-y-4">
                                    <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-200 flex items-start gap-2">
                                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-semibold">Esta tabla existe en Destino pero NO en Origen (Sobrante).</p>
                                        <p className="text-zinc-400 mt-0.5">Solo se eliminará si activas la opción "Eliminar tablas sobrantes en destino".</p>
                                      </div>
                                    </div>
                                    <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-red-300 overflow-auto whitespace-pre-wrap select-text">
                                      {tbl.dropSql}
                                    </pre>
                                  </div>
                                );
                              }

                              // Status === 'different' or 'identical'
                              if (tableInspectorTab === 'columns') {
                                return (
                                  <div className="space-y-3">
                                    <div className="text-xs text-zinc-400 flex items-center justify-between">
                                      <span>Diferencias en columnas detectadas:</span>
                                      <span className="font-mono text-zinc-500">{tbl.columnDiffs.length} cambios</span>
                                    </div>
                                    {tbl.columnDiffs.length === 0 ? (
                                      <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-950/50 rounded-xl border border-zinc-800/80">
                                        Las columnas son idénticas en ambas bases de datos.
                                      </p>
                                    ) : (
                                      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/80">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                                              <th className="p-2.5 font-medium">Columna</th>
                                              <th className="p-2.5 font-medium">Estado</th>
                                              <th className="p-2.5 font-medium">Detalles</th>
                                              <th className="p-2.5 font-medium">Sentencia ALTER</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-800/60 font-mono">
                                            {tbl.columnDiffs.map((col) => (
                                              <tr key={col.name} className="hover:bg-zinc-900/50">
                                                <td className="p-2.5 font-bold text-zinc-200">{col.name}</td>
                                                <td className="p-2.5">
                                                  <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                                                    col.status === 'added' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    col.status === 'modified' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-red-500/20 text-red-400'
                                                  }`}>
                                                    {col.status.toUpperCase()}
                                                  </span>
                                                </td>
                                                <td className="p-2.5 text-zinc-300">
                                                  {col.details.join(' • ')}
                                                </td>
                                                <td className="p-2.5 text-indigo-300 text-[11px] truncate max-w-xs" title={col.alterClause}>
                                                  {col.alterClause}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (tableInspectorTab === 'indexes') {
                                return (
                                  <div className="space-y-3">
                                    <div className="text-xs text-zinc-400">Diferencias en índices y claves:</div>
                                    {tbl.indexDiffs.length === 0 ? (
                                      <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-950/50 rounded-xl border border-zinc-800/80">
                                        Los índices son idénticos.
                                      </p>
                                    ) : (
                                      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/80">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                                              <th className="p-2.5 font-medium">Índice</th>
                                              <th className="p-2.5 font-medium">Estado</th>
                                              <th className="p-2.5 font-medium">Sentencia ALTER</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
                                            {tbl.indexDiffs.map((idx) => (
                                              <tr key={idx.name}>
                                                <td className="p-2.5 font-bold text-zinc-200">{idx.name}</td>
                                                <td className="p-2.5">
                                                  <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                                                    idx.status === 'added' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    idx.status === 'modified' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-red-500/20 text-red-400'
                                                  }`}>
                                                    {idx.status.toUpperCase()}
                                                  </span>
                                                </td>
                                                <td className="p-2.5 text-indigo-300 text-[11px]">{idx.alterClause}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (tableInspectorTab === 'fks') {
                                return (
                                  <div className="space-y-3">
                                    <div className="text-xs text-zinc-400">Diferencias en claves foráneas (Foreign Keys):</div>
                                    {tbl.fkDiffs.length === 0 ? (
                                      <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-950/50 rounded-xl border border-zinc-800/80">
                                        Las claves foráneas son idénticas.
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {tbl.fkDiffs.map((fk) => (
                                          <div key={fk.name} className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs space-y-1">
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-zinc-200">{fk.name}</span>
                                              <span className="px-2 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 rounded font-bold">
                                                {fk.status.toUpperCase()}
                                              </span>
                                            </div>
                                            {fk.dropSql && <div className="text-red-400 text-[11px]">{fk.dropSql}</div>}
                                            {fk.addSql && <div className="text-emerald-400 text-[11px]">{fk.addSql}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (tableInspectorTab === 'ddl') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                                    <div className="flex flex-col space-y-2">
                                      <span className="text-xs font-semibold text-emerald-400">DDL en Origen ({diffResult.sourceDb}):</span>
                                      <pre className="flex-1 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-emerald-300 overflow-auto whitespace-pre-wrap select-text">
                                        {tbl.sourceTable?.rawDdl || '-- No disponible'}
                                      </pre>
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                      <span className="text-xs font-semibold text-amber-400">DDL en Destino ({diffResult.targetDb}):</span>
                                      <pre className="flex-1 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-amber-300 overflow-auto whitespace-pre-wrap select-text">
                                        {tbl.targetTable?.rawDdl || '-- No existe en destino'}
                                      </pre>
                                    </div>
                                  </div>
                                );
                              }

                              return null;
                            })()
                          ) : (
                            /* Generic Object (View, Proc, Function, Trigger) */
                            (() => {
                              const obj = currentInspectedObject.data as GenericObjectDiffItem;
                              return (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <span className="text-xs font-semibold text-emerald-400">Código en Origen:</span>
                                      <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-emerald-300 overflow-auto whitespace-pre-wrap select-text max-h-96">
                                        {obj.sourceDdl || '-- No existe en origen'}
                                      </pre>
                                    </div>
                                    <div className="space-y-2">
                                      <span className="text-xs font-semibold text-amber-400">Código en Destino:</span>
                                      <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-amber-300 overflow-auto whitespace-pre-wrap select-text max-h-96">
                                        {obj.targetDdl || '-- No existe en destino'}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>

                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                        Selecciona un objeto de la lista para inspeccionar sus diferencias.
                      </div>
                    )}
                  </div>

                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-500 mb-4">
                  <GitCompare className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                  Listo para comparar metadatos
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Selecciona la base de datos de origen y la de destino, y pulsa "Comparar Metadatos" para analizar las diferencias.
                </p>
              </div>
            )
          ) : (
            /* TAB 2: Generated SQL Script Review & Edit */
            <div className="h-full flex flex-col overflow-hidden bg-zinc-950">
              
              {/* Script Bar */}
              <div className="px-6 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-zinc-300">
                    Script de sincronización para llevar <span className="text-amber-300 font-mono font-bold">{targetDb}</span> a <span className="text-emerald-300 font-mono font-bold">{sourceDb}</span>
                  </span>
                  {isGeneratingScript && (
                    <span className="flex items-center gap-1 text-indigo-400 text-xs animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Actualizando script...</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => diffResult && generateScript(diffResult, selectedItems, options)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 transition-colors"
                    title="Regenerar SQL a partir de la selección actual"
                  >
                    <RefreshCw className="w-3 h-3 text-indigo-400" />
                    <span>Regenerar</span>
                  </button>
                </div>
              </div>

              {/* Monaco SQL Editor for full review and manual tweaking */}
              <div className="flex-1 overflow-hidden">
                <Editor
                  value={generatedScript}
                  onChange={(val) => setGeneratedScript(val || '')}
                  language="sql"
                  theme={theme === 'light' ? 'vs' : 'vs-dark'}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    renderWhitespace: 'selection'
                  }}
                />
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyScript}
              disabled={!generatedScript}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{isCopied ? t('common.copied') : t('schemaDiff.copySql')}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSqlFile}
              disabled={!generatedScript}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t('schemaDiff.saveSql')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInEditor}
              disabled={!generatedScript}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
              title="Abrir sentencia en una pestaña SQL nueva de Maria Toma Mate"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('schemaDiff.openInEditor')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              {t('common.close')}
            </button>

            <button
              type="button"
              onClick={() => setIsConfirmApplyOpen(true)}
              disabled={!generatedScript || isExecutingTarget}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-lg text-xs shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
            >
              {isExecutingTarget ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('schemaDiff.applying')}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t('schemaDiff.applyToTarget')}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation Dialog before applying to target */}
      {isConfirmApplyOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  {t('schemaDiff.applyConfirmTitle')}
                </h3>
                <p className="text-xs text-zinc-400">
                  {targetDb}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {t('schemaDiff.applyConfirmMsg', { db: targetDb })}
            </p>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-1 font-mono text-zinc-400">
              <div>• Base destino: <span className="text-amber-300 font-bold">{targetDb}</span></div>
              <div>• Servidor: {connectionList.find(c => c.id === targetConnId)?.host}:{connectionList.find(c => c.id === targetConnId)?.port}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmApplyOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleApplyToTarget}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs shadow-lg shadow-indigo-600/30"
              >
                Sí, aplicar cambios
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
