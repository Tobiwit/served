'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { QUANT_SPECS, type QuantKey } from '@/lib/explore/filters';
import { fitFor } from '@/lib/explore/fit';
import { isEmptyPlan, runState } from '@/lib/explore/liveRecipe';
import { MatchHero } from '@/components/setup/MatchHero';
import { FilterPanel } from '@/components/setup/FilterPanel';
import { CuisinePanel } from '@/components/setup/CuisinePanel';
import { LaunchBar } from '@/components/setup/LaunchBar';
import { DottedScale } from '@/components/instrument/DottedScale';
import { VerticalDottedScale } from '@/components/instrument/VerticalDottedScale';
import { GlassDial } from '@/components/instrument/GlassDial';
import { ArcSpanSlider } from '@/components/instrument/ArcSpanSlider';
import { SineSlider } from '@/components/instrument/SineSlider';
import { StartGate } from '@/components/start/StartGate';
import { ease, spring } from '@/lib/motion';

/**
 * The instrument face.
 *
 * A fixed composition sized to the viewport rather than a scrolling grid: every
 * filter is present at full size from the first frame, and engaging one changes
 * its colour and wakes its scale without moving anything else.
 *
 *   ┌──────────────── matching now ────────────────┐
 *   ├──────── protein ────────┬────────────────────┤
 *   ├──────── calories ───────┤       time         │
 *   ├────── cuisine ──────────┬────── volume ──────┤
 *   │                         ├────── health ──────┤
 *   └──────────── explore recipes ─────────────────┘
 */

