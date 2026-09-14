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

it("discovers audio recursively, derives exact filenames and encodes public URLs", () => {
  const directory = mkdtempSync(join(tmpdir(), "m0xxie-library-"));
  const nested = join(directory, "audio");
  mkdirSync(nested);
  const audio = join(nested, "01 — Песня #1.MP3");
  const ignored = join(directory, "cover.png");
  try {
    writeFileSync(audio, "");
    writeFileSync(ignored, "");
    expect(readAudioLibrary(directory, "/music/")).toEqual([
      {
        title: "01 — Песня #1",
        artist: "m0xxie",
        src: `/music/audio/${encodeURIComponent("01 — Песня #1.MP3")}`,
      },
    ]);
    unlinkSync(audio);
    expect(readAudioLibrary(directory)).toEqual([]);
    expect(readAudioLibrary(join(directory, "missing"))).toEqual([]);
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
