import type { MenuItem } from '../types/menu';

/**
 * Budget is treated as a soft-but-applied constraint: when budget is declared,
 * out-of-budget items are deprioritized but kept as "rescue" candidates so the
 * engine can explain why the desired item is over budget. The enjoyable flow
 * is handled by the engine via Budget Rescue.
 */
export function budgetFilter(items: MenuItem[], budget: number | null): MenuItem[] {
  if (!budget || budget <= 0) return items;
  return items.filter(item => item.price <= budget);
}

export function itemsWithinBudget(items: MenuItem[], budget: number | null): MenuItem[] {
  if (!budget || budget <= 0) return items;
  return items.filter(item => item.price <= budget);
}