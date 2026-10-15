import { createHash } from 'node:crypto';

/** JSON.stringify with sorted object keys, so equal values always serialise identically. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return val;
  });
}

/** Short content hash used as a definition version. */
export function contentVersion(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 12);
}
