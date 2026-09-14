import { useRef, useState } from "react";
import { Terminal, type TerminalHandle } from "./components/Terminal";
import { PlayerPanel } from "./components/PlayerPanel";
import { useAudioPlayer } from "./hooks/useAudioPlayer";

export default function App() {
  const terminal = useRef<TerminalHandle>(null),
    [listening, setListening] = useState(false);
  const player = useAudioPlayer();
  function closePlayer() {
    player.pause();
    setListening(false);
    terminal.current?.focus();
  }
  return (
    <div
      className={`app ${listening ? "listening" : ""} ${player.playing ? "playing" : ""}`}
    >
      <div className="noise" aria-hidden="true" />
      <main id="workspace">
        <Terminal ref={terminal} onListen={() => setListening(true)} />
        {listening && <PlayerPanel player={player} onClose={closePlayer} />}
      </main>
    </div>
  );
}
