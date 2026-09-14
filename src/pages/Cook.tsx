import { useState } from 'react';
import { ArrowLeft, Plus, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { useMenu } from '../hooks/useMenu';
import type { MenuItem } from '../types/menu';
import { MenuCard } from '../components/menu/MenuCard';
import { MenuForm } from '../components/menu/MenuForm';
import { Badge, Button } from '../components/common/ui';

export default function Cook({ onBack }: { onBack: () => void }) {
  const {
    menu,
    filteredMenu,
    search,
    setSearch,
    addItem,
    updateItem,
    deleteItem,
    toggleAvailability,
    resetMenu,
  } = useMenu();

  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [adding, setAdding] = useState(false);

  const availableCount = menu.filter(m => m.available).length;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">👨‍🍳</span>
              <div>
                <h1 className="text-sm font-extrabold text-slate-900">Canteen Cook Dashboard</h1>
                <p className="text-xs text-slate-500">Manage today's menu — students see changes instantly.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={resetMenu} className="!px-3 !py-1.5 text-xs">
              <RotateCcw size={14} /> Restore dataset menu
            </Button>
            <Button onClick={() => setAdding(true)} className="!px-3 !py-1.5 text-xs">
              <Plus size={14} /> Add item
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{menu.length} items</Badge>
            <Badge tone="green">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {availableCount} available
            </Badge>
            <Badge tone="red">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {menu.length - availableCount} sold out
            </Badge>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {(adding || editing) && (
          <div className="mb-6">
            <MenuForm
              item={editing}
              onSave={item => {
                if (editing) updateItem(item);
                else addItem(item);
                setEditing(null);
                setAdding(false);
              }}
              onCancel={() => {
                setEditing(null);
                setAdding(false);
              }}
            />
          </div>
        )}

        {filteredMenu.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-3xl">🍽️</p>
            <p className="mt-2 font-semibold text-slate-700">No items match "{search}"</p>
            <p className="mt-1 text-sm text-slate-500">Try a different search or add a new item.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenu.map(item => (
              <MenuCard
                key={item.id}
                item={item}
                onEdit={it => {
                  setEditing(it);
                  setAdding(false);
                }}
                onDelete={id => {
                  if (window.confirm('Delete this item from the menu?')) deleteItem(id);
                }}
                onToggle={toggleAvailability}
              />
            ))}
          </div>
        )}

        <div className="mt-8 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-green-600" />
          <p>
            Prices, ingredients, allergens and availability set here are the single source of truth.
            The Student AI assistant will only ever recommend items from this current menu.
          </p>
        </div>
      </div>
    </div>
  );
}