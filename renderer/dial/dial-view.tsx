import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, WheelEvent } from "react";
import { Coffee, Moon, Pause, Play, SkipBack, SkipForward, Sun, Volume2, VolumeX } from "lucide-react";

import { accentForRole, glowForRole, hexToRgba } from "../role-visuals";
import {
  HALO_AMBER,
  HALO_AMBER_RING,
  HALO_HAIRLINE,
  HALO_PLATE_SOFT,
} from "../brand";
import { LatestValueQueue } from "./control-commit-queue";
import { controlAccessibleLabel, controlRole } from "./control-accessibility";
import { AsyncCommandGate } from "./async-command-gate";
import { keyboardControlValue } from "./keyboard-control";
import { LevelDetentTracker } from "./level-detent";
import { refreshFeedbackSettings, tickLevelFeedback } from "./level-feedback";
import { mediaTitle, readoutForRole, isDialOverlayRole, type OverlayMediaMeta, type OverlayRole } from "./overlay-readout";
import { OverlayValueState, type OverlayChange } from "./overlay-value-state";
import { isMediaRole, isToggleRole, toggleNextValue } from "./role-kind";
import { ScrollingValue } from "./scrolling-value";
import { createWheelAccumulator, resetWheelAccumulator, wheelControlSteps } from "./wheel-control";

type ZoneRole = OverlayRole;

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

/** Keep in sync with main/windows/dial-overlay.ts */
const DIAL_SIZE = 256;
const PLATE = HALO_PLATE_SOFT;
const TAP_SLOP = 8;
const TICK_COUNT = 24;
const TOGGLE_WHEEL_PIXELS = 96;

function parseCorner(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("corner") ?? "top-left";
}

function cornerTransform(corner: string): string {
  switch (corner) {
    case "top-right":
      return `translate(${DIAL_SIZE} 0) scale(-1 1)`;
    case "bottom-left":
      return `translate(0 ${DIAL_SIZE}) scale(1 -1)`;
    case "bottom-right":
      return `translate(${DIAL_SIZE} ${DIAL_SIZE}) scale(-1 -1)`;
    default:
      return "";
  }
}

function cornerOriginClass(corner: string): string {
  switch (corner) {
    case "top-right":
      return "origin-top-right";
    case "bottom-left":
      return "origin-bottom-left";
    case "bottom-right":
      return "origin-bottom-right";
    default:
      return "origin-top-left";
  }
}

