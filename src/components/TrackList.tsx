import {
  DragDropProvider,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Accessibility, Feedback } from "@dnd-kit/dom";
import { FiChevronRight, FiMenu } from "react-icons/fi";
import type { AudioPlayer } from "../hooks/useAudioPlayer";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { formatTime } from "../lib/formatTime";

type ListPlayer = Pick<
  AudioPlayer,
  "tracks" | "index" | "durations" | "transport" | "choose" | "reorder"
>;
const accessibility = Accessibility.configure({
  screenReaderInstructions: {
    draggable:
      "Нажми пробел или Enter, чтобы захватить трек. Перемещай стрелками вверх и вниз. Пробел или Enter — сохранить, Escape — отменить.",
  },
  announcements: {
    dragstart: ({ operation: { source } }: DragStartEvent) =>
      `Перемещение трека ${source?.data.title ?? ""}.`,
    dragover: ({ operation: { source } }: DragOverEvent) =>
      isSortable(source) ? `Позиция ${source.index + 1}.` : undefined,
    dragend: ({ canceled, operation: { source } }: DragEndEvent) =>
      canceled
        ? "Перемещение отменено."
        : isSortable(source)
          ? `${source.data.title}: позиция ${source.index + 1}.`
          : undefined,
  },
});

export function TrackList({ player }: { player: ListPlayer }) {
  const reduced = useReducedMotion();
  return (
    <DragDropProvider
      plugins={(defaults) => [
        ...defaults.filter(
          (plugin) =>
            plugin !== Accessibility && (!reduced || plugin !== Feedback),
        ),
        accessibility,
        ...(reduced
          ? [
              Feedback.configure({
                dropAnimation: null,
                keyboardTransition: null,
              }),
            ]
          : []),
      ]}
      onDragEnd={(event) => {
        if (event.canceled || !event.operation.target) return;
        const { source } = event.operation;
        if (isSortable(source) && source.initialIndex !== source.index)
          player.reorder(source.initialIndex, source.index);
      }}
    >
      <div className="tracks" aria-label="Треки">
        {player.tracks.map((track, index) => (
          <SortableTrack
            key={track.src}
            player={player}
            index={index}
            reduced={reduced}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}

function SortableTrack({
  player,
  index,
  reduced,
}: {
  player: ListPlayer;
  index: number;
  reduced: boolean;
}) {
  const track = player.tracks[index];
  const disabled = player.tracks.length < 2;
  const { ref, handleRef, isDragging } = useSortable({
    id: track.src,
    index,
    disabled,
    data: { title: track.title },
    transition: reduced ? null : undefined,
  });
  return (
    <div
      ref={ref}
      className="track-row"
      data-dragging={isDragging || undefined}
    >
      <button
        type="button"
        className="track"
        onClick={() =>
          player.index === index
            ? player.transport("play")
            : player.choose(index, true)
        }
        aria-pressed={player.index === index}
        aria-label={`Выбрать ${track.title}`}
      >
        <span className="track-number">
          {player.index === index ? (
            <FiChevronRight aria-hidden="true" />
          ) : (
            String(index + 1).padStart(2, "0")
          )}
        </span>
        <span>{track.title}</span>
        <span>{formatTime(player.durations[index])}</span>
      </button>
      <button
        ref={handleRef}
        type="button"
        className="track-drag-handle"
        disabled={disabled}
        aria-label={`Переместить ${track.title}`}
        title="Перетащи для сортировки · пробел, ↑ ↓, пробел — с клавиатуры"
      >
        <FiMenu aria-hidden="true" />
      </button>
    </div>
  );
}
