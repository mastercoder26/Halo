import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, WheelEvent } from "react";
import { Coffee, Moon, Pause, Play, SkipBack, SkipForward, Sun, Volume2, VolumeX } from "lucide-react";

import { accentForRole, glowForRole, hexToRgba } from "../role-visuals";
import {
  HALO_AMBER,
  HALO_HAIRLINE,
  HALO_INSET,
  HALO_PLATE_SOFT,
  HALO_SHADOW,
} from "../brand";
import { LatestValueQueue } from "../dial/control-commit-queue";
import {
  controlAccessibleLabel,
  controlRole,
  edgeSliderOrientation,
} from "../dial/control-accessibility";
import { AsyncCommandGate } from "../dial/async-command-gate";
import { keyboardControlValue } from "../dial/keyboard-control";
import { LevelDetentTracker } from "../dial/level-detent";
import { refreshFeedbackSettings, tickLevelFeedback } from "../dial/level-feedback";
import {
  mediaTitle,
  readoutForRole,
  isDialOverlayRole,
  type OverlayMediaMeta,
  type OverlayRole,
} from "../dial/overlay-readout";
import { OverlayValueState, type OverlayChange } from "../dial/overlay-value-state";
import { isMediaRole, isToggleRole, toggleNextValue } from "../dial/role-kind";
import { ScrollingValue } from "../dial/scrolling-value";
import { createWheelAccumulator, resetWheelAccumulator, wheelControlSteps } from "../dial/wheel-control";

type ZoneRole = OverlayRole;
type EdgeId = "left" | "right" | "top" | "bottom";

interface OverlayState {
  zone: string;
  role: ZoneRole;
  displayId: number;
  value: number;
  label: string;
  meta?: OverlayMediaMeta;
}

interface ControlUpdate {
  role: ZoneRole;
  value: number;
  change: OverlayChange;
}

// Flush corners against the screen edge stay square so the bar reads as sliding
// out of the wall instead of a rounded pill floating inside a rectangle.
const WALL_RADIUS = 0;
const OUTER_RADIUS = 26;
const PLATE = HALO_PLATE_SOFT;
const TAP_SLOP = 8;
const TOGGLE_WHEEL_PIXELS = 96;

function parseEdge(): EdgeId {
  const params = new URLSearchParams(window.location.search);
  const edge = params.get("edge");
  return edge === "right" || edge === "top" || edge === "bottom" ? edge : "left";
}

function borderRadiusFor(edge: EdgeId): string {
  switch (edge) {
    case "left":
      return `${WALL_RADIUS}px ${OUTER_RADIUS}px ${OUTER_RADIUS}px ${WALL_RADIUS}px`;
    case "right":
      return `${OUTER_RADIUS}px ${WALL_RADIUS}px ${WALL_RADIUS}px ${OUTER_RADIUS}px`;
    case "top":
      return `${WALL_RADIUS}px ${WALL_RADIUS}px ${OUTER_RADIUS}px ${OUTER_RADIUS}px`;
    case "bottom":
      return `${OUTER_RADIUS}px ${OUTER_RADIUS}px ${WALL_RADIUS}px ${WALL_RADIUS}px`;
  }
}

function ToggleGlyph({
  role,
  on,
  glow,
}: {
  role: ZoneRole | undefined;
  on: boolean;
  glow: string;
}) {
  const className = "size-5 text-white";
  const style = { filter: `drop-shadow(0 0 8px ${glow})` };
  if (role === "keep-awake") {
    return on ? (
      <Coffee className={className} style={style} strokeWidth={2.2} />
    ) : (
      <Moon className={className} style={style} strokeWidth={2.2} />
    );
  }
  if (role === "mute") {
    return on ? (
      <VolumeX className={className} style={style} strokeWidth={2.2} />
    ) : (
      <Volume2 className={className} style={style} strokeWidth={2.2} />
    );
  }
  if (role === "appearance") {
    return on ? (
      <Moon className={className} style={style} strokeWidth={2.2} />
    ) : (
      <Sun className={className} style={style} strokeWidth={2.2} />
    );
  }
  return null;
}

