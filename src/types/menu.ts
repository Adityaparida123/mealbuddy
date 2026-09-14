export type DietType = 'veg' | 'non-veg' | 'vegan' | null;
export type SpiceLevel = 'mild' | 'spicy' | null;

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  ingredients: string[];
  allergens: string[];
  diet: string[];
  dietType: DietType;
  glutenFree: boolean;
  spiceLevel: SpiceLevel;
  prepTime: number | null;
  available: boolean;
  calories: number | null;
  mood: string[];
  tags: string[];
}

export type DietPreference = 'vegetarian' | 'vegan' | 'non-veg' | 'gluten-free' | 'any' | null;