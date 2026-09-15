import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  FieldGroup,
  FieldSet,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "../lib/components";

import { HALO_PLATE } from "../brand";
import {
  createOnboardingLoadErrorState,
  createOnboardingLoadingState,
  resolveOnboardingLoad,
  shouldCloseOnboardingForKey,
  type OnboardingLoadState,
  type ZoneId,
} from "./onboarding-load-state";
import {
  adjustOnboardingControlValue,
  advanceOnboardingStage,
  initialOnboardingStage,
  muteValueForOnboarding,
  walkthroughMapZones,
  type OnboardingStage,
} from "./onboarding-flow";

function zoneChipLabel(zone: ZoneId): string {
  switch (zone) {
    case "top-left":
      return "TL";
    case "top-right":
      return "TR";
    case "bottom-left":
      return "BL";
    case "bottom-right":
      return "BR";
    case "top":
      return "Top";
    case "bottom":
      return "Bottom";
    case "left":
      return "Left";
    case "right":
      return "Right";
  }
}

function zoneMapLabel(zone: ZoneId): string {
  switch (zone) {
    case "top-left":
      return "Top-left corner";
    case "top-right":
      return "Top-right corner";
    case "bottom-left":
      return "Bottom-left corner";
    case "bottom-right":
      return "Bottom-right corner";
    case "top":
      return "Top edge";
    case "right":
      return "Right edge";
    case "bottom":
      return "Bottom edge";
    case "left":
      return "Left edge";
  }
}

function highlightStyle(zone: ZoneId, hotZoneSize: number): CSSProperties {
  const corner = Math.max(48, hotZoneSize * 5);
  const edgeThick = Math.max(6, hotZoneSize);

  switch (zone) {
    case "top-left":
      return { top: 0, left: 0, width: corner, height: corner };
    case "top-right":
      return { top: 0, right: 0, width: corner, height: corner };
    case "bottom-left":
      return { bottom: 0, left: 0, width: corner, height: corner };
    case "bottom-right":
      return { bottom: 0, right: 0, width: corner, height: corner };
    case "top":
      return {
        top: 0,
        left: 0,
        right: 0,
        height: edgeThick,
      };
    case "bottom":
      return {
        bottom: 0,
        left: 0,
        right: 0,
        height: edgeThick,
      };
    case "left":
      return {
        left: 0,
        top: 0,
        bottom: 0,
        width: edgeThick,
      };
    case "right":
      return {
        right: 0,
        top: 0,
        bottom: 0,
        width: edgeThick,
      };
  }
}

