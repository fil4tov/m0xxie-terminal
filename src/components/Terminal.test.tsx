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
  it("toggles all commands without changing input text or selection", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    const slash = screen.getByRole("button", { name: "Меню команд" });
    fireEvent.click(slash);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(slash).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("log")).toBeEmptyDOMElement();
    fireEvent.click(slash);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(slash).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(input, { target: { value: "abXYcd" } });
    act(() => input.setSelectionRange(2, 4));
    fireEvent.pointerDown(slash);
    fireEvent.click(slash);
    expect(input).toHaveValue("abXYcd");
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(4);
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(input).toHaveFocus();
    expect(screen.getByRole("log")).toBeEmptyDOMElement();
    fireEvent.click(slash);
    expect(input).toHaveValue("abXYcd");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("closes the command menu with Escape or outside clicks and filters when typing resumes", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    const slash = screen.getByRole("button", { name: "Меню команд" });
    fireEvent.click(slash);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(slash).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(slash);
    fireEvent.pointerDown(document.body);
    expect(slash).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(slash);
    fireEvent.change(input, { target: { value: "/gi" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(slash);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(slash);
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(input).toHaveValue("/gi");
  });
  it("supports keyboard completion from the button-opened menu", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.click(screen.getByRole("button", { name: "Меню команд" }));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("/telegram");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("keeps background clicks unfocused and resumes the command with the first typed character", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "pi" } });
    act(() => input.blur());
    fireEvent.click(document.body);
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: "n" });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("pin");
  });
  it("preserves slider focus and keyboard controls until the user types text", () => {
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
    expect(slider).toHaveFocus();
    expect(fireEvent.keyDown(slider, { key: "ArrowRight" })).toBe(true);
    expect(fireEvent.keyDown(slider, { key: "Tab" })).toBe(true);
    expect(slider).toHaveFocus();
    fireEvent.keyDown(slider, { key: "p" });
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("combobox")).toHaveValue("p");
  });
  it("preserves selected page text and copying after mouse release", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    act(() => input.blur());
    const text = screen.getByText("CONNECTION ESTABLISHED");
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(text);
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      fireEvent.pointerUp(text);
      fireEvent.click(text);
      expect(input).not.toHaveFocus();
      expect(selection.toString()).toBe("CONNECTION ESTABLISHED");
      expect(
        fireEvent.keyDown(document.body, { key: "c", ctrlKey: true }),
      ).toBe(true);
      expect(
        fireEvent.keyDown(document.body, { key: "c", metaKey: true }),
      ).toBe(true);
      expect(selection.toString()).toBe("CONNECTION ESTABLISHED");
      expect(input).toHaveValue("");
    } finally {
      selection.removeAllRanges();
    }
  });
  it("inserts the first character at the saved caret and opens slash suggestions", () => {
    const { container } = render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    act(() => input.blur());
    fireEvent.keyDown(document.body, { key: "/" });
    expect(input).toHaveValue("/");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "pXng" } });
    act(() => {
      input.setSelectionRange(1, 2);
      input.blur();
    });
    fireEvent.keyDown(document.body, { key: "i" });
    expect(input).toHaveValue("ping");
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
    expect(container.querySelector(".terminal-input-prefix")).toHaveTextContent(
      "pi",
    );
  });
  it("respects the command length limit and leaves normal input typing to the browser", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x".repeat(120) } });
    act(() => input.blur());
    fireEvent.keyDown(document.body, { key: "p" });
    expect(input).toHaveFocus();
    expect(input.value).toHaveLength(120);
    expect(fireEvent.keyDown(input, { key: "p" })).toBe(true);
  });
  it("leaves shortcuts, composition, and keyboard activation of controls alone", () => {
    render(<Terminal onListen={vi.fn()} />);
    const input = screen.getByRole("combobox");
    const button = screen.getByRole("button", { name: "Очистить терминал" });
    act(() => button.focus());
    for (const key of [" ", "Enter", "Tab", "ArrowLeft"])
      expect(fireEvent.keyDown(button, { key })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "a", altKey: true })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "x", isComposing: true })).toBe(
      true,
    );
    expect(button).toHaveFocus();
    expect(input).toHaveValue("");
    fireEvent.keyDown(button, { key: "П", shiftKey: true });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("П");
  });
  it("does not redirect typing from other editable fields", () => {
    render(
      <>
        <Terminal onListen={vi.fn()} />
        <input aria-label="Другое поле" />
        <div contentEditable suppressContentEditableWarning>
          <span>Редактор</span>
        </div>
      </>,
    );
    const other = screen.getByRole("textbox", { name: "Другое поле" });
    act(() => other.focus());
    expect(fireEvent.keyDown(other, { key: "p" })).toBe(true);
    expect(other).toHaveFocus();
    const editor = screen.getByText("Редактор");
    act(() => editor.parentElement!.focus());
    expect(fireEvent.keyDown(editor, { key: "/" })).toBe(true);
    expect(screen.getByRole("combobox")).toHaveValue("");
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
