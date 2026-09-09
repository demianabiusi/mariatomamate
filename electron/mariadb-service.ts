import mysql from 'mysql2/promise';

export interface MySqlConnectionOptions {
  id?: string;
  name?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database?: string;
  charset?: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  connectTimeout?: number;
}

export interface MySqlTableColumn {
  columnName: string;
  position: number;
  fieldType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
  comment?: string;
  collation?: string;
}

export interface MySqlTableIndex {
  name: string;
  unique: boolean;
  fields: string[];
  type: string;
}

export interface MySqlForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  updateRule?: string;
  deleteRule?: string;
}

export interface MySqlTableDetails {
  tableName: string;
  database: string;
  engine?: string;
  rows?: number;
  columns: MySqlTableColumn[];
  indices: MySqlTableIndex[];
  foreignKeys: MySqlForeignKey[];
  triggers: { name: string; event: string; timing: string }[];
  ddl: string;
}

export class MariaDbService {
  private activeConnection: mysql.Connection | null = null;
  private currentConfig: MySqlConnectionOptions | null = null;

  public isConnected(): boolean {
    return this.activeConnection !== null;
  }

  public getCurrentConfig(): MySqlConnectionOptions | null {
    return this.currentConfig;
  }

  private buildConnectionConfig(options: MySqlConnectionOptions): mysql.ConnectionOptions {
    const config: mysql.ConnectionOptions = {
      host: options.host || '127.0.0.1',
      port: Number(options.port) || 3306,
      user: options.user || 'root',
      password: options.password || '',
      charset: options.charset || 'UTF8MB4',
      multipleStatements: true,
      decimalNumbers: true,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      connectTimeout: options.connectTimeout || 10000
    };

    if (options.database && options.database.trim()) {
      config.database = options.database.trim();
    }

    if (options.ssl) {
      config.ssl = typeof options.ssl === 'object' ? options.ssl : { rejectUnauthorized: false };
    }

    return config;
  }

  public async testConnection(options: MySqlConnectionOptions): Promise<{
    success: boolean;
    message: string;
    pingMs: number;
    serverVersion?: string;
  }> {
    const start = Date.now();
    let conn: mysql.Connection | null = null;
    try {
      const connConfig = this.buildConnectionConfig(options);
      conn = await mysql.createConnection(connConfig);
      
      const [rows] = await conn.query('SELECT VERSION() AS version, CURRENT_USER() AS user');
      const pingMs = Date.now() - start;
      const version = Array.isArray(rows) && (rows[0] as any)?.version ? String((rows[0] as any).version) : '';
      
      await conn.end();
      return {
        success: true,
        message: `¡Conexión exitosa a ${version ? `MariaDB/MySQL v${version}` : 'la base de datos'}!`,
        pingMs,
        serverVersion: version
      };
    } catch (err: any) {
      const pingMs = Date.now() - start;
      if (conn) {
        try { await conn.end(); } catch {}
      }
      return {
        success: false,
        message: err.message || String(err),
        pingMs
      };
    }
  }

