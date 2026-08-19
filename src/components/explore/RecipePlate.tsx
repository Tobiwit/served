'use client';

import { motion } from 'motion/react';
import type { Recipe } from '@/lib/db/types';
import type { RecipeAnalysis } from '@/lib/scoring';
import { RecipeImage } from './RecipeImage';
import { ArcGauge } from '@/components/instrument/ArcGauge';
import { formatKcal, formatMacro } from '@/lib/nutrition/calc';
import { ease, spring } from '@/lib/motion';

/**
 * The upper plate: one large editorial image with the least information that can
 * still support a decision. Two small arc readings sit bottom-right; everything
 * else waits for the detail screen.
 */

export function RecipePlate({
  recipe,
  analysis,
  direction,
  onOpen,
}: {
  recipe: Recipe;
  analysis: RecipeAnalysis;
  direction: 1 | -1;
  onOpen: () => void;
}) {
  const n = analysis.nutrition.perServing;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{
        opacity: 0,
        scale: 0.94,
        y: direction > 0 ? 34 : -34,
        rotateX: direction > 0 ? -7 : 7,
        filter: 'blur(9px)',
      }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
      exit={{
        opacity: 0,
        scale: 0.9,
        y: direction > 0 ? -26 : 26,
        rotateX: direction > 0 ? 6 : -6,
        filter: 'blur(7px)',
        z: -140,
      }}
      transition={{ ...spring.carriage, filter: { duration: 0.4 } }}
      className="surface hairline-lume"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'var(--r-xl)',
        overflow: 'hidden',
        textAlign: 'left',
        transformStyle: 'preserve-3d',
        boxShadow: 'var(--lift-3)',
      }}
      aria-label={`Open ${recipe.title}`}
    >
      <RecipeImage recipe={recipe} />

      {/* legibility gradient — only where type sits */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          background:
            'linear-gradient(180deg, rgba(14,15,17,0.26) 0%, rgba(14,15,17,0) 30%, rgba(14,15,17,0.24) 62%, rgba(14,15,17,0.66) 100%)',
        }}
      />

      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, zIndex: 5 }}>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.44, ease: ease.arrive }}
          className="t-title"
          style={{ margin: 0, color: '#fff', maxWidth: '86%', textShadow: '0 1px 20px rgba(14,15,17,0.28)' }}
        >
          {recipe.title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.44, ease: ease.arrive }}
          className="t-micro"
          style={{ margin: '7px 0 0', color: 'rgba(255,255,255,0.82)' }}
        >
          {formatKcal(n.kcal)} kcal · {formatMacro(n.protein)} protein
          {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ''}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.22, ...spring.settle }}
        style={{ position: 'absolute', right: 16, top: 16, zIndex: 5, display: 'flex', gap: 8 }}
      >
        <MiniGauge label="H" value={analysis.health.score} />
        <MiniGauge label="V" value={analysis.volume.score} />
      </motion.div>
    </motion.button>
  );
}

function MiniGauge({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        position: 'relative',
        width: 46,
        height: 46,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 46,
        background: 'rgba(14,15,17,0.3)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.24)',
      }}
    >
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <ArcGauge value={value} size={40} ink="lume" count={20} />
      </span>
      <span
        style={{
          position: 'relative',
          fontSize: 12.5,
          fontWeight: 300,
          color: '#fff',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
        <span style={{ fontSize: 8, opacity: 0.7, marginLeft: 1 }}>{label}</span>
      </span>
    </span>
  );
}
