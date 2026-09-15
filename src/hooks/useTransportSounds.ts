import { useEffect, useRef } from "react";
import type { TransportAction } from "./useAudioPlayer";

export function useTransportSounds(
  onAction?: (action: TransportAction) => void,
) {
  const sounds = useRef<
    Partial<Record<"play" | "pause" | "switch", HTMLAudioElement>>
  >({});

  useEffect(() => {
    const clips = sounds.current;
    return () => {
      for (const sound of Object.values(clips)) {
        sound.pause();
        sound.removeAttribute("src");
        sound.load();
      }
      sounds.current = {};
    };
  }, []);

  return (action: TransportAction) => {
    const name =
      action === "next" || action === "previous"
        ? "switch"
        : action === "stop"
          ? "pause"
          : "play";
    const sound = (sounds.current[name] ??= new Audio(
      `${import.meta.env.BASE_URL}sounds/${name}.mp3`,
    ));
    sound.volume = 0.25;
    for (const clip of Object.values(sounds.current)) {
      clip.pause();
      clip.currentTime = 0;
    }
    // Start inside the click gesture; a failed effect must not block music.
    void sound.play().catch(() => {});
    onAction?.(action);
  };
}
