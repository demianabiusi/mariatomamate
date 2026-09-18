import React, { useState, useEffect } from 'react';
import { ConnectionConfig, SshTunnelConfig } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Database, 
  Server, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Save, 
  Zap, 
  X,
  Lock,
  User,
  Shield,
  Eye,
  EyeOff,
  Terminal,
  FolderOpen,
  Key,
  Copy
} from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
  savedConnections: ConnectionConfig[];
  onRefreshConnections: () => void;
  activeConfigId?: string;
}

const DEFAULT_SSH_CONFIG: SshTunnelConfig = {
  enabled: false,
  host: '',
  port: 22,
  user: 'root',
  authType: 'password',
  password: '',
  keyPath: '',
  passphrase: ''
};

const DEFAULT_CONFIG: ConnectionConfig = {
  id: '',
  name: 'Nueva Conexión MariaDB / MySQL',
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: '',
  charset: 'utf8mb4',
  ssl: false,
  ssh: { ...DEFAULT_SSH_CONFIG }
};

const COMMON_CHARSETS = [
  'utf8mb4',
  'utf8',
  'latin1',
  'ascii',
  'binary',
  'cp1251',
  'cp1252',
  'greek',
  'hebrew',
  'sjis',
  'tis620',
  'ujis'
];

const getClonedName = (baseName: string, existingList: ConnectionConfig[], suffix: string): string => {
  const cleanSuffix = suffix.trim() || 'Copia';
  const escapedSuffix = cleanSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\s*\\(${escapedSuffix}(?:\\s+(\\d+))?\\)$`, 'i');
  const cleanBase = (baseName || '').replace(regex, '').trim() || 'Conexión';

  const candidate = `${cleanBase} (${cleanSuffix})`;
  if (!existingList.some(c => c.name.toLowerCase() === candidate.toLowerCase())) {
    return candidate;
  }
  let counter = 2;
  while (existingList.some(c => c.name.toLowerCase() === `${cleanBase} (${cleanSuffix} ${counter})`.toLowerCase())) {
    counter++;
  }
  return `${cleanBase} (${cleanSuffix} ${counter})`;
};

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  savedConnections,
  onRefreshConnections,
  activeConfigId
}) => {
  const { t } = useTranslation();
  const [selectedConfig, setSelectedConfig] = useState<ConnectionConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'general' | 'ssh'>('general');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; pingMs?: number; serverVersion?: string } | null>(null);
  const [isTestingSsh, setIsTestingSsh] = useState(false);
  const [sshTestResult, setSshTestResult] = useState<{ success: boolean; message: string; pingMs?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [showSshPassphrase, setShowSshPassphrase] = useState(false);
  const [autoConnectOnStartup, setAutoConnectOnStartup] = useState(true);

  const lastSelectedIdRef = React.useRef<string | null>(null);
  const wasOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && window.electronAPI?.getAppSettings) {
      window.electronAPI.getAppSettings().then((settings) => {
        if (settings && typeof settings.autoConnectOnStartup === 'boolean') {
          setAutoConnectOnStartup(settings.autoConnectOnStartup);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setTestResult(null);
      setSshTestResult(null);
      setActiveTab('general');
      if (savedConnections.length > 0) {
        const preferredId = activeConfigId ?? lastSelectedIdRef.current;
        const found = savedConnections.find(c => c.id === preferredId) ?? savedConnections[0];
        lastSelectedIdRef.current = found.id;
        setSelectedConfig({
          ...found,
          ssh: found.ssh ? { ...DEFAULT_SSH_CONFIG, ...found.ssh } : { ...DEFAULT_SSH_CONFIG }
        });
      } else {
        const blank = { ...DEFAULT_CONFIG, id: 'conn_' + Date.now() };
        lastSelectedIdRef.current = blank.id;
        setSelectedConfig(blank);
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, activeConfigId, savedConnections]);

  if (!isOpen) return null;

  const handleSelectExisting = (conn: ConnectionConfig) => {
    lastSelectedIdRef.current = conn.id;
    setSelectedConfig({
      ...conn,
      ssh: conn.ssh ? { ...DEFAULT_SSH_CONFIG, ...conn.ssh } : { ...DEFAULT_SSH_CONFIG }
    });
    setTestResult(null);
    setSshTestResult(null);
  };

  const handleAddNew = () => {
    const newConn: ConnectionConfig = {
      ...DEFAULT_CONFIG,
      id: 'conn_' + Date.now(),
      name: `Conexión ${savedConnections.length + 1}`,
      ssh: { ...DEFAULT_SSH_CONFIG }
    };
    setSelectedConfig(newConn);
    setTestResult(null);
    setSshTestResult(null);
    setActiveTab('general');
  };

  const handleClone = async (connToClone: ConnectionConfig, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cloneSuffix = t('connectionModal.cloneSuffix') || 'Copia';
    const newName = getClonedName(connToClone.name, savedConnections, cloneSuffix);
    const newId = 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const clonedConn: ConnectionConfig = {
      ...connToClone,
      id: newId,
      name: newName,
      createdAt: new Date().toISOString(),
      ssh: connToClone.ssh ? { ...connToClone.ssh } : { ...DEFAULT_SSH_CONFIG }
    };

    setIsSaving(true);
    try {
      if (window.electronAPI?.saveConnection) {
        await window.electronAPI.saveConnection(clonedConn);
        onRefreshConnections();
      }
      setSelectedConfig(clonedConn);
      lastSelectedIdRef.current = newId;
      setTestResult(null);
      setSshTestResult(null);
      setActiveTab('general');
    } catch (err: any) {
      alert(`Error al clonar la conexión: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseSshKey = async () => {
    try {
      if (window.electronAPI?.selectSshKeyFile) {
        const filePath = await window.electronAPI.selectSshKeyFile();
        if (filePath) {
          setSelectedConfig(prev => ({
            ...prev,
            ssh: {
              ...(prev.ssh || DEFAULT_SSH_CONFIG),
              keyPath: filePath
            }
          }));
        }
      }
    } catch (err: any) {
      alert(`Error al seleccionar archivo: ${err.message}`);
    }
  };

  const handleTestSsh = async () => {
    if (!selectedConfig.ssh || !selectedConfig.ssh.host) {
      setSshTestResult({
        success: false,
        message: 'Debe especificar el Host del servidor SSH.'
      });
      return;
    }
    setIsTestingSsh(true);
    setSshTestResult(null);
    try {
      if (window.electronAPI?.testSshTunnel) {
        const res = await window.electronAPI.testSshTunnel(selectedConfig.ssh);
        if (res.success && res.data) {
          setSshTestResult({
            success: true,
            message: res.data.message,
            pingMs: res.data.pingMs
          });
        } else {
          setSshTestResult({
            success: false,
            message: res.error || 'Fallo al conectar con el servidor SSH.'
          });
        }
      }
    } catch (err: any) {
      setSshTestResult({
        success: false,
        message: err.message || 'Error inesperado al probar conexión SSH.'
      });
    } finally {
      setIsTestingSsh(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (window.electronAPI?.testConnection) {
        const res = await window.electronAPI.testConnection(selectedConfig);
        if (res.success && res.data) {
          setTestResult({
            success: true,
            message: res.data.message,
            pingMs: res.data.pingMs,
            serverVersion: res.data.serverVersion
          });
        } else {
          setTestResult({
            success: false,
            message: res.error || 'Fallo de conexión'
          });
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error inesperado al probar conexión'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (window.electronAPI?.saveConnection) {
        await window.electronAPI.saveConnection(selectedConfig);
        onRefreshConnections();
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('connectionModal.deleteConfirm'))) return;

    try {
      if (window.electronAPI?.deleteConnection) {
        await window.electronAPI.deleteConnection(id);
        onRefreshConnections();
        if (selectedConfig.id === id) {
          handleAddNew();
        }
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      if (window.electronAPI?.saveAppSettings) {
        await window.electronAPI.saveAppSettings({
          lastActiveConnectionId: selectedConfig.id,
          autoConnectOnStartup
        });
      }
      if (window.electronAPI?.saveConnection) {
        await window.electronAPI.saveConnection(selectedConfig);
        onRefreshConnections();
      }
      await onConnect(selectedConfig);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'No se pudo conectar con el servidor'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">{t('connectionModal.title')}</h2>
              <p className="text-xs text-zinc-400">{t('connectionModal.subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Sidebar + Main Form) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Saved connections sidebar */}
          <div className="w-72 bg-zinc-950/60 border-r border-zinc-800 flex flex-col">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {t('connectionModal.savedConnections')}
              </span>
              <button
                type="button"
                onClick={handleAddNew}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded text-xs transition-colors border border-emerald-500/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('connectionModal.newConnection')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-1">
              {savedConnections.map((conn) => {
                const isSelected = selectedConfig.id === conn.id;
                return (
                  <div
                    key={conn.id}
                    onClick={() => handleSelectExisting(conn)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100 shadow-sm'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <Server className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <div className="truncate flex-1">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          <span className="truncate">{conn.name}</span>
                          {conn.ssh?.enabled && (
                            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[9px] font-mono shrink-0">
                              {t('connectionModal.sshBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          {conn.host}:{conn.port} {conn.database ? `(${conn.database})` : ''}
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-0.5 shrink-0 ml-1 transition-opacity ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        type="button"
                        onClick={(e) => handleClone(conn, e)}
                        className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-all"
                        title={t('connectionModal.cloneConnectionTooltip')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(conn.id, e)}
                        className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-all"
                        title={t('connectionModal.deleteConfirm')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {savedConnections.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-xs">
                  No hay conexiones guardadas.
                </div>
              )}
            </div>
          </div>

          {/* Connection parameters form */}
          <form onSubmit={handleConnectSubmit} className="flex-1 overflow-auto p-6 flex flex-col justify-between">
            <div className="space-y-4">

              {/* Tabs: General vs SSH Tunnel */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'general'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{t('connectionModal.tabGeneral')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ssh')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'ssh'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{t('connectionModal.tabSsh')}</span>
                  {selectedConfig.ssh?.enabled && (
                    <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 rounded text-[10px] font-mono border border-emerald-500/40">
                      {t('connectionModal.sshBadge')}
                    </span>
                  )}
                </button>
              </div>
              
              {/* TAB 1: GENERAL */}
              {activeTab === 'general' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Profile Name */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      {t('connectionModal.connName')}
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedConfig.name}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, name: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Host and Port */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                        <span>{t('connectionModal.host')}</span>
                        {selectedConfig.ssh?.enabled && (
                          <span className="text-[10px] text-amber-400 font-normal">
                            (Enrutado por SSH: {selectedConfig.ssh.host || 'bastion'})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        required
                        value={selectedConfig.host}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, host: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                        placeholder="127.0.0.1 o localhost"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        {t('connectionModal.port')}
                      </label>
                      <input
                        type="number"
                        required
                        value={selectedConfig.port}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, port: parseInt(e.target.value, 10) || 3306 })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* User and Password */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{t('connectionModal.user')}</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={selectedConfig.user}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, user: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                        placeholder="root"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{t('connectionModal.password')}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-zinc-500 hover:text-zinc-300 text-[11px] flex items-center gap-1"
                        >
                          {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={selectedConfig.password || ''}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, password: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {/* Initial Database and Charset */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{t('connectionModal.defaultDatabase')}</span>
                      </label>
                      <input
                        type="text"
                        value={selectedConfig.database || ''}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, database: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                        placeholder="Opcional (ej: mi_bd)"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        {t('connectionModal.charset')}
                      </label>
                      <select
                        value={selectedConfig.charset || 'utf8mb4'}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, charset: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none transition-colors"
                      >
                        {COMMON_CHARSETS.map((cs) => (
                          <option key={cs} value={cs}>{cs}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* SSL Checkbox */}
                  <div className="pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-300 hover:text-zinc-100">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedConfig.ssl)}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, ssl: e.target.checked })}
                        className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                      />
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('connectionModal.useSsl')}</span>
                    </label>
                  </div>

                  {/* Auto Connect on Startup */}
                  <div className="pt-2 border-t border-zinc-800">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-300 hover:text-zinc-100">
                      <input
                        type="checkbox"
                        checked={autoConnectOnStartup}
                        onChange={(e) => setAutoConnectOnStartup(e.target.checked)}
                        className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                      />
                      <span>{t('connectionModal.autoConnectOnStartup')}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: SSH TUNNEL */}
              {activeTab === 'ssh' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* Enable SSH Tunnel Switch Card */}
                  <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border transition-colors ${
                        selectedConfig.ssh?.enabled 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                          : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/60'
                      }`}>
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">
                          {t('connectionModal.sshEnabled')}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {selectedConfig.ssh?.enabled 
                            ? 'El tráfico hacia MariaDB / MySQL se canalizará a través del host SSH' 
                            : 'Conexión directa estándar sin túnel intermedio'}
                        </div>
                      </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedConfig.ssh?.enabled)}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setSelectedConfig({
                            ...selectedConfig,
                            ssh: {
                              ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG),
                              enabled
                            }
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Informative banner and SSH parameters */}
                  {selectedConfig.ssh?.enabled ? (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                      
                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-start gap-2.5">
                        <Shield className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                        <span className="text-[11px] leading-relaxed text-zinc-300">
                          {t('connectionModal.sshInfoNote')}
                        </span>
                      </div>

                      {/* SSH Host and Port */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-zinc-300 mb-1">
                            {t('connectionModal.sshHost')}
                          </label>
                          <input
                            type="text"
                            required={Boolean(selectedConfig.ssh?.enabled)}
                            value={selectedConfig.ssh?.host || ''}
                            onChange={(e) => setSelectedConfig({
                              ...selectedConfig,
                              ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), host: e.target.value }
                            })}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                            placeholder="ssh.servidor.com o 192.168.1.50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1">
                            {t('connectionModal.sshPort')}
                          </label>
                          <input
                            type="number"
                            required={Boolean(selectedConfig.ssh?.enabled)}
                            value={selectedConfig.ssh?.port ?? 22}
                            onChange={(e) => setSelectedConfig({
                              ...selectedConfig,
                              ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), port: parseInt(e.target.value, 10) || 22 }
                            })}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* SSH Username */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{t('connectionModal.sshUser')}</span>
                        </label>
                        <input
                          type="text"
                          required={Boolean(selectedConfig.ssh?.enabled)}
                          value={selectedConfig.ssh?.user || ''}
                          onChange={(e) => setSelectedConfig({
                            ...selectedConfig,
                            ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), user: e.target.value }
                          })}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                          placeholder="ubuntu, root, debian..."
                        />
                      </div>

                      {/* SSH Auth Method Selection */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-2">
                          {t('connectionModal.sshAuthType')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            (selectedConfig.ssh?.authType || 'password') === 'password'
                              ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}>
                            <input
                              type="radio"
                              name="sshAuthType"
                              checked={(selectedConfig.ssh?.authType || 'password') === 'password'}
                              onChange={() => setSelectedConfig({
                                ...selectedConfig,
                                ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), authType: 'password' }
                              })}
                              className="text-emerald-500 focus:ring-0"
                            />
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('connectionModal.sshAuthPassword')}</span>
                          </label>

                          <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            selectedConfig.ssh?.authType === 'keyFile'
                              ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}>
                            <input
                              type="radio"
                              name="sshAuthType"
                              checked={selectedConfig.ssh?.authType === 'keyFile'}
                              onChange={() => setSelectedConfig({
                                ...selectedConfig,
                                ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), authType: 'keyFile' }
                              })}
                              className="text-emerald-500 focus:ring-0"
                            />
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            <span>{t('connectionModal.sshAuthKeyFile')}</span>
                          </label>
                        </div>
                      </div>

                      {/* Password field */}
                      {(selectedConfig.ssh?.authType || 'password') === 'password' && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{t('connectionModal.sshPassword')}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSshPassword(!showSshPassword)}
                              className="text-zinc-500 hover:text-zinc-300 text-[11px] flex items-center gap-1"
                            >
                              {showSshPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </label>
                          <input
                            type={showSshPassword ? 'text' : 'password'}
                            value={selectedConfig.ssh?.password || ''}
                            onChange={(e) => setSelectedConfig({
                              ...selectedConfig,
                              ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), password: e.target.value }
                            })}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                            placeholder="••••••••"
                          />
                        </div>
                      )}

                      {/* Private Key field */}
                      {selectedConfig.ssh?.authType === 'keyFile' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{t('connectionModal.sshKeyPath')}</span>
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                required={selectedConfig.ssh?.authType === 'keyFile'}
                                value={selectedConfig.ssh?.keyPath || ''}
                                onChange={(e) => setSelectedConfig({
                                  ...selectedConfig,
                                  ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), keyPath: e.target.value }
                                })}
                                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                                placeholder="~/.ssh/id_rsa o ruta a id_rsa / .pem"
                              />
                              <button
                                type="button"
                                onClick={handleBrowseSshKey}
                                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors shrink-0"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                                <span>{t('connectionModal.sshKeyBrowse')}</span>
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{t('connectionModal.sshPassphrase')}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowSshPassphrase(!showSshPassphrase)}
                                className="text-zinc-500 hover:text-zinc-300 text-[11px] flex items-center gap-1"
                              >
                                {showSshPassphrase ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </label>
                            <input
                              type={showSshPassphrase ? 'text' : 'password'}
                              value={selectedConfig.ssh?.passphrase || ''}
                              onChange={(e) => setSelectedConfig({
                                ...selectedConfig,
                                ssh: { ...(selectedConfig.ssh || DEFAULT_SSH_CONFIG), passphrase: e.target.value }
                              })}
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
                              placeholder={t('connectionModal.sshPassphrasePlaceholder')}
                            />
                          </div>
                        </div>
                      )}

                      {/* Test SSH Tunnel button and feedback */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleTestSsh}
                          disabled={isTestingSsh}
                          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
                        >
                          <Terminal className={`w-3.5 h-3.5 text-teal-400 ${isTestingSsh ? 'animate-pulse' : ''}`} />
                          <span>{isTestingSsh ? t('connectionModal.sshTestingTunnel') : t('connectionModal.sshTestTunnel')}</span>
                        </button>

                        {sshTestResult && (
                          <div className={`mt-2.5 p-3 rounded-lg text-xs flex items-start gap-2.5 animate-in fade-in ${
                            sshTestResult.success 
                              ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300' 
                              : 'bg-red-950/40 border border-red-500/30 text-red-300'
                          }`}>
                            {sshTestResult.success ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-semibold">{sshTestResult.message}</p>
                              {sshTestResult.pingMs !== undefined && (
                                <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                                  Ping SSH: {sshTestResult.pingMs} ms
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="p-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                      Para conectar a través de un servidor intermediario (bastion/jump host), activa la casilla superior de Habilitar túnel SSH.
                    </div>
                  )}

                </div>
              )}

              {/* General Test Connection Banner */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs flex items-start gap-2.5 animate-in fade-in ${
                  testResult.success 
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-950/40 border border-red-500/30 text-red-300'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.pingMs !== undefined && (
                      <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                        Ping total: {testResult.pingMs} ms {testResult.serverVersion ? `• Versión: ${testResult.serverVersion}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || isConnecting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTesting ? 'animate-bounce' : ''}`} />
                  <span>{isTesting ? 'Probando...' : t('connectionModal.testConnection')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSaving ? 'Guardando...' : t('connectionModal.saveProfile')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClone(selectedConfig)}
                  disabled={isSaving || isConnecting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
                  title={t('connectionModal.cloneConnectionTooltip')}
                >
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('connectionModal.cloneProfile')}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Database className="w-4 h-4" />
                  <span>{isConnecting ? 'Conectando...' : t('connectionModal.connect')}</span>
                </button>
              </div>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
