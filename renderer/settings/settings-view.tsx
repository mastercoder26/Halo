import { useCallback, useEffect, useState } from "react";

import appIcon from "../../app-icon.png";
import {
  Button,
  Callout,
  Field,
  FieldGroup,
  FieldSet,
  SegmentedControl,
  SegmentedControlItem,
} from "../lib/components";
import type {
  ControlSnapshot,
  DisplayInfo,
  DisplayZoneSettings,
  HaloSettings,
  ZoneRole,
} from "../platform/bridge";
import type { CornerId, EdgeId, ZoneId } from "../../main/types.ts";

const CORNERS: Array<{ id: CornerId; label: string }> = [
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
];

const EDGES: Array<{ id: EdgeId; label: string }> = [
  { id: "top", label: "Top edge" },
  { id: "bottom", label: "Bottom edge" },
  { id: "left", label: "Left edge" },
  { id: "right", label: "Right edge" },
];

const ROLE_OPTIONS: Array<{ value: ZoneRole; label: string }> = [
  { value: "off", label: "Off" },
  { value: "volume", label: "Volume" },
  { value: "brightness", label: "Brightness" },
  { value: "appearance", label: "Appearance" },
  { value: "keyboard-backlight", label: "Keyboard backlight" },
  { value: "mute", label: "Mute" },
  { value: "keep-awake", label: "Keep awake" },
  { value: "now-playing", label: "Now playing" },
];

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ZoneRoleSelect({
  value,
  controls,
  onChange,
}: {
  value: ZoneRole;
  controls: ControlSnapshot | null;
  onChange: (role: ZoneRole) => void;
}) {
  return (
    <select
      className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-primary outline-none focus:border-[var(--theme-accent)]"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value as ZoneRole)}
    >
      {ROLE_OPTIONS.map((option) => {
        const unavailable = Boolean(
          (option.value === "brightness" && controls && !controls.brightnessSupported) ||
          (option.value === "keyboard-backlight" && controls && !controls.keyboardSupported),
        );
        return (
          <option key={option.value} value={option.value} disabled={unavailable}>
            {option.label}{unavailable ? " (unavailable)" : ""}
          </option>
        );
      })}
    </select>
  );
}

function OnOffControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <SegmentedControl
      value={checked ? "on" : "off"}
      onValueChange={(value) => onChange(value === "on")}
      aria-label={label}
    >
      <SegmentedControlItem value="on">On</SegmentedControlItem>
      <SegmentedControlItem value="off">Off</SegmentedControlItem>
    </SegmentedControl>
  );
}

