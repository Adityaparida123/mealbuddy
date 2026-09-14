import type { MenuItem } from '../types/menu';

export function isVegetarian(item: MenuItem): boolean {
  return item.dietType !== 'non-veg';
}

export function isVegan(item: MenuItem): boolean {
  return item.dietType === 'vegan';
}

export function isGlutenFree(item: MenuItem): boolean {
  return item.glutenFree === true;
}

/**
 * Hard diet filter. Non-excluded diets are not applied when preference is 'any'.
 */
export function dietFilter(items: MenuItem[], diet: string | null): MenuItem[] {
  if (!diet || diet === 'any') return items;
  switch (diet.toLowerCase()) {
    case 'vegetarian':
      return items.filter(isVegetarian);
    case 'vegan':
      return items.filter(isVegan);
    case 'non-veg':
      return items.filter(item => item.dietType === 'non-veg');
    case 'gluten-free':
      return items.filter(isGlutenFree);
    default:
      return items;
  }
}