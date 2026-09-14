import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeSettings } from "./settings-sanitization.ts";

test("sanitizes malformed persisted and imported settings", () => {
  const settings = sanitizeSettings({
    displayMode: "only-this-display",
    feedback: { haptics: "yes", sound: "no" },
    insets: { menuBar: 32, dock: -9, notch: Number.POSITIVE_INFINITY },
    dockApps: [
      " /Applications/Safari.app ",
      "relative.app",
      "/Applications/Safari.app",
      "/tmp/not-an-app",
      42,
    ],
    displays: {
      "1": {
        enabled: "yes",
        corners: { "top-left": "brightness", "top-right": "not-a-role" },
        edges: { left: "volume", right: "not-a-role" },
      },
      invalid: "not-a-zone-config",
    },
    focusTimer: {
      focusMinutes: "not-a-number",
      shortBreakMinutes: 0,
      longBreakMinutes: 120,
      cyclesBeforeLongBreak: 2.3,
    },
  });

  assert.equal(settings.displayMode, "all");
  assert.deepEqual(settings.feedback, { haptics: true, sound: false });
  assert.deepEqual(settings.insets, { menuBar: 32, dock: 0, notch: 0 });
  assert.deepEqual(settings.dockApps, ["/Applications/Safari.app"]);
  assert.deepEqual(settings.displays, {
    "1": {
      enabled: true,
      corners: {
        "top-left": "brightness",
        "top-right": "off",
        "bottom-left": "volume",
        "bottom-right": "dock",
      },
      edges: { left: "volume", right: "off", top: "off", bottom: "off" },
    },
  });
  assert.deepEqual(settings.focusTimer, {
    focusMinutes: 25,
    shortBreakMinutes: 1,
    longBreakMinutes: 60,
    cyclesBeforeLongBreak: 2,
  });
});

test("keeps a valid current setting when an update patch has an invalid container", () => {
  const current = sanitizeSettings({
    displayMode: "cursor-display",
    feedback: { haptics: false, sound: true },
    insets: { menuBar: 40, dock: 24, notch: 6 },
    dockApps: ["/Applications/Notes.app"],
    displays: {
      "1": {
        enabled: false,
        corners: {},
        edges: {},
      },
    },
  });

  const next = sanitizeSettings(
    { ...current, displayMode: "invalid", feedback: null, insets: [], dockApps: "bad" },
    current,
  );

  assert.equal(next.displayMode, "cursor-display");
  assert.deepEqual(next.feedback, { haptics: false, sound: true });
  assert.deepEqual(next.insets, { menuBar: 40, dock: 24, notch: 6 });
  assert.deepEqual(next.dockApps, ["/Applications/Notes.app"]);
  assert.deepEqual(next.displays, current.displays);
});
