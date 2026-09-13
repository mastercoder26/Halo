import assert from "node:assert/strict";
import test from "node:test";

import { pointInDialRegion, pointInEdgeControlRegion } from "./dial-interaction-region.ts";

const displayBounds = { x: 100, y: 200, width: 1_000, height: 800 };

test("keeps corner dials active across their full visible area", () => {
  assert.equal(
    pointInDialRegion({ x: 250, y: 350 }, displayBounds, "top-left", 256),
    true,
  );
  assert.equal(
    pointInDialRegion({ x: 950, y: 350 }, displayBounds, "top-right", 256),
    true,
  );
  assert.equal(
    pointInDialRegion({ x: 250, y: 850 }, displayBounds, "bottom-left", 256),
    true,
  );
  assert.equal(
    pointInDialRegion({ x: 950, y: 850 }, displayBounds, "bottom-right", 256),
    true,
  );
});

test("does not keep a dial active after leaving its window bounds", () => {
  assert.equal(
    pointInDialRegion({ x: 360, y: 300 }, displayBounds, "top-left", 256),
    false,
  );
  assert.equal(
    pointInDialRegion({ x: 200, y: 460 }, displayBounds, "top-left", 256),
    false,
  );
});

test("keeps edge controls active across their flush-to-edge bar bounds", () => {
  // Bar is centered along the display's long axis and flush against the edge.
  assert.equal(
    pointInEdgeControlRegion({ x: 120, y: 600 }, displayBounds, "left", 220, 72),
    true,
  );
  assert.equal(
    pointInEdgeControlRegion({ x: 1050, y: 600 }, displayBounds, "right", 220, 72),
    true,
  );
  assert.equal(
    pointInEdgeControlRegion({ x: 600, y: 220 }, displayBounds, "top", 220, 72),
    true,
  );
  assert.equal(
    pointInEdgeControlRegion({ x: 600, y: 960 }, displayBounds, "bottom", 220, 72),
    true,
  );
});

test("does not keep an edge control active outside its bar bounds", () => {
  assert.equal(
    pointInEdgeControlRegion({ x: 175, y: 600 }, displayBounds, "left", 220, 72),
    false,
  );
  assert.equal(
    pointInEdgeControlRegion({ x: 120, y: 250 }, displayBounds, "left", 220, 72),
    false,
  );
});
