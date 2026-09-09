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