interface OnboardingActionsProps {
  busy: boolean;
  onClose: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

function OnboardingActions({ busy, onClose, primaryAction }: OnboardingActionsProps) {
  return (
    <div className="halo-onboarding-actions">
      <Button
        type="button"
        variant="transparent"
        size="small"
        className="halo-onboarding-btn halo-onboarding-btn--ghost"
        onClick={onClose}
        disabled={busy}
      >
        Close for now
      </Button>
      {primaryAction ? (
        <Button
          type="button"
          variant="accent"
          size="small"
          className="halo-onboarding-btn halo-onboarding-btn--accent"
          onClick={primaryAction.onClick}
          disabled={busy || primaryAction.disabled}
        >
          {primaryAction.label}
        </Button>
      ) : null}
    </div>
  );
}

interface ControlSnapshot {
  volume: number;
  muted: boolean;
  accessibilityTrusted: boolean;
  brightnessSupported: boolean;
  keyboardSupported: boolean;
}

interface OnboardingDisplay {
  id: number;
  label: string;
  primary: boolean;
}

interface OnboardingSetup {
  displays: OnboardingDisplay[];
  selectedDisplayId: number;
  hotZoneSize: number;
}

export function OnboardingView() {
  const [loadState, setLoadState] = useState<OnboardingLoadState>(createOnboardingLoadingState);
  const [controls, setControls] = useState<ControlSnapshot | null>(null);
  const [setup, setSetup] = useState<OnboardingSetup | null>(null);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(null);
  const [hotZoneSize, setHotZoneSize] = useState(10);
  const [stage, setStage] = useState<OnboardingStage>(initialOnboardingStage);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const finishingRef = useRef(false);

  const loadOnboarding = useCallback(() => {
    const requestId = ++loadRequestId.current;
    setIndex(0);
    setStage(initialOnboardingStage());
    setLoadState(createOnboardingLoadingState());
    setSetup(null);
    setSelectedDisplayId(null);
    setPermissionMessage(null);
    setControlMessage(null);
    setFinishError(null);

    const request = async () => {
      try {
        const [setupPayload, snapshot] = await Promise.all([
          window.haloAPI.ipc.invoke<OnboardingSetup>("halo:getOnboardingSetup"),
          window.haloAPI.ipc.invoke<ControlSnapshot>("halo:getControls"),
        ]);
        if (requestId !== loadRequestId.current) return;
        if (
          !Array.isArray(setupPayload.displays) ||
          setupPayload.displays.length === 0 ||
          !Number.isInteger(setupPayload.selectedDisplayId) ||
          !Number.isInteger(setupPayload.hotZoneSize)
        ) {
          setLoadState(createOnboardingLoadErrorState());
          return;
        }
        setSetup(setupPayload);
        setSelectedDisplayId(setupPayload.selectedDisplayId);
        setHotZoneSize(setupPayload.hotZoneSize);
        setLoadState({ kind: "ready", steps: [] });
        setControls(snapshot);
      } catch {
        if (requestId !== loadRequestId.current) return;
        setLoadState(createOnboardingLoadErrorState());
      }
    };

    void request();
  }, []);

  const refreshControls = useCallback(async (): Promise<ControlSnapshot | null> => {
    try {
      const snapshot = await window.haloAPI.ipc.invoke<ControlSnapshot>("halo:getControls");
      setControls(snapshot);
      return snapshot;
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : "Couldn't check permissions.");
      return null;
    }
  }, []);

