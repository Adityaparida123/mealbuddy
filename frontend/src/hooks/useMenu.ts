import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MenuItem } from '../../../shared/src/types/menu';
import { ApiError, menuApi } from '../services/api';

// The menu's source of truth is MongoDB Atlas → Express API. This hook fetches
// it from the backend and performs every mutation through the API so cook
// changes are immediately visible to students everywhere.
export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastSaved, setLastSaved] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await menuApi.list();
      setMenu(res.items);
      setLastSaved(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateItem = useCallback(async (updated: MenuItem) => {
    setError(null);
    try {
      const res = await menuApi.update(updated.id, updated);
      setMenu(prev => prev.map(item => (item.id === res.item.id ? res.item : item)));
      setLastSaved(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    }
  }, []);

  const addItem = useCallback(async (item: MenuItem) => {
    setError(null);
    try {
      const { id: _serverAssignedId, ...payload } = item;
      const res = await menuApi.create(payload);
      setMenu(prev => [...prev, res.item]);
      setLastSaved(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    setError(null);
    try {
      await menuApi.remove(id);
      setMenu(prev => prev.filter(item => item.id !== id));
      setLastSaved(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    }
  }, []);

  const toggleAvailability = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const current = menu.find(item => item.id === id);
        if (!current) return;
        const res = await menuApi.setAvailability(id, !current.available);
        setMenu(prev => prev.map(item => (item.id === id ? res.item : item)));
        setLastSaved(Date.now());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
      }
    },
    [menu]
  );

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menu;
    return menu.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.ingredients.join(' ').toLowerCase().includes(q)
    );
  }, [menu, search]);

  return {
    menu,
    filteredMenu,
    search,
    setSearch,
    loading,
    error,
    lastSaved,
    refresh,
    updateItem,
    addItem,
    deleteItem,
    toggleAvailability,
  };
}