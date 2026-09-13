import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { logger, powerSaveBlocker, systemPreferences } from "../platform/electron.js";

import type { ControlSnapshot, ZoneRole } from "../types.js";
import { resolveNativeHelper } from "./native-helper.js";
import { parseKeyboardBacklight } from "./keyboard-backlight.js";
import { ControlValueCache, writeThenCommit } from "./control-value-cache.js";
import {
  dialValueToKeepAwake,
  dialValueToMuted,
  keepAwakeToDialValue,
  mutedToDialValue,
} from "./toggle-mapping.js";

const execFileAsync = promisify(execFile);

const OSA = "/usr/bin/osascript";
const IOREG = "/usr/sbin/ioreg";
const TIMEOUT = 4_000;
const MAX_BUFFER = 256 * 1024;

const volumeCache = new ControlValueCache<number>();
const appearanceCache = new ControlValueCache<"light" | "dark">();
const mutedCache = new ControlValueCache<boolean>();
let brightnessSupported = true;
let keyboardSupported = false;
let keepAwakeBlockerId: number | null = null;

async function runOsascript(source: string): Promise<string> {
  const { stdout } = await execFileAsync(OSA, ["-e", source], {
    timeout: TIMEOUT,
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

async function runBrightness(args: string[], displayId?: number): Promise<string> {
  const bin = resolveNativeHelper("brightness");
  if (!bin) {
    brightnessSupported = false;
    throw new Error("Brightness helper missing — rebuild the app");
  }
  const displayArgs = displayId == null ? args : [...args, String(displayId)];
  const { stdout } = await execFileAsync(bin, displayArgs, {
    timeout: TIMEOUT,
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

export async function isAccessibilityTrusted(prompt = false): Promise<boolean> {
  try {
    return await systemPreferences.isTrustedAccessibilityClient(prompt);
  } catch (error) {
    logger.warn("system-controls", "Accessibility check failed", error);
    return false;
  }
}

export async function getVolume(): Promise<number> {
  const cached = volumeCache.getIfFresh(500);
  if (cached != null) return cached;
  const out = await runOsascript("output volume of (get volume settings)");
  const value = Number.parseInt(out, 10);
  if (Number.isNaN(value)) throw new Error("Could not read volume");
  const normalized = Math.max(0, Math.min(100, value));
  volumeCache.commit(normalized);
  return normalized;
}

export async function setVolume(value: number): Promise<number> {
  const clamped = Math.round(Math.max(0, Math.min(100, value)));
  if (volumeCache.getIfFresh(500) === clamped) return clamped;
  return writeThenCommit(volumeCache, async () => {
    await runOsascript(`set volume output volume ${clamped}`);
    return clamped;
  });
}

export async function getAppearance(): Promise<"light" | "dark"> {
  const cached = appearanceCache.getIfFresh(500);
  if (cached != null) return cached;
  try {
    const out = await runOsascript(
      'tell application "System Events" to tell appearance preferences to get dark mode as string',
    );
    const appearance = out.toLowerCase() === "true" ? "dark" : "light";
    appearanceCache.commit(appearance);
    return appearance;
  } catch {
    return "light";
  }
}

export async function setAppearance(mode: "light" | "dark"): Promise<"light" | "dark"> {
  const trusted = await isAccessibilityTrusted(false);
  if (!trusted) {
    throw new Error("Accessibility permission required to change appearance");
  }
  if (appearanceCache.getIfFresh(500) === mode) return mode;
  const flag = mode === "dark" ? "true" : "false";
  return writeThenCommit(appearanceCache, async () => {
    await runOsascript(
      `tell application "System Events" to tell appearance preferences to set dark mode to ${flag}`,
    );
    return mode;
  });
}

export async function getMuted(): Promise<boolean> {
  const cached = mutedCache.getIfFresh(500);
  if (cached != null) return cached;
  const out = await runOsascript("output muted of (get volume settings)");
  const muted = out.toLowerCase() === "true";
  mutedCache.commit(muted);
  return muted;
}

export async function setMuted(muted: boolean): Promise<boolean> {
  if (mutedCache.getIfFresh(500) === muted) return muted;
  return writeThenCommit(mutedCache, async () => {
    await runOsascript(`set volume output muted ${muted ? "true" : "false"}`);
    return muted;
  });
}

export function getKeepAwake(): boolean {
  return keepAwakeBlockerId != null && powerSaveBlocker.isStarted(keepAwakeBlockerId);
}

export function setKeepAwake(active: boolean): boolean {
  if (active) {
    if (keepAwakeBlockerId != null && powerSaveBlocker.isStarted(keepAwakeBlockerId)) {
      return true;
    }
    keepAwakeBlockerId = powerSaveBlocker.start("prevent-display-sleep");
    return true;
  }
  if (keepAwakeBlockerId != null) {
    powerSaveBlocker.stop(keepAwakeBlockerId);
    keepAwakeBlockerId = null;
  }
  return false;
}

/** Real display brightness via DisplayServices helper (0–100). */
export async function getBrightness(displayId?: number): Promise<number> {
  try {
    const out = await runBrightness(["get"], displayId);
    const value = Number.parseInt(out, 10);
    if (Number.isNaN(value)) throw new Error("bad brightness read");
    brightnessSupported = true;
    return Math.max(0, Math.min(100, value));
  } catch (error) {
    logger.warn("system-controls", "Brightness get failed", error);
    brightnessSupported = false;
    throw error;
  }
}

export async function setBrightness(value: number, displayId?: number): Promise<number> {
  const clamped = Math.round(Math.max(0, Math.min(100, value)));
  try {
    const out = await runBrightness(["set", String(clamped)], displayId);
    const actual = Number.parseInt(out, 10);
    if (Number.isNaN(actual)) throw new Error("bad brightness set");
    brightnessSupported = true;
    return Math.max(0, Math.min(100, actual));
  } catch (error) {
    logger.warn("system-controls", "Brightness set failed", error);
    brightnessSupported = false;
    throw error;
  }
}

async function tapKeyboard(direction: "up" | "down", times: number): Promise<void> {
  const trusted = await isAccessibilityTrusted(false);
  if (!trusted) {
    throw new Error("Accessibility permission required to change keyboard backlight");
  }
  const keyCode = direction === "up" ? 113 : 107;
  const count = Math.max(0, Math.min(16, times));
  if (count === 0) return;
  const script = `
tell application "System Events"
  repeat ${count} times
    key code ${keyCode}
  end repeat
end tell`;
  try {
    await runOsascript(script);
  } catch (error) {
    keyboardSupported = false;
    throw error;
  }
}

export async function getKeyboardBacklight(): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      IOREG,
      ["-r", "-c", "AppleLMUController", "-d", "4"],
      { timeout: TIMEOUT, maxBuffer: MAX_BUFFER },
    );
    const value = parseKeyboardBacklight(stdout);
    if (value == null) throw new Error("Keyboard backlight is not exposed by this Mac");
    keyboardSupported = true;
    return value;
  } catch (error) {
    keyboardSupported = false;
    throw error;
  }
}

export async function setKeyboardBacklight(value: number): Promise<number> {
  const clamped = Math.round(Math.max(0, Math.min(100, value)));
  const current = await getKeyboardBacklight();
  const delta = clamped - current;
  if (delta === 0) return current;
  // Forcing a minimum of one tap made every sub-step drag delta (< half a
  // real hardware step) overshoot by a full step, so the dial would drift
  // away from the actual backlight during a smooth drag. Skip the tap and
  // let the next larger delta cross the threshold instead.
  const taps = Math.round(Math.abs(delta) / 6.25);
  if (taps === 0) return current;
  await tapKeyboard(delta > 0 ? "up" : "down", taps);
  return getKeyboardBacklight();
}

export async function getControlSnapshot(): Promise<ControlSnapshot> {
  const [volume, appearance, accessibilityTrusted, brightness, keyboardBacklight, muted] =
    await Promise.all([
      getVolume().catch(() => 0),
      getAppearance().catch(() => "light" as const),
      isAccessibilityTrusted(false),
      getBrightness().catch(() => -1),
      getKeyboardBacklight().catch(() => -1),
      getMuted().catch(() => false),
    ]);
  return {
    volume,
    brightness: brightness < 0 ? 0 : brightness,
    appearance,
    keyboardBacklight: keyboardBacklight < 0 ? 0 : keyboardBacklight,
    muted,
    keepAwake: getKeepAwake(),
    accessibilityTrusted,
    brightnessSupported: brightness >= 0 && brightnessSupported,
    keyboardSupported: keyboardBacklight >= 0 && keyboardSupported,
  };
}

export async function getValueForRole(role: ZoneRole, displayId?: number): Promise<number> {
  switch (role) {
    case "volume":
      return getVolume();
    case "brightness":
      return getBrightness(displayId);
    case "appearance": {
      const mode = await getAppearance();
      return mode === "dark" ? 100 : 0;
    }
    case "keyboard-backlight":
      return getKeyboardBacklight();
    case "mute":
      return mutedToDialValue(await getMuted());
    case "keep-awake":
      return keepAwakeToDialValue(getKeepAwake());
    default:
      return 0;
  }
}

export async function setValueForRole(
  role: ZoneRole,
  value: number,
  displayId?: number,
): Promise<number> {
  switch (role) {
    case "volume":
      return setVolume(value);
    case "brightness":
      return setBrightness(value, displayId);
    case "appearance": {
      const mode = value >= 50 ? "dark" : "light";
      await setAppearance(mode);
      return mode === "dark" ? 100 : 0;
    }
    case "keyboard-backlight":
      return setKeyboardBacklight(value);
    case "mute": {
      const muted = dialValueToMuted(value);
      await setMuted(muted);
      return mutedToDialValue(muted);
    }
    case "keep-awake": {
      const active = dialValueToKeepAwake(value);
      return keepAwakeToDialValue(setKeepAwake(active));
    }
    default:
      return 0;
  }
}

export async function openAccessibilitySettings(): Promise<void> {
  await execFileAsync(
    OSA,
    ["-e", 'open location "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'],
    { timeout: TIMEOUT, maxBuffer: MAX_BUFFER },
  );
}

export function invalidateControlCaches(): void {
  volumeCache.clear();
  appearanceCache.clear();
  mutedCache.clear();
}
