import React, { useState } from 'react';
import { QueryTab } from '../../types';
import { Plus, X, FileCode, Check } from 'lucide-react';

interface TabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onRenameTab: (id: string, newTitle: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartRename = (tab: QueryTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditTitle(tab.title);
  };

  const handleFinishRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameTab(id, editTitle.trim());
    }
    setEditingTabId(null);
  };

  return (
    <div className="flex items-center bg-zinc-950 border-b border-zinc-800 px-2 pt-1.5 gap-1 overflow-x-auto select-none">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = editingTabId === tab.id;

        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            onDoubleClick={(e) => handleStartRename(tab, e)}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer border-t border-x transition-all shrink-0 ${
              isActive
                ? 'bg-zinc-900 border-zinc-700/80 text-emerald-300 shadow-sm'
                : 'bg-zinc-950/60 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />

            {isEditing ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleFinishRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(tab.id);
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  className="bg-zinc-950 border border-emerald-500 text-zinc-100 px-1 py-0.5 rounded text-xs focus:outline-none w-24"
                />
                <button
                  onClick={() => handleFinishRename(tab.id)}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="truncate max-w-[140px]">{tab.title}</span>
            )}

            {tab.isRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Ejecutando..." />
            )}

            {tabs.length > 1 && (
              <button
                onClick={(e) => onCloseTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-all"
                title="Cerrar pestaña"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* Add Tab Button */}
      <button
        onClick={onAddTab}
        className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 rounded-lg transition-colors ml-1"
        title="Nueva consulta (Ctrl+T)"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
