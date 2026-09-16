import React, { useRef, useEffect } from 'react';
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
  ArrowLeftRight
} from 'lucide-react';

interface SqlEditorProps {
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

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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
          'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'UPDATE', 'DELETE', 'JOIN', 'LEFT JOIN',
          'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'GROUP BY', 'ORDER BY', 'HAVING',
          'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
          'CREATE DATABASE', 'USE', 'SHOW TABLES', 'SHOW DATABASES', 'DESCRIBE', 'EXPLAIN',
          'TRUNCATE TABLE', 'CREATE VIEW', 'CREATE PROCEDURE', 'CREATE FUNCTION', 'CREATE TRIGGER',
          'ENGINE=InnoDB', 'CHARACTER SET utf8mb4', 'COLLATE utf8mb4_unicode_ci',
          'AUTO_INCREMENT', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT',
          'UNIQUE', 'INDEX', 'KEY', 'ON UPDATE CASCADE', 'ON DELETE CASCADE',
          'INT', 'BIGINT', 'VARCHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DECIMAL', 'DATE',
          'DATETIME', 'TIMESTAMP', 'TIME', 'BOOLEAN', 'TINYINT', 'DOUBLE', 'FLOAT', 'JSON',
          'BLOB', 'LONGBLOB', 'ENUM', 'SET', 'START TRANSACTION', 'COMMIT', 'ROLLBACK',
          'LOCK TABLES', 'UNLOCK TABLES', 'DELIMITER'
        ];

        const mysqlFunctions = [
          'NOW()', 'CURDATE()', 'CURTIME()', 'DATE_FORMAT(date, format)', 'DATEDIFF(expr1, expr2)',
          'DATE_ADD(date, INTERVAL expr unit)', 'DATE_SUB(date, INTERVAL expr unit)',
          'CONCAT(str1, str2, ...)', 'CONCAT_WS(separator, str1, str2, ...)', 'GROUP_CONCAT(expr)',
          'COALESCE(val1, val2, ...)', 'IFNULL(expr1, expr2)', 'NULLIF(expr1, expr2)',
          'COUNT(*)', 'SUM(expr)', 'AVG(expr)', 'MIN(expr)', 'MAX(expr)',
          'ROUND(number, decimals)', 'CEIL(number)', 'FLOOR(number)', 'ABS(number)',
          'UPPER(str)', 'LOWER(str)', 'TRIM(str)', 'SUBSTRING(str, pos, len)',
          'JSON_EXTRACT(json_doc, path)', 'JSON_UNQUOTE(json_val)', 'LAST_INSERT_ID()',
          'DATABASE()', 'USER()', 'VERSION()'
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
          const fnName = fn.split('(')[0];
          suggestions.push({
            label: fnName,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn,
            detail: `Función MySQL: ${fn}`,
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
      onExecuteRef.current(selectedText && selectedText.trim() ? selectedText.trim() : undefined);
    });

    // F9 key handling
    editor.addCommand(monaco.KeyCode.F9, () => {
      if (swapF9F5Ref.current) {
        // When swapped, F9 acts as Refresh or not Execute
        return;
      }
      const selection = editor.getSelection();
      const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
      onExecuteRef.current(selectedText && selectedText.trim() ? selectedText.trim() : undefined);
    });

    // F5 key handling
    editor.addCommand(monaco.KeyCode.F5, () => {
      if (swapF9F5Ref.current) {
        const selection = editor.getSelection();
        const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
        onExecuteRef.current(selectedText && selectedText.trim() ? selectedText.trim() : undefined);
      }
    });
  };

  const handleSaveFile = async () => {
    if (window.electronAPI?.saveSqlFile) {
      await window.electronAPI.saveSqlFile(sql);
    }
  };

  const handleOpenFile = async () => {
    if (window.electronAPI?.openSqlFile) {
      const res = await window.electronAPI.openSqlFile();
      if (res && res.content) {
        onChange(res.content);
      }
    }
  };

  const handleFormatSql = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      
      {/* Editor Toolbar */}
      <div className="h-10 bg-zinc-900/90 border-b border-zinc-800 px-3 flex items-center justify-between select-none shrink-0 gap-2">
        
        {/* Left Actions: Run, Run Selected */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onExecute()}
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
            onClick={() => onChange('')}
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
          value={sql}
          onChange={(val) => onChange(val || '')}
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
            suggestOnTriggerCharacters: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            tabSize: 2,
            renderWhitespace: 'selection',
            padding: { top: 8, bottom: 8 }
          }}
        />
      </div>

    </div>
  );
};
