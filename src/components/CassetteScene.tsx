import { useEffect, useRef, useState } from "react";
import type { TransportAction } from "../hooks/useAudioPlayer";
import type { PlayerScene } from "../three/createPlayer";

export function CassetteScene({
  playing,
  onAction,
}: {
  playing: boolean;
  onAction: (action: TransportAction) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<PlayerScene | null>(null),
    actionRef = useRef(onAction),
    playingRef = useRef(playing);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    actionRef.current = onAction;
    playingRef.current = playing;
    scene.current?.setPlaying(playing);
  }, [onAction, playing]);
  useEffect(() => {
    let disposed = false;
    import("../three/createPlayer")
      .then(({ createPlayer }) => {
        if (disposed || !container.current) return;
        scene.current = createPlayer(container.current, (action) =>
          actionRef.current(action),
        );
        scene.current.setPlaying(playingRef.current);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  return (
    <div
      id="player-canvas"
      ref={container}
      role="img"
      aria-label="Объёмный кассетный плеер. Перетаскивайте для поворота, нажимайте кнопки на корпусе."
    >
      {failed && (
        <p className="scene-fallback">
          3D недоступен в этом браузере. Кнопки плеера работают ниже.
        </p>
      )}
    </div>
  );
}
