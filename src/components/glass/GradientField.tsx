'use client';

import { memo } from 'react';

/**
 * The blurred colour field that sits *underneath* the frosted surface.
 *
 * Never a linear gradient — several soft radial lights bleeding into each other,
 * heavily blurred, then covered by a faint white sheen and grain. Used only on
 * key data and interaction surfaces; most of the UI stays white and quiet.
 */

type Blob = { c: string; x: number; y: number; r: number; o?: number };

export type Tone =
  | 'protein'
  | 'calories'
  | 'volume'
  | 'health'
  | 'time'
  | 'boost'
  | 'course'
  | 'neutral'
  | 'dusk'
  | 'engage'
  | 'plateWarm'
  | 'plateGreen'
  | 'plateCool'
  | 'plateRose'
  | 'plateDusk';

const TONES: Record<Tone, Blob[]> = {
  // warm light above, deep green below — the "score" card
  protein: [
    { c: '#ffd0aa', x: 22, y: -6, r: 88 },
    { c: '#f5b95f', x: 86, y: 2, r: 76 },
    { c: '#d9f265', x: 8, y: 46, r: 78, o: 0.9 },
    { c: '#4da566', x: 58, y: 74, r: 104 },
    { c: '#2b7a49', x: 20, y: 118, r: 96 },
  ],
  calories: [
    { c: '#ffe2c4', x: 8, y: 2, r: 82 },
    { c: '#f5a951', x: 74, y: 24, r: 92 },
    { c: '#ff8360', x: 96, y: 96, r: 88 },
    { c: '#ffd0aa', x: 26, y: 96, r: 74, o: 0.85 },
  ],
  volume: [
    { c: '#dfe8fa', x: 6, y: 0, r: 80 },
    { c: '#a5d8e6', x: 62, y: 18, r: 88 },
    { c: '#8ba4d8', x: 92, y: 88, r: 90 },
    { c: '#c9bcee', x: 16, y: 104, r: 84, o: 0.9 },
  ],
  health: [
    { c: '#eef8c9', x: 12, y: -4, r: 76 },
    { c: '#d9f265', x: 78, y: 12, r: 84 },
    { c: '#79c77e', x: 30, y: 78, r: 96 },
    { c: '#2b7a49', x: 96, y: 112, r: 86, o: 0.85 },
  ],
  time: [
    { c: '#e4dcfa', x: 4, y: 4, r: 82 },
    { c: '#c9bcee', x: 70, y: 6, r: 84 },
    { c: '#8ba4d8', x: 18, y: 92, r: 82, o: 0.8 },
    { c: '#ffa3c6', x: 98, y: 86, r: 84 },
  ],
  boost: [
    { c: '#ffd7e6', x: 10, y: 0, r: 78 },
    { c: '#ffa3c6', x: 68, y: 26, r: 88 },
    { c: '#f277a4', x: 92, y: 98, r: 84 },
    { c: '#ff8360', x: 22, y: 102, r: 70, o: 0.7 },
  ],
  course: [
    { c: '#ffe6d2', x: 10, y: 6, r: 76 },
    { c: '#c9bcee', x: 84, y: 14, r: 78 },
    { c: '#a5d8e6', x: 40, y: 100, r: 84, o: 0.85 },
  ],
  neutral: [
    { c: '#ffffff', x: 20, y: 0, r: 80 },
    { c: '#e6ecf4', x: 84, y: 30, r: 82 },
    { c: '#dde3ea', x: 30, y: 104, r: 84 },
  ],
  dusk: [
    { c: '#f4e7dd', x: 14, y: 2, r: 84 },
    { c: '#c9bcee', x: 88, y: 34, r: 80 },
    { c: '#8ba4d8', x: 34, y: 108, r: 90 },
  ],
  // Plate tones. Recipe images carry white type over their whole surface, so these
  // run deeper and more saturated than the card tones — a plate should read as an
  // image, not as fog.
  plateWarm: [
    { c: '#f8d29b', x: 12, y: -8, r: 82 },
    { c: '#e8823f', x: 74, y: 26, r: 92 },
    { c: '#c4472f', x: 24, y: 82, r: 88 },
    { c: '#6d2418', x: 92, y: 116, r: 84 },
  ],
  plateGreen: [
    { c: '#d8ef7e', x: 16, y: -6, r: 78 },
    { c: '#5aa85f', x: 78, y: 30, r: 92 },
    { c: '#2c7248', x: 26, y: 88, r: 90 },
    { c: '#14442f', x: 96, y: 118, r: 86 },
  ],
  plateCool: [
    { c: '#cfe4ef', x: 10, y: -8, r: 78 },
    { c: '#6fa8c4', x: 72, y: 28, r: 90 },
    { c: '#3f6f92', x: 22, y: 86, r: 90 },
    { c: '#23405e', x: 94, y: 118, r: 86 },
  ],
  plateRose: [
    { c: '#ffc3d7', x: 14, y: -8, r: 78 },
    { c: '#ec6f94', x: 76, y: 26, r: 90 },
    { c: '#b8385f', x: 24, y: 88, r: 88 },
    { c: '#6d1f3a', x: 94, y: 118, r: 84 },
  ],
  plateDusk: [
    { c: '#ecdccc', x: 12, y: -8, r: 80 },
    { c: '#b9a0c9', x: 74, y: 28, r: 88 },
    { c: '#6d6f9e', x: 24, y: 86, r: 90 },
    { c: '#33355c', x: 94, y: 118, r: 86 },
  ],
  // deep enough to carry white type — used for the primary action
  engage: [
    { c: '#3f8f5c', x: 6, y: -10, r: 86 },
    { c: '#1f6b52', x: 52, y: 40, r: 96 },
    { c: '#124a3c', x: 96, y: 104, r: 92 },
    { c: '#e8a54d', x: 18, y: 112, r: 62, o: 0.55 },
  ],
};

/**
 * Deep tones need a base colour: the blobs do not tile, and without a fill the gaps
 * between them expose the white surface underneath as blown-out holes.
 */
const BASE: Partial<Record<Tone, string>> = {
  plateWarm: '#8a3520',
  plateGreen: '#1f5c3c',
  plateCool: '#2e5473',
  plateRose: '#8c2a49',
  plateDusk: '#474a72',
  engage: '#1a5a45',
};

type Props = {
  tone: Tone;
  /** 0..1 — how present the colour is */
  intensity?: number;
  blur?: number;
  /** rotate the whole field, useful to de-duplicate repeated tones */
  rotate?: number;
  className?: string;
};

function GradientFieldImpl({ tone, intensity = 1, blur = 26, rotate = 0, className }: Props) {
  const blobs = TONES[tone] ?? TONES.neutral;
  const dark = tone === 'engage' || tone.startsWith('plate');
  return (
    <div
      className={className}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        overflow: 'hidden',
        zIndex: 0,
        opacity: intensity,
        background: BASE[tone],
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-30%',
          filter: `blur(${blur}px)`,
          transform: `rotate(${rotate}deg)`,
        }}
      >
        {blobs.map((b, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.r}%`,
              height: `${b.r}%`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle at 50% 50%, ${b.c} 0%, ${b.c} 34%, transparent 72%)`,
              opacity: b.o ?? 1,
            }}
          />
        ))}
      </div>
      {/* frosted sheen — the light sitting on the glass, not in it */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dark
            ? 'radial-gradient(120% 80% at 24% -10%, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%)'
            : 'radial-gradient(120% 80% at 24% -10%, rgba(255,255,255,0.42), rgba(255,255,255,0) 58%), linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 34%)',
        }}
      />
    </div>
  );
}

export const GradientField = memo(GradientFieldImpl);
