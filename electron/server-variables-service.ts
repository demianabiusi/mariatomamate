import { MariaDbService } from './mariadb-service';

export interface ServerVariableItem {
  name: string;
  value: string;
  category: string;
  isReadOnly?: boolean;
}

export interface ServerStatusItem {
  name: string;
  value: string;
  category: string;
  numericValue?: number;
}

export interface ServerOverviewMetrics {
  version: string;
  flavor: 'mariadb' | 'mysql';
  uptimeSeconds: number;
  uptimeFormatted: string;
  threadsConnected: number;
  threadsRunning: number;
  maxConnections: number;
  connectionUsagePct: number;
  queriesTotal: number;
  queriesPerSecond: number;
  slowQueries: number;
  bufferPoolSizeFormatted: string;
  bufferPoolHitRatio: number | null;
  bytesReceivedFormatted: string;
  bytesSentFormatted: string;
  openTables: number;
  tableLocksWaited: number;
}

export interface ServerVariablesResponse {
  variables: ServerVariableItem[];
  status: ServerStatusItem[];
  overview: ServerOverviewMetrics;
  serverTime: string;
}

export class ServerVariablesService {
  constructor(private mariaService: MariaDbService) {}

  /**
   * Fetches all global/session variables, status counters, and computes key performance metrics.
   */
  public async getServerVariables(): Promise<ServerVariablesResponse> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      // 1. Fetch Variables
      let varRows: any[] = [];
      try {
        const [rows] = await conn.query('SHOW GLOBAL VARIABLES');
        if (Array.isArray(rows)) varRows = rows;
      } catch {
        try {
          const [rows] = await conn.query('SHOW VARIABLES');
          if (Array.isArray(rows)) varRows = rows;
        } catch (err: any) {
          throw new Error(`Error al consultar variables del servidor: ${err.message || String(err)}`);
        }
      }

      // 2. Fetch Status
      let statusRows: any[] = [];
      try {
        const [rows] = await conn.query('SHOW GLOBAL STATUS');
        if (Array.isArray(rows)) statusRows = rows;
      } catch {
        try {
          const [rows] = await conn.query('SHOW STATUS');
          if (Array.isArray(rows)) statusRows = rows;
        } catch (err: any) {
          throw new Error(`Error al consultar estado del servidor: ${err.message || String(err)}`);
        }
      }

      // 3. Process Variables
      const varMap = new Map<string, string>();
      const variables: ServerVariableItem[] = [];

      for (const r of varRows) {
        const name = String(r.Variable_name ?? r.variable_name ?? r.VARIABLE_NAME ?? '');
        const val = String(r.Value ?? r.value ?? r.VARIABLE_VALUE ?? '');
        if (!name) continue;
        varMap.set(name, val);
        variables.push({
          name,
          value: val,
          category: this.categorizeVariable(name),
        });
      }
      variables.sort((a, b) => a.name.localeCompare(b.name));

      // 4. Process Status
      const statusMap = new Map<string, string>();
      const status: ServerStatusItem[] = [];

      for (const r of statusRows) {
        const name = String(r.Variable_name ?? r.variable_name ?? r.VARIABLE_NAME ?? '');
        const val = String(r.Value ?? r.value ?? r.VARIABLE_VALUE ?? '');
        if (!name) continue;
        statusMap.set(name, val);

        const num = Number(val);
        status.push({
          name,
          value: val,
          category: this.categorizeStatus(name),
          numericValue: !isNaN(num) ? num : undefined,
        });
      }
      status.sort((a, b) => a.name.localeCompare(b.name));

      // 5. Compute Overview Metrics
      const versionStr = varMap.get('version') || 'Desconocida';
      const isMariaDb = versionStr.toLowerCase().includes('mariadb');
      const uptimeSec = Number(statusMap.get('Uptime') || 0);
      const threadsConnected = Number(statusMap.get('Threads_connected') || 0);
      const threadsRunning = Number(statusMap.get('Threads_running') || 0);
      const maxConn = Number(varMap.get('max_connections') || 151);
      const queriesTotal = Number(statusMap.get('Queries') || statusMap.get('Questions') || 0);
      const slowQueries = Number(statusMap.get('Slow_queries') || 0);
      const qps = uptimeSec > 0 ? Number((queriesTotal / uptimeSec).toFixed(2)) : 0;
      const connUsagePct = maxConn > 0 ? Number(((threadsConnected / maxConn) * 100).toFixed(1)) : 0;

