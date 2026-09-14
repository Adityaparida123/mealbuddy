import { useCallback, useEffect, useState } from 'react';
import type { MenuItem } from '../../../shared/src/types/menu';
import { ApiError, favoritesApi } from '../services/api';

export function useFavorites() {
  const [favorites, setFavorites] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await favoritesApi.list();
      setFavorites(res.favorites);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (id: string) => favorites.some(f => f.id === id),
    [favorites]
  );

  const toggle = useCallback(
    async (item: MenuItem) => {
      setError(null);
      try {
        if (isFavorite(item.id)) {
          await favoritesApi.remove(item.id);
          setFavorites(prev => prev.filter(f => f.id !== item.id));
        } else {
          await favoritesApi.add(item.id);
          setFavorites(prev => [...prev, item]);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
      }
    },
    [isFavorite]
  );

  return { favorites, loading, error, isFavorite, toggle, refresh };
}