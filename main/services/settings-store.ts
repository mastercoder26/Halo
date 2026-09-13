import * as fs from "fs/promises";
import * as path from "path";

import { app, logger } from "../platform/electron.js";

import {
  defaultDisplayZones,
  defaultSettings,
  type DisplayZoneSettings,
  type HaloSettings,
} from "../types.js";
import { persistSettingsAtomically } from "./settings-persistence.js";
import { sanitizeSettings } from "./settings-sanitization.js";

export { sanitizeSettings } from "./settings-sanitization.js";

class SettingsStore {
  private cache: HaloSettings | null = null;
  private settingsPath: string | null = null;
  private listeners = new Set<(settings: HaloSettings) => void>();
  private writeChain: Promise<unknown> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn);
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async ensurePath(): Promise<string> {
    if (this.settingsPath) return this.settingsPath;
    const dir = app.getPath("userData");
    await fs.mkdir(dir, { recursive: true });
    this.settingsPath = path.join(dir, "settings.json");
    return this.settingsPath;
  }

  async load(): Promise<HaloSettings> {
    if (this.cache) return this.cache;
    try {
      const filePath = await this.ensurePath();
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      this.cache = sanitizeSettings(parsed);
      return this.cache;
    } catch {
      this.cache = defaultSettings();
      return this.cache;
    }
  }

  private async write(next: unknown): Promise<HaloSettings> {
    const filePath = await this.ensurePath();
    const candidate = sanitizeSettings(next);
    return persistSettingsAtomically({
      filePath,
      contents: JSON.stringify(candidate, null, 2),
      next: candidate,
      commit: (settings) => {
        this.cache = settings;
      },
      notify: (settings) => {
        for (const listener of this.listeners) {
          try {
            listener(settings);
          } catch (error) {
            logger.error("settings-store", "Listener failed", error);
          }
        }
      },
    });
  }

  async save(next: unknown): Promise<HaloSettings> {
    return this.enqueue(() => this.write(next));
  }

  async update(patch: unknown): Promise<HaloSettings> {
    return this.enqueue(async () => {
      const current = await this.load();
      const candidate =
        patch && typeof patch === "object" && !Array.isArray(patch)
          ? { ...current, ...(patch as Record<string, unknown>) }
          : current;
      return this.write(sanitizeSettings(candidate, current));
    });
  }

  async getDisplayZones(displayId: number | string): Promise<DisplayZoneSettings> {
    const settings = await this.load();
    const key = String(displayId);
    return settings.displays[key] ?? defaultDisplayZones();
  }

  async setDisplayZones(
    displayId: number | string,
    zones: DisplayZoneSettings,
  ): Promise<HaloSettings> {
    return this.enqueue(async () => {
      const settings = await this.load();
      return this.write({
        ...settings,
        displays: { ...settings.displays, [String(displayId)]: zones },
      });
    });
  }

  onChange(listener: (settings: HaloSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const settingsStore = new SettingsStore();
