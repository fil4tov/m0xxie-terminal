import { useEffect, useRef, useState } from "react";
import { tracks } from "../tracks";
import { createAudioFader } from "../lib/createAudioFader";
const VOLUME_STORAGE_KEY = "m0xxie-player-volume";
const DEFAULT_VOLUME = 0.5;

function readVolume() {
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved !== null && saved.trim() !== "") {
      const value = Number(saved);
      if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
    }
  } catch {
    // Storage may be unavailable in this browser.
  }
  return DEFAULT_VOLUME;
}

export type TransportAction = "play" | "stop" | "previous" | "next";
export function useAudioPlayer(enabled = true) {
  const audio = useRef<HTMLAudioElement | null>(null),
    indexRef = useRef(0),
    loadedIndex = useRef<number | null>(null),
    positionRef = useRef(0),
    wantsToPlay = useRef(false),
    fader = useRef<ReturnType<typeof createAudioFader> | null>(null),
    request = useRef(0);
  const shuffleState = useRef({
    enabled: false,
    remaining: [] as number[],
    history: [0],
    cursor: 0,
  });
  const [shuffle, setShuffle] = useState(false);
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(tracks[0]?.duration ?? 0),
    [volume, setVolumeState] = useState(readVolume),
    [error, setError] = useState("");
  const volumeRef = useRef(volume);
  const durationCache = useRef<(number | null)[]>(
    tracks.map((track) => track.duration),
  );
  const [durations, setDurations] = useState(durationCache.current);
  function rememberDuration(index: number, value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    durationCache.current = durationCache.current.map((duration, i) =>
      i === index ? value : duration,
    );
    setDurations(durationCache.current);
    if (index === indexRef.current) setDuration(value);
  }
  async function play() {
    const element = audio.current;
    if (!element || !tracks.length) return;
    const token = ++request.current;
    wantsToPlay.current = true;
    setPlaying(true);
    try {
      fader.current ??= createAudioFader(element);
      const envelope = fader.current;
      envelope.hold();
      if (element.paused) envelope.silence();
      if (loadedIndex.current !== indexRef.current) {
        loadedIndex.current = indexRef.current;
        element.src = tracks[indexRef.current].src;
        element.load();
      }
      // Both calls start inside the user's gesture, including on mobile browsers.
      await Promise.all([envelope.resume(), element.play()]);
      if (token === request.current) {
        envelope.fadeTo(volumeRef.current);
        setError("");
      }
    } catch (error) {
      if (token !== request.current) return;
      wantsToPlay.current = false;
      setPlaying(false);
      fader.current?.silence();
      element.pause();
      if (
        token === request.current &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        setError(
          "Не удалось воспроизвести файл. Выбери другой трек или нажми «Воспроизвести» ещё раз.",
        );
    }
  }
  function pause(afterPause?: () => void) {
    const token = ++request.current;
    const element = audio.current;
    wantsToPlay.current = false;
    setPlaying(false);
    const finish = () => {
      if (token !== request.current) return;
      element?.pause();
      afterPause?.();
    };
    if (element && !element.paused && fader.current)
      fader.current.fadeTo(0, finish);
    else {
      fader.current?.silence();
      finish();
    }
  }
  function loadTrack(next: number, autoplay = true) {
    const element = audio.current;
    if (!element || !tracks.length || !Number.isInteger(next)) return;
    ++request.current;
    fader.current?.silence();
    wantsToPlay.current = false;
    setPlaying(false);
    element.pause();
    if (loadedIndex.current !== null) {
      element.removeAttribute("src");
      element.load();
      loadedIndex.current = null;
    }
    indexRef.current = (next + tracks.length) % tracks.length;
    setIndex(indexRef.current);
    positionRef.current = 0;
    setPosition(0);
    setDuration(durationCache.current[indexRef.current] ?? 0);
    setError("");
    if (autoplay) void play();
  }
  function resetShuffle(current: number) {
    const state = shuffleState.current;
    state.remaining = tracks.map((_, i) => i).filter((i) => i !== current);
    state.history = [current];
    state.cursor = 0;
  }
  function toggleShuffle() {
    const state = shuffleState.current;
    state.enabled = !state.enabled;
    resetShuffle(indexRef.current);
    setShuffle(state.enabled);
  }
  function choose(next: number, autoplay = false) {
    loadTrack(next, autoplay);
    resetShuffle(indexRef.current);
  }
  function advance(direction: 1 | -1, autoplay: boolean) {
    if (!tracks.length) return;
    const state = shuffleState.current;
    if (!state.enabled) {
      loadTrack(indexRef.current + direction, autoplay);
      return;
    }
    if (direction === -1) {
      state.cursor = Math.max(0, state.cursor - 1);
    } else if (state.cursor < state.history.length - 1) {
      state.cursor++;
    } else {
      if (!state.remaining.length) state.remaining = tracks.map((_, i) => i);
      const candidates = state.remaining.filter((i) => i !== indexRef.current);
      const next = candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : state.remaining[0];
      state.remaining = state.remaining.filter((i) => i !== next);
      state.history.push(next);
      state.cursor++;
    }
    loadTrack(state.history[state.cursor], autoplay);
  }
  useEffect(() => {
    if (!enabled || !tracks.length) return;
    const element = new Audio();
    audio.current = element;
    element.preload = "none";
    element.volume = volumeRef.current;
    const onPlay = () => {
        if (wantsToPlay.current) setPlaying(true);
        else element.pause();
      },
      onPause = () => {
        // A queued pause from the previous track may arrive after the next play.
        if (!element.paused) return;
        wantsToPlay.current = false;
        setPlaying(false);
      },
      onTime = () => {
        // Ignore reset events while switching to an as-yet-unloaded track.
        if (loadedIndex.current === null || element.readyState < 1) return;
        positionRef.current = element.currentTime;
        setPosition(element.currentTime);
      };
    const onMetadata = () => {
      rememberDuration(indexRef.current, element.duration);
      if (positionRef.current > 0 && Number.isFinite(element.duration)) {
        const next = Math.min(positionRef.current, element.duration);
        element.currentTime = next;
        positionRef.current = next;
        setPosition(next);
      }
    };
    const onEnd = () => advance(1, true);
    const onError = () =>
      setError(
        "Файл не загрузился. Проверь соединение или выбери другой трек.",
      );
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);
    element.addEventListener("timeupdate", onTime);
    element.addEventListener("loadedmetadata", onMetadata);
    element.addEventListener("ended", onEnd);
    element.addEventListener("error", onError);
    return () => {
      ++request.current;
      wantsToPlay.current = false;
      fader.current?.dispose();
      fader.current = null;
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("timeupdate", onTime);
      element.removeEventListener("loadedmetadata", onMetadata);
      element.removeEventListener("ended", onEnd);
      element.removeEventListener("error", onError);
      element.pause();
      element.removeAttribute("src");
      element.load();
      audio.current = null;
      loadedIndex.current = null;
    };
  }, [enabled]);
  function transport(action: TransportAction) {
    const element = audio.current;
    if (!element) return;
    if (action === "play") {
      if (!wantsToPlay.current) void play();
      else pause();
    }
    if (action === "stop") {
      pause(() => {
        element.currentTime = 0;
        positionRef.current = 0;
        setPosition(0);
      });
    }
    if (action === "previous" || action === "next")
      advance(action === "next" ? 1 : -1, wantsToPlay.current);
  }
  function seek(value: number) {
    const element = audio.current;
    if (!element || !Number.isFinite(value)) return;
    const mediaReady = loadedIndex.current !== null && element.readyState >= 1;
    const limit = mediaReady
      ? element.duration
      : durationCache.current[indexRef.current];
    if (limit == null || !Number.isFinite(limit)) return;
    const next = Math.max(0, Math.min(value, limit));
    positionRef.current = next;
    setPosition(next);
    if (mediaReady) element.currentTime = next;
  }
  function setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(1, value));
    volumeRef.current = next;
    setVolumeState(next);
    if (fader.current) {
      if (wantsToPlay.current) fader.current.fadeTo(next);
    } else if (audio.current) audio.current.volume = next;
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(next));
    } catch {
      // Volume controls must still work when storage is unavailable.
    }
  }
  return {
    tracks,
    index,
    track: tracks[index] ?? null,
    playing,
    position,
    duration,
    durations,
    volume,
    error,
    shuffle,
    toggleShuffle,
    transport,
    choose,
    seek,
    setVolume,
    pause,
  };
}
export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
