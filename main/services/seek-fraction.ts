export function seekFraction(positionSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, positionSeconds / durationSeconds));
}

export function positionForSeekFraction(fraction: number, durationSeconds: number): number {
  if (!Number.isFinite(fraction) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(durationSeconds, fraction * durationSeconds));
}
