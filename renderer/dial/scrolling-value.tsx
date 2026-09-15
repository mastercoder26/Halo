import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface ScrollingValueProps {
  value: string | number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Odometer-style readout: the outgoing value slides away and the next value
 * rolls in. Direction follows whether the numeric value rose or fell.
 */
export function ScrollingValue({ value, className, style }: ScrollingValueProps) {
  const display = String(value);
  const previous = useRef(display);
  const [outgoing, setOutgoing] = useState(display);
  const [incoming, setIncoming] = useState(display);
  const [phase, setPhase] = useState<"idle" | "up" | "down">("idle");
  const clearTimer = useRef<number | null>(null);

  useEffect(() => {
    if (display === previous.current) return;

    const prevNum = Number(previous.current);
    const nextNum = Number(display);
    const bothNumeric = Number.isFinite(prevNum) && Number.isFinite(nextNum);
    const direction = bothNumeric && nextNum < prevNum ? "down" : "up";

    setOutgoing(previous.current);
    setIncoming(display);
    setPhase(direction);
    previous.current = display;

    if (clearTimer.current != null) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      setPhase("idle");
      setOutgoing(display);
      clearTimer.current = null;
    }, 180);

    return () => {
      if (clearTimer.current != null) {
        window.clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    };
  }, [display]);

  if (phase === "idle") {
    return (
      <span className={`halo-scroll-value ${className ?? ""}`} style={style}>
        <span className="halo-scroll-value-item">{display}</span>
      </span>
    );
  }

  return (
    <span className={`halo-scroll-value ${className ?? ""}`} style={style} aria-label={display}>
      <span className={`halo-scroll-value-track halo-scroll-value-track-${phase}`}>
        {phase === "up" ? (
          <>
            <span className="halo-scroll-value-item">{outgoing}</span>
            <span className="halo-scroll-value-item">{incoming}</span>
          </>
        ) : (
          <>
            <span className="halo-scroll-value-item">{incoming}</span>
            <span className="halo-scroll-value-item">{outgoing}</span>
          </>
        )}
      </span>
    </span>
  );
}
