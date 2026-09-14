import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "./useAudioPlayer";

const library = vi.hoisted(() => [
  { title: "better", artist: "m0xxie", src: "/audio/better.mp3" },
  {
    title: "free my mind",
    artist: "m0xxie",
    src: "/audio/free%20my%20mind.wav",
  },
  { title: "voyage", artist: "m0xxie", src: "/audio/voyage.mp3" },
]);
vi.mock("../tracks", () => ({ tracks: library }));

// JSDOM cannot decode audio: simulate only the browser's media boundary.
class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  src = "";
  preload = "";
  volume = 1;
  currentTime = 0;
  duration = 240;
  paused = true;
  constructor() {
    super();
    TestAudio.instances.push(this);
  }
  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() {
    this.currentTime = 0;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}
describe("audio transport", () => {
  beforeEach(() => {
    TestAudio.instances = [];
    vi.stubGlobal("Audio", TestAudio);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("shuffles through every track, keeps back/forward history and preserves pause", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { result } = renderHook(useAudioPlayer);
    act(() => result.current.toggleShuffle());
    expect(result.current.shuffle).toBe(true);
    expect(result.current.index).toBe(0);
    act(() => result.current.transport("next"));
    expect(result.current.index).toBe(2);
    act(() => result.current.transport("previous"));
    expect(result.current.index).toBe(0);
    act(() => result.current.transport("next"));
    expect(result.current.index).toBe(2);
    act(() => result.current.transport("next"));
    expect(result.current.index).toBe(1);
    expect(result.current.playing).toBe(false);
    const round: number[] = [];
    for (let i = 0; i < 3; i++) {
      act(() => result.current.transport("next"));
      round.push(result.current.index);
    }
    expect(round[0]).not.toBe(1);
    expect(new Set(round).size).toBe(3);
  });
  it("uses the current shuffle mode on ended and restores ordered playback when disabled", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { result } = renderHook(useAudioPlayer);
    act(() => result.current.toggleShuffle());
    await act(async () =>
      TestAudio.instances[0].dispatchEvent(new Event("ended")),
    );
    expect(result.current.index).toBe(2);
    expect(result.current.playing).toBe(true);
    act(() => result.current.toggleShuffle());
    expect(result.current.shuffle).toBe(false);
    await act(async () =>
      TestAudio.instances[0].dispatchEvent(new Event("ended")),
    );
    expect(result.current.index).toBe(0);
  });
  it("starts a fresh shuffle sequence from a manually selected track", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { result } = renderHook(useAudioPlayer);
    act(() => result.current.toggleShuffle());
    await act(async () => result.current.choose(1));
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(2);
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(0);
  });
  it("loads every duration without playing and reuses metadata when selecting a track", () => {
    const { result, unmount } = renderHook(useAudioPlayer);
    expect(result.current.durations).toEqual([null, null, null]);
    const probes = TestAudio.instances.slice(1);
    expect(probes).toHaveLength(3);
    act(() => {
      probes.forEach((probe, i) => {
        probe.duration = 120.5 + i * 10;
        probe.dispatchEvent(new Event("loadedmetadata"));
      });
    });
    expect(result.current.durations).toEqual([120.5, 130.5, 140.5]);
    expect(result.current.duration).toBe(120.5);
    expect(TestAudio.instances.every((audio) => audio.paused)).toBe(true);
    act(() => result.current.choose(2, false));
    expect(result.current.duration).toBe(140.5);
    unmount();
    expect(TestAudio.instances.every((audio) => audio.src === "")).toBe(true);
  });
  it("keeps unknown duration for unreadable metadata without blocking the other tracks", () => {
    const { result } = renderHook(useAudioPlayer);
    act(() => {
      TestAudio.instances[1].dispatchEvent(new Event("error"));
      TestAudio.instances[2].duration = 192;
      TestAudio.instances[2].dispatchEvent(new Event("loadedmetadata"));
    });
    expect(result.current.durations).toEqual([null, 192, null]);
    expect(result.current.error).toBe("");
  });
  it("handles an empty audio folder without starting media or breaking shuffle", () => {
    const original = library.splice(0);
    try {
      const { result, unmount } = renderHook(useAudioPlayer);
      expect(result.current.track).toBeNull();
      expect(TestAudio.instances).toHaveLength(0);
      act(() => {
        result.current.toggleShuffle();
        result.current.transport("next");
        result.current.choose(0);
      });
      expect(result.current.playing).toBe(false);
      unmount();
    } finally {
      library.push(...original);
    }
  });
  it("does not autoplay, preserves paused state when skipping and wraps tracks", async () => {
    const { result } = renderHook(useAudioPlayer);
    expect(result.current.playing).toBe(false);
    act(() => result.current.transport("previous"));
    expect(result.current.track?.title).toBe("voyage");
    expect(result.current.playing).toBe(false);
    await act(async () => result.current.transport("play"));
    expect(result.current.playing).toBe(true);
    await act(async () => result.current.transport("next"));
    expect(result.current.track?.title).toBe("better");
    expect(result.current.playing).toBe(true);
  });
  it("responds to track completion, bounds seek/volume, and stops at zero", async () => {
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.choose(1));
    expect(result.current.track?.title).toBe("free my mind");
    await act(async () =>
      TestAudio.instances[0].dispatchEvent(new Event("ended")),
    );
    expect(result.current.track?.title).toBe("voyage");
    expect(result.current.playing).toBe(true);
    act(() => {
      result.current.seek(900);
      result.current.setVolume(5);
    });
    expect(result.current.position).toBe(240);
    expect(result.current.volume).toBe(1);
    act(() => result.current.transport("stop"));
    expect(result.current.playing).toBe(false);
    expect(result.current.position).toBe(0);
  });
  it("releases the media source on unmount and surfaces media errors", () => {
    const { result, unmount } = renderHook(useAudioPlayer);
    act(() => TestAudio.instances[0].dispatchEvent(new Event("error")));
    expect(result.current.error).toContain("Файл не загрузился");
    unmount();
    expect(TestAudio.instances[0].src).toBe("");
    expect(TestAudio.instances[0].paused).toBe(true);
  });
});
