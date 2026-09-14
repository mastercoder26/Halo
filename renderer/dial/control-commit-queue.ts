/**
 * Serializes slow native-control writes while retaining only the most recent
 * value received during an in-flight write.
 */
export class LatestValueQueue<T> {
  private pending: T | undefined;
  private processing: Promise<void> | null = null;
  private readonly commit: (value: T) => Promise<void>;

  constructor(commit: (value: T) => Promise<void>) {
    this.commit = commit;
  }

  submit(value: T): void {
    this.pending = value;
    if (this.processing) return;
    this.processing = this.drain();
  }

  async whenIdle(): Promise<void> {
    while (this.processing) await this.processing;
  }

  private async drain(): Promise<void> {
    try {
      while (this.pending !== undefined) {
        const value = this.pending;
        this.pending = undefined;
        await this.commit(value);
      }
    } finally {
      this.processing = null;
    }
  }
}
