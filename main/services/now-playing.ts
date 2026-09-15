import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { logger } from "../platform/electron.js";

import { positionToDialValue } from "./seek-fraction.js";
import type { OverlayMediaMeta } from "../types.js";

const execFileAsync = promisify(execFile);
const OSA = "/usr/bin/osascript";
const TIMEOUT = 2_500;
const MAX_BUFFER = 256 * 1024;

export type MediaPlayer = "Music" | "Spotify";

export interface NowPlayingState extends OverlayMediaMeta {
  player: MediaPlayer | null;
}

const EMPTY: NowPlayingState = {
  player: null,
  title: "",
  artist: "",
  playing: false,
  position: 0,
  duration: 0,
};

let lastPlayer: MediaPlayer | null = null;
let cachedState: NowPlayingState = { ...EMPTY };
let cachedAt = 0;
const CACHE_MS = 800;

async function runOsascript(source: string): Promise<string> {
  const { stdout } = await execFileAsync(OSA, ["-e", source], {
    timeout: TIMEOUT,
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

/** Fast process check — System Events `exists process` can take multiple seconds. */
async function isPlayerRunning(player: MediaPlayer): Promise<boolean> {
  try {
    await execFileAsync("/usr/bin/pgrep", ["-xq", player], {
      timeout: 500,
      maxBuffer: 4_096,
    });
    return true;
  } catch {
    return false;
  }
}

function parseState(raw: string, player: MediaPlayer): NowPlayingState | null {
  // title|||artist|||playing|||position|||duration
  const parts = raw.split("|||");
  if (parts.length < 5) return null;
  const [title, artist, playingRaw, positionRaw, durationRaw] = parts;
  const playing = playingRaw.toLowerCase() === "true" || playingRaw === "playing";
  const position = Number.parseFloat(positionRaw);
  const duration = Number.parseFloat(durationRaw);
  return {
    player,
    title: title || "Unknown",
    artist: artist || "",
    playing,
    position: Number.isFinite(position) ? Math.max(0, position) : 0,
    duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
  };
}

async function readPlayer(player: MediaPlayer): Promise<NowPlayingState | null> {
  try {
    if (!(await isPlayerRunning(player))) return null;

    if (player === "Music") {
      const raw = await runOsascript(`
tell application "Music"
  if player state is stopped then return "___OFF___"
  set t to name of current track
  set a to artist of current track
  set p to player position
  set d to duration of current track
  set s to player state as string
  return t & "|||" & a & "|||" & s & "|||" & p & "|||" & d
end tell`);
      if (raw === "___OFF___" || !raw) return null;
      return parseState(raw, "Music");
    }

    const raw = await runOsascript(`
tell application "Spotify"
  if player state is stopped then return "___OFF___"
  set t to name of current track
  set a to artist of current track
  set p to player position
  set d to duration of current track
  set s to player state as string
  return t & "|||" & a & "|||" & s & "|||" & p & "|||" & (d / 1000)
end tell`);
    if (raw === "___OFF___" || !raw) return null;
    return parseState(raw, "Spotify");
  } catch (error) {
    logger.debug("now-playing", `Failed to read ${player}`, error);
    return null;
  }
}

export function getCachedNowPlayingState(): NowPlayingState {
  return { ...cachedState };
}

export async function getNowPlayingState(): Promise<NowPlayingState> {
  const now = Date.now();
  if (now - cachedAt < CACHE_MS && cachedState.player) {
    return { ...cachedState };
  }

  const [music, spotify] = await Promise.all([readPlayer("Music"), readPlayer("Spotify")]);

  let next: NowPlayingState = { ...EMPTY };
  if (music?.playing) {
    lastPlayer = "Music";
    next = music;
  } else if (spotify?.playing) {
    lastPlayer = "Spotify";
    next = spotify;
  } else if (lastPlayer === "Music" && music) {
    next = music;
  } else if (lastPlayer === "Spotify" && spotify) {
    next = spotify;
  } else if (music) {
    lastPlayer = "Music";
    next = music;
  } else if (spotify) {
    lastPlayer = "Spotify";
    next = spotify;
  }

  cachedState = next;
  cachedAt = Date.now();
  return { ...next };
}

async function withPlayer(command: (player: MediaPlayer) => Promise<void>): Promise<void> {
  const state = await getNowPlayingState();
  const player = state.player ?? lastPlayer;
  if (!player) throw new Error("No media player available");
  await command(player);
  lastPlayer = player;
  cachedAt = 0;
}

export async function playPauseNowPlaying(): Promise<NowPlayingState> {
  await withPlayer(async (player) => {
    await runOsascript(`tell application "${player}" to playpause`);
  });
  return getNowPlayingState();
}

export async function nextNowPlaying(): Promise<NowPlayingState> {
  await withPlayer(async (player) => {
    await runOsascript(`tell application "${player}" to next track`);
  });
  return getNowPlayingState();
}

export async function previousNowPlaying(): Promise<NowPlayingState> {
  await withPlayer(async (player) => {
    await runOsascript(`tell application "${player}" to previous track`);
  });
  return getNowPlayingState();
}

/** Seek to a fraction of the track (0–1). */
export async function seekNowPlaying(fraction: number): Promise<NowPlayingState> {
  const clamped = Math.max(0, Math.min(1, fraction));
  let targetPosition = 0;
  let targetDuration = 0;
  let targetPlayer: MediaPlayer | null = null;

  await withPlayer(async (player) => {
    const state = await readPlayer(player);
    const duration = state?.duration ?? cachedState.duration;
    const position = duration * clamped;
    targetDuration = duration;
    targetPosition = position;
    targetPlayer = player;
    if (player === "Music") {
      await runOsascript(`tell application "Music" to set player position to ${position}`);
    } else {
      await runOsascript(`tell application "Spotify" to set player position to ${position}`);
    }
  });

  // Music/Spotify often report the pre-seek position for a beat — keep an
  // optimistic cache so media polls don't snap the overlay backward.
  cachedState = {
    ...cachedState,
    player: targetPlayer ?? cachedState.player,
    position: targetPosition,
    duration: targetDuration > 0 ? targetDuration : cachedState.duration,
  };
  cachedAt = Date.now();
  return { ...cachedState };
}

export function nowPlayingDialValue(state: NowPlayingState): number {
  return positionToDialValue(state.position, state.duration);
}

export function nowPlayingMeta(state: NowPlayingState): OverlayMediaMeta {
  return {
    title: state.title,
    artist: state.artist,
    playing: state.playing,
    position: state.position,
    duration: state.duration,
  };
}
