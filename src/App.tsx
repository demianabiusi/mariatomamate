import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionConfig, QueryTab, QueryResult, QueryHistoryItem, SchemaObjects } from './types';
import { Navbar } from './components/Navbar';
import { ObjectTree } from './components/Sidebar/ObjectTree';
import { TabBar } from './components/Editor/TabBar';
import { SqlEditor } from './components/Editor/SqlEditor';
import { OutputPanel } from './components/Grid/OutputPanel';
import { ConnectionModal } from './components/Modals/ConnectionModal';
import { TableDetailsModal } from './components/Modals/TableDetailsModal';
import { CreateDatabaseModal } from './components/Modals/CreateDatabaseModal';
import { TableDesignerModal } from './components/Modals/TableDesignerModal';
import { DumpDatabaseModal } from './components/Modals/DumpDatabaseModal';
import { ImportDatabaseModal } from './components/Modals/ImportDatabaseModal';
import { Database, Plus, Sparkles } from 'lucide-react';
import { useConnectionWorkspace } from './hooks/useConnectionWorkspace';

const INITIAL_QUERY = `-- Bienvenido a Maria Toma Mate 🧉
-- Cliente visual ligero y moderno para MariaDB y MySQL
-- Presiona F9 o Ctrl+Enter para ejecutar consultas

SHOW DATABASES;
`;

