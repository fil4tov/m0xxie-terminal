import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves click-to-play controls alongside separate drag handles", () => {
  const { choose, transport, reordered } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Second" }));
  expect(choose).toHaveBeenCalledWith(1, true);
  fireEvent.click(screen.getByRole("button", { name: "Выбрать First" }));
  expect(transport).toHaveBeenCalledWith("play");
  fireEvent.click(screen.getByRole("button", { name: "Переместить First" }));
  expect(reordered).not.toHaveBeenCalled();
  expect(transport).toHaveBeenCalledTimes(1);
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
