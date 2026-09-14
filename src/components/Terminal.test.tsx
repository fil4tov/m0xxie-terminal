import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "./Terminal";

describe("Terminal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const submit = (command: string) => {
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: command },
    });
    fireEvent.submit(screen.getByRole("combobox").closest("form")!);
  };
  it("filters slash commands and supports keyboard completion", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "/" } });
    expect(screen.getAllByRole("option")).toHaveLength(5);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("/bandcamp");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("types the GitHub response before exposing the complete link", async () => {
    render(<Terminal onListen={vi.fn()} />);
    submit("/github");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole("link", { name: "github.com" })).toHaveAttribute(
      "href",
      "https://github.com/",
    );
  });
  it("opens the player after the response and cancels queued work on clear", async () => {
    const onListen = vi.fn();
    render(<Terminal onListen={onListen} />);
    submit("/listen");
    expect(onListen).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(onListen).toHaveBeenCalledTimes(1);
    submit("/listen");
    submit("/github");
    submit("/clear");
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(onListen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("log")).toBeEmptyDOMElement();
  });
  it("handles unknown commands and remembers submitted input", async () => {
    render(<Terminal onListen={vi.fn()} />);
    submit("/missing");
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole("log")).toHaveTextContent("не найдена");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" });
    expect(screen.getByRole("combobox")).toHaveValue("/missing");
  });
});
