import 'dotenv/config';

export function env(name: string, fallback = ''): string {
  const v = process.env[name];
  if (v !== undefined && v !== '') return v;
  return fallback;
}

export function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
}

export const isProd = envBool('NODE_ENV', false);
export const nodeProd = process.env.NODE_ENV === 'production';