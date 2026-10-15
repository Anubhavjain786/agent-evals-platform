const isNum = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 0.734 → "73.4%" */
export function pct(value: number | null | undefined, digits = 1): string {
  return isNum(value) ? `${(value * 100).toFixed(digits)}%` : '—';
}

/** 0.183 → "+18.3 pp" (percentage points, for differences of rates) */
export function pp(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value * 100).toFixed(digits)} pp`;
}

export function usd(value: number | null | undefined): string {
  if (!isNum(value)) return '—';
  if (value === 0) return '$0';
  if (Math.abs(value) < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function signedUsd(value: number | null | undefined): string {
  if (!isNum(value)) return '—';
  return `${value >= 0 ? '+' : '−'}${usd(Math.abs(value))}`;
}

export function duration(ms: number | null | undefined): string {
  if (!isNum(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function signedDuration(ms: number | null | undefined): string {
  if (!isNum(ms)) return '—';
  return `${ms >= 0 ? '+' : '−'}${duration(Math.abs(ms))}`;
}

export function compact(value: number | null | undefined): string {
  if (!isNum(value)) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function pValue(p: number | null | undefined): string {
  if (!isNum(p)) return '—';
  return p < 0.001 ? '< 0.001' : p.toFixed(3);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(-Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
