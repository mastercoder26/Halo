import {
  durationMsForPhase,
  formatTimerMmSs,
  nextPhaseAfterSkip,
  nextPhase,
  phaseLabel,
  type FocusTimerPhase,
} from "./focus-timer-logic.js";
import {
  defaultFocusTimerSettings,
  type FocusTimerMeta,
  type FocusTimerSettings,
  type FocusTimerStatus,
} from "../types.js";
import { settingsStore } from "./settings-store.js";

export type FocusTimerCommand = "start" | "pause" | "resume" | "reset" | "skip" | "toggle";

export interface FocusTimerSnapshot extends FocusTimerMeta {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

type Listener = (snapshot: FocusTimerSnapshot) => void;

class FocusTimerService {
  private config: FocusTimerSettings = defaultFocusTimerSettings();
  private phase: FocusTimerPhase = "focus";
  private status: FocusTimerStatus = "idle";
  private remainingMs = durationMsForPhase("focus", this.config);
  private totalMs = this.remainingMs;
  private cycleIndex = 0;
  private endsAt: number | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private configLoaded = false;
  private configLoad: Promise<void> | null = null;

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // ignore listener errors
      }
    }
  }

  private stopTick(): void {
    if (this.tickTimer != null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private startTick(): void {
    this.stopTick();
    this.tickTimer = setInterval(() => this.tick(), 250);
  }

  private syncRemainingFromEndsAt(): void {
    if (this.status !== "running" || this.endsAt == null) return;
    this.remainingMs = Math.max(0, this.endsAt - Date.now());
  }

  private enterPhase(phase: FocusTimerPhase, status: FocusTimerStatus): void {
    this.phase = phase;
    this.totalMs = durationMsForPhase(phase, this.config);
    this.remainingMs = this.totalMs;
    this.status = status;
    if (status === "running") {
      this.endsAt = Date.now() + this.remainingMs;
      this.startTick();
    } else {
      this.endsAt = null;
      this.stopTick();
    }
  }

  private completePhase(): void {
    const next = nextPhase(this.phase, this.cycleIndex, this.config.cyclesBeforeLongBreak);
    this.cycleIndex = next.cycleIndex;
    this.enterPhase(next.phase, "running");
    this.emit();
  }

  private tick(): void {
    if (this.status !== "running") return;
    this.syncRemainingFromEndsAt();
    if (this.remainingMs <= 0) {
      this.completePhase();
      return;
    }
    this.emit();
  }

  async ensureConfig(): Promise<void> {
    if (this.configLoaded) return;
    this.configLoad ??= (async () => {
      const settings = await settingsStore.load();
      if (!this.configLoaded) this.applyConfig(settings.focusTimer);
    })();
    await this.configLoad;
  }

  applyConfig(config: FocusTimerSettings): void {
    this.config = { ...config };
    this.configLoaded = true;
    if (this.status === "running") return;
    const nextTotal = durationMsForPhase(this.phase, this.config);
    if (this.status === "paused" && this.totalMs > 0) {
      const ratio = this.remainingMs / this.totalMs;
      this.totalMs = nextTotal;
      this.remainingMs = Math.max(0, Math.round(nextTotal * ratio));
      this.endsAt = null;
      return;
    }
    this.totalMs = nextTotal;
    this.remainingMs = this.totalMs;
    this.endsAt = null;
  }

  snapshot(): FocusTimerSnapshot {
    this.syncRemainingFromEndsAt();
    return {
      phase: this.phase,
      status: this.status,
      remainingMs: Math.max(0, Math.round(this.remainingMs)),
      totalMs: this.totalMs,
      cycleIndex: this.cycleIndex,
      cyclesBeforeLongBreak: this.config.cyclesBeforeLongBreak,
      focusMinutes: this.config.focusMinutes,
      shortBreakMinutes: this.config.shortBreakMinutes,
      longBreakMinutes: this.config.longBreakMinutes,
    };
  }

  meta(): FocusTimerMeta {
    const snap = this.snapshot();
    return {
      phase: snap.phase,
      status: snap.status,
      remainingMs: snap.remainingMs,
      totalMs: snap.totalMs,
      cycleIndex: snap.cycleIndex,
      cyclesBeforeLongBreak: snap.cyclesBeforeLongBreak,
    };
  }

  async command(cmd: FocusTimerCommand): Promise<FocusTimerSnapshot> {
    await this.ensureConfig();
    switch (cmd) {
      case "start":
        if (this.status === "idle" || this.status === "paused") {
          if (this.status === "idle") {
            this.totalMs = durationMsForPhase(this.phase, this.config);
            this.remainingMs = this.totalMs;
          }
          this.status = "running";
          this.endsAt = Date.now() + this.remainingMs;
          this.startTick();
        }
        break;
      case "pause":
        if (this.status === "running") {
          this.syncRemainingFromEndsAt();
          this.status = "paused";
          this.endsAt = null;
          this.stopTick();
        }
        break;
      case "resume":
        if (this.status === "paused") {
          this.status = "running";
          this.endsAt = Date.now() + this.remainingMs;
          this.startTick();
        }
        break;
      case "toggle":
        if (this.status === "running") {
          this.syncRemainingFromEndsAt();
          this.status = "paused";
          this.endsAt = null;
          this.stopTick();
        } else {
          if (this.status === "idle") {
            this.totalMs = durationMsForPhase(this.phase, this.config);
            this.remainingMs = this.totalMs;
          }
          this.status = "running";
          this.endsAt = Date.now() + this.remainingMs;
          this.startTick();
        }
        break;
      case "reset": {
        const settings = await settingsStore.load();
        this.applyConfig(settings.focusTimer);
        this.phase = "focus";
        this.cycleIndex = 0;
        this.enterPhase("focus", "idle");
        break;
      }
      case "skip": {
        const next = nextPhaseAfterSkip(
          this.phase,
          this.cycleIndex,
          this.config.cyclesBeforeLongBreak,
          this.status,
        );
        this.cycleIndex = next.cycleIndex;
        this.enterPhase(next.phase, next.status);
        break;
      }
    }
    this.emit();
    return this.snapshot();
  }

  dispose(): void {
    this.stopTick();
    this.listeners.clear();
  }
}

export const focusTimer = new FocusTimerService();

export { durationMsForPhase, formatTimerMmSs, nextPhase, phaseLabel };
