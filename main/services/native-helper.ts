import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { app, logger } from "../platform/electron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Candidate source locations for a compiled Swift helper, in priority order. */
function sourceCandidates(name: string): string[] {
  return [
    // Packaged app resource: Contents/Resources/native/<name>
    path.join(process.resourcesPath, "native", name),
    // Local build: dist/main → project/native/<name>
    path.join(__dirname, "..", "..", "native", name),
    // Unpackaged distribution fallback: dist/main → dist/native/<name>
    path.join(__dirname, "..", "native", name),
    // Unbundled development fallback: dist/main/services → project/native/<name>
    path.join(__dirname, "..", "..", "..", "native", name),
  ];
}

const resolvedCache = new Map<string, string>();

/**
 * Return an executable path to a bundled native helper (`brightness`,
 * `modifier-state`).
 *
 * The published/store app bundle is read-only, and — critically — the publish
 * packaging can strip the executable bit from files under native resources, so they
 * ship as `0644`. Spawning them directly then fails with `EACCES` even though
 * the binary is present and correctly ad-hoc signed. To fix this without ever
 * writing to the read-only bundle, we copy the helper once into a writable
 * userData dir and mark that copy executable, then spawn from the copy.
 * `copyFileSync` preserves the Mach-O's embedded ad-hoc signature, so it still
 * runs. In local dev builds the source is already `0755`, so we use it directly.
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
