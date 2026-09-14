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
  it("filters slash commands and supports keyboard completion", async () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "/" } });
    await act(async () => {});
    expect(screen.getAllByRole("option")).toHaveLength(5);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("/bandcamp");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("opens suggestions above the input inside the chat and scrolls only the chat", async () => {
    render(<Terminal onListen={vi.fn()} />);
    submit("/help");
    await act(() => vi.advanceTimersByTimeAsync(4000));
    const terminal = screen.getByRole("region", { name: "Терминал M0XXIE" });
    const historyText = screen.getByRole("log").textContent;
    const chat = screen.getByRole("region", { name: "Чат терминала" });
    Object.defineProperty(chat, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    chat.scrollTop = 0;
    const pageScroll = document.documentElement.scrollTop;
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "/" },
    });
    await act(async () => {});
    const menu = screen.getByRole("listbox");
    expect(terminal).toContainElement(menu);
    expect(chat).toContainElement(menu);
    expect(chat).not.toContainElement(screen.getByRole("combobox"));
    expect(terminal).toContainElement(screen.getByRole("combobox"));
    expect(
      menu.compareDocumentPosition(screen.getByRole("combobox")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(chat.scrollTop).toBe(900);
    expect(document.documentElement.scrollTop).toBe(pageScroll);
    expect(screen.getByRole("log").textContent).toBe(historyText);
    const option = screen.getByRole("option", { name: /\/github/ });
    fireEvent.pointerDown(option);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(option);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(
      screen.getByRole("link", { name: "github.com" }),
    ).toBeInTheDocument();
  });
  it("retains closing suggestions for animation and handles immediate reopening", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "/git" } });
    const menu = screen.getByRole("listbox");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(menu).toBeInTheDocument();
    expect(menu.closest("[inert]")).not.toBeNull();
    expect(menu.querySelectorAll("[role=option]")).toHaveLength(1);
    fireEvent.change(input, { target: { value: "/" } });
    expect(screen.getByRole("listbox")).toBe(menu);
    expect(menu.closest("[inert]")).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(5);
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
  it("prints the current page address for the hidden pwd command", async () => {
    const originalUrl = window.location.href;
    try {
      window.history.replaceState(null, "", "/?demo=pwd#terminal");
      render(<Terminal onListen={vi.fn()} />);
      submit("pwd");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(3000));
      expect(screen.getByRole("log")).toHaveTextContent(window.location.href);
    } finally {
      window.history.replaceState(null, "", originalUrl);
    }
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
