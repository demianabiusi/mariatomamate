import mysql from 'mysql2/promise';
import { SshTunnelService, SshTunnelConfig, ActiveSshTunnel } from './ssh-tunnel-service';
import { MariaDbService, MySqlConnectionOptions } from './mariadb-service';
import { createMysqlOldPasswordPlugin } from './mysql-old-password';

export interface ColumnMetadata {
  columnName: string;
  ordinalPosition: number;
  columnType: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
  comment?: string;
  collation?: string;
}

export interface IndexMetadata {
  name: string;
  unique: boolean;
  columns: string[];
  type: string;
}

export interface ForeignKeyMetadata {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  updateRule?: string;
  deleteRule?: string;
}

export interface TableMetadata {
  name: string;
  engine: string;
  collation: string;
  comment: string;
  columns: Record<string, ColumnMetadata>;
  orderedColumns: ColumnMetadata[];
  primaryKey: string[];
  indexes: Record<string, IndexMetadata>;
  foreignKeys: Record<string, ForeignKeyMetadata>;
  rawDdl: string;
}

export interface GenericObjectMetadata {
  name: string;
  type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT';
  rawDdl: string;
  extra?: Record<string, any>;
}

export interface DatabaseSchemaSnapshot {
  database: string;
  serverVersion: string;
  tables: Record<string, TableMetadata>;
  views: Record<string, GenericObjectMetadata>;
  procedures: Record<string, GenericObjectMetadata>;
  functions: Record<string, GenericObjectMetadata>;
  triggers: Record<string, GenericObjectMetadata>;
  events: Record<string, GenericObjectMetadata>;
}

export type DiffStatus = 'missing_in_target' | 'extra_in_target' | 'different' | 'identical';

export interface ColumnDiff {
  name: string;
  status: 'added' | 'removed' | 'modified';
  sourceCol?: ColumnMetadata;
  targetCol?: ColumnMetadata;
  details: string[];
  alterClause: string;
}

export interface IndexDiff {
  name: string;
  status: 'added' | 'removed' | 'modified';
  sourceIndex?: IndexMetadata;
  targetIndex?: IndexMetadata;
  alterClause: string;
}

export interface ForeignKeyDiff {
  name: string;
  status: 'added' | 'removed' | 'modified';
  sourceFk?: ForeignKeyMetadata;
  targetFk?: ForeignKeyMetadata;
  dropSql: string;
  addSql: string;
}

export interface TableDiff {
  name: string;
  status: DiffStatus;
  sourceTable?: TableMetadata;
  targetTable?: TableMetadata;
  columnDiffs: ColumnDiff[];
  indexDiffs: IndexDiff[];
  fkDiffs: ForeignKeyDiff[];
  optionsDiff: {
    engineChanged: boolean;
    sourceEngine?: string;
    targetEngine?: string;
    collationChanged: boolean;
    sourceCollation?: string;
    targetCollation?: string;
    commentChanged: boolean;
    sourceComment?: string;
    targetComment?: string;
  };
  createSql?: string;
  dropSql?: string;
}

export interface GenericObjectDiff {
  name: string;
  type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT';
  status: DiffStatus;
  sourceDdl?: string;
  targetDdl?: string;
  createSql?: string;
  dropSql?: string;
}

export interface SchemaDiffResult {
  sourceConnectionName: string;
  targetConnectionName: string;
  sourceDb: string;
  targetDb: string;
  tables: TableDiff[];
  views: GenericObjectDiff[];
  procedures: GenericObjectDiff[];
  functions: GenericObjectDiff[];
  triggers: GenericObjectDiff[];
  events: GenericObjectDiff[];
  summary: {
    totalDifferences: number;
    missingInTarget: number;
    extraInTarget: number;
    modified: number;
    identical: number;
  };
}

export interface DiffCompareOptions {
  ignoreComments?: boolean;
  ignoreCollation?: boolean;
  ignoreCase?: boolean;
}

export interface MigrationScriptOptions {
  selectedTables?: Record<string, boolean>; // tableName -> boolean
  selectedViews?: Record<string, boolean>;
  selectedProcedures?: Record<string, boolean>;
  selectedFunctions?: Record<string, boolean>;
  selectedTriggers?: Record<string, boolean>;
  selectedEvents?: Record<string, boolean>;
  includeDropTables?: boolean;
  includeDropColumns?: boolean;
  includeDropIndexes?: boolean;
  includeDropForeignKeys?: boolean;
  includeDropRoutines?: boolean;
  includeDropTriggers?: boolean;
  includeDropEvents?: boolean;
  targetDatabaseOverride?: string;
}

export interface CompareProgress {
  stage: 'connect_source' | 'inspect_source' | 'connect_target' | 'inspect_target' | 'diffing' | 'complete';
  percentage: number;
  message: string;
}

export interface MigrationProgress {
  totalStatements: number;
  executedStatements: number;
  percentage: number;
  currentStatementSnippet: string;
  errorsCount: number;
  message: string;
}

export interface SchemaCompareRequest {
  sourceConfig: MySqlConnectionOptions;
  sourceDatabase: string;
  targetConfig: MySqlConnectionOptions;
  targetDatabase: string;
  options?: DiffCompareOptions;
}

export class SchemaDiffService {
  private sshTunnelService: SshTunnelService = new SshTunnelService();

  constructor(private mariaDbService?: MariaDbService) {}

