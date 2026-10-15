/**
 * Config identity colours: the validated categorical order, assigned by the
 * config's position in the experiment (never by rank), so a filter never
 * repaints a config.
 */
export const MAX_SERIES = 8;

export function seriesColor(index: number): string {
  return `var(--series-${(index % MAX_SERIES) + 1})`;
}

/** Single-hue sequential ramp step (0–6) for a 0–1 value such as a pass rate. */
export function sequentialStep(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return -1;
  return Math.min(6, Math.round(value * 6));
}

export function sequentialFill(value: number | null): string {
  const step = sequentialStep(value);
  return step < 0 ? 'transparent' : `var(--seq-${step})`;
}

/** Dark cells get light text and vice versa (steps ≥ 4 are dark in light mode, light in dark mode). */
export function sequentialInk(value: number | null): 'on-dark' | 'on-light' {
  return sequentialStep(value) >= 4 ? 'on-dark' : 'on-light';
}
