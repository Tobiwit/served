'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { Ingredient, IngredientRole } from '@/lib/db/types';
import { INGREDIENT_ROLES } from '@/lib/db/types';
import { isResolved, type DraftIngredient } from '@/lib/add/draft';
import { formatAmount, toGrams } from '@/lib/nutrition/units';
import { ease, spring } from '@/lib/motion';

/**
 * One ingredient awaiting a decision.
 *
 * A high-confidence match is pre-accepted but still shown with its score. Anything
 * less is presented as a question with three honest answers: use it, find the right
 * one, or create it. Nothing uncertain slips through silently.
 *
 * Once a row has its answer it folds down to a single line. A recipe is fifteen
 * ingredients and most of them are settled the moment they are parsed; leaving every
 * one of them open as a full card buried the two that still needed reading. The line
 * still carries everything you would check at a glance — amount, name, energy, role
 * — and one tap opens it again.
 *
 * A swap row is the same row indented under the one it stands in for, and it carries
 * its own quantity: 80 g of halloumi is not 80 g of tofu.
 */

const ROLE_LABEL: Record<IngredientRole, string> = {
  core: 'Core',
  optional: 'Optional',
  substitutable: 'Swappable',
  basic: 'Pantry',
};

/** The folded line is narrow, and the ingredient's name has first claim on it. */
const ROLE_SHORT: Partial<Record<IngredientRole, string>> = {
  optional: 'Opt',
  substitutable: 'Swap',
  basic: 'Pantry',
};

