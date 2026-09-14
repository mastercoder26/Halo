import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { app, logger } from "../platform/electron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Candidate source locations for a compiled Swift helper, in priority order. */
function sourceCandidates(name: string): string[] {
  return [
    // Packaged app resources.
    path.join(process.resourcesPath, "native", name),
    // Alternate bundled layout.
    path.join(__dirname, "..", "native", name),
    // Local development.
    path.join(__dirname, "..", "..", "native", name),
  ];
}

const resolvedCache = new Map<string, string>();

/**
 * Return an executable path to a bundled native helper.
 *
 * Packaged helpers are normally executable in place. If a distribution format
 * strips that bit, stage a writable copy in Halo's user-data directory and
 * restore it there without modifying the application bundle.
 */
export function resolveNativeHelper(name: string): string | null {
  const cached = resolvedCache.get(name);
  if (cached && fs.existsSync(cached)) return cached;

  let source: string | null = null;
  for (const candidate of sourceCandidates(name)) {
    try {
      if (fs.existsSync(candidate)) {
        source = candidate;
        break;
      }
    } catch {
      // continue
    }
  }
  if (!source) return null;

  // Fast path: the source is already executable (local dev / build output) —
  // spawn it in place, no staging needed.
  try {
    if ((fs.statSync(source).mode & 0o111) !== 0) {
      resolvedCache.set(name, source);
      return source;
    }
  } catch {
    // fall through to staging
  }

  // Store bundle path: stage a writable, executable copy in userData.
  try {
    const stageDir = path.join(app.getPath("userData"), "native");
    fs.mkdirSync(stageDir, { recursive: true });
    const staged = path.join(stageDir, name);
    const srcStat = fs.statSync(source);
    let needCopy = true;
    try {
      const dstStat = fs.statSync(staged);
      needCopy = dstStat.size !== srcStat.size || dstStat.mtimeMs < srcStat.mtimeMs;
    } catch {
      needCopy = true;
    }
    if (needCopy) fs.copyFileSync(source, staged);
    fs.chmodSync(staged, 0o755);
    resolvedCache.set(name, staged);
    return staged;
  } catch (error) {
    logger.warn("native-helper", `Failed to stage native helper "${name}"`, error);
    return source;
  }
}
