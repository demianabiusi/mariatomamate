import React, { useState, useEffect, useMemo } from 'react';
import { TableDetails } from '../../types';
import { 
  Table, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Key, 
  Check, 
  Code2, 
  Sliders, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Play, 
  FileCode,
  Sparkles,
  RefreshCw,
  Edit3,
  Layers,
  Database,
  Search,
  LayoutGrid,
  List,
  Zap,
  Copy,
  Filter,
  Info,
  ChevronDown
} from 'lucide-react';
import { 
  MYSQL_DATA_TYPES, 
  TYPE_GROUPS, 
  getTypeCategory, 
  CATEGORY_THEMES,
  TypeCategory 
} from '../../utils/dataTypeUtils';
import { TypeBadge } from '../Common/TypeBadge';

export interface DesignerColumn {
  id: string;
  originalName?: string;
  name: string;
  type: string;
  length: string;
  isUnsigned: boolean;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  defaultValue: string;
  comment: string;
  isNew?: boolean;
}

interface TableDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string | null; // null => CREATE TABLE, string => ALTER TABLE
  onSuccess: (tableName: string) => void;
  onOpenInSqlEditor: (sql: string, title?: string) => void;
}

export const TableDesignerModal: React.FC<TableDesignerModalProps> = ({
  isOpen,
  onClose,
  tableName,
  onSuccess,
  onOpenInSqlEditor
}) => {
  const isEditMode = Boolean(tableName);

  const [currentTableName, setCurrentTableName] = useState<string>('nueva_tabla');
  const [engine, setEngine] = useState<string>('InnoDB');
  const [charset, setCharset] = useState<string>('utf8mb4');
  const [collation, setCollation] = useState<string>('utf8mb4_unicode_ci');
  const [tableComment, setTableComment] = useState<string>('');

  const [columns, setColumns] = useState<DesignerColumn[]>([]);
  const [deletedColumns, setDeletedColumns] = useState<DesignerColumn[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'designer' | 'sql'>('designer');
  
  // View mode: 'grid' (Cuadrícula Pro) or 'cards' (Fichas / Tarjetas)
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setExecutionError(null);
    setDeletedColumns([]);
    setActiveTab('designer');
    setSearchQuery('');
    setCategoryFilter('all');

    if (isEditMode && tableName) {
      setCurrentTableName(tableName);
      loadTableStructure(tableName);
    } else {
      const defaultTable = 'nueva_tabla';
      setCurrentTableName(defaultTable);
      setEngine('InnoDB');
      setCharset('utf8mb4');
      setCollation('utf8mb4_unicode_ci');
      setTableComment('');
      setColumns([
        {
          id: 'col_' + Date.now() + '_1',
          name: 'id',
          type: 'BIGINT',
          length: '',
          isUnsigned: true,
          isNullable: false,
          isPrimaryKey: true,
          isAutoIncrement: true,
          defaultValue: '',
          comment: 'Clave primaria autoincremental',
          isNew: true
        },
        {
          id: 'col_' + Date.now() + '_2',
          name: 'nombre',
          type: 'VARCHAR',
          length: '255',
          isUnsigned: false,
          isNullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          defaultValue: '',
          comment: '',
          isNew: true
        },
        {
          id: 'col_' + Date.now() + '_3',
          name: 'creado_el',
          type: 'DATETIME',
          length: '',
          isUnsigned: false,
          isNullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          defaultValue: 'CURRENT_TIMESTAMP',
          comment: 'Fecha y hora de creación del registro',
          isNew: true
        }
      ]);
    }
  }, [isOpen, tableName]);

  const loadTableStructure = async (tbl: string) => {
    setIsLoadingDetails(true);
    try {
      if (window.electronAPI?.getTableDetails) {
        const res = await window.electronAPI.getTableDetails(tbl);
        if (res.success && res.data) {
          const details: TableDetails = res.data;
          if (details.engine) setEngine(details.engine);

          const loadedCols: DesignerColumn[] = details.columns.map((c) => {
            let baseType = c.fieldType.toUpperCase();
            let lengthStr = '';
            let isUnsigned = false;

            if (baseType.includes('UNSIGNED')) {
              isUnsigned = true;
              baseType = baseType.replace('UNSIGNED', '').trim();
            }

            const parenMatch = baseType.match(/^([A-Z0-9_]+)\(([^)]+)\)$/);
            if (parenMatch) {
              baseType = parenMatch[1];
              lengthStr = parenMatch[2];
            }

            return {
              id: 'col_' + Math.random().toString(36).substring(2, 9),
              originalName: c.columnName,
              name: c.columnName,
              type: baseType,
              length: lengthStr,
              isUnsigned,
              isNullable: c.isNullable,
              isPrimaryKey: c.isPrimaryKey,
              isAutoIncrement: Boolean(c.isAutoIncrement || (c.extra && c.extra.toLowerCase().includes('auto_increment'))),
              defaultValue: c.defaultValue ?? '',
              comment: c.comment ?? '',
              isNew: false
            };
          });

          setColumns(loadedCols);
        }
      }
    } catch (err: any) {
      setExecutionError(err.message || 'Error al cargar estructura de tabla');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleAddColumn = () => {
    const newCol: DesignerColumn = {
      id: 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: `col_${columns.length + 1}`,
      type: 'VARCHAR',
      length: '255',
      isUnsigned: false,
      isNullable: true,
      isPrimaryKey: false,
      isAutoIncrement: false,
      defaultValue: '',
      comment: '',
      isNew: true
    };
    setColumns([...columns, newCol]);
  };

  const handleDuplicateColumn = (colToDuplicate: DesignerColumn) => {
    const newCol: DesignerColumn = {
      ...colToDuplicate,
      id: 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: `${colToDuplicate.name}_copia`,
      originalName: undefined,
      isPrimaryKey: false,
      isAutoIncrement: false,
      isNew: true
    };
    setColumns([...columns, newCol]);
  };

  const handleDeleteColumn = (id: string) => {
    const colToDelete = columns.find(c => c.id === id);
    if (colToDelete && !colToDelete.isNew) {
      setDeletedColumns([...deletedColumns, colToDelete]);
    }
    setColumns(columns.filter(c => c.id !== id));
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === columns.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newCols = [...columns];
    const temp = newCols[index];
    newCols[index] = newCols[targetIndex];
    newCols[targetIndex] = temp;
    setColumns(newCols);
  };

  const handleUpdateColumn = (id: string, field: keyof DesignerColumn, value: any) => {
    setColumns(columns.map(col => {
      if (col.id === id) {
        const updated = { ...col, [field]: value };
        if (field === 'type') {
          const typeMeta = MYSQL_DATA_TYPES.find(t => t.value === value);
          if (typeMeta?.hasLength && !updated.length) {
            updated.length = typeMeta.defaultLength || '';
          }
          if (!typeMeta?.canUnsigned) {
            updated.isUnsigned = false;
          }
        }
        return updated;
      }
      return col;
    }));
  };

  // Filtered columns for search & category filters
  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        col.name.toLowerCase().includes(q) || 
        col.type.toLowerCase().includes(q) ||
        (col.comment && col.comment.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'pk') return col.isPrimaryKey;
      if (categoryFilter === 'ai') return col.isAutoIncrement;
      const cat = getTypeCategory(col.type);
      return cat === categoryFilter;
    });
  }, [columns, searchQuery, categoryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const pkCount = columns.filter(c => c.isPrimaryKey).length;
    const aiCount = columns.filter(c => c.isAutoIncrement).length;
    const notNullCount = columns.filter(c => !c.isNullable).length;
    return { pkCount, aiCount, notNullCount };
  }, [columns]);

  // Generate CREATE TABLE or ALTER TABLE SQL
  const generatedSql = useMemo(() => {
    const safeTable = currentTableName.trim().replace(/`/g, '') || 'nueva_tabla';

    if (!isEditMode) {
      // 1. CREATE TABLE
      const lines: string[] = [];
      const primaryKeys: string[] = [];

      columns.forEach(col => {
        const safeCol = col.name.trim().replace(/`/g, '');
        if (!safeCol) return;

        let colDef = `\`${safeCol}\` ${col.type}`;
        if (col.length && col.length.trim()) {
          colDef += `(${col.length.trim()})`;
        }
        if (col.isUnsigned) {
          colDef += ' UNSIGNED';
        }
        if (!col.isNullable) {
          colDef += ' NOT NULL';
        } else {
          colDef += ' NULL';
        }
        if (col.isAutoIncrement) {
          colDef += ' AUTO_INCREMENT';
        }
        if (col.defaultValue && col.defaultValue.trim()) {
          const defUpper = col.defaultValue.trim().toUpperCase();
          if (defUpper === 'NULL' || defUpper === 'CURRENT_TIMESTAMP' || defUpper === 'NOW()') {
            colDef += ` DEFAULT ${defUpper}`;
          } else {
            colDef += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
          }
        }
        if (col.comment && col.comment.trim()) {
          colDef += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
        }

        lines.push(`    ${colDef}`);

        if (col.isPrimaryKey) {
          primaryKeys.push(`\`${safeCol}\``);
        }
      });

      if (primaryKeys.length > 0) {
        lines.push(`    PRIMARY KEY (${primaryKeys.join(', ')})`);
      }

      let ddl = `CREATE TABLE \`${safeTable}\` (\n`;
      ddl += lines.join(',\n');
      ddl += `\n) ENGINE=${engine} DEFAULT CHARSET=${charset} COLLATE=${collation}`;
      if (tableComment.trim()) {
        ddl += ` COMMENT='${tableComment.replace(/'/g, "\\'")}'`;
      }
      ddl += ';';

      return ddl;
    } else {
      // 2. ALTER TABLE
      const alterStatements: string[] = [];

      // Deleted columns
      deletedColumns.forEach(delCol => {
        if (delCol.originalName) {
          alterStatements.push(`ALTER TABLE \`${safeTable}\` DROP COLUMN \`${delCol.originalName}\`;`);
        }
      });

      // Added or Modified columns
      columns.forEach(col => {
        const safeCol = col.name.trim().replace(/`/g, '');
        if (!safeCol) return;

        let colDef = `${col.type}`;
        if (col.length && col.length.trim()) colDef += `(${col.length.trim()})`;
        if (col.isUnsigned) colDef += ' UNSIGNED';
        colDef += col.isNullable ? ' NULL' : ' NOT NULL';
        if (col.isAutoIncrement) colDef += ' AUTO_INCREMENT';
        if (col.defaultValue && col.defaultValue.trim()) {
          const defUpper = col.defaultValue.trim().toUpperCase();
          if (defUpper === 'NULL' || defUpper === 'CURRENT_TIMESTAMP') {
            colDef += ` DEFAULT ${defUpper}`;
          } else {
            colDef += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
          }
        }
        if (col.comment && col.comment.trim()) {
          colDef += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
        }

        if (col.isNew) {
          alterStatements.push(`ALTER TABLE \`${safeTable}\` ADD COLUMN \`${safeCol}\` ${colDef};`);
        } else if (col.originalName && col.originalName !== safeCol) {
          alterStatements.push(`ALTER TABLE \`${safeTable}\` CHANGE COLUMN \`${col.originalName}\` \`${safeCol}\` ${colDef};`);
        } else {
          alterStatements.push(`ALTER TABLE \`${safeTable}\` MODIFY COLUMN \`${safeCol}\` ${colDef};`);
        }
      });

      return alterStatements.join('\n\n');
    }
  }, [currentTableName, isEditMode, columns, deletedColumns, engine, charset, collation, tableComment]);

  const handleExecute = async () => {
    if (!generatedSql.trim()) return;

    setIsExecuting(true);
    setExecutionError(null);

    try {
      if (window.electronAPI?.executeScript) {
        const res = await window.electronAPI.executeScript(generatedSql);
        if (res.success) {
          onSuccess(currentTableName.trim().replace(/`/g, ''));
          onClose();
        } else {
          setExecutionError(res.error || 'Error al ejecutar sentencias DDL');
        }
      }
    } catch (err: any) {
      setExecutionError(err.message || 'Error inesperado durante la ejecución');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleOpenInEditor = () => {
    onOpenInSqlEditor(generatedSql, `DDL_${currentTableName}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6 select-none animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100 font-mono">
                  {isEditMode ? `Modificar Tabla: ${tableName}` : 'Diseñador Visual de Tabla'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-zinc-800 text-emerald-400 border border-zinc-700">
                  {engine}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {isEditMode 
                  ? 'Añade, renombra o reordena columnas con vista en tiempo real' 
                  : 'Define campos, tipos semánticos, claves primarias y opciones avanzadas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Tabla:</span>
              <input
                type="text"
                disabled={isEditMode}
                value={currentTableName}
                onChange={(e) => setCurrentTableName(e.target.value)}
                placeholder="nombre_tabla"
                className="bg-zinc-900 border border-zinc-700 focus:border-emerald-500 rounded px-2.5 py-1 text-xs text-zinc-100 font-mono font-bold focus:outline-none w-44"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Motor:</span>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="InnoDB">InnoDB (Transacciones / FKs)</option>
                <option value="MyISAM">MyISAM</option>
                <option value="MEMORY">MEMORY</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab & Toolbar Bar */}
        <div className="flex flex-wrap items-center justify-between bg-zinc-950/80 px-6 py-2 border-b border-zinc-800 gap-3 text-xs">
          
          {/* Main Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('designer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'designer'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Diseñador de Columnas</span>
              <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded font-mono text-[10px]">
                {columns.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'sql'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Vista Previa SQL</span>
            </button>
          </div>

          {/* Designer Controls: Search, Category Filters & View Mode */}
          {activeTab === 'designer' && (
            <div className="flex items-center gap-3 flex-wrap">
              
              {/* Quick KPI stats */}
              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-zinc-900/80 border border-zinc-800 rounded-lg text-[11px] text-zinc-400 font-mono">
                <span className="flex items-center gap-1 text-amber-300 font-bold">
                  <Key className="w-3 h-3" /> {stats.pkCount} PK
                </span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                  <Zap className="w-3 h-3" /> {stats.aiCount} AI
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-emerald-400 font-semibold">
                  {stats.notNullCount} NOT NULL
                </span>
              </div>

              {/* Live search input */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar campo o tipo..."
                  className="bg-zinc-900 border border-zinc-700/80 focus:border-emerald-500 rounded-lg pl-8 pr-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none w-44"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Dropdown */}
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Todas las categorías</option>
                  <option value="pk">🔑 Claves Primarias</option>
                  <option value="ai">⚡ Autoincrementales</option>
                  <option value="numeric">🔵 Numéricos</option>
                  <option value="text">🟢 Texto / Cadenas</option>
                  <option value="datetime">🟠 Fechas / Horas</option>
                  <option value="json">🟣 JSON</option>
                </select>
              </div>

              {/* View Mode Toggle: Grid Pro vs Cards */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Vista Cuadrícula Pro: Tabla tabular de alta densidad y visualización organizada"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cuadrícula</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Vista Fichas / Tarjetas: Desglose en tarjetas espaciosas para máxima legibilidad"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tarjetas</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-auto p-4 md:p-5 bg-zinc-900/60">
          
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
              <span className="text-xs font-mono">Cargando definición y metadatos de la tabla...</span>
            </div>
          ) : activeTab === 'designer' ? (
            <div className="space-y-4">
              
              {/* Filter alert if no results */}
              {filteredColumns.length === 0 && (
                <div className="py-12 text-center text-zinc-400 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2">
                  <Search className="w-6 h-6 mx-auto text-zinc-600" />
                  <p className="text-xs">No se encontraron columnas que coincidan con el filtro aplicado.</p>
                  <button
                    onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    Restablecer filtros de búsqueda
                  </button>
                </div>
              )}

              {/* VIEW MODE 1: ENHANCED GRID PRO */}
              {viewMode === 'grid' && filteredColumns.length > 0 && (
                <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950 shadow-md">
                  <table className="w-full text-left border-collapse text-xs min-w-[960px]">
                    <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold select-none sticky top-0 z-20">
                      <tr>
                        <th className="w-10 px-2 py-2.5 text-center font-mono">#</th>
                        <th className="px-3 py-2.5 min-w-[210px] w-64">
                          <span className="text-zinc-200">Nombre del Campo</span>
                        </th>
                        <th className="px-3 py-2.5 min-w-[240px] w-72">
                          <span className="text-zinc-200">Tipo de Dato</span>
                        </th>
                        <th className="px-2 py-2.5 w-24 text-center">Longitud / Enum</th>
                        <th className="px-2 py-2.5 text-center w-16" title="Clave Primaria">PK</th>
                        <th className="px-2 py-2.5 text-center w-16" title="Autoincremento">AI</th>
                        <th className="px-2 py-2.5 text-center w-24" title="Permite NULL / NOT NULL">Nulabilidad</th>
                        <th className="px-2 py-2.5 text-center w-20" title="Sin signo (Unsigned)">Signo</th>
                        <th className="px-3 py-2.5 w-36">Predeterminado</th>
                        <th className="px-3 py-2.5">Comentario</th>
                        <th className="w-24 px-2 py-2.5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/90 text-zinc-300">
                      {filteredColumns.map((col) => {
                        const originalIndex = columns.findIndex(c => c.id === col.id);
                        const typeMeta = MYSQL_DATA_TYPES.find(t => t.value === col.type);

                        return (
                          <tr 
                            key={col.id} 
                            className={`transition-colors group ${
                              col.isPrimaryKey 
                                ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08] border-l-4 border-l-amber-400' 
                                : col.isNew 
                                  ? 'bg-emerald-500/[0.02] hover:bg-zinc-900/60 border-l-4 border-l-emerald-400' 
                                  : 'hover:bg-zinc-900/50 border-l-4 border-l-transparent'
                            }`}
                          >
                            {/* Position Number */}
                            <td className="px-2 py-2 text-center text-zinc-500 font-mono text-[11px]">
                              {originalIndex + 1}
                            </td>

                            {/* Column Name Input */}
                            <td className="px-3 py-2">
                              <div className="relative flex items-center">
                                <div className="absolute left-2.5 flex items-center gap-1 pointer-events-none z-10">
                                  {col.isPrimaryKey ? (
                                    <span title="Clave Primaria (PK)">
                                      <Key className="w-3.5 h-3.5 text-amber-400" />
                                    </span>
                                  ) : col.isAutoIncrement ? (
                                    <span title="Autoincremental (AI)">
                                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600 font-mono text-[11px]">#</span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={col.name}
                                  onChange={(e) => handleUpdateColumn(col.id, 'name', e.target.value)}
                                  placeholder="nombre_columna"
                                  className={`w-full bg-zinc-950 border rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold transition-all focus:outline-none ${
                                    col.isPrimaryKey
                                      ? 'text-amber-200 border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-500/20'
                                      : 'text-zinc-100 border-zinc-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                                  }`}
                                />
                              </div>
                              {col.originalName && col.originalName !== col.name && (
                                <div className="text-[10px] text-amber-400/90 font-mono mt-0.5 px-1 truncate">
                                  Anterior: {col.originalName}
                                </div>
                              )}
                            </td>

                            {/* Data Type Selector with TypeBadge */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 w-full">
                                <TypeBadge typeStr={col.type} size="xs" showLength={false} className="shrink-0" />
                                <select
                                  value={col.type}
                                  onChange={(e) => handleUpdateColumn(col.id, 'type', e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono font-medium focus:outline-none"
                                >
                                  {TYPE_GROUPS.map(group => (
                                    <optgroup key={group.key} label={`── ${group.label} ──`} className="bg-zinc-900 text-zinc-400 font-sans font-semibold">
                                      {group.types.map(tVal => {
                                        const meta = MYSQL_DATA_TYPES.find(m => m.value === tVal);
                                        return (
                                          <option key={tVal} value={tVal} className="bg-zinc-950 text-zinc-200 font-mono font-normal">
                                            {tVal} {meta?.hint ? `(${meta.hint})` : ''}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                            </td>

                            {/* Length / Precision */}
                            <td className="px-2 py-2 text-center">
                              {typeMeta?.hasLength ? (
                                <input
                                  type="text"
                                  value={col.length}
                                  onChange={(e) => handleUpdateColumn(col.id, 'length', e.target.value)}
                                  placeholder={typeMeta?.defaultLength || '100'}
                                  className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono text-center focus:outline-none"
                                />
                              ) : (
                                <div className="w-full py-1.5 text-center text-zinc-600 font-mono text-xs select-none" title="Este tipo no requiere longitud">
                                  —
                                </div>
                              )}
                            </td>

                            {/* PK Interactive Toggle Badge */}
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const isPk = !col.isPrimaryKey;
                                  handleUpdateColumn(col.id, 'isPrimaryKey', isPk);
                                  if (isPk) {
                                    handleUpdateColumn(col.id, 'isNullable', false);
                                  }
                                }}
                                className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
                                  col.isPrimaryKey
                                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-xs shadow-amber-500/20'
                                    : 'bg-zinc-900/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                                }`}
                                title={col.isPrimaryKey ? 'Clave Primaria ACTIVA (Clic para quitar)' : 'Marcar como Clave Primaria (PK)'}
                              >
                                <Key className="w-3 h-3" />
                                <span>PK</span>
                              </button>
                            </td>

                            {/* AI Interactive Toggle Badge */}
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                disabled={!typeMeta?.canUnsigned && col.type !== 'INT' && col.type !== 'BIGINT' && col.type !== 'SMALLINT' && col.type !== 'TINYINT' && col.type !== 'MEDIUMINT'}
                                onClick={() => {
                                  const isAi = !col.isAutoIncrement;
                                  handleUpdateColumn(col.id, 'isAutoIncrement', isAi);
                                  if (isAi) {
                                    handleUpdateColumn(col.id, 'isPrimaryKey', true);
                                    handleUpdateColumn(col.id, 'isNullable', false);
                                  }
                                }}
                                className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all disabled:opacity-20 disabled:pointer-events-none ${
                                  col.isAutoIncrement
                                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-xs shadow-cyan-500/20'
                                    : 'bg-zinc-900/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                                }`}
                                title={col.isAutoIncrement ? 'Autoincremental ACTIVO (Clic para quitar)' : 'Marcar como AUTO_INCREMENT'}
                              >
                                <Zap className="w-3 h-3" />
                                <span>AI</span>
                              </button>
                            </td>

                            {/* Nullable Interactive Toggle Badge */}
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                disabled={col.isPrimaryKey}
                                onClick={() => handleUpdateColumn(col.id, 'isNullable', !col.isNullable)}
                                className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[11px] font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                  col.isNullable
                                    ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
                                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold'
                                }`}
                                title={col.isNullable ? 'Permite valores NULL (Clic para hacer NOT NULL)' : 'Obligatorio NOT NULL (Clic para permitir NULL)'}
                              >
                                {col.isNullable ? 'NULL' : 'NOT NULL'}
                              </button>
                            </td>

                            {/* Unsigned Interactive Toggle Badge */}
                            <td className="px-2 py-2 text-center">
                              {typeMeta?.canUnsigned ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateColumn(col.id, 'isUnsigned', !col.isUnsigned)}
                                  className={`inline-flex items-center justify-center px-1.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all ${
                                    col.isUnsigned
                                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50 font-bold'
                                      : 'bg-zinc-900/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                                  }`}
                                  title={col.isUnsigned ? 'Sin signo (solo números >= 0)' : 'Con signo estándar'}
                                >
                                  {col.isUnsigned ? 'UNSIGNED' : 'SIGNED'}
                                </button>
                              ) : (
                                <span className="text-zinc-600 font-mono text-xs select-none">—</span>
                              )}
                            </td>

                            {/* Default Value Input */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={col.defaultValue}
                                onChange={(e) => handleUpdateColumn(col.id, 'defaultValue', e.target.value)}
                                placeholder="NULL"
                                className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none"
                              />
                            </td>

                            {/* Comment Input */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={col.comment}
                                onChange={(e) => handleUpdateColumn(col.id, 'comment', e.target.value)}
                                placeholder="Descripción opcional..."
                                className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none placeholder:text-zinc-600"
                              />
                            </td>

                            {/* Actions Column */}
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveColumn(originalIndex, 'up')}
                                  disabled={originalIndex === 0}
                                  className="p-1 hover:text-emerald-400 text-zinc-500 disabled:opacity-20 rounded hover:bg-zinc-800 transition-colors"
                                  title="Subir columna"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveColumn(originalIndex, 'down')}
                                  disabled={originalIndex === columns.length - 1}
                                  className="p-1 hover:text-emerald-400 text-zinc-500 disabled:opacity-20 rounded hover:bg-zinc-800 transition-colors"
                                  title="Bajar columna"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateColumn(col)}
                                  className="p-1 hover:text-sky-400 text-zinc-500 rounded hover:bg-zinc-800 transition-colors"
                                  title="Duplicar columna"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteColumn(col.id)}
                                  className="p-1 hover:text-red-400 text-zinc-500 rounded hover:bg-zinc-800 transition-colors"
                                  title="Eliminar columna"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW MODE 2: CARD / EXPANDED INSPECTOR VIEW */}
              {viewMode === 'cards' && filteredColumns.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredColumns.map((col) => {
                    const originalIndex = columns.findIndex(c => c.id === col.id);
                    const typeMeta = MYSQL_DATA_TYPES.find(t => t.value === col.type);

                    return (
                      <div 
                        key={col.id} 
                        className={`bg-zinc-950 border rounded-xl p-4 shadow-sm transition-all ${
                          col.isPrimaryKey
                            ? 'border-amber-500/50 bg-amber-500/[0.04] ring-1 ring-amber-500/20'
                            : col.isNew
                              ? 'border-emerald-500/50 bg-emerald-500/[0.02]'
                              : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Card Header: Position, Name, PK/AI tags, Actions */}
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3 gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono text-[11px] font-bold border border-zinc-800 shrink-0">
                              #{originalIndex + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={col.name}
                                onChange={(e) => handleUpdateColumn(col.id, 'name', e.target.value)}
                                placeholder="nombre_columna"
                                className={`w-full bg-zinc-900 border rounded-lg px-2.5 py-1 text-sm font-mono font-bold focus:outline-none ${
                                  col.isPrimaryKey 
                                    ? 'text-amber-200 border-amber-500/40 focus:border-amber-400' 
                                    : 'text-zinc-100 border-zinc-700/80 focus:border-emerald-500'
                                }`}
                              />
                            </div>
                            {col.isPrimaryKey && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 shrink-0 font-mono">
                                <Key className="w-3 h-3" /> PK
                              </span>
                            )}
                            {col.isAutoIncrement && (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 shrink-0 font-mono">
                                <Zap className="w-3 h-3" /> AI
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveColumn(originalIndex, 'up')}
                              disabled={originalIndex === 0}
                              className="p-1.5 hover:text-emerald-400 text-zinc-500 disabled:opacity-20 rounded hover:bg-zinc-900"
                              title="Subir"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveColumn(originalIndex, 'down')}
                              disabled={originalIndex === columns.length - 1}
                              className="p-1.5 hover:text-emerald-400 text-zinc-500 disabled:opacity-20 rounded hover:bg-zinc-900"
                              title="Bajar"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateColumn(col)}
                              className="p-1.5 hover:text-sky-400 text-zinc-500 rounded hover:bg-zinc-900"
                              title="Duplicar"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteColumn(col.id)}
                              className="p-1.5 hover:text-red-400 text-zinc-500 rounded hover:bg-zinc-900"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card Body: Row 1 - Type & Length */}
                        <div className="grid grid-cols-3 gap-2.5 mb-3">
                          <div className="col-span-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                              Tipo de Dato
                            </label>
                            <div className="flex items-center gap-1.5">
                              <TypeBadge typeStr={col.type} size="sm" showLength={false} className="shrink-0" />
                              <select
                                value={col.type}
                                onChange={(e) => handleUpdateColumn(col.id, 'type', e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono font-medium focus:border-emerald-500"
                              >
                                {TYPE_GROUPS.map(group => (
                                  <optgroup key={group.key} label={`── ${group.label} ──`} className="bg-zinc-900 text-zinc-400 font-sans font-semibold">
                                    {group.types.map(tVal => (
                                      <option key={tVal} value={tVal} className="bg-zinc-950 text-zinc-200 font-mono">
                                        {tVal}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                              Longitud / Args
                            </label>
                            {typeMeta?.hasLength ? (
                              <input
                                type="text"
                                value={col.length}
                                onChange={(e) => handleUpdateColumn(col.id, 'length', e.target.value)}
                                placeholder={typeMeta?.defaultLength || '100'}
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono text-center focus:border-emerald-500"
                              />
                            ) : (
                              <div className="w-full py-1.5 text-center text-zinc-600 font-mono text-xs select-none bg-zinc-900/40 rounded-lg border border-zinc-800">
                                —
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Body: Row 2 - Interactive Attribute Badges */}
                        <div className="flex items-center gap-2 mb-3 py-1.5 px-2 bg-zinc-900/60 rounded-lg border border-zinc-800/80 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 mr-1">Atributos:</span>
                          
                          {/* PK button */}
                          <button
                            type="button"
                            onClick={() => {
                              const isPk = !col.isPrimaryKey;
                              handleUpdateColumn(col.id, 'isPrimaryKey', isPk);
                              if (isPk) handleUpdateColumn(col.id, 'isNullable', false);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all ${
                              col.isPrimaryKey
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                            }`}
                          >
                            <Key className="w-3 h-3" /> PK
                          </button>

                          {/* AI button */}
                          <button
                            type="button"
                            disabled={!typeMeta?.canUnsigned && col.type !== 'INT' && col.type !== 'BIGINT'}
                            onClick={() => {
                              const isAi = !col.isAutoIncrement;
                              handleUpdateColumn(col.id, 'isAutoIncrement', isAi);
                              if (isAi) {
                                handleUpdateColumn(col.id, 'isPrimaryKey', true);
                                handleUpdateColumn(col.id, 'isNullable', false);
                              }
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all disabled:opacity-20 ${
                              col.isAutoIncrement
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                            }`}
                          >
                            <Zap className="w-3 h-3" /> AI
                          </button>

                          {/* Nullable button */}
                          <button
                            type="button"
                            disabled={col.isPrimaryKey}
                            onClick={() => handleUpdateColumn(col.id, 'isNullable', !col.isNullable)}
                            className={`px-2 py-1 rounded text-[11px] font-mono transition-all disabled:opacity-40 ${
                              col.isNullable
                                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold'
                            }`}
                          >
                            {col.isNullable ? 'NULL' : 'NOT NULL'}
                          </button>

                          {/* Unsigned button */}
                          {typeMeta?.canUnsigned && (
                            <button
                              type="button"
                              onClick={() => handleUpdateColumn(col.id, 'isUnsigned', !col.isUnsigned)}
                              className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                                col.isUnsigned
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 font-bold'
                                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                              }`}
                            >
                              {col.isUnsigned ? 'UNSIGNED' : 'SIGNED'}
                            </button>
                          )}
                        </div>

                        {/* Card Body: Row 3 - Default & Comment */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                              Predeterminado
                            </label>
                            <input
                              type="text"
                              value={col.defaultValue}
                              onChange={(e) => handleUpdateColumn(col.id, 'defaultValue', e.target.value)}
                              placeholder="NULL"
                              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-zinc-100 font-mono focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                              Comentario
                            </label>
                            <input
                              type="text"
                              value={col.comment}
                              onChange={(e) => handleUpdateColumn(col.id, 'comment', e.target.value)}
                              placeholder="Descripción..."
                              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:border-emerald-500 placeholder:text-zinc-600"
                            />
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add column button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 hover:text-emerald-200 font-semibold rounded-xl text-xs border border-emerald-500/30 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Columna</span>
                </button>

                <span className="text-xs text-zinc-500 font-mono">
                  {columns.length} columna(s) en total en la definición
                </span>
              </div>

            </div>
          ) : (
            /* TAB 2: SQL Preview */
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Sentencias SQL DDL generadas para MariaDB / MySQL:</span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {isEditMode ? 'Sentencias ALTER TABLE' : 'Sentencia CREATE TABLE'}
                </span>
              </div>
              <pre className="flex-1 p-5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-emerald-300 overflow-auto whitespace-pre-wrap select-text leading-relaxed shadow-inner">
                {generatedSql}
              </pre>
            </div>
          )}

          {/* Error Banner */}
          {executionError && (
            <div className="mt-4 p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{executionError}</span>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium border border-zinc-700 transition-colors"
            title="Abrir sentencia en pestaña SQL para revisar antes de ejecutar"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span>Abrir en Editor SQL</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isExecuting || columns.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isExecuting ? 'Ejecutando...' : (isEditMode ? 'Aplicar Cambios' : 'Crear Tabla')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
