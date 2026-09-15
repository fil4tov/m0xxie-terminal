import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer, type TransportAction } from "./useAudioPlayer";
import { createPlayer } from "../three/createPlayer";
import App from "../App";
import { PlayerPanel } from "../components/PlayerPanel";
import { createElement } from "react";

const library = vi.hoisted(() => [
  {
    title: "better",
    artist: "m0xxie",
    src: "/audio/better.mp3",
    duration: 120.5,
  },
  {
    title: "free my mind",
    artist: "m0xxie",
    src: "/audio/free%20my%20mind.wav",
    duration: 130.5,
  },
  {
    title: "voyage",
    artist: "m0xxie",
    src: "/audio/voyage.mp3",
    duration: 140.5 as number | null,
  },
]);
vi.mock("../tracks", () => ({ tracks: library }));
// JSDOM has no WebGL; keep the real player controls and stub only the 3D renderer.
vi.mock("../three/createPlayer", () => ({
  createPlayer: vi.fn(
    (
      _container: HTMLDivElement,
      _onAction: (action: TransportAction) => void,
    ) => ({ setPlaying() {}, dispose() {} }),
  ),
}));

// JSDOM cannot decode audio: simulate only the browser's media boundary.
class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  static sources: string[] = [];
  private source = "";
  get src() {
    return this.source;
  }
  set src(value: string) {
    this.source = value;
    if (value) TestAudio.sources.push(value);
  }
  preload = "";
  volume = 1;
  currentTime = 0;
  duration = 240;
  paused = true;
  readyState = 0;
  initialSource: string;
  constructor(src = "") {
    super();
    this.initialSource = src;
    this.source = src;
    TestAudio.instances.push(this);
  }
  async play() {
    if (!this.readyState) {
      this.readyState = 1;
      this.dispatchEvent(new Event("loadedmetadata"));
    }
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() {
    this.currentTime = 0;
    this.readyState = 0;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}

// Record the Web Audio boundary: gain automation and context lifecycle.
class TestAudioContext {
  static instances: TestAudioContext[] = [];
  private started = Date.now();
  state = "suspended";
  destination = {};
  gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  node = { gain: this.gain, connect: vi.fn(), disconnect: vi.fn() };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  constructor() {
    TestAudioContext.instances.push(this);
  }
  get currentTime() {
    return (Date.now() - this.started) / 1000;
  }
  createGain() {
    return this.node;
  }
  createMediaElementSource() {
    return this.source;
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
}
describe("audio transport", () => {
  beforeEach(() => {
    TestAudio.instances = [];
    TestAudio.sources = [];
    TestAudioContext.instances = [];
    localStorage.clear();
    vi.stubGlobal("Audio", TestAudio);
    vi.stubGlobal("AudioContext", TestAudioContext);
  });
  it("uses native audio on touch devices and advances in the background without timers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { maxTouchPoints: 5, platform: "MacIntel" });
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    const media = TestAudio.instances[0];
    expect(TestAudioContext.instances).toHaveLength(0);
    expect(media.volume).toBe(1);
    expect(media.paused).toBe(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(media.paused).toBe(false);
    await act(async () => media.dispatchEvent(new Event("ended")));
    expect(result.current.track?.title).toBe("free my mind");
    expect(media.paused).toBe(false);
    expect(media.volume).toBe(1);
    act(() => result.current.pause());
    expect(media.paused).toBe(true);
  });
  it("publishes lock-screen metadata and handles play, pause, skip and seek", async () => {
    const handlers = new Map<string, MediaSessionActionHandler>();
    const session = {
      metadata: null as MediaMetadataInit | null,
      playbackState: "none",
      setPositionState: vi.fn(),
      setActionHandler: vi.fn(
        (action: string, handler: MediaSessionActionHandler | null) => {
          if (handler) handlers.set(action, handler);
          else handlers.delete(action);
        },
      ),
    };
    const audioSession = { type: "auto" };
    vi.stubGlobal("navigator", {
      maxTouchPoints: 5,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      mediaSession: session,
      audioSession,
    });
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(data: MediaMetadataInit) {
          Object.assign(this, data);
        }
      },
    );
    const { result, unmount } = renderHook(useAudioPlayer);
    expect(TestAudio.sources).toEqual([]);
    await act(async () => result.current.transport("play"));
    expect(audioSession.type).toBe("playback");
    expect(session.metadata).toMatchObject({
      title: "better",
      artist: "m0xxie",
    });
    expect(session.playbackState).toBe("playing");
    act(() => handlers.get("pause")!({ action: "pause" }));
    expect(TestAudio.instances[0].paused).toBe(true);
    expect(session.playbackState).toBe("paused");
    await act(async () => handlers.get("play")!({ action: "play" }));
    await act(async () => handlers.get("play")!({ action: "play" }));
    expect(TestAudio.instances[0].paused).toBe(false);
    await act(async () => handlers.get("nexttrack")!({ action: "nexttrack" }));
    expect(session.metadata).toMatchObject({ title: "free my mind" });
    act(() => handlers.get("seekto")!({ action: "seekto", seekTime: 42 }));
    expect(TestAudio.instances[0].currentTime).toBe(42);
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 240,
      playbackRate: 1,
      position: 42,
    });
    await act(async () =>
      handlers.get("previoustrack")!({ action: "previoustrack" }),
    );
    expect(result.current.track?.title).toBe("free my mind");
    expect(result.current.position).toBe(0);
    await act(async () =>
      handlers.get("previoustrack")!({ action: "previoustrack" }),
    );
    expect(result.current.track?.title).toBe("better");
    act(() => handlers.get("stop")!({ action: "stop" }));
    expect(TestAudio.instances[0].paused).toBe(true);
    expect(result.current.position).toBe(0);
    unmount();
    expect(handlers.size).toBe(0);
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");
    expect(audioSession.type).toBe("auto");
  });
  it("keeps native playback usable when optional media session APIs reject calls", async () => {
    const unsupported = () => {
      throw new DOMException("Unsupported", "NotSupportedError");
    };
    const session = {
      metadata: null,
      playbackState: "none",
      setActionHandler: vi.fn(unsupported),
      setPositionState: vi.fn(unsupported),
    };
    vi.stubGlobal("navigator", {
      maxTouchPoints: 5,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      mediaSession: session,
      audioSession: {
        get type() {
          return "auto";
        },
        set type(_: string) {
          unsupported();
        },
      },
    });
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useAudioPlayer(enabled),
      { initialProps: { enabled: false } },
    );
    expect(session.setActionHandler).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(async () => result.current.transport("play"));
    expect(result.current.error).toBe("");
    expect(TestAudio.instances[0].paused).toBe(false);
    act(() => result.current.pause());
    expect(TestAudio.instances[0].paused).toBe(true);
    expect(() => unmount()).not.toThrow();
  });
  it("uses the iPhone volume buttons instead of displaying an ineffective slider", () => {
    vi.stubGlobal("navigator", { userAgent: "iPhone", maxTouchPoints: 5 });
    localStorage.setItem("m0xxie-player-volume", "0");
    const { result } = renderHook(useAudioPlayer);
    render(
      createElement(PlayerPanel, { player: result.current, onClose: vi.fn() }),
    );
    expect(
      screen.queryByRole("slider", { name: "Громкость" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Громкость — кнопками телефона"),
    ).toBeInTheDocument();
    expect(result.current.volume).toBe(1);
    expect(localStorage.getItem("m0xxie-player-volume")).toBe("0");
  });
  it("preserves Web Audio fades on touchscreen desktops using a mouse", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Windows",
      platform: "Win32",
      maxTouchPoints: 10,
    });
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    expect(result.current.systemVolume).toBe(false);
    expect(TestAudioContext.instances).toHaveLength(1);
    expect(
      TestAudioContext.instances[0].gain.linearRampToValueAtTime,
    ).toHaveBeenCalled();
  });
  it("restores saved order, skips missing or duplicate tracks, and appends new tracks", () => {
    localStorage.setItem(
      "m0xxie-player-track-order",
      JSON.stringify([
        library[2].src,
        "/removed.mp3",
        library[2].src,
        library[0].src,
      ]),
    );
    const { result } = renderHook(useAudioPlayer);
    expect(result.current.tracks.map((track) => track.src)).toEqual([
      library[2].src,
      library[0].src,
      library[1].src,
    ]);
    expect(result.current.index).toBe(0);
    expect(result.current.track?.src).toBe(library[2].src);
    expect(result.current.durations).toEqual([140.5, 120.5, 130.5]);
    expect(TestAudio.sources).toEqual([]);
  });
  it("reorders without interrupting playback and advances in the saved order", async () => {
    const { result, unmount } = renderHook(useAudioPlayer);
    await act(async () => result.current.choose(1, true));
    const media = TestAudio.instances[0];
    act(() => {
      media.currentTime = 35;
      media.dispatchEvent(new Event("timeupdate"));
    });
    const sources = [...TestAudio.sources];
    act(() => result.current.reorder(1, 0));
    expect(result.current.index).toBe(0);
    expect(result.current.track?.src).toBe(library[1].src);
    expect(result.current.position).toBe(35);
    expect(result.current.playing).toBe(true);
    expect(media.paused).toBe(false);
    expect(TestAudio.sources).toEqual(sources);
    expect(result.current.durations).toEqual([240, 120.5, 140.5]);
    expect(
      JSON.parse(localStorage.getItem("m0xxie-player-track-order")!),
    ).toEqual([library[1].src, library[0].src, library[2].src]);
    await act(async () => media.dispatchEvent(new Event("ended")));
    expect(result.current.track?.src).toBe(library[0].src);
    await act(async () => result.current.transport("previous"));
    expect(result.current.track?.src).toBe(library[1].src);
    unmount();
    const restored = renderHook(useAudioPlayer);
    expect(restored.result.current.track?.src).toBe(library[1].src);
  });
  it("ignores malformed order and keeps reordering usable when storage is blocked", () => {
    localStorage.setItem("m0xxie-player-track-order", "broken json");
    const { result } = renderHook(useAudioPlayer);
    expect(result.current.tracks).toEqual(library);
    const save = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("Blocked");
      });
    try {
      act(() => result.current.reorder(0, 2));
      expect(result.current.tracks.map((track) => track.src)).toEqual([
        library[1].src,
        library[2].src,
        library[0].src,
      ]);
      expect(result.current.track?.src).toBe(library[0].src);
      expect(result.current.index).toBe(2);
    } finally {
      save.mockRestore();
    }
  });
  it("fades in, fades to silence before pausing, and keeps the user's volume", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAudioPlayer);
    act(() => result.current.setVolume(0.6));
    expect(TestAudioContext.instances).toHaveLength(0);
    await act(async () => result.current.transport("play"));
    const context = TestAudioContext.instances[0];
    const media = TestAudio.instances[0];
    expect(context).toBeDefined();
    expect(context.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(context.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0.6,
      0.04,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    act(() => result.current.pause());
    expect(result.current.playing).toBe(false);
    expect(media.paused).toBe(false);
    expect(context.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0,
      0.14,
    );
    await act(() => vi.advanceTimersByTimeAsync(20));
    expect(media.paused).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(80));
    expect(media.paused).toBe(true);
    expect(result.current.volume).toBe(0.6);
    expect(localStorage.getItem("m0xxie-player-volume")).toBe("0.6");
    await act(async () => result.current.transport("play"));
    expect(context.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0.6,
      expect.closeTo(0.24),
    );
  });
  it("reverses a pending fade-out on a quick second click without a delayed pause", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    const context = TestAudioContext.instances[0];
    await act(() => vi.advanceTimersByTimeAsync(100));
    act(() => result.current.transport("play"));
    await act(() => vi.advanceTimersByTimeAsync(20));
    await act(async () => result.current.transport("play"));
    expect(context).toBeDefined();
    expect(context.gain.setValueAtTime).toHaveBeenLastCalledWith(
      expect.closeTo(0.25),
      0.12,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.playing).toBe(true);
    expect(TestAudio.instances[0].paused).toBe(false);
    expect(TestAudio.sources).toEqual(["/audio/better.mp3"]);
    act(() => result.current.pause());
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(context.state).toBe("closed");
    expect(TestAudio.instances[0].paused).toBe(true);
  });
  it("finishes fading before Stop resets the playback position", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    await act(() => vi.advanceTimersByTimeAsync(100));
    act(() => result.current.seek(42));
    act(() => result.current.transport("stop"));
    expect(TestAudio.instances[0].currentTime).toBe(42);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(TestAudio.instances[0].paused).toBe(true);
    expect(result.current.position).toBe(0);
    expect(TestAudio.instances[0].currentTime).toBe(0);
  });
  it("keeps a new track playing when the old fade-out or a queued pause finishes", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    await act(() => vi.advanceTimersByTimeAsync(100));
    act(() => result.current.pause());
    await act(() => vi.advanceTimersByTimeAsync(20));
    await act(async () => result.current.choose(1, true));
    // The browser queues media events rather than dispatching them synchronously.
    act(() => TestAudio.instances[0].dispatchEvent(new Event("pause")));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.playing).toBe(true);
    expect(result.current.track?.title).toBe("free my mind");
    expect(TestAudio.instances[0].paused).toBe(false);
  });
  it("does not resume playback when a pending Play completes after Pause", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAudioPlayer);
    const media = TestAudio.instances[0];
    const originalPlay = media.play.bind(media);
    let finishPlay!: () => void;
    vi.spyOn(media, "play").mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finishPlay = resolve;
      });
      await originalPlay();
    });
    act(() => result.current.transport("play"));
    act(() => result.current.transport("play"));
    await act(async () => finishPlay());
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.playing).toBe(false);
    expect(media.paused).toBe(true);
    expect(
      TestAudioContext.instances[0].gain.linearRampToValueAtTime,
    ).not.toHaveBeenCalled();
  });
  it("changing volume during fade-out preserves the pause and applies on resume", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    await act(() => vi.advanceTimersByTimeAsync(100));
    act(() => result.current.pause());
    await act(() => vi.advanceTimersByTimeAsync(20));
    act(() => result.current.setVolume(0.2));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(TestAudio.instances[0].paused).toBe(true);
    await act(async () => result.current.transport("play"));
    expect(
      TestAudioContext.instances[0].gain.linearRampToValueAtTime,
    ).toHaveBeenLastCalledWith(0.2, expect.any(Number));
    expect(localStorage.getItem("m0xxie-player-volume")).toBe("0.2");
  });
  it("falls back to gradual media volume changes when Web Audio is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", undefined);
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.transport("play"));
    const media = TestAudio.instances[0];
    expect(media.volume).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(20));
    expect(media.volume).toBeGreaterThan(0);
    expect(media.volume).toBeLessThan(0.5);
    await act(() => vi.advanceTimersByTimeAsync(80));
    expect(media.volume).toBe(0.5);
    act(() => result.current.pause());
    await act(() => vi.advanceTimersByTimeAsync(20));
    expect(media.paused).toBe(false);
    expect(media.volume).toBeGreaterThan(0);
    expect(media.volume).toBeLessThan(0.5);
    await act(() => vi.advanceTimersByTimeAsync(80));
    expect(media.volume).toBe(0);
    expect(media.paused).toBe(true);
    expect(result.current.volume).toBe(0.5);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it.each(["better", "voyage"])(
    "plays %s on first click, toggles pause without restarting and preserves audio on reopening",
    async (title) => {
      vi.useFakeTimers();
      render(createElement(App));
      await act(() => vi.advanceTimersByTimeAsync(3000));
      expect(TestAudio.instances).toHaveLength(0);
      expect(TestAudio.sources).toEqual([]);

      const openPlayer = async () => {
        const input = screen.getByRole("combobox");
        fireEvent.change(input, { target: { value: "/player" } });
        fireEvent.submit(input.closest("form")!);
        await act(() => vi.advanceTimersByTimeAsync(3000));
      };
      await openPlayer();
      const media = TestAudio.instances[0];
      expect(TestAudio.instances).toHaveLength(1);
      expect(TestAudio.sources).toEqual([]);
      expect(
        screen.getByRole("button", { name: "Выбрать better" }),
      ).toHaveTextContent("2:00");
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `Выбрать ${title}` }),
        );
      });
      expect(TestAudio.sources).toEqual([`/audio/${title}.mp3`]);
      expect(media.paused).toBe(false);
      expect(screen.getByRole("button", { name: "Пауза" })).toBeInTheDocument();
      act(() => {
        media.dispatchEvent(new Event("loadedmetadata"));
        media.currentTime = 42;
        media.dispatchEvent(new Event("timeupdate"));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `Выбрать ${title}` }),
        );
      });
      expect(media.paused).toBe(true);
      expect(media.currentTime).toBe(42);
      expect(
        screen.getByRole("button", { name: "Воспроизвести" }),
      ).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `Выбрать ${title}` }),
        );
      });
      expect(media.paused).toBe(false);
      expect(media.currentTime).toBe(42);
      expect(TestAudio.sources).toEqual([`/audio/${title}.mp3`]);
      fireEvent.click(screen.getByRole("button", { name: "Закрыть плеер" }));
      await openPlayer();
      expect(
        TestAudio.instances.filter((audio) => !audio.initialSource),
      ).toEqual([media]);
      expect(
        screen.getByRole("slider", { name: "Позиция воспроизведения" }),
      ).toHaveValue("42");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Воспроизвести" }));
      });
      expect(media.paused).toBe(false);
      expect(TestAudio.sources).toEqual([`/audio/${title}.mp3`]);
    },
  );
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
    await act(async () => result.current.choose(1, true));
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(2);
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(0);
  });
  it("uses build durations before playback and does not load when selecting or seeking", async () => {
    const { result, unmount } = renderHook(useAudioPlayer);
    expect(result.current.durations).toEqual([120.5, 130.5, 140.5]);
    expect(result.current.duration).toBe(120.5);
    expect(TestAudio.instances.every((audio) => audio.paused)).toBe(true);
    act(() => result.current.choose(2));
    expect(result.current.duration).toBe(140.5);
    act(() => result.current.seek(42));
    expect(result.current.position).toBe(42);
    expect(TestAudio.sources).toEqual([]);
    await act(async () => result.current.transport("play"));
    expect(TestAudio.sources).toEqual(["/audio/voyage.mp3"]);
    expect(TestAudio.instances[0].currentTime).toBe(42);
    unmount();
    expect(TestAudio.instances.every((audio) => audio.src === "")).toBe(true);
  });
  it("resolves an unknown build duration only after playing that track", async () => {
    const original = library[2].duration;
    library[2].duration = null;
    try {
      const { result } = renderHook(useAudioPlayer);
      expect(result.current.durations).toEqual([120.5, 130.5, null]);
      act(() => result.current.choose(2));
      expect(result.current.duration).toBe(0);
      expect(TestAudio.sources).toEqual([]);
      await act(async () => result.current.transport("play"));
      expect(result.current.duration).toBe(240);
      expect(result.current.durations).toEqual([120.5, 130.5, 240]);
    } finally {
      library[2].duration = original;
    }
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
    expect(TestAudio.sources).toEqual([]);
    await act(async () => result.current.transport("play"));
    expect(result.current.playing).toBe(true);
    await act(async () => result.current.transport("next"));
    expect(result.current.track?.title).toBe("better");
    expect(result.current.playing).toBe(true);
    expect(TestAudio.sources).toEqual([
      "/audio/voyage.mp3",
      "/audio/better.mp3",
    ]);
    act(() => result.current.pause());
    act(() => result.current.transport("next"));
    expect(TestAudio.sources).toHaveLength(2);
    await act(async () => result.current.transport("play"));
    expect(TestAudio.sources[2]).toBe("/audio/free%20my%20mind.wav");
  });
  it.each([2.99, 3, 3.01, 42])(
    "restarts only previous after three seconds, using the live media position (%s)",
    async (position) => {
      const { result } = renderHook(useAudioPlayer);
      await act(async () => result.current.choose(1, true));
      const media = TestAudio.instances[0];
      // The browser can advance past the threshold between timeupdate events.
      media.currentTime = position;
      expect(result.current.position).toBe(0);
      await act(async () => result.current.transport("previous"));
      expect(result.current.index).toBe(position > 3 ? 1 : 0);
      expect(result.current.position).toBe(0);
      expect(media.currentTime).toBe(0);
      expect(result.current.playing).toBe(true);
      expect(TestAudio.sources).toHaveLength(position > 3 ? 1 : 2);
      if (position > 3) {
        await act(async () => result.current.transport("previous"));
        expect(result.current.index).toBe(0);
      }
    },
  );
  it("still advances next after more than three seconds", async () => {
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.choose(1, true));
    act(() => result.current.seek(42));
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(2);
    expect(result.current.position).toBe(0);
    expect(result.current.playing).toBe(true);
  });
  it.each(["panel", "model"])(
    "applies previous restart through the %s controls",
    async (surface) => {
      const { result } = renderHook(useAudioPlayer);
      await act(async () => result.current.choose(1, true));
      await act(async () => {
        render(
          createElement(PlayerPanel, {
            player: result.current,
            onClose: vi.fn(),
          }),
        );
      });
      const onModelAction = vi.mocked(createPlayer).mock.calls.at(-1)![1];
      const press = async (action: "previous" | "next") => {
        await act(async () => {
          if (surface === "model") onModelAction(action);
          else
            fireEvent.click(
              screen.getByRole("button", {
                name:
                  action === "previous" ? "Предыдущий трек" : "Следующий трек",
              }),
            );
        });
      };
      act(() => result.current.seek(42));
      await press("previous");
      expect(result.current.index).toBe(1);
      expect(result.current.position).toBe(0);
      expect(result.current.playing).toBe(true);
      await press("previous");
      expect(result.current.index).toBe(0);
      act(() => result.current.seek(42));
      await press("next");
      expect(result.current.index).toBe(1);
    },
  );
  it.each([false, true])(
    "restarts a paused track without resuming or reloading it (loaded: %s)",
    async (loaded) => {
      const { result } = renderHook(useAudioPlayer);
      await act(async () => result.current.choose(1, loaded));
      const media = TestAudio.instances[0];
      if (loaded) act(() => media.pause());
      act(() => result.current.seek(42));
      act(() => result.current.transport("previous"));
      expect(result.current.index).toBe(1);
      expect(result.current.position).toBe(0);
      expect(media.currentTime).toBe(0);
      expect(result.current.playing).toBe(false);
      expect(TestAudio.sources).toHaveLength(loaded ? 1 : 0);
    },
  );
  it("keeps shuffle history when restarting the current track", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { result } = renderHook(useAudioPlayer);
    act(() => result.current.toggleShuffle());
    await act(async () => result.current.transport("play"));
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(2);
    act(() => result.current.seek(42));
    await act(async () => result.current.transport("previous"));
    expect(result.current.index).toBe(2);
    expect(result.current.position).toBe(0);
    await act(async () => result.current.transport("previous"));
    expect(result.current.index).toBe(0);
    await act(async () => result.current.transport("next"));
    expect(result.current.index).toBe(2);
  });
  it("responds to track completion, bounds seek/volume, and stops at zero", async () => {
    const { result } = renderHook(useAudioPlayer);
    await act(async () => result.current.choose(1, true));
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
