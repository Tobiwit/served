'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Tap to act, hold to undo.
 *
 * The whole app rules things out with a tap and puts them back with a press — the
 * Explore pills, the shopping list — and a gesture that means two different things
 * on two screens is worse than no gesture at all. This is the one implementation.
 *
 * Three details are load-bearing:
 *
 *   - the state at press time is captured and handed to `onHold`, so a hold that
 *     restores something cannot also act on it the instant it comes back;
 *   - moving more than a few pixels cancels, because the field scrolls and a drag
 *     that begins on an item is a scroll, not a press;
 *   - the tap only fires if the timer was still running, so a hold never lands as
 *     both a hold and a tap on release.
 */

const LONG_PRESS_MS = 420;
const SLOP = 10;

export function useTapHold<T>(
  value: T,
  { onTap, onHold }: { onTap?: (v: T) => void; onHold?: (v: T) => void },
) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const [held, setHeld] = useState(false);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHeld(false);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    setHeld(true);
    const pressed = value;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      setHeld(false);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
      onHold?.(pressed);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!timer.current) return;
    if (Math.abs(e.clientX - start.current.x) > SLOP || Math.abs(e.clientY - start.current.y) > SLOP) clear();
  };

  const onPointerUp = () => {
    const pending = timer.current !== null;
    const alreadyFired = fired.current;
    clear();
    if (pending && !alreadyFired) onTap?.(value);
  };

  return {
    held,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
