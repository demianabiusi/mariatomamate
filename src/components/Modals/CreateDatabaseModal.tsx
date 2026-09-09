import React, { useState } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Database, 
  FolderPlus, 
  AlertCircle, 
  X,
  Code,
  Sparkles
} from 'lucide-react';

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDatabase: (options: { name: string; charset?: string; collation?: string }) => Promise<void>;
}

const CHARSETS_WITH_COLLATIONS: Record<string, string[]> = {
  utf8mb4: [
    'utf8mb4_unicode_ci',
    'utf8mb4_general_ci',
    'utf8mb4_spanish_ci',
    'utf8mb4_bin',
    'utf8mb4_0900_ai_ci'
  ],
  utf8: [
    'utf8_general_ci',
    'utf8_unicode_ci',
    'utf8_spanish_ci',
    'utf8_bin'
  ],
  latin1: [
    'latin1_swedish_ci',
    'latin1_general_ci',
    'latin1_spanish_ci',
    'latin1_bin'
  ],
  ascii: [
    'ascii_general_ci',
    'ascii_bin'
  ]
};

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({
  isOpen,
  onClose,
  onCreateDatabase
}) => {
  const { t } = useTranslation();
  const [dbName, setDbName] = useState('');
  const [charset, setCharset] = useState('utf8mb4');
  const [collation, setCollation] = useState('utf8mb4_unicode_ci');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const collationsList = CHARSETS_WITH_COLLATIONS[charset] || ['utf8mb4_unicode_ci'];

  const handleCharsetChange = (newCharset: string) => {
    setCharset(newCharset);
    const available = CHARSETS_WITH_COLLATIONS[newCharset];
    if (available && available.length > 0) {
      setCollation(available[0]);
    }
  };

  const previewSql = dbName.trim()
    ? `CREATE DATABASE \`${dbName.trim().replace(/`/g, '')}\` CHARACTER SET ${charset} COLLATE ${collation};`
    : `-- Escribe un nombre para generar la sentencia`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = dbName.trim().replace(/`/g, '');
    if (!clean) {
      setError('Por favor ingresa un nombre para la base de datos.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreateDatabase({
        name: clean,
        charset,
        collation
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la base de datos');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">{t('createDbModal.title')}</h2>
              <p className="text-xs text-zinc-400">{t('createDbModal.subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {t('createDbModal.dbName')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="ej: mi_tienda_online"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {t('createDbModal.charset')}
              </label>
              <select
                value={charset}
                onChange={(e) => handleCharsetChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none transition-colors"
              >
                <option value="utf8mb4">utf8mb4 (Recomendado)</option>
                <option value="utf8">utf8</option>
                <option value="latin1">latin1</option>
                <option value="ascii">ascii</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {t('createDbModal.collation')}
              </label>
              <select
                value={collation}
                onChange={(e) => setCollation(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none transition-colors"
              >
                {collationsList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SQL Preview */}
          <div>
            <span className="block text-[11px] uppercase font-bold text-zinc-500 mb-1 flex items-center gap-1">
              <Code className="w-3 h-3" />
              <span>Sentencia SQL generada:</span>
            </span>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-[11px] text-emerald-400 break-all select-text">
              {previewSql}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isCreating || !dbName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Creando...' : t('createDbModal.createAndUse')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
