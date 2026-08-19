'use client';

import { COURSE_TYPES, CUISINES, type CourseType } from '@/lib/db/types';
import type { Draft } from '@/lib/add/draft';

/** Title, description, servings, times, cuisine and course for a draft recipe. */

export function DraftHeader({ draft, onChange }: { draft: Draft; onChange: (c: Partial<Draft>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <input
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Recipe title"
        aria-label="Recipe title"
        className="t-display"
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
      />

      <textarea
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="One line about it"
        aria-label="Description"
        rows={2}
        className="t-body t-dim"
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          padding: 0,
          resize: 'none',
          fontFamily: 'inherit',
        }}
      />

      <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 14, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <NumField
            label="Servings"
            value={draft.servings}
            onChange={(v) => onChange({ servings: Math.max(1, v ?? 1) })}
          />
          <NumField label="Prep min" value={draft.prepMinutes} onChange={(v) => onChange({ prepMinutes: v })} />
          <NumField label="Cook min" value={draft.cookMinutes} onChange={(v) => onChange({ cookMinutes: v })} />
        </div>

        <Row label="Cuisine">
          {CUISINES.map((c) => (
            <Pick key={c} label={c} on={draft.cuisine === c} onClick={() => onChange({ cuisine: draft.cuisine === c ? null : c })} />
          ))}
        </Row>

        <Row label="Course">
          {COURSE_TYPES.map((c) => (
            <Pick
              key={c}
              label={c[0].toUpperCase() + c.slice(1)}
              on={draft.courseType === c}
              onClick={() => onChange({ courseType: draft.courseType === c ? null : (c as CourseType) })}
            />
          ))}
        </Row>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span className="t-micro t-dim-2" style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>
        {label}
      </span>
      <input
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v === '' ? null : Number(v) || null);
        }}
        inputMode="numeric"
        placeholder="—"
        aria-label={label}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 'var(--r-xs)',
          border: '1px solid var(--ink-08)',
          outline: 'none',
          background: 'var(--paper)',
          fontSize: 14,
          fontWeight: 300,
        }}
      />
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-micro t-dim-2" style={{ marginBottom: 6, fontSize: 11 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function Pick({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="t-micro"
      style={{
        padding: '6px 11px',
        borderRadius: 'var(--r-pill)',
        background: on ? 'var(--ink)' : 'var(--ink-04)',
        color: on ? '#fff' : 'var(--ink-45)',
        fontSize: 11.5,
      }}
    >
      {label}
    </button>
  );
}

export function InstructionEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="t-micro t-dim" style={{ margin: 0, fontWeight: 300 }}>
          Method
        </h2>
        <button type="button" onClick={() => onChange([...steps, ''])} className="t-micro t-dim-2">
          + Add step
        </button>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {steps.map((step, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              className="t-micro t-dim-2"
              style={{ width: 18, flex: '0 0 auto', paddingTop: 12, fontVariantNumeric: 'tabular-nums' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <textarea
              value={step}
              onChange={(e) => onChange(steps.map((s, idx) => (idx === i ? e.target.value : s)))}
              rows={2}
              aria-label={`Step ${i + 1}`}
              className="surface hairline"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                fontSize: 14,
                fontWeight: 300,
                lineHeight: 1.5,
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
              aria-label={`Remove step ${i + 1}`}
              className="t-dim-2"
              style={{ paddingTop: 12 }}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" aria-hidden>
                <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
