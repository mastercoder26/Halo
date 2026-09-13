import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Coffee, Keyboard, Moon, Pause, Play, Sun, Volume2, VolumeX } from "lucide-react";

import type { ActiveOverlayState, ControlRole } from "../platform/bridge";
import { accentForRole, glowForRole } from "../role-visuals";

type CoreOverlayRole = ControlRole;
type OverlayState = ActiveOverlayState & { role: CoreOverlayRole };

const CORE_ROLES = new Set<CoreOverlayRole>([
  "volume",
  "brightness",
  "appearance",
  "keyboard-backlight",
  "mute",
  "keep-awake",
  "now-playing",
]);

function isCoreOverlayState(value: unknown): value is OverlayState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<OverlayState>;
  return (
    typeof state.role === "string" &&
    CORE_ROLES.has(state.role as CoreOverlayRole) &&
    typeof state.value === "number" &&
    typeof state.label === "string"
  );
}

function isToggle(role: CoreOverlayRole): boolean {
  return role === "appearance" || role === "mute" || role === "keep-awake" || role === "now-playing";
}

function readout(role: CoreOverlayRole, value: number): string {
  if (role === "appearance") return value >= 50 ? "Dark" : "Light";
  if (role === "mute") return value >= 50 ? "Muted" : "Unmuted";
  if (role === "keep-awake") return value >= 50 ? "On" : "Off";
  if (role === "now-playing") return value >= 50 ? "Playing" : "Paused";
  return `${Math.round(value)}%`;
}

function RoleIcon({ role, active }: { role: CoreOverlayRole; active: boolean }) {
  const className = "size-5";
  if (role === "brightness") return <Sun className={className} />;
  if (role === "keyboard-backlight") return <Keyboard className={className} />;
  if (role === "appearance") return active ? <Moon className={className} /> : <Sun className={className} />;
  if (role === "mute") return active ? <VolumeX className={className} /> : <Volume2 className={className} />;
  if (role === "keep-awake") return active ? <Coffee className={className} /> : <Moon className={className} />;
  if (role === "now-playing") return active ? <Pause className={className} /> : <Play className={className} />;
  return <Volume2 className={className} />;
}

export function OverlayControl({
  edge,
  variant,
}: {
  edge?: "left" | "right" | "top" | "bottom";
  variant: "dial" | "edge";
}) {
  const [state, setState] = useState<OverlayState | null>(null);
  const [value, setValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    const applyState = (payload: unknown) => {
      if (!isCoreOverlayState(payload)) {
        setState(null);
        return;
      }
      setState(payload);
      setValue(Math.max(0, Math.min(100, payload.value)));
      setError(null);
    };

    const unsubscribe = window.haloAPI.overlay.onState(applyState);
    void window.haloAPI.overlay.getState().then(applyState).catch(() => undefined);
    return unsubscribe;
  }, []);

  const updateValue = useCallback(async (nextValue: number) => {
    if (!state) return;
    const clamped = Math.round(Math.max(0, Math.min(100, nextValue)));
    const request = ++latestRequest.current;
    setValue(clamped);
    setError(null);
    try {
      const result = await window.haloAPI.controls.set(state.role, clamped);
      if (request === latestRequest.current) setValue(result.value);
    } catch {
      if (request === latestRequest.current) setError("Couldn’t update control");
    }
  }, [state]);

  if (!state) return null;

  const accent = accentForRole(state.role);
  const glow = glowForRole(state.role);
  const toggle = isToggle(state.role);
  const active = value >= 50;
  const vertical = edge === "left" || edge === "right";
  const containerStyle: CSSProperties = {
    background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 18%, #171719), #171719)`,
    boxShadow: `0 14px 40px ${glow}`,
    borderRadius:
      variant === "dial"
        ? "999px"
        : edge === "left"
          ? "0 24px 24px 0"
          : edge === "right"
            ? "24px 0 0 24px"
            : edge === "top"
              ? "0 0 24px 24px"
              : "24px 24px 0 0",
  };

  return (
    <section
      className={
        variant === "dial"
          ? "flex h-full w-full flex-col items-center justify-center gap-3 border border-white/15 p-6 text-center text-white"
          : "flex h-full w-full items-center justify-center gap-3 border border-white/15 p-4 text-white"
      }
      style={containerStyle}
      aria-label={state.label}
    >
      <div className="flex items-center gap-2" style={{ color: accent }}>
        <RoleIcon role={state.role} active={active} />
        <span className="text-sm font-semibold text-white">{state.label}</span>
      </div>

      {toggle ? (
        <button
          type="button"
          role="switch"
          aria-checked={active}
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          style={{ backgroundColor: active ? accent : "rgba(255,255,255,0.08)" }}
          onClick={() => void updateValue(active ? 0 : 100)}
        >
          {readout(state.role, value)}
        </button>
      ) : (
        <div className={vertical ? "flex h-32 items-center gap-3" : "flex w-full max-w-48 items-center gap-3"}>
          <input
            aria-label={`${state.label} level`}
            className={vertical ? "h-32 w-5 accent-white" : "w-full accent-white"}
            style={vertical ? { writingMode: "vertical-lr", direction: "rtl" } : undefined}
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(event) => void updateValue(Number(event.currentTarget.value))}
          />
          <output className="min-w-9 text-right text-sm font-semibold text-white">{readout(state.role, value)}</output>
        </div>
      )}

      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </section>
  );
}
