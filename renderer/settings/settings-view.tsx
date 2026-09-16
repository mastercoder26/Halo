import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "../lib/app-icon";
import {
  Badge,
  Button,
  Callout,
  Field,
  FieldSet,
  Input,
  ScrollArea,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsRoot,
  TabsTrigger,
  Text,
  toast,
} from "../lib/components";
import appIcon from "../../app-icon.png";
import { parseBoundedInteger } from "./focus-timer-draft";

type ZoneRole =
  | "off"
  | "volume"
  | "brightness"
  | "appearance"
  | "dock"
  | "keyboard-backlight"
  | "mute"
  | "keep-awake"
  | "now-playing"
  | "focus-timer";

type CornerId = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type EdgeId = "left" | "right" | "top" | "bottom";
type ZoneId = CornerId | EdgeId;

interface DisplayZoneSettings {
  enabled: boolean;
  corners: Record<CornerId, ZoneRole>;
  edges: Record<EdgeId, ZoneRole>;
}

interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  internal: boolean;
  zones: DisplayZoneSettings;
}

interface FocusTimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

interface HaloSettings {
  displayMode: "all" | "cursor-display";
  dockApps: string[];
  feedback: { haptics: boolean; sound: boolean };
  hotZoneSize: number;
  insets: { menuBar: number; dock: number; notch: number };
  hasCompletedOnboarding?: boolean;
  focusTimer: FocusTimerSettings;
}

interface DockAppInfo {
  path: string;
  name: string;
}

interface ControlSnapshot {
  volume: number;
  brightness: number;
  appearance: "light" | "dark";
  keyboardBacklight: number;
  muted: boolean;
  keepAwake: boolean;
  accessibilityTrusted: boolean;
  brightnessSupported: boolean;
  keyboardSupported: boolean;
}

const ROLE_OPTIONS: { value: ZoneRole; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "volume", label: "Volume" },
  { value: "brightness", label: "Brightness" },
  { value: "appearance", label: "Appearance" },
  { value: "mute", label: "Mute" },
  { value: "keep-awake", label: "Keep Awake" },
  { value: "now-playing", label: "Now Playing" },
  { value: "dock", label: "Dock" },
  { value: "keyboard-backlight", label: "Keyboard" },
  { value: "focus-timer", label: "Focus Timer" },
];

const ROLE_LABEL: Record<ZoneRole, string> = Object.fromEntries(
  ROLE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ZoneRole, string>;

const CORNERS: { id: CornerId; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
];

const EDGES: { id: EdgeId; label: string }[] = [
  { id: "left", label: "Left edge" },
  { id: "right", label: "Right edge" },
  { id: "top", label: "Top edge" },
  { id: "bottom", label: "Bottom edge" },
];

const APP_PICKER_ID = "quick-dock-app-picker";

function SettingsEyebrow({ children }: { children: string }) {
  return <p className="halo-settings-eyebrow text-secondary mb-2">{children}</p>;
}

function OnOffControl({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <SegmentedControl
      size="small"
      value={checked ? "on" : "off"}
      onValueChange={(value) => {
        if (value === "on" || value === "off") onCheckedChange(value === "on");
      }}
      aria-label={ariaLabel}
    >
      <SegmentedControlItem value="on">On</SegmentedControlItem>
      <SegmentedControlItem value="off">Off</SegmentedControlItem>
    </SegmentedControl>
  );
}

function FocusTimerNumberInput({
  value,
  minimum,
  maximum,
  onCommit,
}: {
  value: number;
  minimum: number;
  maximum: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const next = parseBoundedInteger(draft, minimum, maximum);
    if (next === null) {
      setDraft(String(value));
      return;
    }
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <Input
      size="small"
      type="number"
      min={minimum}
      max={maximum}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        commit();
      }}
    />
  );
}

