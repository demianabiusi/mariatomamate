import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useTranslation } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';

// Ensure Monaco uses local offline bundle
loader.config({ monaco });
import { SchemaObjects } from '../../types';
import { 
  Play, 
  PlaySquare, 
  Save, 
  FolderOpen, 
  Eraser, 
  Sparkles,
  ArrowLeftRight,
  Zap
} from 'lucide-react';

interface SqlEditorProps {
  tabId?: string;
  sql: string;
  onChange: (value: string) => void;
  onExecute: (customQuery?: string) => void;
  isRunning: boolean;
  maxRows: number;
  onChangeMaxRows: (val: number) => void;
  swapF9F5: boolean;
  onToggleSwap: () => void;
  schema?: SchemaObjects | null;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  tabId,
  sql,
  onChange,
  onExecute,
  isRunning,
  maxRows,
  onChangeMaxRows,
  swapF9F5,
  onToggleSwap,
  schema
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const executeKey = swapF9F5 ? 'F5' : 'F9';

  const activeTabId = tabId || 'default';
  const lastTabIdRef = useRef<string>(activeTabId);
  const viewStatesRef = useRef<Map<string, monaco.editor.ICodeEditorViewState>>(new Map());
  const sentValuesRef = useRef<Set<string>>(new Set());

  // Autocomplete toggle (persisted)
  const [autocompleteEnabled, setAutocompleteEnabled] = useState<boolean>(() =>
    localStorage.getItem('mariatomamate_autocomplete') !== 'false'
  );

  const handleToggleAutocomplete = () => {
    setAutocompleteEnabled(prev => {
      const next = !prev;
      localStorage.setItem('mariatomamate_autocomplete', String(next));
      if (editorRef.current) {
        editorRef.current.updateOptions({
          quickSuggestions: next ? { other: true, comments: false, strings: false } : false
        });
      }
      return next;
    });
  };

