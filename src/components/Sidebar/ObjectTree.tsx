import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { SchemaObjects, SchemaColumnDetail } from '../../types';
import { 
  Table as TableIcon, 
  Eye, 
  Cog, 
  Zap, 
  Hash, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  RefreshCw, 
  Database,
  Code,
  Info,
  Play,
  Plus,
  Sliders,
  Copy,
  Trash2,
  FileText,
  Layers,
  Check,
  FolderPlus,
  GitCompare,
  Users,
  Activity,
  Key,
  Columns
} from 'lucide-react';

interface ObjectTreeProps {
  objects: SchemaObjects | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectDatabase: (dbName: string) => void;
  onSelectObjectSql: (sql: string, executeImmediately?: boolean) => void;
  onShowTableDetails: (tableName: string) => void;
  onEditObject: (type: 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT', name: string) => void;
  onCreateTable?: () => void;
  onDesignTable?: (tableName: string) => void;
  onCreateProcedure?: () => void;
  onCreateFunction?: () => void;
  onCreateView?: () => void;
  onCreateTrigger?: () => void;
  onCreateDatabase?: () => void;
  onDropDatabase?: (dbName: string) => void;
  onOpenSchemaDiff?: () => void;
  onOpenUserManager?: () => void;
  onOpenProcessViewer?: () => void;
  onOpenServerVariables?: () => void;
}

type ContextMenuItemType = 
  | 'TABLE' 
  | 'TABLE_SECTION' 
  | 'VIEW' 
  | 'VIEW_SECTION' 
  | 'COLUMN'
  | 'PROCEDURE' 
  | 'PROCEDURE_SECTION' 
  | 'FUNCTION'
  | 'FUNCTION_SECTION'
  | 'TRIGGER' 
  | 'TRIGGER_SECTION' 
  | 'EVENT' 
  | 'EVENT_SECTION'
  | 'DATABASE';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  itemType: ContextMenuItemType;
  name: string;
  meta?: any;
}

