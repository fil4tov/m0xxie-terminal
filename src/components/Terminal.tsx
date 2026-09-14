import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { commands, resolveCommand, type CommandResult } from "../lib/commands";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { TerminalInput } from "./TerminalInput";
import { CommandSuggestions } from "./CommandSuggestions";
import { AnimatedGreeting } from "./AnimatedGreeting";
import {
  FiChevronRight,
  FiCornerDownLeft,
  FiExternalLink,
  FiRotateCcw,
  FiSquare,
} from "react-icons/fi";

interface Entry extends CommandResult {
  id: number;
  command: string;
  visible: number;
  done: boolean;
}
export interface TerminalHandle {
  execute: (command: string) => void;
  reset: () => void;
  focus: () => void;
}
export const Terminal = forwardRef<TerminalHandle, { onListen: () => void }>(
  function Terminal({ onListen }, ref) {
    const [value, setValue] = useState(""),
      [menu, setMenu] = useState(false),
      [selected, setSelected] = useState(0),
      [entries, setEntries] = useState<Entry[]>([]);
    const input = useRef<HTMLInputElement>(null),
      chat = useRef<HTMLDivElement>(null),
      prompt = useRef<HTMLDivElement>(null);
    const counter = useRef(0),
      history = useRef<string[]>([]),
      historyIndex = useRef(0),
      listenRef = useRef(onListen);
    const reduced = useReducedMotion();
    useEffect(() => {
      listenRef.current = onListen;
    }, [onListen]);
    const filtered = commands.filter((c) =>
      c.name.startsWith(value.trim().toLowerCase().slice(1)),
    );
    const showMenu = menu && value.trim().startsWith("/");
    const active = entries.find((entry) => !entry.done);
    const focus = () => input.current?.focus({ preventScroll: true });
    function reset() {
      setEntries([]);
      setValue("");
      setMenu(false);
      focus();
    }
    function execute(raw: string) {
      raw = raw.trim();
      if (!raw) return;
      history.current.push(raw);
      historyIndex.current = history.current.length;
      setValue("");
      setMenu(false);
      focus();
      const result = resolveCommand(raw);
      if (result.action === "clear") {
        reset();
        return;
      }
      setEntries((previous) => [
        ...previous,
        {
          ...result,
          id: ++counter.current,
          command: raw,
          visible: 0,
          done: false,
        },
      ]);
    }
    useImperativeHandle(ref, () => ({ execute, reset, focus }));
    useEffect(() => {
      if (!active) return;
      const entry = active;
      const length =
        entry.text.length +
        (entry.links ?? []).reduce(
          (length, link) => length + 1 + link.label.length,
          0,
        );
      let visible = entry.visible;
      const timer = window.setInterval(
        () => {
          visible = reduced ? length : Math.min(length, visible + 1);
          const done = visible >= length;
          setEntries((previous) =>
            previous.map((row) =>
              row.id === entry.id ? { ...row, visible, done } : row,
            ),
          );
          if (done) {
            window.clearInterval(timer);
            if (entry.action === "player") listenRef.current();
          }
        },
        reduced ? 0 : 14,
      );
      return () => window.clearInterval(timer);
      // The active entry owns one timer; character updates must not restart it.
    }, [active?.id, reduced]);
    useLayoutEffect(() => {
      if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
    }, [entries, showMenu, filtered.length]);
    useEffect(() => {
      function slash(event: globalThis.KeyboardEvent) {
        const target = event.target;
        if (
          event.key !== "/" ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          (target instanceof HTMLElement &&
            (target.matches("input, textarea, select") ||
              target.isContentEditable))
        )
          return;
        event.preventDefault();
        setValue("/");
        setSelected(0);
        setMenu(true);
        input.current?.focus({ preventScroll: true });
      }
      function outside(event: PointerEvent) {
        const target = event.target as Node;
        if (
          !prompt.current?.contains(target) &&
          !input.current?.form?.contains(target)
        )
          setMenu(false);
      }
      document.addEventListener("keydown", slash);
      document.addEventListener("pointerdown", outside);
      return () => {
        document.removeEventListener("keydown", slash);
        document.removeEventListener("pointerdown", outside);
      };
    }, []);
    function onKey(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Escape") {
        setMenu(false);
        return;
      }
      if (
        showMenu &&
        filtered.length &&
        ["ArrowDown", "ArrowUp", "Tab"].includes(event.key)
      ) {
        event.preventDefault();
        if (event.key === "Tab") {
          setValue("/" + filtered[selected].name);
          setMenu(false);
        } else
          setSelected(
            (selected +
              (event.key === "ArrowDown" ? 1 : -1) +
              filtered.length) %
              filtered.length,
          );
      } else if (!showMenu && ["ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        historyIndex.current = Math.max(
          0,
          Math.min(
            history.current.length,
            historyIndex.current + (event.key === "ArrowUp" ? -1 : 1),
          ),
        );
        setValue(history.current[historyIndex.current] ?? "");
      }
    }
    return (
      <section className="terminal-shell" aria-label="Терминал M0XXIE">
        <div className="terminal-bezel">
          <div className="terminal-top">
            <span>
              <i className="status-light" /> M0XXIE
            </span>
            <span>v.1.0 / LOCAL SESSION</span>
            <button aria-label="Очистить терминал" onClick={reset}>
              <FiRotateCcw aria-hidden="true" />
            </button>
          </div>
          <div className="terminal-screen">
            <div className="boot">
              <span>CONNECTION ESTABLISHED</span>
            </div>
            <div
              className="terminal-chat"
              ref={chat}
              role="region"
              aria-label="Чат терминала"
            >
              <div className="intro">
                <p className="eyebrow">
                  YOU FOUND MY LITTLE CORNER OF THE INTERNET.
                </p>
                <AnimatedGreeting />
                <p className="intro-copy">
                  Я m0xxie. Делаю музыку, пишу код.
                  <br />
                  Всё остальное — между строк.
                </p>
              </div>
              <div className="terminal-divider" />
              <div
                id="history"
                role="log"
                aria-label="Ответы терминала"
                aria-live="polite"
                aria-relevant="additions text"
                aria-busy={!!active}
              >
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`history-entry ${entry.id === active?.id ? "typing" : ""}`}
                  >
                    <div className="history-command">
                      <FiChevronRight aria-hidden="true" /> {entry.command}
                    </div>
                    <div className="history-response">
                      {entry.text.slice(0, entry.visible)}
                      <ResponseLinks
                        links={entry.links}
                        visible={entry.visible - entry.text.length}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="prompt-area" ref={prompt}>
                <p className="input-hint" hidden={entries.length > 0}>
                  Введи{" "}
                  <button
                    aria-label="Показать команды"
                    onClick={() => {
                      setValue("/");
                      setSelected(0);
                      setMenu(true);
                      focus();
                    }}
                  >
                    /
                  </button>
                  , чтобы начать.
                </p>
                <CommandSuggestions
                  open={showMenu}
                  scrollContainer={chat}
                  selected={selected}
                >
                  <div
                    id="suggestions"
                    role="listbox"
                    aria-label="Доступные команды"
                  >
                    {filtered.length ? (
                      filtered.map((command, i) => (
                        <button
                          key={command.name}
                          id={`option-${command.name}`}
                          type="button"
                          role="option"
                          aria-selected={i === selected}
                          tabIndex={-1}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => execute("/" + command.name)}
                        >
                          <command.Icon aria-hidden="true" /> /{command.name}
                          <span>{command.description}</span>
                        </button>
                      ))
                    ) : (
                      <div className="no-results">
                        Команда не найдена. Введи /help.
                      </div>
                    )}
                  </div>
                </CommandSuggestions>
              </div>
            </div>
            <div className="terminal-input-dock">
              <form
                id="command-form"
                autoComplete="off"
                onSubmit={(event) => {
                  event.preventDefault();
                  execute(
                    showMenu && filtered.length
                      ? "/" + filtered[selected].name
                      : value,
                  );
                }}
              >
                <label htmlFor="command-input" className="prompt-label">
                  <span>guest</span>
                  <span className="prompt-path">@m0xxie</span>
                  <b> ~ </b>
                  <strong>
                    <FiChevronRight aria-hidden="true" />
                  </strong>
                </label>
                <TerminalInput
                  ref={input}
                  id="command-input"
                  role="combobox"
                  aria-label="Команда терминала"
                  aria-autocomplete="list"
                  aria-controls="suggestions"
                  aria-expanded={showMenu}
                  aria-activedescendant={
                    showMenu && filtered[selected]
                      ? `option-${filtered[selected].name}`
                      : undefined
                  }
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setSelected(0);
                    setMenu(true);
                  }}
                  onKeyDown={onKey}
                  spellCheck={false}
                  autoCapitalize="off"
                  maxLength={120}
                />
                <button
                  type="submit"
                  className="enter-button"
                  aria-label="Выполнить команду"
                >
                  <FiCornerDownLeft aria-hidden="true" />
                </button>
              </form>
            </div>
            <div className="terminal-bottom">
              <span>
                <FiSquare className="tiny-square" aria-hidden="true" /> READY
                WHEN YOU ARE
              </span>
              <span>
                UTF-8 <span className="bottom-separator">/</span> STEREO
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  },
);

function ResponseLinks({
  links = [],
  visible,
}: {
  links?: CommandResult["links"];
  visible: number;
}) {
  let offset = 0;
  return links.map((link) => {
    offset += 1;
    const count = Math.max(0, Math.min(link.label.length, visible - offset));
    offset += link.label.length;
    if (!count) return null;
    return (
      <span key={link.url ?? link.label}>
        {"\n"}
        {link.url ? (
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label.slice(0, count)}
            {count === link.label.length && (
              <FiExternalLink
                className="external-link-icon"
                aria-hidden="true"
              />
            )}
          </a>
        ) : (
          <span
            className="pending-music-link"
            title="Ссылка на профиль пока не добавлена"
          >
            {link.label.slice(0, count)}
          </span>
        )}
      </span>
    );
  });
}
