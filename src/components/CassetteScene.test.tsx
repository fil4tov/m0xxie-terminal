import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CassetteScene } from "./CassetteScene";
import { createPlayer } from "../three/createPlayer";

vi.mock("../three/createPlayer", () => ({
  createPlayer: vi.fn(() => ({ setPlaying: vi.fn(), dispose: vi.fn() })),
}));

afterEach(() => vi.restoreAllMocks());

it("updates transport without rebuilding the scene and disposes it on close", async () => {
  const played: string[] = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(this.src);
    return Promise.resolve();
  });
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const onAction = vi.fn();
  const { rerender, unmount } = render(
    <CassetteScene playing onAction={onAction} />,
  );
  await act(async () => {});
  const factory = vi.mocked(createPlayer);
  const scene = factory.mock.results[0].value;
  expect(scene.setPlaying).toHaveBeenCalledWith(true);
  factory.mock.calls[0][1]("play");
  expect(onAction).toHaveBeenCalledWith("play");
  expect(played).toHaveLength(1);
  expect(played[0]).toMatch(/\/sounds\/play\.mp3$/);
  const nextAction = vi.fn();
  rerender(<CassetteScene playing={false} onAction={nextAction} />);
  expect(factory).toHaveBeenCalledTimes(1);
  expect(scene.setPlaying).toHaveBeenLastCalledWith(false);
  factory.mock.calls[0][1]("next");
  expect(nextAction).toHaveBeenCalledWith("next");
  expect(played[1]).toMatch(/\/sounds\/switch\.mp3$/);
  factory.mock.calls[0][1]("previous");
  expect(nextAction).toHaveBeenLastCalledWith("previous");
  expect(played[2]).toMatch(/\/sounds\/switch\.mp3$/);
  factory.mock.calls[0][1]("play");
  expect(played[3]).toMatch(/\/sounds\/play\.mp3$/);
  expect(nextAction).toHaveBeenLastCalledWith("play");
  factory.mock.calls[0][1]("stop");
  expect(played[4]).toMatch(/\/sounds\/pause\.mp3$/);
  expect(nextAction).toHaveBeenLastCalledWith("stop");
  expect(onAction).toHaveBeenCalledTimes(1);
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
    new Error("Audio unavailable"),
  );
  factory.mock.calls[0][1]("play");
  await act(async () => {});
  expect(nextAction).toHaveBeenCalledTimes(5);
  pause.mockClear();
  unmount();
  expect(pause).toHaveBeenCalledTimes(3);
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});
