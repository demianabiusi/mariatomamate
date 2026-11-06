import React, { useState, useEffect } from 'react';
import appIconUrl from '../../../public/icon.svg';
import packageInfo from '../../../package.json';
import { getFormattedBuildDate, getFullBuildDate, BUILD_DATE } from '../../utils/buildInfo';
import { AppInfo } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  X, 
  Calendar, 
  Tag, 
  Cpu, 
  Globe, 
  Copy, 
  Check, 
  ExternalLink, 
  Heart,
  Code2,
  Terminal,
  ShieldCheck
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useTranslation();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && window.electronAPI?.getAppInfo) {
      window.electronAPI.getAppInfo().then(info => setAppInfo(info)).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedDate = getFullBuildDate(language);
  const shortDate = getFormattedBuildDate();

  const handleCopySystemInfo = () => {
    const infoText = [
      `Maria Toma Mate v${packageInfo.version}`,
      `Compilación: ${formattedDate} (${BUILD_DATE})`,
      appInfo ? `Electron: ${appInfo.electronVersion}` : null,
      appInfo ? `Chrome: ${appInfo.chromeVersion}` : null,
      appInfo ? `Node.js: ${appInfo.nodeVersion}` : null,
      appInfo ? `Plataforma: ${appInfo.platform} (${appInfo.arch})` : `Navegador: ${navigator.userAgent}`,
      `Licencia: MIT - Autor: Demian Abiusi`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(infoText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-zinc-800/60 to-transparent border-b border-zinc-800/80">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <img 
                src={appIconUrl} 
                alt="Logo" 
                className="w-12 h-12 rounded-xl shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30"
              />
              <span className="absolute -bottom-1 -right-1 text-sm select-none">🧉</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Maria Toma <span className="text-emerald-400">Mate</span>
              </h2>
              <p className="text-xs text-zinc-400">
                {t('aboutModal.subtitle') || 'Cliente visual moderno y liviano para MariaDB y MySQL'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Main Version & Build Date Banner */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium text-[11px]">
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('aboutModal.version') || 'Versión'}</span>
              </div>
              <div className="text-sm font-bold text-emerald-300 font-mono">
                v{packageInfo.version}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('aboutModal.buildDate') || 'Fecha de compilación'}</span>
              </div>
              <div className="text-xs font-semibold text-zinc-200 font-mono truncate" title={formattedDate}>
                {shortDate}
              </div>
            </div>
          </div>

          {/* Compilation timestamp details */}
          <div className="px-3 py-2 bg-zinc-950/50 border border-zinc-800/80 rounded-xl flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Compilado el:</span>
            <span className="text-zinc-200 font-mono font-medium">{formattedDate}</span>
          </div>

          {/* Runtime Environment Info */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>{t('aboutModal.environment') || 'Entorno de ejecución'}</span>
            </div>
            
            <div className="p-3 bg-zinc-950/70 border border-zinc-800/90 rounded-xl space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500 font-sans">Electron:</span>
                <span>{appInfo?.electronVersion || 'N/A (Web)'}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500 font-sans">Chromium:</span>
                <span>{appInfo?.chromeVersion || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500 font-sans">Node.js:</span>
                <span>{appInfo?.nodeVersion || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500 font-sans">Plataforma:</span>
                <span>{appInfo ? `${appInfo.platform} (${appInfo.arch})` : navigator.platform}</span>
              </div>
            </div>
          </div>

          {/* Author & Links */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <div className="flex items-center gap-1">
              <span>{t('aboutModal.author') || 'Autor'}:</span>
              <span className="text-zinc-200 font-medium">Demian Abiusi</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Licencia MIT</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center justify-between gap-3">
          <button
            onClick={handleCopySystemInfo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-lg text-xs font-medium transition-colors border border-zinc-700/60"
            title="Copiar detalles para reporte técnico"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('aboutModal.copyInfo') || 'Copiar info'}</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-950 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