  public async connect(options: MySqlConnectionOptions): Promise<void> {
    if (this.activeConnection) {
      await this.disconnect();
    }

    const connConfig = this.buildConnectionConfig(options);
    const conn = await mysql.createConnection(connConfig);

    // Keep connection alive with error listener
    conn.on('error', (err) => {
      console.error('MySQL connection error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        this.activeConnection = null;
      }
    });

    this.activeConnection = conn;
    this.currentConfig = { ...options };

    // If database wasn't specified, pick the first non-system DB if available
    if (!this.currentConfig.database) {
      try {
        const dbs = await this.getDatabases();
        const nonSystem = dbs.find(d => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(d.toLowerCase()));
        if (nonSystem) {
          await this.switchDatabase(nonSystem);
        }
      } catch {
        // Ignore if error listing DBs initially
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.activeConnection) return;
    try {
      await this.activeConnection.end();
    } catch (err) {
      console.warn('Error closing connection:', err);
    } finally {
      this.activeConnection = null;
      this.currentConfig = null;
    }
  }

  public async switchDatabase(databaseName: string): Promise<void> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }
    const cleanDb = databaseName.replace(/`/g, '');
    await this.activeConnection.query(`USE \`${cleanDb}\`;`);
    if (this.currentConfig) {
      this.currentConfig.database = cleanDb;
    }
  }

  public async getDatabases(): Promise<string[]> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }
    const [rows] = await this.activeConnection.query('SHOW DATABASES;');
    if (!Array.isArray(rows)) return [];
    return rows.map((r: any) => Object.values(r)[0] as string).filter(Boolean);
  }

  public async createDatabase(options: { name: string; charset?: string; collation?: string }): Promise<{ database: string }> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }
    const cleanName = options.name.trim().replace(/`/g, '');
    if (!cleanName) {
      throw new Error('El nombre de la base de datos no puede estar vacío.');
    }
    const charset = options.charset || 'utf8mb4';
    const collation = options.collation || (charset === 'utf8mb4' ? 'utf8mb4_unicode_ci' : `${charset}_general_ci`);

    const sql = `CREATE DATABASE \`${cleanName}\` CHARACTER SET ${charset} COLLATE ${collation};`;
    await this.activeConnection.query(sql);
    await this.switchDatabase(cleanName);
    return { database: cleanName };
  }

  public async dropDatabase(name: string): Promise<void> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }
    const cleanName = name.trim().replace(/`/g, '');
    await this.activeConnection.query(`DROP DATABASE \`${cleanName}\`;`);
    if (this.currentConfig?.database === cleanName) {
      this.currentConfig.database = undefined;
    }
  }

  private formatValue(val: any): any {
    if (val === null || val === undefined) return null;
    if (Buffer.isBuffer(val)) {
      try {
        const text = val.toString('utf-8');
        // If printable ASCII/Unicode, return as text, otherwise binary representation
        if (/^[\x20-\x7E\s\u00A0-\uFFFF]*$/.test(text.substring(0, 100))) {
          return text;
        }
        return `[BLOB Binary ${val.length} bytes]`;
      } catch {
        return `[BLOB Binary ${val.length} bytes]`;
      }
    }
    if (typeof val === 'object' && !(val instanceof Date)) {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (typeof val === 'bigint') {
      return val.toString();
    }
    return val;
  }

  public async executeQuery(sql: string, maxRows: number = 1000): Promise<{
    columns: string[];
    rows: Record<string, any>[];
    rowCount: number;
    affectedRows?: number;
    insertId?: number | string;
    executionTimeMs: number;
    sql: string;
    hasMore?: boolean;
    messages?: string[];
  }> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa a la base de datos MariaDB / MySQL.');
    }

    const trimmed = sql.trim();
    if (!trimmed) {
      throw new Error('La consulta está vacía.');
    }

    // Check if switching database via query (e.g. USE db;)
    const useMatch = trimmed.match(/^USE\s+[`"']?([a-zA-Z0-9_$]+)[`"']?\s*;?$/i);
    if (useMatch) {
      const db = useMatch[1];
      await this.switchDatabase(db);
      return {
        columns: ['RESULTADO'],
        rows: [{ RESULTADO: `Base de datos cambiada a '${db}'` }],
        rowCount: 1,
        affectedRows: 0,
        executionTimeMs: 0,
        sql: trimmed
      };
    }

    const startTime = Date.now();
    try {
      const [rawResult, fields] = await this.activeConnection.query(trimmed);
      const executionTimeMs = Date.now() - startTime;

      // When multiple statements run, rawResult is an array of resultsets
      let mainResult: any = rawResult;
      let fieldDefs: any = fields;
      if (Array.isArray(rawResult) && rawResult.length > 0 && Array.isArray(rawResult[0])) {
        // Pick the last SELECT resultset or the first result
        let selectIndex = -1;
        const arr = rawResult as any[];
        for (let i = arr.length - 1; i >= 0; i--) {
          if (Array.isArray(arr[i])) {
            selectIndex = i;
            break;
          }
        }
        if (selectIndex >= 0) {
          mainResult = arr[selectIndex];
          if (Array.isArray(fields) && fields[selectIndex]) {
            fieldDefs = (fields as any[])[selectIndex];
          }
        }
      }

      // If it's an array of rows (SELECT / SHOW / DESCRIBE / EXPLAIN)
      if (Array.isArray(mainResult)) {
        const rows = mainResult as any[];
        const hasMore = rows.length > maxRows;
        const slicedRows = hasMore ? rows.slice(0, maxRows) : rows;

        let columns: string[] = [];
        if (Array.isArray(fieldDefs) && fieldDefs.length > 0) {
          columns = (fieldDefs as any[]).map(f => f.name || String(f));
        } else if (slicedRows.length > 0) {
          columns = Object.keys(slicedRows[0]);
        }

        const formattedRows = slicedRows.map(row => {
          const item: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            item[key] = this.formatValue(row[key]);
          }
          return item;
        });

        return {
          columns,
          rows: formattedRows,
          rowCount: formattedRows.length,
          executionTimeMs,
          sql: trimmed,
          hasMore
        };
      }

      // If it's an OkPacket / ResultSetHeader (INSERT / UPDATE / DELETE / DDL)
      const header = mainResult as any;
      const affectedRows = typeof header?.affectedRows === 'number' ? header.affectedRows : 0;
      const insertId = header?.insertId;
      const message = header?.message || `Operación completada con éxito. Filas afectadas: ${affectedRows}${insertId ? ` (ID generado: ${insertId})` : ''}`;

      return {
        columns: ['RESULTADO'],
        rows: [{ RESULTADO: message }],
        rowCount: 1,
        affectedRows,
        insertId: insertId || undefined,
        executionTimeMs,
        sql: trimmed
      };
    } catch (err: any) {
      throw new Error(err.message || String(err));
    }
  }

  public splitSqlStatements(script: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inBlockComment = false;
    let inLineComment = false;
    let delimiter = ';';

    const lines = script.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      const delimMatch = trimmedLine.match(/^DELIMITER\s+(.+)$/i);
      if (delimMatch && !inBlockComment) {
        delimiter = delimMatch[1].trim();
        continue;
      }

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1] || '';

        // Line comments: -- or #
        if (!inSingleQuote && !inDoubleQuote && !inBacktick && !inBlockComment) {
          if ((char === '-' && nextChar === '-') || char === '#') {
            inLineComment = true;
            break;
          }
        }

        // Block comments /* */
        if (!inSingleQuote && !inDoubleQuote && !inBacktick && !inLineComment && char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
        if (inBlockComment) {
          if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            i++;
          }
          continue;
        }

        // Quotes
        if (char === "'" && !inDoubleQuote && !inBacktick) {
          if (line[i - 1] !== '\\') inSingleQuote = !inSingleQuote;
          current += char;
          continue;
        }
        if (char === '"' && !inSingleQuote && !inBacktick) {
          if (line[i - 1] !== '\\') inDoubleQuote = !inDoubleQuote;
          current += char;
          continue;
        }
        if (char === '`' && !inSingleQuote && !inDoubleQuote) {
          inBacktick = !inBacktick;
          current += char;
          continue;
        }

        // Delimiter check
        if (!inSingleQuote && !inDoubleQuote && !inBacktick && !inBlockComment) {
          if (line.substring(i, i + delimiter.length) === delimiter) {
            if (current.trim()) {
              statements.push(current.trim());
            }
            current = '';
            i += delimiter.length - 1;
            continue;
          }
        }

        current += char;
      }

      if (!inBlockComment && !inLineComment) {
        current += '\n';
      }
      inLineComment = false;
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  public async executeScript(script: string): Promise<{ statementsExecuted: number; results: any[] }> {
    const statements = this.splitSqlStatements(script);
    const results: any[] = [];

    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      const res = await this.executeQuery(stmt);
      results.push(res);
    }

    return {
      statementsExecuted: results.length,
      results
    };
  }

  public async getSchemaObjects(): Promise<{
    databases: string[];
    currentDatabase: string | null;
    tables: string[];
    views: string[];
    procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
    functions: { name: string; returnType?: string }[];
    triggers: { name: string; table: string; event: string; timing: string }[];
    events: string[];
    columnsByTable: Record<string, string[]>;
  }> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }

    const currentDb = this.currentConfig?.database || null;
    const databases = await this.getDatabases();

    if (!currentDb) {
      return {
        databases,
        currentDatabase: null,
        tables: [],
        views: [],
        procedures: [],
        functions: [],
        triggers: [],
        events: [],
        columnsByTable: {}
      };
    }

    // 1. Tables and Views
    const [fullTablesRows] = await this.activeConnection.query(`SHOW FULL TABLES FROM \`${currentDb}\`;`);
    const tables: string[] = [];
    const views: string[] = [];

    if (Array.isArray(fullTablesRows)) {
      for (const row of fullTablesRows as any[]) {
        const values = Object.values(row);
        const name = values[0] as string;
        const type = (values[1] as string) || 'BASE TABLE';
        if (type.toUpperCase().includes('VIEW')) {
          views.push(name);
        } else {
          tables.push(name);
        }
      }
    }

    // 2. Procedures and Functions
    const [routinesRows] = await this.activeConnection.query(
      `SELECT ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = ? 
       ORDER BY ROUTINE_NAME;`,
      [currentDb]
    );

    const procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[] = [];
    const functions: { name: string; returnType?: string }[] = [];

    if (Array.isArray(routinesRows)) {
      for (const r of routinesRows as any[]) {
        if (r.ROUTINE_TYPE === 'PROCEDURE') {
          procedures.push({
            name: r.ROUTINE_NAME,
            inputs: 0,
            outputs: 0,
            inputParams: []
          });
        } else if (r.ROUTINE_TYPE === 'FUNCTION') {
          functions.push({
            name: r.ROUTINE_NAME,
            returnType: r.DTD_IDENTIFIER || 'VARCHAR'
          });
        }
      }
    }

    // Procedure parameters lookup from information_schema.PARAMETERS
    try {
      const [paramRows] = await this.activeConnection.query(
        `SELECT SPECIFIC_NAME, PARAMETER_NAME, PARAMETER_MODE 
         FROM information_schema.PARAMETERS 
         WHERE SPECIFIC_SCHEMA = ? AND PARAMETER_NAME IS NOT NULL
         ORDER BY SPECIFIC_NAME, ORDINAL_POSITION;`,
        [currentDb]
      );
      if (Array.isArray(paramRows)) {
        for (const p of paramRows as any[]) {
          const proc = procedures.find(pr => pr.name === p.SPECIFIC_NAME);
          if (proc) {
            if (!proc.inputParams) proc.inputParams = [];
            proc.inputParams.push(p.PARAMETER_NAME);
            if (p.PARAMETER_MODE === 'IN' || p.PARAMETER_MODE === 'INOUT') proc.inputs++;
            if (p.PARAMETER_MODE === 'OUT' || p.PARAMETER_MODE === 'INOUT') proc.outputs++;
          }
        }
      }
    } catch {
      // Ignore if user lacks permissions on parameters
    }

    // 3. Triggers
    const [triggersRows] = await this.activeConnection.query(
      `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING 
       FROM information_schema.TRIGGERS 
       WHERE TRIGGER_SCHEMA = ? 
       ORDER BY TRIGGER_NAME;`,
      [currentDb]
    );
    const triggers: { name: string; table: string; event: string; timing: string }[] = [];
    if (Array.isArray(triggersRows)) {
      for (const t of triggersRows as any[]) {
        triggers.push({
          name: t.TRIGGER_NAME,
          table: t.EVENT_OBJECT_TABLE,
          event: t.EVENT_MANIPULATION,
          timing: t.ACTION_TIMING
        });
      }
    }

    // 4. Events
    let events: string[] = [];
    try {
      const [eventRows] = await this.activeConnection.query(
        `SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ? ORDER BY EVENT_NAME;`,
        [currentDb]
      );
      if (Array.isArray(eventRows)) {
        events = (eventRows as any[]).map(e => e.EVENT_NAME);
      }
    } catch {
      // Events might not be enabled or user lacks grant
    }

    // 5. Columns by table (for autocomplete)
    const columnsByTable: Record<string, string[]> = {};
    try {
      const [colRows] = await this.activeConnection.query(
        `SELECT TABLE_NAME, COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
        [currentDb]
      );
      if (Array.isArray(colRows)) {
        for (const c of colRows as any[]) {
          const tName = c.TABLE_NAME;
          const cName = c.COLUMN_NAME;
          if (!columnsByTable[tName]) columnsByTable[tName] = [];
          columnsByTable[tName].push(cName);
        }
      }
    } catch {
      // Fallback
    }

    return {
      databases,
      currentDatabase: currentDb,
      tables,
      views,
      procedures,
      functions,
      triggers,
      events,
      columnsByTable
    };
  }

  public async getTableDetails(tableName: string): Promise<MySqlTableDetails> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }
    const currentDb = this.currentConfig?.database;
    if (!currentDb) {
      throw new Error('No hay base de datos seleccionada.');
    }

    const cleanTable = tableName.trim().replace(/`/g, '');

    // 1. Columns
    const [cols] = await this.activeConnection.query(
      `SELECT 
         COLUMN_NAME, 
         ORDINAL_POSITION, 
         COLUMN_TYPE, 
         IS_NULLABLE, 
         COLUMN_DEFAULT, 
         COLUMN_KEY, 
         EXTRA, 
         COLUMN_COMMENT, 
         COLLATION_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
       ORDER BY ORDINAL_POSITION;`,
      [currentDb, cleanTable]
    );

    const columns: MySqlTableColumn[] = (cols as any[]).map(c => ({
      columnName: c.COLUMN_NAME,
      position: Number(c.ORDINAL_POSITION),
      fieldType: c.COLUMN_TYPE.toUpperCase(),
      isNullable: c.IS_NULLABLE === 'YES',
      defaultValue: c.COLUMN_DEFAULT !== null ? String(c.COLUMN_DEFAULT) : null,
      isPrimaryKey: c.COLUMN_KEY === 'PRI',
      isAutoIncrement: (c.EXTRA || '').toLowerCase().includes('auto_increment'),
      isUnique: c.COLUMN_KEY === 'UNI',
      comment: c.COLUMN_COMMENT || undefined,
      collation: c.COLLATION_NAME || undefined
    }));

    // 2. Indexes
    const [idxRows] = await this.activeConnection.query(`SHOW INDEX FROM \`${currentDb}\`.\`${cleanTable}\`;`);
    const indicesMap = new Map<string, { name: string; unique: boolean; fields: string[]; type: string }>();
    if (Array.isArray(idxRows)) {
      for (const row of idxRows as any[]) {
        const keyName = row.Key_name;
        const nonUnique = row.Non_unique;
        const colName = row.Column_name;
        const indexType = row.Index_type || 'BTREE';

        if (!indicesMap.has(keyName)) {
          indicesMap.set(keyName, {
            name: keyName,
            unique: Number(nonUnique) === 0,
            fields: [],
            type: indexType
          });
        }
        if (colName) {
          indicesMap.get(keyName)!.fields.push(colName);
        }
      }
    }

    // 3. Foreign Keys
    const [fkRows] = await this.activeConnection.query(
      `SELECT 
         k.CONSTRAINT_NAME, 
         k.COLUMN_NAME, 
         k.REFERENCED_TABLE_NAME, 
         k.REFERENCED_COLUMN_NAME, 
         r.UPDATE_RULE, 
         r.DELETE_RULE 
       FROM information_schema.KEY_COLUMN_USAGE k
       LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r 
         ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
       WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL;`,
      [currentDb, cleanTable]
    );

    const foreignKeys: MySqlForeignKey[] = (fkRows as any[]).map(f => ({
      name: f.CONSTRAINT_NAME,
      column: f.COLUMN_NAME,
      referencedTable: f.REFERENCED_TABLE_NAME,
      referencedColumn: f.REFERENCED_COLUMN_NAME,
      updateRule: f.UPDATE_RULE,
      deleteRule: f.DELETE_RULE
    }));

    // 4. Triggers
    const [trigRows] = await this.activeConnection.query(
      `SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING 
       FROM information_schema.TRIGGERS 
       WHERE TRIGGER_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?;`,
      [currentDb, cleanTable]
    );
    const triggers = (trigRows as any[]).map(t => ({
      name: t.TRIGGER_NAME,
      event: t.EVENT_MANIPULATION,
      timing: t.ACTION_TIMING
    }));

    // 5. Native DDL from SHOW CREATE TABLE
    let ddl = '';
    try {
      const [ddlRows] = await this.activeConnection.query(`SHOW CREATE TABLE \`${currentDb}\`.\`${cleanTable}\`;`);
      if (Array.isArray(ddlRows) && ddlRows[0]) {
        ddl = (ddlRows[0] as any)['Create Table'] || '';
      }
    } catch (err: any) {
      ddl = `-- Error al obtener DDL nativo: ${err.message}`;
    }

    // 6. Engine and Rows
    let engine = 'InnoDB';
    let rowsCount = 0;
    try {
      const [statusRows] = await this.activeConnection.query(
        `SELECT ENGINE, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?;`,
        [currentDb, cleanTable]
      );
      if (Array.isArray(statusRows) && statusRows[0]) {
        engine = (statusRows[0] as any).ENGINE || 'InnoDB';
        rowsCount = Number((statusRows[0] as any).TABLE_ROWS) || 0;
      }
    } catch {}

    return {
      tableName: cleanTable,
      database: currentDb,
      engine,
      rows: rowsCount,
      columns,
      indices: Array.from(indicesMap.values()),
      foreignKeys,
      triggers,
      ddl
    };
  }

  public async getObjectDdl(objectType: string, objectName: string): Promise<{ ddl: string; name: string; type: string }> {
    if (!this.activeConnection) {
      throw new Error('No hay conexión activa.');
    }
    const currentDb = this.currentConfig?.database;
    if (!currentDb) {
      throw new Error('No hay base de datos seleccionada.');
    }

    const cleanName = objectName.trim().replace(/`/g, '');
    const typeUpper = objectType.trim().toUpperCase();

    if (typeUpper === 'TABLE') {
      const details = await this.getTableDetails(cleanName);
      return { ddl: details.ddl, name: cleanName, type: 'TABLE' };
    }

    if (typeUpper === 'VIEW') {
      const [rows] = await this.activeConnection.query(`SHOW CREATE VIEW \`${currentDb}\`.\`${cleanName}\`;`);
      const ddl = (rows as any[])[0]?.['Create View'] || '';
      return { ddl, name: cleanName, type: 'VIEW' };
    }

    if (typeUpper === 'PROCEDURE') {
      const [rows] = await this.activeConnection.query(`SHOW CREATE PROCEDURE \`${currentDb}\`.\`${cleanName}\`;`);
      const ddl = (rows as any[])[0]?.['Create Procedure'] || '';
      return { ddl, name: cleanName, type: 'PROCEDURE' };
    }

    if (typeUpper === 'FUNCTION') {
      const [rows] = await this.activeConnection.query(`SHOW CREATE FUNCTION \`${currentDb}\`.\`${cleanName}\`;`);
      const ddl = (rows as any[])[0]?.['Create Function'] || '';
      return { ddl, name: cleanName, type: 'FUNCTION' };
    }

    if (typeUpper === 'TRIGGER') {
      const [rows] = await this.activeConnection.query(`SHOW CREATE TRIGGER \`${currentDb}\`.\`${cleanName}\`;`);
      const ddl = (rows as any[])[0]?.['SQL Original Statement'] || (rows as any[])[0]?.['Create Trigger'] || '';
      return { ddl, name: cleanName, type: 'TRIGGER' };
    }

    if (typeUpper === 'EVENT') {
      const [rows] = await this.activeConnection.query(`SHOW CREATE EVENT \`${currentDb}\`.\`${cleanName}\`;`);
      const ddl = (rows as any[])[0]?.['Create Event'] || '';
      return { ddl, name: cleanName, type: 'EVENT' };
    }

    throw new Error(`Tipo de objeto '${objectType}' no soportado.`);
  }
}