export default function SetupPage() {
  const router = useRouter();
  const { recipes, ingredientIndex } = useData();
  const { session, setFilters, start, resetKeepFilters } = useExplore();
  const f = session.filters;

  /**
   * The launch screen shows once per app session — a cold open or a PWA relaunch,
   * not every time you navigate back here from Explore. Read before paint so the
   * dashboard never flashes behind it.
   */
  const [gateOpen, setGateOpen] = useState(true);
  useLayoutEffect(() => {
    try {
      if (window.sessionStorage.getItem('served.launched') === '1') setGateOpen(false);
    } catch {
      setGateOpen(false);
    }
  }, []);

  const dismissGate = () => {
    try {
      window.sessionStorage.setItem('served.launched', '1');
    } catch {
      /* private mode — the gate simply shows again next time */
    }
    setGateOpen(false);
  };

  /**
   * A recipe counts when it meets the filters as written, or once the fit planner
   * has swapped what it allows and left out what is worth leaving out. Starting a
   * run clears the last one's exclusions, so the count is read against a clean run.
   */
  const fits = useMemo(() => {
    const run = runState([], []);
    return recipes.map((r) => fitFor(r, run, f, ingredientIndex));
  }, [recipes, f, ingredientIndex]);
  const litMap = useMemo(() => fits.map((x) => x !== null), [fits]);
  const matching = litMap.filter(Boolean).length;
  const adjusted = fits.filter((x) => x !== null && !isEmptyPlan(x.plan)).length;

  const toggle = (key: QuantKey) => setFilters((p) => ({ ...p, [key]: { ...p[key], on: !p[key].on } }));
  // dragging a scale engages its filter — reaching for the control is intent enough
  const setValue = (key: QuantKey, value: number) =>
    setFilters((p) => ({ ...p, [key]: { on: true, value } }));

  const beginRun = () => {
    resetKeepFilters();
    start();
    router.push('/explore');
  };

  const panel = (key: QuantKey) => ({
    label: QUANT_SPECS[key].label,
    preset: QUANT_SPECS[key].preset,
    threshold: `${QUANT_SPECS[key].direction === 'atLeast' ? '≥' : '≤'} ${f[key].value}${QUANT_SPECS[key].unit ? ` ${QUANT_SPECS[key].unit}` : ''}`,
    value: f[key].value,
    unit: QUANT_SPECS[key].unit,
    tone: QUANT_SPECS[key].tone,
    active: f[key].on,
    onToggle: () => toggle(key),
  });

  return (
    <>
      {gateOpen && <StartGate total={recipes.length} onDismiss={dismissGate} />}

      <motion.main
      animate={{ scale: gateOpen ? 0.94 : 1, opacity: gateOpen ? 0 : 1 }}
      transition={spring.carriage}
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        padding: 'calc(var(--safe-t) + 16px) var(--shell-pad) calc(var(--tabbar-h) + var(--safe-b) + 6px)',
        overflow: 'hidden',
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ease.arrive }}
        style={{ flex: '0 0 auto' }}
      >
        {/* One quiet line. The count it used to carry is the whole point of the
            readout directly below it, and the two lines together were costing the
            filters the vertical room their scales actually need. */}
        <h1 className="t-sub" style={{ margin: 0 }}>
          What are we eating?
        </h1>
      </motion.header>

      <MatchHero matching={matching} adjusted={adjusted} total={recipes.length} litMap={litMap} />

      {/* protein + calories on the left, time standing full height on the right */}
      <section style={{ flex: '1.05 1 0', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 9, minHeight: 0 }}>
        {/* The calorie drum is a horizontal instrument now, so this column is split
            1.62 : 1 rather than 2 : 1 — the drum needs a band deep enough to carry
            its ticks and their captions, and protein gives up the slack it had. */}
        <div style={{ display: 'grid', gridTemplateRows: '1.62fr 1fr', gap: 9, minHeight: 0 }}>
          <FilterPanel {...panel('protein')} numberSize={42}>
            <DottedScale
              min={QUANT_SPECS.protein.min}
              max={QUANT_SPECS.protein.max}
              step={QUANT_SPECS.protein.step}
              value={f.protein.value}
              onChange={(v) => setValue('protein', v)}
              direction="atLeast"
              labels={QUANT_SPECS.protein.labels}
              unit="g"
              label="Protein"
              height={44}
              ink={f.protein.on ? 'lume' : 'ink'}
            />
          </FilterPanel>

          {/* compact, not row: the drum is a horizontal instrument and every pixel of
              card width is travel under the thumb */}
          <FilterPanel {...panel('calories')} variant="compact" numberSize={20} radius={26}>
            <GlassDial
              min={QUANT_SPECS.calories.min}
              max={QUANT_SPECS.calories.max}
              step={QUANT_SPECS.calories.step}
              value={f.calories.value}
              onChange={(v) => setValue('calories', v)}
              active={f.calories.on}
              label="Calories"
              unit="kcal"
              height={38}
            />
          </FilterPanel>
        </div>

        <FilterPanel {...panel('time')} numberSize={38} fill>
          <VerticalDottedScale
            min={QUANT_SPECS.time.min}
            max={QUANT_SPECS.time.max}
            step={QUANT_SPECS.time.step}
            value={f.time.value}
            onChange={(v) => setValue('time', v)}
            direction="atMost"
            labels={QUANT_SPECS.time.labels}
            active={f.time.on}
            label="Time"
          />
        </FilterPanel>
      </section>

      {/* cuisine on the left, the two calculated scores stacked on the right */}
      <section style={{ flex: '1 1 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, minHeight: 0 }}>
        <CuisinePanel
          on={f.cuisineOn}
          selected={f.cuisines}
          onToggle={() => setFilters((p) => ({ ...p, cuisineOn: !p.cuisineOn }))}
          onToggleCuisine={(c) =>
            setFilters((p) => ({
              ...p,
              cuisines: p.cuisines.includes(c) ? p.cuisines.filter((x) => x !== c) : [...p.cuisines, c],
            }))
          }
        />

        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 9, minHeight: 0 }}>
          <FilterPanel {...panel('volume')} variant="compact" numberSize={24} radius={26}>
            <ArcSpanSlider
              min={QUANT_SPECS.volume.min}
              max={QUANT_SPECS.volume.max}
              step={QUANT_SPECS.volume.step}
              value={f.volume.value}
              onChange={(v) => setValue('volume', v)}
              active={f.volume.on}
              label="Volume"
              ticks={['Any', 'Mid', 'Large']}
              height={62}
            />
          </FilterPanel>

          <FilterPanel {...panel('health')} variant="compact" numberSize={24} radius={26}>
            <SineSlider
              min={QUANT_SPECS.health.min}
              max={QUANT_SPECS.health.max}
              step={QUANT_SPECS.health.step}
              value={f.health.value}
              onChange={(v) => setValue('health', v)}
              labels={[0, 50, 100]}
              label="Health"
              // matches the volume scale above it, and gives the single-cycle wave
              // the depth a 45° crossing needs
              height={62}
              ink={f.health.on ? 'lume' : 'ink'}
            />
          </FilterPanel>
        </div>
      </section>

      <LaunchBar count={matching} onStart={beginRun} />
      </motion.main>
    </>
  );
}