      // Buffer Pool Size & Hit Ratio
      const bpBytes = Number(varMap.get('innodb_buffer_pool_size') || 0);
      const bpReads = Number(statusMap.get('Innodb_buffer_pool_reads') || 0);
      const bpRequests = Number(statusMap.get('Innodb_buffer_pool_read_requests') || 0);
      let hitRatio: number | null = null;
      if (bpRequests > 0) {
        hitRatio = Number((((bpRequests - bpReads) / bpRequests) * 100).toFixed(2));
      }

      // Traffic
      const bytesRecv = Number(statusMap.get('Bytes_received') || 0);
      const bytesSent = Number(statusMap.get('Bytes_sent') || 0);

      const overview: ServerOverviewMetrics = {
        version: versionStr,
        flavor: isMariaDb ? 'mariadb' : 'mysql',
        uptimeSeconds: uptimeSec,
        uptimeFormatted: this.formatUptime(uptimeSec),
        threadsConnected,
        threadsRunning,
        maxConnections: maxConn,
        connectionUsagePct: connUsagePct,
        queriesTotal,
        queriesPerSecond: qps,
        slowQueries,
        bufferPoolSizeFormatted: this.formatBytes(bpBytes),
        bufferPoolHitRatio: hitRatio,
        bytesReceivedFormatted: this.formatBytes(bytesRecv),
        bytesSentFormatted: this.formatBytes(bytesSent),
        openTables: Number(statusMap.get('Open_tables') || 0),
        tableLocksWaited: Number(statusMap.get('Table_locks_waited') || 0),
      };

      return {
        variables,
        status,
        overview,
        serverTime: new Date().toLocaleTimeString(),
      };
    });
  }

  /**
   * Updates a server variable at runtime using `SET GLOBAL \`name\` = ...;`
   */
  public async setServerVariable(name: string, value: string): Promise<{ success: boolean; sql: string }> {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error(`Nombre de variable no válido: "${name}"`);
    }

    const trimmed = value.trim();
    let valLiteral: string;
    const upper = trimmed.toUpperCase();

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      valLiteral = trimmed;
    } else if (upper === 'ON' || upper === 'OFF' || upper === 'DEFAULT') {
      valLiteral = upper;
    } else {
      valLiteral = `'${trimmed.replace(/'/g, "''")}'`;
    }

    const sql = `SET GLOBAL \`${name}\` = ${valLiteral};`;
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      await conn.query(sql);
      return { success: true, sql };
    });
  }

  private categorizeVariable(name: string): string {
    const n = name.toLowerCase();
    if (n.startsWith('innodb_')) return 'innodb';
    if (
      n.includes('connection') ||
      n.includes('timeout') ||
      n.includes('packet') ||
      n.includes('port') ||
      n.includes('bind') ||
      n.includes('socket') ||
      n.startsWith('net_') ||
      n.includes('host')
    ) {
      return 'network';
    }
    if (
      n.includes('buffer') ||
      n.includes('cache') ||
      n.endsWith('_size') ||
      n.includes('heap') ||
      n.includes('tmp_table')
    ) {
      return 'memory';
    }
    if (n.includes('log') || n.includes('audit') || n.includes('binlog') || n.includes('relay')) {
      return 'logs';
    }
    if (n.includes('character_set') || n.includes('collation')) {
      return 'charset';
    }
    if (
      n.includes('slave') ||
      n.includes('replica') ||
      n.includes('gtid') ||
      n.includes('server_id') ||
      n.startsWith('rpl_')
    ) {
      return 'replication';
    }
    if (
      n.includes('ssl') ||
      n.includes('tls') ||
      n.includes('auth') ||
      n.includes('password') ||
      n.includes('secure') ||
      n.includes('read_only')
    ) {
      return 'security';
    }
    if (
      n.startsWith('optimizer_') ||
      n.startsWith('join_') ||
      n.startsWith('sort_') ||
      n.startsWith('thread_')
    ) {
      return 'performance';
    }
    return 'general';
  }

  private categorizeStatus(name: string): string {
    const n = name.toLowerCase();
    if (n.startsWith('innodb_')) return 'innodb';
    if (n.startsWith('threads_') || n.includes('connections') || n.includes('aborted')) return 'connections';
    if (n.startsWith('queries') || n.startsWith('questions') || n.startsWith('bytes_') || n.startsWith('com_')) {
      return 'traffic';
    }
    if (n.includes('cache') || n.includes('buffer')) return 'memory';
    if (n.includes('lock') || n.includes('table_')) return 'tables_locks';
    if (n.includes('tmp_')) return 'temporary';
    if (n.includes('slave_') || n.includes('wsrep_') || n.includes('rpl_')) return 'replication';
    return 'general';
  }

  private formatBytes(bytes: number): string {
    if (isNaN(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || 'TB'}`;
  }

  private formatUptime(seconds: number): string {
    if (isNaN(seconds) || seconds <= 0) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
  }
}
