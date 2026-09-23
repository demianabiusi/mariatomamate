import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useTranslation } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';
import {
  UserServerInfo,
  DbUserItem,
  DbUserDetails,
  DatabasePrivilege,
  UserSavePlan
} from '../../types';
import {
  Users,
  User,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Unlock,
  Clock,
  Database,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Dices,
  Sparkles,
  Code2,
  FileText,
  ChevronRight,
  Plus,
  X,
  ExternalLink,
  ShieldAlert,
  Search,
  Sliders,
  CheckSquare,
  Square,
  CopyPlus
} from 'lucide-react';

loader.config({ monaco });

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDatabases: string[];
  onOpenInSqlEditor: (sql: string, title?: string) => void;
}

type ActiveTabType = 'account' | 'global_privs' | 'db_privs' | 'roles' | 'sql_preview';

const COMMON_DML_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FILE'];
const COMMON_DDL_PRIVS = [
  'CREATE', 'ALTER', 'INDEX', 'DROP', 'CREATE TEMPORARY TABLES',
  'SHOW VIEW', 'CREATE VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE',
  'EXECUTE', 'EVENT', 'TRIGGER', 'CREATE TABLESPACE'
];
const COMMON_ADMIN_PRIVS = [
  'SUPER', 'RELOAD', 'SHUTDOWN', 'PROCESS', 'SHOW DATABASES',
  'LOCK TABLES', 'REFERENCES', 'REPLICATION CLIENT', 'REPLICATION SLAVE',
  'CREATE USER'
];

const MYSQL8_DYNAMIC_PRIVS = [
  'SYSTEM_VARIABLES_ADMIN', 'ROLE_ADMIN', 'APPLICATION_PASSWORD_ADMIN',
  'BACKUP_ADMIN', 'CLONE_ADMIN', 'CONNECTION_ADMIN', 'ENCRYPTION_KEY_ADMIN',
  'PERSIST_RO_VARIABLES_ADMIN', 'REPLICATION_APPLIER', 'TABLE_ENCRYPTION_ADMIN'
];

const MARIADB_EXTRA_PRIVS = [
  'BINLOG ADMIN', 'BINLOG REPLAY', 'CONNECTION ADMIN', 'FEDERATED ADMIN',
  'READ_ONLY ADMIN', 'REPLICATION MASTER ADMIN', 'REPLICATION SLAVE ADMIN', 'SET USER'
];

