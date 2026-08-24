'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/store/DataProvider';
import { parseRecipeText } from '@/lib/parse/recipeText';
import { draftFromParsed, emptyDraft, toNewRecipe, type Draft } from '@/lib/add/draft';
import { RecipeEditor } from '@/components/add/RecipeEditor';

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
  const { ingredients, ingredientIndex, saveRecipe } = useData();

  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveRecipe(toNewRecipe({ ...draft, sourceText: text || null }, undefined, ingredientIndex));
      router.push(`/recipe/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
        <header style={{ marginBottom: 20 }}>
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
            onClick={() => setDraft(draftFromParsed(parseRecipeText(text), ingredients, ingredientIndex))}
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
            onClick={() => setDraft(emptyDraft())}
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
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <button type="button" onClick={() => setDraft(null)} className="t-micro t-dim">
              ← Back
            </button>
            <span style={{ flex: 1 }} />
          </header>
        }
      />
    </main>
  );
}
