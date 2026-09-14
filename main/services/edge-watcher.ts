import { logger, screen, type Display, type Point } from "../platform/electron.js";

import { pointInDialRegion, pointInEdgeControlRegion } from "./dial-interaction-region.js";
import { pointInDockRegion } from "./dock-interaction-region.js";
import { displaysForMode } from "./display-selection.js";
import { readBypassChordHeld } from "./hot-zone-bypass.js";
import { settingsStore } from "./settings-store.js";
import { getDialSize } from "../windows/dial-overlay.js";
import { getDockWindow } from "../windows/dock-overlay.js";
import { EDGE_CONTROL_LENGTH, EDGE_CONTROL_THICKNESS } from "../windows/edge-control-overlay.js";
import {
  CORNER_IDS,
  EDGE_IDS,
  defaultDisplayZones,
  isCorner,
  isDialRole,
  isEdge,
  isHudRole,
  type CornerId,
  type EdgeId,
  type HaloSettings,
  type ZoneId,
  type ZoneRole,
} from "../types.js";
import { getFocusTimerWindow } from "../windows/focus-timer-overlay.js";
import type { OnboardingTarget } from "./onboarding-tour.js";

function getHudWindow(role: ZoneRole, displayId: number, zone: ZoneId) {
  if (role === "focus-timer") return getFocusTimerWindow(displayId, zone);
  return null;
}

export interface HotHit {
  display: Display;
  zone: ZoneId;
  role: ZoneRole;
}

type HitListener = (hit: HotHit | null) => void;
type BypassListener = (held: boolean) => void;

