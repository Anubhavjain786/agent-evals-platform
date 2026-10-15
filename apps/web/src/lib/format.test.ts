import { describe, expect, it } from 'vitest';
import { sequentialFill, sequentialInk, sequentialStep, seriesColor } from './colors';
import { compact, duration, pct, pp, pValue, signedUsd, usd } from './format';

describe('format', () => {
  it('formats rates and percentage-point differences', () => {
    expect(pct(0.734)).toBe('73.4%');
    expect(pct(null)).toBe('—');
    expect(pp(0.183)).toBe('+18.3 pp');
    expect(pp(-0.05, 0)).toBe('−5 pp');
    expect(pp(0)).toBe('±0.0 pp');
  });

  it('formats money, durations, counts and p-values', () => {
    expect(usd(0)).toBe('$0');
    expect(usd(0.0012)).toBe('$0.0012');
    expect(usd(1.5)).toBe('$1.50');
    expect(signedUsd(-0.25)).toBe('−$0.25');
    expect(duration(850)).toBe('850 ms');
    expect(duration(12_300)).toBe('12.3 s');
    expect(duration(125_000)).toBe('2m 5s');
    expect(compact(60_900)).toBe('60.9K');
    expect(pValue(0.0004)).toBe('< 0.001');
    expect(pValue(0.0312)).toBe('0.031');
  });
});

describe('colors', () => {
  it('assigns series colours by position and wraps at eight', () => {
    expect(seriesColor(0)).toBe('var(--series-1)');
    expect(seriesColor(8)).toBe('var(--series-1)');
  });

  it('maps 0–1 onto the sequential ramp and picks readable ink', () => {
    expect(sequentialStep(0)).toBe(0);
    expect(sequentialStep(1)).toBe(6);
    expect(sequentialStep(null)).toBe(-1);
    expect(sequentialFill(null)).toBe('transparent');
    expect(sequentialInk(1)).toBe('on-dark');
    expect(sequentialInk(0.2)).toBe('on-light');
  });
});
