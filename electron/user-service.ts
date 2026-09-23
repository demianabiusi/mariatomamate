import mysql from 'mysql2/promise';
import { MariaDbService } from './mariadb-service';

export type ServerFlavor = 'mariadb' | 'mysql';

export interface ServerInfo {
  flavor: ServerFlavor;
  version: string;
  fullVersion: string;
  major: number;
  minor: number;
  patch: number;
  supportsRoles: boolean;
  supportsAccountLocking: boolean;
  supportsPasswordExpire: boolean;
  supportsPasswordHistory: boolean;
  supportsFailedLoginAttempts: boolean;
  supportsGlobalGrants: boolean;
  isMariaDb104Plus: boolean;
  availablePlugins: string[];
  defaultAuthPlugin: string;
}

export interface DbUserItem {
  user: string;
  host: string;
  isRole: boolean;
  plugin: string;
  hasPassword: boolean;
  accountLocked: boolean;
  passwordExpired: boolean;
  isCurrentUser: boolean;
}

export interface DatabasePrivilege {
  database: string;
  privileges: string[];
  grantOption: boolean;
}

export interface DbUserDetails {
  user: string;
  host: string;
  isRole: boolean;
  plugin: string;
  accountLocked: boolean;
  passwordExpired: boolean;
  passwordExpirePolicy?: 'DEFAULT' | 'NEVER' | 'INTERVAL';
  passwordExpireDays?: number;
  maxQueriesPerHour: number;
  maxUpdatesPerHour: number;
  maxConnectionsPerHour: number;
  maxUserConnections: number;
  sslType: 'NONE' | 'ANY' | 'X509' | 'SPECIFIED';
  globalPrivileges: string[];
  globalGrantOption: boolean;
  databasePrivileges: DatabasePrivilege[];
  assignedRoles: string[];
  defaultRole?: string;
  rawGrants: string[];
}

export interface UserSavePlan {
  isNew: boolean;
  user: string;
  host: string;
  originalUser?: string;
  originalHost?: string;
  isRole?: boolean;
  password?: string;
  authPlugin?: string;
  accountLocked?: boolean;
  passwordExpirePolicy?: 'DEFAULT' | 'NEVER' | 'IMMEDIATE' | 'INTERVAL';
  passwordExpireDays?: number;
  maxQueriesPerHour?: number;
  maxUpdatesPerHour?: number;
  maxConnectionsPerHour?: number;
  maxUserConnections?: number;
  sslType?: 'NONE' | 'ANY' | 'X509';
  globalPrivileges: string[];
  globalGrantOption: boolean;
  databasePrivileges: DatabasePrivilege[];
  assignedRoles?: string[];
  defaultRole?: string;
}

export interface UserPlanExecutionResult {
  success: boolean;
  statementsExecuted: number;
  statements: string[];
  errors: { statement: string; error: string }[];
  durationMs: number;
}

export class UserService {
  constructor(private mariaService: MariaDbService) {}

  /**
   * Probes the connected server and determines its flavor, version numbers,
   * available auth plugins, and capabilities matrix.
   */
  public async getServerInfo(): Promise<ServerInfo> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      let fullVersion = '';
      let versionComment = '';

      try {
        const [rows] = await conn.query('SELECT VERSION() AS version, @@version_comment AS comment');
        if (Array.isArray(rows) && rows[0]) {
          fullVersion = String((rows[0] as any).version || '');
          versionComment = String((rows[0] as any).comment || '');
        }
      } catch (err) {
        try {
          const [rows] = await conn.query('SELECT VERSION() AS version');
          if (Array.isArray(rows) && rows[0]) {
            fullVersion = String((rows[0] as any).version || '');
          }
        } catch {}
      }

      const isMariaDB = 
        fullVersion.toLowerCase().includes('mariadb') || 
        versionComment.toLowerCase().includes('mariadb');

      const flavor: ServerFlavor = isMariaDB ? 'mariadb' : 'mysql';

      // Parse version digits: e.g. "10.11.4-MariaDB" -> 10, 11, 4
      // or "8.0.35" -> 8, 0, 35
      let major = 5;
      let minor = 7;
      let patch = 0;
      let cleanVersion = '5.7.0';

      const match = fullVersion.match(/(\d+)\.(\d+)\.(\d+)/);
      if (match) {
        major = parseInt(match[1], 10);
        minor = parseInt(match[2], 10);
        patch = parseInt(match[3], 10);
        cleanVersion = `${major}.${minor}.${patch}`;
      } else {
        const simpleMatch = fullVersion.match(/(\d+)\.(\d+)/);
        if (simpleMatch) {
          major = parseInt(simpleMatch[1], 10);
          minor = parseInt(simpleMatch[2], 10);
          cleanVersion = `${major}.${minor}.0`;
        }
      }

