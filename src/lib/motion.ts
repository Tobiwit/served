/**
 * Motion vocabulary.
 *
 * One device, changing state. Springs carry weight; nothing bounces past ~2%.
 * Interaction budget is 300-650ms — anything longer reads as a cutscene.
 */
import type { Transition } from 'motion/react';

export const spring = {
  /** panels, cards, layout shifts */
  panel: { type: 'spring', stiffness: 300, damping: 34, mass: 0.9 } satisfies Transition,
  /** small controls, indicators sliding along a scale */
  dial: { type: 'spring', stiffness: 520, damping: 38, mass: 0.6 } satisfies Transition,
  /** heavy mechanical movement — the recipe carriage */
  carriage: { type: 'spring', stiffness: 190, damping: 30, mass: 1.15 } satisfies Transition,
  /** capsules settling into place */
  settle: { type: 'spring', stiffness: 420, damping: 30, mass: 0.7 } satisfies Transition,
} as const;

export const ease = {
  /** authoritative in-out, for masked reveals */
  glass: [0.32, 0.72, 0, 1] as [number, number, number, number],
  /** decelerating, for things arriving */
  arrive: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** accelerating, for things leaving */
  depart: [0.7, 0, 0.84, 0] as [number, number, number, number],
};

export const dur = {
  micro: 0.16,
  fast: 0.3,
  base: 0.44,
  slow: 0.62,
};

/** Stagger for ingredient capsules arranging themselves after the recipe settles. */
export function settleDelay(index: number, base = 0.16, step = 0.028) {
  return base + index * step;
}