export const App: React.FC = () => {
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [activeConfig, setActiveConfig] = useState<ConnectionConfig | null>(null);
  const [activeDatabase, setActiveDatabase] = useState<string | null>(null);
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([]);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isDumpModalOpen, setIsDumpModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Workspace persistence
  const { hydrateWorkspace, saveWorkspaceNow, saveWorkspaceDebounced } = useConnectionWorkspace();

  // Table Designer states
  const [isTableDesignerOpen, setIsTableDesignerOpen] = useState(false);
  const [tableDesignerName, setTableDesignerName] = useState<string | null>(null);

  // Schema metadata
  const [schemaObjects, setSchemaObjects] = useState<SchemaObjects | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Query tabs
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: 'tab_1',
      title: 'Consulta 1',
      sql: INITIAL_QUERY,
      result: null,
      isRunning: false,
      error: null,
      activeResultTab: 'grid'
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');
  const [maxRows, setMaxRows] = useState<number>(1000);

  // F9/F5 key swap preference (persisted) — matches SQLyog behavior when enabled
  const [swapF9F5, setSwapF9F5] = useState<boolean>(() =>
    localStorage.getItem('mariatomamate_swap_f9f5') === 'true'
  );
  const handleToggleSwapF9F5 = () => {
    setSwapF9F5(prev => {
      const next = !prev;
      localStorage.setItem('mariatomamate_swap_f9f5', String(next));
      return next;
    });
  };

  // Refs so disconnect/save/execute can always read latest values without stale closures
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const maxRowsRef = useRef(maxRows);
  const activeConfigRef = useRef(activeConfig);
  const activeDatabaseRef = useRef(activeDatabase);
  const isConnectedRef = useRef(isConnected);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { maxRowsRef.current = maxRows; }, [maxRows]);
  useEffect(() => { activeConfigRef.current = activeConfig; }, [activeConfig]);
  useEffect(() => { activeDatabaseRef.current = activeDatabase; }, [activeDatabase]);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  // Panel resizing states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('mariatomamate_sidebar_width');
    return saved ? Math.max(180, Math.min(650, parseInt(saved, 10))) : 288;
  });
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  const [editorHeightPercent, setEditorHeightPercent] = useState<number>(() => {
    const saved = localStorage.getItem('mariatomamate_editor_height_pct');
    return saved ? Math.max(15, Math.min(85, parseFloat(saved))) : 48;
  });
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  // History
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  // Modals
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<string | null>(null);

  // Active Tab helper
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Load saved connections on startup
  const loadSavedConnections = useCallback(async () => {
    try {
      if (window.electronAPI?.getSavedConnections) {
        const conns = await window.electronAPI.getSavedConnections();
        setSavedConnections(conns || []);
      }
    } catch (err) {
      console.error('Error loading connections:', err);
    }
  }, []);

  // Fetch schema objects
  const refreshSchema = useCallback(async () => {
    if (!isConnected) return;
    setIsLoadingSchema(true);
    try {
      if (window.electronAPI?.getSchemaObjects) {
        const res = await window.electronAPI.getSchemaObjects();
        if (res.success && res.data) {
          setSchemaObjects(res.data);
          if (res.data.currentDatabase) {
            setActiveDatabase(res.data.currentDatabase);
          }
        } else {
          setSchemaObjects(null);
        }
      }
    } catch (err) {
      console.error('Error fetching schema:', err);
      setSchemaObjects(null);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [isConnected]);

  // Switch active database
  const handleSelectDatabase = useCallback(async (dbName: string) => {
    if (!dbName || !isConnected) return;
    try {
      if (window.electronAPI?.switchDatabase) {
        const res = await window.electronAPI.switchDatabase(dbName);
        if (res.success) {
          setActiveDatabase(dbName);
          if (activeConfigRef.current) {
            saveWorkspaceNow(
              activeConfigRef.current.id,
              tabsRef.current,
              activeTabIdRef.current,
              maxRowsRef.current,
              dbName
            );
            if (window.electronAPI?.saveAppSettings) {
              window.electronAPI.saveAppSettings({
                lastActiveConnectionId: activeConfigRef.current.id,
                lastActiveDatabase: dbName
              });
            }
          }
          await refreshSchema();
        }
      }
    } catch (err) {
      console.error('Error switching database:', err);
    }
  }, [isConnected, refreshSchema, saveWorkspaceNow]);

  // Connect action
  const handleConnect = useCallback(async (config: ConnectionConfig, preferredDb?: string | null) => {
    if (window.electronAPI?.connect) {
      setSchemaObjects(null);
      setIsLoadingSchema(true);

      // Hydrate workspace for this connection first to retrieve saved activeDatabase if any
      const workspace = hydrateWorkspace(config.id);
      const targetDb = preferredDb !== undefined ? preferredDb : (workspace.activeDatabase || config.database || null);
      const configToConnect = targetDb ? { ...config, database: targetDb } : { ...config };

      const res = await window.electronAPI.connect(configToConnect);
      if (!res.success) {
        setIsLoadingSchema(false);
        throw new Error(res.error || 'No se pudo establecer la conexión');
      }

      setIsConnected(true);
      setActiveConfig(config);

      let finalDb = res.data?.database || targetDb || null;
      if (targetDb && window.electronAPI?.switchDatabase) {
        try {
          await window.electronAPI.switchDatabase(targetDb);
          finalDb = targetDb;
        } catch {}
      }
      setActiveDatabase(finalDb);

      setTabs(workspace.tabs);
      setActiveTabId(workspace.activeTabId);
      setMaxRows(workspace.maxRows);

      // Save settings and workspace
      if (window.electronAPI?.saveAppSettings) {
        window.electronAPI.saveAppSettings({
          lastActiveConnectionId: config.id,
          lastActiveDatabase: finalDb
        });
      }
      saveWorkspaceNow(config.id, workspace.tabs, workspace.activeTabId, workspace.maxRows, finalDb);

      // Fetch schema objects
      setTimeout(async () => {
        try {
          const schemaRes = await window.electronAPI.getSchemaObjects();
          if (schemaRes.success && schemaRes.data) {
            setSchemaObjects(schemaRes.data);
            if (schemaRes.data.currentDatabase) {
              setActiveDatabase(schemaRes.data.currentDatabase);
            }
          }
        } finally {
          setIsLoadingSchema(false);
        }
      }, 100);
    }
  }, [hydrateWorkspace, saveWorkspaceNow]);

  // Disconnect action
  const handleDisconnect = useCallback(async () => {
    if (activeConfigRef.current) {
      saveWorkspaceNow(
        activeConfigRef.current.id,
        tabsRef.current,
        activeTabIdRef.current,
        maxRowsRef.current,
        activeDatabaseRef.current
      );
    }

    if (window.electronAPI?.disconnect) {
      await window.electronAPI.disconnect();
    }
    setIsConnected(false);
    setActiveConfig(null);
    setActiveDatabase(null);
    setSchemaObjects(null);
  }, [saveWorkspaceNow]);

  // Auto-connect on startup if configured
  useEffect(() => {
    loadSavedConnections();

    if (window.electronAPI?.getAppSettings && window.electronAPI?.getSavedConnections) {
      Promise.all([
        window.electronAPI.getAppSettings(),
        window.electronAPI.getSavedConnections()
      ]).then(([settings, conns]) => {
        if (conns) setSavedConnections(conns);
        if (settings?.autoConnectOnStartup && settings.lastActiveConnectionId && conns) {
          const target = conns.find(c => c.id === settings.lastActiveConnectionId);
          if (target) {
            const workspace = hydrateWorkspace(target.id);
            const dbToUse = settings.lastActiveDatabase || workspace.activeDatabase || target.database || null;
            handleConnect(target, dbToUse).catch(err => {
              console.warn('Auto-connect on startup failed:', err);
              setIsConnectionModalOpen(true);
            });
            return;
          }
        }
        setIsConnectionModalOpen(true);
      }).catch(err => {
        console.error('Error on init settings:', err);
        setIsConnectionModalOpen(true);
      });
    } else {
      setIsConnectionModalOpen(true);
    }
  }, [loadSavedConnections, handleConnect, hydrateWorkspace]);

  // Tab operations
  const handleAddTab = () => {
    const newId = 'tab_' + Date.now();
    const newTab: QueryTab = {
      id: newId,
      title: `Consulta ${tabs.length + 1}`,
      sql: '',
      result: null,
      isRunning: false,
      error: null,
      activeResultTab: 'grid'
    };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newId);
    if (activeConfig) {
      saveWorkspaceDebounced(activeConfig.id, nextTabs, newId, maxRows, activeDatabaseRef.current);
    }
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const index = tabs.findIndex(t => t.id === id);
    const nextTabs = tabs.filter(t => t.id !== id);
    let nextActiveId = activeTabId;
    if (activeTabId === id) {
      const nextActive = nextTabs[Math.max(0, index - 1)];
      nextActiveId = nextActive.id;
      setActiveTabId(nextActiveId);
    }
    setTabs(nextTabs);
    if (activeConfig) {
      saveWorkspaceDebounced(activeConfig.id, nextTabs, nextActiveId, maxRows, activeDatabaseRef.current);
    }
  };

  const handleRenameTab = (id: string, newTitle: string) => {
    const nextTabs = tabs.map(t => t.id === id ? { ...t, title: newTitle } : t);
    setTabs(nextTabs);
    if (activeConfig) {
      saveWorkspaceDebounced(activeConfig.id, nextTabs, activeTabId, maxRows, activeDatabaseRef.current);
    }
  };

  const handleUpdateActiveSql = (newSql: string) => {
    const nextTabs = tabs.map(t => t.id === activeTabId ? { ...t, sql: newSql } : t);
    setTabs(nextTabs);
    if (activeConfig) {
      saveWorkspaceDebounced(activeConfig.id, nextTabs, activeTabId, maxRows, activeDatabaseRef.current);
    }
  };

  const handleUpdateActiveTabResultTab = (subTab: 'grid' | 'messages' | 'history') => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, activeResultTab: subTab } : t));
  };

  // Execute query action
  const handleExecute = useCallback(async (customQuery?: string) => {
    if (!isConnectedRef.current) {
      setIsConnectionModalOpen(true);
      return;
    }

    const currentTabId = activeTabIdRef.current;
    const currentTab = tabsRef.current.find(t => t.id === currentTabId) || tabsRef.current[0];
    if (!currentTab) return;

    let queryToRun = (typeof customQuery === 'string' && customQuery.trim()) ? customQuery.trim() : currentTab.sql.trim();

    if (!queryToRun) return;

    // Set tab running state
    setTabs(prev => prev.map(t => t.id === currentTabId ? { ...t, isRunning: true, error: null } : t));

    const startTime = Date.now();
    try {
      if (window.electronAPI?.executeQuery) {
        const res = await window.electronAPI.executeQuery(queryToRun, maxRowsRef.current);
        const durationMs = Date.now() - startTime;

        if (res.success && res.data) {
          const queryRes = res.data;
          setTabs(prev => prev.map(t => t.id === currentTabId ? {
            ...t,
            isRunning: false,
            result: queryRes,
            error: null,
            activeResultTab: queryRes.columns.length > 0 && queryRes.columns[0] !== 'RESULTADO' ? 'grid' : 'messages'
          } : t));

          // Log to history
          setHistory(prev => [
            {
              id: 'hist_' + Date.now(),
              sql: queryToRun,
              timestamp: new Date().toLocaleTimeString(),
              durationMs,
              status: 'success',
              rowCount: queryRes.rowCount
            },
            ...prev.slice(0, 150)
          ]);

          // If query was USE database, update active database and persist
          const useMatch = queryToRun.match(/^\s*USE\s+[`"']?([a-zA-Z0-9_$]+)[`"']?\s*;?$/i);
          if (useMatch) {
            const newDb = useMatch[1];
            setActiveDatabase(newDb);
            if (activeConfigRef.current) {
              saveWorkspaceNow(
                activeConfigRef.current.id,
                tabsRef.current,
                currentTabId,
                maxRowsRef.current,
                newDb
              );
              if (window.electronAPI?.saveAppSettings) {
                window.electronAPI.saveAppSettings({
                  lastActiveConnectionId: activeConfigRef.current.id,
                  lastActiveDatabase: newDb
                });
              }
            }
          }

          // If query modified schema (CREATE, ALTER, DROP, USE), refresh schema
          if (/^\s*(CREATE|ALTER|DROP|RENAME|TRUNCATE|USE)\b/i.test(queryToRun)) {
            refreshSchema();
          }
        } else {
          const errMsg = res.error || 'Error al ejecutar la consulta';
          setTabs(prev => prev.map(t => t.id === currentTabId ? {
            ...t,
            isRunning: false,
            error: errMsg,
            activeResultTab: 'messages'
          } : t));

          setHistory(prev => [
            {
              id: 'hist_' + Date.now(),
              sql: queryToRun,
              timestamp: new Date().toLocaleTimeString(),
              durationMs,
              status: 'error',
              error: errMsg
            },
            ...prev.slice(0, 150)
          ]);
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error inesperado';
      setTabs(prev => prev.map(t => t.id === currentTabId ? {
        ...t,
        isRunning: false,
        error: errMsg,
        activeResultTab: 'messages'
      } : t));
    }
  }, [refreshSchema, saveWorkspaceNow]);

  // Keyboard shortcut listener (Ctrl+N, Ctrl+T, Ctrl+W, F9, F5, Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 't')) {
        e.preventDefault();
        handleAddTab();
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (tabsRef.current.length > 1) {
          handleCloseTab(activeTabIdRef.current, e as any);
        }
        return;
      }

      const isExecKey = (!swapF9F5 && e.key === 'F9') || (swapF9F5 && e.key === 'F5');
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';

      if (isExecKey || isCtrlEnter) {
        const isMonaco = target && Boolean(target.closest('.monaco-editor'));
        if (!isMonaco && !isInput) {
          e.preventDefault();
          handleExecute();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [swapF9F5, handleAddTab, handleCloseTab, handleExecute]);

  // Resizing sidebar
  const handleSidebarMouseDown = () => {
    setIsDraggingSidebar(true);
  };

  // Resizing vertical editor/grid split
  const handleEditorSplitMouseDown = () => {
    setIsDraggingEditor(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(180, Math.min(650, e.clientX));
        setSidebarWidth(newWidth);
        localStorage.setItem('mariatomamate_sidebar_width', String(newWidth));
      } else if (isDraggingEditor) {
        const container = document.getElementById('main-editor-split-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const offset = e.clientY - rect.top;
          const pct = Math.max(15, Math.min(85, (offset / rect.height) * 100));
          setEditorHeightPercent(pct);
          localStorage.setItem('mariatomamate_editor_height_pct', String(pct));
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      setIsDraggingEditor(false);
    };

    if (isDraggingSidebar || isDraggingEditor) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar, isDraggingEditor]);

  // Context menu DDL / Object Edit
  const handleEditObject = async (type: 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT', name: string) => {
    try {
      if (window.electronAPI?.getObjectDdl) {
        const res = await window.electronAPI.getObjectDdl(type, name);
        if (res.success && res.data?.ddl) {
          const tabTitle = `${type === 'PROCEDURE' ? 'PROC' : type === 'FUNCTION' ? 'FUNC' : type.substring(0, 4)}: ${name}`;

          // Check if tab already exists for this object
          const existingTab = tabs.find(t => t.title === tabTitle);
          if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
          }

          const newId = 'tab_' + Date.now();
          const newTab: QueryTab = {
            id: newId,
            title: tabTitle,
            sql: res.data.ddl,
            result: null,
            isRunning: false,
            error: null,
            activeResultTab: 'grid'
          };
          setTabs(prev => [...prev, newTab]);
          setActiveTabId(newId);
        } else {
          alert(`Error al abrir ${type} '${name}':\n${res.error || 'No se pudo obtener el código fuente.'}`);
        }
      }
    } catch (err: any) {
      alert(`Error al obtener DDL de ${type} '${name}':\n${err.message}`);
    }
  };

  // Create Database action handler
  const handleCreateDatabase = async (options: { name: string; charset?: string; collation?: string }) => {
    if (window.electronAPI?.createDatabase) {
      const res = await window.electronAPI.createDatabase(options);
      if (res.success && res.data) {
        setActiveDatabase(res.data.database);
        await refreshSchema();
      } else {
        throw new Error(res.error || 'Error al crear la base de datos');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* 1. Header Navbar */}
      <Navbar
        isConnected={isConnected}
        activeConfig={activeConfig}
        activeDatabase={activeDatabase}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onOpenCreateDbModal={() => setIsCreateDbModalOpen(true)}
        onOpenDumpModal={() => setIsDumpModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onDisconnect={handleDisconnect}
        onNewQuery={handleAddTab}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Sidebar / Object Tree */}
        <div style={{ width: sidebarWidth }} className="shrink-0 h-full flex flex-col overflow-hidden">
          <ObjectTree
            objects={schemaObjects}
            isLoading={isLoadingSchema}
            onRefresh={refreshSchema}
            onSelectDatabase={handleSelectDatabase}
            onSelectObjectSql={(sql, executeImmediately) => {
              handleUpdateActiveSql(sql);
              if (executeImmediately) {
                setTimeout(() => handleExecute(false), 50);
              }
            }}
            onShowTableDetails={(tbl) => setSelectedTableForDetails(tbl)}
            onEditObject={handleEditObject}
            onCreateTable={() => {
              setTableDesignerName(null);
              setIsTableDesignerOpen(true);
            }}
            onDesignTable={(tbl) => {
              setTableDesignerName(tbl);
              setIsTableDesignerOpen(true);
            }}
            onCreateProcedure={() => {
              const newId = 'tab_' + Date.now();
              const ddl = `DELIMITER ;;\n\nCREATE PROCEDURE \`nuevo_procedimiento\` (\n    IN \`p_id\` INT\n)\nBEGIN\n    -- Escribe tus sentencias aquí\n    SELECT * FROM \`tabla\` WHERE \`id\` = p_id;\nEND;;\n\nDELIMITER ;\n`;
              setTabs(prev => [...prev, { id: newId, title: 'Nuevo Procedimiento', sql: ddl, result: null, isRunning: false, error: null, activeResultTab: 'grid' }]);
              setActiveTabId(newId);
            }}
            onCreateFunction={() => {
              const newId = 'tab_' + Date.now();
              const ddl = `DELIMITER ;;\n\nCREATE FUNCTION \`nueva_funcion\` (\n    \`p_num\` INT\n)\nRETURNS INT\nDETERMINISTIC\nBEGIN\n    RETURN p_num * 2;\nEND;;\n\nDELIMITER ;\n`;
              setTabs(prev => [...prev, { id: newId, title: 'Nueva Función', sql: ddl, result: null, isRunning: false, error: null, activeResultTab: 'grid' }]);
              setActiveTabId(newId);
            }}
            onCreateView={() => {
              const newId = 'tab_' + Date.now();
              const ddl = `CREATE OR REPLACE VIEW \`nueva_vista\` AS\nSELECT * FROM \`tabla\`;\n`;
              setTabs(prev => [...prev, { id: newId, title: 'Nueva Vista', sql: ddl, result: null, isRunning: false, error: null, activeResultTab: 'grid' }]);
              setActiveTabId(newId);
            }}
            onCreateTrigger={() => {
              const newId = 'tab_' + Date.now();
              const ddl = `DELIMITER ;;\n\nCREATE TRIGGER \`nuevo_trigger\`\nBEFORE INSERT ON \`tabla\`\nFOR EACH ROW\nBEGIN\n    -- SET NEW.fecha = NOW();\nEND;;\n\nDELIMITER ;\n`;
              setTabs(prev => [...prev, { id: newId, title: 'Nuevo Trigger', sql: ddl, result: null, isRunning: false, error: null, activeResultTab: 'grid' }]);
              setActiveTabId(newId);
            }}
            onCreateDatabase={() => setIsCreateDbModalOpen(true)}
          />
        </div>

        {/* Sidebar Resizer Splitter */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className={`w-1 cursor-col-resize hover:bg-emerald-500/80 transition-colors z-20 ${
            isDraggingSidebar ? 'bg-emerald-500' : 'bg-zinc-800'
          }`}
        />

        {/* Right: Main Editor & Results Area */}
        <div id="main-editor-split-container" className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
          
          {/* Query Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={(id) => setActiveTabId(id)}
            onAddTab={handleAddTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
          />

          {/* Top Half: Monaco SQL Editor */}
          <div style={{ height: `${editorHeightPercent}%` }} className="shrink-0 overflow-hidden">
            <SqlEditor
              sql={activeTab.sql}
              onChange={handleUpdateActiveSql}
              onExecute={handleExecute}
              isRunning={activeTab.isRunning}
              maxRows={maxRows}
              onChangeMaxRows={(val) => {
                setMaxRows(val);
                if (activeConfig) {
                  saveWorkspaceDebounced(activeConfig.id, tabs, activeTabId, val);
                }
              }}
              swapF9F5={swapF9F5}
              onToggleSwap={handleToggleSwapF9F5}
              schema={schemaObjects}
            />
          </div>

          {/* Horizontal Splitter between Editor and Results */}
          <div
            onMouseDown={handleEditorSplitMouseDown}
            className={`h-1 cursor-row-resize hover:bg-emerald-500/80 transition-colors z-20 ${
              isDraggingEditor ? 'bg-emerald-500' : 'bg-zinc-800'
            }`}
          />

          {/* Bottom Half: Output Panel (Grid / Messages / History) */}
          <div className="flex-1 overflow-hidden">
            <OutputPanel
              result={activeTab.result}
              isRunning={activeTab.isRunning}
              error={activeTab.error}
              activeTab={activeTab.activeResultTab}
              onSelectTab={handleUpdateActiveTabResultTab}
              history={history}
              onSelectHistorySql={(sql) => handleUpdateActiveSql(sql)}
              onClearHistory={() => setHistory([])}
            />
          </div>

        </div>

      </div>

      {/* Modals */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        onConnect={handleConnect}
        savedConnections={savedConnections}
        onRefreshConnections={loadSavedConnections}
        activeConfigId={activeConfig?.id}
      />

      <CreateDatabaseModal
        isOpen={isCreateDbModalOpen}
        onClose={() => setIsCreateDbModalOpen(false)}
        onCreateDatabase={handleCreateDatabase}
      />

      <TableDetailsModal
        tableName={selectedTableForDetails}
        onClose={() => setSelectedTableForDetails(null)}
      />

      <TableDesignerModal
        isOpen={isTableDesignerOpen}
        tableName={tableDesignerName}
        onClose={() => {
          setIsTableDesignerOpen(false);
          setTableDesignerName(null);
        }}
        onSuccess={(tbl) => {
          refreshSchema();
          handleUpdateActiveSql(`SELECT * FROM \`${tbl}\` LIMIT 100;`);
        }}
        onOpenInSqlEditor={(sql, title) => {
          const newId = 'tab_' + Date.now();
          setTabs(prev => [...prev, {
            id: newId,
            title: title || 'Diseñador SQL',
            sql,
            result: null,
            isRunning: false,
            error: null,
            activeResultTab: 'grid'
          }]);
          setActiveTabId(newId);
        }}
      />

      <DumpDatabaseModal
        isOpen={isDumpModalOpen}
        onClose={() => setIsDumpModalOpen(false)}
        databaseName={activeDatabase || activeConfig?.database || 'mariadb'}
        tables={schemaObjects?.tables || []}
      />

      <ImportDatabaseModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        databaseName={activeDatabase || activeConfig?.database || 'mariadb'}
        onSuccessRefresh={refreshSchema}
      />

    </div>
  );
};
