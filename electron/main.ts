import { app, BrowserWindow, ipcMain, dialog, nativeImage, NativeImage, Menu, shell, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { MariaDbService } from './mariadb-service';
import { StorageService } from './storage-service';
import { DumpService, DumpOptions, DumpProgress } from './dump-service';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

const mariaService = new MariaDbService();
const storageService = new StorageService();
const dumpService = new DumpService(mariaService);

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function loadWindowState(): WindowState {
  const defaultState: WindowState = {
    width: 1320,
    height: 860,
    isMaximized: false
  };

  try {
    const userDataPath = app.getPath('userData');
    const stateFile = path.join(userDataPath, 'window-state.json');
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      return { ...defaultState, ...data };
    }
  } catch (err) {
    console.error('Error loading window state:', err);
  }
  return defaultState;
}

function saveWindowState(win: BrowserWindow) {
  try {
    const userDataPath = app.getPath('userData');
    const stateFile = path.join(userDataPath, 'window-state.json');
    const isMaximized = win.isMaximized();
    const bounds = (isMaximized && (win as any).getNormalBounds) ? (win as any).getNormalBounds() : win.getBounds();

    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving window state:', err);
  }
}

function getAppIcon(): NativeImage | string | undefined {
  const isWin = process.platform === 'win32';

  const possiblePaths = app.isPackaged
    ? [
        path.join(process.resourcesPath, '..', isWin ? 'icon.ico' : 'icon.png'),
        path.join(path.dirname(app.getPath('exe')), isWin ? 'icon.ico' : 'icon.png'),
        path.join(process.resourcesPath, isWin ? 'icon.ico' : 'icon.png'),
      ]
    : [
        path.join(__dirname, '../public', isWin ? 'icon.ico' : 'icon.png'),
        path.join(process.cwd(), 'public', isWin ? 'icon.ico' : 'icon.png'),
        path.join(__dirname, '../public/icon.png'),
        path.join(process.cwd(), 'public/icon.png'),
      ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          return img;
        }
      } catch {
        return p;
      }
    }
  }
  return undefined;
}

