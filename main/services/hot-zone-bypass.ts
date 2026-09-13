import { execFile } from "node:child_process";

import { resolveNativeHelper } from "./native-helper.js";

export {
  HOT_ZONE_BYPASS_SHORTCUT_KEYS,
  HOT_ZONE_BYPASS_SHORTCUT_LABEL,
} from "./hot-zone-bypass-shortcut.js";

/**
 * True while Command+Shift+E is physically held (any app focused).
 * Used so hot zones stay off for the duration of the hold.
 */
export function readBypassChordHeld(): Promise<boolean> {
  const bin = resolveNativeHelper("modifier-state");
  if (!bin) return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile(bin, ["bypass-chord"], { timeout: 80, encoding: "utf8" }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(String(stdout).trim() === "1");
    });
  });
}
