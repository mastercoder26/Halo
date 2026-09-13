import { logger, screen, type Display, type Point } from "../platform/electron.js";

import { pointInDialRegion, pointInEdgeControlRegion } from "./dial-interaction-region.js";
import { displaysForMode } from "./display-selection.js";
import { readBypassChordHeld } from "./hot-zone-bypass.js";
import { settingsStore } from "./settings-store.js";
import { getDialSize } from "../windows/dial-overlay.js";
import { EDGE_CONTROL_LENGTH, EDGE_CONTROL_THICKNESS } from "../windows/edge-control-overlay.js";
import {
  CORNER_IDS,
  EDGE_IDS,
  defaultDisplayZones,
  isCorner,
  isEdge,
  type CornerId,
  type EdgeId,
  type HaloSettings,
  type ZoneId,
  type ZoneRole,
} from "../types.js";

export interface HotHit {
  display: Display;
  zone: ZoneId;
  role: ZoneRole;
}

type HitListener = (hit: HotHit | null) => void;
type BypassListener = (held: boolean) => void;

function pointInRect(point: Point, x: number, y: number, width: number, height: number): boolean {
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

function cornerRect(
  display: Display,
  corner: CornerId,
  zonePx: number,
): { x: number; y: number; width: number; height: number } {
  const { bounds } = display;
  const size = Math.max(48, zonePx * 5);
  switch (corner) {
    case "top-left":
      return { x: bounds.x, y: bounds.y, width: size, height: size };
    case "top-right":
      return { x: bounds.x + bounds.width - size, y: bounds.y, width: size, height: size };
    case "bottom-left":
      return { x: bounds.x, y: bounds.y + bounds.height - size, width: size, height: size };
    case "bottom-right":
      return {
        x: bounds.x + bounds.width - size,
        y: bounds.y + bounds.height - size,
        width: size,
        height: size,
      };
  }
}

function edgeStrip(
  display: Display,
  edge: EdgeId,
  thickness: number,
  insets: HaloSettings["insets"],
): { x: number; y: number; width: number; height: number } {
  const { bounds } = display;
  const topInset = Math.min(bounds.height, insets.menuBar + insets.notch);
  const bottomInset = Math.min(Math.max(0, bounds.height - topInset), insets.dock);
  const sideHeight = Math.max(0, bounds.height - topInset - bottomInset);
  const safeThickness = Math.max(6, thickness);
  switch (edge) {
    case "left":
      return {
        x: bounds.x,
        y: bounds.y + topInset,
        width: safeThickness,
        height: sideHeight,
      };
    case "right":
      return {
        x: bounds.x + bounds.width - safeThickness,
        y: bounds.y + topInset,
        width: safeThickness,
        height: sideHeight,
      };
    case "top":
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: safeThickness };
    case "bottom":
      return {
        x: bounds.x,
        y: bounds.y + bounds.height - safeThickness,
        width: bounds.width,
        height: safeThickness,
      };
  }
}

class EdgeWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<HitListener>();
  private bypassListeners = new Set<BypassListener>();
  private current: HotHit | null = null;
  private settings: HaloSettings | null = null;
  private allDisplays: Display[] | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private paused = false;
  private bypassHeld = false;
  private bypassCheckInFlight = false;
  private ticking = false;

  start(intervalMs = 32): void {
    if (this.timer) return;
    void settingsStore.load().then((settings) => {
      this.settings = settings;
    });
    this.unsubscribeSettings = settingsStore.onChange((settings) => {
      this.settings = settings;
    });
    this.timer = setInterval(() => this.tick(), intervalMs);
    logger.info("edge-watcher", "Started");
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    this.emit(null);
  }

  pause(): void {
    this.paused = true;
    this.emit(null);
  }

  resume(): void {
    this.paused = false;
  }

  getCurrent(): HotHit | null {
    return this.current;
  }

  invalidateDisplayCache(): void {
    this.allDisplays = null;
  }

  onHit(listener: HitListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onBypassChange(listener: BypassListener): () => void {
    this.bypassListeners.add(listener);
    return () => this.bypassListeners.delete(listener);
  }

  private emit(hit: HotHit | null): void {
    const unchanged =
      hit?.display.id === this.current?.display.id &&
      hit?.zone === this.current?.zone &&
      hit?.role === this.current?.role;
    if (unchanged) return;
    this.current = hit;
    for (const listener of this.listeners) listener(hit);
  }

  private refreshBypassChord(): void {
    if (this.bypassCheckInFlight) return;
    this.bypassCheckInFlight = true;
    void readBypassChordHeld()
      .then((held) => {
        if (held === this.bypassHeld) return;
        this.bypassHeld = held;
        if (held) this.emit(null);
        for (const listener of this.bypassListeners) listener(held);
      })
      .finally(() => {
        this.bypassCheckInFlight = false;
      });
  }

  private tick(): void {
    this.refreshBypassChord();
    if (this.paused || this.bypassHeld || this.ticking || !this.settings) return;

    this.ticking = true;
    try {
      const point = screen.getCursorScreenPoint();
      const cursorDisplay = screen.getDisplayNearestPoint(point);
      const displays = displaysForMode(
        this.settings.displayMode,
        this.settings.displayMode === "all" ? this.getAllDisplays() : [cursorDisplay],
        cursorDisplay,
      );

      for (const display of displays) {
        const zones = this.settings.displays[String(display.id)] ?? defaultDisplayZones();
        if (!zones.enabled) continue;
        const hit = this.resolveHit(point, display, zones, this.settings);
        if (hit) {
          this.emit(hit);
          return;
        }
      }
      this.emit(null);
    } catch (error) {
      logger.debug("edge-watcher", "Tick failed", error);
    } finally {
      this.ticking = false;
    }
  }

  private resolveHit(
    point: Point,
    display: Display,
    zones: ReturnType<typeof defaultDisplayZones>,
    settings: HaloSettings,
  ): HotHit | null {
    if (this.current?.display.id === display.id && this.current.role !== "off") {
      const { zone, role } = this.current;
      if (isCorner(zone) && pointInDialRegion(point, display.bounds, zone, getDialSize())) {
        return { display, zone, role };
      }
      if (
        isEdge(zone) &&
        pointInEdgeControlRegion(point, display.bounds, zone, EDGE_CONTROL_LENGTH, EDGE_CONTROL_THICKNESS)
      ) {
        return { display, zone, role };
      }
    }

    for (const corner of CORNER_IDS) {
      const role = zones.corners[corner];
      if (role === "off") continue;
      const rect = cornerRect(display, corner, settings.hotZoneSize);
      const padding = this.current?.zone === corner ? settings.hotZoneHysteresis : 0;
      if (
        pointInRect(
          point,
          rect.x - padding,
          rect.y - padding,
          rect.width + padding * 2,
          rect.height + padding * 2,
        )
      ) {
        return { display, zone: corner, role };
      }
    }

    for (const edge of EDGE_IDS) {
      const role = zones.edges[edge];
      if (role === "off") continue;
      const rect = edgeStrip(display, edge, settings.hotZoneSize, settings.insets);
      const padding = this.current?.zone === edge ? settings.hotZoneHysteresis : 0;
      if (
        pointInRect(
          point,
          rect.x - padding,
          rect.y - padding,
          rect.width + padding * 2,
          rect.height + padding * 2,
        )
      ) {
        return { display, zone: edge, role };
      }
    }

    return null;
  }

  private getAllDisplays(): Display[] {
    if (!this.allDisplays) this.allDisplays = screen.getAllDisplays();
    return this.allDisplays;
  }
}

export const edgeWatcher = new EdgeWatcher();
