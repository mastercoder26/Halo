import {
  ALL_ZONE_ROLES,
  defaultDisplayZones,
  defaultSettings,
  type DisplayZoneSettings,
  type HaloSettings,
  type ZoneRole,
} from "../types.ts";

const KNOWN_ROLES = new Set<ZoneRole>(ALL_ZONE_ROLES);
const RESERVED_RECORD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DISPLAYS = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function sanitizeSettingsWithFallback(raw: unknown, fallback: HaloSettings): HaloSettings {
  const source = isRecord(raw) ? raw : {};
  return {
    version: 1,
    onboardingCompleted:
      typeof source.onboardingCompleted === "boolean"
        ? source.onboardingCompleted
        : fallback.onboardingCompleted,
    displayMode:
      source.displayMode === "all" || source.displayMode === "cursor-display"
        ? source.displayMode
        : fallback.displayMode,
    displays: sanitizeDisplays(source.displays, fallback.displays),
    hotZoneSize: sanitizeBoundedInteger(source.hotZoneSize, fallback.hotZoneSize, 4, 96),
    hotZoneHysteresis: sanitizeBoundedInteger(
      source.hotZoneHysteresis,
      fallback.hotZoneHysteresis,
      0,
      160,
    ),
    insets: sanitizeInsets(source.insets, fallback.insets),
  };
}

/**
 * Returns a complete, safe settings object from persisted or IPC data.
 * Legacy settings are narrowed to the supported cursor-control configuration.
 */
export function sanitizeSettings(raw: unknown, fallback?: HaloSettings): HaloSettings {
  const defaults = defaultSettings();
  const safeFallback = fallback ? sanitizeSettingsWithFallback(fallback, defaults) : defaults;
  return sanitizeSettingsWithFallback(raw, safeFallback);
}
