import { BrowserWindow, logger, screen } from "../platform/electron.js";

import { buildOnboardingSteps } from "../services/onboarding-steps.js";
import { edgeWatcher } from "../services/edge-watcher.js";
import { settingsStore } from "../services/settings-store.js";
import { getControlSnapshot } from "../services/system-controls.js";
import { onOverlayShown } from "../services/overlay-manager.js";
import { OnboardingTour, type OnboardingTourProgress } from "../services/onboarding-tour.js";
import {
  defaultDisplayZones,
  isCorner,
  type DisplayZoneSettings,
  type ZoneId,
  type ZoneRole,
} from "../types.js";
import { getPreloadPath, getWindowUrl } from "./window-paths.js";
import { getSettingsWindow, openSettingsWindow } from "./settings-window.js";

let onboardingWindow: BrowserWindow | null = null;
let finishing = false;
let hotZonesPausedForOnboarding = false;
let tourDisplayId: number | null = null;
let tourFocusZone: ZoneId = "top-left";
const RESTART_LAUNCH_DELAY_MS = 120;

export interface OnboardingDisplay {
  id: number;
  label: string;
  primary: boolean;
}

export interface OnboardingSetupPayload {
  displays: OnboardingDisplay[];
  selectedDisplayId: number;
  hotZoneSize: number;
}

export interface OnboardingTourPayload {
  display: OnboardingDisplay;
  steps: ReturnType<typeof buildOnboardingSteps>;
}

function showCoachmark(): void {
  const win = onboardingWindow;
  if (!win || win.isDestroyed()) return;
  restoreOnboardingPriority();
  win.show();
  win.focus();
}

const onboardingTour = new OnboardingTour({
  setTarget: (target) => edgeWatcher.setOnboardingTarget(target),
  hideCoachmark: () => {
    const win = onboardingWindow;
    if (win && !win.isDestroyed()) win.hide();
  },
  showCoachmark,
  publishProgress: (progress: OnboardingTourProgress) => {
    const win = onboardingWindow;
    if (win && !win.isDestroyed()) win.send("halo:onboarding-tour-progress", progress);
  },
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelSchedule: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
});

onOverlayShown((state) => {
  onboardingTour.onOverlayShown({
    displayId: state.displayId,
    zone: state.zone,
    role: state.role,
  });
});

function pauseHotZonesForOnboarding(): void {
  if (hotZonesPausedForOnboarding) return;
  edgeWatcher.pause();
  hotZonesPausedForOnboarding = true;
}

function resumeHotZonesAfterOnboarding(): void {
  if (!hotZonesPausedForOnboarding) return;
  edgeWatcher.resume();
  hotZonesPausedForOnboarding = false;
}

