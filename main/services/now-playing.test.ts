import assert from "node:assert/strict";
import test from "node:test";

import { parseNowPlaying } from "./now-playing.ts";

test("parses the Music player-state payload", () => {
  assert.deepEqual(
    parseNowPlaying("Song\tArtist\t180\t45\ttrue"),
    {
      title: "Song",
      artist: "Artist",
      durationSeconds: 180,
      positionSeconds: 45,
      playing: true,
    },
  );
});

test("rejects incomplete Music player-state payloads", () => {
  assert.equal(parseNowPlaying(""), null);
  assert.equal(parseNowPlaying("Song\tArtist\tnot-a-number\t45\ttrue"), null);
});
