import assert from "node:assert/strict";
import test from "node:test";

import {
  controlAccessibleLabel,
  controlRole,
  edgeSliderOrientation,
} from "./control-accessibility.ts";

test("describes now-playing controls as a named group", () => {
  assert.equal(controlRole("now-playing"), "group");
  assert.equal(
    controlAccessibleLabel(
      "now-playing",
      "Now Playing",
      { title: "Golden Hour", artist: "Kacey Musgraves", playing: true, position: 0, duration: 0 },
      "Halo dial control",
    ),
    "Golden Hour playback controls",
  );
});

test("keeps value controls as sliders and toggles as switches", () => {
  assert.equal(controlRole("volume"), "slider");
  assert.equal(controlRole("mute"), "switch");
});

test("only gives true edge sliders an orientation", () => {
  assert.equal(edgeSliderOrientation("volume", true), "vertical");
  assert.equal(edgeSliderOrientation("volume", false), "horizontal");
  assert.equal(edgeSliderOrientation("now-playing", true), undefined);
  assert.equal(edgeSliderOrientation("mute", false), undefined);
});
