import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CassetteScene } from "./CassetteScene";
import { createPlayer } from "../three/createPlayer";

vi.mock("../three/createPlayer", () => ({
  createPlayer: vi.fn(() => ({ setPlaying: vi.fn(), dispose: vi.fn() })),
}));

it("updates transport without rebuilding the scene and disposes it on close", async () => {
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
  const nextAction = vi.fn();
  rerender(<CassetteScene playing={false} onAction={nextAction} />);
  expect(factory).toHaveBeenCalledTimes(1);
  expect(scene.setPlaying).toHaveBeenLastCalledWith(false);
  factory.mock.calls[0][1]("next");
  expect(nextAction).toHaveBeenCalledWith("next");
  expect(onAction).toHaveBeenCalledTimes(1);
  unmount();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});
