import assert from "node:assert/strict";
import test from "node:test";

import { pointInDockRegion } from "./dock-interaction-region.ts";

const bounds = { x: 300, y: 700, width: 312, height: 78 };

test("keeps the dock active throughout its visible window bounds", () => {
  assert.equal(pointInDockRegion({ x: 300, y: 700 }, bounds), true);
  assert.equal(pointInDockRegion({ x: 450, y: 739 }, bounds), true);
  assert.equal(pointInDockRegion({ x: 611, y: 777 }, bounds), true);
});

test("closes the dock after the cursor leaves its window bounds", () => {
  assert.equal(pointInDockRegion({ x: 299, y: 739 }, bounds), false);
  assert.equal(pointInDockRegion({ x: 612, y: 739 }, bounds), false);
  assert.equal(pointInDockRegion({ x: 450, y: 778 }, bounds), false);
});
