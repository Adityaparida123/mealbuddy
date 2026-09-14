import { Pencil, Trash2 } from 'lucide-react';
import type { MenuItem } from '../../../../shared/src/types/menu';
import { formatMoney, formatTime } from '../../utils/format';
import { Badge } from '../common/ui';

export function AvailabilityToggle({
  available,
  onToggle,
}: {
  available: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
        available
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-red-100 text-red-600 hover:bg-red-200'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${available ? 'bg-green-500' : 'bg-red-500'}`} />
      {available ? 'Available' : 'Sold Out'}
    </button>
  );
}

export function MenuCard({
  item,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900">{item.name}</h3>
          <p className="text-xs text-slate-500">{item.category}</p>
        </div>
        <p className="text-lg font-extrabold text-orange-600">{formatMoney(item.price)}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.dietType === 'veg' && <Badge tone="green">Veg</Badge>}
        {item.dietType === 'vegan' && <Badge tone="green">Vegan</Badge>}
        {item.dietType === 'non-veg' && <Badge tone="red">Non-veg</Badge>}
        {item.glutenFree && <Badge tone="blue">Gluten-free</Badge>}
        {item.spiceLevel === 'spicy' && <Badge tone="orange">Spicy</Badge>}
        {item.prepTime != null && <Badge tone="neutral">{formatTime(item.prepTime)}</Badge>}
        {item.calories != null && <Badge tone="neutral">{item.calories} kcal</Badge>}
      </div>

      {item.ingredients.length > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-semibold">Ingredients:</span> {item.ingredients.join(', ')}
        </p>
      )}
      {item.allergens.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-semibold">Allergens:</span>{' '}
          {item.allergens.map(a => a[0].toUpperCase() + a.slice(1)).join(', ')}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <AvailabilityToggle available={item.available} onToggle={() => onToggle(item.id)} />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(item)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}