import { useCallback, useRef } from 'react';
import { QueryTab } from '../types';

type PersistedTab = Pick<QueryTab, 'id' | 'title' | 'sql' | 'activeResultTab'>;

interface ConnectionWorkspace {
  tabs: PersistedTab[];
  activeTabId: string;
  maxRows: number;
  activeDatabase?: string | null;
}

const STORAGE_KEY = 'mariatomamate_workspaces';
const DEBOUNCE_MS = 600;

const BLANK_TAB: PersistedTab = {
  id: 'tab_1',
  title: 'Consulta 1',
  sql: `-- Bienvenido a Maria Toma Mate 🧉
-- Cliente ligero y rápido para MariaDB y MySQL
-- Presiona F9 o Ctrl+Enter para ejecutar consultas

SHOW DATABASES;
`,
  activeResultTab: 'grid',
};

function readAll(): Record<string, ConnectionWorkspace> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, ConnectionWorkspace>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // silently ignore if localStorage full
  }
}

export function useConnectionWorkspace() {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(
    (connectionId: string): ConnectionWorkspace | null => {
      const all = readAll();
      return all[connectionId] ?? null;
    },
    []
  );

  const saveWorkspaceNow = useCallback(
    (connectionId: string, tabs: QueryTab[], activeTabId: string, maxRows: number, activeDatabase?: string | null) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const all = readAll();
      all[connectionId] = {
        tabs: tabs.map(({ id, title, sql, activeResultTab }) => ({
          id,
          title,
          sql,
          activeResultTab,
        })),
        activeTabId,
        maxRows,
        activeDatabase: activeDatabase ?? all[connectionId]?.activeDatabase ?? null
      };
      writeAll(all);
    },
    []
  );

  const saveWorkspaceDebounced = useCallback(
    (connectionId: string, tabs: QueryTab[], activeTabId: string, maxRows: number, activeDatabase?: string | null) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        saveWorkspaceNow(connectionId, tabs, activeTabId, maxRows, activeDatabase);
      }, DEBOUNCE_MS);
    },
    [saveWorkspaceNow]
  );

  const hydrateWorkspace = useCallback(
    (connectionId: string): { tabs: QueryTab[]; activeTabId: string; maxRows: number; activeDatabase: string | null } => {
      const saved = loadWorkspace(connectionId);

      if (!saved || saved.tabs.length === 0) {
        return {
          tabs: [{ ...BLANK_TAB, result: null, isRunning: false, error: null }],
          activeTabId: BLANK_TAB.id,
          maxRows: 1000,
          activeDatabase: saved?.activeDatabase ?? null
        };
      }

      const tabs: QueryTab[] = saved.tabs.map((t) => ({
        ...t,
        result: null,
        isRunning: false,
        error: null,
      }));

      const activeTabId = tabs.find((t) => t.id === saved.activeTabId)
        ? saved.activeTabId
        : tabs[0].id;

      return { 
        tabs, 
        activeTabId, 
        maxRows: saved.maxRows ?? 1000, 
        activeDatabase: saved.activeDatabase ?? null 
      };
    },
    [loadWorkspace]
  );

  return { hydrateWorkspace, saveWorkspaceNow, saveWorkspaceDebounced };
}
