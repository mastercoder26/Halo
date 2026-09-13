/** A small confirmed-value cache for controls backed by asynchronous OS writes. */
export class ControlValueCache<T> {
  private value: T | null = null;
  private updatedAt = 0;

  getIfFresh(maxAgeMs: number, now = Date.now()): T | null {
    if (this.value == null || now - this.updatedAt >= maxAgeMs) return null;
    return this.value;
  }

  commit(value: T, now = Date.now()): void {
    this.value = value;
    this.updatedAt = now;
  }

  clear(): void {
    this.value = null;
    this.updatedAt = 0;
  }
}

/**
 * Commit a cached control value only after its native write succeeds. A failed
 * write therefore leaves the last confirmed value intact and retryable.
 */
export async function writeThenCommit<T>(
  cache: ControlValueCache<T>,
  write: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const value = await write();
  cache.commit(value, now());
  return value;
}