export const ObjectTree: React.FC<ObjectTreeProps> = ({
  objects,
  isLoading,
  onRefresh,
  onSelectDatabase,
  onSelectObjectSql,
  onShowTableDetails,
  onEditObject,
  onCreateTable,
  onDesignTable,
  onCreateProcedure,
  onCreateFunction,
  onCreateView,
  onCreateTrigger,
  onCreateDatabase,
  onDropDatabase,
  onOpenSchemaDiff,
  onOpenUserManager,
  onOpenProcessViewer,
  onOpenServerVariables
}) => {
  const { t } = useTranslation();
  const [searchFilter, setSearchFilter] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    tables: false,
    views: false,
    procedures: true,
    functions: true,
    triggers: true,
    events: true
  });

  // Table and View column expansion states
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [expandedViews, setExpandedViews] = useState<Record<string, boolean>>({});
  const [lazyLoadedColumns, setLazyLoadedColumns] = useState<Record<string, SchemaColumnDetail[]>>({});
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>({});

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    if (contextMenu?.isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openContextMenu = (e: React.MouseEvent, itemType: ContextMenuItemType, name: string, meta?: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 300),
      itemType,
      name,
      meta
    });
  };

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedNotification(name);
    setContextMenu(null);
    setTimeout(() => setCopiedNotification(null), 1500);
  };

  const getColumnsForTable = (tableName: string): SchemaColumnDetail[] => {
    if (objects?.columnsDetailsByTable?.[tableName]) {
      return objects.columnsDetailsByTable[tableName];
    }
    if (lazyLoadedColumns[tableName]) {
      return lazyLoadedColumns[tableName];
    }
    if (objects?.columnsByTable?.[tableName]) {
      return objects.columnsByTable[tableName].map(name => ({
        name,
        type: 'campo',
        dataType: 'campo',
        isPrimary: false,
        isNullable: true,
        isAutoIncrement: false
      }));
    }
    return [];
  };

  const toggleTableExpand = async (tbl: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const willExpand = !expandedTables[tbl];
    setExpandedTables(prev => ({ ...prev, [tbl]: willExpand }));

    if (willExpand && !objects?.columnsDetailsByTable?.[tbl] && !lazyLoadedColumns[tbl]) {
      setLoadingColumns(prev => ({ ...prev, [tbl]: true }));
      try {
        if (window.electronAPI?.getTableDetails) {
          const res = await window.electronAPI.getTableDetails(tbl);
          if (res.success && res.data?.columns) {
            const mapped: SchemaColumnDetail[] = res.data.columns.map(c => ({
              name: c.columnName,
              type: c.fieldType.toLowerCase(),
              dataType: c.fieldType.split('(')[0].toLowerCase(),
              isPrimary: c.isPrimaryKey,
              isNullable: c.isNullable,
              isAutoIncrement: c.isAutoIncrement,
              comment: c.comment
            }));
            setLazyLoadedColumns(prev => ({ ...prev, [tbl]: mapped }));
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoadingColumns(prev => ({ ...prev, [tbl]: false }));
      }
    }
  };

  const toggleViewExpand = async (vw: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const willExpand = !expandedViews[vw];
    setExpandedViews(prev => ({ ...prev, [vw]: willExpand }));

    if (willExpand && !objects?.columnsDetailsByTable?.[vw] && !lazyLoadedColumns[vw]) {
      setLoadingColumns(prev => ({ ...prev, [vw]: true }));
      try {
        if (window.electronAPI?.getTableDetails) {
          const res = await window.electronAPI.getTableDetails(vw);
          if (res.success && res.data?.columns) {
            const mapped: SchemaColumnDetail[] = res.data.columns.map(c => ({
              name: c.columnName,
              type: c.fieldType.toLowerCase(),
              dataType: c.fieldType.split('(')[0].toLowerCase(),
              isPrimary: c.isPrimaryKey,
              isNullable: c.isNullable,
              isAutoIncrement: c.isAutoIncrement,
              comment: c.comment
            }));
            setLazyLoadedColumns(prev => ({ ...prev, [vw]: mapped }));
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoadingColumns(prev => ({ ...prev, [vw]: false }));
      }
    }
  };

  // Filter objects by search text
  const filterText = searchFilter.toLowerCase().trim();

  const isTableExpanded = (tbl: string) => {
    if (expandedTables[tbl]) return true;
    if (filterText) {
      const cols = getColumnsForTable(tbl);
      return cols.some(c => c.name.toLowerCase().includes(filterText) || c.type.toLowerCase().includes(filterText));
    }
    return false;
  };

  const isViewExpanded = (vw: string) => {
    if (expandedViews[vw]) return true;
    if (filterText) {
      const cols = getColumnsForTable(vw);
      return cols.some(c => c.name.toLowerCase().includes(filterText) || c.type.toLowerCase().includes(filterText));
    }
    return false;
  };

  const filteredTables = useMemo(() => {
    if (!objects?.tables) return [];
    if (!filterText) return objects.tables;
    return objects.tables.filter(t => {
      if (t.toLowerCase().includes(filterText)) return true;
      const cols = objects.columnsDetailsByTable?.[t] || lazyLoadedColumns[t] || [];
      if (cols.some(c => c.name.toLowerCase().includes(filterText) || c.type.toLowerCase().includes(filterText))) {
        return true;
      }
      const rawCols = objects.columnsByTable?.[t] || [];
      return rawCols.some(c => c.toLowerCase().includes(filterText));
    });
  }, [objects?.tables, objects?.columnsDetailsByTable, objects?.columnsByTable, lazyLoadedColumns, filterText]);

  const filteredViews = useMemo(() => {
    if (!objects?.views) return [];
    if (!filterText) return objects.views;
    return objects.views.filter(v => {
      if (v.toLowerCase().includes(filterText)) return true;
      const cols = objects.columnsDetailsByTable?.[v] || lazyLoadedColumns[v] || [];
      if (cols.some(c => c.name.toLowerCase().includes(filterText) || c.type.toLowerCase().includes(filterText))) {
        return true;
      }
      const rawCols = objects.columnsByTable?.[v] || [];
      return rawCols.some(c => c.toLowerCase().includes(filterText));
    });
  }, [objects?.views, objects?.columnsDetailsByTable, objects?.columnsByTable, lazyLoadedColumns, filterText]);

  const filteredProcedures = useMemo(() => {
    if (!objects?.procedures) return [];
    if (!filterText) return objects.procedures;
    return objects.procedures.filter(p => p.name.toLowerCase().includes(filterText));
  }, [objects?.procedures, filterText]);

  const filteredFunctions = useMemo(() => {
    if (!objects?.functions) return [];
    if (!filterText) return objects.functions;
    return objects.functions.filter(f => f.name.toLowerCase().includes(filterText));
  }, [objects?.functions, filterText]);

  const filteredTriggers = useMemo(() => {
    if (!objects?.triggers) return [];
    if (!filterText) return objects.triggers;
    return objects.triggers.filter(tr => tr.name.toLowerCase().includes(filterText) || tr.table.toLowerCase().includes(filterText));
  }, [objects?.triggers, filterText]);

  const filteredEvents = useMemo(() => {
    if (!objects?.events) return [];
    if (!filterText) return objects.events;
    return objects.events.filter(e => e.toLowerCase().includes(filterText));
  }, [objects?.events, filterText]);

  const currentDb = objects?.currentDatabase;
  const databases = objects?.databases || [];

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 text-xs select-none">
      
      {/* Database Switcher Header */}
      <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('sidebar.database')}</span>
          </div>
          <div className="flex items-center gap-1">
            {onCreateDatabase && (
              <button
                onClick={onCreateDatabase}
                className="p-1 hover:text-emerald-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                title={t('sidebar.createDatabase')}
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenSchemaDiff && (
              <button
                onClick={onOpenSchemaDiff}
                className="p-1 hover:text-indigo-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                title={t('schemaDiff.title')}
              >
                <GitCompare className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenUserManager && (
              <button
                onClick={onOpenUserManager}
                className="p-1 hover:text-sky-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                title={t('navbar.userManagerTooltip')}
              >
                <Users className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenProcessViewer && (
              <button
                onClick={onOpenProcessViewer}
                className="p-1 hover:text-amber-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                title={t('navbar.processViewerTooltip')}
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenServerVariables && (
              <button
                onClick={onOpenServerVariables}
                className="p-1 hover:text-cyan-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                title={t('navbar.serverVariablesTooltip')}
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 hover:text-emerald-400 text-zinc-400 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
              title={t('common.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Database Selector Dropdown */}
        <select
          value={currentDb || ''}
          onChange={(e) => onSelectDatabase(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-emerald-500 transition-colors"
        >
          {databases.map((db) => (
            <option key={db} value={db}>
              {db} {db === currentDb ? '★' : ''}
            </option>
          ))}
          {databases.length === 0 && (
            <option value="">(Sin base de datos)</option>
          )}
        </select>
      </div>

      {/* Search filter input */}
      <div className="p-2 border-b border-zinc-800/80">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-7 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Copied alert toast */}
      {copiedNotification && (
        <div className="mx-2 mt-1 px-2 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded text-[11px] text-emerald-300 flex items-center gap-1.5 animate-in fade-in">
          <Check className="w-3 h-3" />
          <span className="truncate">Copiado: {copiedNotification}</span>
        </div>
      )}

      {/* Object Tree List */}
      <div className="flex-1 overflow-auto p-2 space-y-1">

        {/* Loading skeleton — shown while fetching objects after connect / db switch */}
        {isLoading && !currentDb && (
          <div className="p-3 space-y-3">
            {/* Status line */}
            <div className="flex items-center gap-2 px-1">
              <div className="w-3.5 h-3.5 border-2 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin shrink-0" />
              <span className="text-[11px] text-emerald-400 font-medium animate-pulse">
                {t('sidebar.loadingObjects')}
              </span>
            </div>
            {/* Skeleton rows */}
            {[80, 60, 72, 55, 90, 48, 65].map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-1">
                <div className="w-3 h-3 rounded bg-zinc-800 animate-pulse shrink-0" />
                <div
                  className="h-2.5 rounded bg-zinc-800 animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
            {/* Skeleton section headers */}
            <div className="pt-2 space-y-2">
              {[45, 35].map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-1">
                  <div className="w-3 h-3 rounded bg-zinc-800/80 animate-pulse shrink-0" />
                  <div
                    className="h-2 rounded bg-zinc-800/80 animate-pulse"
                    style={{ width: `${w}%`, animationDelay: `${(i + 7) * 80}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If no active database / disconnected (and not loading) */}
        {!isLoading && !currentDb && (
          <div className="p-4 text-center text-zinc-500 space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto text-amber-500/80" />
            <p className="font-semibold text-zinc-300">{t('sidebar.noConnectionTitle')}</p>
            <p className="text-[11px] leading-relaxed">{t('sidebar.noConnectionDesc')}</p>
          </div>
        )}

        {currentDb && (
          <>
            {/* 1. TABLES SECTION */}
            <div>
              <div 
                onClick={() => toggleSection('tables')}
                onContextMenu={(e) => openContextMenu(e, 'TABLE_SECTION', 'Tablas')}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300 font-semibold group"
              >
                <div className="flex items-center gap-1.5">
                  {collapsedSections.tables ? <ChevronRight className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('sidebar.tables')}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded font-normal font-mono">
                    {filteredTables.length}
                  </span>
                </div>
                {onCreateTable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateTable(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-emerald-400 text-zinc-400 rounded transition-opacity"
                    title={t('sidebar.createTable')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!collapsedSections.tables && (
                <div className="ml-4 pl-1 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                  {filteredTables.map((tbl) => {
                    const isExpanded = isTableExpanded(tbl);
                    const cols = getColumnsForTable(tbl);
                    const isLoadingCols = Boolean(loadingColumns[tbl]);

                    return (
                      <div key={tbl} className="space-y-0.5">
                        <div
                          onClick={() => onSelectObjectSql(`SELECT * FROM \`${tbl}\` LIMIT 100;`, true)}
                          onContextMenu={(e) => openContextMenu(e, 'TABLE', tbl)}
                          className="flex items-center justify-between px-1.5 py-1 rounded text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                          title={`Clic para consultar primeros 100 de \`${tbl}\`\nClic derecho para más opciones`}
                        >
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            <button
                              type="button"
                              onClick={(e) => toggleTableExpand(tbl, e)}
                              className="p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors shrink-0"
                              title={isExpanded ? (t('sidebar.collapseColumns') || 'Plegar campos') : (t('sidebar.expandColumns') || 'Desplegar campos')}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-zinc-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                              )}
                            </button>
                            <TableIcon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 shrink-0" />
                            <span className="truncate font-medium text-xs">{tbl}</span>
                            {cols.length > 0 && !isExpanded && (
                              <span className="text-[10px] text-zinc-600 font-mono hidden group-hover:inline shrink-0">
                                ({cols.length})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); onShowTableDetails(tbl); }}
                              className="p-0.5 hover:text-emerald-400 text-zinc-500 rounded"
                              title={t('sidebar.viewDetailsIndices')}
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            {onDesignTable && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDesignTable(tbl); }}
                                className="p-0.5 hover:text-amber-400 text-zinc-500 rounded"
                                title={t('sidebar.designModifyTable')}
                              >
                                <Sliders className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Columns List */}
                        {isExpanded && (
                          <div className="ml-4 pl-2 border-l border-zinc-800/80 py-0.5 space-y-0.5 animate-in fade-in duration-100">
                            {isLoadingCols ? (
                              <div className="px-2 py-1 text-[11px] text-zinc-500 flex items-center gap-1.5">
                                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                                <span>Cargando campos...</span>
                              </div>
                            ) : cols.length > 0 ? (
                              cols.map((col) => {
                                const isHighlighted = filterText && (col.name.toLowerCase().includes(filterText) || col.type.toLowerCase().includes(filterText));
                                return (
                                  <div
                                    key={col.name}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyName(col.name);
                                    }}
                                    onContextMenu={(e) => openContextMenu(e, 'COLUMN', col.name, { tableName: tbl, ...col })}
                                    className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[11px] cursor-pointer group/col transition-colors ${
                                      isHighlighted 
                                        ? 'bg-emerald-950/40 text-emerald-300 font-semibold' 
                                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                                    }`}
                                    title={`${col.name} (${col.type})${col.isPrimary ? ' - Clave Primaria' : ''}${col.isAutoIncrement ? ' - AUTO_INCREMENT' : ''}${!col.isNullable ? ' - NOT NULL' : ''}\nClic para copiar nombre`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {col.isPrimary ? (
                                        <Key className="w-3 h-3 text-amber-400 shrink-0" title="Clave Primaria (PK)" />
                                      ) : (
                                        <Columns className="w-2.5 h-2.5 text-zinc-600 group-hover/col:text-emerald-400 shrink-0" />
                                      )}
                                      <span className={`truncate font-mono ${col.isPrimary ? 'text-amber-300 font-semibold' : ''}`}>
                                        {col.name}
                                      </span>
                                      {col.isAutoIncrement && (
                                        <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-sans">
                                          AI
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                      <span className="text-[10px] text-zinc-500 group-hover/col:text-zinc-400 font-mono">
                                        {col.type}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyName(col.name);
                                        }}
                                        className="opacity-0 group-hover/col:opacity-100 p-0.5 text-zinc-500 hover:text-emerald-400 rounded transition-opacity"
                                        title={t('sidebar.copyColumnName') || 'Copiar nombre de campo'}
                                      >
                                        <Copy className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="px-2 py-0.5 text-[11px] text-zinc-600 italic">
                                Sin campos detectados
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredTables.length === 0 && (
                    <div className="px-2 py-1 text-zinc-600 italic text-[11px]">No hay tablas</div>
                  )}
                </div>
              )}
            </div>

            {/* 2. VIEWS SECTION */}
            <div>
              <div 
                onClick={() => toggleSection('views')}
                onContextMenu={(e) => openContextMenu(e, 'VIEW_SECTION', 'Vistas')}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300 font-semibold group"
              >
                <div className="flex items-center gap-1.5">
                  {collapsedSections.views ? <ChevronRight className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('sidebar.views')}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded font-normal font-mono">
                    {filteredViews.length}
                  </span>
                </div>
                {onCreateView && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateView(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-blue-400 text-zinc-400 rounded transition-opacity"
                    title={t('sidebar.createView')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!collapsedSections.views && (
                <div className="ml-4 pl-1 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                  {filteredViews.map((vw) => {
                    const isExpanded = isViewExpanded(vw);
                    const cols = getColumnsForTable(vw);
                    const isLoadingCols = Boolean(loadingColumns[vw]);

                    return (
                      <div key={vw} className="space-y-0.5">
                        <div
                          onClick={() => onSelectObjectSql(`SELECT * FROM \`${vw}\` LIMIT 100;`, true)}
                          onDoubleClick={() => onEditObject('VIEW', vw)}
                          onContextMenu={(e) => openContextMenu(e, 'VIEW', vw)}
                          className="flex items-center justify-between px-1.5 py-1 rounded text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                          title={`Clic: Consultar primeros 100 de \`${vw}\`\nDoble clic: Ver / Editar DDL\nClic derecho: Opciones`}
                        >
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            <button
                              type="button"
                              onClick={(e) => toggleViewExpand(vw, e)}
                              className="p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors shrink-0"
                              title={isExpanded ? (t('sidebar.collapseColumns') || 'Plegar campos') : (t('sidebar.expandColumns') || 'Desplegar campos')}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-zinc-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                              )}
                            </button>
                            <Eye className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 shrink-0" />
                            <span className="truncate font-medium text-xs">{vw}</span>
                            {cols.length > 0 && !isExpanded && (
                              <span className="text-[10px] text-zinc-600 font-mono hidden group-hover:inline shrink-0">
                                ({cols.length})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditObject('VIEW', vw); }}
                              className="p-0.5 hover:text-blue-400 text-zinc-500 rounded"
                              title={t('sidebar.editViewDdl')}
                            >
                              <Code className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Columns List for View */}
                        {isExpanded && (
                          <div className="ml-4 pl-2 border-l border-zinc-800/80 py-0.5 space-y-0.5 animate-in fade-in duration-100">
                            {isLoadingCols ? (
                              <div className="px-2 py-1 text-[11px] text-zinc-500 flex items-center gap-1.5">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                                <span>Cargando campos...</span>
                              </div>
                            ) : cols.length > 0 ? (
                              cols.map((col) => {
                                const isHighlighted = filterText && (col.name.toLowerCase().includes(filterText) || col.type.toLowerCase().includes(filterText));
                                return (
                                  <div
                                    key={col.name}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyName(col.name);
                                    }}
                                    onContextMenu={(e) => openContextMenu(e, 'COLUMN', col.name, { tableName: vw, ...col })}
                                    className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[11px] cursor-pointer group/col transition-colors ${
                                      isHighlighted 
                                        ? 'bg-blue-950/40 text-blue-300 font-semibold' 
                                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                                    }`}
                                    title={`${col.name} (${col.type})\nClic para copiar nombre`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Columns className="w-2.5 h-2.5 text-zinc-600 group-hover/col:text-blue-400 shrink-0" />
                                      <span className="truncate font-mono">
                                        {col.name}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                      <span className="text-[10px] text-zinc-500 group-hover/col:text-zinc-400 font-mono">
                                        {col.type}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyName(col.name);
                                        }}
                                        className="opacity-0 group-hover/col:opacity-100 p-0.5 text-zinc-500 hover:text-blue-400 rounded transition-opacity"
                                        title={t('sidebar.copyColumnName') || 'Copiar nombre de campo'}
                                      >
                                        <Copy className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="px-2 py-0.5 text-[11px] text-zinc-600 italic">
                                Sin campos detectados
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredViews.length === 0 && (
                    <div className="px-2 py-1 text-zinc-600 italic text-[11px]">No hay vistas</div>
                  )}
                </div>
              )}
            </div>

            {/* 3. STORED PROCEDURES SECTION */}
            <div>
              <div 
                onClick={() => toggleSection('procedures')}
                onContextMenu={(e) => openContextMenu(e, 'PROCEDURE_SECTION', 'Procedimientos')}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300 font-semibold group"
              >
                <div className="flex items-center gap-1.5">
                  {collapsedSections.procedures ? <ChevronRight className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  <Cog className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('sidebar.procedures')}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded font-normal font-mono">
                    {filteredProcedures.length}
                  </span>
                </div>
                {onCreateProcedure && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateProcedure(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-amber-400 text-zinc-400 rounded transition-opacity"
                    title={t('sidebar.createProcedure')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!collapsedSections.procedures && (
                <div className="ml-4 pl-1 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                  {filteredProcedures.map((proc) => {
                    const args = proc.inputParams && proc.inputParams.length > 0
                      ? `(${proc.inputParams.map(p => `@${p}`).join(', ')})`
                      : '()';
                    const callSql = `CALL \`${proc.name}\`${args};`;

                    return (
                      <div
                        key={proc.name}
                        onClick={() => onEditObject('PROCEDURE', proc.name)}
                        onDoubleClick={() => onEditObject('PROCEDURE', proc.name)}
                        onContextMenu={(e) => openContextMenu(e, 'PROCEDURE', proc.name, proc)}
                        className="flex items-center justify-between px-2 py-1 rounded text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                        title={`Clic o doble clic para abrir código fuente (DDL)\nClic derecho para menú`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Cog className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 shrink-0" />
                          <span className="truncate">{proc.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectObjectSql(callSql, false); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-emerald-400 text-zinc-500 rounded"
                            title={t('sidebar.executeProcedure') || 'Generar CALL en consulta'}
                          >
                            <Play className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditObject('PROCEDURE', proc.name); }}
                            className="opacity-60 group-hover:opacity-100 p-0.5 hover:text-amber-400 text-zinc-400 rounded"
                            title={t('sidebar.editProcedureDdl')}
                          >
                            <Code className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProcedures.length === 0 && (
                    <div className="px-2 py-1 text-zinc-600 italic text-[11px]">No hay procedimientos</div>
                  )}
                </div>
              )}
            </div>

            {/* 4. FUNCTIONS SECTION */}
            <div>
              <div 
                onClick={() => toggleSection('functions')}
                onContextMenu={(e) => openContextMenu(e, 'FUNCTION_SECTION', 'Funciones')}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300 font-semibold group"
              >
                <div className="flex items-center gap-1.5">
                  {collapsedSections.functions ? <ChevronRight className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>{t('sidebar.functions')}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded font-normal font-mono">
                    {filteredFunctions.length}
                  </span>
                </div>
                {onCreateFunction && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateFunction(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-purple-400 text-zinc-400 rounded transition-opacity"
                    title={t('sidebar.createFunction')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!collapsedSections.functions && (
                <div className="ml-4 pl-1 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                  {filteredFunctions.map((fn) => (
                    <div
                      key={fn.name}
                      onClick={() => onEditObject('FUNCTION', fn.name)}
                      onDoubleClick={() => onEditObject('FUNCTION', fn.name)}
                      onContextMenu={(e) => openContextMenu(e, 'FUNCTION', fn.name)}
                      className="flex items-center justify-between px-2 py-1 rounded text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                      title={`Clic o doble clic para abrir código fuente (DDL)\nClic derecho para menú`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Zap className="w-3 h-3 text-zinc-500 group-hover:text-purple-400 shrink-0" />
                        <span className="truncate">{fn.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectObjectSql(`SELECT \`${fn.name}\`();`, false); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-emerald-400 text-zinc-500 rounded"
                          title={t('sidebar.executeFunction') || 'Generar SELECT()'}
                        >
                          <Play className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditObject('FUNCTION', fn.name); }}
                          className="opacity-60 group-hover:opacity-100 p-0.5 hover:text-purple-400 text-zinc-400 rounded"
                          title={t('sidebar.editFunctionDdl')}
                        >
                          <Code className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredFunctions.length === 0 && (
                    <div className="px-2 py-1 text-zinc-600 italic text-[11px]">No hay funciones</div>
                  )}
                </div>
              )}
            </div>

            {/* 5. TRIGGERS SECTION */}
            <div>
              <div 
                onClick={() => toggleSection('triggers')}
                onContextMenu={(e) => openContextMenu(e, 'TRIGGER_SECTION', 'Triggers')}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300 font-semibold group"
              >
                <div className="flex items-center gap-1.5">
                  {collapsedSections.triggers ? <ChevronRight className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  <Hash className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{t('sidebar.triggers')}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded font-normal font-mono">
                    {filteredTriggers.length}
                  </span>
                </div>
                {onCreateTrigger && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateTrigger(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-yellow-400 text-zinc-400 rounded transition-opacity"
                    title={t('sidebar.createTrigger')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!collapsedSections.triggers && (
                <div className="ml-4 pl-1 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                  {filteredTriggers.map((tr) => (
                    <div
                      key={tr.name}
                      onClick={() => onEditObject('TRIGGER', tr.name)}
                      onDoubleClick={() => onEditObject('TRIGGER', tr.name)}
                      onContextMenu={(e) => openContextMenu(e, 'TRIGGER', tr.name, tr)}
                      className="flex items-center justify-between px-2 py-1 rounded text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                      title={`Trigger: ${tr.name} (${tr.timing} ${tr.event} en ${tr.table})\nClic o doble clic para abrir código DDL`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Hash className="w-3 h-3 text-zinc-500 group-hover:text-yellow-400 shrink-0" />
                        <span className="truncate">{tr.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {tr.table}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditObject('TRIGGER', tr.name); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-yellow-400 text-zinc-400 rounded"
                          title={t('sidebar.editTriggerDdl')}
                        >
                          <Code className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredTriggers.length === 0 && (
                    <div className="px-2 py-1 text-zinc-600 italic text-[11px]">No hay triggers</div>
                  )}
                </div>
              )}
            </div>

            {/* 6. EVENTS SECTION */}
            <div>
              <div 
                onClick={() => toggleSection('events')}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300 font-semibold group"
              >
                <div className="flex items-center gap-1.5">
                  {collapsedSections.events ? <ChevronRight className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('sidebar.events')}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded font-normal font-mono">
                    {filteredEvents.length}
                  </span>
                </div>
              </div>

              {!collapsedSections.events && (
                <div className="ml-4 pl-1 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                  {filteredEvents.map((evt) => (
                    <div
                      key={evt}
                      onClick={() => onEditObject('EVENT', evt)}
                      onDoubleClick={() => onEditObject('EVENT', evt)}
                      onContextMenu={(e) => openContextMenu(e, 'EVENT', evt)}
                      className="flex items-center justify-between px-2 py-1 rounded text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                      title={`Evento programado: ${evt}\nClic o doble clic para abrir código DDL`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3 h-3 text-zinc-500 group-hover:text-cyan-400 shrink-0" />
                        <span className="truncate">{evt}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditObject('EVENT', evt); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-cyan-400 text-zinc-400 rounded"
                        title={t('sidebar.editEventDdl')}
                      >
                        <Code className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {filteredEvents.length === 0 && (
                    <div className="px-2 py-1 text-zinc-600 italic text-[11px]">No hay eventos</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Floating Context Menu */}
      {contextMenu?.isOpen && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-56 bg-zinc-900 border border-zinc-700/90 rounded-lg shadow-2xl py-1 divide-y divide-zinc-800 text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* TABLE CONTEXT MENU */}
          {contextMenu.itemType === 'TABLE' && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-bold text-emerald-400 font-mono truncate border-b border-zinc-800">
                Tabla: {contextMenu.name}
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`SELECT * FROM \`${contextMenu.name}\` LIMIT 100;`, true);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('sidebar.queryFirst100')}</span>
                </button>
                <button
                  onClick={() => {
                    onShowTableDetails(contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('sidebar.viewDetailsIndices')}</span>
                </button>
                <button
                  onClick={() => {
                    toggleTableExpand(contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Columns className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{isTableExpanded(contextMenu.name) ? (t('sidebar.collapseColumns') || 'Plegar campos') : (t('sidebar.expandColumns') || 'Desplegar campos')}</span>
                </button>
                {onDesignTable && (
                  <button
                    onClick={() => {
                      onDesignTable(contextMenu.name);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('sidebar.designModifyTable')}</span>
                  </button>
                )}
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyName')}</span>
                </button>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(
                      `SELECT *\nFROM \`${contextMenu.name}\`\nWHERE 1=1\nORDER BY 1 DESC\nLIMIT 100;`,
                      false
                    );
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>Plantilla SELECT</span>
                </button>
                <button
                  onClick={() => {
                    onSelectObjectSql(
                      `INSERT INTO \`${contextMenu.name}\` (/* columnas */)\nVALUES (/* valores */);`,
                      false
                    );
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Plantilla INSERT</span>
                </button>
                <button
                  onClick={() => {
                    onSelectObjectSql(
                      `UPDATE \`${contextMenu.name}\`\nSET /* columna */ = /* valor */\nWHERE 1=1;`,
                      false
                    );
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Plantilla UPDATE</span>
                </button>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`DROP TABLE \`${contextMenu.name}\`;`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-red-400 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('sidebar.dropTable')}</span>
                </button>
              </div>
            </>
          )}

          {/* VIEW CONTEXT MENU */}
          {contextMenu.itemType === 'VIEW' && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-bold text-blue-400 font-mono truncate border-b border-zinc-800">
                Vista: {contextMenu.name}
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`SELECT * FROM \`${contextMenu.name}\` LIMIT 100;`, true);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('sidebar.queryFirst100')}</span>
                </button>
                <button
                  onClick={() => {
                    onEditObject('VIEW', contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('sidebar.editViewDdl')}</span>
                </button>
                <button
                  onClick={() => {
                    toggleViewExpand(contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Columns className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{isViewExpanded(contextMenu.name) ? (t('sidebar.collapseColumns') || 'Plegar campos') : (t('sidebar.expandColumns') || 'Desplegar campos')}</span>
                </button>
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyName')}</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`DROP VIEW \`${contextMenu.name}\`;`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-red-400 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('sidebar.dropView')}</span>
                </button>
              </div>
            </>
          )}

          {/* COLUMN CONTEXT MENU */}
          {contextMenu.itemType === 'COLUMN' && (
            <>
              <div className="px-3 py-1.5 border-b border-zinc-800">
                <div className="text-[11px] font-bold text-amber-400 font-mono truncate flex items-center gap-1.5">
                  <Columns className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span>{contextMenu.name}</span>
                </div>
                {contextMenu.meta?.type && (
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    {contextMenu.meta.type}
                    {contextMenu.meta.isPrimary && ' • PK'}
                    {contextMenu.meta.isAutoIncrement && ' • AI'}
                    {!contextMenu.meta.isNullable && ' • NOT NULL'}
                  </div>
                )}
              </div>
              <div className="py-1">
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyColumnName') || 'Copiar nombre de campo'}</span>
                </button>
                <button
                  onClick={() => handleCopyName(`\`${contextMenu.name}\``)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyColumnBackticks') || 'Copiar con comillas (`campo`)'}</span>
                </button>
                {contextMenu.meta?.tableName && (
                  <button
                    onClick={() => {
                      onSelectObjectSql(
                        `SELECT \`${contextMenu.name}\` FROM \`${contextMenu.meta.tableName}\` LIMIT 100;`,
                        true
                      );
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('sidebar.queryColumn') || 'Consultar este campo'}</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* PROCEDURE CONTEXT MENU */}
          {contextMenu.itemType === 'PROCEDURE' && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-bold text-amber-400 font-mono truncate border-b border-zinc-800">
                Procedimiento: {contextMenu.name}
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onEditObject('PROCEDURE', contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('sidebar.editProcedureDdl')}</span>
                </button>
                <button
                  onClick={() => {
                    const proc = contextMenu.meta;
                    const args = proc?.inputParams && proc.inputParams.length > 0
                      ? `(${proc.inputParams.map((p: string) => `@${p}`).join(', ')})`
                      : '()';
                    onSelectObjectSql(`CALL \`${contextMenu.name}\`${args};`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('sidebar.executeProcedure')}</span>
                </button>
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyName')}</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`DROP PROCEDURE \`${contextMenu.name}\`;`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-red-400 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('sidebar.dropProcedure')}</span>
                </button>
              </div>
            </>
          )}

          {/* FUNCTION CONTEXT MENU */}
          {contextMenu.itemType === 'FUNCTION' && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-bold text-purple-400 font-mono truncate border-b border-zinc-800">
                Función: {contextMenu.name}
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onEditObject('FUNCTION', contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-purple-400" />
                  <span>{t('sidebar.editFunctionDdl')}</span>
                </button>
                <button
                  onClick={() => {
                    onSelectObjectSql(`SELECT \`${contextMenu.name}\`();`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('sidebar.executeFunction')}</span>
                </button>
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyName')}</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`DROP FUNCTION \`${contextMenu.name}\`;`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-red-400 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('sidebar.dropFunction')}</span>
                </button>
              </div>
            </>
          )}

          {/* TRIGGER CONTEXT MENU */}
          {contextMenu.itemType === 'TRIGGER' && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-bold text-yellow-400 font-mono truncate border-b border-zinc-800">
                Trigger: {contextMenu.name}
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onEditObject('TRIGGER', contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{t('sidebar.editTriggerDdl')}</span>
                </button>
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyName')}</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`DROP TRIGGER \`${contextMenu.name}\`;`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-red-400 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('sidebar.dropTrigger')}</span>
                </button>
              </div>
            </>
          )}

          {/* EVENT CONTEXT MENU */}
          {contextMenu.itemType === 'EVENT' && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-bold text-cyan-400 font-mono truncate border-b border-zinc-800">
                Evento: {contextMenu.name}
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onEditObject('EVENT', contextMenu.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('sidebar.editEventDdl')}</span>
                </button>
                <button
                  onClick={() => handleCopyName(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sidebar.copyName')}</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectObjectSql(`DROP EVENT \`${contextMenu.name}\`;`, false);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-red-400 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('sidebar.dropEvent')}</span>
                </button>
              </div>
            </>
          )}

          {/* SECTION CONTEXT MENUS */}
          {contextMenu.itemType === 'TABLE_SECTION' && (
            <div className="py-1">
              {onCreateTable && (
                <button
                  onClick={() => { onCreateTable(); setContextMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('sidebar.createTable')}</span>
                </button>
              )}
              <button
                onClick={() => { onRefresh(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('sidebar.refreshTables')}</span>
              </button>
            </div>
          )}

          {contextMenu.itemType === 'VIEW_SECTION' && onCreateView && (
            <div className="py-1">
              <button
                onClick={() => { onCreateView(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('sidebar.createView')}</span>
              </button>
            </div>
          )}

          {contextMenu.itemType === 'PROCEDURE_SECTION' && onCreateProcedure && (
            <div className="py-1">
              <button
                onClick={() => { onCreateProcedure(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('sidebar.createProcedure')}</span>
              </button>
            </div>
          )}

          {contextMenu.itemType === 'FUNCTION_SECTION' && onCreateFunction && (
            <div className="py-1">
              <button
                onClick={() => { onCreateFunction(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('sidebar.createFunction')}</span>
              </button>
            </div>
          )}

          {contextMenu.itemType === 'TRIGGER_SECTION' && onCreateTrigger && (
            <div className="py-1">
              <button
                onClick={() => { onCreateTrigger(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-yellow-400" />
                <span>{t('sidebar.createTrigger')}</span>
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
