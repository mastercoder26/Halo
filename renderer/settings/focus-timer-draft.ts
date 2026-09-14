export function parseBoundedInteger(
  draft: string,
  minimum: number,
  maximum: number,
): number | null {
  const normalized = draft.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) return null;
  return value;
}
