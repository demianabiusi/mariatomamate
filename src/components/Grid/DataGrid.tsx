import React, { useState, useMemo } from 'react';
import { QueryResult } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { exportToCsv, exportToJson, exportToSqlInserts } from '../../utils/exporter';
import { 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Maximize2, 
  X,
  FileSpreadsheet,
  FileJson,
  FileText,
  Clock,
  Layers
} from 'lucide-react';

interface DataGridProps {
  result: QueryResult | null;
  isRunning: boolean;
}

export const DataGrid: React.FC<DataGridProps> = ({ result, isRunning }) => {
  const { t } = useTranslation();
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [cellModalValue, setCellModalValue] = useState<{ col: string; value: any } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  React.useEffect(() => {
    setCurrentPage(1);
    setFilterText('');
  }, [result]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortCol(null);
        setSortAsc(true);
      }
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    if (!result?.rows) return [];
    let rows = [...result.rows];

    // Filter
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((v) =>
          String(v ?? '').toLowerCase().includes(q)
        )
      );
    }

    // Sort
    if (sortCol) {
      rows.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [result?.rows, filterText, sortCol, sortAsc]);

  // Pagination
  const totalRows = filteredAndSortedRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(id);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const handleExport = async (type: 'csv' | 'json' | 'sql') => {
    setShowExportMenu(false);
    if (!result?.rows || result.rows.length === 0) return;

    let content = '';
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `export_mariatomamate_${timestamp}.${type}`;

    if (type === 'csv') {
      content = exportToCsv(result.columns, filteredAndSortedRows);
    } else if (type === 'json') {
      content = exportToJson(filteredAndSortedRows);
    } else {
      content = exportToSqlInserts('resultado_query', result.columns, filteredAndSortedRows);
    }

    if (window.electronAPI?.exportData) {
      await window.electronAPI.exportData(content, filename, type);
    }
  };

  if (isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
        <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-xs font-medium">Ejecutando consulta en MariaDB / MySQL...</span>
      </div>
    );
  }

  if (!result || !result.columns || result.columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
        <Layers className="w-8 h-8 stroke-1 text-zinc-600" />
        <span className="text-xs">{t('grid.noRows')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden text-xs select-text">
      
      {/* Grid Top Action Bar */}
      <div className="h-9 bg-zinc-950/80 border-b border-zinc-800/80 px-3 flex items-center justify-between gap-2 shrink-0 select-none">
        
        {/* Left: Filter input & Row counts */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder={t('grid.filterPlaceholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-7 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
            />
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
            <span>{t('grid.showing')}</span>
            <strong className="text-zinc-200">{filteredAndSortedRows.length}</strong>
            <span>{t('grid.of')}</span>
            <strong className="text-zinc-200">{result.rowCount}</strong>
            <span>{t('grid.rows')}</span>
            {result.hasMore && (
              <span className="text-amber-400 font-semibold">(Limitado)</span>
            )}
          </div>
        </div>

        {/* Right: Export Menu & Execution Time */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span>{result.executionTimeMs} ms</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('grid.export')}</span>
            </button>

            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowExportMenu(false)} 
                />
                <div className="absolute right-0 mt-1 z-30 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 divide-y divide-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>{t('grid.exportCsv')}</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <FileJson className="w-4 h-4 text-amber-400" />
                    <span>{t('grid.exportJson')}</span>
                  </button>
                  <button
                    onClick={() => handleExport('sql')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>{t('grid.exportSql')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Table Content Container */}
      <div className="flex-1 overflow-auto bg-zinc-950">
        <table className="w-full border-collapse text-left font-mono">
          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10 select-none shadow-sm">
            <tr>
              <th className="w-10 px-2 py-1.5 text-center text-zinc-500 font-normal border-r border-zinc-800">
                #
              </th>
              {result.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-1.5 text-zinc-300 font-semibold border-r border-zinc-800 cursor-pointer hover:bg-zinc-800/80 transition-colors whitespace-nowrap group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{col}</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">
                      {sortCol === col ? (sortAsc ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/80 text-zinc-300">
            {paginatedRows.map((row, idx) => {
              const rowIndex = (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr key={idx} className="hover:bg-zinc-900/60 transition-colors">
                  <td className="w-10 px-2 py-1 text-center text-zinc-500 border-r border-zinc-900 bg-zinc-950/40 select-none">
                    {rowIndex}
                  </td>
                  {result.columns.map((col) => {
                    const rawVal = row[col];
                    const isNull = rawVal === null || rawVal === undefined;
                    const cellKey = `${rowIndex}_${col}`;
                    const isCopied = copiedCell === cellKey;
                    const valStr = isNull ? 'NULL' : String(rawVal);
                    const isLongText = valStr.length > 50 || valStr.includes('\n');

                    return (
                      <td
                        key={col}
                        className={`px-3 py-1 border-r border-zinc-900/80 whitespace-nowrap max-w-xs truncate group relative ${
                          isNull ? 'text-zinc-600 italic' : ''
                        }`}
                        title={valStr}
                      >
                        <span>{valStr}</span>

                        {/* Quick cell actions on hover */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-zinc-800 px-1 py-0.5 rounded shadow-md select-none">
                          <button
                            onClick={() => copyToClipboard(valStr, cellKey)}
                            className="p-1 hover:text-emerald-400 text-zinc-400 rounded"
                            title={t('common.copy')}
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {isLongText && (
                            <button
                              onClick={() => setCellModalValue({ col, value: rawVal })}
                              className="p-1 hover:text-amber-400 text-zinc-400 rounded"
                              title={t('grid.inspectCell')}
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="h-9 bg-zinc-950 border-t border-zinc-800 px-3 flex items-center justify-between shrink-0 select-none text-[11px] text-zinc-400">
        <div className="flex items-center gap-2">
          <span>{t('grid.rowsPerPage')}</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>Página {currentPage} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 text-zinc-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 text-zinc-300"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cell Content Inspector Modal */}
      {cellModalValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950">
              <span className="font-semibold text-zinc-200">
                Campo: <span className="text-emerald-400 font-mono">{cellModalValue.col}</span>
              </span>
              <button
                onClick={() => setCellModalValue(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto bg-zinc-950/80">
              <pre className="font-mono text-xs text-zinc-200 whitespace-pre-wrap select-text">
                {typeof cellModalValue.value === 'object'
                  ? JSON.stringify(cellModalValue.value, null, 2)
                  : String(cellModalValue.value)}
              </pre>
            </div>
            <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  const text = typeof cellModalValue.value === 'object'
                    ? JSON.stringify(cellModalValue.value, null, 2)
                    : String(cellModalValue.value);
                  navigator.clipboard.writeText(text);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t('common.copy')}</span>
              </button>
              <button
                onClick={() => setCellModalValue(null)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
