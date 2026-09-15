export type AppIconSize = "small" | "normal" | "large";

type LoadIcon = (appPath: string, size: AppIconSize) => Promise<Uint8Array>;

/**
 * Electron's macOS icon decoding can fail inside NSImage when a picker starts
 * many native reads simultaneously. Keep those reads serial, deduplicate
 * concurrent requests, and retain a bounded PNG cache for repeated renders.
 */
export class SerializedAppIconLoader {
  private readonly cache = new Map<string, Uint8Array>();
  private readonly inFlight = new Map<string, Promise<Uint8Array>>();
  private readonly loadIcon: LoadIcon;
  private readonly maxEntries: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(loadIcon: LoadIcon, maxEntries = 128) {
    this.loadIcon = loadIcon;
    this.maxEntries = maxEntries;
  }

  load(appPath: string, size: AppIconSize): Promise<Uint8Array> {
    const key = `${size}:${appPath}`;
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);

    const active = this.inFlight.get(key);
    if (active) return active;

    const request = this.queue.then(async () => {
      const queuedCacheHit = this.cache.get(key);
      if (queuedCacheHit) return queuedCacheHit;

      const png = await this.loadIcon(appPath, size);
      if (png.byteLength === 0) throw new Error("Application icon is empty");
      this.cache.set(key, png);
      while (this.cache.size > this.maxEntries) {
        const oldestKey = this.cache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        this.cache.delete(oldestKey);
      }
      return png;
    });

    this.queue = request.then(
      () => undefined,
      () => undefined,
    );
    this.inFlight.set(key, request);
    void request.then(
      () => this.inFlight.delete(key),
      () => this.inFlight.delete(key),
    );
    return request;
  }
}
