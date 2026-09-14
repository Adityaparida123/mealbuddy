export function formatMoney(price: number): string {
  return `₹${price}`;
}

export function formatTime(min: number | null): string | null {
  if (min === null || min === undefined) return null;
  return `${min} min`;
}

export function toTitleCase(s: string): string {
  return s
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}