import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MenuItem } from '../../../shared/src/types/menu';
import menuSeed from '../../../shared/src/data/menu.json';
import { loadMenuFromStorage, saveMenuToStorage } from '../services/storage';

const SEED = menuSeed as MenuItem[];

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[]>(() => loadMenuFromStorage(SEED));
  const [search, setSearch] = useState('');
  const [lastSaved, setLastSaved] = useState<number>(Date.now());

  useEffect(() => {
    saveMenuToStorage(menu);
    setLastSaved(Date.now());
  }, [menu]);

  const updateItem = useCallback((updated: MenuItem) => {
    setMenu(prev => prev.map(item => (item.id === updated.id ? updated : item)));
  }, []);

  const addItem = useCallback((item: MenuItem) => {
    setMenu(prev => [...prev, item]);
  }, []);

  const deleteItem = useCallback((id: string) => {
    setMenu(prev => prev.filter(item => item.id !== id));
  }, []);

  const toggleAvailability = useCallback((id: string) => {
    setMenu(prev =>
      prev.map(item => (item.id === id ? { ...item, available: !item.available } : item))
    );
  }, []);

  const resetMenu = useCallback(() => {
    setMenu(JSON.parse(JSON.stringify(SEED)));
  }, []);

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menu;
    return menu.filter(item =>
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
    updateItem,
    addItem,
    deleteItem,
    toggleAvailability,
    resetMenu,
    lastSaved,
  };
}

export const MENU_SEED = SEED;