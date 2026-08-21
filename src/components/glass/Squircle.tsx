'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Squircle surface.
 *
 * A plain `border-radius` corner is a quarter circle: it meets the straight edge
 * abruptly and the sides read as dead flat. A superellipse corner carries the
 * curvature further along each edge, so the straight runs pick up a faint convex
 * swell — the same shape iOS uses for app icons. The radius is unchanged; only the
 * corner *curve* differs.
 *
 * The path is generated in real pixels from the measured box, so it stays correct
 * at any size. `n` is the superellipse exponent: 2 is a circle, ~4 is the squircle.
 */

export function squirclePath(w: number, h: number, radius: number, n = 4, steps = 14): string {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  if (r <= 0) return `M0 0 H${w} V${h} H0 Z`;

  const k = 2 / n;

  /**
   * One corner quadrant, measured as an inset from the *box corner* (bx, by) with
   * (sx, sy) pointing inwards. Sampling t from 0 to 90° walks from the point r along
   * one edge to the point r along the other.
   *
   * At 45° a circle (n=2) sits 0.29r in from the box corner; the squircle (n=4) sits
   * 0.16r in, so it hugs the corner and carries its curvature further along each
   * edge. That extra fullness is the whole effect.
   */
  const corner = (bx: number, by: number, sx: number, sy: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2);
      const dx = r - r * Math.pow(Math.cos(t), k);
      const dy = r - r * Math.pow(Math.sin(t), k);
      pts.push(`${round(bx + sx * dx)} ${round(by + sy * dy)}`);
    }
    return pts;
  };

  const tl = corner(0, 0, 1, 1); //            (0, r)   -> (r, 0)
  const tr = corner(w, 0, -1, 1).reverse(); // (w-r, 0) -> (w, r)
  const br = corner(w, h, -1, -1); //          (w, h-r) -> (w-r, h)
  const bl = corner(0, h, 1, -1).reverse(); // (r, h)   -> (0, h-r)

  return [
    `M ${round(r)} 0`,
    `L ${round(w - r)} 0`,
    ...tr.map((p) => `L ${p}`),
    `L ${round(w)} ${round(h - r)}`,
    ...br.map((p) => `L ${p}`),
    `L ${round(r)} ${round(h)}`,
    ...bl.map((p) => `L ${p}`),
    `L 0 ${round(r)}`,
    ...tl.map((p) => `L ${p}`),
    'Z',
  ].join(' ');
}

const round = (v: number) => Math.round(v * 100) / 100;

type Props = {
  radius?: number;
  /** hairline drawn along the squircle edge rather than a CSS border */
  stroke?: 'ink' | 'lume' | 'none';
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  as?: 'div' | 'section' | 'li';
};

export function Squircle({ radius = 30, stroke = 'ink', className, style, children, as = 'div' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // border-box, not contentRect: the path is drawn in the element's own
    // coordinates, and contentRect would silently subtract any padding
    const ro = new ResizeObserver(() => {
      const { width, height } = node.getBoundingClientRect();
      setBox((prev) =>
        Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5 ? prev : { w: width, h: height },
      );
    });
    ro.observe(node);
    const rect = node.getBoundingClientRect();
    setBox({ w: rect.width, h: rect.height });
    return () => ro.disconnect();
  }, []);

  const ready = box.w > 0 && box.h > 0;
  const d = ready ? squirclePath(box.w, box.h, radius) : '';
  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{
        position: 'relative',
        // a matching border-radius keeps the shape sane for the first paint and
        // for anything that ignores clip-path
        borderRadius: radius,
        clipPath: ready ? `path("${d}")` : undefined,
        ...style,
      }}
    >
      {children}
      {ready && stroke !== 'none' && (
        <svg
          aria-hidden
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9 }}
        >
          <path
            d={d}
            fill="none"
            stroke={stroke === 'lume' ? 'rgba(255,255,255,0.34)' : 'rgba(14,15,17,0.09)'}
            strokeWidth={1.4}
          />
        </svg>
      )}
    </Tag>
  );
}
