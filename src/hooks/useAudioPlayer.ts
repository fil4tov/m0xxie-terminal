import { useEffect, useRef, useState } from "react";
import { tracks } from "../config";
export type TransportAction = "play" | "stop" | "previous" | "next";
export function useAudioPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null),
    indexRef = useRef(0),
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
    [duration, setDuration] = useState(tracks[0].duration),
    [volume, setVolumeState] = useState(0.65),
    [error, setError] = useState("");
  const [durations, setDurations] = useState(
    tracks.map((track) => track.duration),
  );
  async function play() {
    const element = audio.current;
    if (!element) return;
    const token = ++request.current;
    try {
      await element.play();
      if (token === request.current) setError("");
    } catch (error) {
      if (
        token === request.current &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        setError(
          "Не удалось воспроизвести файл. Выбери другой трек или нажми «Воспроизвести» ещё раз.",
        );
    }
  }
  function pause() {
    ++request.current;
    audio.current?.pause();
  }
  function loadTrack(next: number, autoplay = true) {
    const element = audio.current;
    if (!element) return;
    ++request.current;
    element.pause();
    indexRef.current = (next + tracks.length) % tracks.length;
    const track = tracks[indexRef.current];
    setIndex(indexRef.current);
    setPosition(0);
    setDuration(track.duration);
    setError("");
    element.src = track.src;
    element.load();
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
  function choose(next: number, autoplay = true) {
    loadTrack(next, autoplay);
    resetShuffle(indexRef.current);
  }
  function advance(direction: 1 | -1, autoplay: boolean) {
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
    const element = new Audio();
    audio.current = element;
    element.preload = "metadata";
    element.volume = 0.65;
    const onPlay = () => setPlaying(true),
      onPause = () => setPlaying(false),
      onTime = () => setPosition(element.currentTime);
    const onMetadata = () => {
      if (!Number.isFinite(element.duration)) return;
      setDuration(element.duration);
      setDurations((previous) =>
        previous.map((value, i) =>
          i === indexRef.current ? element.duration : value,
        ),
      );
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
    element.src = tracks[indexRef.current].src;
    return () => {
      ++request.current;
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
    };
  }, []);
  function transport(action: TransportAction) {
    const element = audio.current;
    if (!element) return;
    if (action === "play") {
      if (element.paused) void play();
      else pause();
    }
    if (action === "stop") {
      pause();
      element.currentTime = 0;
      setPosition(0);
    }
    if (action === "previous" || action === "next")
      advance(action === "next" ? 1 : -1, !element.paused);
  }
  function seek(value: number) {
    const element = audio.current;
    if (!element || !Number.isFinite(element.duration)) return;
    element.currentTime = Math.max(0, Math.min(value, element.duration));
    setPosition(element.currentTime);
  }
  function setVolume(value: number) {
    const next = Math.max(0, Math.min(1, value));
    setVolumeState(next);
    if (audio.current) audio.current.volume = next;
  }
  return {
    index,
    track: tracks[index],
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
