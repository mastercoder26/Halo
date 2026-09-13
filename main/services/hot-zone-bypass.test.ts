import assert from "node:assert/strict";
import test from "node:test";

import {
  HOT_ZONE_BYPASS_SHORTCUT_KEYS,
  HOT_ZONE_BYPASS_SHORTCUT_LABEL,
} from "./hot-zone-bypass-shortcut.ts";

test("bypass shortcut labels stay in sync for UI copy", () => {
  assert.equal(HOT_ZONE_BYPASS_SHORTCUT_LABEL, "⌘⇧E");
  assert.equal(HOT_ZONE_BYPASS_SHORTCUT_KEYS, "Command-Shift-E");
});
