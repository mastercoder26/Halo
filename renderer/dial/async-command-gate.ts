/** Prevents repeated pointer clicks from starting concurrent commands. */
export class AsyncCommandGate {
  private busy = false;

  get isBusy(): boolean {
    return this.busy;
  }

  tryEnter(): boolean {
    if (this.busy) return false;
    this.busy = true;
    return true;
  }

  release(): void {
    this.busy = false;
  }
}