export function MatchRow({
  draft,
  index,
  onChange,
  onUnlink,
  onSearch,
  onCreate,
  onRemove,
}: {
  draft: DraftIngredient;
  index: Map<string, Ingredient>;
  onChange: (patch: Partial<DraftIngredient>) => void;
  onUnlink: () => void;
  onSearch: () => void;
  onCreate: () => void;
  onRemove: () => void;
}) {
  const matched = draft.ingredientId ? index.get(draft.ingredientId) : null;
  const pct = draft.match.best ? Math.round(draft.match.best.score * 100) : 0;
  const isSwap = draft.swapOf !== null;
  const settled = isResolved(draft);
  const collapsed = settled && draft.collapsed;

  /**
   * What this line actually contributes, not what the ingredient is worth per 100 g.
   *
   * The recipe says 200 g of pasta; "352 kcal" is the number being decided about,
   * and the per-100 g figure is a property of the database that happens to be how
   * it is stored.
   */
  const kcal =
    matched?.kcal_100g != null && draft.grams != null && draft.grams > 0
      ? Math.round((draft.grams / 100) * matched.kcal_100g)
      : null;

  // only worth offering when the two names actually differ
  const canKeepOwnName = !!matched && !!draft.typedName.trim() && draft.typedName.trim() !== matched.name;

  const measure = formatAmount(draft.amount, draft.unit);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring.settle}
      style={{ position: 'relative', paddingLeft: isSwap ? 22 : 0, listStyle: 'none' }}
    >
      {isSwap && <SwapTie />}

      <div
        className="surface hairline"
        style={{
          borderRadius: 'var(--r-lg)',
          padding: collapsed ? '9px 12px 9px 13px' : '12px 14px',
          background: isSwap ? 'rgba(255,255,255,0.78)' : 'var(--paper)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.div
              key="shut"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: ease.arrive }}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <button
                type="button"
                onClick={() => onChange({ collapsed: false })}
                aria-label={`Edit ${draft.name}`}
                aria-expanded={false}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 9, textAlign: 'left' }}
              >
                <span
                  className="t-micro t-dim"
                  style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', minWidth: isSwap ? 0 : 40 }}
                >
                  {measure || (draft.grams != null ? `${draft.grams} g` : isSwap ? '' : '—')}
                </span>
                <span
                  className="t-body"
                  style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {draft.name}
                </span>
                <span className="t-micro t-dim-2" style={{ flex: '0 0 auto', fontSize: 10.5 }}>
                  {!matched
                    ? 'no match'
                    : kcal != null
                      ? `${kcal} kcal`
                      : matched.kcal_100g == null
                        ? 'no data'
                        : `${matched.kcal_100g}/100 g`}
                </span>
                {!isSwap && ROLE_SHORT[draft.role] && (
                  <span className="t-micro t-dim-2" style={{ flex: '0 0 auto', fontSize: 10.5 }}>
                    {ROLE_SHORT[draft.role]}
                  </span>
                )}
                <Chevron />
              </button>
              <RemoveButton onClick={onRemove} name={draft.name} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: ease.arrive }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isSwap && (
                    <div className="t-label t-dim-2" style={{ marginBottom: 6, fontSize: 8.5 }}>
                      Or instead
                    </div>
                  )}
                  <input
                    value={draft.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    // leaving the field settles it: a matched row takes the
                    // ingredient's name unless it is keeping its own wording
                    onBlur={() => onChange({ customName: draft.customName })}
                    placeholder={isSwap ? 'Stand-in ingredient' : 'Ingredient'}
                    aria-label="Ingredient name"
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 16,
                      fontWeight: 300,
                      letterSpacing: '-0.015em',
                    }}
                  />

                  {/* How much, in the recipe's own words. Never wraps: cycling the
                      role pill from "Optional" to "Swappable" used to push it onto a
                      second line and shove the card open as you passed through. */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                    <Field
                      value={draft.amount ?? ''}
                      placeholder="amt"
                      width={50}
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
                    {isSwap ? (
                      <SwapAgain
                        on={draft.role === 'substitutable'}
                        onChange={(on) => onChange({ role: on ? 'substitutable' : 'core' })}
                      />
                    ) : (
                      <RoleCycle role={draft.role} onChange={(role) => onChange({ role })} />
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
                  {settled && (
                    <button
                      type="button"
                      onClick={() => onChange({ collapsed: true })}
                      aria-label="Collapse ingredient"
                      className="t-micro t-dim-2"
                      style={{ padding: 4, transform: 'rotate(180deg)' }}
                    >
                      <Chevron />
                    </button>
                  )}
                  <RemoveButton onClick={onRemove} name={draft.name} />
                </div>
              </div>

              <Weight draft={draft} ingredient={matched ?? null} isSwap={isSwap} onChange={onChange} />

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--ink-04)' }}>
                {matched ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="t-micro" style={{ color: 'var(--ink-70)' }}>
                        ✓ {matched.name}
                      </span>
                      <span className="t-micro t-dim-2">
                        {matched.kcal_100g == null
                          ? 'no nutrition data'
                          : kcal != null
                            ? `${kcal} kcal · ${matched.kcal_100g} / 100 g`
                            : `${matched.kcal_100g} kcal / 100 g`}
                      </span>
                      <span style={{ flex: 1 }} />
                      <TinyAction label="Change" onClick={onSearch} />
                      {/* the way out of a match you never asked for */}
                      <TinyAction label="Not this" onClick={onUnlink} />
                    </div>

                    {/* Matching adopts the ingredient's name so the collection reads as
                        one voice. Keeping your own wording is a deliberate exception —
                        the nutrition stays attached either way. */}
                    {canKeepOwnName && (
                      <button
                        type="button"
                        onClick={() => onChange({ customName: !draft.customName })}
                        aria-pressed={draft.customName}
                        className="t-micro"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          textAlign: 'left',
                          color: 'var(--ink-45)',
                          fontSize: 11,
                        }}
                      >
                        <Check on={draft.customName} />
                        <span>
                          Keep my wording — “<span style={{ color: 'var(--ink-70)' }}>{draft.typedName.trim()}</span>”
                        </span>
                      </button>
                    )}
                  </div>
                ) : draft.match.best ? (
                  <div>
                    <div className="t-micro t-dim" style={{ marginBottom: 8 }}>
                      Closest match: <span style={{ color: 'var(--ink)' }}>{draft.match.best.ingredient.name}</span> ·{' '}
                      {pct}%
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <TinyAction
                        label="Use match"
                        strong
                        onClick={() => onChange({ ingredientId: draft.match.best!.ingredient.id, collapsed: true })}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

/**
 * What the ingredient weighs.
 *
 * Grams is the only unit the nutrition maths can use, but it is a *result*, not a
 * third thing to fill in beside the amount and the unit — which is exactly what it
 * looked like sitting there as a peer input. So it reads as a derived value now: the
 * app works it out, says where the number came from, and you only type one when it
 * genuinely cannot.
 *
 * It cannot in two honest cases. Count units carry no weight of their own — a slice
 * or a clove means nothing until this ingredient says what one of them weighs. And
 * the volume table assumes water density, so a cup of flour comes out at 240 g when
 * it is nearer 120; adjusting is how you correct that without lying about what the
 * recipe actually said.
 */
function Weight({
  draft,
  ingredient,
  isSwap,
  onChange,
}: {
  draft: DraftIngredient;
  ingredient: Ingredient | null;
  isSwap: boolean;
  onChange: (patch: Partial<DraftIngredient>) => void;
}) {
  const auto = toGrams(draft.amount, draft.unit, ingredient);
  const editing = draft.gramsOverridden || auto == null;
  const measure = formatAmount(draft.amount, draft.unit);
  // a stand-in with no quantity of its own simply uses the line it replaces
  const inherits = isSwap && draft.amount == null && !draft.unit && draft.grams == null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        padding: '7px 10px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--ink-04)',
      }}
    >
      <span className="t-micro t-dim-2" style={{ flex: '0 0 auto', fontSize: 10.5 }}>
        Weighs
      </span>

      {inherits ? (
        <span className="t-micro t-dim-2" style={{ flex: 1, fontSize: 10.5, lineHeight: 1.4 }}>
          the same as the line above — give it an amount to change that
        </span>
      ) : editing ? (
        <>
          <input
            value={draft.grams ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ grams: v === '' ? null : Number(v.replace(',', '.')) || null, gramsOverridden: v !== '' });
            }}
            inputMode="decimal"
            placeholder="—"
            aria-label="Weight in grams"
            style={{
              width: 54,
              flex: '0 0 auto',
              padding: '5px 7px',
              borderRadius: 'var(--r-xs)',
              border: '1px solid var(--ink-08)',
              outline: 'none',
              background: 'var(--paper)',
              fontSize: 16,
              fontWeight: 300,
            }}
          />
          <span className="t-micro t-dim-2" style={{ flex: '0 0 auto', fontSize: 10.5 }}>
            g
          </span>
          <span style={{ flex: 1 }} />
          {auto != null ? (
            <TinyAction label={`Use ${auto} g`} onClick={() => onChange({ grams: auto, gramsOverridden: false })} />
          ) : (
            <span className="t-micro t-dim-2" style={{ fontSize: 10.5, textAlign: 'right', lineHeight: 1.4 }}>
              {measure ? `no set weight for ${measure}` : 'nutrition is weighed in grams'}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="t-body" style={{ flex: '0 0 auto', fontSize: 14 }}>
            {auto} g
          </span>
          <span className="t-micro t-dim-2" style={{ flex: 1, minWidth: 0, fontSize: 10.5 }}>
            {measure ? `from ${measure}` : ''}
          </span>
          <TinyAction label="Adjust" onClick={() => onChange({ grams: auto, gramsOverridden: true })} />
        </>
      )}
    </div>
  );
}

