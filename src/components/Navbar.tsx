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
  GitCompare,
  Users,
  Activity,
  Wrench
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
  onOpenUserManagerModal?: () => void;
  onOpenProcessViewerModal?: () => void;
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
  onOpenUserManagerModal,
  onOpenProcessViewerModal,
  onDisconnect,
  onNewQuery
}) => {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const { theme, setTheme, availableThemes, currentThemeOption } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

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

        {/* Tools Dropdown Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded border transition-colors ${
              isToolsMenuOpen ? 'border-emerald-500/50 text-emerald-300 bg-zinc-800' : 'border-zinc-800'
            }`}
            title={t('navbar.toolsTooltip')}
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('navbar.tools')}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${isToolsMenuOpen ? 'rotate-180 text-emerald-400' : ''}`} />
          </button>

          {isToolsMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsToolsMenuOpen(false)} 
              />
              <div className="absolute left-0 mt-1.5 z-50 w-72 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/80 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100">
                {/* Section: Server & Monitoring */}
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t('navbar.toolsSectionServer')}
                </div>
                <div className="px-1 space-y-0.5">
                  {onOpenUserManagerModal && (
                    <button
                      type="button"
                      disabled={!isConnected}
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenUserManagerModal();
                      }}
                      className="w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none group"
                    >
                      <div className="mt-0.5 p-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/20">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                          <span>{t('navbar.userManager')}</span>
                          {!isConnected && <span className="text-[10px] text-zinc-500">({t('common.disconnected')})</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight truncate">
                          {t('navbar.userManagerDesc')}
                        </div>
                      </div>
                    </button>
                  )}

                  {onOpenProcessViewerModal && (
                    <button
                      type="button"
                      disabled={!isConnected}
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenProcessViewerModal();
                      }}
                      className="w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none group"
                    >
                      <div className="mt-0.5 p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20">
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                          <span>{t('navbar.processViewer')}</span>
                          {!isConnected && <span className="text-[10px] text-zinc-500">({t('common.disconnected')})</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight truncate">
                          {t('navbar.processViewerDesc')}
                        </div>
                      </div>
                    </button>
                  )}

                  {onOpenSchemaDiffModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenSchemaDiffModal();
                      }}
                      className="w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-zinc-800/80 group"
                    >
                      <div className="mt-0.5 p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20">
                        <GitCompare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100">
                          {t('navbar.compareSchemas')}
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight truncate">
                          {t('navbar.compareSchemasDesc')}
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                <div className="my-1.5 border-t border-zinc-800" />

                {/* Section: Backups & Data */}
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t('navbar.toolsSectionData')}
                </div>
                <div className="px-1 space-y-0.5">
                  {onOpenDumpModal && (
                    <button
                      type="button"
                      disabled={!isConnected}
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenDumpModal();
                      }}
                      className="w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none group"
                    >
                      <div className="mt-0.5 p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20">
                        <Download className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                          <span>{t('navbar.exportDump')}</span>
                          {!isConnected && <span className="text-[10px] text-zinc-500">({t('common.disconnected')})</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight truncate">
                          {t('navbar.exportDumpDesc')}
                        </div>
                      </div>
                    </button>
                  )}

                  {onOpenImportModal && (
                    <button
                      type="button"
                      disabled={!isConnected}
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenImportModal();
                      }}
                      className="w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none group"
                    >
                      <div className="mt-0.5 p-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:bg-teal-500/20">
                        <Upload className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                          <span>{t('navbar.importSql')}</span>
                          {!isConnected && <span className="text-[10px] text-zinc-500">({t('common.disconnected')})</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight truncate">
                          {t('navbar.importSqlDesc')}
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                <div className="my-1.5 border-t border-zinc-800" />

                {/* Section: Schemas */}
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t('navbar.toolsSectionSchema')}
                </div>
                <div className="px-1 space-y-0.5">
                  <button
                    type="button"
                    disabled={!isConnected}
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      onOpenCreateDbModal();
                    }}
                    className="w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none group"
                  >
                    <div className="mt-0.5 p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20">
                      <FolderPlus className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                        <span>{t('navbar.createDb')}</span>
                        {!isConnected && <span className="text-[10px] text-zinc-500">({t('common.disconnected')})</span>}
                      </div>
                      <div className="text-[11px] text-zinc-400 leading-tight truncate">
                        {t('navbar.createDbDesc')}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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
            {/* Mini swatch del tema activo */}
            <span className="text-base leading-none" aria-hidden>{currentThemeOption.icon}</span>
            <span className="text-[11px] font-medium hidden sm:inline">
              {t(currentThemeOption.nameKey)}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {isThemeMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsThemeMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 z-50 w-52 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                <p className="px-3 py-1 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold select-none">
                  {t('navbar.themeTooltip')}
                </p>
                {availableThemes.map((th) => {
                  const isActive = theme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        setTheme(th.id);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                        isActive
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'
                      }`}
                    >
                      {/* Preview pill: bg + accent dot */}
                      <span
                        className="w-8 h-5 rounded-md border border-white/10 shrink-0 flex items-center justify-center relative overflow-hidden"
                        style={{ backgroundColor: th.bgColor }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: th.accentColor }}
                        />
                      </span>
                      <span className="text-base leading-none shrink-0" aria-hidden>{th.icon}</span>
                      <span className="flex-1">{t(th.nameKey)}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: th.accentColor }} />
                      )}
                    </button>
                  );
                })}
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
