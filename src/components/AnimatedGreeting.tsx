import { useEffect, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const presets = ["hello, world", "are you still here?"] as const;
const initialGreeting = presets[0];

export function AnimatedGreeting() {
  const [length, setLength] = useState(0);
  const [greeting, setGreeting] = useState<string>(initialGreeting);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    setLength(0);
    setGreeting(initialGreeting);
    let step: number | undefined;
    let remaining = 0;
    let currentGreeting: string = initialGreeting;
    function type() {
      remaining += 1;
      setLength(remaining);
      step = window.setTimeout(
        remaining < currentGreeting.length ? type : erase,
        remaining < currentGreeting.length ? 100 : 15_000,
      );
    }
    function erase() {
      remaining -= 1;
      setLength(remaining);
      if (remaining === 0) {
        currentGreeting = presets[Math.floor(Math.random() * presets.length)];
        setGreeting(currentGreeting);
      }
      step = window.setTimeout(
        remaining > 0 ? erase : type,
        remaining > 0 ? 65 : 280,
      );
    }
    step = window.setTimeout(type, 1_000);
    return () => {
      window.clearTimeout(step);
    };
  }, [reduced]);

  return (
    <h1
      className="greeting-title"
      aria-label={reduced ? initialGreeting : greeting}
    >
      {presets.map((preset) => (
        <span key={preset} className="greeting-measure" aria-hidden="true">
          {preset}
        </span>
      ))}
      <span className="greeting-text" aria-hidden="true">
        {reduced ? initialGreeting : greeting.slice(0, length)}
      </span>
    </h1>
  );
}
