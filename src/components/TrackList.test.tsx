import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TrackList } from "./TrackList";

const tracks = ["First", "Second", "Third"].map((title) => ({
  title,
  src: `/${title}.mp3`,
  artist: "m0xxie",
  duration: 120,
}));

function setup() {
  const choose = vi.fn(),
    transport = vi.fn(),
    reordered = vi.fn();
  function Harness() {
    const [ordered, setOrdered] = useState(tracks);
    return (
      <TrackList
        player={{
          tracks: ordered,
          index: ordered.indexOf(tracks[0]),
          durations: ordered.map((track) => track.duration),
          choose,
          transport,
          reorder(from, to) {
            reordered(from, to);
            setOrdered((previous) => {
              const next = [...previous];
              next.splice(to, 0, ...next.splice(from, 1));
              return next;
            });
          },
        }}
      />
    );
  }
  const view = render(<Harness />);
  const order = () =>
    screen
      .getAllByRole("button", { name: /^Выбрать/ })
      .map((button) => button.getAttribute("aria-label"));
  return { ...view, choose, transport, reordered, order };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves click-to-play controls alongside separate drag handles", () => {
  const played: string[] = [];
  const volumes: number[] = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(this.src);
    volumes.push(this.volume);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { choose, transport, reordered, unmount } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Second" }));
  expect(choose).toHaveBeenCalledWith(1, true);
  fireEvent.click(screen.getByRole("button", { name: "Выбрать First" }));
  expect(transport).toHaveBeenCalledWith("play");
  fireEvent.click(screen.getByRole("button", { name: "Выбрать First" }));
  expect(played).toHaveLength(3);
  expect(played[0]).toMatch(/\/sounds\/switch\.mp3$/);
  expect(played[1]).toMatch(/\/sounds\/play\.mp3$/);
  expect(played[2]).toMatch(/\/sounds\/play\.mp3$/);
  expect(volumes).toEqual([0.25, 0.25, 0.25]);
  fireEvent.click(screen.getByRole("button", { name: "Переместить First" }));
  expect(reordered).not.toHaveBeenCalled();
  expect(transport).toHaveBeenCalledTimes(2);
  expect(played).toHaveLength(3);
  unmount();
});

it("uses dnd-kit keyboard sorting and cancels with Escape", async () => {
  document.getAnimations = () => [];
  Element.prototype.getAnimations = () => [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
  const { reordered } = setup();
  const handle = screen.getByRole("button", { name: "Переместить First" });
  handle.focus();
  fireEvent.keyDown(handle, { key: " ", code: "Space" });
  await waitFor(() =>
    expect(handle.closest(".track-row")).toHaveAttribute(
      "data-dragging",
      "true",
    ),
  );
  fireEvent.keyDown(handle, { key: "Escape", code: "Escape" });
  await waitFor(() =>
    expect(handle.closest(".track-row")).not.toHaveAttribute("data-dragging"),
  );
  expect(reordered).not.toHaveBeenCalled();
});
