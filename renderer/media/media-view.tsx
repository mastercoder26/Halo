import { useCallback, useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import type { NowPlayingSnapshot } from "../platform/bridge";

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function progressPercent({ durationSeconds, positionSeconds }: NowPlayingSnapshot): number {
  if (durationSeconds <= 0) return 0;
  return Math.max(0, Math.min(100, (positionSeconds / durationSeconds) * 100));
}

export function MediaView() {
  const [playback, setPlayback] = useState<NowPlayingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPlayback(await window.haloAPI.media.getNowPlaying());
      setError(null);
    } catch {
      setError("Couldn’t read Music playback.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const setPlaying = async (playing: boolean) => {
    try {
      setPlayback(await window.haloAPI.media.setPlaying(playing));
      setError(null);
    } catch {
      setError("Couldn’t update Music playback.");
    }
  };

  const seek = async (percent: number) => {
    try {
      setPlayback(await window.haloAPI.media.seek(percent / 100));
      setError(null);
    } catch {
      setError("Couldn’t seek this track.");
    }
  };

  const progress = playback ? progressPercent(playback) : 0;

  return (
    <main className="flex h-screen flex-col justify-between bg-[#171719] p-6 text-primary">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--theme-accent)]">Now Playing</p>
        <h1 className="mt-3 truncate text-xl font-semibold">{playback?.title ?? "Loading…"}</h1>
        <p className="mt-1 truncate text-sm text-secondary">{playback?.artist ?? ""}</p>
      </div>

      <div>
        <input
          aria-label="Track position"
          className="w-full accent-[var(--theme-accent)]"
          type="range"
          min="0"
          max="100"
          value={progress}
          disabled={!playback || playback.durationSeconds <= 0}
          onChange={(event) => void seek(Number(event.currentTarget.value))}
        />
        <div className="mt-1 flex justify-between text-xs text-secondary">
          <span>{formatTime(playback?.positionSeconds ?? 0)}</span>
          <span>{formatTime(playback?.durationSeconds ?? 0)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-h-5 text-xs text-secondary">{error ?? "Music app controls"}</p>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full bg-[var(--theme-accent)] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          aria-label={playback?.playing ? "Pause" : "Play"}
          disabled={!playback || playback.durationSeconds <= 0}
          onClick={() => void setPlaying(!playback?.playing)}
        >
          {playback?.playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
      </div>
    </main>
  );
}
