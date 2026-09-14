import type { MenuItem } from '../types/menu';

export function availabilityFilter(items: MenuItem[]): MenuItem[] {
  return items.filter(item => item.available);
}