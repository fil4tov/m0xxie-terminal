import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readAudioLibrary } from "./audioLibraryPlugin";

it("discovers audio recursively, derives exact filenames and encodes public URLs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "m0xxie-library-"));
  const nested = join(directory, "audio");
  mkdirSync(nested);
  const audio = join(nested, "01 — Песня #1.MP3");
  const ignored = join(directory, "cover.png");
  try {
    writeFileSync(audio, "");
    writeFileSync(ignored, "");
    expect(await readAudioLibrary(directory, "/music/")).toEqual([
      {
        title: "01 — Песня #1",
        artist: "m0xxie",
        src: `/music/audio/${encodeURIComponent("01 — Песня #1.MP3")}`,
        duration: null,
      },
    ]);
    unlinkSync(audio);
    expect(await readAudioLibrary(directory)).toEqual([]);
    expect(await readAudioLibrary(join(directory, "missing"))).toEqual([]);
  } finally {
    try {
      unlinkSync(audio);
    } catch {
      /* Already removed in the deletion check. */
    }
    unlinkSync(ignored);
    rmdirSync(nested);
    rmdirSync(directory);
  }
});

it("computes MP3 duration from frames at build time and refreshes changed files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "m0xxie-duration-"));
  const file = join(directory, "sample.mp3");
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz: each frame represents 1152 samples.
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  try {
    writeFileSync(file, Buffer.concat(Array(40).fill(frame)));
    const [track] = await readAudioLibrary(directory);
    expect(track.duration).toBeCloseTo(1.044898, 5);
    writeFileSync(file, Buffer.concat(Array(80).fill(frame)));
    const [updated] = await readAudioLibrary(directory);
    expect(updated.duration).toBeCloseTo(2.089796, 5);
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
});
