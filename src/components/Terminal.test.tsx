import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "./Terminal";
import { links, musicLinks } from "../config";

describe("Terminal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const submit = (command: string) => {
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: command },
    });
    fireEvent.submit(screen.getByRole("combobox").closest("form")!);
  };
  it("focuses the command input on mount and restores focus after a background click", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "pi" } });
    act(() => input.blur());
    fireEvent.click(document.body);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("pi");
  });
  it("returns focus after a player control click without blocking its value change", () => {
    render(
      <>
        <Terminal onListen={vi.fn()} />
        <input type="range" aria-label="Громкость" defaultValue="50" />
      </>,
    );
    const slider = screen.getByRole("slider");
    act(() => slider.focus());
    fireEvent.change(slider, { target: { value: "30" } });
    fireEvent.click(slider);
    expect(slider).toHaveValue("30");
    expect(screen.getByRole("combobox")).toHaveFocus();
  });
  it("preserves the caret when clicking inside the command input", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ping" } });
    act(() => {
      input.focus();
      input.setSelectionRange(2, 2);
    });
    fireEvent.click(input);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(2);
  });
  it("filters slash commands and supports keyboard completion", async () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "/" } });
    await act(async () => {});
    expect(screen.getAllByRole("option")).toHaveLength(6);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("/telegram");
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
      screen.getByRole("link", { name: "github.com/fil4tov" }),
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
    expect(screen.getAllByRole("option")).toHaveLength(6);
  });
  it("types the GitHub response before exposing the complete link", async () => {
    render(<Terminal onListen={vi.fn()} />);
    submit("/github");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(
      screen.getByRole("link", { name: "github.com/fil4tov" }),
    ).toHaveAttribute("href", "https://github.com/fil4tov");
  });
  it("supports a Telegram placeholder and uses the configured profile link", async () => {
    const originalUrl = links.telegram.url;
    try {
      links.telegram.url = "";
      render(<Terminal onListen={vi.fn()} />);
      submit("/telegram");
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(screen.getByRole("log")).toHaveTextContent(links.telegram.note);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      submit("/clear");
      links.telegram.url = "https://example.com/telegram-profile";
      submit("/telegram");
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(screen.getByRole("link", { name: "Telegram" })).toHaveAttribute(
        "href",
        links.telegram.url,
      );
    } finally {
      links.telegram.url = originalUrl;
    }
  });
  it("prints music links sequentially with each platform's own address", async () => {
    const original = musicLinks.splice(
      0,
      musicLinks.length,
      { label: "Spotify", url: "https://example.com/spotify-artist" },
      { label: "Яндекс Музыка", url: "https://example.com/yandex-artist" },
    );
    try {
      render(<Terminal onListen={vi.fn()} />);
      submit("/music");
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.getByRole("link")).not.toHaveTextContent("Spotify");
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(screen.getByRole("link", { name: "Spotify" })).toHaveAttribute(
        "href",
        "https://example.com/spotify-artist",
      );
      expect(
        screen.getByRole("link", { name: "Яндекс Музыка" }),
      ).toHaveAttribute("href", "https://example.com/yandex-artist");
    } finally {
      musicLinks.splice(0, musicLinks.length, ...original);
    }
  });
  it("displays platforms with missing URLs without creating empty links", async () => {
    const original = musicLinks.splice(
      0,
      musicLinks.length,
      { label: "Spotify", url: "" },
      { label: "Звук", url: "" },
    );
    try {
      render(<Terminal onListen={vi.fn()} />);
      submit("/music");
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(screen.getByRole("log")).toHaveTextContent("Spotify");
      expect(screen.getByRole("log")).toHaveTextContent("Звук");
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    } finally {
      musicLinks.splice(0, musicLinks.length, ...original);
    }
  });
  it("opens the player after the response and cancels queued work on clear", async () => {
    const onListen = vi.fn();
    render(<Terminal onListen={onListen} />);
    submit("/player");
    expect(onListen).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(onListen).toHaveBeenCalledTimes(1);
    submit("/player");
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
