# Served

A private, mobile-only recipe instrument. One loop:

**Set what I want → explore my recipes → remove what doesn't work → find dinner.**

Not a social platform, not a meal tracker, not a recommender. Exclusions and boosts
live for one day and are then forgotten by design.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Open `http://localhost:3000` on a phone-sized viewport. It ships with 18 recipes and
137 ingredients so the app is usable the moment it starts.

### Installing to the iPhone Home Screen

Open the deployed URL in Safari → Share → **Add to Home Screen**. The manifest sets
`display: standalone`, so it launches full-screen with no browser chrome. Icons are
generated at build time from `src/app/icon.tsx` — there are no binary assets to keep
in sync.

---

## Storage

The app runs against a seeded local store by default. Add Supabase credentials and it
switches over with no other changes:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Apply `supabase/migrations/0001_init.sql` first. Both adapters implement the same
`Repo` interface in `src/lib/db/adapter.ts`; nothing above that line knows which is
in use.

---

## How it is put together

```
src/
  app/                 routes: setup (/), explore, recipe/[id], library, add,
                       ingredients, settings, manifest + generated icons
  components/
    glass/             GradientField — the blurred colour field under frosted glass
    instrument/        dotted numerals, dotted scale, arc gauge, dot bars, ripple
    setup/             match readout, quantitative filter modules, chips, launch
    explore/           recipe plate, ingredient capsules, the glass mechanism
    recipe/            nutrition, score panels, servings, image prompt
    add/               match rows, bottom sheet, new-ingredient form
  lib/
    db/                domain types + local and Supabase adapters
    nutrition/         unit conversion and unknown-aware calculation
    scoring/           health.ts, volume.ts, and their shared context
    explore/           filters, session lifecycle, candidate engine
    match/             fuzzy ingredient matching
    parse/             pasted-recipe parser
    add/               the editable draft between "parsed" and "saved"
  seed/                starter ingredients and recipes
```

### Nutrition

Ingredient nutrition is normalised per 100 g and every macro is nullable. A missing
value is **unknown, never zero**: sums only include ingredients that carry the value,
and each result reports the share of the dish's weight it could account for. That is
what the "94% complete" line on the nutrition card means.

Grams are the unit that matters. `toGrams` resolves per-ingredient conversions first
(1 tbsp olive oil is 13.5 g, 1 tbsp honey is 21 g), then a conservative global table,
and returns `null` rather than guessing.

### The two scores

Both are explicit heuristics with exported, tunable configs — not medical claims —
and both are auditable in the UI.

**Health Score** (`src/lib/scoring/health.ts`) starts at 40 and moves on protein
density, fibre, produce share, whole-food share, calorie density, fat quality, added
sugar and salty components. Low calorie density contributes at most +5, while protein,
fibre and produce are worth up to +42 between them — so a small plate of nothing never
outranks a substantial plate of real food. Across the starter collection the scores
span 40–96.

**Volume Score** (`src/lib/scoring/volume.ts`) blends 65% physical bulk (grams per
serving, calorie density, water-rich composition) with 35% satiety support (protein,
fibre, mass). A large soup and a small brownie can share a calorie count; only one of
them scores here.

Ingredient `category` carries the qualitative signal macros cannot: it is how the
scorer knows 300 kcal of almonds and 300 kcal of chorizo are not the same food.

### Explore

`buildCandidates` applies the setup filters, drops what you have already seen, then
evaluates exclusions by role: **core** removes the recipe, **optional** and
**substitutable** leave it standing (substitutable flags a swap), **basic** is ignored
entirely. Boosted ingredients float their recipes to the front of the shuffle.

The recipe on screen is resolved from the collection, not from the candidate list.
Excluding an ingredient must never yank the plate out from under you — only the
mechanism changes what is displayed.

### Importing

Paste → parse → review → resolve → save. The parser handles what people actually
paste: unicode fractions, `1 1/2`, ranges, bullets, `Serves 4`, section headings.
Matching is trigram + token similarity against canonical names and aliases; anything
below the confidence threshold comes back as a question with three honest answers —
use it, search for the right one, or create it. Nothing uncertain is silently accepted.

### Images

V1 deliberately does not *generate* images. Every recipe gets **Copy image prompt**,
which combines a fixed global photography direction with that recipe's subject, so
each shot belongs to the same library: top-down, soft diffused daylight, abundant,
restrained, no hands, no text, no props, and the least vessel the food actually needs.

The other half of that loop is the camera button on the recipe hero: generate the
photo elsewhere, then add it. Images are downscaled to 1100px and re-encoded as JPEG
under ~320 KB before storage — with Supabase they go to the `recipe-images` bucket
(created by the migration), and without it they are kept as data URLs on the device,
where localStorage has a hard quota measured in single-digit megabytes.

Until a photo exists, the recipe plate renders a composed colour field keyed to its
cuisine rather than an empty box.

---

## Design

White/fog environment, blurred colour fields under frosted glass, fine outlines,
thin type, and instrument motifs — dotted numerals, dotted scales, radial arcs.
Gradients are load-bearing, not decorative: they mark the surfaces that carry data
and the ones you act on. Everything else stays white and quiet.

Every gradient field carries white type, so two rules keep it readable: no blob may
be near-white, and each field has a base fill plus a gentle legibility veil. Yellow-
green and peach are the brightest hues in the palette and fail worst at the light
end — the veil buys back the contrast without flattening the colour. Deep variants
(`plate*`, `engage`) exist for surfaces where type sits edge to edge.

Dotted numerals are traced from real numeral strokes rather than lit from a 5×7
matrix (`src/lib/dotted/glyphs.ts`), sampled with pure maths so server and client
agree exactly.

Motion is a device changing state, not pages fading. Four named springs in
`src/lib/motion.ts` and a 300–650 ms budget. Changing recipes runs a frosted plate
across the stage with counter-rotating dotted arcs behind it: the outgoing recipe
sinks back in Z with blur and a small perspective tilt, the incoming one arrives in
front, and the ingredient capsules settle afterwards on a stagger. The whole app
honours `prefers-reduced-motion`.

---

## Scripts

```bash
npm run typecheck
```

```bash
node scripts/validate-seed.mjs
```

The second checks that every seeded recipe ingredient resolves to a seeded ingredient.
