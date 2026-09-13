import { execFile } from "node:child_process";

import { logger, shell } from "../platform/electron.js";

import { settingsStore } from "./settings-store.js";
import { resolveNativeHelper } from "./native-helper.js";
import type { HaloSettings } from "../types.js";

let cached: HaloSettings["feedback"] | null = null;

void settingsStore.load().then((s) => {
  cached = s.feedback;
});
settingsStore.onChange((s) => {
  cached = s.feedback;
});

export async function hapticLevelChange(): Promise<void> {
  if (cached && !cached.haptics) return;
  performHaptic("generic");
}

export async function hapticAlignment(): Promise<void> {
  if (cached && !cached.haptics) return;
  performHaptic("alignment");
}

function performHaptic(pattern: "generic" | "alignment"): void {
  const helper = resolveNativeHelper("haptic");
  if (!helper) return;
  execFile(helper, [pattern], (error) => {
    if (error) logger.debug("feedback", "Haptic failed", error);
  });
}

export async function optionalBeep(): Promise<void> {
  if (!cached?.sound) return;
  try {
    shell.beep();
  } catch (error) {
    logger.debug("feedback", "Beep failed", error);
  }
}

/** Shared feedback entry point for zone reveal and level detents. */
export async function levelDetentFeedback(): Promise<void> {
  await hapticLevelChange();
  await optionalBeep();
}
