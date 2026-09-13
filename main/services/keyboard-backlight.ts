const KEYBOARD_BACKLIGHT_MAX = 255;

export function parseKeyboardBacklight(registryOutput: string): number | null {
  const match = registryOutput.match(/"KeyboardBacklightBrightness"\s*=\s*(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (Number.isNaN(value)) return null;
  return Math.round(Math.max(0, Math.min(KEYBOARD_BACKLIGHT_MAX, value)) / KEYBOARD_BACKLIGHT_MAX * 100);
}