export const UserManagerModal: React.FC<UserManagerModalProps> = ({
  isOpen,
  onClose,
  availableDatabases = [],
  onOpenInSqlEditor
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Server metadata
  const [serverInfo, setServerInfo] = useState<UserServerInfo | null>(null);
  const [isLoadingServerInfo, setIsLoadingServerInfo] = useState(false);

  // User list
  const [users, setUsers] = useState<DbUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'users' | 'roles'>('all');

  // Currently selected user
  const [selectedUser, setSelectedUser] = useState<DbUserItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Active form tab
  const [activeTab, setActiveTab] = useState<ActiveTabType>('account');

  // Form State
  const [isNewUser, setIsNewUser] = useState(false);
  const [formIsRole, setFormIsRole] = useState(false);
  const [formUsername, setFormUsername] = useState('');
  const [formHost, setFormHost] = useState('%');
  const [originalUsername, setOriginalUsername] = useState('');
  const [originalHost, setOriginalHost] = useState('');

  // Password & Auth
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [noPassword, setNoPassword] = useState(false);
  const [formAuthPlugin, setFormAuthPlugin] = useState('');
  const [passwordGenLength, setPasswordGenLength] = useState(16);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Status & Limits
  const [formAccountLocked, setFormAccountLocked] = useState(false);
  const [formPasswordExpirePolicy, setFormPasswordExpirePolicy] = useState<'DEFAULT' | 'NEVER' | 'IMMEDIATE' | 'INTERVAL'>('DEFAULT');
  const [formPasswordExpireDays, setFormPasswordExpireDays] = useState<number>(90);
  const [formSslType, setFormSslType] = useState<'NONE' | 'ANY' | 'X509'>('NONE');
  const [formMaxQueries, setFormMaxQueries] = useState<number>(0);
  const [formMaxUpdates, setFormMaxUpdates] = useState<number>(0);
  const [formMaxConnections, setFormMaxConnections] = useState<number>(0);
  const [formMaxUserConnections, setFormMaxUserConnections] = useState<number>(0);

  // Privileges
  const [formGlobalPrivs, setFormGlobalPrivs] = useState<string[]>([]);
  const [formGlobalGrantOption, setFormGlobalGrantOption] = useState(false);
  const [formDbPrivs, setFormDbPrivs] = useState<DatabasePrivilege[]>([]);
  const [newDbSelect, setNewDbSelect] = useState('');

  // Roles
  const [formAssignedRoles, setFormAssignedRoles] = useState<string[]>([]);
  const [formDefaultRole, setFormDefaultRole] = useState<string>('');

  // Live SQL preview & submission
  const [generatedSql, setGeneratedSql] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Load server info and user list when opened
  const loadInitialData = useCallback(async () => {
    if (!window.electronAPI) return;
    setIsLoadingServerInfo(true);
    setIsLoadingUsers(true);
    try {
      const [infoRes, usersRes] = await Promise.all([
        window.electronAPI.getUserServerInfo(),
        window.electronAPI.listUsers()
      ]);

      if (infoRes.success && infoRes.data) {
        setServerInfo(infoRes.data);
      }
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
        if (usersRes.data.length > 0 && !selectedUser) {
          // Select current user or first user
          const current = usersRes.data.find(u => u.isCurrentUser) || usersRes.data[0];
          loadUserDetails(current);
        }
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Error cargando datos de usuarios' });
    } finally {
      setIsLoadingServerInfo(false);
      setIsLoadingUsers(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    } else {
      // Reset state
      setSaveStatus(null);
    }
  }, [isOpen]);

  // Load user details into form
  const loadUserDetails = async (u: DbUserItem) => {
    if (!window.electronAPI) return;
    setSelectedUser(u);
    setIsNewUser(false);
    setFormIsRole(u.isRole);
    setFormUsername(u.user);
    setFormHost(u.host);
    setOriginalUsername(u.user);
    setOriginalHost(u.host);
    setFormPassword('');
    setFormConfirmPassword('');
    setNoPassword(false);
    setSaveStatus(null);
    setIsLoadingDetails(true);

    try {
      const res = await window.electronAPI.getUserDetails(u.user, u.host);
      if (res.success && res.data) {
        const d: DbUserDetails = res.data;
        setFormAuthPlugin(d.plugin || serverInfo?.defaultAuthPlugin || 'mysql_native_password');
        setFormAccountLocked(d.accountLocked);
        setFormPasswordExpirePolicy(d.passwordExpirePolicy || 'DEFAULT');
        setFormPasswordExpireDays(d.passwordExpireDays || 90);
        setFormSslType(d.sslType === 'SPECIFIED' ? 'ANY' : (d.sslType as any) || 'NONE');
        setFormMaxQueries(d.maxQueriesPerHour || 0);
        setFormMaxUpdates(d.maxUpdatesPerHour || 0);
        setFormMaxConnections(d.maxConnectionsPerHour || 0);
        setFormMaxUserConnections(d.maxUserConnections || 0);
        setFormGlobalPrivs(d.globalPrivileges || []);
        setFormGlobalGrantOption(d.globalGrantOption || false);
        setFormDbPrivs(d.databasePrivileges || []);
        setFormAssignedRoles(d.assignedRoles || []);
        setFormDefaultRole(d.defaultRole || '');
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Error al obtener detalles del usuario' });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Start new user
  const handleStartNewUser = (asRole: boolean = false) => {
    setSelectedUser(null);
    setIsNewUser(true);
    setFormIsRole(asRole);
    setFormUsername(asRole ? 'nuevo_rol' : 'nuevo_usuario');
    setFormHost(asRole ? '%' : '%');
    setOriginalUsername('');
    setOriginalHost('');
    setFormPassword('');
    setFormConfirmPassword('');
    setNoPassword(false);
    setFormAuthPlugin(serverInfo?.defaultAuthPlugin || 'mysql_native_password');
    setFormAccountLocked(false);
    setFormPasswordExpirePolicy('DEFAULT');
    setFormPasswordExpireDays(90);
    setFormSslType('NONE');
    setFormMaxQueries(0);
    setFormMaxUpdates(0);
    setFormMaxConnections(0);
    setFormMaxUserConnections(0);
    setFormGlobalPrivs([]);
    setFormGlobalGrantOption(false);
    setFormDbPrivs([]);
    setFormAssignedRoles([]);
    setFormDefaultRole('');
    setActiveTab('account');
    setSaveStatus(null);
  };

  // Duplicate / Clone user
  const handleDuplicateUser = () => {
    if (!selectedUser) return;
    setIsNewUser(true);
    setOriginalUsername('');
    setOriginalHost('');
    setFormUsername(`${selectedUser.user}_copia`);
    setFormPassword('');
    setFormConfirmPassword('');
    setActiveTab('account');
    setSaveStatus({
      type: 'success',
      message: `Permisos clonados de ${selectedUser.user}@${selectedUser.host}. Introduce la nueva clave y guarda.`
    });
  };

  // Generate safe random password
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*+-_=';
    let pwd = '';
    const array = new Uint32Array(passwordGenLength);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < passwordGenLength; i++) {
      pwd += chars[array[i] % chars.length];
    }
    setFormPassword(pwd);
    setFormConfirmPassword(pwd);
    setNoPassword(false);
    setShowPassword(true);
  };

  const copyPasswordToClipboard = () => {
    if (!formPassword) return;
    navigator.clipboard.writeText(formPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userTypeFilter === 'users' && u.isRole) return false;
      if (userTypeFilter === 'roles' && !u.isRole) return false;
      if (!searchFilter.trim()) return true;
      const term = searchFilter.toLowerCase();
      return u.user.toLowerCase().includes(term) || u.host.toLowerCase().includes(term);
    });
  }, [users, userTypeFilter, searchFilter]);

  // Available server roles
  const availableRoles = useMemo(() => {
    return users.filter(u => u.isRole).map(u => u.user);
  }, [users]);

  // Build UserSavePlan object
  const currentPlan = useMemo((): UserSavePlan => {
    return {
      isNew: isNewUser,
      user: formUsername.trim(),
      host: formHost.trim() || '%',
      originalUser: originalUsername,
      originalHost: originalHost,
      isRole: formIsRole,
      password: noPassword ? '' : (formPassword ? formPassword : (isNewUser ? '' : undefined)),
      authPlugin: formAuthPlugin,
      accountLocked: formAccountLocked,
      passwordExpirePolicy: formPasswordExpirePolicy,
      passwordExpireDays: formPasswordExpireDays,
      maxQueriesPerHour: formMaxQueries,
      maxUpdatesPerHour: formMaxUpdates,
      maxConnectionsPerHour: formMaxConnections,
      maxUserConnections: formMaxUserConnections,
      sslType: formSslType,
      globalPrivileges: formGlobalPrivs,
      globalGrantOption: formGlobalGrantOption,
      databasePrivileges: formDbPrivs,
      assignedRoles: formAssignedRoles,
      defaultRole: formDefaultRole
    };
  }, [
    isNewUser, formUsername, formHost, originalUsername, originalHost, formIsRole,
    noPassword, formPassword, formAuthPlugin, formAccountLocked,
    formPasswordExpirePolicy, formPasswordExpireDays, formMaxQueries,
    formMaxUpdates, formMaxConnections, formMaxUserConnections, formSslType,
    formGlobalPrivs, formGlobalGrantOption, formDbPrivs, formAssignedRoles, formDefaultRole
  ]);

  // Update live SQL whenever form changes
  useEffect(() => {
    if (!isOpen || !serverInfo || !window.electronAPI) return;
    if (!formUsername.trim()) {
      setGeneratedSql(['-- Ingrese un nombre de usuario válido']);
      return;
    }

    window.electronAPI.generateUserSql(currentPlan).then(res => {
      if (res.success && res.data) {
        setGeneratedSql(res.data);
      }
    }).catch(err => {
      console.warn('Error generating preview SQL:', err);
    });
  }, [isOpen, currentPlan, serverInfo]);

  // Global Privileges Presets
  const applyGlobalPreset = (preset: 'dba' | 'read_write' | 'read_only' | 'app' | 'clear') => {
    if (preset === 'dba') {
      setFormGlobalPrivs(['ALL PRIVILEGES']);
      setFormGlobalGrantOption(true);
    } else if (preset === 'read_write') {
      setFormGlobalPrivs([
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
        'ALTER', 'INDEX', 'CREATE TEMPORARY TABLES', 'SHOW VIEW',
        'CREATE VIEW', 'EXECUTE', 'LOCK TABLES'
      ]);
      setFormGlobalGrantOption(false);
    } else if (preset === 'read_only') {
      setFormGlobalPrivs(['SELECT', 'SHOW VIEW', 'SHOW DATABASES']);
      setFormGlobalGrantOption(false);
    } else if (preset === 'app') {
      setFormGlobalPrivs(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'EXECUTE', 'LOCK TABLES', 'SHOW VIEW']);
      setFormGlobalGrantOption(false);
    } else if (preset === 'clear') {
      setFormGlobalPrivs([]);
      setFormGlobalGrantOption(false);
    }
  };

  // Toggle single global privilege
  const toggleGlobalPriv = (priv: string) => {
    setFormGlobalPrivs(prev => {
      if (prev.includes('ALL PRIVILEGES')) {
        // If ALL PRIVILEGES was set, expand all except this one
        return COMMON_DML_PRIVS.concat(COMMON_DDL_PRIVS, COMMON_ADMIN_PRIVS).filter(p => p !== priv);
      }
      if (prev.includes(priv)) {
        return prev.filter(p => p !== priv);
      } else {
        return [...prev, priv];
      }
    });
  };

  // Database-level privilege management
  const addDatabaseGrant = (dbName: string) => {
    if (!dbName || formDbPrivs.some(dp => dp.database.toLowerCase() === dbName.toLowerCase())) return;
    setFormDbPrivs(prev => [
      ...prev,
      {
        database: dbName,
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
        grantOption: false
      }
    ]);
    setNewDbSelect('');
  };

  const removeDatabaseGrant = (dbName: string) => {
    setFormDbPrivs(prev => prev.filter(dp => dp.database !== dbName));
  };

  const toggleDbPriv = (dbName: string, priv: string) => {
    setFormDbPrivs(prev => prev.map(dp => {
      if (dp.database !== dbName) return dp;
      const hasPriv = dp.privileges.includes(priv);
      const newPrivs = hasPriv 
        ? dp.privileges.filter(p => p !== priv)
        : [...dp.privileges, priv];
      return { ...dp, privileges: newPrivs };
    }));
  };

  const setDbAllPrivs = (dbName: string, all: boolean) => {
    setFormDbPrivs(prev => prev.map(dp => {
      if (dp.database !== dbName) return dp;
      return {
        ...dp,
        privileges: all ? ['ALL PRIVILEGES'] : []
      };
    }));
  };

  // Role toggle
  const toggleAssignedRole = (role: string) => {
    setFormAssignedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  // Save / Apply User Plan
  const handleSave = async () => {
    if (!window.electronAPI) return;
    if (!formUsername.trim()) {
      setSaveStatus({ type: 'error', message: 'Debe especificar un nombre de usuario o rol.' });
      return;
    }
    if (formPassword && formPassword !== formConfirmPassword && !noPassword) {
      setSaveStatus({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // 1. Generate statements
      const genRes = await window.electronAPI.generateUserSql(currentPlan);
      if (!genRes.success || !genRes.data) {
        throw new Error(genRes.error || 'Error al generar sentencias');
      }

      // 2. Execute statements
      const execRes = await window.electronAPI.executeUserPlan(genRes.data);
      if (!execRes.success && execRes.error) {
        throw new Error(execRes.error);
      }

      setSaveStatus({
        type: 'success',
        message: `¡Usuario '${formUsername}'@'${formHost}' guardado correctamente! (${execRes.data?.statementsExecuted || genRes.data.length} sentencias ejecutadas)`
      });

      // Reload user list and keep new user selected
      const refreshedUsers = await window.electronAPI.listUsers();
      if (refreshedUsers.success && refreshedUsers.data) {
        setUsers(refreshedUsers.data);
        const saved = refreshedUsers.data.find(
          u => u.user === formUsername && (formIsRole || u.host === formHost)
        );
        if (saved) {
          setSelectedUser(saved);
          setIsNewUser(false);
          setOriginalUsername(saved.user);
          setOriginalHost(saved.host);
        }
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Error al aplicar cambios de usuario'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Drop User
  const handleDropUser = async () => {
    if (!selectedUser || !window.electronAPI) return;
    const confirmDrop = window.confirm(
      `¿Está seguro de que desea eliminar permanentemente al ${selectedUser.isRole ? 'rol' : 'usuario'} '${selectedUser.user}'@'${selectedUser.host}'? Esta acción no se puede deshacer.`
    );
    if (!confirmDrop) return;

    setIsSaving(true);
    try {
      const res = await window.electronAPI.dropUser(selectedUser.user, selectedUser.host, selectedUser.isRole);
      if (!res.success) throw new Error(res.error || 'Error al eliminar usuario');

      setSaveStatus({
        type: 'success',
        message: `El usuario '${selectedUser.user}'@'${selectedUser.host}' fue eliminado.`
      });

      // Reload user list
      const refreshed = await window.electronAPI.listUsers();
      if (refreshed.success && refreshed.data) {
        setUsers(refreshed.data);
        if (refreshed.data.length > 0) {
          loadUserDetails(refreshed.data[0]);
        } else {
          handleStartNewUser();
        }
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Error al eliminar usuario' });
    } finally {
      setIsSaving(false);
    }
  };

  const copySqlToClipboard = () => {
    const text = generatedSql.join('\n');
    navigator.clipboard.writeText(text);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-6xl h-[92vh] max-h-[850px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">
                  {t('users.title') || 'Administrador de Usuarios y Permisos'}
                </h2>
                {serverInfo && (
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border flex items-center gap-1.5 ${
                    serverInfo.flavor === 'mariadb'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  }`}>
                    <span>{serverInfo.flavor === 'mariadb' ? '🦭 MariaDB' : '🐬 MySQL'}</span>
                    <span className="font-bold">v{serverInfo.version}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {t('users.subtitle') || 'Crea y administra usuarios, contraseñas, roles y privilegios adaptados a tu versión de base de datos.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Server capabilities bar */}
        {serverInfo && (
          <div className="px-5 py-1.5 bg-zinc-900/30 border-b border-zinc-800/60 flex items-center gap-4 text-[11px] text-zinc-400 overflow-x-auto shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Roles: <strong>{serverInfo.supportsRoles ? 'Soportados' : 'No soportados'}</strong></span>
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Account Locking: <strong>{serverInfo.supportsAccountLocking ? 'Soportado' : 'No'}</strong></span>
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Password Expiration: <strong>{serverInfo.supportsPasswordExpire ? 'Soportado' : 'No'}</strong></span>
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Plugin por defecto: <code className="text-zinc-200">{serverInfo.defaultAuthPlugin}</code></span>
            </span>
            {serverInfo.isMariaDb104Plus && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-amber-400/90 font-mono text-[10px]" title="En MariaDB 10.4+, mysql.user es una vista sobre mysql.global_priv">
                  MariaDB 10.4+ (global_priv)
                </span>
              </>
            )}
          </div>
        )}

        {/* Status Toast / Alert */}
        {saveStatus && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 ${
            saveStatus.type === 'success' 
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
              : 'bg-red-950/40 border-red-500/30 text-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{saveStatus.message}</span>
            </div>
            <button 
              onClick={() => setSaveStatus(null)}
              className="text-zinc-400 hover:text-zinc-200 text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body: Split view (User List left, Details/Tabs right) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Users & Roles List */}
          <div className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0">
            {/* Filter & Actions Bar */}
            <div className="p-3 border-b border-zinc-800/80 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar usuario o host..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Type Pills */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUserTypeFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    userTypeFilter === 'all'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Todos ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserTypeFilter('users')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    userTypeFilter === 'users'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Usuarios ({users.filter(u => !u.isRole).length})
                </button>
                {serverInfo?.supportsRoles && (
                  <button
                    type="button"
                    onClick={() => setUserTypeFilter('roles')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      userTypeFilter === 'roles'
                        ? 'bg-zinc-800 text-zinc-100 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Roles ({users.filter(u => u.isRole).length})
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartNewUser(false)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Usuario</span>
                </button>

                {serverInfo?.supportsRoles && (
                  <button
                    type="button"
                    onClick={() => handleStartNewUser(true)}
                    className="flex items-center justify-center p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs transition-colors"
                    title="Nuevo Rol"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadInitialData}
                  disabled={isLoadingUsers}
                  className="flex items-center justify-center p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs transition-colors disabled:opacity-50"
                  title="Refrescar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {isLoadingUsers ? (
                <div className="p-4 text-center text-xs text-zinc-500">Cargando cuentas...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">No se encontraron usuarios</div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUser?.user === u.user && selectedUser?.host === u.host && !isNewUser;
                  return (
                    <div
                      key={`${u.user}@${u.host}`}
                      onClick={() => loadUserDetails(u)}
                      className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-emerald-500/10 border-l-2 border-emerald-500 text-zinc-100'
                          : 'hover:bg-zinc-900/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                          u.isRole
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : u.isCurrentUser
                            ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {u.isRole ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium truncate">
                            <span className="truncate">{u.user}</span>
                            {u.isCurrentUser && (
                              <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                            <span>@{u.host || '%'}</span>
                            {u.accountLocked && <span title="Cuenta bloqueada">🔒</span>}
                            {u.passwordExpired && <span title="Contraseña expirada">⚠️</span>}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Tabs & Form Content */}
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
            
            {/* User Title & Tab Switcher */}
            <div className="px-6 pt-4 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    formIsRole ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {formIsRole ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      {isNewUser ? (
                        <span>{formIsRole ? 'Crear Nuevo Rol' : 'Crear Nuevo Usuario'}</span>
                      ) : (
                        <>
                          <span>'{formUsername}'@'{formHost}'</span>
                          {formAccountLocked && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-medium rounded border border-red-500/30">
                              Bloqueado
                            </span>
                          )}
                        </>
                      )}
                    </h3>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                      <span>{formIsRole ? 'Rol de Base de Datos' : 'Cuenta de Usuario'}</span>
                      {!isNewUser && (
                        <>
                          <span>•</span>
                          <span>Plugin: <code className="text-zinc-300">{formAuthPlugin || 'default'}</code></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions for selected user */}
                {!isNewUser && selectedUser && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDuplicateUser}
                      className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-lg border border-zinc-800 transition-colors"
                      title="Clonar este usuario y sus privilegios"
                    >
                      <CopyPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Duplicar / Clonar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDropUser}
                      disabled={isSaving || selectedUser.isCurrentUser}
                      className="flex items-center gap-1 px-2.5 py-1 bg-red-950/30 hover:bg-red-900/50 text-red-300 text-xs rounded-lg border border-red-500/30 transition-colors disabled:opacity-40"
                      title={selectedUser.isCurrentUser ? 'No puedes eliminar la cuenta actualmente en uso' : 'Eliminar usuario'}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tabs Navigation */}
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 font-medium transition-colors ${
                    activeTab === 'account'
                      ? 'border-emerald-400 text-emerald-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Cuenta y Clave</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('global_privs')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 font-medium transition-colors ${
                    activeTab === 'global_privs'
                      ? 'border-emerald-400 text-emerald-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Permisos Globales</span>
                  {formGlobalPrivs.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
                      {formGlobalPrivs.includes('ALL PRIVILEGES') ? 'ALL' : formGlobalPrivs.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('db_privs')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 font-medium transition-colors ${
                    activeTab === 'db_privs'
                      ? 'border-emerald-400 text-emerald-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Permisos por BD</span>
                  {formDbPrivs.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
                      {formDbPrivs.length}
                    </span>
                  )}
                </button>

                {serverInfo?.supportsRoles && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 font-medium transition-colors ${
                      activeTab === 'roles'
                        ? 'border-emerald-400 text-emerald-300'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Roles</span>
                    {formAssignedRoles.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-full">
                        {formAssignedRoles.length}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('sql_preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 font-medium transition-colors ${
                    activeTab === 'sql_preview'
                      ? 'border-emerald-400 text-emerald-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ver SQL ({generatedSql.length})</span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* TAB 1: Cuenta y Clave */}
              {activeTab === 'account' && (
                <div className="max-w-3xl space-y-6">
                  
                  {/* Basic Identification */}
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-400" />
                      Identificación de Cuenta
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Nombre de Usuario / Rol <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={formUsername}
                          onChange={(e) => setFormUsername(e.target.value)}
                          placeholder="e.g. app_user"
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {!formIsRole && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1">
                            Host Permitido
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={formHost}
                              onChange={(e) => setFormHost(e.target.value)}
                              placeholder="%"
                              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                            />
                            {/* Quick Host suggestions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setFormHost('%')}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 font-mono"
                                title="Cualquier host (%)"
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormHost('localhost')}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 font-mono"
                                title="Solo local (localhost)"
                              >
                                localhost
                              </button>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500">
                            Usa <code>%</code> para permitir acceso desde cualquier IP o máquina externa.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Auth plugin selector */}
                    {!formIsRole && (
                      <div className="pt-2 border-t border-zinc-800/80">
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Plugin de Autenticación
                        </label>
                        <select
                          value={formAuthPlugin}
                          onChange={(e) => setFormAuthPlugin(e.target.value)}
                          className="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                        >
                          {serverInfo?.availablePlugins.map(p => (
                            <option key={p} value={p}>
                              {p} {p === serverInfo.defaultAuthPlugin ? '(Recomendado para tu servidor)' : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          MySQL 8+ utiliza <code>caching_sha2_password</code> de forma predeterminada, mientras que MariaDB y MySQL 5.7 utilizan <code>mysql_native_password</code>.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Password & Security */}
                  {!formIsRole && (
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                          <Key className="w-4 h-4 text-emerald-400" />
                          Contraseña y Clave
                        </h4>
                        
                        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noPassword}
                            onChange={(e) => {
                              setNoPassword(e.target.checked);
                              if (e.target.checked) {
                                setFormPassword('');
                                setFormConfirmPassword('');
                              }
                            }}
                            className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                          />
                          <span>Sin contraseña (cuenta abierta)</span>
                        </label>
                      </div>

                      {!noPassword && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-zinc-300 mb-1">
                                {isNewUser ? 'Nueva Contraseña' : 'Cambiar Contraseña (dejar vacío para no modificar)'}
                              </label>
                              <div className="relative">
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  value={formPassword}
                                  onChange={(e) => setFormPassword(e.target.value)}
                                  placeholder="••••••••••••"
                                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg pl-3 pr-10 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-200"
                                >
                                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-300 mb-1">
                                Confirmar Contraseña
                              </label>
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={formConfirmPassword}
                                onChange={(e) => setFormConfirmPassword(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          {/* Generator and copy tools */}
                          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={generateRandomPassword}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors"
                              >
                                <Dices className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Generar clave aleatoria</span>
                              </button>

                              <select
                                value={passwordGenLength}
                                onChange={(e) => setPasswordGenLength(Number(e.target.value))}
                                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400"
                              >
                                <option value={12}>12 caracteres</option>
                                <option value={16}>16 caracteres</option>
                                <option value={24}>24 caracteres</option>
                                <option value={32}>32 caracteres</option>
                              </select>
                            </div>

                            {formPassword && (
                              <button
                                type="button"
                                onClick={copyPasswordToClipboard}
                                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                {passwordCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{passwordCopied ? '¡Clave copiada!' : 'Copiar clave'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Account Status & Policies (Version Aware) */}
                  {!formIsRole && (
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        Estado y Políticas de Acceso
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Lock account */}
                        <div className={`p-3 rounded-lg border ${
                          formAccountLocked ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900 border-zinc-800'
                        }`}>
                          <label className="flex items-center justify-between cursor-pointer">
                            <div className="space-y-0.5">
                              <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                Bloquear Cuenta (ACCOUNT LOCK)
                              </span>
                              <p className="text-[10px] text-zinc-500">
                                {serverInfo?.supportsAccountLocking 
                                  ? 'Impide que el usuario inicie sesión sin eliminar sus permisos.'
                                  : 'Requiere MySQL 5.7+ o MariaDB 10.4+.'}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={formAccountLocked}
                              disabled={!serverInfo?.supportsAccountLocking}
                              onChange={(e) => setFormAccountLocked(e.target.checked)}
                              className="rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-0 w-4 h-4"
                            />
                          </label>
                        </div>

                        {/* Password expire */}
                        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                          <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            Expiración de Clave
                          </span>
                          <select
                            value={formPasswordExpirePolicy}
                            disabled={!serverInfo?.supportsPasswordExpire}
                            onChange={(e) => setFormPasswordExpirePolicy(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                          >
                            <option value="DEFAULT">Predeterminado del servidor</option>
                            <option value="NEVER">Nunca expirar (PASSWORD EXPIRE NEVER)</option>
                            <option value="IMMEDIATE">Expirar inmediatamente (debe cambiarla)</option>
                            <option value="INTERVAL">Expirar cada N días</option>
                          </select>

                          {formPasswordExpirePolicy === 'INTERVAL' && (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={formPasswordExpireDays}
                                onChange={(e) => setFormPasswordExpireDays(Math.max(1, Number(e.target.value)))}
                                className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                              />
                              <span className="text-xs text-zinc-400">días</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* SSL / TLS Option */}
                      <div className="pt-2 border-t border-zinc-800/60">
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Requisito de Conexión Segura (SSL / TLS)
                        </label>
                        <select
                          value={formSslType}
                          onChange={(e) => setFormSslType(e.target.value as any)}
                          className="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                        >
                          <option value="NONE">Sin requisito obligatorio (REQUIRE NONE)</option>
                          <option value="ANY">Obligatorio cifrado SSL / TLS (REQUIRE SSL)</option>
                          <option value="X509">Obligatorio certificado cliente válido (REQUIRE X509)</option>
                        </select>
                      </div>

                      {/* Resource limits */}
                      <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                        <span className="text-xs font-medium text-zinc-300 block">
                          Límites de Recursos (0 = ilimitado)
                        </span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">Consultas/Hora</label>
                            <input
                              type="number"
                              min={0}
                              value={formMaxQueries}
                              onChange={(e) => setFormMaxQueries(Number(e.target.value))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">Updates/Hora</label>
                            <input
                              type="number"
                              min={0}
                              value={formMaxUpdates}
                              onChange={(e) => setFormMaxUpdates(Number(e.target.value))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">Conexiones/Hora</label>
                            <input
                              type="number"
                              min={0}
                              value={formMaxConnections}
                              onChange={(e) => setFormMaxConnections(Number(e.target.value))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">Conexiones Simultáneas</label>
                            <input
                              type="number"
                              min={0}
                              value={formMaxUserConnections}
                              onChange={(e) => setFormMaxUserConnections(Number(e.target.value))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 2: Permisos Globales */}
              {activeTab === 'global_privs' && (
                <div className="space-y-6">
                  
                  {/* Presets Bar */}
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-zinc-400 mr-1">Plantillas rápidas:</span>
                      <button
                        type="button"
                        onClick={() => applyGlobalPreset('dba')}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs transition-colors flex items-center gap-1 font-medium"
                      >
                        <span>👑 DBA / Administrador</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGlobalPreset('read_write')}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-xs transition-colors flex items-center gap-1 font-medium"
                      >
                        <span>📝 Lectura y Escritura</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGlobalPreset('read_only')}
                        className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-xs transition-colors flex items-center gap-1 font-medium"
                      >
                        <span>👁️ Solo Lectura</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGlobalPreset('app')}
                        className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-xs transition-colors flex items-center gap-1 font-medium"
                      >
                        <span>⚙️ Aplicación / Backend</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGlobalPreset('clear')}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                      >
                        Limpiar todos
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold text-amber-300 cursor-pointer bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                      <input
                        type="checkbox"
                        checked={formGlobalGrantOption}
                        onChange={(e) => setFormGlobalGrantOption(e.target.checked)}
                        className="rounded border-amber-500 text-amber-500 focus:ring-0"
                      />
                      <span>WITH GRANT OPTION (Conceder permisos a otros)</span>
                    </label>
                  </div>

                  {/* ALL PRIVILEGES option */}
                  <div className={`p-4 rounded-xl border transition-colors ${
                    formGlobalPrivs.includes('ALL PRIVILEGES')
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                  }`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formGlobalPrivs.includes('ALL PRIVILEGES')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormGlobalPrivs(['ALL PRIVILEGES']);
                          } else {
                            setFormGlobalPrivs([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-amber-500 text-amber-500 focus:ring-0"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block">
                          ALL PRIVILEGES ON *.* (Control Total Global)
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          Otorga absolutamente todos los privilegios estándar a nivel de servidor.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Categorized Checkbox Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* DML: Manipulación de Datos */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                          Datos (DML)
                        </h5>
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = COMMON_DML_PRIVS.every(p => formGlobalPrivs.includes(p));
                            if (allSelected) {
                              setFormGlobalPrivs(prev => prev.filter(p => !COMMON_DML_PRIVS.includes(p)));
                            } else {
                              setFormGlobalPrivs(prev => Array.from(new Set([...prev.filter(p => p !== 'ALL PRIVILEGES'), ...COMMON_DML_PRIVS])));
                            }
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200"
                        >
                          Marcar / Desmarcar
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {COMMON_DML_PRIVS.map(priv => {
                          const checked = formGlobalPrivs.includes('ALL PRIVILEGES') || formGlobalPrivs.includes(priv);
                          return (
                            <label key={priv} className="flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={formGlobalPrivs.includes('ALL PRIVILEGES')}
                                onChange={() => toggleGlobalPriv(priv)}
                                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                              />
                              <span className="font-mono text-[11px]">{priv}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* DDL: Estructura */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                          Estructura (DDL)
                        </h5>
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = COMMON_DDL_PRIVS.every(p => formGlobalPrivs.includes(p));
                            if (allSelected) {
                              setFormGlobalPrivs(prev => prev.filter(p => !COMMON_DDL_PRIVS.includes(p)));
                            } else {
                              setFormGlobalPrivs(prev => Array.from(new Set([...prev.filter(p => p !== 'ALL PRIVILEGES'), ...COMMON_DDL_PRIVS])));
                            }
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200"
                        >
                          Marcar / Desmarcar
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {COMMON_DDL_PRIVS.map(priv => {
                          const checked = formGlobalPrivs.includes('ALL PRIVILEGES') || formGlobalPrivs.includes(priv);
                          return (
                            <label key={priv} className="flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={formGlobalPrivs.includes('ALL PRIVILEGES')}
                                onChange={() => toggleGlobalPriv(priv)}
                                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                              />
                              <span className="font-mono text-[11px]">{priv}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Administración */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                          Administración
                        </h5>
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = COMMON_ADMIN_PRIVS.every(p => formGlobalPrivs.includes(p));
                            if (allSelected) {
                              setFormGlobalPrivs(prev => prev.filter(p => !COMMON_ADMIN_PRIVS.includes(p)));
                            } else {
                              setFormGlobalPrivs(prev => Array.from(new Set([...prev.filter(p => p !== 'ALL PRIVILEGES'), ...COMMON_ADMIN_PRIVS])));
                            }
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200"
                        >
                          Marcar / Desmarcar
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {COMMON_ADMIN_PRIVS.map(priv => {
                          const checked = formGlobalPrivs.includes('ALL PRIVILEGES') || formGlobalPrivs.includes(priv);
                          return (
                            <label key={priv} className="flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={formGlobalPrivs.includes('ALL PRIVILEGES')}
                                onChange={() => toggleGlobalPriv(priv)}
                                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                              />
                              <span className="font-mono text-[11px]">{priv}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* MySQL 8 Dynamic Privileges section */}
                  {serverInfo?.supportsGlobalGrants && (
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Privilegios Dinámicos (MySQL 8.0+)
                          </h5>
                          <p className="text-[11px] text-zinc-400">
                            Introducidos en MySQL 8 para granularidad administrativa en lugar de otorgar SUPER.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {MYSQL8_DYNAMIC_PRIVS.map(priv => {
                          const checked = formGlobalPrivs.includes(priv);
                          return (
                            <label key={priv} className="flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGlobalPriv(priv)}
                                className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0"
                              />
                              <span className="font-mono text-[10px] truncate" title={priv}>{priv}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* MariaDB Specific Privileges section */}
                  {serverInfo?.flavor === 'mariadb' && serverInfo.major >= 10 && (
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                      <div>
                        <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Privilegios Específicos de MariaDB 10+
                        </h5>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                        {MARIADB_EXTRA_PRIVS.map(priv => {
                          const checked = formGlobalPrivs.includes(priv);
                          return (
                            <label key={priv} className="flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGlobalPriv(priv)}
                                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                              />
                              <span className="font-mono text-[10px] truncate" title={priv}>{priv}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: Permisos por Base de Datos */}
              {activeTab === 'db_privs' && (
                <div className="space-y-6">
                  
                  {/* Add DB Grant Header */}
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-400" />
                        Privilegios Específicos por Base de Datos
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Asigna permisos restringidos a bases de datos individuales (e.g. <code>`mi_bd`.*</code>).
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={newDbSelect}
                        onChange={(e) => setNewDbSelect(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 min-w-[200px]"
                      >
                        <option value="">Seleccionar base de datos...</option>
                        {availableDatabases
                          .filter(db => !formDbPrivs.some(dp => dp.database.toLowerCase() === db.toLowerCase()))
                          .map(db => (
                            <option key={db} value={db}>{db}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addDatabaseGrant(newDbSelect)}
                        disabled={!newDbSelect}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar BD</span>
                      </button>
                    </div>
                  </div>

                  {/* List of configured DB grants */}
                  {formDbPrivs.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                      <Database className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400">
                        No hay permisos asignados por base de datos específica.
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Selecciona una base de datos arriba para otorgarle acceso exclusivo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formDbPrivs.map((dbGrant) => {
                        const isAll = dbGrant.privileges.includes('ALL PRIVILEGES');
                        const standardDbPrivs = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'EXECUTE', 'CREATE VIEW', 'SHOW VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 'EVENT', 'TRIGGER'];

                        return (
                          <div 
                            key={dbGrant.database}
                            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                              <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-zinc-100 font-mono">
                                  `{dbGrant.database}`.*
                                </span>
                                {isAll && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                                    ALL PRIVILEGES
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDbAllPrivs(dbGrant.database, !isAll)}
                                  className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-zinc-800/80 rounded"
                                >
                                  {isAll ? 'Desmarcar Todos' : 'Marcar Todos'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeDatabaseGrant(dbGrant.database)}
                                  className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 bg-red-950/30 hover:bg-red-900/40 rounded transition-colors flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Quitar Regla</span>
                                </button>
                              </div>
                            </div>

                            {/* Privileges checkboxes */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                              {standardDbPrivs.map(priv => {
                                const checked = isAll || dbGrant.privileges.includes(priv);
                                return (
                                  <label key={priv} className="flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={isAll}
                                      onChange={() => toggleDbPriv(dbGrant.database, priv)}
                                      className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                                    />
                                    <span className="font-mono text-[11px]">{priv}</span>
                                  </label>
                                );
                              })}
                            </div>

                            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs text-amber-300/90 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={dbGrant.grantOption}
                                  onChange={(e) => {
                                    setFormDbPrivs(prev => prev.map(dp => 
                                      dp.database === dbGrant.database ? { ...dp, grantOption: e.target.checked } : dp
                                    ));
                                  }}
                                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                                />
                                <span>WITH GRANT OPTION en esta base de datos</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {/* TAB 4: Roles */}
              {activeTab === 'roles' && (
                <div className="max-w-2xl space-y-6">
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      Asignación de Roles
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Asigna o revoca roles de base de datos definidos en el servidor a este usuario.
                    </p>

                    {availableRoles.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500">
                        No hay roles creados en el servidor. Puedes crear uno usando "+ Nuevo Rol" en la barra lateral.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableRoles.map(role => {
                          const isAssigned = formAssignedRoles.includes(role);
                          return (
                            <label
                              key={role}
                              className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                                isAssigned 
                                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' 
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Shield className={`w-4 h-4 ${isAssigned ? 'text-indigo-400' : 'text-zinc-500'}`} />
                                <span className="font-mono text-xs font-bold">{role}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => toggleAssignedRole(role)}
                                className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0 w-4 h-4"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Live SQL Preview */}
              {activeTab === 'sql_preview' && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-emerald-400" />
                        Sentencias SQL que se ejecutarán
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Generadas automáticamente según la sintaxis compatible con tu versión ({serverInfo?.flavor === 'mariadb' ? 'MariaDB' : 'MySQL'} {serverInfo?.version}).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={copySqlToClipboard}
                        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors border border-zinc-700"
                      >
                        {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{sqlCopied ? '¡Copiado!' : 'Copiar SQL'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const script = generatedSql.join('\n');
                          onOpenInSqlEditor(script, `Usuario ${formUsername}`);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 text-xs rounded-lg transition-colors border border-emerald-500/30"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir en Pestaña SQL</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[350px] border border-zinc-800 rounded-xl overflow-hidden bg-[#1e1e1e]">
                    <Editor
                      height="100%"
                      defaultLanguage="sql"
                      theme={theme === 'light' ? 'vs' : 'vs-dark'}
                      value={generatedSql.join('\n')}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true
                      }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Footer Actions */}
            <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-zinc-500">
                {serverInfo && (
                  <span>
                    Servidor activo: <strong>{serverInfo.flavor === 'mariadb' ? 'MariaDB' : 'MySQL'} {serverInfo.version}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-800 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !formUsername.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-500/20 transition-all"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isNewUser ? 'Crear Usuario' : 'Guardar y Aplicar Cambios'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
