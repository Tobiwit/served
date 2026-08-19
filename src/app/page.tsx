'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { COURSE_TYPES, CUISINES, type CourseType } from '@/lib/db/types';
import { QUANT_ORDER, QUANT_SPECS } from '@/lib/explore/filters';
import { passesFilters } from '@/lib/explore/candidates';
import { MatchHero } from '@/components/setup/MatchHero';
import { QuantModule } from '@/components/setup/QuantModule';
import { ChipRow } from '@/components/setup/ChipRow';
import { LaunchBar } from '@/components/setup/LaunchBar';
import { ease } from '@/lib/motion';

const COURSE_LABEL: Record<CourseType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  dessert: 'Dessert',
};

export default function SetupPage() {
  const router = useRouter();
  const { recipes, analysisFor, ready } = useData();
  const { session, setFilters, start, resetKeepFilters } = useExplore();
  const f = session.filters;

  const litMap = useMemo(
    () => recipes.map((r) => passesFilters(r, analysisFor(r), f)),
    [recipes, analysisFor, f],
  );
  const matching = litMap.filter(Boolean).length;

  const beginRun = () => {
    // pressing Explore locks the filters in for this run and clears anything seen
    resetKeepFilters();
    start();
    router.push('/explore');
  };

  return (
    <main
      className="screen"
      style={{
        paddingTop: 'calc(var(--safe-t) + 26px)',
        // the sticky launch bar sits above the tab bar, so the last row of chips
        // needs room to scroll clear of both
        paddingBottom: 'calc(var(--tabbar-h) + var(--safe-b) + 132px)',
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ease.arrive }}
        style={{ marginBottom: 22 }}
      >
        <h1 className="t-display" style={{ margin: 0 }}>
          What are we eating?
        </h1>
        <p className="t-micro t-dim" style={{ margin: '8px 0 0' }}>
          {ready ? `${recipes.length} recipes available` : 'Reading the shelf…'}
        </p>
      </motion.header>

      <MatchHero matching={matching} total={recipes.length} litMap={litMap} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 10,
          alignItems: 'start',
        }}
      >
        {QUANT_ORDER.map((key) => (
          <QuantModule
            key={key}
            spec={QUANT_SPECS[key]}
            state={f[key]}
            onToggle={() => setFilters((prev) => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }))}
            onValue={(value) => setFilters((prev) => ({ ...prev, [key]: { ...prev[key], value } }))}
          />
        ))}
      </div>

      <ChipRow
        title="Cuisine"
        options={CUISINES}
        selected={f.cuisines}
        onToggle={(c) =>
          setFilters((prev) => ({
            ...prev,
            cuisines: prev.cuisines.includes(c) ? prev.cuisines.filter((x) => x !== c) : [...prev.cuisines, c],
          }))
        }
      />

      <ChipRow
        title="Course"
        options={COURSE_TYPES}
        selected={f.courses}
        labelFor={(c) => COURSE_LABEL[c]}
        onToggle={(c) =>
          setFilters((prev) => ({
            ...prev,
            courses: prev.courses.includes(c) ? prev.courses.filter((x) => x !== c) : [...prev.courses, c],
          }))
        }
      />

      <LaunchBar count={matching} onStart={beginRun} />
    </main>
  );
}
