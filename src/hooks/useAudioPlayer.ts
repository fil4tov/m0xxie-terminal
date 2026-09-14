import { useEffect, useRef, useState } from "react";
import { tracks } from "../config";
export type TransportAction = "play" | "stop" | "previous" | "next";
export function useAudioPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null),
    indexRef = useRef(0),
    request = useRef(0);
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
  function choose(next: number, autoplay = true) {
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
    const onEnd = () => choose(indexRef.current + 1);
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
      choose(indexRef.current + (action === "next" ? 1 : -1), !element.paused);
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
    transport,
    choose,
    seek,
    setVolume,
    pause,
  };
}
export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
