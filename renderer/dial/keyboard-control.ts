const MIN_CONTROL_VALUE = 0;
const MAX_CONTROL_VALUE = 100;

const KEY_DELTAS: Readonly<Record<string, number>> = {
  ArrowRight: 2,
  ArrowUp: 2,
  ArrowLeft: -2,
  ArrowDown: -2,
  PageUp: 10,
  PageDown: -10,
};

function clampControlValue(value: number): number {
  return Math.max(MIN_CONTROL_VALUE, Math.min(MAX_CONTROL_VALUE, value));
}

export function keyboardControlValue(currentValue: number, key: string): number | null {
  if (key === "Home") return MIN_CONTROL_VALUE;
  if (key === "End") return MAX_CONTROL_VALUE;

  const delta = KEY_DELTAS[key];
  return delta === undefined ? null : clampControlValue(currentValue + delta);
}
