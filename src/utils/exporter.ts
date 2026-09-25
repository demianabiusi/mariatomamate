export function exportToCsv(columns: string[], rows: Record<string, any>[]): string {
  const header = columns.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
  const lines = rows.map(row => {
    return columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });
  return [header, ...lines].join('\r\n');
}

export function exportToJson(rows: Record<string, any>[]): string {
  return JSON.stringify(rows, null, 2);
}

export function exportToSqlInserts(tableName: string, columns: string[], rows: Record<string, any>[]): string {
  const safeTable = tableName ? `\`${tableName.replace(/`/g, '')}\`` : '`tabla`';
  const colList = columns.map(c => `\`${c.replace(/`/g, '')}\``).join(', ');
  
  const insertStatements = rows.map(row => {
    const valList = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return String(val);
      if (typeof val === 'boolean') return val ? '1' : '0';
      return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }).join(', ');
    
    return `INSERT INTO ${safeTable} (${colList}) VALUES (${valList});`;
  });
  
  return insertStatements.join('\n');
}

/**
 * Generates an .xlsx workbook buffer using SheetJS.
 * Returns a Uint8Array that can be written to disk as a binary file.
 */
export async function exportToXlsx(
  columns: string[],
  rows: Record<string, any>[]
): Promise<Uint8Array> {
  // Dynamic import keeps xlsx out of the initial bundle chunk
  const XLSX = await import('xlsx');

  // Build array-of-arrays: header row + data rows
  const aoaData: any[][] = [
    columns, // header
    ...rows.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        // Keep numbers as numbers so Excel can aggregate them
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? 1 : 0;
        return String(val);
      })
    )
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Auto-fit column widths (cap at 60 chars)
  const colWidths = columns.map((col, ci) => {
    const maxLen = Math.max(
      col.length,
      ...rows.map(row => {
        const v = row[col];
        return v === null || v === undefined ? 0 : String(v).length;
      })
    );
    return { wch: Math.min(maxLen + 2, 60) };
  });
  ws['!cols'] = colWidths;

  // Freeze the header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');

  // Write as array buffer
  const buf: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buf);
}