function displayList(): OnboardingDisplay[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Display ${display.id}`,
    primary: display.id === primaryId,
  }));
}

function moveOnboardingWindowToDisplay(displayId: number): void {
  const display = screen.getAllDisplays().find((candidate) => candidate.id === displayId);
  const win = onboardingWindow;
  if (!display || !win || win.isDestroyed()) return;
  const { x, y, width, height } = display.bounds;
  win.setBounds({ x, y, width, height });
}

function zoneRole(zones: DisplayZoneSettings, zone: ZoneId): ZoneRole {
  return isCorner(zone) ? zones.corners[zone] : zones.edges[zone];
}

function parseTourInput(input: unknown): { displayId: number; hotZoneSize: number } {
  if (!input || typeof input !== "object") throw new Error("Invalid walkthrough calibration");
  const { displayId, hotZoneSize } = input as Record<string, unknown>;
  if (typeof displayId !== "number" || !Number.isFinite(displayId)) {
    throw new Error("Choose a valid display for the walkthrough");
  }
  if (
    typeof hotZoneSize !== "number" ||
    !Number.isInteger(hotZoneSize) ||
    hotZoneSize < 4 ||
    hotZoneSize > 96
  ) {
    throw new Error("Hot-zone size must be a whole number from 4 to 96 pixels");
  }
  return { displayId, hotZoneSize };
}

export async function startOnboardingIfNeeded(): Promise<void> {
  const settings = await settingsStore.load();
  if (settings.hasCompletedOnboarding) return;
  await showOnboardingWindow();
}

export async function showOnboardingWindow(): Promise<void> {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingTour.cancel();
    tourDisplayId = null;
    pauseHotZonesForOnboarding();
    restoreOnboardingPriority();
    onboardingWindow.show();
    onboardingWindow.focus();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  const win = new BrowserWindow({
    windowKey: "halo-onboarding",
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    skipTaskbar: true,
    focusable: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  // Keep the coachmark visible without blocking macOS permission sheets or
  // Privacy & Security when the first onboarding step asks for access.
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setSkipTaskbar(true);

  win.on("closed", () => {
    if (onboardingWindow === win) {
      onboardingWindow = null;
      tourDisplayId = null;
      onboardingTour.cancel();
      resumeHotZonesAfterOnboarding();
    }
  });

  const url = await getWindowUrl("onboarding-window.html");
  pauseHotZonesForOnboarding();
  try {
    await win.loadURL(url);
    onboardingWindow = win;
    win.show();
    win.focus();
    logger.info("onboarding", "Onboarding walkthrough shown");
  } catch (error) {
    resumeHotZonesAfterOnboarding();
    win.destroy();
    throw error;
  }
}

export function getOnboardingWindow(): BrowserWindow | null {
  return onboardingWindow;
}

/** Let macOS privacy settings receive clicks while the walkthrough stays available. */
export function lowerOnboardingForSystemSettings(): void {
  const win = onboardingWindow;
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(false);
}

export function restoreOnboardingPriority(): void {
  const win = onboardingWindow;
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(true, "floating");
}

export function destroyOnboarding(): void {
  onboardingTour.cancel();
  tourDisplayId = null;
  const win = onboardingWindow;
  onboardingWindow = null;
  if (win && !win.isDestroyed()) win.destroy();
  resumeHotZonesAfterOnboarding();
}

export async function restartOnboarding(): Promise<void> {
  onboardingTour.cancel();
  tourDisplayId = null;
  await settingsStore.update({ hasCompletedOnboarding: false });
  // The Settings button that starts this flow may still be completing its native
  // click. Wait briefly so it cannot land on a button in the new full-screen window.
  await new Promise((resolve) => setTimeout(resolve, RESTART_LAUNCH_DELAY_MS));
  await showOnboardingWindow();
  logger.info("onboarding", "Onboarding walkthrough restarted");
}

export function closeOnboardingForNow(): void {
  destroyOnboarding();
  logger.info("onboarding", "Onboarding walkthrough closed for later");
}

export async function getOnboardingSetupPayload(): Promise<OnboardingSetupPayload> {
  const settings = await settingsStore.load();
  const displays = displayList();
  const selectedDisplay = displays.find((display) => display.primary) ?? displays[0];
  if (!selectedDisplay) throw new Error("No display is available for the walkthrough");
  return {
    displays,
    selectedDisplayId: selectedDisplay.id,
    hotZoneSize: settings.hotZoneSize,
  };
}

export async function beginOnboardingTour(input: unknown): Promise<OnboardingTourPayload> {
  const payload = await prepareOnboardingTour(input);
  const { display, steps } = payload;

  if (steps.length > 0) {
    onboardingTour.start(display.id, steps);
    resumeHotZonesAfterOnboarding();
  } else {
    onboardingTour.cancel();
    pauseHotZonesForOnboarding();
  }

  return payload;
}

/**
 * Resolves the selected display's live controls without arming a zone. This
 * lets the renderer show the complete screen-edge map before the live tour.
 */
export async function prepareOnboardingTour(input: unknown): Promise<OnboardingTourPayload> {
  onboardingTour.cancel();
  pauseHotZonesForOnboarding();
  const { displayId, hotZoneSize } = parseTourInput(input);
  const displays = displayList();
  const display = displays.find((candidate) => candidate.id === displayId);
  if (!display) throw new Error("The selected display is no longer available");

  const [settings, controls] = await Promise.all([
    settingsStore.update({ hotZoneSize }),
    getControlSnapshot(),
  ]);
  const zones = settings.displays[String(displayId)] ?? defaultDisplayZones();
  const steps = zones.enabled
    ? buildOnboardingSteps(
        (zone) => zoneRole(zones, zone),
        {
          brightnessSupported: controls.brightnessSupported,
          keyboardSupported: controls.keyboardSupported,
        },
      )
    : [];

  tourDisplayId = displayId;
  tourFocusZone = steps[0]?.zone ?? "top-left";
  moveOnboardingWindowToDisplay(displayId);
  return { display, steps };
}

export async function completeOnboarding(): Promise<void> {
  if (finishing) return;
  if (!onboardingTour.canComplete) {
    throw new Error("Finish the active hot-zone walkthrough before completing setup");
  }
  finishing = true;
  try {
    const completedDisplayId = tourDisplayId;
    const completedZone = tourFocusZone;
    await settingsStore.update({ hasCompletedOnboarding: true });
    destroyOnboarding();
    await openSettingsWindow();
    const settingsWin = getSettingsWindow();
    // Give the settings renderer a beat to subscribe before focusing Hot Zones.
    await new Promise((resolve) => setTimeout(resolve, 180));
    settingsWin?.send("halo:settings-focus", {
      tab: "hot-zones",
      zone: completedZone,
      displayId: completedDisplayId,
    });
    logger.info("onboarding", "Onboarding completed");
  } finally {
    finishing = false;
  }
}