  useEffect(() => {
    loadOnboarding();
    return () => {
      loadRequestId.current += 1;
    };
  }, [loadOnboarding]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setBusy(true);

    try {
      await window.haloAPI.ipc.invoke("halo:completeOnboarding");
    } catch (error) {
      finishingRef.current = false;
      setBusy(false);
      setFinishError(error instanceof Error ? error.message : "Couldn't finish setup. Try again.");
    }
  }, []);

  const closeForNow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await window.haloAPI.ipc.invoke("halo:closeOnboarding");
    } catch (error) {
      setBusy(false);
      setFinishError(error instanceof Error ? error.message : "Couldn't close setup. Try again.");
    }
  }, [busy]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldCloseOnboardingForKey(event.key, event.defaultPrevented)) return;
      event.preventDefault();
      void closeForNow();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeForNow]);

  useEffect(() => {
    const unsubscribe = window.haloAPI.ipc.on(
      "halo:onboarding-tour-progress",
      (_event, payload) => {
        if (!payload || typeof payload !== "object") return;
        const progress = payload as { index?: unknown; complete?: unknown };
        if (
          typeof progress.index !== "number" ||
          !Number.isInteger(progress.index) ||
          typeof progress.complete !== "boolean"
        ) {
          return;
        }
        setIndex(progress.index);
        if (progress.complete) setStage("complete");
      },
    );
    return unsubscribe;
  }, []);

  const steps = loadState.kind === "ready" ? loadState.steps : [];
  const step = stage === "zones" ? steps[index] ?? null : null;
  const total = steps.length;

  const requestAccessibility = async () => {
    if (busy) return;
    setBusy(true);
    setPermissionMessage(null);
    try {
      const result = await window.haloAPI.ipc.invoke<{ trusted: boolean }>(
        "halo:requestAccessibility",
      );
      const snapshot = await refreshControls();
      if (result.trusted && snapshot?.accessibilityTrusted) {
        setPermissionMessage("Accessibility is ready. You can test Halo's controls next.");
      } else {
        await window.haloAPI.ipc.invoke("halo:openAccessibilitySettings");
        setPermissionMessage("Enable Halo in Privacy & Security → Accessibility, then come back and check again.");
      }
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : "Couldn't request Accessibility access.");
    } finally {
      setBusy(false);
    }
  };

  const continueFromPermissions = async () => {
    try {
      await window.haloAPI.ipc.invoke("halo:restoreOnboardingPriority");
    } catch (error) {
      setPermissionMessage(
        error instanceof Error ? error.message : "Couldn't restore the walkthrough window.",
      );
    }
    const snapshot = await refreshControls();
    const nextStage = advanceOnboardingStage("permissions", Boolean(snapshot?.accessibilityTrusted));
    if (nextStage === "permissions") {
      setPermissionMessage("Accessibility is required before Halo can safely test controls.");
      return;
    }
    setStage(nextStage);
    setControlMessage(null);
  };

  const runControlChange = async (role: "volume" | "mute", value: number) => {
    if (busy || !controls?.accessibilityTrusted) return;
    setBusy(true);
    setControlMessage(null);
    try {
      const result = await window.haloAPI.ipc.invoke<{ role: string; value: number }>(
        "halo:setControl",
        { role, value },
      );
      setControls((current) => {
        if (!current) return current;
        return role === "volume"
          ? { ...current, volume: result.value }
          : { ...current, muted: result.value >= 50 };
      });
      setControlMessage(role === "volume" ? `Volume set to ${result.value}%` : result.value >= 50 ? "Muted" : "Unmuted");
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : "Halo couldn't change that control.");
    } finally {
      setBusy(false);
    }
  };

  const startCalibration = () => {
    setStage(advanceOnboardingStage("controls", true));
    setFinishError(null);
  };

  const startZoneWalkthrough = async () => {
    if (busy || selectedDisplayId === null) return;
    setBusy(true);
    setFinishError(null);
    try {
      const payload = await window.haloAPI.ipc.invoke<unknown>("halo:prepareOnboardingTour", {
        displayId: selectedDisplayId,
        hotZoneSize,
      });
      if (
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { steps?: unknown }).steps) &&
        (payload as { steps: unknown[] }).steps.length === 0
      ) {
        setLoadState({ kind: "ready", steps: [] });
        setIndex(0);
        setStage("empty");
        return;
      }
      const nextLoadState = resolveOnboardingLoad(payload);
      if (nextLoadState.kind !== "ready") {
        setLoadState(nextLoadState);
        return;
      }
      setLoadState(nextLoadState);
      setIndex(0);
      setStage(nextLoadState.steps.length > 0 ? "map" : "empty");
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : "Couldn't start the hot-zone walkthrough.");
    } finally {
      setBusy(false);
    }
  };

  const beginLiveTour = async () => {
    if (busy || selectedDisplayId === null) return;
    setBusy(true);
    setFinishError(null);
    try {
      const payload = await window.haloAPI.ipc.invoke<unknown>("halo:beginOnboardingTour", {
        displayId: selectedDisplayId,
        hotZoneSize,
      });
      const nextLoadState = resolveOnboardingLoad(payload);
      if (nextLoadState.kind !== "ready") {
        setLoadState(nextLoadState);
        return;
      }
      setLoadState(nextLoadState);
      setIndex(0);
      setStage(nextLoadState.steps.length > 0 ? "zones" : "empty");
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : "Couldn't start the live hot-zone tour.");
    } finally {
      setBusy(false);
    }
  };

  const openSettingsWithoutCompleting = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await window.haloAPI.ipc.invoke("window:openSettings");
      await window.haloAPI.ipc.invoke("halo:closeOnboarding");
    } catch (error) {
      setBusy(false);
      setFinishError(error instanceof Error ? error.message : "Couldn't open Settings.");
    }
  };

  const mapZones = walkthroughMapZones();
  const highlightedZones =
    stage === "map" ? mapZones : stage === "zones" && step ? [step.zone] : [];

  return (
    <div className="halo-onboarding-root" aria-busy={loadState.kind === "loading"}>
      {highlightedZones.length > 0 ? (
        <>
          <div className="halo-onboarding-veil" aria-hidden />
          {highlightedZones.map((zone) => {
            const mapCorner =
              zone === "top-left" ||
              zone === "top-right" ||
              zone === "bottom-left" ||
              zone === "bottom-right";
            return (
              <div
                key={zone}
                className={`halo-onboarding-hit${mapCorner ? " is-corner" : " is-edge"}${stage === "map" ? " is-map" : ""}`}
                style={highlightStyle(zone, hotZoneSize)}
                aria-hidden
              >
                {mapCorner ? (
                  <span className="halo-onboarding-chip">
                    {stage === "map" ? zoneMapLabel(zone) : zoneChipLabel(zone)}
                  </span>
                ) : stage === "map" ? (
                  <span className="halo-onboarding-map-label">{zoneMapLabel(zone)}</span>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}

      <div className="halo-onboarding-card" style={{ background: HALO_PLATE }}>
        <div className="halo-onboarding-card-top">
          <span className="halo-onboarding-eyebrow">
            {stage === "permissions"
              ? "Permissions"
              : stage === "controls"
                ? "Try Halo"
                : stage === "calibration"
                  ? "Calibration"
                  : "Hot zones"}
          </span>
          {stage === "zones" && step ? (
            <span className="halo-onboarding-step tabular-nums">
              {index + 1} / {total}
            </span>
          ) : null}
        </div>
        {loadState.kind === "loading" ? (
          <>
            <p className="halo-onboarding-copy" aria-live="polite">
              Preparing your walkthrough.
            </p>
            <OnboardingActions busy={busy} onClose={() => void closeForNow()} />
          </>
        ) : null}
        {loadState.kind === "error" ? (
          <>
            <p className="halo-onboarding-copy" role="alert">
              Couldn&apos;t load the walkthrough.
            </p>
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{ label: "Retry", onClick: loadOnboarding }}
            />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "permissions" ? (
          <>
            <p className="halo-onboarding-copy">
              First, give Halo the permission it needs. Accessibility lets it adjust your Mac’s controls safely.
            </p>
            <div className="halo-onboarding-permissions">
              <div className="halo-onboarding-permission-row">
                <div>
                  <strong>Accessibility</strong>
                  <span>Required for system controls</span>
                </div>
                {controls?.accessibilityTrusted ? (
                  <span className="halo-onboarding-status is-ready">Ready</span>
                ) : (
                  <button
                    type="button"
                    className="halo-onboarding-inline-btn"
                    onClick={() => void requestAccessibility()}
                    disabled={busy}
                  >
                    Grant access
                  </button>
                )}
              </div>
            </div>
            {permissionMessage ? <p className="halo-onboarding-note" role="status">{permissionMessage}</p> : null}
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{
                label: controls?.accessibilityTrusted ? "Try controls" : "Check again",
                onClick: () => void continueFromPermissions(),
              }}
            />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "controls" ? (
          <>
            <p className="halo-onboarding-copy">
              Halo is connected. Try a small live change before you start using hot zones.
            </p>
            <div className="halo-onboarding-control-lab">
              <div className="halo-onboarding-control-row">
                <div>
                  <strong>Volume</strong>
                  <span>{controls?.volume ?? 0}%</span>
                </div>
                <div className="halo-onboarding-control-actions">
                  <button
                    type="button"
                    className="halo-onboarding-inline-btn"
                    onClick={() =>
                      void runControlChange(
                        "volume",
                        adjustOnboardingControlValue(controls?.volume ?? 0, -5),
                      )
                    }
                    disabled={busy || !controls?.accessibilityTrusted}
                  >
                    −5%
                  </button>
                  <button
                    type="button"
                    className="halo-onboarding-inline-btn"
                    onClick={() =>
                      void runControlChange(
                        "volume",
                        adjustOnboardingControlValue(controls?.volume ?? 0, 5),
                      )
                    }
                    disabled={busy || !controls?.accessibilityTrusted}
                  >
                    +5%
                  </button>
                </div>
              </div>
              <div className="halo-onboarding-control-row">
                <div>
                  <strong>Mute</strong>
                  <span>{controls?.muted ? "Muted" : "Unmuted"}</span>
                </div>
                <button
                  type="button"
                  className="halo-onboarding-inline-btn"
                  onClick={() => void runControlChange("mute", muteValueForOnboarding(Boolean(controls?.muted)))}
                  disabled={busy || !controls?.accessibilityTrusted}
                >
                  {controls?.muted ? "Unmute" : "Mute"}
                </button>
              </div>
              <p className="halo-onboarding-note" role="status" aria-live="polite">
                {controlMessage ?? "These make real system changes. Halo keeps each volume adjustment to 5%."}
              </p>
            </div>
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{ label: "Calibrate hot zones", onClick: startCalibration }}
            />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "calibration" && setup ? (
          <>
            <p className="halo-onboarding-copy">
              Choose the display for this walkthrough, then set the size of Halo&apos;s activation areas.
            </p>
            <FieldSet className="mt-4" title="Walkthrough calibration">
              <FieldGroup>
                <Field label="Display" description="Halo will guide you on this display.">
                  <Select
                    value={selectedDisplayId === null ? undefined : String(selectedDisplayId)}
                    onValueChange={(value) => setSelectedDisplayId(Number(value))}
                    disabled={busy}
                  >
                    <SelectTrigger variant="transparent" size="small">
                      <SelectValue placeholder="Choose a display" />
                    </SelectTrigger>
                    <SelectContent>
                      {setup.displays.map((display) => (
                        <SelectItem key={display.id} value={String(display.id)}>
                          {`${display.label}${display.primary ? " · Primary" : ""}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Hot-zone size"
                  description="Adjust how large each screen-edge activation area is."
                  orientation="vertical"
                >
                  <Slider
                    id="halo-onboarding-hot-zone-size"
                    value={[hotZoneSize]}
                    onValueChange={([value]) => {
                      if (typeof value === "number") setHotZoneSize(value);
                    }}
                    min={4}
                    max={96}
                    step={1}
                    variant="filled"
                    size="small"
                    endContent={(value) => `${value}px`}
                    disabled={busy}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{
                label: "Start tour",
                onClick: () => void startZoneWalkthrough(),
                disabled: selectedDisplayId === null,
              }}
            />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "empty" ? (
          <>
            <p className="halo-onboarding-copy">
              This display has no usable hot zones yet. Configure a control in Settings, then start the walkthrough again.
            </p>
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{ label: "Open Settings", onClick: () => void openSettingsWithoutCompleting() }}
            />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "map" ? (
          <>
            <p className="halo-onboarding-copy">
              Halo listens at all four corners and all four screen edges. The highlighted areas show every place you can activate it.
            </p>
            <p className="halo-onboarding-instruction">
              The live tour will activate only the configured, available controls on this display.
            </p>
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{ label: "Begin live tour", onClick: () => void beginLiveTour() }}
            />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "zones" && step ? (
          <>
            <p className="halo-onboarding-copy">{step.copy}</p>
            <p className="halo-onboarding-instruction">
              Move your cursor into the highlighted zone. Halo will continue after its control appears.
            </p>
            <OnboardingActions busy={busy} onClose={() => void closeForNow()} />
          </>
        ) : null}
        {loadState.kind === "ready" && stage === "complete" ? (
          <>
            <p className="halo-onboarding-copy">You&apos;ve tried every usable hot zone on this display.</p>
            <OnboardingActions
              busy={busy}
              onClose={() => void closeForNow()}
              primaryAction={{ label: "Open Settings", onClick: () => void finish() }}
            />
          </>
        ) : null}
        {finishError ? <p className="halo-onboarding-note is-error" role="alert">{finishError}</p> : null}
      </div>
    </div>
  );
}
