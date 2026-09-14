import type { MenuItem } from '../types/menu';

export const DEFAULT_ALLERGIES = [
  'peanuts',
  'nuts',
  'dairy',
  'milk',
  'eggs',
  'gluten',
  'wheat',
  'soy',
  'fish',
  'shellfish',
] as const;

/**
 * Canonical allergen -> word-boundary regex. We never use bare substring
 * matching so "nut" cannot match inside "coconut"/"doughnut", and we keep
 * plural + alias forms (peanut/peanuts/groundnut/ground nuts/peanut butter).
 */
export const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  nuts: /\b(peanuts?|groundnuts?|ground\s+nuts?|tree\s+nuts?|almonds?|walnuts?|cashews?|pistachios?|hazelnuts?|pista|nuts?|peanut\s+butter)\b/i,
  dairy: /\b(dairy|milk|butter|cheese|paneer|yogurt|yoghurt|curd|khoya|creme|cream|ice\s*cream|ghee)\b/i,
  egg: /\b(egg|eggs|mayo|mayonnaise|albumen)\b/i,
  gluten: /\b(gluten|wheat|flour|maida|bread|roti|bhature|pasta|noodles|semolina|sooji)\b/i,
  soy: /\b(soy|soya|soybean|tofu|soy\s+sauce)\b/i,
  fish: /\bfish(?:es)?\b/i,
  shellfish: /\b(shellfish|shrimp|prawn|prawns|crab|crustacean|lobster|crayfish|crabstick)\b/i,
  sesame: /\b(sesame|tahini)\b/i,
  mustard: /\bmustard\b/i,
};

export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  nuts: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'ground nut', 'ground nuts', 'peanut butter', 'almond', 'almonds', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pista', 'tree nut', 'tree nuts', 'nut', 'nuts'],
  dairy: ['dairy', 'milk', 'butter', 'cheese', 'paneer', 'yogurt', 'curd', 'khoya', 'creme', 'cream', 'ice cream', 'ghee'],
  egg: ['egg', 'eggs', 'mayo', 'mayonnaise', 'albumen'],
  gluten: ['gluten', 'wheat', 'flour', 'maida', 'bread', 'roti', 'bhature', 'pasta', 'noodles', 'semolina', 'sooji'],
  soy: ['soy', 'soya', 'soybean', 'tofu', 'soy sauce'],
  fish: ['fish'],
  shellfish: ['shellfish', 'shrimp', 'prawn', 'prawns', 'crab', 'crustacean', 'lobster', 'crayfish', 'crabstick'],
  sesame: ['sesame', 'tahini'],
  mustard: ['mustard'],
};

export const ALLERGY_DEFINITELY_FOUND: Record<string, boolean> = Object.fromEntries(
  Object.keys(ALLERGEN_PATTERNS).map(k => [k, true])
) as Record<string, boolean>;

export const ALLERGY_LABELS: Record<string, string> = {
  nuts: 'Tree nuts / peanuts',
  dairy: 'Dairy / milk',
  egg: 'Egg',
  gluten: 'Gluten / wheat',
  soy: 'Soy',
  fish: 'Fish',
  shellfish: 'Shellfish',
  sesame: 'Sesame',
  mustard: 'Mustard',
};

/**
 * Map any user-facing allergen phrase to its canonical token.
 */
export function normalizeAllergen(label: string): string | null {
  const generic = label.trim().toLowerCase();
  if (generic === '') return null;
  for (const [canonical, re] of Object.entries(ALLERGEN_PATTERNS)) {
    if (re.test(generic)) return canonical;
  }
  const l = generic.replace(/[^a-z]/g, '');
  if (l === 'peanut' || l === 'peanuts' || l === 'groundnut' || l === 'groundnuts') return 'nuts';
  if (l === 'milk' || l === 'lactose' || l === 'dairy') return 'dairy';
  if (l === 'egg' || l === 'eggs') return 'egg';
  if (l === 'wheat') return 'gluten';
  return generic.length <= 24 ? generic : null;
}

/**
 * Allergen issues in an item: declared allergen field + word-boundary scan of
 * the ingredient list. Never invents allergens outside the supported set.
 */
export function itemAllergenTokens(item: MenuItem): Set<string> {
  const tokens = new Set<string>();
  for (const a of item.allergens) {
    const norm = normalizeAllergen(a);
    if (norm) tokens.add(norm);
  }
  const ingredientText = item.ingredients.join(' ').toLowerCase();
  for (const [token, re] of Object.entries(ALLERGEN_PATTERNS)) {
    if (re.test(ingredientText)) tokens.add(token);
  }
  return tokens;
}

export function hasAllergyConflict(item: MenuItem, declaredAllergens: string[]): boolean {
  if (!declaredAllergens.length) return false;
  const itemTokens = itemAllergenTokens(item);
  for (const declared of declaredAllergens) {
    const norm = normalizeAllergen(declared);
    if (!norm) continue;
    if (itemTokens.has(norm)) return true;
  }
  return false;
}

export function allergyFilter(items: MenuItem[], declaredAllergens: string[]): MenuItem[] {
  return items.filter(item => !hasAllergyConflict(item, declaredAllergens));
}

/**
 * How confident are we about an item's allergen profile?
 *  - 'explicit': dataset allocates an allergen list for this item
 *  - 'derived': nothing declared but ingredients reveal an allergen
 *  - 'none-disclosed': nothing declared and nothing derivable from ingredients
 */
export function itemAllergenStatus(item: MenuItem): 'explicit' | 'derived' | 'none-disclosed' {
  if (item.allergens.length > 0) return 'explicit';
  if (itemAllergenTokens(item).size > 0) return 'derived';
  return 'none-disclosed';
}