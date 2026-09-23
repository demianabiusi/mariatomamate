import mysql from 'mysql2/promise';
import { MariaDbService } from './mariadb-service';

export interface DbProcessItem {
  id: number;
  user: string;
  host: string;
  db: string | null;
  command: string;
  time: number;
  state: string | null;
  info: string | null;
  memoryUsed?: number;
  progress?: number;
  isCurrentConnection: boolean;
}

export interface ProcessListSummary {
  total: number;
  active: number;
  sleeping: number;
  locked: number;
  maxTime: number;
}

export interface ProcessListResponse {
  processes: DbProcessItem[];
  summary: ProcessListSummary;
  currentConnectionId: number;
  serverTime: string;
}

export class ProcessService {
  constructor(private mariaService: MariaDbService) {}

  /**
   * Fetches the real-time process list from the server using
   * information_schema.PROCESSLIST or SHOW FULL PROCESSLIST as fallback.
   */
  public async getProcessList(): Promise<ProcessListResponse> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      // 1. Get current connection ID
      let currentConnId = 0;
      try {
        const [connRows] = await conn.query('SELECT CONNECTION_ID() AS id');
        const first = Array.isArray(connRows) ? (connRows[0] as any) : null;
        if (first?.id) {
          currentConnId = Number(first.id);
        }
      } catch {}

      // 2. Fetch processes
      let rows: any[] = [];
      try {
        // Try information_schema.PROCESSLIST first (supports MariaDB memory & progress)
        const [infoRows] = await conn.query(`
          SELECT * 
          FROM information_schema.PROCESSLIST 
          ORDER BY TIME DESC, ID ASC
        `);
        if (Array.isArray(infoRows)) {
          rows = infoRows as any[];
        }
      } catch {
        // Fallback to SHOW FULL PROCESSLIST
        try {
          const [fullRows] = await conn.query('SHOW FULL PROCESSLIST');
          if (Array.isArray(fullRows)) {
            rows = fullRows as any[];
          }
        } catch (err: any) {
          throw new Error(`Error al consultar procesos del servidor: ${err.message || String(err)}`);
        }
      }

      // 3. Normalize processes
      const processes: DbProcessItem[] = [];
      let active = 0;
      let sleeping = 0;
      let locked = 0;
      let maxTime = 0;

      for (const r of rows) {
        const id = Number(r.ID ?? r.Id ?? 0);
        const user = String(r.USER ?? r.User ?? '');
        const host = String(r.HOST ?? r.Host ?? '');
        const db = r.DB ?? r.Db ?? null;
        const command = String(r.COMMAND ?? r.Command ?? '');
        const time = Number(r.TIME ?? r.Time ?? 0);
        const state = r.STATE ?? r.State ? String(r.STATE ?? r.State) : null;
        const info = r.INFO ?? r.Info ? String(r.INFO ?? r.Info) : null;
        const memoryUsed = r.MEMORY_USED !== undefined ? Number(r.MEMORY_USED) : undefined;
        const progress = r.PROGRESS !== undefined ? Number(r.PROGRESS) : undefined;

        const isCurrentConnection = id === currentConnId;
        const isSleep = command.toLowerCase() === 'sleep';
        const isLock = state ? state.toLowerCase().includes('lock') : false;

        if (isSleep) {
          sleeping++;
        } else {
          active++;
          if (time > maxTime) {
            maxTime = time;
          }
        }

        if (isLock) {
          locked++;
        }

        processes.push({
          id,
          user,
          host,
          db,
          command,
          time,
          state,
          info,
          memoryUsed,
          progress,
          isCurrentConnection
        });
      }

      const summary: ProcessListSummary = {
        total: processes.length,
        active,
        sleeping,
        locked,
        maxTime
      };

      return {
        processes,
        summary,
        currentConnectionId: currentConnId,
        serverTime: new Date().toLocaleTimeString()
      };
    });
  }

  /**
   * Kills a query or an entire connection process.
   */
  public async killProcess(id: number, type: 'CONNECTION' | 'QUERY' = 'CONNECTION'): Promise<void> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      const pid = Number(id);
      if (!pid || isNaN(pid)) {
        throw new Error('ID de proceso inválido');
      }

      const sql = type === 'QUERY' ? `KILL QUERY ${pid}` : `KILL ${pid}`;
      await conn.query(sql);
    });
  }
}
