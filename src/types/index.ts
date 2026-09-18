export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  authType: 'password' | 'keyFile' | 'agent';
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database?: string;
  charset: string;
  ssl?: boolean;
  ssh?: SshTunnelConfig;
  createdAt?: string;
}

export type DbObjectType = 
  | 'DATABASE'
  | 'TABLE' 
  | 'VIEW' 
  | 'PROCEDURE' 
  | 'FUNCTION'
  | 'TRIGGER' 
  | 'EVENT';

export interface DbObjectItem {
  name: string;
  type: DbObjectType;
  extraInfo?: string;
  parentTable?: string;
}

export interface ColumnInfo {
  columnName: string;
  position: number;
  fieldType: string;
  isNullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
  comment?: string;
  collation?: string;
}

export interface TableIndexInfo {
  name: string;
  unique: boolean;
  fields: string[];
  type: string;
}

export interface ForeignKeyInfo {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  updateRule?: string;
  deleteRule?: string;
}

export interface TableDetails {
  tableName: string;
  database: string;
  engine?: string;
  rows?: number;
  columns: ColumnInfo[];
  indices: TableIndexInfo[];
  foreignKeys: ForeignKeyInfo[];
  triggers: { name: string; event: string; timing: string }[];
  ddl: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  affectedRows?: number;
  insertId?: number | string;
  executionTimeMs: number;
  sql: string;
  hasMore?: boolean;
}

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
  activeResultTab: 'grid' | 'messages' | 'history';
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: string;
  durationMs: number;
  status: 'success' | 'error';
  rowCount?: number;
  error?: string;
}

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AppSettings {
  lastActiveConnectionId?: string | null;
  lastActiveDatabase?: string | null;
  autoConnectOnStartup?: boolean;
}

export interface SchemaObjects {
  databases: string[];
  currentDatabase: string | null;
  tables: string[];
  views: string[];
  procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
  functions: { name: string; returnType?: string }[];
  triggers: { name: string; table: string; event: string; timing: string }[];
  events: string[];
  columnsByTable: Record<string, string[]>;
}

export interface DumpOptions {
  outputPath: string;
  includeStructure: boolean;
  includeData: boolean;
  includeViews: boolean;
  includeProcedures: boolean;
  includeTriggers: boolean;
  includeForeignKeys: boolean;
  selectedTables: string[];
  batchCommitSize?: number;
}

export interface DumpProgress {
  stage: string;
  currentTable?: string;
  totalTables?: number;
  currentTableIndex?: number;
  rowsExported?: number;
  totalRowsInTable?: number;
  percentage: number;
  message: string;
}

export interface ImportOptions {
  filePath: string;
  stopOnError: boolean;
}

export interface ImportErrorItem {
  statementIndex: number;
  statementSnippet: string;
  error: string;
  lineNumber: number;
}

export interface ImportProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentage: number;
  statementsExecuted: number;
  errorsCount: number;
  currentStatementSnippet: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  totalStatements: number;
  executedStatements: number;
  errorsCount: number;
  errors: ImportErrorItem[];
  durationMs: number;
}

// Schema Diff / Metadata Comparison types
export type DiffStatus = 'missing_in_target' | 'extra_in_target' | 'different' | 'identical';

export interface ColumnDiffItem {
  name: string;
  status: 'added' | 'removed' | 'modified';
  sourceCol?: ColumnInfo;
  targetCol?: ColumnInfo;
  details: string[];
  alterClause: string;
}

export interface IndexDiffItem {
  name: string;
  status: 'added' | 'removed' | 'modified';
  sourceIndex?: TableIndexInfo;
  targetIndex?: TableIndexInfo;
  alterClause: string;
}

export interface ForeignKeyDiffItem {
  name: string;
  status: 'added' | 'removed' | 'modified';
  sourceFk?: ForeignKeyInfo;
  targetFk?: ForeignKeyInfo;
  dropSql: string;
  addSql: string;
}

