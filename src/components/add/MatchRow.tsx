'use client';

import { motion } from 'motion/react';
import type { Ingredient, IngredientRole } from '@/lib/db/types';
import { INGREDIENT_ROLES } from '@/lib/db/types';
import type { DraftIngredient } from '@/lib/add/draft';
import { ease, spring } from '@/lib/motion';

/**
 * One ingredient awaiting a decision.
 *
 * A high-confidence match is pre-accepted but still shown with its score. Anything
 * less is presented as a question with three honest answers: use it, find the right
 * one, or create it. Nothing uncertain slips through silently.
 */

const ROLE_LABEL: Record<IngredientRole, string> = {
  core: 'Core',
  optional: 'Optional',
  substitutable: 'Swappable',
  basic: 'Pantry',
};

export function MatchRow({
  draft,
  index,
  onChange,
  onSearch,
  onCreate,
  onRemove,
}: {
  draft: DraftIngredient;
  index: Map<string, Ingredient>;
  onChange: (patch: Partial<DraftIngredient>) => void;
  onSearch: () => void;
  onCreate: () => void;
  onRemove: () => void;
}) {
  const matched = draft.ingredientId ? index.get(draft.ingredientId) : null;
  const pct = draft.match.best ? Math.round(draft.match.best.score * 100) : 0;
  const needsAnswer = !draft.confirmed && !draft.ingredientId;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring.settle}
      className="surface hairline"
      style={{ borderRadius: 'var(--r-lg)', padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ingredient"
            aria-label="Ingredient name"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              fontWeight: 300,
              letterSpacing: '-0.015em',
            }}
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <Field
              value={draft.amount ?? ''}
              placeholder="amt"
              width={52}
              onChange={(v) => onChange({ amount: v === '' ? null : Number(v.replace(',', '.')) || null })}
              label="Amount"
            />
            <Field
              value={draft.unit ?? ''}
              placeholder="unit"
              width={56}
              onChange={(v) => onChange({ unit: v || null })}
              label="Unit"
            />
            <Field
              value={draft.grams ?? ''}
              placeholder="g"
              width={58}
              onChange={(v) =>
                onChange({ grams: v === '' ? null : Number(v.replace(',', '.')) || null, gramsOverridden: v !== '' })
              }
              label="Grams"
              dim={!draft.gramsOverridden}
            />
            <RoleCycle role={draft.role} onChange={(role) => onChange({ role })} />
          </div>
        </div>

        <button type="button" onClick={onRemove} aria-label="Remove ingredient" className="t-micro t-dim-2" style={{ padding: 4 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
            <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <motion.div
        key={needsAnswer ? 'ask' : matched ? 'ok' : 'none'}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: ease.arrive }}
        style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--ink-04)' }}
      >
          {matched ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="t-micro" style={{ color: 'var(--ink-70)' }}>
                ✓ {matched.name}
              </span>
              <span className="t-micro t-dim-2">
                {matched.kcal_100g == null ? 'no nutrition data' : `${matched.kcal_100g} kcal / 100g`}
              </span>
              <span style={{ flex: 1 }} />
              <TinyAction label="Change" onClick={onSearch} />
            </div>
          ) : draft.match.best ? (
            <div>
              <div className="t-micro t-dim" style={{ marginBottom: 8 }}>
                Closest match: <span style={{ color: 'var(--ink)' }}>{draft.match.best.ingredient.name}</span> · {pct}%
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <TinyAction
                  label="Use match"
                  strong
                  onClick={() =>
                    onChange({
                      ingredientId: draft.match.best!.ingredient.id,
                      confirmed: true,
                      role: draft.match.best!.ingredient.default_basic ? 'basic' : draft.role,
                    })
                  }
                />
                <TinyAction label="Search" onClick={onSearch} />
                <TinyAction label="Create new" onClick={onCreate} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="t-micro t-dim">No nutrition match</span>
              <span style={{ flex: 1 }} />
              <TinyAction label="Search" onClick={onSearch} />
              <TinyAction label="Create new" strong onClick={onCreate} />
            </div>
          )}
      </motion.div>
    </motion.li>
  );
}

function Field({
  value,
  placeholder,
  onChange,
  width,
  label,
  dim,
}: {
  value: string | number;
  placeholder: string;
  onChange: (v: string) => void;
  width: number;
  label: string;
  dim?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      inputMode={placeholder === 'unit' ? 'text' : 'decimal'}
      style={{
        width,
        padding: '6px 8px',
        borderRadius: 'var(--r-xs)',
        border: '1px solid var(--ink-08)',
        outline: 'none',
        background: 'var(--paper)',
        fontSize: 12.5,
        fontWeight: 300,
        color: dim ? 'var(--ink-45)' : 'var(--ink)',
      }}
    />
  );
}

function RoleCycle({ role, onChange }: { role: IngredientRole; onChange: (r: IngredientRole) => void }) {
  const next = () => onChange(INGREDIENT_ROLES[(INGREDIENT_ROLES.indexOf(role) + 1) % INGREDIENT_ROLES.length]);
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Role: ${ROLE_LABEL[role]}. Tap to change.`}
      className="t-micro"
      style={{
        marginLeft: 'auto',
        padding: '6px 10px',
        borderRadius: 'var(--r-pill)',
        background: role === 'basic' ? 'var(--ink-04)' : 'var(--ink)',
        color: role === 'basic' ? 'var(--ink-45)' : '#fff',
        fontSize: 11,
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABEL[role]}
    </button>
  );
}

function TinyAction({ label, onClick, strong }: { label: string; onClick: () => void; strong?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="t-micro"
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        background: strong ? 'var(--ink)' : 'var(--ink-04)',
        color: strong ? '#fff' : 'var(--ink-70)',
        fontSize: 11.5,
      }}
    >
      {label}
    </button>
  );
}
