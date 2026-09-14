/** Seek fraction helpers for now-playing scrub (0–100 dial ↔ seconds). */

export function positionToDialValue(position: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(position) || !Number.isFinite(duration)) return 0;
  return Math.round(Math.max(0, Math.min(100, (position / duration) * 100)));
}

export function dialValueToPosition(value: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(value) || !Number.isFinite(duration)) return 0;
  const clamped = Math.max(0, Math.min(100, value));
  return Math.max(0, Math.min(duration, (clamped / 100) * duration));
}

export function formatTrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