/** The bracket tying a stand-in to the ingredient it replaces. */
function SwapTie() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: 5,
        // a short elbow anchored to the top: the tie belongs at the junction, not
        // running the whole height of a card that may be open and tall
        top: -9,
        height: 26,
        width: 11,
        borderLeft: '1px solid var(--ink-08)',
        borderBottom: '1px solid var(--ink-08)',
        borderBottomLeftRadius: 9,
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        style={{ position: 'absolute', left: 6, bottom: -6, background: 'var(--fog)' }}
      >
        <path
          d="M1.5 4h8M7.5 2 9.5 4 7.5 6"
          stroke="var(--ink-30)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.5 8h-8M4.5 6 2.5 8l2 2"
          stroke="var(--ink-30)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flex: '0 0 auto' }}>
      <path d="M3 4.5 6 7.5l3-3" stroke="var(--ink-30)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        flex: '0 0 auto',
        borderRadius: 4,
        display: 'grid',
        placeItems: 'center',
        background: on ? 'var(--ink)' : 'transparent',
        boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--ink-14)',
      }}
    >
      {on && (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 5.2 4 7.2 8 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function RemoveButton({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${name || 'ingredient'}`}
      className="t-micro t-dim-2"
      style={{ padding: 5, flex: '0 0 auto' }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
        <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Field({
  value,
  placeholder,
  onChange,
  width,
  label,
}: {
  value: string | number;
  placeholder: string;
  onChange: (v: string) => void;
  width: number;
  label: string;
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
        flex: '0 0 auto',
        padding: '7px 8px',
        borderRadius: 'var(--r-xs)',
        border: '1px solid var(--ink-08)',
        outline: 'none',
        background: 'var(--paper)',
        // 16px, or iOS zooms the whole page in the moment the field is focused
        fontSize: 16,
        fontWeight: 300,
      }}
    />
  );
}

/** Fixed width, so cycling to a longer label never reflows the line. */
const PILL_WIDTH = 84;

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
        flex: '0 0 auto',
        width: PILL_WIDTH,
        padding: '6px 4px',
        borderRadius: 'var(--r-pill)',
        textAlign: 'center',
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

/** Marking a stand-in swappable opens another slot behind it, and so on down. */
function SwapAgain({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label="Add another stand-in after this one"
      className="t-micro"
      style={{
        marginLeft: 'auto',
        flex: '0 0 auto',
        width: PILL_WIDTH,
        padding: '6px 4px',
        borderRadius: 'var(--r-pill)',
        textAlign: 'center',
        background: on ? 'var(--ink)' : 'var(--ink-04)',
        color: on ? '#fff' : 'var(--ink-45)',
        fontSize: 11,
        whiteSpace: 'nowrap',
      }}
    >
      {on ? 'Swappable' : 'Or another'}
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
        flex: '0 0 auto',
        padding: '6px 11px',
        borderRadius: 'var(--r-pill)',
        background: strong ? 'var(--ink)' : 'var(--ink-04)',
        color: strong ? '#fff' : 'var(--ink-70)',
        fontSize: 11.5,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