      // Query available auth plugins
      const availablePlugins: string[] = [];
      try {
        const [pluginsRows] = await conn.query(
          "SELECT PLUGIN_NAME FROM information_schema.PLUGINS WHERE PLUGIN_TYPE = 'AUTHENTICATION' AND PLUGIN_STATUS = 'ACTIVE'"
        );
        if (Array.isArray(pluginsRows)) {
          for (const row of pluginsRows as any[]) {
            if (row.PLUGIN_NAME) availablePlugins.push(String(row.PLUGIN_NAME));
          }
        }
      } catch {
        // Fallback plugins if information_schema.PLUGINS is restricted
        if (flavor === 'mysql' && major >= 8) {
          availablePlugins.push('caching_sha2_password', 'mysql_native_password', 'sha256_password');
        } else if (flavor === 'mariadb') {
          availablePlugins.push('mysql_native_password', 'ed25519', 'unix_socket');
        } else {
          availablePlugins.push('mysql_native_password');
        }
      }

      // Capabilities matrix
      const supportsRoles = flavor === 'mariadb' 
        ? (major > 10 || (major === 10 && minor >= 0)) // MariaDB >= 10.0.5
        : major >= 8; // MySQL >= 8.0

      const supportsAccountLocking = flavor === 'mariadb'
        ? (major > 10 || (major === 10 && minor >= 4)) // MariaDB >= 10.4.2
        : (major > 5 || (major === 5 && minor >= 7)); // MySQL >= 5.7.6

      const supportsPasswordExpire = flavor === 'mariadb'
        ? (major > 10 || (major === 10 && minor >= 4)) // MariaDB >= 10.4.2
        : (major > 5 || (major === 5 && minor >= 7)); // MySQL >= 5.7.4

      const supportsPasswordHistory = flavor === 'mysql' && major >= 8;
      const supportsFailedLoginAttempts = flavor === 'mysql' && major >= 8 && (minor > 0 || patch >= 19);
      const supportsGlobalGrants = flavor === 'mysql' && major >= 8;
      const isMariaDb104Plus = flavor === 'mariadb' && (major > 10 || (major === 10 && minor >= 4));

      // Recommended default auth plugin
      let defaultAuthPlugin = 'mysql_native_password';
      if (flavor === 'mysql' && major >= 8) {
        defaultAuthPlugin = 'caching_sha2_password';
      } else if (flavor === 'mariadb' && availablePlugins.includes('mysql_native_password')) {
        defaultAuthPlugin = 'mysql_native_password';
      }

