import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';
import { ConnectionConfig, SchemaObjects } from '../../types';
import {
  Search,
  Command,
  Terminal,
  FileText,
  Table as TableIcon,
  Eye,
  Cog,
  Zap,
  Hash,
  Clock,
  Database,
  Sliders,
  Activity,
  Users,
  GitCompare,
  Download,
  Upload,
  FolderPlus,
  Play,
  Check,
  Sun,
  Moon,
  Globe,
  Trash2,
  Layers,
  Sparkles,
  CornerDownLeft,
  X,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  activeConfig: ConnectionConfig | null;
  activeDatabase: string | null;
  databases?: string[];
  schemaObjects: SchemaObjects | null;
  onSelectDatabase: (dbName: string) => void;
  onSelectObjectSql: (sql: string, executeImmediately?: boolean) => void;
  onNewQuery: () => void;
  onExecuteActiveQuery?: () => void;
  onFormatSql?: () => void;
  onOpenConnectionModal: () => void;
  onDisconnect: () => void;
  onOpenCreateDbModal: () => void;
  onOpenTableDesigner: (tableName?: string) => void;
  onOpenDumpModal: () => void;
  onOpenImportModal: () => void;
  onOpenSchemaDiffModal: () => void;
  onOpenUserManagerModal: () => void;
  onOpenProcessViewerModal: () => void;
  onOpenServerVariablesModal: () => void;
  onClearHistory?: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category:
    | 'ACTION'
    | 'TABLE'
    | 'VIEW'
    | 'PROCEDURE'
    | 'FUNCTION'
    | 'TRIGGER'
    | 'EVENT'
    | 'DATABASE'
    | 'THEME'
    | 'LANGUAGE';
  icon: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  activeConfig,
  activeDatabase,
  databases = [],
  schemaObjects,
  onSelectDatabase,
  onSelectObjectSql,
  onNewQuery,
  onExecuteActiveQuery,
  onFormatSql,
  onOpenConnectionModal,
  onDisconnect,
  onOpenCreateDbModal,
  onOpenTableDesigner,
  onOpenDumpModal,
  onOpenImportModal,
  onOpenSchemaDiffModal,
  onOpenUserManagerModal,
  onOpenProcessViewerModal,
  onOpenServerVariablesModal,
  onClearHistory,
}) => {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { theme, setTheme, availableThemes } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus input and reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build items list
  const allItems = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];

    // --- ACCIONES GENERALES Y DEL SISTEMA ---
    list.push({
      id: 'act_new_query',
      title: 'Nueva pestaña de consulta SQL',
      subtitle: 'Abre un nuevo editor de código SQL',
      category: 'ACTION',
      icon: <Terminal className="w-4 h-4 text-emerald-400" />,
      shortcut: 'Ctrl+N',
      keywords: ['nueva', 'tab', 'pestaña', 'query', 'sql', 'editor'],
      action: () => onNewQuery(),
    });

    if (onFormatSql) {
      list.push({
        id: 'act_format_sql',
        title: 'Formatear código SQL',
        subtitle: 'Indenta y embellece la consulta activa con sql-formatter',
        category: 'ACTION',
        icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
        shortcut: 'Ctrl+Shift+F',
        keywords: ['formatear', 'format', 'embellecer', 'indentar', 'clean'],
        action: () => onFormatSql(),
      });
    }

    if (onExecuteActiveQuery) {
      list.push({
        id: 'act_execute_query',
        title: 'Ejecutar consulta activa',
        subtitle: 'Ejecuta la sentencia o selección en el servidor',
        category: 'ACTION',
        icon: <Play className="w-4 h-4 text-emerald-400" />,
        shortcut: 'F9 / Ctrl+Enter',
        keywords: ['ejecutar', 'run', 'execute', 'play', 'f9', 'f5'],
        action: () => onExecuteActiveQuery(),
      });
    }

    list.push({
      id: 'act_server_variables',
      title: 'Variables y Estado del Servidor',
      subtitle: 'Monitor en vivo de SHOW VARIABLES, SHOW STATUS y métricas de rendimiento',
      category: 'ACTION',
      icon: <Sliders className="w-4 h-4 text-cyan-400" />,
      keywords: ['variables', 'status', 'kpi', 'qps', 'uptime', 'buffer', 'innodb', 'set global'],
      action: () => onOpenServerVariablesModal(),
    });

    list.push({
      id: 'act_process_viewer',
      title: 'Visor de Procesos en Tiempo Real (Processlist)',
      subtitle: 'Monitorea hilos activos, consultas en ejecución y finaliza bloqueos',
      category: 'ACTION',
      icon: <Activity className="w-4 h-4 text-amber-400" />,
      keywords: ['procesos', 'processlist', 'hilos', 'threads', 'kill', 'bloqueos'],
      action: () => onOpenProcessViewerModal(),
    });

    list.push({
      id: 'act_user_manager',
      title: 'Administrador de Usuarios y Permisos',
      subtitle: 'Gestión de cuentas MySQL/MariaDB, contraseñas, roles y privilegios',
      category: 'ACTION',
      icon: <Users className="w-4 h-4 text-sky-400" />,
      keywords: ['usuarios', 'users', 'privilegios', 'permisos', 'passwords', 'roles', 'grant'],
      action: () => onOpenUserManagerModal(),
    });

    list.push({
      id: 'act_schema_diff',
      title: 'Comparador de Esquemas (Schema Diff)',
      subtitle: 'Compara estructuras entre dos bases de datos y genera script de migración',
      category: 'ACTION',
      icon: <GitCompare className="w-4 h-4 text-indigo-400" />,
      keywords: ['comparar', 'diff', 'esquemas', 'migracion', 'sync', 'syncronize'],
      action: () => onOpenSchemaDiffModal(),
    });

    list.push({
      id: 'act_dump_backup',
      title: 'Exportar Copia de Seguridad (Dump SQL)',
      subtitle: 'Genera un volcado completo de base de datos tipo mysqldump',
      category: 'ACTION',
      icon: <Download className="w-4 h-4 text-emerald-400" />,
      keywords: ['dump', 'backup', 'exportar', 'copia', 'respaldo', 'mysqldump'],
      action: () => onOpenDumpModal(),
    });

    list.push({
      id: 'act_import_sql',
      title: 'Restaurar / Importar archivo SQL',
      subtitle: 'Ejecuta scripts SQL de gran tamaño directamente en el motor',
      category: 'ACTION',
      icon: <Upload className="w-4 h-4 text-teal-400" />,
      keywords: ['importar', 'restore', 'restaurar', 'cargar', 'sql', 'script'],
      action: () => onOpenImportModal(),
    });

    list.push({
      id: 'act_create_table',
      title: 'Diseñador de Tablas (Crear nueva tabla)',
      subtitle: 'Editor visual de columnas, tipos de datos, índices y claves foráneas',
      category: 'ACTION',
      icon: <TableIcon className="w-4 h-4 text-emerald-400" />,
      keywords: ['crear tabla', 'table designer', 'diseñador', 'columnas', 'indices'],
      action: () => onOpenTableDesigner(),
    });

    list.push({
      id: 'act_create_db',
      title: 'Crear nueva Base de Datos',
      subtitle: 'Crea un esquema configurando charset y collation',
      category: 'ACTION',
      icon: <FolderPlus className="w-4 h-4 text-emerald-400" />,
      keywords: ['crear base', 'create database', 'nueva base', 'schema'],
      action: () => onOpenCreateDbModal(),
    });

    list.push({
      id: 'act_connection_modal',
      title: isConnected ? 'Cambiar de Conexión' : 'Conectar al Servidor',
      subtitle: 'Administra perfiles de conexión, puertos, credenciales y túneles SSH',
      category: 'ACTION',
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      keywords: ['conectar', 'conexion', 'server', 'servidor', 'ssh', 'host', 'port'],
      action: () => onOpenConnectionModal(),
    });

    if (isConnected) {
      list.push({
        id: 'act_disconnect',
        title: 'Desconectar servidor actual',
        subtitle: `Cierra la sesión activa con ${activeConfig?.name || 'servidor'}`,
        category: 'ACTION',
        icon: <X className="w-4 h-4 text-red-400" />,
        keywords: ['desconectar', 'disconnect', 'cerrar', 'salir'],
        action: () => onDisconnect(),
      });
    }

    if (onClearHistory) {
      list.push({
        id: 'act_clear_history',
        title: 'Limpiar Historial de Consultas',
        subtitle: 'Vacía el registro de consultas pasadas respetando las favoritas',
        category: 'ACTION',
        icon: <Trash2 className="w-4 h-4 text-red-400" />,
        keywords: ['limpiar', 'historial', 'history', 'borrar', 'vaciar'],
        action: () => onClearHistory(),
      });
    }

    // --- TEMAS VISUALES ---
    for (const th of availableThemes) {
      const isActive = theme === th.id;
      list.push({
        id: `theme_${th.id}`,
        title: `Tema: ${t(th.nameKey)}`,
        subtitle: isActive ? 'Tema activo actualmente' : 'Cambiar estilo visual de la aplicación',
        category: 'THEME',
        icon: (
          <span
            className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center shrink-0"
            style={{ backgroundColor: th.bgColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: th.accentColor }} />
          </span>
        ),
        keywords: ['tema', 'color', 'theme', 'estilo', th.id, t(th.nameKey)],
        action: () => setTheme(th.id),
      });
    }

    // --- IDIOMA ---
    for (const lang of availableLanguages) {
      list.push({
        id: `lang_${lang.code}`,
        title: `Idioma: ${lang.name} (${lang.flag})`,
        subtitle: language === lang.code ? 'Idioma activo' : 'Cambiar idioma de la interfaz',
        category: 'LANGUAGE',
        icon: <Globe className="w-4 h-4 text-emerald-400" />,
        keywords: ['idioma', 'language', 'lang', lang.name, lang.code],
        action: () => setLanguage(lang.code),
      });
    }

    // --- BASES DE DATOS DISPONIBLES ---
    if (isConnected && databases.length > 0) {
      for (const db of databases) {
        const isCurrent = db === activeDatabase;
        list.push({
          id: `db_${db}`,
          title: `Base de Datos: ${db}`,
          subtitle: isCurrent ? 'Base de datos activa' : `Cambiar contexto con USE \`${db}\`;`,
          category: 'DATABASE',
          icon: <Database className={`w-4 h-4 ${isCurrent ? 'text-emerald-400' : 'text-zinc-500'}`} />,
          keywords: ['database', 'base', 'use', db],
          action: () => onSelectDatabase(db),
        });
      }
    }

    // --- TABLAS Y OBJETOS DEL ESQUEMA ACTIVO ---
    if (isConnected && schemaObjects) {
      // Tablas
      if (schemaObjects.tables) {
        for (const tbl of schemaObjects.tables) {
          list.push({
            id: `tbl_${tbl}`,
            title: tbl,
            subtitle: `Consultar primeros 100 registros (SELECT * FROM \`${tbl}\`)`,
            category: 'TABLE',
            icon: <TableIcon className="w-4 h-4 text-emerald-400" />,
            keywords: ['tabla', 'table', tbl],
            action: () => onSelectObjectSql(`SELECT * FROM \`${tbl}\` LIMIT 100;`, true),
          });
        }
      }

      // Vistas
      if (schemaObjects.views) {
        for (const vw of schemaObjects.views) {
          list.push({
            id: `vw_${vw}`,
            title: vw,
            subtitle: `Consultar vista (SELECT * FROM \`${vw}\`)`,
            category: 'VIEW',
            icon: <Eye className="w-4 h-4 text-blue-400" />,
            keywords: ['vista', 'view', vw],
            action: () => onSelectObjectSql(`SELECT * FROM \`${vw}\` LIMIT 100;`, true),
          });
        }
      }

      // Procedimientos
      if (schemaObjects.procedures) {
        for (const proc of schemaObjects.procedures) {
          list.push({
            id: `proc_${proc.name}`,
            title: proc.name,
            subtitle: `Procedimiento almacenado (CALL \`${proc.name}\`())`,
            category: 'PROCEDURE',
            icon: <Cog className="w-4 h-4 text-amber-400" />,
            keywords: ['procedimiento', 'procedure', 'proc', proc.name],
            action: () => onSelectObjectSql(`CALL \`${proc.name}\`();`, false),
          });
        }
      }

      // Funciones
      if (schemaObjects.functions) {
        for (const fn of schemaObjects.functions) {
          list.push({
            id: `fn_${fn.name}`,
            title: fn.name,
            subtitle: `Función (SELECT \`${fn.name}\`())`,
            category: 'FUNCTION',
            icon: <Zap className="w-4 h-4 text-purple-400" />,
            keywords: ['funcion', 'function', fn.name],
            action: () => onSelectObjectSql(`SELECT \`${fn.name}\`();`, false),
          });
        }
      }
    }

    return list;
  }, [
    isConnected,
    activeConfig,
    activeDatabase,
    databases,
    schemaObjects,
    onNewQuery,
    onFormatSql,
    onExecuteActiveQuery,
    onOpenServerVariablesModal,
    onOpenProcessViewerModal,
    onOpenUserManagerModal,
    onOpenSchemaDiffModal,
    onOpenDumpModal,
    onOpenImportModal,
    onOpenTableDesigner,
    onOpenCreateDbModal,
    onOpenConnectionModal,
    onDisconnect,
    onClearHistory,
    availableThemes,
    theme,
    setTheme,
    t,
    availableLanguages,
    language,
    setLanguage,
    onSelectDatabase,
    onSelectObjectSql,
  ]);

  // Filter items based on user query and prefixes
  const filteredItems = useMemo(() => {
    let q = searchQuery.trim().toLowerCase();
    if (!q) {
      // Prioritize actions, themes, and some tables by default
      return allItems.slice(0, 50);
    }

    // Prefix filtering:
    // ">" for actions only
    if (q.startsWith('>')) {
      const sub = q.substring(1).trim();
      return allItems
        .filter((i) => i.category === 'ACTION' && (!sub || i.title.toLowerCase().includes(sub)))
        .slice(0, 40);
    }

    // "#" or "@" for database tables & objects only
    if (q.startsWith('#') || q.startsWith('@')) {
      const sub = q.substring(1).trim();
      return allItems
        .filter(
          (i) =>
            ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT'].includes(i.category) &&
            (!sub || i.title.toLowerCase().includes(sub))
        )
        .slice(0, 50);
    }

    // "db:" for databases
    if (q.startsWith('db:')) {
      const sub = q.substring(3).trim();
      return allItems
        .filter((i) => i.category === 'DATABASE' && (!sub || i.title.toLowerCase().includes(sub)))
        .slice(0, 30);
    }

    // "theme:" for themes
    if (q.startsWith('theme:')) {
      const sub = q.substring(6).trim();
      return allItems
        .filter((i) => i.category === 'THEME' && (!sub || i.title.toLowerCase().includes(sub)))
        .slice(0, 20);
    }

    // General search: matches title, subtitle, or keywords
    return allItems
      .filter((item) => {
        if (item.title.toLowerCase().includes(q)) return true;
        if (item.subtitle && item.subtitle.toLowerCase().includes(q)) return true;
        if (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(q))) return true;
        return false;
      })
      .slice(0, 50);
  }, [allItems, searchQuery]);

  // Adjust selectedIndex when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Keyboard navigation listener
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 bg-zinc-950/70 shrink-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Command className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder={t('commandPalette.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results list */}
        <div ref={listRef} className="flex-1 overflow-auto p-2 space-y-0.5 divide-y divide-zinc-800/20">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              <Search className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
              <p className="font-medium text-zinc-400">{t('commandPalette.noResults')}</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Prueba con otro término o usa &apos;&gt;&apos; para ver todos los comandos.
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected
                      ? 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 shadow-xs'
                      : 'text-zinc-300 hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected ? 'bg-zinc-700/60 text-zinc-100' : 'bg-zinc-950 text-zinc-400'
                      }`}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-sans">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 select-none">
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-950/80 border border-zinc-700/60 text-zinc-400">
                        {item.shortcut}
                      </kbd>
                    )}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase tracking-wider ${
                        item.category === 'TABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.category === 'VIEW'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : item.category === 'DATABASE'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : item.category === 'THEME'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {t(`commandPalette.cat${item.category.charAt(0) + item.category.slice(1).toLowerCase()}`) ||
                        item.category}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-500 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>{t('commandPalette.hintNavigate')}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[10px]">
                ↵
              </kbd>
              <span>{t('commandPalette.hintSelect')}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[10px]">
                ESC
              </kbd>
              <span>{t('commandPalette.hintClose')}</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-600">
            <span>Prefijos:</span>
            <span className="font-mono text-zinc-400">&gt; comandos</span>
            <span className="font-mono text-zinc-400"># tablas</span>
            <span className="font-mono text-zinc-400">db: bases</span>
          </div>
        </div>
      </div>
    </div>
  );
};
