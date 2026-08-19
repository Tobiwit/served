'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { RecipeImage } from '@/components/explore/RecipeImage';
import { formatKcal, formatMacro } from '@/lib/nutrition/calc';
import { ease, spring } from '@/lib/motion';
import type { Recipe } from '@/lib/db/types';

/**
 * The library is the calm counterpart to Explore: white, structured, scannable.
 * No gradients except inside the recipe plates themselves.
 */

const SORTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'protein', label: 'Protein' },
  { key: 'calories', label: 'Calories' },
  { key: 'health', label: 'Health' },
  { key: 'volume', label: 'Volume' },
  { key: 'time', label: 'Time' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

export default function LibraryPage() {
  const { recipes, analysisFor, ingredientIndex, ready } = useData();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [favesOnly, setFavesOnly] = useState(false);

  const searchable = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipes) {
      const ingredientNames = r.ingredients
        .map((ri) => {
          const ing = ri.ingredient_id ? ingredientIndex.get(ri.ingredient_id) : null;
          return `${ri.display_name} ${ing?.aliases.join(' ') ?? ''}`;
        })
        .join(' ');
      map.set(r.id, `${r.title} ${r.cuisine ?? ''} ${r.course_type ?? ''} ${r.tags.join(' ')} ${ingredientNames}`.toLowerCase());
    }
    return map;
  }, [recipes, ingredientIndex]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = recipes.filter((r) => {
      if (favesOnly && !r.favorite) return false;
      if (!q) return true;
      return (searchable.get(r.id) ?? '').includes(q);
    });

    const value = (r: Recipe) => {
      const a = analysisFor(r);
      switch (sort) {
        case 'protein':
          return -(a.nutrition.perServing.protein ?? -1);
        case 'calories':
          return a.nutrition.perServing.kcal ?? Number.MAX_SAFE_INTEGER;
        case 'health':
          return -a.health.score;
        case 'volume':
          return -a.volume.score;
        case 'time':
          return r.total_minutes ?? Number.MAX_SAFE_INTEGER;
        default:
          return -new Date(r.created_at).getTime();
      }
    };

    return filtered.slice().sort((a, b) => value(a) - value(b));
  }, [recipes, query, favesOnly, sort, searchable, analysisFor]);

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          Recipes
        </h1>
        <p className="t-micro t-dim" style={{ margin: '8px 0 0' }}>
          {ready ? `${recipes.length} in the collection` : 'Reading the shelf…'}
        </p>
      </header>

      <div className="surface hairline" style={{ borderRadius: 'var(--r-pill)', padding: '11px 16px', display: 'flex', gap: 10 }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--ink-30)' }} aria-hidden>
          <circle cx="6.6" cy="6.6" r="4.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="m9.8 9.8 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, ingredient, cuisine, tag"
          aria-label="Search recipes"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14.5,
            fontWeight: 300,
          }}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="t-micro t-dim-2">
            Clear
          </button>
        )}
      </div>

      <div className="hstrip no-scrollbar" style={{ marginTop: 12 }}>
        <SortChip label="Favourites" active={favesOnly} onClick={() => setFavesOnly((v) => !v)} />
        <span style={{ width: 1, background: 'var(--ink-08)', flex: '0 0 auto', margin: '4px 4px' }} />
        {SORTS.map((s) => (
          <SortChip key={s.key} label={s.label} active={sort === s.key} onClick={() => setSort(s.key)} />
        ))}
      </div>

      <motion.ul layout style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 10 }}>
        {visible.map((recipe, i) => {
          const a = analysisFor(recipe);
          return (
            <motion.li
              key={recipe.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.settle, delay: Math.min(i * 0.02, 0.2) }}
            >
              <Link
                href={`/recipe/${recipe.id}`}
                className="surface hairline"
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: 10,
                  borderRadius: 'var(--r-lg)',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    width: 74,
                    height: 74,
                    flex: '0 0 auto',
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                  }}
                >
                  <RecipeImage recipe={recipe} radius="var(--r-md)" showAperture={false} />
                </span>

                <span style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                  <span className="t-sub" style={{ display: 'block' }}>
                    {recipe.title}
                  </span>
                  <span className="t-micro t-dim" style={{ display: 'block', marginTop: 4 }}>
                    {formatKcal(a.nutrition.perServing.kcal)} kcal · {formatMacro(a.nutrition.perServing.protein)} protein
                  </span>
                  <span className="t-micro t-dim-2" style={{ display: 'block', marginTop: 3, fontSize: 11 }}>
                    H {a.health.score} · V {a.volume.score}
                    {recipe.total_minutes ? ` · ${recipe.total_minutes} min` : ''}
                  </span>
                </span>

                {recipe.favorite && (
                  <span style={{ flex: '0 0 auto', color: 'var(--ink-30)', paddingRight: 6 }} aria-label="Favourite">
                    <svg width="13" height="13" viewBox="0 0 15 15" aria-hidden>
                      <path
                        d="M7.5 12.4 3.3 8.3a2.7 2.7 0 0 1 3.8-3.8l.4.4.4-.4a2.7 2.7 0 1 1 3.8 3.8z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                )}
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>

      {ready && visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: ease.arrive }}
          className="t-body t-dim"
          style={{ textAlign: 'center', marginTop: 60 }}
        >
          Nothing here matches.
        </motion.p>
      )}
    </main>
  );
}

function SortChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{ flex: '0 0 auto' }}>
      <span
        className="hairline"
        style={{
          display: 'block',
          padding: '7px 13px',
          borderRadius: 'var(--r-pill)',
          fontSize: 12.5,
          fontWeight: 300,
          whiteSpace: 'nowrap',
          background: active ? 'var(--ink)' : 'var(--paper)',
          color: active ? '#fff' : 'var(--ink-45)',
          boxShadow: 'var(--lift-1)',
          transition: 'background 240ms ease, color 240ms ease',
        }}
      >
        {label}
      </span>
    </button>
  );
}
