import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { ColumnMetadata, ColumnInfo } from '../../types';
import { 
  Plus, 
  X, 
  Key, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Code,
  Table2,
  RefreshCw
} from 'lucide-react';

interface InsertRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  database?: string;
  columns: string[];
  fieldsMeta?: ColumnMetadata[];
  initialValues?: Record<string, any> | null;
  onSuccess: (newRow: Record<string, any>, sql: string, keepOpen?: boolean) => void;
}

interface ColumnFormState {
  mode: 'value' | 'default' | 'null';
  value: string;
}

export const InsertRowModal: React.FC<InsertRowModalProps> = ({
  isOpen,
  onClose,
  tableName,
  database,
  columns,
  fieldsMeta,
  initialValues,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [formState, setFormState] = useState<Record<string, ColumnFormState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load detailed table columns metadata (for accurate types, nullability, auto_increment and defaults)
  const loadColumnsMetadata = useCallback(async () => {
    if (!tableName) return;
    setIsLoadingDetails(true);
    try {
      if (window.electronAPI?.getTableDetails) {
        const res = await window.electronAPI.getTableDetails(tableName);
        if (res.success && res.data?.columns) {
          setTableColumns(res.data.columns);
          return;
        }
      }
    } catch {
      // Fallback to minimal info from columns/fieldsMeta
    } finally {
      setIsLoadingDetails(false);
    }
  }, [tableName]);

  useEffect(() => {
    if (isOpen) {
      loadColumnsMetadata();
      setErrorMessage(null);
      setSuccessNotice(null);
    }
  }, [isOpen, loadColumnsMetadata]);

  // Merge table columns from getTableDetails and fieldsMeta
  const effectiveColumns = useMemo(() => {
    // If we have detailed schema columns for this table, use them
    if (tableColumns.length > 0) {
      return tableColumns.map(col => {
        const meta = fieldsMeta?.find(f => f.orgName === col.columnName || f.name === col.columnName);
        return {
          name: col.columnName,
          fieldType: col.fieldType,
          isPrimaryKey: col.isPrimaryKey,
          isAutoIncrement: col.isAutoIncrement,
          isNullable: col.isNullable,
          defaultValue: col.defaultValue,
          comment: col.comment
        };
      });
    }

    // Fallback: derive from query columns and fieldsMeta
    return columns.map(colName => {
      const meta = fieldsMeta?.find(f => f.name === colName);
      const isPk = Boolean(meta?.isPrimary);
      return {
        name: meta?.orgName || colName,
        fieldType: 'VARCHAR',
        isPrimaryKey: isPk,
        isAutoIncrement: false,
        isNullable: true,
        defaultValue: null,
        comment: undefined
      };
    });
  }, [tableColumns, columns, fieldsMeta]);

  // Initialize form state when columns or initialValues change
  useEffect(() => {
    if (!isOpen) return;

    const initial: Record<string, ColumnFormState> = {};
    for (const col of effectiveColumns) {
      const hasInitialVal = initialValues && (col.name in initialValues || (columns.includes(col.name) && initialValues[col.name] !== undefined));
      const rawInitVal = hasInitialVal ? initialValues[col.name] : undefined;

      if (hasInitialVal) {
        if (col.isAutoIncrement) {
          // When duplicating, usually don't replicate auto_increment primary key
          initial[col.name] = { mode: 'default', value: '' };
        } else if (rawInitVal === null || rawInitVal === undefined) {
          initial[col.name] = { mode: 'null', value: '' };
        } else {
          initial[col.name] = { mode: 'value', value: String(rawInitVal) };
        }
      } else {
        if (col.isAutoIncrement) {
          initial[col.name] = { mode: 'default', value: '' };
        } else if (col.defaultValue !== null && col.defaultValue !== undefined) {
          initial[col.name] = { mode: 'default', value: '' };
        } else if (col.isNullable) {
          initial[col.name] = { mode: 'null', value: '' };
        } else {
          initial[col.name] = { mode: 'value', value: '' };
        }
      }
    }

    setFormState(initial);
  }, [isOpen, effectiveColumns, initialValues, columns]);

  // Generate live SQL Preview
  const previewSql = useMemo(() => {
    const colsToInsert: string[] = [];
    const valuesToInsert: string[] = [];

    for (const col of effectiveColumns) {
      const state = formState[col.name];
      if (!state) continue;

      if (state.mode === 'default') {
        // Excluded from column list so MySQL/MariaDB applies DEFAULT
        continue;
      }

      colsToInsert.push(`\`${col.name}\``);
      if (state.mode === 'null') {
        valuesToInsert.push('NULL');
      } else {
        const val = state.value;
        const upperType = col.fieldType.toUpperCase();
        const isNumeric = /INT|DECIMAL|NUMERIC|FLOAT|DOUBLE/i.test(upperType);

        if (isNumeric && val.trim() !== '' && !isNaN(Number(val))) {
          valuesToInsert.push(val.trim());
        } else {
          const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          valuesToInsert.push(`'${escaped}'`);
        }
      }
    }

    const tableRef = database ? `\`${database}\`.\`${tableName}\`` : `\`${tableName}\``;
    if (colsToInsert.length === 0) {
      return `INSERT INTO ${tableRef} () VALUES ();`;
    }
    return `INSERT INTO ${tableRef} (\n  ${colsToInsert.join(', ')}\n) VALUES (\n  ${valuesToInsert.join(', ')}\n);`;
  }, [effectiveColumns, formState, database, tableName]);

  const handleFieldChange = (colName: string, patch: Partial<ColumnFormState>) => {
    setFormState(prev => ({
      ...prev,
      [colName]: {
        ...(prev[colName] || { mode: 'value', value: '' }),
        ...patch
      }
    }));
  };

  const handleSubmit = async (keepOpen = false) => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      const values: Record<string, any> = {};

      for (const col of effectiveColumns) {
        const state = formState[col.name];
        if (!state) continue;

        if (state.mode === 'default') {
          values[col.name] = { __isDefault: true };
        } else if (state.mode === 'null') {
          values[col.name] = null;
        } else {
          const val = state.value;
          const upperType = col.fieldType.toUpperCase();
          const isNumeric = /INT|DECIMAL|NUMERIC|FLOAT|DOUBLE/i.test(upperType);

          if (isNumeric && val.trim() !== '' && !isNaN(Number(val))) {
            values[col.name] = Number(val);
          } else {
            values[col.name] = val;
          }
        }
      }

      const res = await window.electronAPI.insertRow({
        db: database,
        table: tableName,
        values,
        fieldsMeta
      });

      if (res.success && res.data) {
        onSuccess(res.data.insertedRow, res.data.sql, keepOpen);

        if (keepOpen) {
          // Reset form values for next insert
          setFormState(prev => {
            const next: Record<string, ColumnFormState> = {};
            for (const col of effectiveColumns) {
              if (col.isAutoIncrement || (col.defaultValue !== null && col.defaultValue !== undefined)) {
                next[col.name] = { mode: 'default', value: '' };
              } else if (col.isNullable) {
                next[col.name] = { mode: 'null', value: '' };
              } else {
                next[col.name] = { mode: 'value', value: '' };
              }
            }
            return next;
          });
          setSuccessNotice(t('grid.insertRowSuccess') || 'Fila insertada correctamente. Puedes ingresar otra fila.');
          setTimeout(() => setSuccessNotice(null), 3500);
        } else {
          onClose();
        }
      } else {
        setErrorMessage(res.error || 'Error al insertar la fila en la tabla.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al intentar insertar la fila.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div 
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-200"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(false);
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>{t('grid.insertRowTitle') || 'Insertar nueva fila'}</span>
                {initialValues && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-normal">
                    {t('grid.duplicateRow') || 'Duplicando fila'}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                <Table2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  {database ? `${database}.${tableName}` : tableName}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500 font-sans">{effectiveColumns.length} columnas</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoadingDetails && (
              <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
              title={t('common.close') || 'Cerrar (Esc)'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success Notice / Notification */}
        {successNotice && (
          <div className="px-5 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="px-5 py-2.5 bg-red-950/40 border-b border-red-900/50 flex items-start gap-2 text-red-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono text-[11px] whitespace-pre-wrap">{errorMessage}</div>
          </div>
        )}

        {/* Body / Field Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-950/40">
          <div className="grid grid-cols-1 gap-3.5">
            {effectiveColumns.map((col) => {
              const state = formState[col.name] || { mode: 'value', value: '' };
              const upperType = col.fieldType.toUpperCase();
              const isLargeText = /TEXT|JSON|BLOB/i.test(upperType);

              return (
                <div 
                  key={col.name}
                  className="p-3 rounded-xl border border-zinc-800/90 bg-zinc-900/60 hover:border-zinc-700/80 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {/* Left: Column info & badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-zinc-200">
                        {col.name}
                      </span>

                      {col.isPrimaryKey && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono" title={t('grid.primaryKey')}>
                          <Key className="w-2.5 h-2.5" />
                          <span>PK</span>
                        </span>
                      )}

                      {col.isAutoIncrement && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono" title={t('grid.autoIncrement')}>
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>AUTO_INCREMENT</span>
                        </span>
                      )}

                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                        {col.fieldType}
                      </span>

                      {!col.isNullable && !col.isAutoIncrement && (
                        <span className="text-[10px] text-zinc-500 font-sans">
                          NOT NULL
                        </span>
                      )}

                      {col.defaultValue !== null && col.defaultValue !== undefined && (
                        <span className="text-[10px] text-zinc-500 font-sans" title={`Por defecto: ${col.defaultValue}`}>
                          Def: <span className="font-mono text-zinc-400">{col.defaultValue}</span>
                        </span>
                      )}
                    </div>

                    {/* Right: Mode selector (Valor / DEFAULT / NULL) */}
                    <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px] font-mono shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFieldChange(col.name, { mode: 'value' })}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          state.mode === 'value'
                            ? 'bg-emerald-600 text-white font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t('grid.value') || 'Valor'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFieldChange(col.name, { mode: 'default' })}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          state.mode === 'default'
                            ? 'bg-blue-600 text-white font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title="Usar valor automático (DEFAULT / AUTO_INCREMENT)"
                      >
                        DEFAULT
                      </button>

                      <button
                        type="button"
                        disabled={!col.isNullable}
                        onClick={() => handleFieldChange(col.name, { mode: 'null' })}
                        className={`px-2 py-0.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                          state.mode === 'null'
                            ? 'bg-amber-600 text-white font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title={col.isNullable ? 'Establecer como NULL' : 'Esta columna no admite NULL'}
                      >
                        NULL
                      </button>
                    </div>
                  </div>

                  {/* Input control according to mode */}
                  {state.mode === 'value' ? (
                    isLargeText ? (
                      <textarea
                        rows={3}
                        value={state.value}
                        onChange={(e) => handleFieldChange(col.name, { value: e.target.value })}
                        placeholder={`Ingresa ${col.name}...`}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700/80 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    ) : (
                      <input
                        type="text"
                        value={state.value}
                        onChange={(e) => handleFieldChange(col.name, { value: e.target.value })}
                        placeholder={`Ingresa ${col.name}...`}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700/80 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    )
                  ) : state.mode === 'default' ? (
                    <div className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950/50 border border-blue-900/40 rounded-lg text-blue-400/80 italic flex items-center justify-between">
                      <span>DEFAULT (Generado automáticamente por el servidor)</span>
                      {col.isAutoIncrement && <span className="text-[10px] text-blue-400 font-semibold font-sans">AUTO_INCREMENT</span>}
                    </div>
                  ) : (
                    <div className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950/50 border border-amber-900/40 rounded-lg text-amber-400/80 italic">
                      NULL
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SQL Preview Accordion / Box */}
          <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-semibold mb-1.5">
              <Code className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('grid.sqlPreview') || 'Vista previa SQL'}</span>
            </div>
            <pre className="font-mono text-[11px] text-emerald-300/90 whitespace-pre-wrap overflow-x-auto bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
              {previewSql}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400">Ctrl+Enter</kbd> para guardar
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              {t('common.cancel') || 'Cancelar'}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
            >
              {t('grid.insertAndNew') || 'Insertar y agregar otra'}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('grid.insertBtn') || 'Insertar fila'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
