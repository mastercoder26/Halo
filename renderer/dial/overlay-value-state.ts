function normalize(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

export interface ReceiveOverlayOptions {
  /** Accept the OS value even when a prior local write left revision > 0. */
  force?: boolean;
}

export interface OverlayChange {
  readonly id: number;
  readonly key: string | null;
  readonly generation: number;
}

/**
 * Holds the dial's optimistic value without allowing an older IPC refresh to
 * overwrite a value the user has already chosen.
 */
export class OverlayValueState {
  private overlayKey: string | null = null;
  private activeChange: OverlayChange | null = null;
  private nextChangeId = 0;
  private overlayGeneration = 0;
  private settledValue = 0;
  value = 0;

  reset(): void {
    this.overlayKey = null;
    this.activeChange = null;
    this.overlayGeneration += 1;
  }

  receiveOverlay(key: string, value: number, options?: ReceiveOverlayOptions): boolean {
    if (options?.force) {
      this.overlayKey = key;
      this.activeChange = null;
      this.overlayGeneration += 1;
      this.settledValue = normalize(value);
      this.value = this.settledValue;
      return true;
    }
    if (this.overlayKey !== key) {
      this.overlayKey = key;
      this.activeChange = null;
      this.overlayGeneration += 1;
      this.settledValue = normalize(value);
      this.value = this.settledValue;
      return true;
    }
    if (this.activeChange !== null) return false;
    this.settledValue = normalize(value);
    this.value = this.settledValue;
    return true;
  }

  beginChange(value: number): OverlayChange {
    const change: OverlayChange = {
      id: ++this.nextChangeId,
      key: this.overlayKey,
      generation: this.overlayGeneration,
    };
    this.activeChange = change;
    this.value = normalize(value);
    return change;
  }

  confirmChange(change: OverlayChange, value: number): boolean {
    if (this.belongsToCurrentOverlay(change)) this.settledValue = normalize(value);
    if (!this.isActiveChange(change) || !this.belongsToCurrentOverlay(change)) return false;
    this.value = this.settledValue;
    // Clear the active change so later OS refreshes (and other zones for the
    // same role) can push live values after the write settles.
    this.activeChange = null;
    return true;
  }

  /**
   * Clears a failed optimistic write and restores the latest native-confirmed
   * value. Older failures cannot undo a newer user choice.
   */
  rejectChange(change: OverlayChange): boolean {
    if (!this.isActiveChange(change)) return false;
    this.value = this.settledValue;
    this.activeChange = null;
    return true;
  }

  private belongsToCurrentOverlay(change: OverlayChange): boolean {
    return change.key === this.overlayKey && change.generation === this.overlayGeneration;
  }

  private isActiveChange(change: OverlayChange): boolean {
    return this.activeChange?.id === change.id;
  }
}