export function EdgeControlView() {
  const edge = useMemo(() => parseEdge(), []);
  const isVertical = edge === "left" || edge === "right";
  const [state, setState] = useState<OverlayState | null>(null);
  const [localValue, setLocalValue] = useState(0);
  const [visible, setVisible] = useState(false);
  const [draggingUi, setDraggingUi] = useState(false);
  const [togglePulse, setTogglePulse] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const dragging = useRef(false);
  const scrubbing = useRef(false);
  const scrubReleaseTimer = useRef<number | null>(null);
  const pointerMode = useRef<"none" | "tap" | "drag">("none");
  const pointerOrigin = useRef({ x: 0, y: 0 });
  const pendingUpdate = useRef<ControlUpdate | null>(null);
  const flushTimer = useRef<number | null>(null);
  const roleRef = useRef<ZoneRole | null>(null);
  const commitQueue = useRef<LatestValueQueue<ControlUpdate> | null>(null);
  const mediaCommandGate = useRef(new AsyncCommandGate());
  const valueState = useRef(new OverlayValueState());
  const detentTracker = useRef(new LevelDetentTracker());
  const wheelAccum = useRef(createWheelAccumulator());

  if (!commitQueue.current) {
    commitQueue.current = new LatestValueQueue(async ({ role, value, change }) => {
      try {
        const result = await window.haloAPI.ipc.invoke<{ value: number }>("halo:setControl", {
          role,
          value,
        });
        if (valueState.current.confirmChange(change, result.value)) {
          setLocalValue(valueState.current.value);
        }
      } catch {
        if (valueState.current.rejectChange(change)) {
          detentTracker.current.sync(valueState.current.value);
          setLocalValue(valueState.current.value);
        }
        setFeedback("Couldn't update — try again");
      }
    });
  }

  const armScrubRelease = useCallback(() => {
    scrubbing.current = true;
    if (scrubReleaseTimer.current != null) window.clearTimeout(scrubReleaseTimer.current);
    scrubReleaseTimer.current = window.setTimeout(() => {
      scrubReleaseTimer.current = null;
      void commitQueue.current?.whenIdle().then(() => {
        if (flushTimer.current == null && !dragging.current) {
          scrubbing.current = false;
        }
      });
    }, 140);
  }, []);

  const releasePointerScrub = useCallback(async () => {
    if (flushTimer.current != null) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
      const update = pendingUpdate.current;
      pendingUpdate.current = null;
      if (update) commitQueue.current?.submit(update);
    }
    await commitQueue.current?.whenIdle();
    scrubbing.current = false;
    dragging.current = false;
    setDraggingUi(false);
  }, []);

  useEffect(() => {
    void refreshFeedbackSettings();
    const unsub = window.haloAPI.ipc.on("halo:overlay-state", (_event, payload) => {
      const next = payload as OverlayState | null;
      if (next && isDialOverlayRole(next.role)) {
        setState(next);
        setFeedback(null);
        setMediaBusy(false);
        roleRef.current = next.role;
        const key = `${next.role}:${next.displayId}:${next.zone}`;
        if (
          !dragging.current &&
          !scrubbing.current &&
          valueState.current.receiveOverlay(key, next.value)
        ) {
          detentTracker.current.sync(valueState.current.value);
          setLocalValue(valueState.current.value);
        }
        setVisible(true);
      } else {
        if (flushTimer.current != null) {
          window.clearTimeout(flushTimer.current);
          flushTimer.current = null;
        }
        if (scrubReleaseTimer.current != null) {
          window.clearTimeout(scrubReleaseTimer.current);
          scrubReleaseTimer.current = null;
        }
        pendingUpdate.current = null;
        pointerMode.current = "none";
        dragging.current = false;
        scrubbing.current = false;
        setDraggingUi(false);
        valueState.current.reset();
        detentTracker.current.reset();
        roleRef.current = null;
        setVisible(false);
        setFeedback(null);
        setMediaBusy(false);
      }
    });
    let cancelled = false;
    void window.haloAPI.ipc.invoke<OverlayState | null>("halo:getOverlayState").then((next) => {
      if (cancelled) return;
      if (next && isDialOverlayRole(next.role)) {
        setState(next);
        roleRef.current = next.role;
        const key = `${next.role}:${next.displayId}:${next.zone}`;
        valueState.current.receiveOverlay(key, next.value, { force: true });
        detentTracker.current.sync(valueState.current.value);
        setLocalValue(valueState.current.value);
        setVisible(true);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const flush = useCallback(() => {
    const update = pendingUpdate.current;
    pendingUpdate.current = null;
    if (!update) return;
    commitQueue.current?.submit(update);
  }, []);

  const scheduleCommit = useCallback(
    (update: ControlUpdate) => {
      pendingUpdate.current = update;
      if (flushTimer.current != null) return;
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null;
        flush();
      }, 64);
    },
    [flush],
  );

  const setControlValue = useCallback(
    (value: number) => {
      const role = roleRef.current;
      if (role == null) return;
      setFeedback(null);
      armScrubRelease();
      const change = valueState.current.beginChange(value);
      setLocalValue(valueState.current.value);
      tickLevelFeedback(detentTracker.current, valueState.current.value);
      scheduleCommit({ role, value: valueState.current.value, change });
    },
    [armScrubRelease, scheduleCommit],
  );

  const flipToggle = useCallback(() => {
    const next = toggleNextValue(valueState.current.value);
    setControlValue(next);
    setTogglePulse(true);
    window.setTimeout(() => setTogglePulse(false), 220);
  }, [setControlValue]);

  const valueFromPointer = (clientX: number, clientY: number): number => {
    if (isVertical) {
      return Math.max(0, Math.min(100, ((window.innerHeight - clientY) / window.innerHeight) * 100));
    }
    return Math.max(0, Math.min(100, (clientX / window.innerWidth) * 100));
  };

  const onPointerDown = (e: PointerEvent) => {
    if (isToggleRole(roleRef.current ?? undefined)) {
      pointerMode.current = "tap";
      pointerOrigin.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    dragging.current = true;
    pointerMode.current = "drag";
    setDraggingUi(true);
    resetWheelAccumulator(wheelAccum.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    setControlValue(valueFromPointer(e.clientX, e.clientY));
  };

  const onPointerMove = (e: PointerEvent) => {
    if (isToggleRole(roleRef.current ?? undefined)) {
      if (pointerMode.current !== "tap") return;
      const dx = e.clientX - pointerOrigin.current.x;
      const dy = e.clientY - pointerOrigin.current.y;
      if (Math.hypot(dx, dy) > TAP_SLOP) {
        pointerMode.current = "none";
      }
      return;
    }
    if (!dragging.current) return;
    setControlValue(valueFromPointer(e.clientX, e.clientY));
  };

  const onPointerUp = () => {
    if (isToggleRole(roleRef.current ?? undefined)) {
      if (pointerMode.current === "tap") flipToggle();
      pointerMode.current = "none";
      void releasePointerScrub();
      return;
    }
    pointerMode.current = "none";
    void releasePointerScrub();
  };

  const onPointerCancel = () => {
    pointerMode.current = "none";
    void releasePointerScrub();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (isToggleRole(roleRef.current ?? undefined)) {
      const steps = wheelControlSteps(wheelAccum.current, e.deltaY, e.deltaMode, TOGGLE_WHEEL_PIXELS);
      if (steps === 0) return;
      flipToggle();
      return;
    }
    const steps = wheelControlSteps(wheelAccum.current, e.deltaY, e.deltaMode);
    if (steps === 0) return;
    setControlValue(valueState.current.value + steps);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isToggleRole(state?.role) && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      flipToggle();
      return;
    }
    if (isMediaRole(state?.role)) {
      if (event.key === " ") {
        event.preventDefault();
        void mediaCommand("playPause");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void mediaCommand("next");
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void mediaCommand("previous");
        return;
      }
    }
    if (isToggleRole(state?.role)) return;
    const nextValue = keyboardControlValue(valueState.current.value, event.key);
    if (nextValue == null) return;
    event.preventDefault();
    setControlValue(nextValue);
  };

  const mediaCommand = async (
    command: "playPause" | "next" | "previous",
    event?: { stopPropagation: () => void },
  ) => {
    event?.stopPropagation();
    if (!mediaCommandGate.current.tryEnter()) return;
    setMediaBusy(true);
    setFeedback(null);
    try {
      const result = await window.haloAPI.ipc.invoke<{
        value: number;
        meta: OverlayMediaMeta;
      }>("halo:mediaCommand", command);
      setState((current) =>
        current
          ? {
              ...current,
              value: result.value,
              meta: result.meta,
            }
          : current,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Couldn't control media");
    } finally {
      mediaCommandGate.current.release();
      setMediaBusy(false);
    }
  };

  const accent = accentForRole(state?.role);
  const glow = glowForRole(state?.role);
  const roundedValue = Math.round(localValue);
  const readout = readoutForRole(state?.role, localValue, state?.meta);
  const isMedia = isMediaRole(state?.role);
  const isToggle = isToggleRole(state?.role);
  const ariaRole = controlRole(state?.role);
  const accessibleLabel = controlAccessibleLabel(
    state?.role,
    state?.label,
    state?.meta,
    "Halo edge control",
  );
  const toggleOn = localValue >= 50;
  const playing = Boolean(state?.meta?.playing);
  const centerLabel = isMedia ? mediaTitle(state?.meta) : state?.label;

  const fillStyle: CSSProperties = isVertical
    ? { position: "absolute", left: 0, right: 0, bottom: 0, height: `${isToggle ? (toggleOn ? 100 : 0) : localValue}%` }
    : { position: "absolute", top: 0, bottom: 0, left: 0, width: `${isToggle ? (toggleOn ? 100 : 0) : localValue}%` };

  return (
    <div
      className={`halo-control-surface relative size-full cursor-default select-none ${visible ? `halo-edge-in-${edge}` : "opacity-0"} ${
        draggingUi ? "halo-dragging" : ""
      } ${togglePulse ? "halo-toggle-pulse" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role={ariaRole}
      aria-checked={ariaRole === "switch" ? toggleOn : undefined}
      aria-label={accessibleLabel}
      aria-valuemin={ariaRole === "slider" ? 0 : undefined}
      aria-valuemax={ariaRole === "slider" ? 100 : undefined}
      aria-valuenow={ariaRole === "slider" ? roundedValue : undefined}
      aria-valuetext={ariaRole === "slider" ? readout.accessible : undefined}
      aria-orientation={edgeSliderOrientation(state?.role, isVertical)}
      aria-busy={mediaBusy || undefined}
      style={{
        borderRadius: borderRadiusFor(edge),
        overflow: "hidden",
        background: PLATE,
        border: `1px solid ${draggingUi ? hexToRgba(accent, 0.45) : HALO_HAIRLINE}`,
        boxShadow: `${HALO_SHADOW}, ${HALO_INSET}`,
      }}
    >
      {/* Empty track groove — solid, not a gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
      <div
        aria-hidden="true"
        className={`halo-edge-fill ${isToggle ? "halo-toggle-fill" : ""}`}
        style={{
          ...fillStyle,
          background: accent,
          opacity: isToggle ? (toggleOn ? 0.32 : 0) : 0.72,
          boxShadow: localValue > 0 || toggleOn ? `0 0 18px ${hexToRgba(accent, 0.28)}` : undefined,
          transition: draggingUi
            ? undefined
            : "height 180ms var(--halo-ease-out), width 180ms var(--halo-ease-out), opacity 180ms var(--halo-ease-out)",
        }}
      />

      {isMedia ? (
        <div
          className={`absolute inset-0 flex px-2 ${
            isVertical ? "flex-col items-center justify-center gap-2 py-3" : "flex-row items-center gap-2"
          }`}
        >
          <div className={`flex shrink-0 items-center gap-1 ${isVertical ? "flex-col" : "flex-row"}`}>
            <button
              type="button"
              className="halo-media-btn flex size-8 shrink-0 items-center justify-center rounded-full text-white/90"
              aria-label="Previous track"
              disabled={mediaBusy}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => void mediaCommand("previous", e)}
            >
              <SkipBack className="size-3.5" fill="currentColor" />
            </button>
            <button
              type="button"
              className="halo-media-btn flex size-11 shrink-0 items-center justify-center rounded-full text-white"
              style={{
                background: "rgba(0,0,0,0.4)",
                boxShadow: `0 0 0 1px ${hexToRgba(accent, 0.55)}, 0 0 16px ${hexToRgba(accent, 0.28)}`,
              }}
              aria-label={playing ? "Pause" : "Play"}
              disabled={mediaBusy}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => void mediaCommand("playPause", e)}
            >
              {playing ? (
                <Pause className="size-4" fill="currentColor" />
              ) : (
                <Play className="size-4 translate-x-px" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              className="halo-media-btn flex size-8 shrink-0 items-center justify-center rounded-full text-white/90"
              aria-label="Next track"
              disabled={mediaBusy}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => void mediaCommand("next", e)}
            >
              <SkipForward className="size-3.5" fill="currentColor" />
            </button>
          </div>
          <div
            className={`pointer-events-none min-w-0 flex-1 ${isVertical ? "max-w-[56px] text-center" : "text-left"}`}
            aria-hidden="true"
          >
            <div className="halo-readout text-[11px] font-semibold leading-snug text-white [text-wrap:pretty]">
              {draggingUi ? readout.display : centerLabel}
            </div>
            {!draggingUi && state?.meta?.artist ? (
              <div className="mt-0.5 text-[9px] leading-snug text-white/65 [text-wrap:pretty]">
                {state.meta.artist}
              </div>
            ) : null}
          </div>
        </div>
      ) : isToggle ? (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2"
          aria-hidden="true"
        >
          <ToggleGlyph role={state?.role} on={toggleOn} glow={glow} />
          <span
            className="halo-readout text-white"
            style={{
              fontSize: 13,
              fontFamily: "SF Pro Rounded, ui-rounded, system-ui, sans-serif",
              fontWeight: 600,
            }}
          >
            {readout.display}
          </span>
          {centerLabel ? (
            <span
              className="max-w-full text-[9px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: toggleOn ? HALO_AMBER : "rgba(255,255,255,0.62)" }}
            >
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-2"
          aria-hidden="true"
        >
          <ScrollingValue
            value={readout.display}
            className="text-white"
            style={{
              fontSize: draggingUi ? 24 : 20,
              fontFamily: "SF Pro Rounded, ui-rounded, system-ui, sans-serif",
              fontWeight: 600,
              textShadow: "0 2px 10px rgba(0,0,0,0.45)",
            }}
          />
          {centerLabel ? (
            <span
              className="max-w-full text-[9px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: draggingUi ? HALO_AMBER : "rgba(255,255,255,0.62)" }}
            >
              {centerLabel}
            </span>
          ) : null}
        </div>
      )}
      {feedback ? (
        <span
          role="status"
          className="pointer-events-none absolute inset-x-2 bottom-1 z-10 truncate text-center text-[9px] font-medium text-red-300"
        >
          {feedback}
        </span>
      ) : null}
    </div>
  );
}
