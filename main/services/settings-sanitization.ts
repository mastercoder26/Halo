import * as path from "node:path";

import {
  ALL_ZONE_ROLES,
  defaultDisplayZones,
  defaultSettings,
  type DisplayZoneSettings,
  type FeedbackSettings,
  type FocusTimerSettings,
  type HaloSettings,
  type ZoneRole,
} from "../types.ts";
import { sanitizeFocusTimerSettings } from "./focus-timer-settings.ts";

const KNOWN_ROLES = new Set<ZoneRole>(ALL_ZONE_ROLES);
const RESERVED_RECORD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DOCK_APPS = 8;
const MAX_DISPLAYS = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || normalized.includes("\0")) return null;
  return normalized;
}

function sanitizeBoundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function sanitizeAppPath(value: unknown): string | null {
  const appPath = sanitizeText(value, 1024);
  if (!appPath || !appPath.endsWith(".app") || !path.isAbsolute(appPath)) return null;
  const resolved = path.resolve(appPath);
  return resolved.endsWith(".app") ? resolved : null;
}

function sanitizeAppPaths(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];

  const apps: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const appPath = sanitizeAppPath(entry);
    if (!appPath || seen.has(appPath)) continue;
    seen.add(appPath);
    apps.push(appPath);
    if (apps.length === MAX_DOCK_APPS) break;
  }
  return apps;
}

function sanitizeRole(value: unknown, fallback: ZoneRole): ZoneRole {
  return typeof value === "string" && KNOWN_ROLES.has(value as ZoneRole)
    ? (value as ZoneRole)
    : fallback;
}

function sanitizeZones(value: unknown, fallback: DisplayZoneSettings): DisplayZoneSettings {
  if (!isRecord(value)) {
    return {
      enabled: fallback.enabled,
      corners: { ...fallback.corners },
      edges: { ...fallback.edges },
    };
  }

  const corners = isRecord(value.corners) ? value.corners : {};
  const edges = isRecord(value.edges) ? value.edges : {};
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    corners: {
      "top-left": sanitizeRole(corners["top-left"], fallback.corners["top-left"]),
      "top-right": sanitizeRole(corners["top-right"], fallback.corners["top-right"]),
      "bottom-left": sanitizeRole(corners["bottom-left"], fallback.corners["bottom-left"]),
      "bottom-right": sanitizeRole(corners["bottom-right"], fallback.corners["bottom-right"]),
    },
    edges: {
      left: sanitizeRole(edges.left, fallback.edges.left),
      right: sanitizeRole(edges.right, fallback.edges.right),
      top: sanitizeRole(edges.top, fallback.edges.top),
      bottom: sanitizeRole(edges.bottom, fallback.edges.bottom),
    },
  };
}

function isSafeRecordKey(value: string): boolean {
  return !RESERVED_RECORD_KEYS.has(value) && value.length > 0 && value.length <= 128 && !value.includes("\0");
}

function sanitizeDisplays(
  value: unknown,
  fallback: HaloSettings["displays"],
): HaloSettings["displays"] {
  if (!isRecord(value)) return { ...fallback };

  const displays: HaloSettings["displays"] = {};
  for (const [rawKey, zones] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!isSafeRecordKey(key) || !isRecord(zones)) continue;
    displays[key] = sanitizeZones(zones, fallback[key] ?? defaultDisplayZones());
    if (Object.keys(displays).length === MAX_DISPLAYS) break;
  }
  return displays;
}

function sanitizeFeedback(value: unknown, fallback: FeedbackSettings): FeedbackSettings {
  if (!isRecord(value)) return { ...fallback };
  return {
    haptics: typeof value.haptics === "boolean" ? value.haptics : fallback.haptics,
    sound: typeof value.sound === "boolean" ? value.sound : fallback.sound,
  };
}

function sanitizeInsets(
  value: unknown,
  fallback: HaloSettings["insets"],
): HaloSettings["insets"] {
  if (!isRecord(value)) return { ...fallback };
  return {
    menuBar: sanitizeBoundedInteger(value.menuBar, fallback.menuBar, 0, 256),
    dock: sanitizeBoundedInteger(value.dock, fallback.dock, 0, 256),
    notch: sanitizeBoundedInteger(value.notch, fallback.notch, 0, 256),
  };
}

function isNumericFocusTimerValue(value: unknown): boolean {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
  );
}

function sanitizeFocusTimer(
  value: unknown,
  fallback: FocusTimerSettings,
): FocusTimerSettings {
  if (!isRecord(value)) return { ...fallback };
  return sanitizeFocusTimerSettings({
    focusMinutes: isNumericFocusTimerValue(value.focusMinutes)
      ? value.focusMinutes
      : fallback.focusMinutes,
    shortBreakMinutes: isNumericFocusTimerValue(value.shortBreakMinutes)
      ? value.shortBreakMinutes
      : fallback.shortBreakMinutes,
    longBreakMinutes: isNumericFocusTimerValue(value.longBreakMinutes)
      ? value.longBreakMinutes
      : fallback.longBreakMinutes,
    cyclesBeforeLongBreak: isNumericFocusTimerValue(value.cyclesBeforeLongBreak)
      ? value.cyclesBeforeLongBreak
      : fallback.cyclesBeforeLongBreak,
  });
}

function sanitizeSettingsWithFallback(raw: unknown, fallback: HaloSettings): HaloSettings {
  const source = isRecord(raw) ? raw : {};
  return {
    version: 1,
    displayMode:
      source.displayMode === "all" || source.displayMode === "cursor-display"
        ? source.displayMode
        : fallback.displayMode,
    displays: sanitizeDisplays(source.displays, fallback.displays),
    dockApps: sanitizeAppPaths(source.dockApps, fallback.dockApps),
    feedback: sanitizeFeedback(source.feedback, fallback.feedback),
    hotZoneSize: sanitizeBoundedInteger(source.hotZoneSize, fallback.hotZoneSize, 4, 96),
    hotZoneHysteresis: sanitizeBoundedInteger(
      source.hotZoneHysteresis,
      fallback.hotZoneHysteresis,
      0,
      160,
    ),
    insets: sanitizeInsets(source.insets, fallback.insets),
    hasCompletedOnboarding:
      typeof source.hasCompletedOnboarding === "boolean"
        ? source.hasCompletedOnboarding
        : typeof source.onboardingCompleted === "boolean"
          ? source.onboardingCompleted
        : fallback.hasCompletedOnboarding,
    focusTimer: sanitizeFocusTimer(source.focusTimer, fallback.focusTimer),
  };
}

/**
 * Returns a complete, safe settings object from persisted, imported, or IPC data.
 * A fallback keeps a valid in-memory value when a partial update is malformed.
 */
export function sanitizeSettings(raw: unknown, fallback?: HaloSettings): HaloSettings {
  const defaults = defaultSettings();
  const safeFallback = fallback
    ? sanitizeSettingsWithFallback(fallback, defaults)
    : {
        ...defaults,
        // Existing installs without the flag skip the onboarding tour.
        hasCompletedOnboarding: true,
      };
  return sanitizeSettingsWithFallback(raw, safeFallback);
}
