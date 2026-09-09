import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../../types';
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
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
  savedConnections: ConnectionConfig[];
  onRefreshConnections: () => void;
  activeConfigId?: string;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  id: '',
  name: 'Nueva Conexión MariaDB / MySQL',
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: '',
  charset: 'utf8mb4',
  ssl: false
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
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; pingMs?: number; serverVersion?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      if (savedConnections.length > 0) {
        const preferredId = activeConfigId ?? lastSelectedIdRef.current;
        const found = savedConnections.find(c => c.id === preferredId) ?? savedConnections[0];
        lastSelectedIdRef.current = found.id;
        setSelectedConfig({ ...found });
      } else {
        const blank = { ...DEFAULT_CONFIG, id: 'conn_' + Date.now() };
        lastSelectedIdRef.current = blank.id;
        setSelectedConfig(blank);
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, activeConfigId]);

  if (!isOpen) return null;

  const handleSelectExisting = (conn: ConnectionConfig) => {
    lastSelectedIdRef.current = conn.id;
    setSelectedConfig({ ...conn });
    setTestResult(null);
  };

  const handleAddNew = () => {
    const newConn: ConnectionConfig = {
      ...DEFAULT_CONFIG,
      id: 'conn_' + Date.now(),
      name: `Conexión ${savedConnections.length + 1}`
    };
    setSelectedConfig(newConn);
    setTestResult(null);
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
                      <div className="truncate">
                        <div className="font-medium truncate">{conn.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          {conn.host}:{conn.port} {conn.database ? `(${conn.database})` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(conn.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-all shrink-0 ml-1"
                      title="Eliminar conexión"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    {t('connectionModal.host')}
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

              {/* Test Connection Banner */}
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
                        Ping: {testResult.pingMs} ms {testResult.serverVersion ? `• Versión: ${testResult.serverVersion}` : ''}
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
