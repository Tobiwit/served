'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/store/DataProvider';
import { parseRecipeText } from '@/lib/parse/recipeText';
import { draftFromParsed, draftIngredient, emptyDraft, toNewRecipe, withSwapRows, type Draft } from '@/lib/add/draft';
import { RecipeEditor } from '@/components/add/RecipeEditor';
import { Backlog, FromBacklogNote } from '@/components/add/Backlog';
import { DictateIngredients, type DictatedLine } from '@/components/add/DictateIngredients';
import { draftFromSeed, takeRecipeSeed } from '@/lib/add/handoff';
import type { BacklogEntry } from '@/lib/db/types';

const SAMPLE = `Miso Butter Mushroom Toast
Serves 2 · Prep 10 min · Cook 10 min

Ingredients
300 g mushrooms, sliced
2 slices sourdough bread
1 tbsp miso paste
20 g butter
1 clove garlic
2 tbsp greek yoghurt
salt and pepper

Method
1. Fry the mushrooms hard in a dry pan until they squeak.
2. Add butter, garlic and miso and toss to coat.
3. Toast the bread and spread with yoghurt.
4. Pile the mushrooms on top.`;

export default function AddPage() {
  const router = useRouter();
  const { ready, ingredients, ingredientIndex, saveRecipe, deleteBacklog } = useData();

  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  /** the backlog entry being written up, if this draft came from one */
  const [from, setFrom] = useState<BacklogEntry | null>(null);
  const [dictating, setDictating] = useState(false);

  /** Dictated lines open the editor the same way parsed text does, just without a title yet. */
  const startFromDictation = (lines: DictatedLine[]) => {
    setDictating(false);
    startDraft(
      withSwapRows({
        ...emptyDraft(),
        ingredients: lines.map((l) => draftIngredient({ ...l, notes: null, role: 'core' }, ingredients, ingredientIndex)),
      }),
    );
  };

  const startDraft = (next: Draft, source: BacklogEntry | null = null) => {
    setFrom(source);
    setDraft(next);
  };

  // A meal handed over from the tracker opens straight in the editor, titled and
  // with its lines in. Waits for the collection so its ingredients can be matched.
  useEffect(() => {
    if (!ready) return;
    const seed = takeRecipeSeed();
    if (seed) startDraft(draftFromSeed(seed, ingredients, ingredientIndex));
    // once per visit — the seed is taken, so a later change has nothing to pick up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const leaveDraft = () => {
    setFrom(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = toNewRecipe({ ...draft, sourceText: text || null }, undefined, ingredientIndex);
      // the photo taken when it was noted down carries over — it is the same meal,
      // and asking for it again is the friction the backlog exists to remove
      const saved = await saveRecipe(from?.image_url ? { ...payload, image_url: from.image_url } : payload);
      if (from) await deleteBacklog(from.id);
      router.push(`/recipe/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
        <header style={{ marginBottom: 20 }}>
          <button type="button" onClick={() => router.push('/library')} className="t-micro t-dim" style={{ marginBottom: 14 }}>
            ← Recipes
          </button>
          <h1 className="t-display" style={{ margin: 0 }}>
            Add a recipe
          </h1>
          <p className="t-micro t-dim" style={{ margin: '8px 0 0' }}>
            Paste it from anywhere. You review everything before it saves.
          </p>
        </header>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste recipe text here…"
          aria-label="Recipe text"
          rows={12}
          className="surface hairline"
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 'var(--r-lg)',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontSize: 16,
            fontWeight: 300,
            lineHeight: 1.55,
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => startDraft(draftFromParsed(parseRecipeText(text), ingredients, ingredientIndex))}
            disabled={!text.trim()}
            style={{
              flex: 1,
              minWidth: 160,
              padding: '14px 20px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--ink)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 300,
              opacity: text.trim() ? 1 : 0.4,
            }}
          >
            Parse recipe
          </button>
          <button
            type="button"
            onClick={() => setDictating(true)}
            className="surface hairline"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 300 }}
          >
            <svg width="15" height="15" viewBox="0 0 22 22" aria-hidden>
              <rect x="8" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 11a6 6 0 0 0 12 0M11 17v2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Dictate
          </button>
          <button
            type="button"
            onClick={() => startDraft(emptyDraft())}
            className="surface hairline"
            style={{ padding: '14px 20px', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 300, color: 'var(--ink-45)' }}
          >
            Start blank
          </button>
        </div>

        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="t-micro t-dim-2"
          style={{ marginTop: 18, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Paste an example
        </button>

        <Backlog onWriteUp={(entry) => startDraft({ ...emptyDraft(), title: entry.title }, entry)} />

        <DictateIngredients open={dictating} onClose={() => setDictating(false)} onDone={startFromDictation} />
      </main>
    );
  }

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 20px)' }}>
      <RecipeEditor
        draft={draft}
        setDraft={(update) => setDraft((d) => (d ? update(d) : d))}
        onSave={save}
        saving={saving}
        saveLabel="Save recipe"
        savingLabel="Saving…"
        header={
          <>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <button type="button" onClick={leaveDraft} className="t-micro t-dim">
                ← Back
              </button>
              <span style={{ flex: 1 }} />
            </header>
            {from && <FromBacklogNote title={from.title} />}
          </>
        }
      />
    </main>
  );
}
