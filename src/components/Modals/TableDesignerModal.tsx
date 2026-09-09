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
  Database
} from 'lucide-react';

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

const MYSQL_DATA_TYPES = [
  { value: 'INT', label: 'INT (Entero estándar 32-bit)', hasLength: false, canUnsigned: true },
  { value: 'BIGINT', label: 'BIGINT (Entero 64-bit grande)', hasLength: false, canUnsigned: true },
  { value: 'TINYINT', label: 'TINYINT (Entero 8-bit / Booleano)', hasLength: false, canUnsigned: true },
  { value: 'SMALLINT', label: 'SMALLINT (Entero 16-bit)', hasLength: false, canUnsigned: true },
  { value: 'VARCHAR', label: 'VARCHAR(n) (Texto variable)', hasLength: true, defaultLength: '255', canUnsigned: false },
  { value: 'CHAR', label: 'CHAR(n) (Texto fijo)', hasLength: true, defaultLength: '1', canUnsigned: false },
  { value: 'TEXT', label: 'TEXT (Hasta 64 KB)', hasLength: false, canUnsigned: false },
  { value: 'MEDIUMTEXT', label: 'MEDIUMTEXT (Hasta 16 MB)', hasLength: false, canUnsigned: false },
  { value: 'LONGTEXT', label: 'LONGTEXT (Hasta 4 GB)', hasLength: false, canUnsigned: false },
  { value: 'DECIMAL', label: 'DECIMAL(m, d) (Moneda / Precisión exacta)', hasLength: true, defaultLength: '10,2', canUnsigned: true },
  { value: 'DOUBLE', label: 'DOUBLE (Punto flotante doble)', hasLength: false, canUnsigned: true },
  { value: 'FLOAT', label: 'FLOAT (Punto flotante simple)', hasLength: false, canUnsigned: true },
  { value: 'DATETIME', label: 'DATETIME (Fecha y hora YYYY-MM-DD HH:MM:SS)', hasLength: false, canUnsigned: false },
  { value: 'TIMESTAMP', label: 'TIMESTAMP (Marca de tiempo UTC)', hasLength: false, canUnsigned: false },
  { value: 'DATE', label: 'DATE (Fecha YYYY-MM-DD)', hasLength: false, canUnsigned: false },
  { value: 'TIME', label: 'TIME (Hora HH:MM:SS)', hasLength: false, canUnsigned: false },
  { value: 'JSON', label: 'JSON (Documentos estructurados)', hasLength: false, canUnsigned: false },
  { value: 'BLOB', label: 'BLOB (Archivos binarios)', hasLength: false, canUnsigned: false },
  { value: 'ENUM', label: 'ENUM(\'a\',\'b\')', hasLength: true, defaultLength: "'A','B'", canUnsigned: false }
];

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
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setExecutionError(null);
    setDeletedColumns([]);
    setActiveTab('designer');

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
          comment: '',
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
          comment: '',
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

            const parenMatch = baseType.match(/^([A-Z]+)\(([^)]+)\)$/);
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
              isAutoIncrement: c.isAutoIncrement,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {isEditMode ? `Modificar Tabla: ${tableName}` : 'Diseñador Visual de Tabla'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEditMode ? 'Añade, renombra o modifica columnas' : 'Crea una nueva tabla para MariaDB / MySQL con opciones completas'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between bg-zinc-950/70 px-6 border-b border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('designer')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
                activeTab === 'designer'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Diseñador de Columnas ({columns.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-colors ${
                activeTab === 'sql'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Vista Previa SQL</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Tabla:</span>
              <input
                type="text"
                disabled={isEditMode}
                value={currentTableName}
                onChange={(e) => setCurrentTableName(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none w-44"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Motor:</span>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="InnoDB">InnoDB (Transaccional / FKs)</option>
                <option value="MyISAM">MyISAM</option>
                <option value="MEMORY">MEMORY</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-5 bg-zinc-900/60">
          
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Cargando definición de la tabla...</span>
            </div>
          ) : activeTab === 'designer' ? (
            <div className="space-y-4">
              
              {/* Columns Table */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium select-none">
                    <tr>
                      <th className="w-10 px-2 py-2 text-center">#</th>
                      <th className="px-3 py-2">Nombre Campo</th>
                      <th className="px-3 py-2">Tipo de Dato</th>
                      <th className="px-3 py-2 w-28">Longitud / Enum</th>
                      <th className="px-2 py-2 text-center w-16" title="Unsigned (sin signo)">Unsigned</th>
                      <th className="px-2 py-2 text-center w-14" title="Permite NULL">Null</th>
                      <th className="px-2 py-2 text-center w-14" title="Clave Primaria">PK</th>
                      <th className="px-2 py-2 text-center w-14" title="Autoincremento">AI</th>
                      <th className="px-3 py-2 w-36">Predeterminado</th>
                      <th className="px-3 py-2">Comentario</th>
                      <th className="w-20 px-2 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-300">
                    {columns.map((col, idx) => {
                      const typeMeta = MYSQL_DATA_TYPES.find(t => t.value === col.type);

                      return (
                        <tr key={col.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="px-2 py-1.5 text-center text-zinc-600 font-mono">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => handleUpdateColumn(col.id, 'name', e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={col.type}
                              onChange={(e) => handleUpdateColumn(col.id, 'type', e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                            >
                              {MYSQL_DATA_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              disabled={!typeMeta?.hasLength}
                              value={col.length}
                              onChange={(e) => handleUpdateColumn(col.id, 'length', e.target.value)}
                              placeholder={typeMeta?.hasLength ? (typeMeta.defaultLength || '100') : '-'}
                              className="w-full bg-zinc-900 disabled:bg-zinc-950 disabled:text-zinc-600 border border-zinc-800 focus:border-emerald-500 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              disabled={!typeMeta?.canUnsigned}
                              checked={col.isUnsigned}
                              onChange={(e) => handleUpdateColumn(col.id, 'isUnsigned', e.target.checked)}
                              className="rounded bg-zinc-900 border-zinc-800 text-emerald-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={col.isNullable}
                              onChange={(e) => handleUpdateColumn(col.id, 'isNullable', e.target.checked)}
                              className="rounded bg-zinc-900 border-zinc-800 text-emerald-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={col.isPrimaryKey}
                              onChange={(e) => {
                                const isPk = e.target.checked;
                                handleUpdateColumn(col.id, 'isPrimaryKey', isPk);
                                if (isPk) {
                                  handleUpdateColumn(col.id, 'isNullable', false);
                                }
                              }}
                              className="rounded bg-zinc-900 border-zinc-800 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={col.isAutoIncrement}
                              onChange={(e) => {
                                const isAi = e.target.checked;
                                handleUpdateColumn(col.id, 'isAutoIncrement', isAi);
                                if (isAi) {
                                  handleUpdateColumn(col.id, 'isPrimaryKey', true);
                                  handleUpdateColumn(col.id, 'isNullable', false);
                                }
                              }}
                              className="rounded bg-zinc-900 border-zinc-800 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={col.defaultValue}
                              onChange={(e) => handleUpdateColumn(col.id, 'defaultValue', e.target.value)}
                              placeholder="NULL"
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={col.comment}
                              onChange={(e) => handleUpdateColumn(col.id, 'comment', e.target.value)}
                              placeholder="Comentario..."
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 hover:text-emerald-400 text-zinc-500 disabled:opacity-20 rounded"
                                title="Subir"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(idx, 'down')}
                                disabled={idx === columns.length - 1}
                                className="p-1 hover:text-emerald-400 text-zinc-500 disabled:opacity-20 rounded"
                                title="Bajar"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-1 hover:text-red-400 text-zinc-500 rounded"
                                title="Eliminar columna"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add column button */}
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-medium rounded-lg text-xs border border-zinc-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Columna</span>
              </button>

            </div>
          ) : (
            /* TAB 2: SQL Preview */
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Sentencia SQL a ejecutar:</span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {isEditMode ? 'Sentencias ALTER TABLE' : 'Sentencia CREATE TABLE'}
                </span>
              </div>
              <pre className="flex-1 p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-emerald-300 overflow-auto whitespace-pre-wrap select-text leading-relaxed">
                {generatedSql}
              </pre>
            </div>
          )}

          {/* Error Banner */}
          {executionError && (
            <div className="mt-4 p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{executionError}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
            title="Abrir sentencia en pestaña SQL para revisar antes de ejecutar"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span>Abrir en Editor SQL</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isExecuting || columns.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
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
