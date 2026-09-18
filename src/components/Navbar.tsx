import React, { useState } from 'react';
import appIconUrl from '../../public/icon.svg';
import packageInfo from '../../package.json';
import { ConnectionConfig } from '../types';
import { useTranslation } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { 
  Database, 
  Unplug, 
  Settings2, 
  PlusCircle, 
  Download, 
  Upload, 
  Globe, 
  ChevronDown,
  FolderPlus,
  Sun,
  Moon,
  GitCompare
} from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  activeConfig: ConnectionConfig | null;
  activeDatabase: string | null;
  onOpenConnectionModal: () => void;
  onOpenCreateDbModal: () => void;
  onOpenDumpModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenSchemaDiffModal?: () => void;
  onDisconnect: () => void;
  onNewQuery: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  activeConfig,
  activeDatabase,
  onOpenConnectionModal,
  onOpenCreateDbModal,
  onOpenDumpModal,
  onOpenImportModal,
  onOpenSchemaDiffModal,
  onDisconnect,
  onNewQuery
}) => {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const { theme, setTheme, availableThemes } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const currentLang = availableLanguages.find(l => l.code === language) || availableLanguages[0];

  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800/90 flex items-center justify-between px-4 select-none shrink-0">
      
      {/* Brand & App Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onOpenConnectionModal} title="Administrador de conexiones">
          <img 
            src={appIconUrl} 
            alt="Maria Toma Mate Logo" 
            className="w-7 h-7 rounded-lg shadow-md shadow-emerald-500/25 hover:scale-105 transition-transform" 
          />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-zinc-100 flex items-center gap-1.5">
              Maria Toma <span className="text-emerald-400">Mate</span>
              <span className="text-xs">🧉</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                v{packageInfo.version}
              </span>
            </h1>
          </div>
        </div>

        <div className="h-5 w-px bg-zinc-800 mx-2" />

        {/* Quick query tab action */}
        <button
          onClick={onNewQuery}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded border border-zinc-800 transition-colors"
          title={t('navbar.newQueryTooltip')}
        >
          <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('navbar.newQuery')}</span>
        </button>

        {/* Create DB Action */}
        {isConnected && (
          <button
            onClick={onOpenCreateDbModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs rounded border border-zinc-800 transition-colors"
            title={t('navbar.createDbTooltip')}
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('navbar.createDb')}</span>
          </button>
        )}

        {/* Dump / Export DB Action */}
        {isConnected && onOpenDumpModal && (
          <button
            onClick={onOpenDumpModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-emerald-300 hover:text-emerald-200 text-xs rounded border border-zinc-800 hover:border-emerald-500/30 transition-colors"
            title={t('navbar.exportDumpTooltip')}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('navbar.exportDump')}</span>
          </button>
        )}

        {/* Import Dump Action */}
        {isConnected && onOpenImportModal && (
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-teal-300 hover:text-teal-200 text-xs rounded border border-zinc-800 hover:border-teal-500/30 transition-colors"
            title={t('navbar.importSqlTooltip')}
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>{t('navbar.importSql')}</span>
          </button>
        )}

        {/* Schema Diff / Compare Action */}
        {onOpenSchemaDiffModal && (
          <button
            onClick={onOpenSchemaDiffModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-indigo-300 hover:text-indigo-200 text-xs rounded border border-zinc-800 hover:border-indigo-500/30 transition-colors"
            title={t('navbar.compareSchemasTooltip')}
          >
            <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('navbar.compareSchemas')}</span>
          </button>
        )}
      </div>

      {/* Center Status: Connected Server & Active Database */}
      <div className="flex items-center gap-2">
        {isConnected && activeConfig ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-xs text-emerald-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-zinc-200">{activeConfig.name}</span>
            <span className="text-zinc-500">({activeConfig.host}:{activeConfig.port})</span>
            {activeConfig.ssh?.enabled && (
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono font-bold" title={`Túnel SSH activo hacia ${activeConfig.ssh.user}@${activeConfig.ssh.host}:${activeConfig.ssh.port}`}>
                SSH
              </span>
            )}
            {activeDatabase && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="px-1.5 py-0.5 bg-emerald-900/60 rounded text-emerald-200 font-bold text-[11px]">
                  {activeDatabase}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span>{t('common.disconnected')}</span>
          </div>
        )}
      </div>

      {/* Right Connection Controls & Language Switcher */}
      <div className="flex items-center gap-2">
        
        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-medium transition-colors"
            title={t('navbar.language')}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{currentLang.flag}</span>
            <span className="text-[11px] uppercase font-bold">{currentLang.code}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {isLangMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsLangMenuOpen(false)} 
              />
              <div className="absolute right-0 mt-1.5 z-50 w-32 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-xl py-1 divide-y divide-zinc-800/60 animate-in fade-in zoom-in-95 duration-100">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                      language === lang.code
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-medium transition-colors"
            title={t('navbar.themeTooltip')}
          >
            {theme === 'light' ? (
              <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
            )}
            <span className="text-[11px] font-medium hidden sm:inline">
              {t(`theme.${theme}`)}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {isThemeMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsThemeMenuOpen(false)} 
              />
              <div className="absolute right-0 mt-1.5 z-50 w-32 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-xl py-1 divide-y divide-zinc-800/60 animate-in fade-in zoom-in-95 duration-100">
                {availableThemes.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      setTheme(th.id);
                      setIsThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                      theme === th.id
                        ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                    }`}
                  >
                    {th.id === 'light' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{t(th.nameKey)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Connect / Change Connection */}
        <button
          onClick={onOpenConnectionModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium rounded-lg border border-zinc-800 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isConnected ? t('navbar.changeConnection') : t('navbar.connect')}</span>
        </button>

        {/* Disconnect Action */}
        {isConnected && (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg border border-red-500/30 transition-colors"
            title={t('navbar.disconnectTooltip')}
          >
            <Unplug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('navbar.disconnect')}</span>
          </button>
        )}
      </div>

    </header>
  );
};
