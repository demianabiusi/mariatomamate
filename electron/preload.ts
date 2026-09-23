import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Connection management
  getSavedConnections: () => ipcRenderer.invoke('db:get-saved-connections'),
  saveConnection: (config: any) => ipcRenderer.invoke('db:save-connection', config),
  deleteConnection: (id: string) => ipcRenderer.invoke('db:delete-connection', id),
  testConnection: (config: any) => ipcRenderer.invoke('db:test-connection', config),
  testSshTunnel: (config: any) => ipcRenderer.invoke('ssh:test-tunnel', config),
  selectSshKeyFile: () => ipcRenderer.invoke('dialog:select-ssh-key'),
  connect: (config: any) => ipcRenderer.invoke('db:connect', config),
  disconnect: () => ipcRenderer.invoke('db:disconnect'),
  getConnectionStatus: () => ipcRenderer.invoke('db:get-status'),
  
  // App settings & persistence
  getAppSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveAppSettings: (patch: any) => ipcRenderer.invoke('app:save-settings', patch),
  
  // Databases / Multi-schema navigation
  getDatabases: () => ipcRenderer.invoke('db:get-databases'),
  switchDatabase: (databaseName: string) => ipcRenderer.invoke('db:switch-database', databaseName),
  createDatabase: (options: any) => ipcRenderer.invoke('db:create-database', options),
  dropDatabase: (databaseName: string) => ipcRenderer.invoke('db:drop-database', databaseName),

  // Metadata
  getSchemaObjects: () => ipcRenderer.invoke('db:get-schema-objects'),
  getTableDetails: (tableName: string) => ipcRenderer.invoke('db:get-table-details', tableName),
  getObjectDdl: (type: string, name: string) => ipcRenderer.invoke('db:get-object-ddl', type, name),
  
  // Query & Script Execution
  executeQuery: (sql: string, maxRows?: number) => ipcRenderer.invoke('db:execute-query', sql, maxRows),
  executeScript: (script: string) => ipcRenderer.invoke('db:execute-script', script),
  updateCell: (params: any) => ipcRenderer.invoke('db:update-cell', params),
  
  // File dialogs
  saveSqlFile: (content: string, defaultPath?: string) => ipcRenderer.invoke('dialog:save-sql-file', content, defaultPath),
  openSqlFile: () => ipcRenderer.invoke('dialog:open-sql-file'),
  exportData: (data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => 
    ipcRenderer.invoke('dialog:export-data', data, defaultFilename, type),
  
  // Database Dump / Export
  selectDumpFile: (defaultFilename?: string) => ipcRenderer.invoke('dialog:select-dump-file', defaultFilename),
  startDump: (options: any) => ipcRenderer.invoke('db:start-dump', options),
  cancelDump: () => ipcRenderer.invoke('db:cancel-dump'),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path),
  onDumpProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('db:dump-progress', handler);
    return () => ipcRenderer.removeListener('db:dump-progress', handler);
  },

  // Database Import / Streaming Dump Loader
  selectImportFile: () => ipcRenderer.invoke('dialog:select-import-file'),
  startImport: (options: any) => ipcRenderer.invoke('db:start-import', options),
  cancelImport: () => ipcRenderer.invoke('db:cancel-import'),
  onImportProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('db:import-progress', handler);
    return () => ipcRenderer.removeListener('db:import-progress', handler);
  },

  // Schema Diff & Comparison
  getDatabasesForConnection: (config: any) => ipcRenderer.invoke('diff:get-databases', config),
  compareSchemas: (req: any) => ipcRenderer.invoke('diff:compare-schemas', req),
  generateMigrationScript: (diff: any, options: any) => ipcRenderer.invoke('diff:generate-script', { diff, options }),
  applyMigrationScript: (req: any) => ipcRenderer.invoke('diff:apply-migration', req),
  onCompareProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('diff:compare-progress', handler);
    return () => ipcRenderer.removeListener('diff:compare-progress', handler);
  },
  onMigrationProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('diff:migration-progress', handler);
    return () => ipcRenderer.removeListener('diff:migration-progress', handler);
  },

  // User & Privilege Management
  getUserServerInfo: () => ipcRenderer.invoke('user:get-server-info'),
  listUsers: () => ipcRenderer.invoke('user:list'),
  getUserDetails: (user: string, host: string) => ipcRenderer.invoke('user:get-details', { user, host }),
  generateUserSql: (plan: any) => ipcRenderer.invoke('user:generate-sql', plan),
  executeUserPlan: (statements: string[]) => ipcRenderer.invoke('user:execute-plan', statements),
  dropUser: (user: string, host: string, isRole?: boolean) => ipcRenderer.invoke('user:drop', { user, host, isRole }),
  revokeDatabasePrivileges: (user: string, host: string, database: string) => 
    ipcRenderer.invoke('user:revoke-database', { user, host, database }),
  revokeAllGlobalPrivileges: (user: string, host: string) => 
    ipcRenderer.invoke('user:revoke-global', { user, host })
});
