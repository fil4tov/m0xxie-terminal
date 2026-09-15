import { useEffect, useRef } from "react";
import type { AudioPlayer } from "../hooks/useAudioPlayer";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { CassetteScene } from "./CassetteScene";
import { TrackList } from "./TrackList";
import { formatTime as time } from "../lib/formatTime";
import {
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
  FiShuffle,
  FiX,
} from "react-icons/fi";
export function PlayerPanel({
  player,
  onClose,
}: {
  player: AudioPlayer;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null),
    reduced = useReducedMotion();
  useEffect(() => {
    if (window.innerWidth < 761)
      panel.current?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
  }, [reduced]);
  return (
    <section ref={panel} className="player-panel" aria-label="Кассетный плеер">
      <div className="player-heading">
        <span>
          <i className="status-light" />
          {player.playing ? "NOW PLAYING" : "TAPE LOADED"}
        </span>
        <button onClick={onClose} aria-label="Закрыть плеер">
          <FiX aria-hidden="true" />
        </button>
      </div>
      <div className="device-stage">
        <div className="device-halo" aria-hidden="true" />
        <CassetteScene playing={player.playing} onAction={player.transport} />
        <span className="device-side-label" aria-hidden="true">
          PORTABLE STEREO / FR–01
        </span>
      </div>
      <p className="device-hint">Поверни плеер · нажми кнопку на корпусе</p>
      <div className="now-playing">
        <div>
          <p id="track-title">{player.track?.title ?? "Пока нет треков"}</p>
          <p id="track-artist">m0xxie / PERSONAL TAPES</p>
        </div>
        <div className="equalizer" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="seek-row">
        <span>{time(player.position)}</span>
        <input
          id="seek"
          disabled={!player.duration}
          type="range"
          min="0"
          max={player.duration || 1}
          step="0.1"
          value={Math.min(player.position, player.duration)}
          onChange={(event) => player.seek(Number(event.target.value))}
          aria-label="Позиция воспроизведения"
          aria-valuetext={`${time(player.position)} из ${time(player.duration)}`}
        />
        <span>{time(player.durations[player.index])}</span>
      </div>
      <div className="transport">
        <div>
          <button
            disabled={!player.track}
            onClick={() => player.transport("previous")}
            aria-label="Предыдущий трек"
          >
            <FiSkipBack aria-hidden="true" />
          </button>
          <button
            disabled={!player.track}
            onClick={() => player.transport("play")}
            className="play-button"
            aria-label={player.playing ? "Пауза" : "Воспроизвести"}
          >
            {player.playing ? (
              <FiPause aria-hidden="true" />
            ) : (
              <FiPlay aria-hidden="true" />
            )}
          </button>
          <button
            disabled={!player.track}
            onClick={() => player.transport("next")}
            aria-label="Следующий трек"
          >
            <FiSkipForward aria-hidden="true" />
          </button>
          <button
            disabled={player.tracks.length < 2}
            onClick={player.toggleShuffle}
            className="shuffle-button"
            aria-label="Случайный порядок"
            aria-pressed={player.shuffle}
            title={player.shuffle ? "Выключить shuffle" : "Включить shuffle"}
          >
            <FiShuffle aria-hidden="true" />
          </button>
        </div>
        {player.systemVolume ? (
          <span className="volume-label">Громкость — кнопками телефона</span>
        ) : (
          <label className="volume-label">
            <span>VOL</span>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              aria-label="Громкость"
            />
          </label>
        )}
      </div>
      <TrackList player={player} />
      {player.error && (
        <p id="audio-error" role="status">
          {player.error}
        </p>
      )}
    </section>
  );
}
