import { useState, useCallback } from 'react';

const STORAGE_KEY = 'app_favorites';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function save(favs: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load);

  const toggle = useCallback((name: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      save(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((name: string) => favorites.has(name), [favorites]);

  return { favorites, toggle, isFavorite };
}
