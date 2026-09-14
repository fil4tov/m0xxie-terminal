import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "./useAudioPlayer";

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
  afterEach(() => vi.unstubAllGlobals());
  it("does not autoplay, preserves paused state when skipping and wraps tracks", async () => {
    const { result } = renderHook(useAudioPlayer);
    expect(result.current.playing).toBe(false);
    act(() => result.current.transport("previous"));
    expect(result.current.track.title).toBe("voyage");
    expect(result.current.playing).toBe(false);
    await act(async () => result.current.transport("play"));
    expect(result.current.playing).toBe(true);
    await act(async () => result.current.transport("next"));
    expect(result.current.track.title).toBe("better");
    expect(result.current.playing).toBe(true);
  });
  it("responds to track completion, bounds seek/volume, and stops at zero", async () => {
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.choose(1));
    expect(result.current.track.title).toBe("free my mind");
    await act(async () =>
      TestAudio.instances[0].dispatchEvent(new Event("ended")),
    );
    expect(result.current.track.title).toBe("voyage");
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
