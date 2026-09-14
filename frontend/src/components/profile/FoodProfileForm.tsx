import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../common/ui';
import { ApiError, profileApi, type FoodProfileInput } from '../../services/api';
import { ErrorBanner } from '../common/Status';

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function FoodProfileForm({ onClose }: { onClose: () => void }) {
  const [diet, setDiet] = useState<FoodProfileInput['diet']>(null);
  const [allergens, setAllergens] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    profileApi
      .get()
      .then(res => {
        if (!active) return;
        if (res.profile) {
          setDiet(res.profile.diet);
          setAllergens(res.profile.allergens.join(', '));
          setDislikes(res.profile.dislikes.join(', '));
          setBudget(res.profile.budget != null ? String(res.profile.budget) : '');
        }
      })
      .catch(err => {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await profileApi.upsert({
        diet,
        allergens: parseList(allergens),
        dislikes: parseList(dislikes),
        budget: budget.trim() === '' ? null : Math.max(0, parseInt(budget, 10) || 0),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        Loading preferences…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">🍽️ My food preferences</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Saved on the server — Meal Buddy remembers them for your recommendations.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Diet</label>
          <select
            value={diet ?? ''}
            onChange={e => setDiet((e.target.value || null) as FoodProfileInput['diet'])}
            className={inputCls}
          >
            <option value="">No preference</option>
            <option value="veg">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="non-veg">Non-vegetarian</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Allergies <span className="font-normal text-slate-400">(comma separated)</span>
          </label>
          <input value={allergens} onChange={e => setAllergens(e.target.value)} placeholder="peanut, dairy" className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Disliked ingredients <span className="font-normal text-slate-400">(comma separated)</span>
          </label>
          <input value={dislikes} onChange={e => setDislikes(e.target.value)} placeholder="mushroom, eggplant" className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Daily budget (₹) <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="number"
            min={0}
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="e.g. 150"
            className={inputCls}
          />
        </div>
      </div>

      <ErrorBanner message={error} />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Save size={16} />
          )}
          Save
        </Button>
      </div>
    </form>
  );
}