function createWindow() {
  const appIcon = getAppIcon();
  const windowState = loadWindowState();

  let hasValidPosition = false;
  if (typeof windowState.x === 'number' && typeof windowState.y === 'number') {
    const displays = screen.getAllDisplays();
    hasValidPosition = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return (
        windowState.x! >= x &&
        windowState.x! < x + width &&
        windowState.y! >= y &&
        windowState.y! < y + height
      );
    });
  }

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: windowState.width || 1320,
    height: windowState.height || 860,
    ...(hasValidPosition ? { x: windowState.x, y: windowState.y } : {}),
    minWidth: 920,
    minHeight: 600,
    title: 'Maria Toma Mate - Cliente MariaDB & MySQL',
    icon: appIcon,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }
  mainWindow.show();

  if (appIcon && typeof appIcon !== 'string') {
    mainWindow.setIcon(appIcon);
  }

  let saveTimer: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow);
      }
    }, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setName('Maria Toma Mate');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  try {
    await mariaService.disconnect();
  } catch (err) {
    console.error('Error disconnecting before exit:', err);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: App Settings
ipcMain.handle('app:get-settings', async () => {
  try {
    return storageService.getSettings();
  } catch (err: any) {
    console.error('Error getting app settings:', err);
    return { lastActiveConnectionId: null, autoConnectOnStartup: true };
  }
});

ipcMain.handle('app:save-settings', async (_, patch) => {
  try {
    return storageService.saveSettings(patch);
  } catch (err: any) {
    console.error('Error saving app settings:', err);
    return storageService.getSettings();
  }
});

// IPC: Connection Management
ipcMain.handle('db:get-saved-connections', async () => {
  try {
    return storageService.getConnections();
  } catch (err: any) {
    console.error('Error getSavedConnections:', err);
    return [];
  }
});

ipcMain.handle('db:save-connection', async (_, config) => {
  try {
    return storageService.saveConnection(config);
  } catch (err: any) {
    throw new Error(err.message || 'Error al guardar la conexión');
  }
});

ipcMain.handle('db:delete-connection', async (_, id: string) => {
  try {
    return storageService.deleteConnection(id);
  } catch (err: any) {
    throw new Error(err.message || 'Error al eliminar la conexión');
  }
});

ipcMain.handle('db:test-connection', async (_, config) => {
  try {
    const res = await mariaService.testConnection(config);
    return { success: res.success, data: { message: res.message, pingMs: res.pingMs, serverVersion: res.serverVersion } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error en prueba de conexión' };
  }
});

ipcMain.handle('ssh:test-tunnel', async (_, sshConfig) => {
  try {
    const res = await mariaService.getSshTunnelService().testSshConnection(sshConfig);
    return {
      success: res.success,
      data: { message: res.message, pingMs: res.pingMs, banner: res.banner },
      error: res.success ? undefined : res.message
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al probar túnel SSH' };
  }
});

ipcMain.handle('dialog:select-ssh-key', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo de clave privada SSH',
    properties: ['openFile'],
    filters: [
      { name: 'Claves Privadas SSH (*.pem, *.id_rsa, *.key, *)', extensions: ['pem', 'id_rsa', 'key', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'ppk', '*'] },
      { name: 'Todos los archivos (*.*)', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('db:connect', async (_, config) => {
  try {
    await mariaService.connect(config);
    return { success: true, data: { database: mariaService.getCurrentConfig()?.database || '' } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al conectar con MariaDB / MySQL' };
  }
});

ipcMain.handle('db:disconnect', async () => {
  try {
    await mariaService.disconnect();
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al desconectar' };
  }
});

ipcMain.handle('db:get-status', async () => {
  return {
    isConnected: mariaService.isConnected(),
    config: mariaService.getCurrentConfig()
  };
});

// IPC: Databases & Multi-schema navigation
ipcMain.handle('db:get-databases', async () => {
  try {
    const data = await mariaService.getDatabases();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar bases de datos' };
  }
});

ipcMain.handle('db:switch-database', async (_, dbName: string) => {
  try {
    await mariaService.switchDatabase(dbName);
    return { success: true, data: dbName };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar de base de datos' };
  }
});

ipcMain.handle('db:create-database', async (_, options: { name: string; charset?: string; collation?: string }) => {
  try {
    const res = await mariaService.createDatabase(options);
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear la base de datos' };
  }
});

ipcMain.handle('db:drop-database', async (_, dbName: string) => {
  try {
    await mariaService.dropDatabase(dbName);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar la base de datos' };
  }
});

// IPC: Metadata
ipcMain.handle('db:get-schema-objects', async () => {
  try {
    const data = await mariaService.getSchemaObjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener objetos' };
  }
});

ipcMain.handle('db:get-table-details', async (_, tableName: string) => {
  try {
    const data = await mariaService.getTableDetails(tableName);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener detalles de la tabla' };
  }
});

ipcMain.handle('db:get-object-ddl', async (_, type: string, name: string) => {
  try {
    const data = await mariaService.getObjectDdl(type, name);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener DDL del objeto' };
  }
});

// IPC: Query and Script Execution
ipcMain.handle('db:execute-query', async (_, sql: string, maxRows?: number) => {
  try {
    const data = await mariaService.executeQuery(sql, maxRows);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al ejecutar consulta' };
  }
});

ipcMain.handle('db:execute-script', async (_, script: string) => {
  try {
    const data = await mariaService.executeScript(script);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al ejecutar script' };
  }
});

// IPC: File Dialogs
ipcMain.handle('dialog:save-sql-file', async (_, content: string, defaultPath?: string) => {
  if (!mainWindow) return false;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar archivo SQL',
    defaultPath: defaultPath || 'query.sql',
    filters: [
      { name: 'SQL Files', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('dialog:open-sql-file', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir archivo SQL',
    properties: ['openFile'],
    filters: [
      { name: 'SQL Files', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { content, filePath: filePaths[0] };
});

ipcMain.handle('dialog:export-data', async (_, data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => {
  if (!mainWindow) return false;
  const extensions = type === 'csv' ? ['csv'] : type === 'json' ? ['json'] : ['sql'];
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: `Exportar resultados (${type.toUpperCase()})`,
    defaultPath: defaultFilename,
    filters: [
      { name: `${type.toUpperCase()} Files`, extensions },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, data, 'utf-8');
  return true;
});

// IPC: Database Dump / Export (mysqldump style)
ipcMain.handle('db:start-dump', async (_, options: DumpOptions) => {
  try {
    const res = await dumpService.exportDatabase(options, (progress: DumpProgress) => {
      if (mainWindow) {
        mainWindow.webContents.send('db:dump-progress', progress);
      }
    });
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al exportar base de datos' };
  }
});

ipcMain.handle('db:cancel-dump', async () => {
  dumpService.cancel();
  return { success: true };
});

ipcMain.handle('dialog:select-dump-file', async (_, defaultFilename?: string) => {
  if (!mainWindow) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Ubicación para el Dump SQL de MariaDB / MySQL (.sql)',
    defaultPath: defaultFilename || 'mariadb_dump.sql',
    filters: [
      { name: 'SQL Script (*.sql)', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return null;
  return filePath;
});

ipcMain.handle('shell:show-item-in-folder', async (_, fullPath: string) => {
  if (fullPath && fs.existsSync(fullPath)) {
    shell.showItemInFolder(fullPath);
    return true;
  }
  return false;
});

// IPC: Database Import / Streaming Dump Loader
ipcMain.handle('db:start-import', async (_, options: any) => {
  try {
    const res = await dumpService.importDatabase(options, (progress: any) => {
      if (mainWindow) {
        mainWindow.webContents.send('db:import-progress', progress);
      }
    });
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al importar base de datos' };
  }
});

ipcMain.handle('db:cancel-import', async () => {
  dumpService.cancel();
  return { success: true };
});

ipcMain.handle('dialog:select-import-file', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo Dump SQL para importar (.sql)',
    properties: ['openFile'],
    filters: [
      { name: 'SQL Script (*.sql)', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const stat = fs.statSync(filePath);
  return { filePath, size: stat.size, name: path.basename(filePath) };
});