  /**
   * Helper to execute queries on a connection with automatic SSH tunnel handling and cleanup
   */
  private async withConnection<T>(
    options: MySqlConnectionOptions,
    database: string | undefined,
    callback: (conn: mysql.Connection) => Promise<T>
  ): Promise<T> {
    let tempTunnel: ActiveSshTunnel | null = null;
    let conn: mysql.Connection | null = null;

    try {
      let hostOverride: string | undefined;
      let portOverride: number | undefined;

      if (options.ssh && options.ssh.enabled) {
        tempTunnel = await this.sshTunnelService.createTunnel(
          options.ssh,
          options.host || '127.0.0.1',
          Number(options.port) || 3306
        );
        hostOverride = tempTunnel.localHost;
        portOverride = tempTunnel.localPort;
      }

      const connOptions: mysql.ConnectionOptions = {
        host: hostOverride || options.host || '127.0.0.1',
        port: portOverride || Number(options.port) || 3306,
        user: options.user || 'root',
        password: options.password || '',
        charset: options.charset || 'UTF8MB4',
        multipleStatements: true,
        connectTimeout: 12000,
        enableKeepAlive: true
      };

      if (database && database.trim()) {
        connOptions.database = database.trim();
      }

      if (options.ssl) {
        connOptions.ssl = typeof options.ssl === 'object' ? options.ssl : { rejectUnauthorized: false };
      }

      const oldPasswordPlugin = createMysqlOldPasswordPlugin();
      (connOptions as any).authPlugins = {
        mysql_old_password: oldPasswordPlugin,
        '': oldPasswordPlugin
      };

      conn = await mysql.createConnection(connOptions);
      return await callback(conn);
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch {}
      }
      if (tempTunnel) {
        try {
          await tempTunnel.close();
        } catch {}
      }
    }
  }

  /**
   * List all user databases for a given connection configuration
   */
  public async getDatabasesForConnection(options: MySqlConnectionOptions): Promise<string[]> {
    return this.withConnection(options, undefined, async (conn) => {
      const [rows] = await conn.query('SHOW DATABASES;');
      if (!Array.isArray(rows)) return [];
      
      const systemDbs = new Set(['information_schema', 'performance_schema', 'sys', 'mysql']);
      const allDbs: string[] = [];
      const userDbs: string[] = [];
      const sysDbs: string[] = [];

      for (const row of rows as any[]) {
        const db = String(Object.values(row)[0] || '');
        if (!db) continue;
        allDbs.push(db);
        if (systemDbs.has(db.toLowerCase())) {
          sysDbs.push(db);
        } else {
          userDbs.push(db);
        }
      }

      userDbs.sort((a, b) => a.localeCompare(b));
      sysDbs.sort((a, b) => a.localeCompare(b));
      return [...userDbs, ...sysDbs];
    });
  }

  /**
   * Captures a complete metadata snapshot of a database
   */
  public async getDatabaseSnapshot(
    options: MySqlConnectionOptions,
    database: string
  ): Promise<DatabaseSchemaSnapshot> {
    return this.withConnection(options, database, async (conn) => {
      // 1. Server version
      let serverVersion = '';
      try {
        const [verRows] = await conn.query('SELECT VERSION() AS ver;');
        serverVersion = (verRows as any[])[0]?.ver || '';
      } catch {}

      // 2. Full tables list (Tables and Views)
      const [fullTablesRows] = await conn.query(`SHOW FULL TABLES FROM \`${database}\`;`);
      const tableNames: string[] = [];
      const viewNames: string[] = [];

      if (Array.isArray(fullTablesRows)) {
        for (const row of fullTablesRows as any[]) {
          const values = Object.values(row) as string[];
          const name = values[0];
          const type = values[1];
          if (type === 'VIEW') {
            viewNames.push(name);
          } else {
            tableNames.push(name);
          }
        }
      }

      // 3. Batch fetch all table columns
      const [allCols] = await conn.query(
        `SELECT 
           TABLE_NAME,
           COLUMN_NAME, 
           ORDINAL_POSITION, 
           COLUMN_TYPE, 
           DATA_TYPE,
           IS_NULLABLE, 
           COLUMN_DEFAULT, 
           COLUMN_KEY, 
           EXTRA, 
           COLUMN_COMMENT, 
           COLLATION_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
        [database]
      );

      const columnsByTable: Record<string, ColumnMetadata[]> = {};
      if (Array.isArray(allCols)) {
        for (const c of allCols as any[]) {
          const tName = c.TABLE_NAME;
          if (!columnsByTable[tName]) {
            columnsByTable[tName] = [];
          }
          columnsByTable[tName].push({
            columnName: c.COLUMN_NAME,
            ordinalPosition: Number(c.ORDINAL_POSITION),
            columnType: String(c.COLUMN_TYPE || '').toUpperCase(),
            dataType: String(c.DATA_TYPE || '').toLowerCase(),
            isNullable: c.IS_NULLABLE === 'YES',
            columnDefault: c.COLUMN_DEFAULT !== null && c.COLUMN_DEFAULT !== undefined ? String(c.COLUMN_DEFAULT) : null,
            isPrimaryKey: c.COLUMN_KEY === 'PRI',
            isAutoIncrement: (c.EXTRA || '').toLowerCase().includes('auto_increment'),
            isUnique: c.COLUMN_KEY === 'UNI',
            comment: c.COLUMN_COMMENT || undefined,
            collation: c.COLLATION_NAME || undefined
          });
        }
      }

      // 4. Batch fetch table status (engine, collation, comments)
      const [tableStatusRows] = await conn.query(
        `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_COMMENT 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE';`,
        [database]
      );

      const tableStatusMap: Record<string, { engine: string; collation: string; comment: string }> = {};
      if (Array.isArray(tableStatusRows)) {
        for (const row of tableStatusRows as any[]) {
          tableStatusMap[row.TABLE_NAME] = {
            engine: row.ENGINE || 'InnoDB',
            collation: row.TABLE_COLLATION || '',
            comment: row.TABLE_COMMENT || ''
          };
        }
      }

      // 5. Batch fetch all indexes via information_schema.STATISTICS
      const [indexRows] = await conn.query(
        `SELECT 
           TABLE_NAME,
           INDEX_NAME,
           NON_UNIQUE,
           COLUMN_NAME,
           SEQ_IN_INDEX,
           INDEX_TYPE
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;`,
        [database]
      );

      const indexesByTable: Record<string, Record<string, IndexMetadata>> = {};
      if (Array.isArray(indexRows)) {
        for (const row of indexRows as any[]) {
          const tName = row.TABLE_NAME;
          const idxName = row.INDEX_NAME;
          if (!indexesByTable[tName]) {
            indexesByTable[tName] = {};
          }
          if (!indexesByTable[tName][idxName]) {
            indexesByTable[tName][idxName] = {
              name: idxName,
              unique: Number(row.NON_UNIQUE) === 0,
              columns: [],
              type: row.INDEX_TYPE || 'BTREE'
            };
          }
          if (row.COLUMN_NAME) {
            indexesByTable[tName][idxName].columns.push(row.COLUMN_NAME);
          }
        }
      }

      // 6. Batch fetch all foreign keys
      const [fkRows] = await conn.query(
        `SELECT 
           k.TABLE_NAME,
           k.CONSTRAINT_NAME, 
           k.COLUMN_NAME, 
           k.REFERENCED_TABLE_NAME, 
           k.REFERENCED_COLUMN_NAME, 
           r.UPDATE_RULE, 
           r.DELETE_RULE 
         FROM information_schema.KEY_COLUMN_USAGE k
         LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r 
           ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
         WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION;`,
        [database]
      );

      const fksByTable: Record<string, Record<string, ForeignKeyMetadata>> = {};
      if (Array.isArray(fkRows)) {
        for (const row of fkRows as any[]) {
          const tName = row.TABLE_NAME;
          const fkName = row.CONSTRAINT_NAME;
          if (!fksByTable[tName]) {
            fksByTable[tName] = {};
          }
          fksByTable[tName][fkName] = {
            name: fkName,
            column: row.COLUMN_NAME,
            referencedTable: row.REFERENCED_TABLE_NAME,
            referencedColumn: row.REFERENCED_COLUMN_NAME,
            updateRule: row.UPDATE_RULE || undefined,
            deleteRule: row.DELETE_RULE || undefined
          };
        }
      }

      // 7. Extract DDL for each table
      const tables: Record<string, TableMetadata> = {};
      for (const tName of tableNames) {
        let rawDdl = '';
        try {
          const [ddlRows] = await conn.query(`SHOW CREATE TABLE \`${database}\`.\`${tName}\`;`);
          if (Array.isArray(ddlRows) && ddlRows[0]) {
            rawDdl = (ddlRows[0] as any)['Create Table'] || '';
          }
        } catch (err: any) {
          rawDdl = `-- Error al obtener DDL: ${err.message}`;
        }

        const colsList = columnsByTable[tName] || [];
        const colsMap: Record<string, ColumnMetadata> = {};
        const pkCols: string[] = [];

        for (const col of colsList) {
          colsMap[col.columnName.toLowerCase()] = col;
          if (col.isPrimaryKey) {
            pkCols.push(col.columnName);
          }
        }

        const status = tableStatusMap[tName] || { engine: 'InnoDB', collation: '', comment: '' };
        const idxs = indexesByTable[tName] || {};
        const fks = fksByTable[tName] || {};

        tables[tName] = {
          name: tName,
          engine: status.engine,
          collation: status.collation,
          comment: status.comment,
          columns: colsMap,
          orderedColumns: colsList,
          primaryKey: pkCols,
          indexes: idxs,
          foreignKeys: fks,
          rawDdl
        };
      }

      // 8. Views
      const views: Record<string, GenericObjectMetadata> = {};
      for (const vName of viewNames) {
        let rawDdl = '';
        try {
          const [vRows] = await conn.query(`SHOW CREATE VIEW \`${database}\`.\`${vName}\`;`);
          if (Array.isArray(vRows) && vRows[0]) {
            rawDdl = (vRows[0] as any)['Create View'] || '';
          }
        } catch (err: any) {
          rawDdl = `-- Error al obtener DDL de vista: ${err.message}`;
        }
        views[vName] = {
          name: vName,
          type: 'VIEW',
          rawDdl
        };
      }

      // 9. Routines: Procedures & Functions
      const procedures: Record<string, GenericObjectMetadata> = {};
      const functions: Record<string, GenericObjectMetadata> = {};

      try {
        const [routineRows] = await conn.query(
          `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?;`,
          [database]
        );
        if (Array.isArray(routineRows)) {
          for (const r of routineRows as any[]) {
            const rName = r.ROUTINE_NAME;
            const rType = r.ROUTINE_TYPE;
            let ddl = '';
            try {
              const [showRows] = await conn.query(`SHOW CREATE ${rType} \`${database}\`.\`${rName}\`;`);
              if (Array.isArray(showRows) && showRows[0]) {
                const key = rType === 'PROCEDURE' ? 'Create Procedure' : 'Create Function';
                ddl = (showRows[0] as any)[key] || '';
              }
            } catch {}

            const obj: GenericObjectMetadata = {
              name: rName,
              type: rType === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION',
              rawDdl: ddl
            };

            if (rType === 'PROCEDURE') {
              procedures[rName] = obj;
            } else {
              functions[rName] = obj;
            }
          }
        }
      } catch {}

      // 10. Triggers
      const triggers: Record<string, GenericObjectMetadata> = {};
      try {
        const [trigRows] = await conn.query(
          `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?;`,
          [database]
        );
        if (Array.isArray(trigRows)) {
          for (const tr of trigRows as any[]) {
            const trName = tr.TRIGGER_NAME;
            let ddl = '';
            try {
              const [showRows] = await conn.query(`SHOW CREATE TRIGGER \`${database}\`.\`${trName}\`;`);
              if (Array.isArray(showRows) && showRows[0]) {
                ddl = (showRows[0] as any)['SQL Original Statement'] || (showRows[0] as any)['Create Trigger'] || '';
              }
            } catch {}
            triggers[trName] = {
              name: trName,
              type: 'TRIGGER',
              rawDdl: ddl
            };
          }
        }
      } catch {}

      // 11. Events
      const events: Record<string, GenericObjectMetadata> = {};
      try {
        const [eventRows] = await conn.query(
          `SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?;`,
          [database]
        );
        if (Array.isArray(eventRows)) {
          for (const ev of eventRows as any[]) {
            const evName = ev.EVENT_NAME;
            let ddl = '';
            try {
              const [showRows] = await conn.query(`SHOW CREATE EVENT \`${database}\`.\`${evName}\`;`);
              if (Array.isArray(showRows) && showRows[0]) {
                ddl = (showRows[0] as any)['Create Event'] || '';
              }
            } catch {}
            events[evName] = {
              name: evName,
              type: 'EVENT',
              rawDdl: ddl
            };
          }
        }
      } catch {}

      return {
        database,
        serverVersion,
        tables,
        views,
        procedures,
        functions,
        triggers,
        events
      };
    });
  }

  /**
   * Normalizes SQL DDL strings for clean portability and comparison
   */
  public static cleanDdl(ddl: string, sourceDatabase?: string): string {
    if (!ddl) return '';
    let cleaned = ddl;
    if (sourceDatabase) {
      const escaped = sourceDatabase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp('`' + escaped + '`\\.', 'gi'), '');
      cleaned = cleaned.replace(new RegExp('\\b' + escaped + '\\.', 'gi'), '');
    }
    // Remove DEFINER clause for portable views/routines/triggers
    cleaned = cleaned.replace(/DEFINER\s*=\s*`[^`]+`@`[^`]+`\s*/gi, '');
    cleaned = cleaned.replace(/DEFINER\s*=\s*[^\s]+@[^\s]+\s*/gi, '');
    return cleaned.trim();
  }

  /**
   * Formats a complete column definition for ALTER TABLE ADD/MODIFY
   */
  public static formatColumnDefinition(col: ColumnMetadata): string {
    let def = `\`${col.columnName}\` ${col.columnType}`;
    
    if (col.collation && !col.columnType.toLowerCase().includes('binary') && !col.columnType.toLowerCase().includes('int')) {
      def += ` COLLATE ${col.collation}`;
    }

    if (!col.isNullable) {
      def += ' NOT NULL';
    } else {
      def += ' NULL';
    }

    if (col.columnDefault !== null && col.columnDefault !== undefined) {
      const d = col.columnDefault;
      const dUpper = d.toUpperCase();
      if (
        dUpper === 'CURRENT_TIMESTAMP' || 
        dUpper === 'CURRENT_TIMESTAMP()' || 
        dUpper === 'NULL' || 
        dUpper.startsWith('CURRENT_TIMESTAMP')
      ) {
        def += ` DEFAULT ${d}`;
      } else if (/^-?\d+(\.\d+)?$/.test(d)) {
        def += ` DEFAULT ${d}`;
      } else {
        def += ` DEFAULT '${d.replace(/'/g, "\\'")}'`;
      }
    }

    if (col.isAutoIncrement) {
      def += ' AUTO_INCREMENT';
    }

    if (col.comment) {
      def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
    }

    return def;
  }

  /**
   * Compares two column definitions to detect whether a MODIFY COLUMN is required
   */
  private compareColumnDetails(
    sCol: ColumnMetadata,
    tCol: ColumnMetadata,
    options?: DiffCompareOptions
  ): string[] {
    const details: string[] = [];

    // Normalize types: remove spaces, lowercase
    const sType = sCol.columnType.replace(/\s+/g, '').toUpperCase();
    const tType = tCol.columnType.replace(/\s+/g, '').toUpperCase();
    
    // Normalization for INT display width: INT vs INT(11) in MariaDB/MySQL 8
    const normalizeInt = (t: string) => t.replace(/^INT\(\d+\)/, 'INT').replace(/^TINYINT\(1\)/, 'TINYINT');
    if (normalizeInt(sType) !== normalizeInt(tType)) {
      details.push(`Tipo: ${tCol.columnType} → ${sCol.columnType}`);
    }

    if (sCol.isNullable !== tCol.isNullable) {
      details.push(`Nulabilidad: ${tCol.isNullable ? 'NULL' : 'NOT NULL'} → ${sCol.isNullable ? 'NULL' : 'NOT NULL'}`);
    }

    const sDef = sCol.columnDefault;
    const tDef = tCol.columnDefault;
    const normDef = (val: string | null) => {
      if (val === null || val === undefined) return null;
      let s = val.trim();
      if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
      return s.toLowerCase();
    };

    if (normDef(sDef) !== normDef(tDef)) {
      details.push(`Valor por defecto: ${tDef ?? 'NULL'} → ${sDef ?? 'NULL'}`);
    }

    if (sCol.isAutoIncrement !== tCol.isAutoIncrement) {
      details.push(sCol.isAutoIncrement ? 'Añade AUTO_INCREMENT' : 'Quita AUTO_INCREMENT');
    }

    if (!options?.ignoreComments && (sCol.comment || '') !== (tCol.comment || '')) {
      details.push(`Comentario modificado`);
    }

    if (!options?.ignoreCollation && sCol.collation && tCol.collation && sCol.collation !== tCol.collation) {
      details.push(`Collation: ${tCol.collation} → ${sCol.collation}`);
    }

    return details;
  }

  /**
   * Compares source and target database metadata snapshots
   */
  public compareSnapshots(
    source: DatabaseSchemaSnapshot,
    target: DatabaseSchemaSnapshot,
    sourceConnName: string = 'Origen',
    targetConnName: string = 'Destino',
    options?: DiffCompareOptions
  ): SchemaDiffResult {
    const allTableNames = Array.from(new Set([...Object.keys(source.tables), ...Object.keys(target.tables)])).sort();
    const tableDiffs: TableDiff[] = [];

    let totalDiffCount = 0;
    let missingCount = 0;
    let extraCount = 0;
    let modifiedCount = 0;
    let identicalCount = 0;

    for (const tableName of allTableNames) {
      const sTable = source.tables[tableName];
      const tTable = target.tables[tableName];

      if (sTable && !tTable) {
        // Missing in target -> Needs CREATE TABLE
        const cleanedDdl = SchemaDiffService.cleanDdl(sTable.rawDdl, source.database);
        tableDiffs.push({
          name: tableName,
          status: 'missing_in_target',
          sourceTable: sTable,
          columnDiffs: [],
          indexDiffs: [],
          fkDiffs: [],
          optionsDiff: {
            engineChanged: false,
            collationChanged: false,
            commentChanged: false
          },
          createSql: cleanedDdl.endsWith(';') ? cleanedDdl : `${cleanedDdl};`
        });
        totalDiffCount++;
        missingCount++;
        continue;
      }

      if (!sTable && tTable) {
        // Extra in target -> Needs DROP TABLE
        tableDiffs.push({
          name: tableName,
          status: 'extra_in_target',
          targetTable: tTable,
          columnDiffs: [],
          indexDiffs: [],
          fkDiffs: [],
          optionsDiff: {
            engineChanged: false,
            collationChanged: false,
            commentChanged: false
          },
          dropSql: `DROP TABLE IF EXISTS \`${tableName}\`;`
        });
        totalDiffCount++;
        extraCount++;
        continue;
      }

      // Table exists in both -> compare details
      const columnDiffs: ColumnDiff[] = [];
      const sCols = sTable.orderedColumns;
      const tCols = tTable.orderedColumns;

      const sColMap = sTable.columns;
      const tColMap = tTable.columns;

      // Check added or modified columns
      for (let i = 0; i < sCols.length; i++) {
        const sCol = sCols[i];
        const lowerName = sCol.columnName.toLowerCase();
        const tCol = tColMap[lowerName];

        if (!tCol) {
          // Added column
          const prevColName = i > 0 ? sCols[i - 1].columnName : null;
          const posClause = prevColName ? ` AFTER \`${prevColName}\`` : ' FIRST';
          const clause = `ADD COLUMN ${SchemaDiffService.formatColumnDefinition(sCol)}${posClause}`;

          columnDiffs.push({
            name: sCol.columnName,
            status: 'added',
            sourceCol: sCol,
            details: [`Nueva columna (${sCol.columnType})`],
            alterClause: clause
          });
        } else {
          // Check modifications
          const details = this.compareColumnDetails(sCol, tCol, options);
          if (details.length > 0) {
            const clause = `MODIFY COLUMN ${SchemaDiffService.formatColumnDefinition(sCol)}`;
            columnDiffs.push({
              name: sCol.columnName,
              status: 'modified',
              sourceCol: sCol,
              targetCol: tCol,
              details,
              alterClause: clause
            });
          }
        }
      }

      // Check removed columns (in target, not in source)
      for (const tCol of tCols) {
        const lowerName = tCol.columnName.toLowerCase();
        if (!sColMap[lowerName]) {
          columnDiffs.push({
            name: tCol.columnName,
            status: 'removed',
            targetCol: tCol,
            details: [`Columna eliminada en origen`],
            alterClause: `DROP COLUMN \`${tCol.columnName}\``
          });
        }
      }

      // Compare Primary Keys
      const sPk = sTable.primaryKey;
      const tPk = tTable.primaryKey;
      const sPkStr = sPk.map(c => c.toLowerCase()).sort().join(',');
      const tPkStr = tPk.map(c => c.toLowerCase()).sort().join(',');

      if (sPkStr !== tPkStr) {
        if (sPk.length > 0 && tPk.length > 0) {
          columnDiffs.push({
            name: 'PRIMARY KEY',
            status: 'modified',
            details: [`Clave primaria modificada: (${tPk.join(', ')}) → (${sPk.join(', ')})`],
            alterClause: `DROP PRIMARY KEY, ADD PRIMARY KEY (${sPk.map(c => `\`${c}\``).join(', ')})`
          });
        } else if (sPk.length > 0 && tPk.length === 0) {
          columnDiffs.push({
            name: 'PRIMARY KEY',
            status: 'added',
            details: [`Nueva clave primaria: (${sPk.join(', ')})`],
            alterClause: `ADD PRIMARY KEY (${sPk.map(c => `\`${c}\``).join(', ')})`
          });
        } else if (sPk.length === 0 && tPk.length > 0) {
          columnDiffs.push({
            name: 'PRIMARY KEY',
            status: 'removed',
            details: [`Clave primaria eliminada`],
            alterClause: `DROP PRIMARY KEY`
          });
        }
      }

      // Compare Indexes (ignore PRIMARY key)
      const indexDiffs: IndexDiff[] = [];
      const sIndexes = { ...sTable.indexes };
      const tIndexes = { ...tTable.indexes };
      delete sIndexes['PRIMARY'];
      delete tIndexes['PRIMARY'];

      for (const [idxName, sIdx] of Object.entries(sIndexes)) {
        const tIdx = tIndexes[idxName];
        if (!tIdx) {
          // Added index
          const uniqueStr = sIdx.unique ? 'UNIQUE ' : '';
          indexDiffs.push({
            name: idxName,
            status: 'added',
            sourceIndex: sIdx,
            alterClause: `ADD ${uniqueStr}INDEX \`${idxName}\` (${sIdx.columns.map(c => `\`${c}\``).join(', ')})`
          });
        } else {
          // Compare index definition
          const sColsStr = sIdx.columns.join(',');
          const tColsStr = tIdx.columns.join(',');
          if (sColsStr !== tColsStr || sIdx.unique !== tIdx.unique || sIdx.type !== tIdx.type) {
            const uniqueStr = sIdx.unique ? 'UNIQUE ' : '';
            indexDiffs.push({
              name: idxName,
              status: 'modified',
              sourceIndex: sIdx,
              targetIndex: tIdx,
              alterClause: `DROP INDEX \`${idxName}\`, ADD ${uniqueStr}INDEX \`${idxName}\` (${sIdx.columns.map(c => `\`${c}\``).join(', ')})`
            });
          }
        }
      }

      for (const [idxName, tIdx] of Object.entries(tIndexes)) {
        if (!sIndexes[idxName]) {
          indexDiffs.push({
            name: idxName,
            status: 'removed',
            targetIndex: tIdx,
            alterClause: `DROP INDEX \`${idxName}\``
          });
        }
      }

      // Compare Foreign Keys
      const fkDiffs: ForeignKeyDiff[] = [];
      const sFks = sTable.foreignKeys;
      const tFks = tTable.foreignKeys;

      for (const [fkName, sFk] of Object.entries(sFks)) {
        const tFk = tFks[fkName];
        const addSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (\`${sFk.column}\`) REFERENCES \`${sFk.referencedTable}\` (\`${sFk.referencedColumn}\`)${sFk.deleteRule ? ` ON DELETE ${sFk.deleteRule}` : ''}${sFk.updateRule ? ` ON UPDATE ${sFk.updateRule}` : ''};`;

        if (!tFk) {
          fkDiffs.push({
            name: fkName,
            status: 'added',
            sourceFk: sFk,
            dropSql: '',
            addSql
          });
        } else {
          const isSame = 
            sFk.column.toLowerCase() === tFk.column.toLowerCase() &&
            sFk.referencedTable.toLowerCase() === tFk.referencedTable.toLowerCase() &&
            sFk.referencedColumn.toLowerCase() === tFk.referencedColumn.toLowerCase() &&
            (sFk.deleteRule || 'RESTRICT').toUpperCase() === (tFk.deleteRule || 'RESTRICT').toUpperCase() &&
            (sFk.updateRule || 'RESTRICT').toUpperCase() === (tFk.updateRule || 'RESTRICT').toUpperCase();

          if (!isSame) {
            fkDiffs.push({
              name: fkName,
              status: 'modified',
              sourceFk: sFk,
              targetFk: tFk,
              dropSql: `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fkName}\`;`,
              addSql
            });
          }
        }
      }

      for (const [fkName, tFk] of Object.entries(tFks)) {
        if (!sFks[fkName]) {
          fkDiffs.push({
            name: fkName,
            status: 'removed',
            targetFk: tFk,
            dropSql: `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fkName}\`;`,
            addSql: ''
          });
        }
      }

      // Table Options (Engine, Collation, Comment)
      const engineChanged = sTable.engine.toUpperCase() !== tTable.engine.toUpperCase();
      const collationChanged = !options?.ignoreCollation && Boolean(sTable.collation && tTable.collation && sTable.collation !== tTable.collation);
      const commentChanged = !options?.ignoreComments && (sTable.comment || '') !== (tTable.comment || '');

      const isDifferent = 
        columnDiffs.length > 0 || 
        indexDiffs.length > 0 || 
        fkDiffs.length > 0 || 
        engineChanged || 
        collationChanged || 
        commentChanged;

      const status: DiffStatus = isDifferent ? 'different' : 'identical';

      tableDiffs.push({
        name: tableName,
        status,
        sourceTable: sTable,
        targetTable: tTable,
        columnDiffs,
        indexDiffs,
        fkDiffs,
        optionsDiff: {
          engineChanged,
          sourceEngine: sTable.engine,
          targetEngine: tTable.engine,
          collationChanged,
          sourceCollation: sTable.collation,
          targetCollation: tTable.collation,
          commentChanged,
          sourceComment: sTable.comment,
          targetComment: tTable.comment
        }
      });

      if (isDifferent) {
        totalDiffCount++;
        modifiedCount++;
      } else {
        identicalCount++;
      }
    }

    // Helper for generic objects (Views, Procedures, Functions, Triggers, Events)
    const diffGenericObjects = (
      sourceMap: Record<string, GenericObjectMetadata>,
      targetMap: Record<string, GenericObjectMetadata>,
      type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT'
    ): GenericObjectDiff[] => {
      const allNames = Array.from(new Set([...Object.keys(sourceMap), ...Object.keys(targetMap)])).sort();
      const diffs: GenericObjectDiff[] = [];

      for (const name of allNames) {
        const sObj = sourceMap[name];
        const tObj = targetMap[name];

        if (sObj && !tObj) {
          const cleanDdl = SchemaDiffService.cleanDdl(sObj.rawDdl, source.database);
          diffs.push({
            name,
            type,
            status: 'missing_in_target',
            sourceDdl: cleanDdl,
            createSql: cleanDdl
          });
          totalDiffCount++;
          missingCount++;
        } else if (!sObj && tObj) {
          diffs.push({
            name,
            type,
            status: 'extra_in_target',
            targetDdl: tObj.rawDdl,
            dropSql: `DROP ${type} IF EXISTS \`${name}\`;`
          });
          totalDiffCount++;
          extraCount++;
        } else if (sObj && tObj) {
          const cleanSDdl = SchemaDiffService.cleanDdl(sObj.rawDdl, source.database);
          const cleanTDdl = SchemaDiffService.cleanDdl(tObj.rawDdl, target.database);

          // Normalize whitespace for comparison
          const normS = cleanSDdl.replace(/\s+/g, ' ').trim().toLowerCase();
          const normT = cleanTDdl.replace(/\s+/g, ' ').trim().toLowerCase();

          if (normS !== normT) {
            diffs.push({
              name,
              type,
              status: 'different',
              sourceDdl: cleanSDdl,
              targetDdl: cleanTDdl,
              createSql: cleanSDdl
            });
            totalDiffCount++;
            modifiedCount++;
          } else {
            diffs.push({
              name,
              type,
              status: 'identical',
              sourceDdl: cleanSDdl,
              targetDdl: cleanTDdl
            });
            identicalCount++;
          }
        }
      }
      return diffs;
    };

    const views = diffGenericObjects(source.views, target.views, 'VIEW');
    const procedures = diffGenericObjects(source.procedures, target.procedures, 'PROCEDURE');
    const functions = diffGenericObjects(source.functions, target.functions, 'FUNCTION');
    const triggers = diffGenericObjects(source.triggers, target.triggers, 'TRIGGER');
    const events = diffGenericObjects(source.events, target.events, 'EVENT');

    return {
      sourceConnectionName: sourceConnName,
      targetConnectionName: targetConnName,
      sourceDb: source.database,
      targetDb: target.database,
      tables: tableDiffs,
      views,
      procedures,
      functions,
      triggers,
      events,
      summary: {
        totalDifferences: totalDiffCount,
        missingInTarget: missingCount,
        extraInTarget: extraCount,
        modified: modifiedCount,
        identical: identicalCount
      }
    };
  }

  /**
   * Generates an actionable, ordered SQL migration script from diff results
   */
  public generateMigrationScript(
    diff: SchemaDiffResult,
    options: MigrationScriptOptions = {}
  ): string {
    const lines: string[] = [];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetDatabase = options.targetDatabaseOverride || diff.targetDb;

    // Header banner
    lines.push('-- ==============================================================================');
    lines.push('-- SCRIPT DE MIGRACIÓN / SINCRONIZACIÓN DE ESQUEMA');
    lines.push('-- Generado por Maria Toma Mate 🧉');
    lines.push(`-- Fecha de generación: ${timestamp}`);
    lines.push(`-- Origen:  [${diff.sourceConnectionName}] ${diff.sourceDb}`);
    lines.push(`-- Destino: [${diff.targetConnectionName}] ${targetDatabase}`);
    lines.push('-- ==============================================================================');
    lines.push('');
    lines.push('/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;');
    lines.push('/*!40101 SET NAMES utf8mb4 */;');
    lines.push('/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;');
    lines.push('/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;');
    lines.push("/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;");
    lines.push('');
    lines.push(`USE \`${targetDatabase}\`;`);
    lines.push('');

    // Phase 1: Drop foreign keys that are removed or modified
    const fkDrops: string[] = [];
    for (const tDiff of diff.tables) {
      if (options.selectedTables && options.selectedTables[tDiff.name] === false) continue;
      if (tDiff.status !== 'different') continue;

      for (const fk of tDiff.fkDiffs) {
        if (fk.status === 'removed' && !options.includeDropForeignKeys) continue;
        if (fk.dropSql) {
          fkDrops.push(fk.dropSql);
        }
      }
    }

    if (fkDrops.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 1. ELIMINACIÓN DE FOREIGN KEYS MODIFICADAS O OBSOLETAS EN DESTINO');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...fkDrops);
      lines.push('');
    }

    // Phase 2: Create missing tables
    const tableCreates: string[] = [];
    for (const tDiff of diff.tables) {
      if (options.selectedTables && options.selectedTables[tDiff.name] === false) continue;
      if (tDiff.status === 'missing_in_target' && tDiff.createSql) {
        tableCreates.push(tDiff.createSql);
      }
    }

    if (tableCreates.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 2. CREACIÓN DE TABLAS FALTANTES');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...tableCreates);
      lines.push('');
    }

    // Phase 3: Alter existing tables
    const tableAlters: string[] = [];
    for (const tDiff of diff.tables) {
      if (options.selectedTables && options.selectedTables[tDiff.name] === false) continue;
      if (tDiff.status !== 'different') continue;

      const clauses: string[] = [];

      // Columns
      for (const cDiff of tDiff.columnDiffs) {
        if (cDiff.status === 'removed' && !options.includeDropColumns) continue;
        clauses.push(cDiff.alterClause);
      }

      // Indexes
      for (const iDiff of tDiff.indexDiffs) {
        if (iDiff.status === 'removed' && !options.includeDropIndexes) continue;
        clauses.push(iDiff.alterClause);
      }

      // Options
      if (tDiff.optionsDiff.engineChanged && tDiff.optionsDiff.sourceEngine) {
        clauses.push(`ENGINE = ${tDiff.optionsDiff.sourceEngine}`);
      }
      if (tDiff.optionsDiff.collationChanged && tDiff.optionsDiff.sourceCollation) {
        clauses.push(`DEFAULT COLLATE = ${tDiff.optionsDiff.sourceCollation}`);
      }
      if (tDiff.optionsDiff.commentChanged && tDiff.optionsDiff.sourceComment !== undefined) {
        clauses.push(`COMMENT = '${tDiff.optionsDiff.sourceComment.replace(/'/g, "\\'")}'`);
      }

      if (clauses.length > 0) {
        tableAlters.push(`-- Modificaciones en tabla \`${tDiff.name}\`:\nALTER TABLE \`${tDiff.name}\`\n  ` + clauses.join(',\n  ') + ';');
      }
    }

    if (tableAlters.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 3. MODIFICACIÓN DE TABLAS EXISTENTES');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...tableAlters);
      lines.push('');
    }

    // Phase 4: Add new or modified foreign keys
    const fkAdds: string[] = [];
    for (const tDiff of diff.tables) {
      if (options.selectedTables && options.selectedTables[tDiff.name] === false) continue;
      if (tDiff.status !== 'different') continue;

      for (const fk of tDiff.fkDiffs) {
        if (fk.addSql) {
          fkAdds.push(fk.addSql);
        }
      }
    }

    if (fkAdds.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 4. AÑADIR FOREIGN KEYS NUEVAS O ACTUALIZADAS');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...fkAdds);
      lines.push('');
    }

    // Phase 5: Views
    const viewStatements: string[] = [];
    for (const vDiff of diff.views) {
      if (options.selectedViews && options.selectedViews[vDiff.name] === false) continue;

      if (vDiff.status === 'missing_in_target' || vDiff.status === 'different') {
        if (vDiff.createSql) {
          // Normalize to CREATE OR REPLACE VIEW
          let viewSql = vDiff.createSql.replace(/^CREATE\s+VIEW/i, 'CREATE OR REPLACE VIEW');
          if (!viewSql.trim().toUpperCase().startsWith('CREATE OR REPLACE VIEW')) {
            viewSql = `CREATE OR REPLACE VIEW \`${vDiff.name}\` AS ` + viewSql.replace(/^CREATE.*?VIEW\s+`?[^`\s]+`?\s+AS\s+/i, '');
          }
          if (!viewSql.trim().endsWith(';')) viewSql += ';';
          viewStatements.push(viewSql);
        }
      } else if (vDiff.status === 'extra_in_target' && options.includeDropRoutines) {
        viewStatements.push(`DROP VIEW IF EXISTS \`${vDiff.name}\`;`);
      }
    }

    if (viewStatements.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 5. VISTAS');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...viewStatements);
      lines.push('');
    }

    // Phase 6: Procedures
    const procStatements: string[] = [];
    for (const pDiff of diff.procedures) {
      if (options.selectedProcedures && options.selectedProcedures[pDiff.name] === false) continue;

      if (pDiff.status === 'missing_in_target' || pDiff.status === 'different') {
        if (pDiff.createSql) {
          procStatements.push(`DROP PROCEDURE IF EXISTS \`${pDiff.name}\`;;`);
          procStatements.push(`${pDiff.createSql};;`);
        }
      } else if (pDiff.status === 'extra_in_target' && options.includeDropRoutines) {
        procStatements.push(`DROP PROCEDURE IF EXISTS \`${pDiff.name}\`;;`);
      }
    }

    if (procStatements.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 6. PROCEDIMIENTOS ALMACENADOS');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('DELIMITER ;;');
      lines.push(...procStatements);
      lines.push('DELIMITER ;');
      lines.push('');
    }

    // Phase 7: Functions
    const funcStatements: string[] = [];
    for (const fDiff of diff.functions) {
      if (options.selectedFunctions && options.selectedFunctions[fDiff.name] === false) continue;

      if (fDiff.status === 'missing_in_target' || fDiff.status === 'different') {
        if (fDiff.createSql) {
          funcStatements.push(`DROP FUNCTION IF EXISTS \`${fDiff.name}\`;;`);
          funcStatements.push(`${fDiff.createSql};;`);
        }
      } else if (fDiff.status === 'extra_in_target' && options.includeDropRoutines) {
        funcStatements.push(`DROP FUNCTION IF EXISTS \`${fDiff.name}\`;;`);
      }
    }

    if (funcStatements.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 7. FUNCIONES ALMACENADAS');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('DELIMITER ;;');
      lines.push(...funcStatements);
      lines.push('DELIMITER ;');
      lines.push('');
    }

    // Phase 8: Triggers
    const triggerStatements: string[] = [];
    for (const trDiff of diff.triggers) {
      if (options.selectedTriggers && options.selectedTriggers[trDiff.name] === false) continue;

      if (trDiff.status === 'missing_in_target' || trDiff.status === 'different') {
        if (trDiff.createSql) {
          triggerStatements.push(`DROP TRIGGER IF EXISTS \`${trDiff.name}\`;;`);
          triggerStatements.push(`${trDiff.createSql};;`);
        }
      } else if (trDiff.status === 'extra_in_target' && options.includeDropTriggers) {
        triggerStatements.push(`DROP TRIGGER IF EXISTS \`${trDiff.name}\`;;`);
      }
    }

    if (triggerStatements.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 8. DISPARADORES (TRIGGERS)');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('DELIMITER ;;');
      lines.push(...triggerStatements);
      lines.push('DELIMITER ;');
      lines.push('');
    }

    // Phase 9: Events
    const eventStatements: string[] = [];
    for (const evDiff of diff.events) {
      if (options.selectedEvents && options.selectedEvents[evDiff.name] === false) continue;

      if (evDiff.status === 'missing_in_target' || evDiff.status === 'different') {
        if (evDiff.createSql) {
          eventStatements.push(`DROP EVENT IF EXISTS \`${evDiff.name}\`;`);
          eventStatements.push(`${evDiff.createSql};`);
        }
      } else if (evDiff.status === 'extra_in_target' && options.includeDropEvents) {
        eventStatements.push(`DROP EVENT IF EXISTS \`${evDiff.name}\`;`);
      }
    }

    if (eventStatements.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 9. EVENTOS PROGRAMADOS');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...eventStatements);
      lines.push('');
    }

    // Phase 10: Extra tables removal (Only if explicitly opted in)
    const extraTableDrops: string[] = [];
    if (options.includeDropTables) {
      for (const tDiff of diff.tables) {
        if (options.selectedTables && options.selectedTables[tDiff.name] === false) continue;
        if (tDiff.status === 'extra_in_target' && tDiff.dropSql) {
          extraTableDrops.push(tDiff.dropSql);
        }
      }
    }

    if (extraTableDrops.length > 0) {
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push('-- 10. ELIMINACIÓN DE TABLAS SOBRANTES EN DESTINO');
      lines.push('-- ------------------------------------------------------------------------------');
      lines.push(...extraTableDrops);
      lines.push('');
    }

    // Footer restoration
    lines.push('-- ------------------------------------------------------------------------------');
    lines.push('-- RESTAURACIÓN DE CONFIGURACIONES DE SESIÓN');
    lines.push('-- ------------------------------------------------------------------------------');
    lines.push('/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;');
    lines.push('/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;');
    lines.push('/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;');
    lines.push('/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;');
    lines.push('');
    lines.push('-- Fin del script de migración');

    return lines.join('\n');
  }

  /**
   * Compares two databases across connections with progress reporting
   */
  public async compareDatabases(
    req: SchemaCompareRequest,
    onProgress?: (progress: CompareProgress) => void
  ): Promise<SchemaDiffResult> {
    onProgress?.({
      stage: 'connect_source',
      percentage: 10,
      message: `Conectando a origen (${req.sourceConfig.name || req.sourceConfig.host})...`
    });

    onProgress?.({
      stage: 'inspect_source',
      percentage: 25,
      message: `Extrayendo metadatos de '${req.sourceDatabase}'...`
    });

    const sourceSnapshot = await this.getDatabaseSnapshot(req.sourceConfig, req.sourceDatabase);

    onProgress?.({
      stage: 'connect_target',
      percentage: 55,
      message: `Conectando a destino (${req.targetConfig.name || req.targetConfig.host})...`
    });

    onProgress?.({
      stage: 'inspect_target',
      percentage: 75,
      message: `Extrayendo metadatos de '${req.targetDatabase}'...`
    });

    const targetSnapshot = await this.getDatabaseSnapshot(req.targetConfig, req.targetDatabase);

    onProgress?.({
      stage: 'diffing',
      percentage: 90,
      message: 'Comparando esquemas y detectando diferencias...'
    });

    const sourceConnName = req.sourceConfig.name || `${req.sourceConfig.host}:${req.sourceConfig.port}`;
    const targetConnName = req.targetConfig.name || `${req.targetConfig.host}:${req.targetConfig.port}`;

    const diffResult = this.compareSnapshots(
      sourceSnapshot,
      targetSnapshot,
      sourceConnName,
      targetConnName,
      req.options
    );

    onProgress?.({
      stage: 'complete',
      percentage: 100,
      message: 'Comparación completada con éxito.'
    });

    return diffResult;
  }

  /**
   * Directly executes a migration script against the target database
   */
  public async executeMigration(
    targetConfig: MySqlConnectionOptions,
    targetDatabase: string,
    script: string,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<{
    success: boolean;
    statementsExecuted: number;
    errors: { statementSnippet: string; error: string }[];
    durationMs: number;
  }> {
    const startTime = Date.now();
    return this.withConnection(targetConfig, targetDatabase, async (conn) => {
      // Split statements taking DELIMITER into account
      const splitter = this.mariaDbService 
        ? this.mariaDbService.splitSqlStatements.bind(this.mariaDbService)
        : (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

      const rawStatements = splitter(script);
      const statements = rawStatements.map(s => s.trim()).filter(Boolean);
      const total = statements.length;
      const errors: { statementSnippet: string; error: string }[] = [];
      let executed = 0;

      onProgress?.({
        totalStatements: total,
        executedStatements: 0,
        percentage: 0,
        currentStatementSnippet: '',
        errorsCount: 0,
        message: `Iniciando ejecución de ${total} sentencias en '${targetDatabase}'...`
      });

      for (let i = 0; i < total; i++) {
        const stmt = statements[i];
        const snippet = stmt.length > 80 ? stmt.substring(0, 80) + '...' : stmt;

        onProgress?.({
          totalStatements: total,
          executedStatements: executed,
          percentage: Math.round((executed / total) * 100),
          currentStatementSnippet: snippet,
          errorsCount: errors.length,
          message: `Ejecutando sentencia ${i + 1} de ${total}...`
        });

        try {
          await conn.query(stmt);
          executed++;
        } catch (err: any) {
          errors.push({
            statementSnippet: snippet,
            error: err.message || String(err)
          });
        }
      }

      onProgress?.({
        totalStatements: total,
        executedStatements: executed,
        percentage: 100,
        currentStatementSnippet: '',
        errorsCount: errors.length,
        message: errors.length === 0 ? '¡Migración completada exitosamente!' : `Completada con ${errors.length} errores.`
      });

      return {
        success: errors.length === 0,
        statementsExecuted: executed,
        errors,
        durationMs: Date.now() - startTime
      };
    });
  }
}