export function SettingsView() {
  const [settings, setSettings] = useState<HaloSettings | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(null);
  const [controls, setControls] = useState<ControlSnapshot | null>(null);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selectedDisplay =
    displays.find((display) => display.id === selectedDisplayId) ?? displays[0] ?? null;

  const loadSettings = useCallback(async () => {
    try {
      const [nextSettings, nextDisplays, nextControls, nextAutoLaunch] = await Promise.all([
        window.haloAPI.settings.get(),
        window.haloAPI.displays.get(),
        window.haloAPI.controls.get(),
        window.haloAPI.app.getAutoLaunch(),
      ]);
      setSettings(nextSettings);
      setDisplays(nextDisplays);
      setControls(nextControls);
      setAutoLaunch(nextAutoLaunch);
      setSelectedDisplayId((current) => current ?? nextDisplays[0]?.id ?? null);
    } catch (error) {
      setStatus(`Could not load settings: ${messageForError(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      void window.haloAPI.window.closeSettings();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const updateSettings = async (patch: Partial<HaloSettings>) => {
    try {
      const nextSettings = await window.haloAPI.settings.update(patch);
      setSettings(nextSettings);
      setStatus(null);
    } catch (error) {
      setStatus(`Could not save settings: ${messageForError(error)}`);
    }
  };

  const updateZones = async (zones: DisplayZoneSettings) => {
    if (!selectedDisplay) return;
    try {
      const saved = await window.haloAPI.displays.setZones(selectedDisplay.id, zones);
      setDisplays((current) =>
        current.map((display) =>
          display.id === selectedDisplay.id ? { ...display, zones: saved } : display,
        ),
      );
      setStatus(null);
    } catch (error) {
      setStatus(`Could not save hot zones: ${messageForError(error)}`);
    }
  };

  const updateZoneRole = (zone: ZoneId, role: ZoneRole) => {
    if (!selectedDisplay) return;
    if (CORNERS.some((corner) => corner.id === zone)) {
      void updateZones({
        ...selectedDisplay.zones,
        corners: { ...selectedDisplay.zones.corners, [zone]: role },
      });
      return;
    }
    void updateZones({
      ...selectedDisplay.zones,
      edges: { ...selectedDisplay.zones.edges, [zone as EdgeId]: role },
    });
  };

  const requestAccessibility = async () => {
    try {
      const result = await window.haloAPI.accessibility.request();
      if (!result.trusted) {
        await window.haloAPI.accessibility.openSettings();
        setStatus("Enable Halo in Privacy & Security → Accessibility, then return here.");
      } else {
        setStatus("Accessibility is enabled.");
      }
      await loadSettings();
    } catch (error) {
      setStatus(`Could not request Accessibility access: ${messageForError(error)}`);
    }
  };

  const setLaunchAtLogin = async (next: boolean) => {
    setAutoLaunch(next);
    try {
      setAutoLaunch(await window.haloAPI.app.setAutoLaunch(next));
    } catch (error) {
      setAutoLaunch(!next);
      setStatus(`Could not update launch at login: ${messageForError(error)}`);
    }
  };

  const resetHotZones = async () => {
    try {
      await window.haloAPI.settings.resetHotZones();
      await loadSettings();
      setStatus("Hot-zone measurements reset.");
    } catch (error) {
      setStatus(`Could not reset hot zones: ${messageForError(error)}`);
    }
  };

  if (!settings) {
    return <div className="flex h-screen items-center justify-center text-sm text-secondary">Loading Halo…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-[#171719] text-primary">
      <header className="drag-region flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <img src={appIcon} alt="" className="h-8 w-8 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">Halo</h1>
          <p className="text-xs text-secondary">Cursor-edge system controls</p>
        </div>
        <Button
          className="no-drag"
          size="small"
          variant="transparent"
          aria-label="Close settings"
          onClick={() => void window.haloAPI.window.closeSettings()}
        >
          Done
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
          {status ? <Callout className="text-sm text-secondary">{status}</Callout> : null}

          {!controls?.accessibilityTrusted ? (
            <Callout className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">Accessibility permission is needed</p>
                <p className="mt-1 text-xs text-secondary">
                  Enable it to let Halo adjust protected system controls.
                </p>
              </div>
              <Button size="small" variant="accent" onClick={() => void requestAccessibility()}>
                Enable
              </Button>
            </Callout>
          ) : null}

          <FieldSet title="Where Halo works" description="Choose the display and how many displays respond to your cursor.">
            <FieldGroup>
              <Field label="Display">
                <select
                  className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-primary outline-none focus:border-[var(--theme-accent)]"
                  value={selectedDisplay?.id ?? ""}
                  onChange={(event) => setSelectedDisplayId(Number(event.currentTarget.value))}
                >
                  {displays.map((display) => (
                    <option key={display.id} value={display.id}>
                      {display.label}{display.primary ? " (primary)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Active displays" description="Use every screen, or only the screen under the cursor.">
                <SegmentedControl
                  value={settings.displayMode}
                  onValueChange={(value) =>
                    void updateSettings({ displayMode: value as HaloSettings["displayMode"] })
                  }
                >
                  <SegmentedControlItem value="all">All</SegmentedControlItem>
                  <SegmentedControlItem value="cursor-display">Cursor only</SegmentedControlItem>
                </SegmentedControl>
              </Field>
              {selectedDisplay ? (
                <Field label="Hot zones" description="Turn off every zone on this display without deleting its layout.">
                  <OnOffControl
                    checked={selectedDisplay.zones.enabled}
                    label="Enable hot zones"
                    onChange={(enabled) => void updateZones({ ...selectedDisplay.zones, enabled })}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </FieldSet>

          {selectedDisplay ? (
            <FieldSet title="Hot-zone controls" description="Assign one simple system control to each corner or edge.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">Corners</p>
                  <FieldGroup>
                    {CORNERS.map((corner) => (
                      <Field key={corner.id} label={corner.label}>
                        <ZoneRoleSelect
                          value={selectedDisplay.zones.corners[corner.id]}
                          controls={controls}
                          onChange={(role) => updateZoneRole(corner.id, role)}
                        />
                      </Field>
                    ))}
                  </FieldGroup>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">Edges</p>
                  <FieldGroup>
                    {EDGES.map((edge) => (
                      <Field key={edge.id} label={edge.label}>
                        <ZoneRoleSelect
                          value={selectedDisplay.zones.edges[edge.id]}
                          controls={controls}
                          onChange={(role) => updateZoneRole(edge.id, role)}
                        />
                      </Field>
                    ))}
                  </FieldGroup>
                </div>
              </div>
            </FieldSet>
          ) : null}

          <FieldSet title="Preferences">
            <FieldGroup>
              <Field label="Hot-zone size" description={`${settings.hotZoneSize}px from each screen edge.`}>
                <input
                  className="w-40 accent-[var(--theme-accent)]"
                  type="range"
                  min="4"
                  max="48"
                  value={settings.hotZoneSize}
                  onChange={(event) => void updateSettings({ hotZoneSize: Number(event.currentTarget.value) })}
                />
              </Field>
              <Field label="Launch at login" description="Keep Halo available from the menu bar after you sign in.">
                <OnOffControl checked={autoLaunch} label="Launch at login" onChange={setLaunchAtLogin} />
              </Field>
              <Field label="Accessibility" description={controls?.accessibilityTrusted ? "Enabled" : "Not enabled"}>
                <Button size="small" variant="muted" onClick={() => void requestAccessibility()}>
                  Open settings
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex justify-end">
            <Button size="small" variant="transparent" onClick={() => void resetHotZones()}>
              Reset hot-zone measurements
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
