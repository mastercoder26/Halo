import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeSettings } from "./settings-sanitization.ts";

test("narrows persisted settings to the supported cursor controls", () => {
  const settings = sanitizeSettings({
    displayMode: "only-this-display",
    insets: { menuBar: 32, dock: -9, notch: Number.POSITIVE_INFINITY },
    unsupportedFeature: { enabled: true },
    displays: {
      "1": {
        enabled: "yes",
        corners: {
          "top-left": "brightness",
          "top-right": "unsupported-role",
          "bottom-left": "volume",
          "bottom-right": "unsupported-role",
        },
        edges: { left: "volume", right: "unsupported-role" },
      },
      invalid: "not-a-zone-config",
    },
  });

  assert.equal(settings.displayMode, "all");
  assert.deepEqual(settings.insets, { menuBar: 32, dock: 0, notch: 0 });
  assert.deepEqual(settings.displays, {
    "1": {
      enabled: true,
      corners: {
        "top-left": "brightness",
        "top-right": "off",
        "bottom-left": "volume",
        "bottom-right": "off",
      },
      edges: { left: "volume", right: "off", top: "off", bottom: "off" },
    },
  });
  assert.equal("unsupportedFeature" in settings, false);
});

test("keeps a valid core setting when an update patch has an invalid container", () => {
  const current = sanitizeSettings({
    displayMode: "cursor-display",
    insets: { menuBar: 40, dock: 24, notch: 6 },
    displays: {
      "1": {
        enabled: false,
        corners: {},
        edges: {},
      },
    },
  });

  const next = sanitizeSettings(
    { ...current, displayMode: "invalid", insets: [] },
    current,
  );

  assert.equal(next.displayMode, "cursor-display");
  assert.deepEqual(next.insets, { menuBar: 40, dock: 24, notch: 6 });
  assert.deepEqual(next.displays, current.displays);
});