function pointInRect(p: Point, x: number, y: number, w: number, h: number): boolean {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

/** True screen-corner hit targets (flush to display bounds — matches dial placement). */
function cornerRect(
  display: Display,
  corner: CornerId,
  zonePx: number,
): { x: number; y: number; w: number; h: number } {
  const { bounds } = display;
  const size = Math.max(48, zonePx * 5);
  switch (corner) {
    case "top-left":
      return { x: bounds.x, y: bounds.y, w: size, h: size };
    case "top-right":
      return { x: bounds.x + bounds.width - size, y: bounds.y, w: size, h: size };
    case "bottom-left":
      return {
        x: bounds.x,
        y: bounds.y + bounds.height - size,
        w: size,
        h: size,
      };
    case "bottom-right":
      return {
        x: bounds.x + bounds.width - size,
        y: bounds.y + bounds.height - size,
        w: size,
        h: size,
      };
  }
}

function edgeStrip(
  display: Display,
  edge: EdgeId,
  thickness: number,
  insets: HaloSettings["insets"],
): { x: number; y: number; w: number; h: number } {
  const { bounds } = display;
  const topInset = insets.menuBar + insets.notch;
  const t = Math.max(6, thickness);
  switch (edge) {
    case "left":
      return {
        x: bounds.x,
        y: bounds.y + topInset,
        w: t,
        h: bounds.height - topInset - insets.dock,
      };
    case "right":
      return {
        x: bounds.x + bounds.width - t,
        y: bounds.y + topInset,
        w: t,
        h: bounds.height - topInset - insets.dock,
      };
    case "top":
      return { x: bounds.x, y: bounds.y, w: bounds.width, h: t };
    case "bottom":
      return {
        x: bounds.x,
        y: bounds.y + bounds.height - t,
        w: bounds.width,
        h: t,
      };
  }
}

class EdgeWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<HitListener>();
  private current: HotHit | null = null;
  private pending: HotHit | null = null;
  private pendingSince = 0;
  private paused = false;
  private onboardingTarget: OnboardingTarget | null = null;
  /** Hold ⌘⇧E — temporarily ignore hot zones (see hot-zone-bypass.ts). */
  private bypassHeld = false;
  private bypassCheckInFlight = false;
  private bypassListeners = new Set<BypassListener>();
  // React on the next cursor poll; hot zones should feel immediate.
  private readonly dwellMs = 0;
  private readonly dockHideDelayMs = 240;
  private leaveSince: number | null = null;
  private settings: HaloSettings | null = null;
  private allDisplays: Display[] | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private ticking = false;

  start(intervalMs = 32): void {
    if (this.timer) return;
    void settingsStore.load().then((s) => {
      this.settings = s;
    });
    this.unsubscribeSettings = settingsStore.onChange((s) => {
      this.settings = s;
    });
    this.timer = setInterval(() => this.tickSync(), intervalMs);
    logger.info("edge-watcher", "Started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
  }

  pause(): void {
    this.paused = true;
    this.clearHit();
  }

  resume(): void {
    this.paused = false;
  }

  setOnboardingTarget(target: OnboardingTarget | null): void {
    this.onboardingTarget = target;
    this.clearHit();
  }

  isBypassed(): boolean {
    return this.bypassHeld || this.paused;
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

  private clearHit(): void {
    this.pending = null;
    this.leaveSince = null;
    if (this.current) this.emit(null);
  }

  private refreshBypassChord(): void {
    if (this.bypassCheckInFlight) return;
    this.bypassCheckInFlight = true;
    void readBypassChordHeld()
      .then((held) => {
        if (held === this.bypassHeld) return;
        this.bypassHeld = held;
        if (held) this.clearHit();
        for (const listener of this.bypassListeners) listener(held);
      })
      .finally(() => {
        this.bypassCheckInFlight = false;
      });
  }

  private emit(hit: HotHit | null): void {
    this.current = hit;
    for (const listener of this.listeners) listener(hit);
  }

  /** Synchronous hot-path — no awaits per frame. */
  private tickSync(): void {
    this.refreshBypassChord();
    if (this.paused || this.bypassHeld || this.ticking) return;
    this.ticking = true;
    try {
      const settings = this.settings;
      if (!settings) return;

      const point = screen.getCursorScreenPoint();
      const cursorDisplay = screen.getDisplayNearestPoint(point);
      const target = this.onboardingTarget;
      const displays = target
        ? this.getAllDisplays().filter((display) => display.id === target.displayId)
        : displaysForMode(
            settings.displayMode,
            settings.displayMode === "all" ? this.getAllDisplays() : [cursorDisplay],
            cursorDisplay,
          );

      let hit: HotHit | null = null;
      for (const display of displays) {
        const zones = settings.displays[String(display.id)] ?? defaultDisplayZones();
        if (!zones.enabled) continue;
        const roleOverrides: Partial<Record<ZoneId, ZoneRole>> = target
          ? { [target.zone]: target.role }
          : {};
        hit = this.resolveHit(point, display, zones, roleOverrides, settings);
        if (
          hit &&
          target &&
          (hit.display.id !== target.displayId || hit.zone !== target.zone || hit.role !== target.role)
        ) {
          hit = null;
        }
        if (hit) break;
      }

      if (hit) {
        this.leaveSince = null;
        if (
          this.current &&
          this.current.display.id === hit.display.id &&
          this.current.zone === hit.zone &&
          this.current.role === hit.role
        ) {
          return;
        }
        if (
          !this.pending ||
          this.pending.display.id !== hit.display.id ||
          this.pending.zone !== hit.zone
        ) {
          this.pending = hit;
          this.pendingSince = Date.now();
          return;
        }
        if (Date.now() - this.pendingSince >= this.dwellMs) {
          this.emit(hit);
          this.pending = null;
        }
      } else {
        this.handleMiss();
      }
    } catch (error) {
      logger.debug("edge-watcher", "Tick failed", error);
    } finally {
      this.ticking = false;
    }
  }

  private handleMiss(): void {
    this.pending = null;
    if (!this.current) return;
    if (isDialRole(this.current.role)) {
      this.emit(null);
      return;
    }
    if (this.leaveSince == null) this.leaveSince = Date.now();
    if (Date.now() - this.leaveSince >= this.dockHideDelayMs) {
      this.leaveSince = null;
      this.emit(null);
    }
  }

  private resolveHit(
    point: Point,
    display: Display,
    zones: ReturnType<typeof defaultDisplayZones>,
    overrides: Partial<Record<ZoneId, ZoneRole>>,
    settings: HaloSettings,
  ): HotHit | null {
    const size = settings.hotZoneSize;

    if (this.current?.role === "dock" && this.current.display.id === display.id) {
      const dock = getDockWindow(display.id, this.current.zone);
      if (dock && pointInDockRegion(point, dock.getBounds())) {
        return { display, zone: this.current.zone, role: "dock" };
      }
    }

    if (this.current && isHudRole(this.current.role) && this.current.display.id === display.id) {
      const hud = getHudWindow(this.current.role, display.id, this.current.zone);
      if (hud && pointInDockRegion(point, hud.getBounds())) {
        return { display, zone: this.current.zone, role: this.current.role };
      }
    }

    if (this.current && this.current.display.id === display.id && isDialRole(this.current.role)) {
      const zone = this.current.zone;
      if (isCorner(zone) && pointInDialRegion(point, display.bounds, zone, getDialSize())) {
        return { display, zone, role: this.current.role };
      }
      if (
        isEdge(zone) &&
        pointInEdgeControlRegion(point, display.bounds, zone, EDGE_CONTROL_LENGTH, EDGE_CONTROL_THICKNESS)
      ) {
        return { display, zone, role: this.current.role };
      }
    }

    for (const corner of CORNER_IDS) {
      const role = overrides[corner] ?? zones.corners[corner];
      if (role === "off") continue;
      const rect = cornerRect(display, corner, size);
      const pad = this.current?.zone === corner && isDialRole(role)
        ? 0
        : this.current?.zone === corner
          ? settings.hotZoneHysteresis
          : 0;
      if (pointInRect(point, rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2)) {
        return { display, zone: corner, role };
      }
    }

    for (const edge of EDGE_IDS) {
      const role = overrides[edge] ?? zones.edges[edge];
      if (role === "off") continue;
      const rect = edgeStrip(display, edge, size, settings.insets);
      const pad = this.current?.zone === edge ? settings.hotZoneHysteresis : 0;
      if (pointInRect(point, rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2)) {
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

export { isCorner, isDialRole };
