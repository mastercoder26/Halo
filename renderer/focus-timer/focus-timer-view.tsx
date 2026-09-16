import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { HALO_AMBER, HALO_AMBER_SOFT } from "../brand";
import { ROLE_VISUALS, hexToRgba } from "../role-visuals";

type FocusTimerPhase = "focus" | "short-break" | "long-break";
type FocusTimerStatus = "idle" | "running" | "paused";

interface FocusTimerMeta {
  phase: FocusTimerPhase;
  status: FocusTimerStatus;
  remainingMs: number;
  totalMs: number;
  cycleIndex: number;
  cyclesBeforeLongBreak: number;
}

interface OverlayState {
  zone: string;
  role: string;
  displayId: number;
  value: number;
  label: string;
  timer?: FocusTimerMeta;
}

function formatMmSs(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function phaseLabel(phase: FocusTimerPhase): string {
  switch (phase) {
    case "focus":
      return "Focus";
    case "short-break":
      return "Break";
    case "long-break":
      return "Long break";
  }
}

function statusHint(status: FocusTimerStatus): string {
  switch (status) {
    case "running":
      return "Tap to pause";
    case "paused":
      return "Tap to resume";
    default:
      return "Tap to start";
  }
}

function TimerChar({ char }: { char: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const colon = char === ":";

  useLayoutEffect(() => {
    if (!ref.current || colon) return;
    const measure = () => {
      if (ref.current) setHeight(ref.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [colon]);

  if (colon) {
    return (
      <div className="halo-timer-char halo-timer-char--colon" aria-hidden>
        :
      </div>
    );
  }

  const number = Number.parseInt(char, 10);
  const offset = height > 0 ? number * height * -1 : 0;

  return (
    <div ref={ref} className="halo-timer-char halo-timer-char--digit">
      <div className="halo-timer-char-slider" style={{ transform: `translateY(${offset}px)` }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`halo-timer-char-slider-option${number === i ? " is-active" : ""}`}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimerDigits({ value }: { value: string }) {
  return (
    <div className="halo-timer-digits" aria-hidden>
      {value.split("").map((char, index) => (
        <TimerChar key={`${index}-${char === ":" ? "colon" : "d"}`} char={char} />
      ))}
    </div>
  );
}

const EMPTY: FocusTimerMeta = {
  phase: "focus",
  status: "idle",
  remainingMs: 0,
  totalMs: 0,
  cycleIndex: 0,
  cyclesBeforeLongBreak: 4,
};

export function FocusTimerView() {
  const [state, setState] = useState<OverlayState | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = window.haloAPI.ipc.on("halo:overlay-state", (_event, payload) => {
      const next = payload as OverlayState | null;
      if (next && next.role === "focus-timer") {
        setState(next);
        setVisible(true);
      } else {
        setVisible(false);
        setState(null);
      }
    });
    let cancelled = false;
    void window.haloAPI.ipc.invoke<OverlayState | null>("halo:getOverlayState").then((next) => {
      if (cancelled) return;
      if (next && next.role === "focus-timer") {
        setState(next);
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

  const timer = state?.timer ?? EMPTY;
  const accent = ROLE_VISUALS["focus-timer"].accent;
  const display = formatMmSs(timer.remainingMs);
  const progress =
    timer.totalMs > 0
      ? Math.min(1, Math.max(0, 1 - timer.remainingMs / timer.totalMs))
      : 0;
  const cycleDisplay = `${Math.min(timer.cycleIndex + 1, timer.cyclesBeforeLongBreak)} / ${timer.cyclesBeforeLongBreak}`;

  const runCommand = async (command: "toggle" | "skip") => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await window.haloAPI.ipc.invoke<FocusTimerMeta>(
        "halo:focusTimerCommand",
        command,
      );
      setState((prev) =>
        prev
          ? {
              ...prev,
              timer: {
                phase: next.phase,
                status: next.status,
                remainingMs: next.remainingMs,
                totalMs: next.totalMs,
                cycleIndex: next.cycleIndex,
                cyclesBeforeLongBreak: next.cyclesBeforeLongBreak,
              },
              value: next.remainingMs,
            }
          : prev,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Couldn't update timer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`box-border flex size-full flex-col justify-between px-4 py-3.5 select-none ${
        visible ? "halo-dock-in" : "opacity-0"
      }`}
      role="timer"
      aria-live="off"
      aria-label={`${phaseLabel(timer.phase)} ${display}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">
          {phaseLabel(timer.phase)}
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] tabular-nums"
          style={{
            color: accent,
            background: hexToRgba(accent, 0.16),
            boxShadow: `inset 0 0 0 1px ${hexToRgba(accent, 0.35)}`,
          }}
        >
          {cycleDisplay}
        </span>
      </div>

      <button
        type="button"
        className="halo-timer-main flex flex-col items-center gap-2 border-0 bg-transparent p-0"
        onClick={() => void runCommand("toggle")}
        aria-label={statusHint(timer.status)}
        aria-busy={busy || undefined}
        disabled={busy || !visible}
      >
        <TimerDigits value={display} />
        <div
          className="h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <div
            className="h-full rounded-full halo-meter-fill"
            style={{
              background: HALO_AMBER,
              boxShadow: `0 0 0 1px ${HALO_AMBER_SOFT}`,
              transform: `scaleX(${progress})`,
            }}
          />
        </div>
        <span className="text-[10px] font-medium tracking-[0.04em] text-white/45">
          {feedback ?? (busy ? "Updating…" : statusHint(timer.status))}
        </span>
      </button>

      <div className="flex justify-end">
        <button
          type="button"
          className="border-0 bg-transparent px-1 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/50 hover:text-white/80"
          onClick={(event) => {
            event.stopPropagation();
            void runCommand("skip");
          }}
          aria-busy={busy || undefined}
          disabled={busy || !visible}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
