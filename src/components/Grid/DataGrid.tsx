import React, { useState, useMemo, useEffect } from 'react';
import { QueryResult } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { exportToCsv, exportToJson, exportToSqlInserts, exportToXlsx } from '../../utils/exporter';
import { InsertRowModal } from '../Modals/InsertRowModal';
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
  Table2,
  Clock,
  Layers,
  Pencil,
  Key,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  CopyPlus
} from 'lucide-react';

interface DataGridProps {
  result: QueryResult | null;
  isRunning: boolean;
  onRowUpdated?: (newRow: Record<string, any>, sql: string) => void;
  onRowDeleted?: (deletedRow: Record<string, any>, sql: string) => void;
  onRowInserted?: (newRow: Record<string, any>, sql: string) => void;
}

export const DataGrid: React.FC<DataGridProps> = ({ 
  result, 
  isRunning, 
  onRowUpdated,
  onRowDeleted,
  onRowInserted
}) => {
  const { t } = useTranslation();
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [cellModalValue, setCellModalValue] = useState<{ col: string; value: any } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{
    row: Record<string, any>;
    col: string;
    val: string;
    isNull: boolean;
    isSaving: boolean;
  } | null>(null);
  const [flashCell, setFlashCell] = useState<{ row: Record<string, any>; col: string } | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [mutationEpoch, setMutationEpoch] = useState(0);

  // Insert row modal state
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [duplicateRowValues, setDuplicateRowValues] = useState<Record<string, any> | null>(null);

  // Delete row state
  const [rowToDelete, setRowToDelete] = useState<{ row: Record<string, any>; index: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Row context menu state
  const [rowContextMenu, setRowContextMenu] = useState<{
    x: number;
    y: number;
    row: Record<string, any>;
    index: number;
  } | null>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleClose = () => setRowContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowContextMenu(null);
    };

    if (rowContextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [rowContextMenu]);

  React.useEffect(() => {
    setCurrentPage(1);
    setFilterText('');
    setEditingCell(null);
    setFlashCell(null);
    setSafetyError(null);
    setRowToDelete(null);
    setRowContextMenu(null);
    setIsInsertModalOpen(false);
  }, [result]);

  const hasEditableTable = useMemo(() => {
    return Boolean(result?.fieldsMeta?.some(f => Boolean(f.orgTable)));
  }, [result?.fieldsMeta]);

  const hasPrimaryKey = useMemo(() => {
    return Boolean(result?.fieldsMeta?.some(f => Boolean(f.isPrimary)));
  }, [result?.fieldsMeta]);

  // Target primary table metadata for insert/delete
  const targetTableInfo = useMemo(() => {
    if (!result?.fieldsMeta) return null;
    const orgTables = Array.from(new Set(result.fieldsMeta.map(f => f.orgTable).filter(Boolean)));
    if (orgTables.length === 0) return null;
    const primaryTable = orgTables[0];
    const db = result.fieldsMeta.find(f => f.orgTable === primaryTable)?.db;
    return {
      table: primaryTable,
      db,
      isSingleTable: orgTables.length === 1
    };
  }, [result?.fieldsMeta]);

  const handleStartEdit = (row: Record<string, any>, col: string) => {
    const rawVal = row[col];
    const isNull = rawVal === null || rawVal === undefined;
    setEditingCell({
      row,
      col,
      val: isNull ? '' : String(rawVal),
      isNull,
      isSaving: false
    });
  };

  const handleCommitCell = async () => {
    if (!editingCell || editingCell.isSaving) return;

    const { row, col, val, isNull } = editingCell;
    const originalVal = row[col];
    const originalIsNull = originalVal === null || originalVal === undefined;

    // Check if unchanged
    if (isNull === originalIsNull && (isNull || String(originalVal) === val)) {
      setEditingCell(null);
      return;
    }

    const colMeta = result?.fieldsMeta?.find(f => f.name === col);
    if (!colMeta || !colMeta.orgTable) {
      alert('Esta columna no pertenece a una tabla directa.');
      setEditingCell(null);
      return;
    }

    setEditingCell(prev => prev ? { ...prev, isSaving: true } : null);

    try {
      let parsedValue: any = isNull ? null : val;
      if (!isNull && typeof originalVal === 'number' && !isNaN(Number(val)) && val.trim() !== '') {
        parsedValue = Number(val);
      }

      const res = await window.electronAPI.updateCell({
        db: colMeta.db,
        table: colMeta.orgTable,
        column: colMeta.orgName || col,
        newValue: parsedValue,
        oldRow: row,
        fieldsMeta: result?.fieldsMeta
      });

      if (res.success && res.data) {
        row[col] = parsedValue;
        setMutationEpoch(v => v + 1);

        setFlashCell({ row, col });
        setTimeout(() => setFlashCell(null), 1200);

        setSuccessToast(
          res.data.usedStrategy === 'primary_key'
            ? t('grid.updateSuccessPk')
            : t('grid.updateSuccessVerified')
        );
        setTimeout(() => setSuccessToast(null), 3000);

        if (onRowUpdated) {
          onRowUpdated(row, res.data.sql);
        }

        setEditingCell(null);
      } else {
        setEditingCell(prev => prev ? { ...prev, isSaving: false } : null);
        setSafetyError(res.error || 'Error al modificar los datos en la tabla.');
      }
    } catch (err: any) {
      setEditingCell(prev => prev ? { ...prev, isSaving: false } : null);
      setSafetyError(err.message || 'Error inesperado al intentar modificar el valor.');
    }
  };

  const handleOpenInsertModal = (initialVals?: Record<string, any>) => {
    setDuplicateRowValues(initialVals || null);
    setIsInsertModalOpen(true);
  };

  const handleRowInserted = (newRow: Record<string, any>, sql: string, keepOpen?: boolean) => {
    if (!result) return;

    // Map inserted row fields to grid columns (accounting for possible column aliases in fieldsMeta)
    const mappedRow: Record<string, any> = {};
    for (const col of result.columns) {
      const meta = result.fieldsMeta?.find(f => f.name === col);
      const orgName = meta?.orgName || col;
      if (orgName in newRow) {
        mappedRow[col] = newRow[orgName];
      } else if (col in newRow) {
        mappedRow[col] = newRow[col];
      } else {
        mappedRow[col] = null;
      }
    }

    // Insert at top of the dataset
    result.rows.unshift(mappedRow);
    result.rowCount = (result.rowCount || 0) + 1;
    setMutationEpoch(v => v + 1);

    setFlashCell({ row: mappedRow, col: result.columns[0] });
    setTimeout(() => setFlashCell(null), 1800);

    setSuccessToast(t('grid.insertRowSuccess') || 'Fila insertada correctamente');
    setTimeout(() => setSuccessToast(null), 3000);

    if (onRowInserted) {
      onRowInserted(mappedRow, sql);
    }
  };

  const handleDeleteRowClick = (row: Record<string, any>, index: number) => {
    setRowContextMenu(null);
    setRowToDelete({ row, index });
  };

  const handleConfirmDelete = async () => {
    if (!rowToDelete || !targetTableInfo || !result) return;
    setIsDeleting(true);

    try {
      const res = await window.electronAPI.deleteRow({
        db: targetTableInfo.db,
        table: targetTableInfo.table,
        row: rowToDelete.row,
        fieldsMeta: result.fieldsMeta
      });

      if (res.success && res.data) {
        const idx = result.rows.indexOf(rowToDelete.row);
        if (idx !== -1) {
          result.rows.splice(idx, 1);
          result.rowCount = Math.max(0, (result.rowCount || 1) - 1);
          setMutationEpoch(v => v + 1);
        }

        setSuccessToast(
          res.data.usedStrategy === 'primary_key'
            ? (t('grid.deleteRowSuccessPk') || 'Fila eliminada con éxito (usando Clave Primaria).')
            : (t('grid.deleteRowSuccessVerified') || 'Fila eliminada con éxito (unicidad verificada).')
        );
        setTimeout(() => setSuccessToast(null), 3000);

        if (onRowDeleted) {
          onRowDeleted(rowToDelete.row, res.data.sql);
        }

        setRowToDelete(null);
      } else {
        setSafetyError(res.error || 'Error al eliminar la fila en la tabla.');
        setRowToDelete(null);
      }
    } catch (err: any) {
      setSafetyError(err.message || 'Error inesperado al intentar eliminar la fila.');
      setRowToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, row: Record<string, any>, index: number) => {
    e.preventDefault();
    setRowContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 200),
      row,
      index
    });
  };

  const handleCopyRowJson = (row: Record<string, any>) => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setSuccessToast(t('common.copied') || 'Copiado al portapapeles');
    setTimeout(() => setSuccessToast(null), 2000);
    setRowContextMenu(null);
  };

  const handleCopyRowSql = (row: Record<string, any>) => {
    if (!result) return;
    const tbl = targetTableInfo?.table || 'tabla';
    const sql = exportToSqlInserts(tbl, result.columns, [row]);
    navigator.clipboard.writeText(sql);
    setSuccessToast(t('common.copied') || 'Copiado al portapapeles');
    setTimeout(() => setSuccessToast(null), 2000);
    setRowContextMenu(null);
  };

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
  }, [result?.rows, filterText, sortCol, sortAsc, mutationEpoch]);

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

  const handleExport = async (type: 'csv' | 'json' | 'sql' | 'xlsx') => {
    setShowExportMenu(false);
    if (!result?.rows || result.rows.length === 0) return;

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `export_mariatomamate_${timestamp}.${type}`;

    if (type === 'xlsx') {
      setIsExportingXlsx(true);
      try {
        const uint8 = await exportToXlsx(result.columns, filteredAndSortedRows);
        // IPC serializes Uint8Array as a plain object; convert to number[] explicitly
        const asArray = Array.from(uint8);
        if (window.electronAPI?.exportData) {
          await window.electronAPI.exportData(asArray, filename, 'xlsx');
        }
      } finally {
        setIsExportingXlsx(false);
      }
      return;
    }

    let content = '';
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

          {/* Editable badge indicator */}
          {hasPrimaryKey ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[11px]" title={t('grid.editablePkTooltip')}>
              <Key className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{t('grid.editablePkBadge')}</span>
            </div>
          ) : hasEditableTable ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800/80 text-zinc-400 border border-zinc-700/80 rounded text-[11px]" title={t('grid.editableVerifiedTooltip')}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{t('grid.editableVerifiedBadge')}</span>
            </div>
          ) : null}

          {/* Insert Row Action Button */}
          {hasEditableTable && targetTableInfo && (
            <button
              type="button"
              onClick={() => handleOpenInsertModal()}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs transition-colors shrink-0 ml-1"
              title={t('grid.insertRowTitle') || 'Insertar nueva fila'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('grid.insertRow') || 'Insertar fila'}</span>
            </button>
          )}

          {/* Success notification */}
          {successToast && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded text-[11px] animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}
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
              disabled={isExportingXlsx}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-wait text-zinc-200 rounded border border-zinc-700 transition-colors"
            >
              {isExportingXlsx ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isExportingXlsx ? t('grid.exportingXlsx') : t('grid.export')}</span>
            </button>

            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowExportMenu(false)} 
                />
                <div className="absolute right-0 mt-1 z-30 w-52 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 divide-y divide-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    title="Exportar como planilla de Excel (.xlsx)"
                  >
                    <Table2 className="w-4 h-4 text-green-400" />
                    <div className="flex flex-col">
                      <span>{t('grid.exportXlsx')}</span>
                      <span className="text-[10px] text-zinc-500">Excel (.xlsx)</span>
                    </div>
                  </button>
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
              {result.columns.map((col) => {
                const meta = result.fieldsMeta?.find(f => f.name === col);
                const isPk = Boolean(meta?.isPrimary);
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-1.5 text-zinc-300 font-semibold border-r border-zinc-800 cursor-pointer hover:bg-zinc-800/80 transition-colors whitespace-nowrap group select-none"
                    title={isPk ? `${col} (${t('grid.editablePkBadge') || 'Clave Primaria'})` : col}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isPk && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                        <span>{col}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">
                        {sortCol === col ? (sortAsc ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/80 text-zinc-300">
            {paginatedRows.map((row, idx) => {
              const rowIndex = (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr 
                  key={idx} 
                  onContextMenu={(e) => handleRowContextMenu(e, row, rowIndex)}
                  className="hover:bg-zinc-900/60 transition-colors group/row"
                >
                  <td className="w-10 px-2 py-1 text-center text-zinc-500 border-r border-zinc-900 bg-zinc-950/40 select-none relative group/rowno">
                    {hasEditableTable ? (
                      <>
                        <span className="group-hover/rowno:hidden">{rowIndex}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRowClick(row, rowIndex);
                          }}
                          className="hidden group-hover/rowno:inline-flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors"
                          title={t('grid.deleteRow') || 'Eliminar fila'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      rowIndex
                    )}
                  </td>
                  {result.columns.map((col) => {
                    const rawVal = row[col];
                    const isNull = rawVal === null || rawVal === undefined;
                    const cellKey = `${rowIndex}_${col}`;
                    const isCopied = copiedCell === cellKey;
                    const valStr = isNull ? 'NULL' : String(rawVal);
                    const isLongText = valStr.length > 50 || valStr.includes('\n');
                    const colMeta = result.fieldsMeta?.find(f => f.name === col);
                    const isEditable = Boolean(colMeta && colMeta.orgTable);
                    const isEditing = editingCell?.row === row && editingCell?.col === col;
                    const isFlashed = flashCell?.row === row && flashCell?.col === col;

                    if (isEditing) {
                      return (
                        <td
                          key={col}
                          className="p-1 border-r border-emerald-500/80 bg-zinc-900 min-w-[170px] relative z-20 shadow-inner"
                        >
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              disabled={editingCell.isSaving}
                              value={editingCell.isNull ? '' : editingCell.val}
                              placeholder={editingCell.isNull ? 'NULL' : ''}
                              onChange={(e) => {
                                setEditingCell({
                                  ...editingCell,
                                  isNull: false,
                                  val: e.target.value
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCommitCell();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingCell(null);
                                }
                              }}
                              className={`w-full px-2 py-0.5 text-xs font-mono rounded bg-zinc-950 border focus:outline-none transition-all ${
                                editingCell.isNull
                                  ? 'text-amber-400 italic placeholder-amber-400/60 border-amber-500/60'
                                  : 'text-zinc-100 border-emerald-500'
                              }`}
                            />
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={editingCell.isSaving}
                                onClick={() => setEditingCell(prev => prev ? {
                                  ...prev,
                                  isNull: !prev.isNull,
                                  val: prev.isNull ? '' : prev.val
                                } : null)}
                                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                                  editingCell.isNull
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                                }`}
                                title={editingCell.isNull ? t('grid.unsetNull') : t('grid.setNull')}
                              >
                                NULL
                              </button>
                              <button
                                type="button"
                                disabled={editingCell.isSaving}
                                onClick={handleCommitCell}
                                className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded disabled:opacity-50 transition-colors"
                                title={t('grid.saveEdit') || 'Guardar cambios (Enter)'}
                              >
                                {editingCell.isSaving ? (
                                  <div className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={editingCell.isSaving}
                                onClick={() => setEditingCell(null)}
                                className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded disabled:opacity-50 transition-colors"
                                title={t('grid.cancelEdit') || 'Cancelar (Esc)'}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col}
                        onDoubleClick={() => {
                          if (isEditable) {
                            handleStartEdit(row, col);
                          }
                        }}
                        className={`px-3 py-1 border-r border-zinc-900/80 whitespace-nowrap max-w-xs truncate group relative transition-colors ${
                          isNull ? 'text-zinc-600 italic' : ''
                        } ${
                          isFlashed ? 'bg-emerald-500/30 text-emerald-200 font-semibold' : ''
                        } ${
                          isEditable ? 'cursor-pointer hover:bg-zinc-800/40' : ''
                        }`}
                        title={isEditable ? `${valStr} (${t('grid.editCellTooltip') || 'Doble clic para modificar'})` : valStr}
                      >
                        <span>{valStr}</span>

                        {/* Quick cell actions on hover */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-zinc-800/95 border border-zinc-700/80 px-1 py-0.5 rounded shadow-lg select-none z-10">
                          {isEditable && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(row, col);
                              }}
                              className="p-1 hover:text-emerald-400 text-zinc-400 rounded transition-colors"
                              title={t('grid.editCell') || 'Modificar valor'}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {hasEditableTable && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenInsertModal(row);
                                }}
                                className="p-1 hover:text-blue-400 text-zinc-400 rounded transition-colors"
                                title={t('grid.duplicateRow') || 'Duplicar fila'}
                              >
                                <CopyPlus className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRowClick(row, rowIndex);
                                }}
                                className="p-1 hover:text-red-400 text-zinc-400 rounded transition-colors"
                                title={t('grid.deleteRow') || 'Eliminar fila'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(valStr, cellKey);
                            }}
                            className="p-1 hover:text-emerald-400 text-zinc-400 rounded transition-colors"
                            title={t('common.copy')}
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {isLongText && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCellModalValue({ col, value: rawVal });
                              }}
                              className="p-1 hover:text-amber-400 text-zinc-400 rounded transition-colors"
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

      {/* Safety / Error Dialog */}
      {safetyError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-zinc-200">
            <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-semibold text-xs tracking-wide uppercase">{t('grid.safetyDialogTitle')}</h3>
              </div>
              <button
                onClick={() => setSafetyError(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs leading-relaxed text-zinc-300">
              <p className="whitespace-pre-wrap font-sans text-red-300 bg-red-950/30 p-2.5 rounded-lg border border-red-900/40">
                {safetyError}
              </p>
              <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 leading-normal">
                {t('grid.safetyDialogNote')}
              </div>
            </div>
            <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSafetyError(null)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert / Duplicate Row Modal */}
      {hasEditableTable && targetTableInfo && (
        <InsertRowModal
          isOpen={isInsertModalOpen}
          onClose={() => {
            setIsInsertModalOpen(false);
            setDuplicateRowValues(null);
          }}
          tableName={targetTableInfo.table}
          database={targetTableInfo.db}
          columns={result.columns}
          fieldsMeta={result.fieldsMeta}
          initialValues={duplicateRowValues}
          onSuccess={handleRowInserted}
        />
      )}

      {/* Delete Row Confirmation Dialog */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-red-500/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-zinc-200">
            <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h3 className="font-semibold text-xs tracking-wide uppercase">
                  {t('grid.deleteRowConfirmTitle') || '¿Eliminar fila?'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                disabled={isDeleting}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs leading-relaxed text-zinc-300">
              <p>
                {t('grid.deleteRowConfirmDesc') || 'Esta acción ejecutará una sentencia DELETE permanente en la base de datos.'}
              </p>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1 font-mono text-[11px]">
                <div className="text-zinc-500 font-sans">
                  Fila: <span className="text-zinc-300 font-semibold">#{rowToDelete.index}</span>
                  {targetTableInfo && (
                    <span className="ml-2 text-emerald-400 font-mono">
                      ({targetTableInfo.db ? `${targetTableInfo.db}.${targetTableInfo.table}` : targetTableInfo.table})
                    </span>
                  )}
                </div>
                <div className="text-zinc-400 max-h-32 overflow-y-auto pt-1 space-y-0.5">
                  {result.columns.slice(0, 5).map(c => (
                    <div key={c} className="truncate">
                      <span className="text-zinc-500">{c}:</span>{' '}
                      <span className="text-zinc-200">{String(rowToDelete.row[c] ?? 'NULL')}</span>
                    </div>
                  ))}
                  {result.columns.length > 5 && (
                    <div className="text-zinc-600 italic">... y {result.columns.length - 5} columnas más</div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
              >
                {t('common.cancel') || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('grid.deleteRow') || 'Eliminar fila'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Row Context Menu */}
      {rowContextMenu && (
        <div 
          style={{ top: rowContextMenu.y, left: rowContextMenu.x }}
          className="fixed z-50 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 divide-y divide-zinc-800 text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          <div className="px-3 py-1.5 text-[11px] font-bold text-zinc-400 font-mono truncate border-b border-zinc-800 flex items-center justify-between">
            <span>Fila #{rowContextMenu.index}</span>
            {targetTableInfo && (
              <span className="text-[10px] text-emerald-400 font-normal">{targetTableInfo.table}</span>
            )}
          </div>
          {hasEditableTable && (
            <div className="py-1">
              <button
                onClick={() => {
                  handleOpenInsertModal(rowContextMenu.row);
                  setRowContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left text-zinc-200 hover:text-white transition-colors"
              >
                <CopyPlus className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('grid.duplicateRow') || 'Duplicar fila'}</span>
              </button>
              <button
                onClick={() => {
                  handleDeleteRowClick(rowContextMenu.row, rowContextMenu.index);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-950/50 text-left text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>{t('grid.deleteRow') || 'Eliminar fila'}</span>
              </button>
            </div>
          )}
          <div className="py-1">
            <button
              onClick={() => handleCopyRowJson(rowContextMenu.row)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left text-zinc-300 hover:text-white transition-colors"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('grid.copyRowJson') || 'Copiar fila como JSON'}</span>
            </button>
            <button
              onClick={() => handleCopyRowSql(rowContextMenu.row)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left text-zinc-300 hover:text-white transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('grid.copyRowSql') || 'Copiar como INSERT'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
