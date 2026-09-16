const ACCESSIBILITY_PERMISSION_POLL_MS = 750;

interface AccessibilityPermissionWatcherOptions {
  checkTrusted: () => Promise<boolean>;
  onTrusted: () => void;
  onError?: (error: unknown) => void;
  schedule: (callback: () => void, intervalMs: number) => unknown;
  cancel: (timer: unknown) => void;
}

/**
 * Polls the macOS Accessibility status without allowing concurrent TCC checks.
 * Returns a cleanup function suitable for a React effect.
 */
export function watchAccessibilityPermission({
  checkTrusted,
  onTrusted,
  onError,
  schedule,
  cancel,
}: AccessibilityPermissionWatcherOptions): () => void {
  let stopped = false;
  let checking = false;
  let trusted = false;

  const check = async () => {
    if (stopped || checking || trusted) return;
    checking = true;
    try {
      trusted = await checkTrusted();
      if (trusted && !stopped) onTrusted();
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      checking = false;
    }
  };

  const timer = schedule(() => void check(), ACCESSIBILITY_PERMISSION_POLL_MS);
  void check();

  return () => {
    stopped = true;
    cancel(timer);
  };
}
