import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { NowPlayingSnapshot } from "../types.js";
import { positionForSeekFraction } from "./seek-fraction.ts";

const execFileAsync = promisify(execFile);
const OSA = "/usr/bin/osascript";
const TIMEOUT_MS = 4_000;
const MAX_BUFFER_BYTES = 64 * 1024;
const EMPTY_PLAYBACK: NowPlayingSnapshot = {
  title: "No music playing",
  artist: "Open the Music app to use media controls.",
  durationSeconds: 0,
  positionSeconds: 0,
  playing: false,
};

const CURRENT_TRACK_SCRIPT = `
if application "Music" is not running then return ""
tell application "Music"
  if player state is stopped then return ""
  set currentTrack to current track
  return (name of currentTrack) & tab & (artist of currentTrack) & tab & (duration of currentTrack) & tab & (player position) & tab & (player state is playing)
end tell`;

async function runMusicScript(source: string): Promise<string> {
  const { stdout } = await execFileAsync(OSA, ["-e", source], {
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return stdout.trim();
}

function toFiniteNumber(value: string): number | null {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

export function parseNowPlaying(output: string): NowPlayingSnapshot | null {
  const [title, artist, durationText, positionText, playingText] = output.split("\t");
  const durationSeconds = toFiniteNumber(durationText ?? "");
  const positionSeconds = toFiniteNumber(positionText ?? "");
  if (!title || durationSeconds == null || positionSeconds == null) return null;
  return {
    title,
    artist: artist || "Unknown artist",
    durationSeconds: Math.max(0, durationSeconds),
    positionSeconds: Math.max(0, positionSeconds),
    playing: playingText?.toLowerCase() === "true",
  };
}

export async function getNowPlaying(): Promise<NowPlayingSnapshot> {
  const track = parseNowPlaying(await runMusicScript(CURRENT_TRACK_SCRIPT));
  return track ?? EMPTY_PLAYBACK;
}

export async function setMusicPlaying(playing: boolean): Promise<NowPlayingSnapshot> {
  const command = playing ? "play" : "pause";
  await runMusicScript(`
if application "Music" is running then
  tell application "Music" to ${command}
end if`);
  return getNowPlaying();
}

export async function seekMusic(fraction: number): Promise<NowPlayingSnapshot> {
  const current = await getNowPlaying();
  if (current.durationSeconds <= 0) return current;
  const position = positionForSeekFraction(fraction, current.durationSeconds);
  await runMusicScript(`
if application "Music" is running then
  tell application "Music" to set player position to ${position}
end if`);
  return getNowPlaying();
}