function valueToAngle(value: number): number {
  return (Math.max(0, Math.min(100, value)) / 100) * 90;
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
  const className = "size-4 text-white";
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

export function DialView() {
  const corner = useMemo(() => parseCorner(), []);
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
        // Never force while the user is scrubbing — stale media polls would snap the thumb back.
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

  const setDialValue = useCallback(
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
    setDialValue(next);
    setTogglePulse(true);
    window.setTimeout(() => setTogglePulse(false), 220);
  }, [setDialValue]);

  const angleFromPointer = (clientX: number, clientY: number) => {
    let x = clientX;
    let y = clientY;
    if (corner === "top-right") x = DIAL_SIZE - clientX;
    if (corner === "bottom-left") y = DIAL_SIZE - clientY;
    if (corner === "bottom-right") {
      x = DIAL_SIZE - clientX;
      y = DIAL_SIZE - clientY;
    }
    const deg = (Math.atan2(Math.max(0, y), Math.max(0, x)) * 180) / Math.PI;
    return Math.max(0, Math.min(100, (deg / 90) * 100));
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
    setDialValue(angleFromPointer(e.clientX, e.clientY));
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
    setDialValue(angleFromPointer(e.clientX, e.clientY));
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
    setDialValue(valueState.current.value + steps);
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
    setDialValue(nextValue);
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
  const litTick = hexToRgba(accent, 0.55);
  const angle = valueToAngle(localValue);
  const ticks = useMemo(() => Array.from({ length: TICK_COUNT + 1 }, (_, i) => i), []);
  const roundedValue = Math.round(localValue);
  const readout = readoutForRole(state?.role, localValue, state?.meta);
  const isMedia = isMediaRole(state?.role);
  const isToggle = isToggleRole(state?.role);
  const ariaRole = controlRole(state?.role);
  const accessibleLabel = controlAccessibleLabel(
    state?.role,
    state?.label,
    state?.meta,
    "Halo dial control",
  );
  const toggleOn = localValue >= 50;
  const playing = Boolean(state?.meta?.playing);
  const plateR = 198;
  const tickInner = 168;
  const tickOuterMajor = 188;
  const tickOuterMinor = 182;
  const thumbR = 178;

  const contentInset = 18;
  const contentStyle = {
    left: corner.includes("right") ? undefined : contentInset,
    right: corner.includes("right") ? contentInset : undefined,
    top: corner.includes("bottom") ? undefined : contentInset,
    bottom: corner.includes("bottom") ? contentInset : undefined,
  } as const;

  return (
    <div
      className={`halo-control-surface relative size-full cursor-default select-none ${cornerOriginClass(corner)} ${
        visible ? "halo-dial-in" : "opacity-0"
      } ${draggingUi ? "halo-dragging" : ""} ${togglePulse ? "halo-toggle-pulse" : ""}`}
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
      aria-busy={mediaBusy || undefined}
    >
      <svg
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        width={DIAL_SIZE}
        height={DIAL_SIZE}
        className="block"
        aria-hidden="true"
      >
        <defs>
          <filter id="plateSoft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="rgba(0,0,0,0.48)" />
          </filter>
          <filter id="accentGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={glow} />
          </filter>
        </defs>
        <g transform={cornerTransform(corner)} filter="url(#plateSoft)">
          <path
            d={`M0 0 H${plateR} A${plateR} ${plateR} 0 0 1 0 ${plateR} Z`}
            fill={PLATE}
            stroke={draggingUi ? HALO_AMBER_RING : HALO_HAIRLINE}
            strokeWidth="1.25"
          />
          {/* Inner rim — flat highlight, not a gradient */}
          <path
            d={`M2.5 2.5 H${plateR - 4} A${plateR - 4} ${plateR - 4} 0 0 1 2.5 ${plateR - 4}`}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
          {isToggle ? (
            <path
              d={`M0 0 H${plateR} A${plateR} ${plateR} 0 0 1 0 ${plateR} Z`}
              fill={accent}
              opacity={toggleOn ? 0.22 : 0}
              className="halo-toggle-fill"
            />
          ) : (
            <>
              {ticks.map((i) => {
                const a = (i / TICK_COUNT) * 90;
                const rad = (a * Math.PI) / 180;
                const major = i % 4 === 0;
                const lit = a <= angle + 0.6;
                const active = Math.abs(a - angle) < 1.8;
                const r2 = major ? tickOuterMajor : tickOuterMinor;
                let stroke = major ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)";
                let width = major ? 1.5 : 1;
                if (lit) {
                  stroke = active ? accent : litTick;
                  width = active ? 2.6 : major ? 1.8 : 1.2;
                }
                return (
                  <line
                    key={i}
                    className="halo-tick"
                    x1={Math.cos(rad) * tickInner}
                    y1={Math.sin(rad) * tickInner}
                    x2={Math.cos(rad) * r2}
                    y2={Math.sin(rad) * r2}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeLinecap="round"
                    filter={active ? "url(#accentGlow)" : undefined}
                  />
                );
              })}
              <circle
                className="halo-thumb"
                cx={Math.cos((angle * Math.PI) / 180) * thumbR}
                cy={Math.sin((angle * Math.PI) / 180) * thumbR}
                r={draggingUi ? 7 : 5.5}
                fill={accent}
                filter="url(#accentGlow)"
              />
            </>
          )}
        </g>
      </svg>

      <div
        className="pointer-events-none absolute flex max-w-[148px] flex-col gap-1"
        style={contentStyle}
        aria-hidden={isMedia ? undefined : true}
      >
        {isMedia ? (
          <>
            <div className="pointer-events-auto flex items-center gap-1">
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
                  background: "rgba(0,0,0,0.45)",
                  boxShadow: `0 6px 18px rgba(0,0,0,0.35), 0 0 0 1px ${hexToRgba(accent, 0.55)}, 0 0 18px ${hexToRgba(accent, 0.25)}`,
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
            <div className="mt-1 min-w-0" aria-hidden="true">
              <div className="halo-readout text-[11px] font-semibold leading-snug text-white [text-wrap:pretty]">
                {draggingUi ? readout.display : mediaTitle(state?.meta)}
              </div>
              {!draggingUi && state?.meta?.artist ? (
                <div className="mt-0.5 text-[10px] leading-snug text-white/65 [text-wrap:pretty]">
                  {state.meta.artist}
                </div>
              ) : null}
            </div>
          </>
        ) : isToggle ? (
          <div
            className="flex size-14 flex-col items-center justify-center gap-0.5 rounded-full"
            style={{
              background: "rgba(0,0,0,0.4)",
              boxShadow: toggleOn
                ? `0 6px 16px rgba(0,0,0,0.35), 0 0 0 1px ${hexToRgba(accent, 0.55)}, 0 0 16px ${hexToRgba(accent, 0.22)}`
                : "0 6px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.16)",
            }}
          >
            <ToggleGlyph role={state?.role} on={toggleOn} glow={glow} />
            <span className="halo-readout text-[9px] font-semibold text-white">{readout.display}</span>
          </div>
        ) : (
          <>
            <div
              className="halo-value-pill inline-flex min-w-[56px] items-center justify-center rounded-full px-3.5 py-1.5"
              style={{
                background: "rgba(0,0,0,0.5)",
                boxShadow: draggingUi
                  ? `0 8px 20px rgba(0,0,0,0.36), 0 0 0 1.5px ${HALO_AMBER_RING}`
                  : `0 8px 20px rgba(0,0,0,0.32), 0 0 0 1px ${HALO_HAIRLINE}`,
              }}
            >
              <ScrollingValue
                value={readout.display}
                className="font-semibold text-white"
                style={{
                  fontSize: draggingUi ? 21 : 17,
                  fontFamily: "SF Pro Rounded, ui-rounded, system-ui, sans-serif",
                }}
              />
            </div>
            {state?.label ? (
              <span
                className="pl-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: draggingUi ? HALO_AMBER : "rgba(255,255,255,0.62)" }}
              >
                {state.label}
              </span>
            ) : null}
          </>
        )}
        {feedback ? (
          <span role="status" className="max-w-[148px] text-[10px] font-medium text-red-300">
            {feedback}
          </span>
        ) : null}
      </div>
    </div>
  );
}