  // Refs to prevent stale closures inside Monaco callbacks
  const onExecuteRef = useRef(onExecute);
  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  const swapF9F5Ref = useRef(swapF9F5);
  useEffect(() => {
    swapF9F5Ref.current = swapF9F5;
  }, [swapF9F5]);

  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  const completionDisposableRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
        completionDisposableRef.current = null;
      }
    };
  }, []);

  // Handle external updates (tab switch, sidebar click, clear, open file, etc.)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // 1. Check if active tab switched
    if (lastTabIdRef.current !== activeTabId) {
      if (lastTabIdRef.current) {
        const state = editor.saveViewState();
        if (state) {
          viewStatesRef.current.set(lastTabIdRef.current, state);
        }
      }

      lastTabIdRef.current = activeTabId;
      sentValuesRef.current.clear();

      editor.setValue(sql);

      const savedState = viewStatesRef.current.get(activeTabId);
      if (savedState) {
        editor.restoreViewState(savedState);
      }
      return;
    }

    // 2. Tab did not change.
    // Check if this incoming SQL update was produced by user typing in the editor:
    if (sentValuesRef.current.has(sql)) {
      sentValuesRef.current.delete(sql);
      return;
    }

    // 3. External change within the same tab (e.g. click table in tree, open file, clear editor):
    if (sql !== editor.getValue()) {
      editor.setValue(sql);
    }
  }, [activeTabId, sql]);

  const handleEditorChange = (val: string | undefined) => {
    const nextVal = val ?? '';
    sentValuesRef.current.add(nextVal);
    // Keep set bounded
    if (sentValuesRef.current.size > 60) {
      const first = sentValuesRef.current.values().next().value;
      if (first !== undefined) sentValuesRef.current.delete(first);
    }
    onChange(nextVal);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    lastTabIdRef.current = activeTabId;

    if (editor.getValue() !== sql) {
      editor.setValue(sql);
    }

    // Custom MySQL/MariaDB autocompletions with column & table intelligence
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textUntilPosition = lineContent.substring(0, position.column - 1);

        const currentSchema = schemaRef.current;
        const columnsByTable: Record<string, string[]> = currentSchema?.columnsByTable || {};

        // Check if typing after a dot: e.g. "clientes." or "c." or "select u."
        const dotMatch = textUntilPosition.match(/([a-zA-Z0-9_$`"']+)\.([a-zA-Z0-9_$`"']*)$/);

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        if (dotMatch) {
          const rawQualifier = dotMatch[1].replace(/[`"']/g, '');
          const qualifierLower = rawQualifier.toLowerCase();

          // 1. Check if qualifier directly matches a table or view name
          let matchedTableName = Object.keys(columnsByTable).find(
            (t) => t.toLowerCase() === qualifierLower
          );

          // 2. If not found directly, check if qualifier is an alias in the current SQL query
          if (!matchedTableName) {
            const fullText = model.getValue();
            const escapedQualifier = rawQualifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Regex to find table with alias: FROM/JOIN/UPDATE/INTO <table_name> [AS] <qualifier>
            const aliasRegex = new RegExp(
              `(?:FROM|JOIN|UPDATE|INTO|,)\\s+[\`"']?([a-zA-Z0-9_$]+)[\`"']?(?:\\s+AS)?\\s+[\`"']?${escapedQualifier}[\`"']?\\b`,
              'i'
            );
            const aliasMatch = fullText.match(aliasRegex);
            if (aliasMatch) {
              const candidateTable = aliasMatch[1].toLowerCase();
              matchedTableName = Object.keys(columnsByTable).find(
                (t) => t.toLowerCase() === candidateTable
              );
            }
          }

          if (matchedTableName) {
            const cols = columnsByTable[matchedTableName] || [];
            const suggestions = cols.map((col: string, idx: number) => ({
              label: col,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `\`${col}\``,
              detail: `Columna (${matchedTableName})`,
              sortText: String(idx).padStart(4, '0'),
              range
            }));
            return { suggestions };
          }

          return { suggestions: [] };
        }

        // General suggestions when not immediately following a dot
        const mysqlKeywords = [
          'SELECT', 'DISTINCT', 'DISTINCTROW', 'ALL', 'FROM', 'WHERE',
          'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC',
          'LIMIT', 'OFFSET',
          'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'FULL JOIN', 'NATURAL JOIN', 'STRAIGHT_JOIN',
          'ON', 'USING',
          'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
          'AS', 'AND', 'OR', 'NOT', 'XOR', 'BETWEEN', 'NOT BETWEEN', 'IN', 'NOT IN', 'IS', 'IS NOT',
          'LIKE', 'NOT LIKE', 'ILIKE', 'REGEXP', 'RLIKE', 'EXISTS', 'NOT EXISTS',
          'IS NULL', 'IS NOT NULL', 'NULL', 'TRUE', 'FALSE',
          'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'REPLACE INTO',
          'CREATE TABLE', 'CREATE TABLE IF NOT EXISTS', 'ALTER TABLE', 'DROP TABLE', 'DROP TABLE IF EXISTS', 'TRUNCATE TABLE',
          'CREATE DATABASE', 'CREATE DATABASE IF NOT EXISTS', 'DROP DATABASE', 'DROP DATABASE IF EXISTS', 'USE',
          'CREATE VIEW', 'CREATE OR REPLACE VIEW', 'ALTER VIEW', 'DROP VIEW',
          'CREATE PROCEDURE', 'DROP PROCEDURE', 'CREATE FUNCTION', 'DROP FUNCTION', 'CREATE TRIGGER', 'DROP TRIGGER',
          'CREATE INDEX', 'DROP INDEX',
          'SHOW TABLES', 'SHOW DATABASES', 'SHOW CREATE TABLE', 'SHOW PROCESSLIST', 'SHOW STATUS', 'SHOW VARIABLES', 'SHOW COLUMNS FROM',
          'DESCRIBE', 'DESC', 'EXPLAIN', 'CALL',
          'START TRANSACTION', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'LOCK TABLES', 'UNLOCK TABLES', 'DELIMITER',
          'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'AUTO_INCREMENT', 'DEFAULT', 'NOT NULL', 'UNIQUE', 'INDEX', 'KEY', 'CONSTRAINT', 'CHECK',
          'ON UPDATE CASCADE', 'ON DELETE CASCADE', 'ON UPDATE SET NULL', 'ON DELETE SET NULL',
          'ADD COLUMN', 'DROP COLUMN', 'MODIFY COLUMN', 'CHANGE COLUMN', 'RENAME TABLE', 'RENAME TO',
          'ENGINE=InnoDB', 'ENGINE=MyISAM', 'CHARACTER SET utf8mb4', 'COLLATE utf8mb4_unicode_ci',
          'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
          'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE',
          'VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
          'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
          'BOOLEAN', 'BOOL', 'JSON', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
          'ENUM', 'SET', 'BINARY', 'VARBINARY'
        ];

        const mysqlFunctions = [
          { name: 'NOW', insertText: 'NOW()', detail: 'Fecha y hora actual' },
          { name: 'CURDATE', insertText: 'CURDATE()', detail: 'Fecha actual' },
          { name: 'CURTIME', insertText: 'CURTIME()', detail: 'Hora actual' },
          { name: 'DATE_FORMAT', insertText: 'DATE_FORMAT(${1:date}, \'${2:%Y-%m-%d}\')', detail: 'Formatear fecha' },
          { name: 'DATEDIFF', insertText: 'DATEDIFF(${1:expr1}, ${2:expr2})', detail: 'Diferencia en días' },
          { name: 'DATE_ADD', insertText: 'DATE_ADD(${1:date}, INTERVAL ${2:1} ${3:DAY})', detail: 'Sumar intervalo a fecha' },
          { name: 'DATE_SUB', insertText: 'DATE_SUB(${1:date}, INTERVAL ${2:1} ${3:DAY})', detail: 'Restar intervalo a fecha' },
          { name: 'CONCAT', insertText: 'CONCAT(${1:str1}, ${2:str2})', detail: 'Concatenar cadenas' },
          { name: 'CONCAT_WS', insertText: 'CONCAT_WS(\'${1:, }\', ${2:str1}, ${3:str2})', detail: 'Concatenar con separador' },
          { name: 'GROUP_CONCAT', insertText: 'GROUP_CONCAT(${1:expr})', detail: 'Concatenar valores de grupo' },
          { name: 'COALESCE', insertText: 'COALESCE(${1:val1}, ${2:val2})', detail: 'Primer valor no nulo' },
          { name: 'IFNULL', insertText: 'IFNULL(${1:expr1}, ${2:expr2})', detail: 'Si es nulo retornar valor' },
          { name: 'NULLIF', insertText: 'NULLIF(${1:expr1}, ${2:expr2})', detail: 'Retorna NULL si coinciden' },
          { name: 'IF', insertText: 'IF(${1:condition}, ${2:true_val}, ${3:false_val})', detail: 'Condición IF' },
          { name: 'COUNT', insertText: 'COUNT(${1:*})', detail: 'Contar registros' },
          { name: 'SUM', insertText: 'SUM(${1:expr})', detail: 'Suma de valores' },
          { name: 'AVG', insertText: 'AVG(${1:expr})', detail: 'Promedio de valores' },
          { name: 'MIN', insertText: 'MIN(${1:expr})', detail: 'Valor mínimo' },
          { name: 'MAX', insertText: 'MAX(${1:expr})', detail: 'Valor máximo' },
          { name: 'ROUND', insertText: 'ROUND(${1:number}, ${2:2})', detail: 'Redondear número' },
          { name: 'CEIL', insertText: 'CEIL(${1:number})', detail: 'Redondear hacia arriba' },
          { name: 'FLOOR', insertText: 'FLOOR(${1:number})', detail: 'Redondear hacia abajo' },
          { name: 'ABS', insertText: 'ABS(${1:number})', detail: 'Valor absoluto' },
          { name: 'UPPER', insertText: 'UPPER(${1:str})', detail: 'Mayúsculas' },
          { name: 'LOWER', insertText: 'LOWER(${1:str})', detail: 'Minúsculas' },
          { name: 'TRIM', insertText: 'TRIM(${1:str})', detail: 'Eliminar espacios' },
          { name: 'SUBSTRING', insertText: 'SUBSTRING(${1:str}, ${2:pos}, ${3:len})', detail: 'Subcadena' },
          { name: 'REPLACE', insertText: 'REPLACE(${1:str}, \'${2:from}\', \'${3:to}\')', detail: 'Reemplazar en cadena' },
          { name: 'LENGTH', insertText: 'LENGTH(${1:str})', detail: 'Longitud en bytes' },
          { name: 'CHAR_LENGTH', insertText: 'CHAR_LENGTH(${1:str})', detail: 'Longitud en caracteres' },
          { name: 'JSON_EXTRACT', insertText: 'JSON_EXTRACT(${1:json_doc}, \'${2:$.path}\')', detail: 'Extraer JSON' },
          { name: 'JSON_UNQUOTE', insertText: 'JSON_UNQUOTE(${1:json_val})', detail: 'Descomillar JSON' },
          { name: 'LAST_INSERT_ID', insertText: 'LAST_INSERT_ID()', detail: 'Último ID insertado' },
          { name: 'DATABASE', insertText: 'DATABASE()', detail: 'Base de datos actual' },
          { name: 'USER', insertText: 'USER()', detail: 'Usuario actual' },
          { name: 'VERSION', insertText: 'VERSION()', detail: 'Versión del servidor' }
        ];

        const suggestions: any[] = [];

        // Add Keywords
        mysqlKeywords.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: 'Palabra clave MySQL / MariaDB',
            range
          });
        });

        // Add Functions
        mysqlFunctions.forEach((fn) => {
          suggestions.push({
            label: fn.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `Función MySQL: ${fn.detail}`,
            range
          });
        });

        // Add Tables from schema
        if (currentSchema?.tables) {
          currentSchema.tables.forEach((tName) => {
            suggestions.push({
              label: tName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `\`${tName}\``,
              detail: 'Tabla',
              range
            });
          });
        }

        // Add Views from schema
        if (currentSchema?.views) {
          currentSchema.views.forEach((vName) => {
            suggestions.push({
              label: vName,
              kind: monaco.languages.CompletionItemKind.Interface,
              insertText: `\`${vName}\``,
              detail: 'Vista',
              range
            });
          });
        }

        // Add Procedures from schema
        if (currentSchema?.procedures) {
          currentSchema.procedures.forEach((p) => {
            suggestions.push({
              label: p.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: `CALL \`${p.name}\`()`,
              detail: 'Procedimiento Almacenado',
              range
            });
          });
        }

        // Add Functions from schema
        if (currentSchema?.functions) {
          currentSchema.functions.forEach((f) => {
            suggestions.push({
              label: f.name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `\`${f.name}\`()`,
              detail: 'Función Almacenada',
              range
            });
          });
        }

        return { suggestions };
      }
    });

    // Keyboard Shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
      const fullText = editor.getValue();
      onExecuteRef.current(selectedText && selectedText.trim() ? selectedText.trim() : (fullText && fullText.trim() ? fullText.trim() : undefined));
    });

    // F9 key handling
    editor.addCommand(monaco.KeyCode.F9, () => {
      if (swapF9F5Ref.current) {
        // When swapped, F9 acts as Refresh or not Execute
        return;
      }
      const selection = editor.getSelection();
      const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
      const fullText = editor.getValue();
      onExecuteRef.current(selectedText && selectedText.trim() ? selectedText.trim() : (fullText && fullText.trim() ? fullText.trim() : undefined));
    });

    // F5 key handling
    editor.addCommand(monaco.KeyCode.F5, () => {
      if (swapF9F5Ref.current) {
        const selection = editor.getSelection();
        const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
        const fullText = editor.getValue();
        onExecuteRef.current(selectedText && selectedText.trim() ? selectedText.trim() : (fullText && fullText.trim() ? fullText.trim() : undefined));
      }
    });
  };

  const handleSaveFile = async () => {
    if (window.electronAPI?.saveSqlFile) {
      const content = editorRef.current ? editorRef.current.getValue() : sql;
      await window.electronAPI.saveSqlFile(content);
    }
  };

  const handleOpenFile = async () => {
    if (window.electronAPI?.openSqlFile) {
      const res = await window.electronAPI.openSqlFile();
      if (res && res.content) {
        if (editorRef.current) {
          editorRef.current.setValue(res.content);
          editorRef.current.focus();
        }
        sentValuesRef.current.clear();
        onChange(res.content);
      }
    }
  };

  const handleFormatSql = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const handleClear = () => {
    if (editorRef.current) {
      editorRef.current.setValue('');
      editorRef.current.focus();
    }
    sentValuesRef.current.clear();
    onChange('');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      
      {/* Editor Toolbar */}
      <div className="h-10 bg-zinc-900/90 border-b border-zinc-800 px-3 flex items-center justify-between select-none shrink-0 gap-2">
        
        {/* Left Actions: Run, Run Selected */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const fullText = editorRef.current ? editorRef.current.getValue() : undefined;
              onExecute(fullText);
            }}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
              isRunning
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-600/20'
            }`}
            title={`Ejecutar consulta (${executeKey} o Ctrl+Enter)`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t('editor.execute')}</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-emerald-700/60 px-1 py-0.2 rounded font-mono text-emerald-100">
              {executeKey}
            </kbd>
          </button>

          <button
            onClick={() => {
              const selection = editorRef.current?.getSelection();
              const selectedText = selection ? editorRef.current?.getModel()?.getValueInRange(selection) : '';
              onExecute(selectedText && selectedText.trim() ? selectedText.trim() : undefined);
            }}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs rounded-lg border border-zinc-700/80 transition-colors"
            title="Ejecutar sólo el texto seleccionado"
          >
            <PlaySquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">{t('editor.executeSelection')}</span>
          </button>

          {/* Swap F9 / F5 Button */}
          <button
            onClick={onToggleSwap}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
              swapF9F5
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Alternar atajo de ejecución entre F9 (estándar) y F5 (estilo SQLyog)"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span className="font-mono font-semibold">{swapF9F5 ? 'F5=Ejecutar' : 'F9=Ejecutar'}</span>
          </button>

          {/* Autocomplete Toggle Button */}
          <button
            onClick={handleToggleAutocomplete}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
              autocompleteEnabled
                ? 'bg-zinc-800/80 border-zinc-700 text-emerald-400 hover:text-emerald-300'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-400'
            }`}
            title={t('editor.autocompleteTooltip')}
          >
            <Zap className={`w-3 h-3 ${autocompleteEnabled ? 'text-emerald-400 fill-emerald-400/20' : 'text-zinc-500'}`} />
            <span className="font-mono text-[10px]">{autocompleteEnabled ? t('editor.autocompleteOn') : t('editor.autocompleteOff')}</span>
          </button>
        </div>

        {/* Center / Right: Limit, Format, File ops, Clear */}
        <div className="flex items-center gap-2">
          
          {/* Max rows selector */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="hidden lg:inline">{t('editor.rowsLimit')}</span>
            <select
              value={maxRows}
              onChange={(e) => onChangeMaxRows(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
              <option value={100000}>100,000</option>
            </select>
          </div>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* Format Query */}
          <button
            onClick={handleFormatSql}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            title={t('editor.formatSql')}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          {/* Open File */}
          <button
            onClick={handleOpenFile}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            title={t('editor.openSql')}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          {/* Save File */}
          <button
            onClick={handleSaveFile}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            title={t('editor.saveSql')}
          >
            <Save className="w-3.5 h-3.5" />
          </button>

          {/* Clear Editor */}
          <button
            onClick={handleClear}
            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
            title={t('editor.clear')}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 overflow-hidden relative">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme={theme === 'light' ? 'vs' : 'vs-dark'}
          defaultValue={sql}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          loading={
            <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-400 text-xs gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Iniciando editor SQL...</span>
            </div>
          }
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
            padding: { top: 8, bottom: 8 },
            // Autocomplete behavior settings:
            quickSuggestions: autocompleteEnabled ? { other: true, comments: false, strings: false } : false,
            quickSuggestionsDelay: 60,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnCommitCharacter: false, // Prevents punctuation/space from committing suggestions
            acceptSuggestionOnEnter: 'smart',         // Enter doesn't hijack line breaks
            tabCompletion: 'on',                     // Tab cleanly accepts completion
            suggest: {
              insertMode: 'replace',
              filterGraceful: true,
              snippetsPreventQuickSuggestions: false,
              localityBonus: true,
              shareSuggestSelections: true,
              showWords: false
            },
            wordBasedSuggestions: 'off',
            suggestSelection: 'first'
          }}
        />
      </div>

    </div>
  );
};
