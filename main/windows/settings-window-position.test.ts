import assert from "node:assert/strict";
import test from "node:test";

import { centerSettingsWindow } from "./settings-window-position.ts";

test("centers the settings window within a secondary display work area", () => {
  assert.deepEqual(
    centerSettingsWindow({ x: 1920, y: 25, width: 2560, height: 1415 }),
    { x: 2840, y: 353, width: 720, height: 760 },
  );
});

test("preserves a left-hand display's negative origin when centering", () => {
  assert.deepEqual(
    centerSettingsWindow({ x: -1680, y: 0, width: 1680, height: 1050 }),
    { x: -1200, y: 145, width: 720, height: 760 },
  );
});
