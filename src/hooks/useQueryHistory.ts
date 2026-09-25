import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryHistoryItem } from '../types';

const STORAGE_KEY = 'mariatomamate_query_history';
const MAX_NON_FAVORITE_ITEMS = 800;

function readHistoryFromStorage(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn('Error al leer historial desde localStorage:', err);
    return [];
  }
}

function writeHistoryToStorage(items: QueryHistoryItem[]) {
  try {
    // Preservar siempre TODOS los favoritos; recortar solo no favoritos si excede el límite
    const favorites = items.filter(item => item.isFavorite);
    const nonFavorites = items.filter(item => !item.isFavorite).slice(0, MAX_NON_FAVORITE_ITEMS);

    const merged = [...favorites, ...nonFavorites].sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeB - timeA;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('Error al guardar historial en localStorage:', err);
  }
}

export interface AddHistoryParams {
  sql: string;
  durationMs: number;
  status: 'success' | 'error';
  rowCount?: number;
  error?: string;
  database?: string;
}

export interface UseQueryHistoryOptions {
  activeConnectionId?: string | null;
  activeConnectionName?: string | null;
  activeDatabase?: string | null;
}

export function useQueryHistory(options: UseQueryHistoryOptions = {}) {
  const { activeConnectionId, activeConnectionName, activeDatabase } = options;

  const [history, setHistory] = useState<QueryHistoryItem[]>(() => readHistoryFromStorage());

  // Refs to avoid stale closures in callbacks
  const activeConnIdRef = useRef(activeConnectionId);
  const activeConnNameRef = useRef(activeConnectionName);
  const activeDbRef = useRef(activeDatabase);

  useEffect(() => {
    activeConnIdRef.current = activeConnectionId;
    activeConnNameRef.current = activeConnectionName;
    activeDbRef.current = activeDatabase;
  }, [activeConnectionId, activeConnectionName, activeDatabase]);

  // Agregar nueva ejecución al historial
  const addEntry = useCallback((params: AddHistoryParams) => {
    const now = Date.now();
    const dateObj = new Date(now);
    const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newItem: QueryHistoryItem = {
      id: `hist_${now}_${Math.random().toString(36).substring(2, 7)}`,
      sql: params.sql,
      timestamp: timeFormatted,
      createdAt: now,
      durationMs: params.durationMs,
      status: params.status,
      rowCount: params.rowCount,
      error: params.error,
      database: params.database || activeDbRef.current || undefined,
      connectionId: activeConnIdRef.current || undefined,
      connectionName: activeConnNameRef.current || undefined,
      isFavorite: false,
    };

    setHistory(prev => {
      const updated = [newItem, ...prev];
      writeHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // Alternar favorito (estrella)
  const toggleFavorite = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          return { ...item, isFavorite: !item.isFavorite };
        }
        return item;
      });
      writeHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // Eliminar un ítem individual
  const deleteEntry = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      writeHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // Limpiar historial (con opción de conservar favoritos o filtrar por conexión)
  const clearHistory = useCallback((options?: { keepFavorites?: boolean; forConnectionOnly?: boolean }) => {
    const keepFavorites = options?.keepFavorites !== false; // Default true
    const forConnectionOnly = Boolean(options?.forConnectionOnly && activeConnIdRef.current);

    setHistory(prev => {
      const updated = prev.filter(item => {
        // Si es para esta conexión únicamente y el item pertenece a otra conexión, se conserva
        if (forConnectionOnly && item.connectionId && item.connectionId !== activeConnIdRef.current) {
          return true;
        }

        // Si se pide conservar favoritos y el item es favorito, se conserva
        if (keepFavorites && item.isFavorite) {
          return true;
        }

        // De lo contrario se elimina
        return false;
      });

      writeHistoryToStorage(updated);
      return updated;
    });
  }, []);

  return {
    history,
    addEntry,
    toggleFavorite,
    deleteEntry,
    clearHistory,
  };
}