const CORNER_MAP: { id: CornerId; chip: string; dataCorner: string }[] = [
  { id: "top-left", chip: "TL", dataCorner: "tl" },
  { id: "top-right", chip: "TR", dataCorner: "tr" },
  { id: "bottom-left", chip: "BL", dataCorner: "bl" },
  { id: "bottom-right", chip: "BR", dataCorner: "br" },
];

const EDGE_MAP: { id: EdgeId; label: string; dataEdge: string }[] = [
  { id: "top", label: "Top edge", dataEdge: "top" },
  { id: "bottom", label: "Bottom edge", dataEdge: "bottom" },
  { id: "left", label: "Left", dataEdge: "left" },
  { id: "right", label: "Right", dataEdge: "right" },
];

function zoneLabel(zone: ZoneId): string {
  const corner = CORNERS.find((c) => c.id === zone);
  if (corner) return corner.label;
  return EDGES.find((e) => e.id === zone)?.label ?? zone;
}

function isCornerZone(zone: ZoneId): zone is CornerId {
  return CORNERS.some((c) => c.id === zone);
}

function ZoneMap({
  zones,
  selected,
  onSelect,
}: {
  zones: DisplayZoneSettings;
  selected: ZoneId | null;
  onSelect: (zone: ZoneId) => void;
}) {
  return (
    <div className="halo-zone-map" role="group" aria-label="Hot zone map">
      {EDGE_MAP.map((edge) => (
        <button
          key={edge.id}
          type="button"
          className="halo-zone-map-edge"
          data-edge={edge.dataEdge}
          data-selected={selected === edge.id ? "true" : undefined}
          aria-pressed={selected === edge.id}
          aria-label={`${edge.label}: ${ROLE_LABEL[zones.edges[edge.id]]}. Click to customize.`}
          onClick={() => onSelect(edge.id)}
        >
          {edge.label}
        </button>
      ))}
      <div className="halo-zone-map-screen">
        {CORNER_MAP.map((corner) => (
          <button
            key={corner.id}
            type="button"
            className="halo-zone-map-corner"
            data-corner={corner.dataCorner}
            data-selected={selected === corner.id ? "true" : undefined}
            aria-pressed={selected === corner.id}
            aria-label={`${zoneLabel(corner.id)}: ${ROLE_LABEL[zones.corners[corner.id]]}. Click to customize.`}
            title={ROLE_LABEL[zones.corners[corner.id]]}
            onClick={() => onSelect(corner.id)}
          >
            {corner.chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  ariaLabel,
  keyboardSupported = false,
  brightnessSupported = true,
}: {
  value: ZoneRole;
  onChange: (role: ZoneRole) => void;
  ariaLabel: string;
  keyboardSupported?: boolean;
  brightnessSupported?: boolean;
}) {
  const roleOptions = ROLE_OPTIONS.filter((option) => {
    if (option.value === "keyboard-backlight" && !keyboardSupported) return false;
    if (option.value === "brightness" && !brightnessSupported) return false;
    return true;
  });

  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ZoneRole)}>
      <SelectTrigger
        variant="transparent"
        size="small"
        className="min-w-[136px]"
        aria-label={ariaLabel}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {value === "keyboard-backlight" && !keyboardSupported ? (
          <SelectItem value="keyboard-backlight" disabled>
            Keyboard (unavailable)
          </SelectItem>
        ) : null}
        {value === "brightness" && !brightnessSupported ? (
          <SelectItem value="brightness" disabled>
            Brightness (unavailable)
          </SelectItem>
        ) : null}
        {roleOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsView() {
  const [settings, setSettings] = useState<HaloSettings | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(null);
  const [dockApps, setDockApps] = useState<DockAppInfo[]>([]);
  const [controls, setControls] = useState<ControlSnapshot | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [installedApps, setInstalledApps] = useState<DockAppInfo[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [focusedZone, setFocusedZone] = useState<ZoneId | null>("top-left");
  const [settingsTab, setSettingsTab] = useState("general");
  const [autoLaunch, setAutoLaunch] = useState(false);
  const pickerGeneration = useRef(0);

  const selected = displays.find((d) => d.id === selectedDisplayId) ?? displays[0] ?? null;
  const filteredInstalledApps = useMemo(() => {
    const query = appSearch.trim().toLocaleLowerCase();
    if (!query) return installedApps;
    return installedApps.filter((app) => app.name.toLocaleLowerCase().includes(query));
  }, [appSearch, installedApps]);
  const visibleInstalledApps = filteredInstalledApps.slice(0, 40);

  const loadAll = useCallback(async () => {
    try {
      const [s, d, apps, c, launch] = await Promise.all([
        window.haloAPI.ipc.invoke<HaloSettings>("halo:getSettings"),
        window.haloAPI.ipc.invoke<DisplayInfo[]>("halo:getDisplays"),
        window.haloAPI.ipc.invoke<DockAppInfo[]>("halo:getBaseDockApps"),
        window.haloAPI.ipc.invoke<ControlSnapshot>("halo:getControls"),
        window.haloAPI.ipc.invoke<boolean>("halo:getAutoLaunch").catch(() => false),
      ]);
      setSettings(s);
      setDisplays(d);
      setDockApps(apps);
      setControls(c);
      setAutoLaunch(launch);
      setSelectedDisplayId((current) =>
        current != null && d.some((display) => display.id === current)
          ? current
          : (d[0]?.id ?? null),
      );
    } catch (error) {
      toast.error(`Failed to load settings: ${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsub = window.haloAPI.ipc.on("halo:settings-focus", (_event, payload) => {
      const next = payload as { tab?: string; zone?: ZoneId; displayId?: number } | null;
      if (!next || typeof next !== "object") return;
      if (typeof next.tab === "string") setSettingsTab(next.tab);
      if (typeof next.displayId === "number") setSelectedDisplayId(next.displayId);
      if (
        next.zone === "top-left" ||
        next.zone === "top-right" ||
        next.zone === "bottom-left" ||
        next.zone === "bottom-right" ||
        next.zone === "left" ||
        next.zone === "right" ||
        next.zone === "top" ||
        next.zone === "bottom"
      ) {
        setFocusedZone(next.zone);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      void window.haloAPI.ipc.invoke("window:closeSettings");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pickerOpen]);

  const patchSettings = async (patch: Partial<HaloSettings>) => {
    try {
      const next = await window.haloAPI.ipc.invoke<HaloSettings>(
        "halo:updateSettings",
        patch,
      );
      setSettings(next);
    } catch (error) {
      toast.error(`Could not update settings: ${errorMessage(error)}`);
    }
  };

  const setLaunchAtLogin = async (openAtLogin: boolean) => {
    setAutoLaunch(openAtLogin);
    try {
      const applied = await window.haloAPI.ipc.invoke<boolean>(
        "halo:setAutoLaunch",
        openAtLogin,
      );
      setAutoLaunch(applied);
    } catch (error) {
      setAutoLaunch(!openAtLogin);
      toast.error(`Could not update launch at login: ${errorMessage(error)}`);
    }
  };

  const updateZones = async (
    zones: DisplayZoneSettings,
  ): Promise<DisplayZoneSettings | null> => {
    if (!selected) return null;
    try {
      const savedZones = await window.haloAPI.ipc.invoke<DisplayZoneSettings>(
        "halo:setDisplayZones",
        selected.id,
        zones,
      );
      setDisplays((current) =>
        current.map((display) =>
          display.id === selected.id ? { ...display, zones: savedZones } : display,
        ),
      );
      return savedZones;
    } catch (error) {
      toast.error(`Could not update hot zones: ${errorMessage(error)}`);
      return null;
    }
  };

  const openAppPicker = async () => {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    const openGeneration = pickerGeneration.current + 1;
    pickerGeneration.current = openGeneration;
    setPickerOpen(true);
    if (installedApps.length === 0) {
      setPickerLoading(true);
      try {
        const list =
          await window.haloAPI.ipc.invoke<DockAppInfo[]>("halo:listInstalledApps");
        if (pickerGeneration.current !== openGeneration) return;
        setInstalledApps(list);
      } catch (error) {
        if (pickerGeneration.current !== openGeneration) return;
        toast.error(`Could not list apps: ${errorMessage(error)}`);
        setPickerOpen(false);
      } finally {
        if (pickerGeneration.current === openGeneration) setPickerLoading(false);
      }
    }
  };

  const addApp = async (appPath: string) => {
    try {
      await window.haloAPI.ipc.invoke("halo:addDockApp", appPath);
      await loadAll();
      toast.success("Added to dock");
    } catch (error) {
      toast.error(`Could not add app: ${errorMessage(error)}`);
    }
  };

  const removeApp = async (path: string) => {
    try {
      const next = dockApps.filter((app) => app.path !== path).map((app) => app.path);
      await window.haloAPI.ipc.invoke("halo:setDockApps", next);
      await loadAll();
    } catch (error) {
      toast.error(`Could not remove app: ${errorMessage(error)}`);
    }
  };

  const requestAccess = async () => {
    try {
      const result = await window.haloAPI.ipc.invoke<{ trusted: boolean }>(
        "halo:requestAccessibility",
      );
      if (!result.trusted) {
        await window.haloAPI.ipc.invoke("halo:openAccessibilitySettings");
        toast.message("Enable Halo in Privacy → Accessibility, then return here.");
      } else {
        toast.success("Accessibility is enabled");
      }
      await loadAll();
    } catch (error) {
      toast.error(`Could not request accessibility access: ${errorMessage(error)}`);
    }
  };

  const recalibrate = async () => {
    try {
      await window.haloAPI.ipc.invoke("halo:recalibrate");
      await loadAll();
      toast.success("Hot zones reset");
    } catch (error) {
      toast.error(`Could not reset hot zones: ${errorMessage(error)}`);
    }
  };

  const restartWalkthrough = async () => {
    try {
      await window.haloAPI.ipc.invoke("halo:restartOnboarding");
    } catch (error) {
      toast.error(`Could not restart walkthrough: ${errorMessage(error)}`);
    }
  };

  const exportSettings = async () => {
    try {
      const result = await window.haloAPI.ipc.invoke<{
        ok: boolean;
        canceled?: boolean;
        error?: string;
      }>("halo:exportSettings");
      if (result?.canceled) return;
      if (result?.ok) {
        toast.success("Settings exported");
      } else {
        toast.error(`Could not export settings: ${result?.error ?? "unknown error"}`);
      }
    } catch (error) {
      toast.error(`Could not export settings: ${errorMessage(error)}`);
    }
  };

  const importSettings = async () => {
    try {
      const result = await window.haloAPI.ipc.invoke<{
        ok: boolean;
        canceled?: boolean;
        error?: string;
      }>("halo:importSettings");
      if (result?.canceled) return;
      if (result?.ok) {
        await loadAll();
        toast.success("Settings imported");
      } else {
        toast.error(`Could not import settings: ${result?.error ?? "unknown error"}`);
      }
    } catch (error) {
      toast.error(`Could not import settings: ${errorMessage(error)}`);
    }
  };

  const selectZone = useCallback((zone: ZoneId) => {
    setFocusedZone(zone);
    window.requestAnimationFrame(() => {
      document.getElementById("halo-zone-editor")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
      });
    });
  }, []);

  const setZoneRole = (zone: ZoneId, nextRole: ZoneRole) => {
    if (!selected) return;
    if (isCornerZone(zone)) {
      void updateZones({
        ...selected.zones,
        corners: { ...selected.zones.corners, [zone]: nextRole },
      });
      return;
    }
    void updateZones({
      ...selected.zones,
      edges: { ...selected.zones.edges, [zone]: nextRole },
    });
  };

  const focusedRole: ZoneRole | null =
    selected && focusedZone
      ? isCornerZone(focusedZone)
        ? selected.zones.corners[focusedZone]
        : selected.zones.edges[focusedZone]
      : null;
  return (
    <ScrollArea className="h-full" title="Settings">
      <div className="mx-auto mb-14 flex w-full max-w-[760px] flex-col px-7 pt-2">
        <div className="halo-settings-header drag-region mb-5 flex min-h-11 items-center gap-3 pt-1">
          <img
            className="no-drag size-9 shrink-0 rounded-[10px] object-cover"
            src={appIcon}
            width={36}
            height={36}
            alt=""
            draggable={false}
          />
          <h1 className="halo-wordmark no-drag text-primary min-w-0 flex-1">Halo</h1>
        </div>

        <TabsRoot
          value={settingsTab}
          onValueChange={setSettingsTab}
          className="no-drag"
        >
          <Tabs variant="filled" size="medium">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="hot-zones">Hot Zones</TabsTrigger>
            <TabsTrigger value="quick-dock">Quick Dock</TabsTrigger>
          </Tabs>

          <TabsContent value="general" className="halo-settings-panel mt-7 flex flex-col gap-9">
            {controls ? (
              controls.accessibilityTrusted ? (
                <div className="flex flex-col gap-3">
                  <SettingsEyebrow>Accessibility Access</SettingsEyebrow>
                  <FieldSet>
                    <Field label="Accessibility" description="Halo can control system settings.">
                      <Badge>Allowed</Badge>
                    </Field>
                  </FieldSet>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <SettingsEyebrow>Accessibility Access</SettingsEyebrow>
                  <div className="flex flex-col gap-3 rounded-card bg-well p-4">
                    <Text color="secondary" variant="small" as="p">
                      Halo requires permission to interact with other applications and manage
                      system-level UI controls.
                    </Text>
                    <Button
                      className="self-start"
                      size="small"
                      variant="transparent"
                      onClick={() => void requestAccess()}
                    >
                      Open Privacy Settings
                    </Button>
                  </div>
                </div>
              )
            ) : null}

            {controls ? (
              <div className="flex flex-col gap-3">
                <SettingsEyebrow>Status</SettingsEyebrow>
                <FieldSet description="Live system toggles Halo can drive from hot zones.">
                  <Field label="Mute">
                    <Badge>{controls.muted ? "Muted" : "Unmuted"}</Badge>
                  </Field>
                  <Field label="Keep Awake" description="Session-only display sleep prevention.">
                    <Badge>{controls.keepAwake ? "On" : "Off"}</Badge>
                  </Field>
                </FieldSet>
              </div>
            ) : null}

            {settings ? (
              <div className="flex flex-col gap-3">
                <SettingsEyebrow>Bypass Hot Zones</SettingsEyebrow>
                <Callout>
                  <Text variant="small" as="p" className="text-primary">
                    Hold <span className="halo-kbd">⌘⇧E</span> (Command-Shift-E) to temporarily
                    disable every hot zone.
                  </Text>
                  <Text variant="small" color="secondary" as="p" className="mt-2">
                    Keep holding while you click the menu bar clock, a window’s close button, or
                    anything else in a corner or along an edge. Release the keys and Halo’s zones
                    come back immediately.
                  </Text>
                </Callout>
              </div>
            ) : null}

            {settings ? (
              <div className="flex flex-col gap-3">
                <SettingsEyebrow>Global Parameters</SettingsEyebrow>
                <FieldSet>
                  <Field label="Launch at Login" description="Start Halo automatically when you sign in.">
                    <OnOffControl
                      checked={autoLaunch}
                      ariaLabel="Launch at login"
                      onCheckedChange={(value) => void setLaunchAtLogin(value)}
                    />
                  </Field>
                  <Field label="Haptic Feedback" description="Feel detents and zone reveals.">
                    <OnOffControl
                      checked={settings.feedback.haptics}
                      ariaLabel="Haptic feedback"
                      onCheckedChange={(haptics) =>
                        void patchSettings({ feedback: { ...settings.feedback, haptics } })
                      }
                    />
                  </Field>
                  <Field label="Interface Sound" description="Play a quiet system sound on changes.">
                    <OnOffControl
                      checked={settings.feedback.sound}
                      ariaLabel="Interface sound"
                      onCheckedChange={(sound) =>
                        void patchSettings({ feedback: { ...settings.feedback, sound } })
                      }
                    />
                  </Field>
                  <Field
                    label="Multi-Display Zones"
                    description="Controls where hot zones are evaluated."
                  >
                    <Select
                      value={settings.displayMode}
                      onValueChange={(value) =>
                        void patchSettings({
                          displayMode: value as HaloSettings["displayMode"],
                        })
                      }
                    >
                      <SelectTrigger variant="transparent" size="small" className="min-w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All enabled</SelectItem>
                        <SelectItem value="cursor-display">Follow cursor</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldSet>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <SettingsEyebrow>Maintenance</SettingsEyebrow>
              <FieldSet>
                <Field
                  label="Reset Hot Zones"
                  description="Restore zone sizing and screen-edge spacing."
                >
                  <Button size="small" variant="muted" onClick={() => void recalibrate()}>
                    Reset
                  </Button>
                </Field>
                <Field
                  label="Walkthrough"
                  description="Review permissions and test Halo's controls again."
                >
                  <Button size="small" variant="muted" onClick={() => void restartWalkthrough()}>
                    Start again
                  </Button>
                </Field>
                <Field
                  label="Export Settings"
                  description="Save zones, dock apps, feedback, and timer settings to a file."
                >
                  <Button size="small" variant="muted" onClick={() => void exportSettings()}>
                    Export…
                  </Button>
                </Field>
                <Field
                  label="Import Settings"
                  description="Replace current settings from a previously exported file."
                >
                  <Button size="small" variant="muted" onClick={() => void importSettings()}>
                    Import…
                  </Button>
                </Field>
              </FieldSet>
            </div>
          </TabsContent>

          <TabsContent value="hot-zones" className="halo-settings-panel mt-7 flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <div>
                <SettingsEyebrow>Interactive Mapping</SettingsEyebrow>
                <Text color="secondary" variant="small" as="p" className="mt-1">
                  Click a corner or edge to customize it.
                </Text>
              </div>
              {selected ? (
                <ZoneMap
                  zones={selected.zones}
                  selected={focusedZone}
                  onSelect={selectZone}
                />
              ) : null}
              <FieldSet>
                <Field
                  label="Display"
                  description={selected?.primary ? "Primary display" : undefined}
                >
                  <Select
                    value={selected ? String(selected.id) : undefined}
                    onValueChange={(value) => setSelectedDisplayId(Number(value))}
                  >
                    <SelectTrigger variant="transparent" size="small" className="min-w-[180px]">
                      <SelectValue placeholder="Choose a display" />
                    </SelectTrigger>
                    <SelectContent>
                      {displays.map((display) => (
                        <SelectItem key={display.id} value={String(display.id)}>
                          {display.label}
                          {display.primary ? " · Primary" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {selected ? (
                  <Field label="Hot Zones" description="Enable corners and edges on this display.">
                    <OnOffControl
                      checked={selected.zones.enabled}
                      ariaLabel="Enable hot zones"
                      onCheckedChange={(enabled) =>
                        void updateZones({ ...selected.zones, enabled })
                      }
                    />
                  </Field>
                ) : null}
              </FieldSet>
            </div>

            {controls && !controls.brightnessSupported ? (
              <Callout>
                <Text variant="strong" as="p">
                  Brightness unavailable
                </Text>
                <Text color="secondary" variant="small" as="p">
                  This Mac cannot expose display brightness to Halo, so that role is hidden from the
                  menus.
                </Text>
              </Callout>
            ) : null}

            {selected && focusedZone && focusedRole !== null ? (
              <div
                id="halo-zone-editor"
                className="flex flex-col gap-4 rounded-card border border-separator bg-well p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <SettingsEyebrow>Customize</SettingsEyebrow>
                    <Text variant="strong" as="p" className="mt-1">
                      {zoneLabel(focusedZone)}
                    </Text>
                  </div>
                  <Badge>{ROLE_LABEL[focusedRole]}</Badge>
                </div>
                <FieldSet>
                  <Field label="Role" description="What this hot zone controls.">
                    <RoleSelect
                      value={focusedRole}
                      ariaLabel={`${zoneLabel(focusedZone)} role`}
                      keyboardSupported={controls?.keyboardSupported}
                      brightnessSupported={controls?.brightnessSupported ?? true}
                      onChange={(nextRole) => setZoneRole(focusedZone, nextRole as ZoneRole)}
                    />
                  </Field>
                </FieldSet>
                {focusedRole === "focus-timer" && settings?.focusTimer ? (
                  <div className="flex flex-col gap-2 rounded-control bg-well p-3">
                    <Field
                      label="Focus minutes"
                      description="Length of each focus block."
                    >
                      <FocusTimerNumberInput
                        value={settings.focusTimer.focusMinutes}
                        minimum={1}
                        maximum={90}
                        onCommit={(focusMinutes) =>
                          void patchSettings({
                            focusTimer: { ...settings.focusTimer, focusMinutes },
                          })
                        }
                      />
                    </Field>
                    <Field label="Short break" description="Minutes between focus blocks.">
                      <FocusTimerNumberInput
                        value={settings.focusTimer.shortBreakMinutes}
                        minimum={1}
                        maximum={60}
                        onCommit={(shortBreakMinutes) =>
                          void patchSettings({
                            focusTimer: { ...settings.focusTimer, shortBreakMinutes },
                          })
                        }
                      />
                    </Field>
                    <Field label="Long break" description="Minutes after a full cycle.">
                      <FocusTimerNumberInput
                        value={settings.focusTimer.longBreakMinutes}
                        minimum={1}
                        maximum={60}
                        onCommit={(longBreakMinutes) =>
                          void patchSettings({
                            focusTimer: { ...settings.focusTimer, longBreakMinutes },
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Cycles before long break"
                      description="Focus blocks before the long break."
                    >
                      <FocusTimerNumberInput
                        value={settings.focusTimer.cyclesBeforeLongBreak}
                        minimum={1}
                        maximum={8}
                        onCommit={(cyclesBeforeLongBreak) =>
                          void patchSettings({
                            focusTimer: { ...settings.focusTimer, cyclesBeforeLongBreak },
                          })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selected ? (
              <>
                <div className="flex flex-col gap-3">
                  <SettingsEyebrow>Corners</SettingsEyebrow>
                  <div className="halo-settings-list">
                    {CORNERS.map((c) => {
                      const role = selected.zones.corners[c.id];
                      const active = focusedZone === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`halo-settings-list-row halo-settings-list-row--button${active ? " halo-settings-list-row--active" : ""}`}
                          aria-pressed={active}
                          onClick={() => selectZone(c.id)}
                        >
                          <div className="min-w-0 text-left">
                            <Text variant="small" as="p">
                              {c.label}
                            </Text>
                            <Text color="tertiary" variant="small" as="p" className="mt-0.5 truncate">
                              {ROLE_LABEL[role]}
                            </Text>
                          </div>
                          <Text color="secondary" variant="small" className="shrink-0">
                            Edit
                          </Text>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <SettingsEyebrow>Edges</SettingsEyebrow>
                  <div className="halo-settings-list">
                    {EDGES.map((e) => {
                      const role = selected.zones.edges[e.id];
                      const active = focusedZone === e.id;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`halo-settings-list-row halo-settings-list-row--button${active ? " halo-settings-list-row--active" : ""}`}
                          aria-pressed={active}
                          onClick={() => selectZone(e.id)}
                        >
                          <div className="min-w-0 text-left">
                            <Text variant="small" as="p">
                              {e.label}
                            </Text>
                            <Text color="tertiary" variant="small" as="p" className="mt-0.5 truncate">
                              {ROLE_LABEL[role]}
                            </Text>
                          </div>
                          <Text color="secondary" variant="small" className="shrink-0">
                            Edit
                          </Text>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="quick-dock" className="halo-settings-panel mt-7 flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <SettingsEyebrow>Quick Dock Apps</SettingsEyebrow>
                <Text color="secondary" variant="small" as="p" className="mt-1">
                  Apps available from your Dock hot zone.
                </Text>
              </div>
              <Badge className="tabular-nums shrink-0">{dockApps.length} of 8</Badge>
            </div>

            <div className="halo-settings-list">
              {dockApps.map((app) => (
                <div key={app.path} className="halo-settings-list-row">
                  <div className="flex min-w-0 items-center gap-3">
                    <AppIcon
                      appPath={app.path}
                      size={32}
                      className="size-8 shrink-0 rounded-lg object-contain"
                    />
                    <Text variant="small" className="truncate">
                      {app.name}
                    </Text>
                  </div>
                  <Button
                    size="small"
                    variant="transparent"
                    aria-label={`Remove ${app.name} from Quick Dock`}
                    onClick={() => void removeApp(app.path)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {dockApps.length === 0 ? (
                <Text color="secondary" variant="small" className="py-3">
                  No apps yet.
                </Text>
              ) : null}
            </div>

            <Button
              className="self-start"
              size="small"
              variant="transparent"
              aria-expanded={pickerOpen}
              aria-controls={APP_PICKER_ID}
              onClick={() => void openAppPicker()}
            >
              {pickerOpen ? "Done" : "Manage Apps"}
            </Button>

            {pickerOpen ? (
              <div
                id={APP_PICKER_ID}
                className="halo-inline-picker flex flex-col gap-3 rounded-card bg-well p-3"
              >
                <Input
                  size="small"
                  aria-label="Search applications"
                  placeholder="Search applications"
                  value={appSearch}
                  onChange={(event) => setAppSearch(event.target.value)}
                  autoFocus
                />
                {pickerLoading ? (
                  <Text color="secondary" variant="small" className="px-2 py-4">
                    Scanning applications…
                  </Text>
                ) : (
                  <div className="halo-picker-list flex max-h-72 flex-col gap-1 overflow-y-auto">
                    {visibleInstalledApps.map((app) => {
                      const added = dockApps.some((a) => a.path === app.path);
                      const full = dockApps.length >= 8;
                      return (
                        <Button
                          key={app.path}
                          disabled={added || full}
                          variant="transparent"
                          size="small"
                          aria-label={
                            added
                              ? `${app.name} already added`
                              : full
                                ? "Quick Dock full"
                                : `Add ${app.name}`
                          }
                          className="h-auto w-full justify-start gap-3 px-2 py-1.5 text-left"
                          onClick={() => void addApp(app.path)}
                        >
                          <AppIcon
                            appPath={app.path}
                            size={28}
                            className="size-7 shrink-0 rounded-md object-contain"
                          />
                          <Text className="min-w-0 flex-1 truncate" variant="small">
                            {app.name}
                          </Text>
                          <Text color="secondary" variant="small">
                            {added ? "Added" : full ? "Dock full" : "Add"}
                          </Text>
                        </Button>
                      );
                    })}
                    {installedApps.length > 0 && filteredInstalledApps.length === 0 ? (
                      <Text color="secondary" variant="small" className="px-2 py-3">
                        No matching apps.
                      </Text>
                    ) : null}
                    {filteredInstalledApps.length > visibleInstalledApps.length ? (
                      <Text color="tertiary" variant="small" className="px-2 py-3 text-center">
                        Showing the first 40 apps. Search to narrow the list.
                      </Text>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </TabsContent>
        </TabsRoot>
      </div>
    </ScrollArea>
  );
}
