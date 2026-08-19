'use client';

import { memo } from 'react';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import type { Recipe } from '@/lib/db/types';

/**
 * The editorial image plate.
 *
 * Real photography when a recipe has one. Until then, a composed colour field
 * keyed to the cuisine with a fine dotted aperture — deliberately art-directed so
 * an un-photographed recipe still looks like part of the set rather than a hole
 * in the layout. Use "Copy image prompt" on the detail screen to shoot one.
 */

const CUISINE_TONE: Record<string, Tone> = {
  Italian: 'plateWarm',
  Mediterranean: 'plateGreen',
  Japanese: 'plateCool',
  Korean: 'plateRose',
  Mexican: 'plateWarm',
  Indian: 'plateWarm',
  German: 'plateDusk',
  Other: 'plateDusk',
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const RecipeImage = memo(function RecipeImage({
  recipe,
  radius = 'var(--r-xl)',
  showAperture = true,
}: {
  recipe: Recipe;
  radius?: string;
  showAperture?: boolean;
}) {
  if (recipe.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={recipe.image_url}
        alt={recipe.title}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius }}
      />
    );
  }

  const h = hash(recipe.id || recipe.title);
  const tone = CUISINE_TONE[recipe.cuisine ?? 'Other'] ?? 'dusk';
  const rotate = (h % 8) * 45;

  return (
    <div className="grain" style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden' }}>
      <GradientField tone={tone} blur={38} rotate={rotate} />
      {showAperture && <Aperture seed={h} />}
    </div>
  );
});

/** Concentric dotted rings, off-centre, like a lens stopped down. */
function Aperture({ seed }: { seed: number }) {
  const cx = 46 + (seed % 12);
  const cy = 44 + ((seed >> 3) % 14);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, opacity: 0.5 }}
      aria-hidden
    >
      {[13, 20, 27.5].map((r, i) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={0.35}
          strokeDasharray={i === 1 ? '0.5 2.6' : '0.4 3.4'}
        />
      ))}
      <circle cx={cx} cy={cy} r={3.2} fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}
