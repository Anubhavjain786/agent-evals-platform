export const nowIso = (): string => new Date().toISOString();

export function elapsedMs(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  return Date.parse(endIso) - Date.parse(startIso);
}