      return {
        flavor,
        version: cleanVersion,
        fullVersion,
        major,
        minor,
        patch,
        supportsRoles,
        supportsAccountLocking,
        supportsPasswordExpire,
        supportsPasswordHistory,
        supportsFailedLoginAttempts,
        supportsGlobalGrants,
        isMariaDb104Plus,
        availablePlugins,
        defaultAuthPlugin
      };
    });
  }

  /**
   * Lists all users (and roles if supported) on the database server,
   * safely handling version differences in column names in mysql.user.
   */
  public async listUsers(): Promise<DbUserItem[]> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      // Find current user for highlighting
      let currentAccount = '';
      try {
        const [currUserRows] = await conn.query('SELECT CURRENT_USER() AS cu');
        const firstRow = Array.isArray(currUserRows) ? (currUserRows[0] as any) : null;
        currentAccount = firstRow?.cu ? String(firstRow.cu) : '';
      } catch {}

      // Discover which columns exist in mysql.user
      const [colRows] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'mysql' AND TABLE_NAME = 'user'
      `);

      const availableCols = new Set<string>();
      if (Array.isArray(colRows)) {
        for (const row of colRows as any[]) {
          if (row.COLUMN_NAME) availableCols.add(String(row.COLUMN_NAME).toLowerCase());
        }
      }

      const hasPlugin = availableCols.has('plugin');
      const hasAuthStr = availableCols.has('authentication_string');
      const hasPassword = availableCols.has('password');
      const hasAccountLocked = availableCols.has('account_locked');
      const hasPasswordExpired = availableCols.has('password_expired');
      const hasIsRole = availableCols.has('is_role');

      const selectParts = [
        'User',
        'Host',
        hasPlugin ? 'plugin' : "'' AS plugin",
        hasAuthStr ? 'authentication_string' : (hasPassword ? 'Password AS authentication_string' : "'' AS authentication_string"),
        hasAccountLocked ? 'account_locked' : "'N' AS account_locked",
        hasPasswordExpired ? 'password_expired' : "'N' AS password_expired",
        hasIsRole ? 'is_role' : "'N' AS is_role"
      ];

      const [usersRows] = await conn.query(`
        SELECT ${selectParts.join(', ')}
        FROM mysql.user
        ORDER BY User ASC, Host ASC
      `);

      // Detect roles in MySQL 8 (mysql.role_edges or mysql.default_roles)
      const mysql8Roles = new Set<string>();
      try {
        const [roleRows] = await conn.query(
          "SELECT DISTINCT FROM_USER AS role_name FROM mysql.role_edges"
        );
        if (Array.isArray(roleRows)) {
          for (const r of roleRows as any[]) {
            if (r.role_name) mysql8Roles.add(String(r.role_name));
          }
        }
      } catch {}

      const result: DbUserItem[] = [];
      if (Array.isArray(usersRows)) {
        for (const r of usersRows as any[]) {
          const user = String(r.User ?? '');
          const host = String(r.Host ?? '');
          const plugin = String(r.plugin ?? '');
          const authStr = String(r.authentication_string ?? '');
          const accountLocked = String(r.account_locked || '').toUpperCase() === 'Y';
          const passwordExpired = String(r.password_expired || '').toUpperCase() === 'Y';
          const isRoleMariaDb = String(r.is_role || '').toUpperCase() === 'Y';
          const isRoleMysql8 = mysql8Roles.has(user) && (host === '%' || host === '');
          const isRole = isRoleMariaDb || isRoleMysql8;

          // Check if matches CURRENT_USER() ('user'@'host')
          const isCurrentUser = Boolean(
            currentAccount && 
            (currentAccount === `'${user}'@'${host}'` || currentAccount === `${user}@${host}`)
          );

          result.push({
            user,
            host,
            isRole,
            plugin,
            hasPassword: Boolean(authStr && authStr.length > 0),
            accountLocked,
            passwordExpired,
            isCurrentUser
          });
        }
      }

      return result;
    });
  }

  /**
   * Retrieves full details, permissions, limits, and roles for a specific user@host.
   */
  public async getUserDetails(user: string, host: string): Promise<DbUserDetails> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      // 1. Read row from mysql.user
      const [colRows] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'mysql' AND TABLE_NAME = 'user'
      `);
      const availableCols = new Set<string>();
      if (Array.isArray(colRows)) {
        for (const row of colRows as any[]) {
          if (row.COLUMN_NAME) availableCols.add(String(row.COLUMN_NAME).toLowerCase());
        }
      }

      const hasPlugin = availableCols.has('plugin');
      const hasAccountLocked = availableCols.has('account_locked');
      const hasPasswordExpired = availableCols.has('password_expired');
      const hasIsRole = availableCols.has('is_role');
      const hasMaxQuestions = availableCols.has('max_questions');
      const hasMaxUpdates = availableCols.has('max_updates');
      const hasMaxConnections = availableCols.has('max_connections');
      const hasMaxUserConnections = availableCols.has('max_user_connections');
      const hasSslType = availableCols.has('ssl_type');

      const selectCols = [
        'User',
        'Host',
        hasPlugin ? 'plugin' : "'' AS plugin",
        hasAccountLocked ? 'account_locked' : "'N' AS account_locked",
        hasPasswordExpired ? 'password_expired' : "'N' AS password_expired",
        hasIsRole ? 'is_role' : "'N' AS is_role",
        hasMaxQuestions ? 'max_questions' : '0 AS max_questions',
        hasMaxUpdates ? 'max_updates' : '0 AS max_updates',
        hasMaxConnections ? 'max_connections' : '0 AS max_connections',
        hasMaxUserConnections ? 'max_user_connections' : '0 AS max_user_connections',
        hasSslType ? 'ssl_type' : "'' AS ssl_type"
      ];

      const [userRows] = await conn.query(
        `SELECT ${selectCols.join(', ')} FROM mysql.user WHERE User = ? AND Host = ? LIMIT 1`,
        [user, host]
      );

      const userRow = Array.isArray(userRows) && userRows[0] ? (userRows[0] as any) : null;

      // 2. Read SHOW GRANTS FOR 'user'@'host'
      const rawGrants: string[] = [];
      const assignedRoles: string[] = [];
      try {
        const [grantsRows] = await conn.query(`SHOW GRANTS FOR \`${user}\`@\`${host}\``);
        if (Array.isArray(grantsRows)) {
          for (const g of grantsRows as any[]) {
            const val = Object.values(g)[0];
            if (val) {
              const grantStr = String(val);
              rawGrants.push(grantStr);

              // Detect role assignment: GRANT 'rolename' TO 'user'@'host'
              const roleMatch = grantStr.match(/^GRANT\s+(.+?)\s+TO\s+/i);
              if (roleMatch && !grantStr.toUpperCase().includes(' ON ')) {
                const potentialRoles = roleMatch[1].split(',').map(r => r.trim().replace(/^['`"]|['`"]$/g, ''));
                for (const pr of potentialRoles) {
                  if (pr && !assignedRoles.includes(pr)) assignedRoles.push(pr);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Could not fetch SHOW GRANTS for ${user}@${host}:`, err);
      }

      // 3. Read global privileges from information_schema.USER_PRIVILEGES
      const globalPrivileges: string[] = [];
      let globalGrantOption = false;
      const granteePatterns = [
        `'${user}'@'${host}'`,
        `\`${user}\`@\`${host}\``
      ];

      try {
        const [userPrivs] = await conn.query(
          `SELECT PRIVILEGE_TYPE, IS_GRANTABLE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE IN (?, ?)`,
          granteePatterns
        );
        if (Array.isArray(userPrivs)) {
          for (const p of userPrivs as any[]) {
            if (p.PRIVILEGE_TYPE && p.PRIVILEGE_TYPE !== 'USAGE') {
              globalPrivileges.push(String(p.PRIVILEGE_TYPE).toUpperCase());
            }
            if (String(p.IS_GRANTABLE).toUpperCase() === 'YES') {
              globalGrantOption = true;
            }
          }
        }
      } catch {}

      // If globalPrivileges is empty but rawGrants has ALL PRIVILEGES ON *.*
      for (const rg of rawGrants) {
        if (/GRANT\s+ALL\s+PRIVILEGES\s+ON\s+\*\.\*/i.test(rg)) {
          if (!globalPrivileges.includes('ALL PRIVILEGES')) globalPrivileges.push('ALL PRIVILEGES');
          if (/WITH\s+GRANT\s+OPTION/i.test(rg)) globalGrantOption = true;
        }
      }

      // 4. Read database/schema privileges from information_schema.SCHEMA_PRIVILEGES
      const databasePrivilegesMap = new Map<string, { privileges: Set<string>; grantOption: boolean }>();
      try {
        const [schemaPrivs] = await conn.query(
          `SELECT TABLE_SCHEMA, PRIVILEGE_TYPE, IS_GRANTABLE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE IN (?, ?)`,
          granteePatterns
        );
        if (Array.isArray(schemaPrivs)) {
          for (const sp of schemaPrivs as any[]) {
            const dbName = String(sp.TABLE_SCHEMA);
            if (!databasePrivilegesMap.has(dbName)) {
              databasePrivilegesMap.set(dbName, { privileges: new Set(), grantOption: false });
            }
            const entry = databasePrivilegesMap.get(dbName)!;
            if (sp.PRIVILEGE_TYPE) entry.privileges.add(String(sp.PRIVILEGE_TYPE).toUpperCase());
            if (String(sp.IS_GRANTABLE).toUpperCase() === 'YES') entry.grantOption = true;
          }
        }
      } catch {}

      // Also parse SHOW GRANTS for database grants: GRANT ... ON `db`.* TO ...
      for (const rg of rawGrants) {
        const dbMatch = rg.match(/^GRANT\s+(.+?)\s+ON\s+[`"]?([^.*`"]+)[`"]?\.\*\s+TO/i);
        if (dbMatch) {
          const privString = dbMatch[1].trim();
          const dbName = dbMatch[2].trim();
          if (dbName !== '*') {
            if (!databasePrivilegesMap.has(dbName)) {
              databasePrivilegesMap.set(dbName, { privileges: new Set(), grantOption: false });
            }
            const entry = databasePrivilegesMap.get(dbName)!;
            if (/WITH\s+GRANT\s+OPTION/i.test(rg)) entry.grantOption = true;

            if (/ALL\s+PRIVILEGES/i.test(privString)) {
              entry.privileges.add('ALL PRIVILEGES');
            } else {
              privString.split(',').forEach(p => {
                const cleaned = p.trim().toUpperCase();
                if (cleaned) entry.privileges.add(cleaned);
              });
            }
          }
        }
      }

      const databasePrivileges: DatabasePrivilege[] = Array.from(databasePrivilegesMap.entries()).map(
        ([dbName, data]) => ({
          database: dbName,
          privileges: Array.from(data.privileges),
          grantOption: data.grantOption
        })
      );

      // Parse SSL Type
      let sslType: 'NONE' | 'ANY' | 'X509' | 'SPECIFIED' = 'NONE';
      const rawSsl = String(userRow?.ssl_type || '').toUpperCase();
      if (rawSsl === 'ANY') sslType = 'ANY';
      else if (rawSsl === 'X509') sslType = 'X509';
      else if (rawSsl === 'SPECIFIED') sslType = 'SPECIFIED';

      return {
        user,
        host,
        isRole: Boolean(String(userRow?.is_role || '').toUpperCase() === 'Y'),
        plugin: String(userRow?.plugin || ''),
        accountLocked: String(userRow?.account_locked || '').toUpperCase() === 'Y',
        passwordExpired: String(userRow?.password_expired || '').toUpperCase() === 'Y',
        maxQueriesPerHour: Number(userRow?.max_questions) || 0,
        maxUpdatesPerHour: Number(userRow?.max_updates) || 0,
        maxConnectionsPerHour: Number(userRow?.max_connections) || 0,
        maxUserConnections: Number(userRow?.max_user_connections) || 0,
        sslType,
        globalPrivileges,
        globalGrantOption,
        databasePrivileges,
        assignedRoles,
        rawGrants
      };
    });
  }

  /**
   * Generates the precise, version-compliant SQL statements for creating or updating
   * a user, changing passwords, setting privileges, limits, and roles.
   */
  public generateStatements(plan: UserSavePlan, serverInfo: ServerInfo): string[] {
    const statements: string[] = [];
    const u = plan.user.replace(/[`'\\]/g, '');
    const h = plan.host.replace(/[`'\\]/g, '');
    const userHostTarget = `'${u}'@'${h}'`;

    // 1. Creation or Renaming
    if (plan.isNew) {
      if (plan.isRole && serverInfo.supportsRoles) {
        statements.push(`CREATE ROLE '${u}';`);
        return statements;
      }

      // Construct CREATE USER based on server flavor and version
      let createSql = `CREATE USER '${u}'@'${h}'`;

      const pluginToUse = plan.authPlugin || serverInfo.defaultAuthPlugin;
      const pwd = plan.password !== undefined ? plan.password : '';

      if (serverInfo.flavor === 'mysql' && serverInfo.major >= 8) {
        // MySQL 8.0+: IDENTIFIED WITH plugin BY 'pass'
        if (pwd) {
          createSql += ` IDENTIFIED WITH '${pluginToUse}' BY '${this.escapeSqlString(pwd)}'`;
        } else if (pluginToUse) {
          createSql += ` IDENTIFIED WITH '${pluginToUse}' BY ''`;
        }
      } else if (serverInfo.flavor === 'mysql' && serverInfo.major === 5 && serverInfo.minor >= 7) {
        // MySQL 5.7
        if (pwd) {
          createSql += ` IDENTIFIED WITH '${pluginToUse}' BY '${this.escapeSqlString(pwd)}'`;
        } else {
          createSql += ` IDENTIFIED WITH '${pluginToUse}' BY ''`;
        }
      } else if (serverInfo.flavor === 'mariadb' && serverInfo.isMariaDb104Plus) {
        // MariaDB 10.4+
        if (pwd) {
          createSql += ` IDENTIFIED BY '${this.escapeSqlString(pwd)}'`;
        }
      } else {
        // MySQL 5.5/5.6 or MariaDB <= 10.3
        if (pwd) {
          createSql += ` IDENTIFIED BY '${this.escapeSqlString(pwd)}'`;
        }
      }

      // TLS / SSL option during CREATE USER
      if (plan.sslType === 'ANY') {
        createSql += ' REQUIRE SSL';
      } else if (plan.sslType === 'X509') {
        createSql += ' REQUIRE X509';
      } else if (plan.sslType === 'NONE') {
        createSql += ' REQUIRE NONE';
      }

      // Resource limits during CREATE USER
      const limits: string[] = [];
      if ((plan.maxQueriesPerHour || 0) > 0) limits.push(`MAX_QUERIES_PER_HOUR ${plan.maxQueriesPerHour}`);
      if ((plan.maxUpdatesPerHour || 0) > 0) limits.push(`MAX_UPDATES_PER_HOUR ${plan.maxUpdatesPerHour}`);
      if ((plan.maxConnectionsPerHour || 0) > 0) limits.push(`MAX_CONNECTIONS_PER_HOUR ${plan.maxConnectionsPerHour}`);
      if ((plan.maxUserConnections || 0) > 0) limits.push(`MAX_USER_CONNECTIONS ${plan.maxUserConnections}`);
      if (limits.length > 0) {
        createSql += ` WITH ${limits.join(' ')}`;
      }

      // Account locking during CREATE USER (if supported)
      if (serverInfo.supportsAccountLocking) {
        createSql += plan.accountLocked ? ' ACCOUNT LOCK' : ' ACCOUNT UNLOCK';
      }

      // Password expire during CREATE USER (if supported)
      if (serverInfo.supportsPasswordExpire && plan.passwordExpirePolicy) {
        if (plan.passwordExpirePolicy === 'NEVER') {
          createSql += ' PASSWORD EXPIRE NEVER';
        } else if (plan.passwordExpirePolicy === 'IMMEDIATE') {
          createSql += ' PASSWORD EXPIRE';
        } else if (plan.passwordExpirePolicy === 'INTERVAL' && plan.passwordExpireDays) {
          createSql += ` PASSWORD EXPIRE INTERVAL ${plan.passwordExpireDays} DAY`;
        } else if (plan.passwordExpirePolicy === 'DEFAULT') {
          createSql += ' PASSWORD EXPIRE DEFAULT';
        }
      }

      createSql += ';';
      statements.push(createSql);
    } else {
      // Existing user: check if renamed
      const origU = plan.originalUser?.replace(/[`'\\]/g, '') || u;
      const origH = plan.originalHost?.replace(/[`'\\]/g, '') || h;
      if (origU !== u || origH !== h) {
        statements.push(`RENAME USER '${origU}'@'${origH}' TO '${u}'@'${h}';`);
      }

      // Change Password if provided
      if (plan.password !== undefined && plan.password !== '') {
        const pwd = plan.password;
        const pluginToUse = plan.authPlugin || serverInfo.defaultAuthPlugin;

        if (serverInfo.flavor === 'mysql' && serverInfo.major >= 8) {
          statements.push(`ALTER USER ${userHostTarget} IDENTIFIED WITH '${pluginToUse}' BY '${this.escapeSqlString(pwd)}';`);
        } else if (serverInfo.flavor === 'mysql' && serverInfo.major === 5 && serverInfo.minor >= 7) {
          statements.push(`ALTER USER ${userHostTarget} IDENTIFIED WITH '${pluginToUse}' BY '${this.escapeSqlString(pwd)}';`);
        } else if (serverInfo.flavor === 'mariadb' && serverInfo.major >= 10 && serverInfo.minor >= 2) {
          statements.push(`ALTER USER ${userHostTarget} IDENTIFIED BY '${this.escapeSqlString(pwd)}';`);
        } else {
          // MySQL 5.5/5.6 or MariaDB <= 10.1: SET PASSWORD
          statements.push(`SET PASSWORD FOR ${userHostTarget} = PASSWORD('${this.escapeSqlString(pwd)}');`);
        }
      }

      // Account lock / unlock
      if (serverInfo.supportsAccountLocking && plan.accountLocked !== undefined) {
        statements.push(`ALTER USER ${userHostTarget} ${plan.accountLocked ? 'ACCOUNT LOCK' : 'ACCOUNT UNLOCK'};`);
      }

      // Password expire policy
      if (serverInfo.supportsPasswordExpire && plan.passwordExpirePolicy) {
        if (plan.passwordExpirePolicy === 'NEVER') {
          statements.push(`ALTER USER ${userHostTarget} PASSWORD EXPIRE NEVER;`);
        } else if (plan.passwordExpirePolicy === 'IMMEDIATE') {
          statements.push(`ALTER USER ${userHostTarget} PASSWORD EXPIRE;`);
        } else if (plan.passwordExpirePolicy === 'INTERVAL' && plan.passwordExpireDays) {
          statements.push(`ALTER USER ${userHostTarget} PASSWORD EXPIRE INTERVAL ${plan.passwordExpireDays} DAY;`);
        } else if (plan.passwordExpirePolicy === 'DEFAULT') {
          statements.push(`ALTER USER ${userHostTarget} PASSWORD EXPIRE DEFAULT;`);
        }
      }

      // SSL / TLS requirement
      if (plan.sslType) {
        if (serverInfo.flavor === 'mysql' && (serverInfo.major >= 8 || (serverInfo.major === 5 && serverInfo.minor >= 7))) {
          if (plan.sslType === 'ANY') statements.push(`ALTER USER ${userHostTarget} REQUIRE SSL;`);
          else if (plan.sslType === 'X509') statements.push(`ALTER USER ${userHostTarget} REQUIRE X509;`);
          else if (plan.sslType === 'NONE') statements.push(`ALTER USER ${userHostTarget} REQUIRE NONE;`);
        } else {
          if (plan.sslType === 'ANY') statements.push(`GRANT USAGE ON *.* TO ${userHostTarget} REQUIRE SSL;`);
          else if (plan.sslType === 'X509') statements.push(`GRANT USAGE ON *.* TO ${userHostTarget} REQUIRE X509;`);
          else if (plan.sslType === 'NONE') statements.push(`GRANT USAGE ON *.* TO ${userHostTarget} REQUIRE NONE;`);
        }
      }

      // Resource limits
      const limits: string[] = [];
      if (plan.maxQueriesPerHour !== undefined) limits.push(`MAX_QUERIES_PER_HOUR ${plan.maxQueriesPerHour}`);
      if (plan.maxUpdatesPerHour !== undefined) limits.push(`MAX_UPDATES_PER_HOUR ${plan.maxUpdatesPerHour}`);
      if (plan.maxConnectionsPerHour !== undefined) limits.push(`MAX_CONNECTIONS_PER_HOUR ${plan.maxConnectionsPerHour}`);
      if (plan.maxUserConnections !== undefined) limits.push(`MAX_USER_CONNECTIONS ${plan.maxUserConnections}`);
      if (limits.length > 0) {
        if (serverInfo.flavor === 'mysql' && (serverInfo.major >= 8 || (serverInfo.major === 5 && serverInfo.minor >= 7))) {
          statements.push(`ALTER USER ${userHostTarget} WITH ${limits.join(' ')};`);
        } else {
          statements.push(`GRANT USAGE ON *.* TO ${userHostTarget} WITH ${limits.join(' ')};`);
        }
      }
    }

    // 2. Global Privileges
    // If user selected "ALL PRIVILEGES"
    const hasAllGlobal = plan.globalPrivileges.includes('ALL PRIVILEGES');
    const validGlobals = plan.globalPrivileges.filter(p => p !== 'ALL PRIVILEGES');

    if (hasAllGlobal) {
      statements.push(
        `GRANT ALL PRIVILEGES ON *.* TO ${userHostTarget}${plan.globalGrantOption ? ' WITH GRANT OPTION' : ''};`
      );
    } else if (validGlobals.length > 0) {
      // Split static vs dynamic privileges if MySQL 8.0+
      if (serverInfo.flavor === 'mysql' && serverInfo.supportsGlobalGrants) {
        // Standard SQL privileges vs dynamic global grants
        const standardList = validGlobals.filter(p => !this.isMySQLDynamicPrivilege(p));
        const dynamicList = validGlobals.filter(p => this.isMySQLDynamicPrivilege(p));

        if (standardList.length > 0) {
          statements.push(
            `GRANT ${standardList.join(', ')} ON *.* TO ${userHostTarget}${plan.globalGrantOption ? ' WITH GRANT OPTION' : ''};`
          );
        }
        if (dynamicList.length > 0) {
          statements.push(
            `GRANT ${dynamicList.join(', ')} ON *.* TO ${userHostTarget};`
          );
        }
      } else {
        statements.push(
          `GRANT ${validGlobals.join(', ')} ON *.* TO ${userHostTarget}${plan.globalGrantOption ? ' WITH GRANT OPTION' : ''};`
        );
      }
    }

    // 3. Database-level Privileges
    for (const dbGrant of plan.databasePrivileges) {
      const dbClean = dbGrant.database.replace(/[`'\\]/g, '');
      if (!dbClean || dbGrant.privileges.length === 0) continue;

      if (dbGrant.privileges.includes('ALL PRIVILEGES')) {
        statements.push(
          `GRANT ALL PRIVILEGES ON \`${dbClean}\`.* TO ${userHostTarget}${dbGrant.grantOption ? ' WITH GRANT OPTION' : ''};`
        );
      } else {
        const privsStr = dbGrant.privileges.join(', ');
        statements.push(
          `GRANT ${privsStr} ON \`${dbClean}\`.* TO ${userHostTarget}${dbGrant.grantOption ? ' WITH GRANT OPTION' : ''};`
        );
      }
    }

    // 4. Roles (MySQL 8 / MariaDB 10.0+)
    if (serverInfo.supportsRoles && plan.assignedRoles && plan.assignedRoles.length > 0) {
      const rolesFormatted = plan.assignedRoles.map(r => `'${r.replace(/['`\\]/g, '')}'`).join(', ');
      statements.push(`GRANT ${rolesFormatted} TO ${userHostTarget};`);

      if (serverInfo.flavor === 'mysql' && serverInfo.major >= 8) {
        statements.push(`SET DEFAULT ROLE ALL TO ${userHostTarget};`);
      }
    }

    // 5. Always flush privileges to ensure in-memory cache update
    statements.push('FLUSH PRIVILEGES;');

    return statements;
  }

  /**
   * Executes a plan of statements sequentially on the server.
   */
  public async executePlan(statements: string[]): Promise<UserPlanExecutionResult> {
    const start = Date.now();
    const executed: string[] = [];
    const errors: { statement: string; error: string }[] = [];

    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      for (const sql of statements) {
        const trimmed = sql.trim();
        if (!trimmed) continue;
        try {
          await conn.query(trimmed);
          executed.push(trimmed);
        } catch (err: any) {
          console.error(`Error executing user management SQL [${trimmed}]:`, err);
          errors.push({
            statement: trimmed,
            error: err.message || String(err)
          });
          // Do not completely abort on minor grant warnings, but collect errors
        }
      }

      return {
        success: errors.length === 0,
        statementsExecuted: executed.length,
        statements: executed,
        errors,
        durationMs: Date.now() - start
      };
    });
  }

  /**
   * Drops a user or role.
   */
  public async dropUser(user: string, host: string, isRole: boolean = false): Promise<void> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      const u = user.replace(/[`'\\]/g, '');
      const h = host.replace(/[`'\\]/g, '');

      if (isRole && (!h || h === '%')) {
        try {
          await conn.query(`DROP ROLE '${u}'`);
          await conn.query('FLUSH PRIVILEGES');
          return;
        } catch {}
      }

      await conn.query(`DROP USER '${u}'@'${h}'`);
      await conn.query('FLUSH PRIVILEGES');
    });
  }

  /**
   * Revokes all privileges from a user on a specific database.
   */
  public async revokeDatabasePrivileges(user: string, host: string, database: string): Promise<void> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      const u = user.replace(/[`'\\]/g, '');
      const h = host.replace(/[`'\\]/g, '');
      const db = database.replace(/[`'\\]/g, '');

      await conn.query(`REVOKE ALL PRIVILEGES ON \`${db}\`.* FROM '${u}'@'${h}'`);
      await conn.query('FLUSH PRIVILEGES');
    });
  }

  /**
   * Revokes all global privileges from a user.
   */
  public async revokeAllGlobalPrivileges(user: string, host: string): Promise<void> {
    return this.mariaService.executeWithAutoReconnect(async (conn) => {
      const u = user.replace(/[`'\\]/g, '');
      const h = host.replace(/[`'\\]/g, '');

      await conn.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${u}'@'${h}'`);
      await conn.query('FLUSH PRIVILEGES');
    });
  }

  private escapeSqlString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private isMySQLDynamicPrivilege(priv: string): boolean {
    const dynamicPrivs = new Set([
      'APPLICATION_PASSWORD_ADMIN',
      'AUDIT_ADMIN',
      'BACKUP_ADMIN',
      'BINLOG_ADMIN',
      'BINLOG_ENCRYPTION_ADMIN',
      'CLONE_ADMIN',
      'CONNECTION_ADMIN',
      'ENCRYPTION_KEY_ADMIN',
      'FIREWALL_ADMIN',
      'FIREWALL_USER',
      'FLUSH_OPTIMIZER_COSTS',
      'FLUSH_STATUS',
      'FLUSH_TABLES',
      'FLUSH_USER_RESOURCES',
      'GROUP_REPLICATION_ADMIN',
      'INNODB_REDO_LOG_ARCHIVE',
      'INNODB_REDO_LOG_ENABLE',
      'NDB_STORED_USER',
      'PASSWORDLESS_USER_ADMIN',
      'PERSIST_RO_VARIABLES_ADMIN',
      'REPLICATION_APPLIER',
      'REPLICATION_SLAVE_ADMIN',
      'RESOURCE_GROUP_ADMIN',
      'RESOURCE_GROUP_USER',
      'ROLE_ADMIN',
      'SERVICE_CONNECTION_ADMIN',
      'SESSION_VARIABLES_ADMIN',
      'SET_USER_ID',
      'SHOW_ROUTINE',
      'SYSTEM_USER',
      'SYSTEM_VARIABLES_ADMIN',
      'TABLE_ENCRYPTION_ADMIN',
      'TELEMETRY_LOG_ADMIN',
      'VERSION_TOKEN_ADMIN',
      'XA_RECOVER_ADMIN'
    ]);
    return dynamicPrivs.has(priv.toUpperCase());
  }
}
