import { useState } from 'react';
import type { MenuItem } from '../../../../shared/src/types/menu';
import { Button } from '../common/ui';
import { X } from 'lucide-react';

export function MenuForm({
  item,
  onSave,
  onCancel,
}: {
  item: MenuItem | null;
  onSave: (item: MenuItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [prepTime, setPrepTime] = useState(item?.prepTime != null ? String(item.prepTime) : '');
  const [calories, setCalories] = useState(item?.calories != null ? String(item.calories) : '');
  const [ingredients, setIngredients] = useState(item?.ingredients.join(', ') ?? '');
  const [allergens, setAllergens] = useState(item?.allergens.join(', ') ?? '');
  const [dietType, setDietType] = useState(item?.dietType ?? '');
  const [available, setAvailable] = useState(item?.available ?? true);

  const splitList = (raw: string) =>
    raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.toLowerCase());

  const handleSubmit = () => {
    if (!name.trim()) return;

    const dietTypeVal = (dietType || 'veg') as MenuItem['dietType'];
    const diet: string[] = [];
    if (dietTypeVal === 'veg') diet.push('veg');
    if (dietTypeVal === 'vegan') diet.push('vegan', 'gluten-free');
    if (dietTypeVal === 'non-veg') diet.push('non-veg');

    const newItem: MenuItem = {
      id: item?.id ?? `I${Date.now()}`,
      name: name.trim(),
      category: category.trim() || 'Snack',
      price: Math.max(0, parseInt(price || '0', 10) || 0),
      ingredients: splitList(ingredients),
      allergens: splitList(allergens),
      diet,
      dietType: dietTypeVal,
      glutenFree: dietTypeVal === 'vegan' || splitList(String(dietType))[0] === 'gluten-free',
      spiceLevel: null,
      prepTime: prepTime.trim() !== '' ? parseInt(prepTime, 10) : null,
      available,
      calories: calories.trim() !== '' && !isNaN(parseInt(calories, 10)) ? parseInt(calories, 10) : null,
      mood: [],
      tags: [dietTypeVal ?? 'veg', category.trim().toLowerCase() || 'snack'],
    };
    onSave(newItem);
  };

  const label = 'mb-1 block text-xs font-semibold text-slate-600';
  const input =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{item ? 'Edit item' : 'Add new item'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={label}>Name *</span>
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Paneer Roll" />
        </label>
        <label>
          <span className={label}>Category</span>
          <input className={input} value={category} onChange={e => setCategory(e.target.value)} placeholder="Snack" />
        </label>
        <label>
          <span className={label}>Price (₹) *</span>
          <input className={input} type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="45" />
        </label>
        <label>
          <span className={label}>Prep time (min)</span>
          <input className={input} type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="8" />
        </label>
        <label>
          <span className={label}>Calories</span>
          <input className={input} type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="380" />
        </label>
        <label className="sm:col-span-2">
          <span className={label}>Ingredients (comma separated)</span>
          <input className={input} value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="paneer, roti, veggies" />
        </label>
        <label className="sm:col-span-2">
          <span className={label}>Allergens (comma separated)</span>
          <input className={input} value={allergens} onChange={e => setAllergens(e.target.value)} placeholder="dairy, gluten" />
        </label>

        <label>
          <span className={label}>Diet type</span>
          <select className={input} value={dietType} onChange={e => setDietType(e.target.value)}>
            <option value="">— select —</option>
            <option value="veg">Veg</option>
            <option value="vegan">Vegan</option>
            <option value="non-veg">Non-veg</option>
          </select>
        </label>
        <label>
          <span className={label}>Availability</span>
          <select className={input} value={available ? 'available' : 'sold-out'} onChange={e => setAvailable(e.target.value === 'available')}>
            <option value="available">Available</option>
            <option value="sold-out">Sold Out</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!name.trim() || !price.trim()}>
          {item ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </div>
  );
}