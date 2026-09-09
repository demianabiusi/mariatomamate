import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database?: string;
  charset: string;
  ssl?: boolean;
  createdAt?: string;
}

export interface AppSettings {
  lastActiveConnectionId?: string | null;
  autoConnectOnStartup?: boolean;
}

export class StorageService {
  private configPath: string;
  private settingsPath: string;
  private connections: SavedConnection[] = [];
  private settings: AppSettings = {
    lastActiveConnectionId: null,
    autoConnectOnStartup: true
  };

  constructor() {
    const userDataPath = app?.getPath('userData') || './data';
    if (!fs.existsSync(userDataPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
      } catch (err) {
        console.error('Failed to create userData dir', err);
      }
    }
    this.configPath = path.join(userDataPath, 'mariadb-connections.json');
    this.settingsPath = path.join(userDataPath, 'app-settings.json');
    this.load();
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('Error loading app settings:', err);
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public saveSettings(patch: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...patch };
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving app settings:', err);
    }
    return this.settings;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        this.connections = JSON.parse(raw);
      } else {
        // Default initial sample connection for MariaDB / MySQL
        this.connections = [
          {
            id: 'default-local',
            name: 'Localhost (MariaDB / MySQL)',
            host: '127.0.0.1',
            port: 3306,
            user: 'root',
            password: '',
            database: '',
            charset: 'utf8mb4',
            ssl: false,
            createdAt: new Date().toISOString()
          }
        ];
        this.save();
      }
    } catch (err) {
      console.error('Error loading connections:', err);
      this.connections = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.connections, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving connections:', err);
    }
  }

  public getConnections(): SavedConnection[] {
    return this.connections;
  }

  public saveConnection(conn: SavedConnection): SavedConnection {
    const index = this.connections.findIndex(c => c.id === conn.id);
    if (index >= 0) {
      this.connections[index] = { ...conn };
    } else {
      if (!conn.id) {
        conn.id = 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      }
      conn.createdAt = conn.createdAt || new Date().toISOString();
      this.connections.push(conn);
    }
    this.save();
    return conn;
  }

  public deleteConnection(id: string): boolean {
    const prevLen = this.connections.length;
    this.connections = this.connections.filter(c => c.id !== id);
    if (this.connections.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }
}
