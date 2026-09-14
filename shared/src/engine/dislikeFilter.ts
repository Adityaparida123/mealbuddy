import type { MenuItem } from '../types/menu';
import { tokensOf, eqToken } from './intent';

function normalize(pieces: string[]): string[] {
  const set = new Set<string>();
  for (const p of pieces) {
    for (const t of tokensOf(p)) set.add(t);
  }
  return [...set];
}

/**
 * Does this item clearly represent something the student said they do NOT want?
 * `token` may be a taste ("sweet"), a food word ("chicken"), or an item name
 * token ("noodles"). Matching is strict word-based, never substring-based.
 */
export function matchesDislike(item: MenuItem, token: string): boolean {
  const t = token.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2) return false;

  // taste / mood dislike (e.g. "don't want anything sweet")
  if (['spicy', 'hot', 'sweet', 'sour', 'salty', 'crispy', 'crunchy', 'creamy', 'cheesy', 'cold', 'iced', 'light', 'heavy', 'filling', 'healthy', 'rich'].includes(t)) {
    const name = item.name.toLowerCase();
    const ing = item.ingredients.join(' ').toLowerCase();
    if (t === 'sweet') {
      return item.mood.includes('sweet') || ing.includes('sugar') || ing.includes('jaggery') || ing.includes('syrup') || name.includes('chikki') || name.includes('lassi');
    }
    if (t === 'spicy' || t === 'hot') {
      return item.spiceLevel === 'spicy' || item.mood.includes('spicy') || ing.includes('chilli') || ing.includes('chili') || ing.includes('pepper') || ing.includes('masala');
    }
    if (t === 'cold' || t === 'iced') {
      return name.includes('cold') || name.includes('lassi') || (ing.includes('milk') && name.includes('coffee'));
    }
    if (t === 'crispy' || t === 'crunchy') return ing.includes('fried') || ing.includes('crispy') || ing.includes('bread');
    if (t === 'creamy' || t === 'cheesy') return ing.includes('cream') || ing.includes('cheese') || ing.includes('paneer') || ing.includes('butter') || ing.includes('yogurt');
    if (t === 'light' || t === 'healthy') return item.calories !== null && item.calories <= 220;
    if (t === 'heavy' || t === 'filling') return item.calories !== null && item.calories >= 400;
    return false;
  }

  // food-word / item-name dislike (e.g. "don't want chicken")
  const nameToks = normalize([item.name]);
  const catToks = normalize([item.category]);
  const ingToks = normalize(item.ingredients);
  const target = tokensOf(t);
  if (target.length === 0) return false;
  if (target.every(tok => nameToks.some(nt => eqToken(nt, tok)))) return true;
  if (target.some(tok => catToks.some(ct => eqToken(ct, tok)))) return true;
  if (target.some(tok => ingToks.some(it => eqToken(it, tok)))) return true;
  return false;
}

/**
 * Hard exclusion stage: items that map to a stated dislike never enter the
 * candidate pool, so they cannot be ranked back in by a high score.
 */
export function dislikeFilter(items: MenuItem[], dislikes: string[]): MenuItem[] {
  if (!dislikes.length) return items;
  return items.filter(item => !dislikes.some(d => matchesDislike(item, d)));
}