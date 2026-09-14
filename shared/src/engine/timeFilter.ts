import type { MenuItem } from '../types/menu';

/**
 * Hard time filter. When the student states a time budget, items whose known
 * preparation time exceeds it are excluded. Items with UNKNOWN prep-time data
 * are also excluded — we never pretend an unknown time fits the limit.
 */
export function timeFilter(items: MenuItem[], timeLimit: number | null): MenuItem[] {
  if (!timeLimit || timeLimit <= 0) return items;
  return items.filter(item => item.prepTime !== null && item.prepTime <= timeLimit);
}