export interface TableDiffItem {
  name: string;
  status: DiffStatus;
  sourceTable?: any;
  targetTable?: any;
  columnDiffs: ColumnDiffItem[];
  indexDiffs: IndexDiffItem[];
  fkDiffs: ForeignKeyDiffItem[];
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

export interface GenericObjectDiffItem {
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
  tables: TableDiffItem[];
  views: GenericObjectDiffItem[];
  procedures: GenericObjectDiffItem[];
  functions: GenericObjectDiffItem[];
  triggers: GenericObjectDiffItem[];
  events: GenericObjectDiffItem[];
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
  selectedTables?: Record<string, boolean>;
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

export interface SchemaCompareRequest {
  sourceConfig: ConnectionConfig;
  sourceDatabase: string;
  targetConfig: ConnectionConfig;
  targetDatabase: string;
  options?: DiffCompareOptions;
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

export interface MigrationExecutionResult {
  success: boolean;
  statementsExecuted: number;
  errors: { statementSnippet: string; error: string }[];
  durationMs: number;
}

export interface ElectronAPI {
  // Connection management
  getSavedConnections: () => Promise<ConnectionConfig[]>;
  saveConnection: (config: ConnectionConfig) => Promise<ConnectionConfig>;
  deleteConnection: (id: string) => Promise<boolean>;
  testConnection: (config: ConnectionConfig) => Promise<IpcResponse<{ message: string; pingMs: number; serverVersion?: string }>>;
  testSshTunnel: (config: SshTunnelConfig) => Promise<IpcResponse<{ message: string; pingMs: number; banner?: string }>>;
  selectSshKeyFile: () => Promise<string | null>;
  connect: (config: ConnectionConfig) => Promise<IpcResponse<{ database: string }>>;
  disconnect: () => Promise<IpcResponse<boolean>>;
  getConnectionStatus: () => Promise<{ isConnected: boolean; config: ConnectionConfig | null }>;
  
  // App settings & persistence
  getAppSettings: () => Promise<AppSettings>;
  saveAppSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  
  // Databases / Multi-schema navigation
  getDatabases: () => Promise<IpcResponse<string[]>>;
  switchDatabase: (databaseName: string) => Promise<IpcResponse<string>>;
  createDatabase: (options: { name: string; charset?: string; collation?: string }) => Promise<IpcResponse<{ database: string }>>;
  dropDatabase: (databaseName: string) => Promise<IpcResponse<boolean>>;

  // Metadata
  getSchemaObjects: () => Promise<IpcResponse<SchemaObjects>>;
  getTableDetails: (tableName: string) => Promise<IpcResponse<TableDetails>>;
  getObjectDdl: (type: string, name: string) => Promise<IpcResponse<{ ddl: string; name: string; type: string }>>;
  
  // Query & Script execution
  executeQuery: (sql: string, maxRows?: number) => Promise<IpcResponse<QueryResult>>;
  executeScript: (script: string) => Promise<IpcResponse<{ statementsExecuted: number; results: QueryResult[] }>>;
  
  // File dialogs & utilities
  saveSqlFile: (content: string, defaultPath?: string) => Promise<boolean>;
  openSqlFile: () => Promise<{ content: string; filePath: string } | null>;
  exportData: (data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => Promise<boolean>;

  // Database Dump / Export
  selectDumpFile: (defaultFilename?: string) => Promise<string | null>;
  startDump: (options: DumpOptions) => Promise<IpcResponse<{ filePath: string; totalStatements: number; durationMs: number }>>;
  cancelDump: () => Promise<{ success: boolean }>;
  showItemInFolder: (path: string) => Promise<boolean>;
  onDumpProgress: (callback: (progress: DumpProgress) => void) => () => void;

  // Database Import / Streaming Dump Loader
  selectImportFile: () => Promise<{ filePath: string; size: number; name: string } | null>;
  startImport: (options: ImportOptions) => Promise<IpcResponse<ImportResult>>;
  cancelImport: () => Promise<{ success: boolean }>;
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;

  // Schema Diff & Comparison
  getDatabasesForConnection: (config: ConnectionConfig) => Promise<IpcResponse<string[]>>;
  compareSchemas: (req: SchemaCompareRequest) => Promise<IpcResponse<SchemaDiffResult>>;
  generateMigrationScript: (diff: SchemaDiffResult, options: MigrationScriptOptions) => Promise<IpcResponse<string>>;
  applyMigrationScript: (req: { targetConfig: ConnectionConfig; targetDatabase: string; script: string }) => Promise<IpcResponse<MigrationExecutionResult>>;
  onCompareProgress: (callback: (progress: CompareProgress) => void) => () => void;
  onMigrationProgress: (callback: (progress: MigrationProgress) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
