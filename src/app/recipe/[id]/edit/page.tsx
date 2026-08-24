'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/store/DataProvider';
import { draftFromRecipe, toNewRecipe, type Draft } from '@/lib/add/draft';
import { RecipeEditor } from '@/components/add/RecipeEditor';

/**
 * Editing a saved recipe.
 *
 * The same editor the importer uses, over a draft rebuilt from the stored recipe.
 * Everything the editor does not own — the photo, the image prompt, the favourite
 * mark, the tags — is carried through from the original rather than reset, so an
 * edit never silently drops a picture you added.
 */
export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { recipes, ingredientIndex, saveRecipe, ready } = useData();

  const recipe = recipes.find((r) => r.id === id) ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // built once the collection has loaded, and never rebuilt underneath an edit
  useEffect(() => {
    if (recipe && !draft) setDraft(draftFromRecipe(recipe, ingredientIndex));
  }, [recipe, draft, ingredientIndex]);

  const save = async () => {
    if (!draft || !recipe) return;
    setSaving(true);
    try {
      await saveRecipe(toNewRecipe(draft, recipe, ingredientIndex));
      router.push(`/recipe/${recipe.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <main className="screen" style={{ paddingTop: 120 }} />;

  if (!recipe) {
    return (
      <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 80px)' }}>
        <h1 className="t-title">Not in the collection</h1>
        <button type="button" onClick={() => router.push('/library')} className="t-micro t-dim" style={{ marginTop: 12 }}>
          Back to recipes
        </button>
      </main>
    );
  }

  if (!draft) return <main className="screen" style={{ paddingTop: 120 }} />;

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 20px)' }}>
      <RecipeEditor
        draft={draft}
        setDraft={(update) => setDraft((d) => (d ? update(d) : d))}
        onSave={save}
        saving={saving}
        saveLabel="Save changes"
        savingLabel="Saving…"
        header={
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <button type="button" onClick={() => router.push(`/recipe/${recipe.id}`)} className="t-micro t-dim">
              ← Cancel
            </button>
            <span style={{ flex: 1 }} />
            <span className="t-micro t-dim-2">Editing</span>
          </header>
        }
      />
    </main>
  );
}
