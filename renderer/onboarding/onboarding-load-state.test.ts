import assert from "node:assert/strict";
import test from "node:test";

import {
  createOnboardingLoadErrorState,
  createOnboardingLoadingState,
  resolveOnboardingLoad,
  shouldCloseOnboardingForKey,
} from "./onboarding-load-state.ts";

test("starts onboarding in a visible loading state", () => {
  assert.deepEqual(createOnboardingLoadingState(), { kind: "loading" });
});

test("accepts a usable onboarding payload", () => {
  const state = resolveOnboardingLoad({
    steps: [{ zone: "top-left", role: "brightness", copy: "Try scrubbing brightness here" }],
  });

  assert.deepEqual(state, {
    kind: "ready",
    steps: [{ zone: "top-left", role: "brightness", copy: "Try scrubbing brightness here" }],
  });
});

test("turns an empty or malformed payload into a recoverable error state", () => {
  assert.deepEqual(resolveOnboardingLoad({ steps: [] }), { kind: "error" });
  assert.deepEqual(
    resolveOnboardingLoad({ steps: [{ zone: "not-a-zone", role: "brightness", copy: "Broken" }] }),
    { kind: "error" },
  );
  assert.deepEqual(
    resolveOnboardingLoad({ steps: [{ zone: "top-left", copy: "Broken" }] }),
    { kind: "error" },
  );
});

test("provides a recoverable error state when loading rejects", () => {
  assert.deepEqual(createOnboardingLoadErrorState(), { kind: "error" });
});

test("uses Escape to close onboarding for later unless another control handled it", () => {
  assert.equal(shouldCloseOnboardingForKey("Escape", false), true);
  assert.equal(shouldCloseOnboardingForKey("Escape", true), false);
  assert.equal(shouldCloseOnboardingForKey("Enter", false), false);
});
