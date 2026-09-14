import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnimatedGreeting } from "./AnimatedGreeting";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("types on arrival, then pauses 30 seconds before each erase and retype cycle", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const { container, unmount } = render(<AnimatedGreeting />);
  const text = container.querySelector(".greeting-text")!;
  expect(text).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(999));
  expect(text).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(1));
  expect(text.textContent).toBe("h");
  act(() => vi.advanceTimersByTime(1_100));
  expect(text.textContent).toBe("hello, world");
  act(() => vi.advanceTimersByTime(29_999));
  expect(text).toHaveTextContent("hello, world");
  act(() => vi.advanceTimersByTime(1));
  expect(text.textContent).toBe("hello, worl");
  act(() => vi.advanceTimersByTime(715));
  expect(text).toBeEmptyDOMElement();
  expect(
    screen.getByRole("heading", { name: "hello, world" }),
  ).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(280));
  expect(text.textContent).toBe("h");
  act(() => vi.advanceTimersByTime(1_100));
  expect(text.textContent).toBe("hello, world");
  act(() => vi.advanceTimersByTime(30_000));
  expect(text.textContent).toBe("hello, worl");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("always starts with hello, then randomly selects a preset after erasing", () => {
  const random = vi
    .spyOn(Math, "random")
    .mockReturnValueOnce(0.9)
    .mockReturnValue(0);
  const { container } = render(<AnimatedGreeting />);
  const text = container.querySelector(".greeting-text")!;
  act(() => vi.advanceTimersByTime(2_100));
  expect(text.textContent).toBe("hello, world");
  expect(random).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(30_000 + 715));
  expect(text).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(280));
  expect(text.textContent).toBe("a");
  act(() => vi.advanceTimersByTime(("are you still here?".length - 1) * 100));
  expect(text.textContent).toBe("are you still here?");
  expect(
    screen.getByRole("heading", { name: "are you still here?" }),
  ).toBeInTheDocument();
  act(() =>
    vi.advanceTimersByTime(30_000 + ("are you still here?".length - 1) * 65),
  );
  expect(text).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(280 + 1_100));
  expect(text.textContent).toBe("hello, world");
  expect(random).toHaveBeenCalledTimes(2);
});

it("keeps the greeting still when reduced motion is enabled", () => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
  const { container } = render(<AnimatedGreeting />);
  act(() => vi.advanceTimersByTime(30_500));
  expect(container.querySelector(".greeting-text")).toHaveTextContent(
    "hello, world",
  );
  expect(vi.getTimerCount()).toBe(0);
});
