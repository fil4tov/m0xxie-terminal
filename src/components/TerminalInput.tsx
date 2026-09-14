import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";

type TerminalInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value"
> & {
  value: string;
};

export const TerminalInput = forwardRef<HTMLInputElement, TerminalInputProps>(
  function TerminalInput({ value, ...props }, ref) {
    const input = useRef<HTMLInputElement>(null);
    const [selection, setSelection] = useState({
      position: value.length,
      scrollLeft: 0,
      selected: false,
    });
    const [composing, setComposing] = useState(false);

    useImperativeHandle(ref, () => input.current!);

    function syncCaret() {
      const element = input.current;
      if (!element) return;
      setSelection({
        position: element.selectionStart ?? element.value.length,
        scrollLeft: element.scrollLeft,
        selected: element.selectionStart !== element.selectionEnd,
      });
    }

    // Covers programmatic changes too: completion, history, clear and submit.
    useLayoutEffect(syncCaret, [value]);

    return (
      <div className="terminal-input">
        <input
          {...props}
          ref={input}
          value={value}
          onChange={(event) => {
            props.onChange?.(event);
            syncCaret();
          }}
          onSelect={(event) => {
            syncCaret();
            props.onSelect?.(event);
          }}
          onScroll={(event) => {
            syncCaret();
            props.onScroll?.(event);
          }}
          onKeyUp={(event) => {
            syncCaret();
            props.onKeyUp?.(event);
          }}
          onPointerUp={(event) => {
            syncCaret();
            props.onPointerUp?.(event);
          }}
          onFocus={(event) => {
            syncCaret();
            props.onFocus?.(event);
          }}
          onCompositionStart={(event) => {
            setComposing(true);
            props.onCompositionStart?.(event);
          }}
          onCompositionEnd={(event) => {
            setComposing(false);
            syncCaret();
            props.onCompositionEnd?.(event);
          }}
        />
        <div className="terminal-input-overlay" aria-hidden="true">
          <div
            className="terminal-input-track"
            style={{ transform: `translateX(${-selection.scrollLeft}px)` }}
          >
            <span className="terminal-input-prefix">
              {value.slice(0, selection.position)}
            </span>
            <span
              className="terminal-input-caret"
              hidden={selection.selected || composing}
            >
              _
            </span>
          </div>
        </div>
      </div>
    );
  },
);
