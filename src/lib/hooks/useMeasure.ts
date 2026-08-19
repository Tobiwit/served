'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Element width in px. Returns 0 until measured. */
export function useMeasureWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  const set = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => ro.disconnect();
  });

  return { ref: set, width, node: ref };
}
