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

Open `http://localhost:3000` on a phone-sized viewport. The collection lives in
Supabase, so set that up first — see **Storage** below. `npm run seed:cloud` puts the
starter 18 recipes and 137 ingredients in an empty database.

### Installing to the iPhone Home Screen

Open the deployed URL in Safari → Share → **Add to Home Screen**. The manifest sets
`display: standalone`, so it launches full-screen with no browser chrome. Icons are
generated at build time from `src/app/icon.tsx` — there are no binary assets to keep
in sync.

---

## Storage

Local-first in behaviour, cloud-backed in persistence.

The database is the source of truth for recipes, ingredients, nutrition,
substitutions, favourites and cooked history. The device keeps a full mirror of it in
IndexedDB, so **every read is answered locally and every write returns before it has
been sent anywhere.** The app behaves the same with no signal as with one; only the
sync readout in Settings can tell the difference.

```
UI ──► DataProvider ──► CloudRepo ──┬──► IndexedDB mirror  reads, always
                                    ├──► outbox           writes, queued in order
                                    └──► SupabaseRemote   flush + delta pull
```

Writes land in the mirror and in an outbox in the same tick. The queue drains to
Supabase whenever there is a connection — on reconnect, on returning to the app, and
on a timer while anything is unsent. It drains strictly in order and strictly
serially, because two writes to one recipe arriving out of order would leave the
cloud holding the older one. Repeat writes to the same record are folded together, so
tapping favourite five times sends one row.

A write Postgres rejects on its merits is parked rather than retried forever; one bad
row must not wedge everything behind it. Settings says so when it happens.

Conflicts resolve last-write-wins per record, which is the honest resolution for one
person with one or two devices. The rule that matters: **a pulled row never overwrites
a local edit that has not been sent yet.**

Deletes are soft. A row that simply vanished is invisible to a delta pull — it reads
as "not changed" — so deleting sets `deleted_at` and the mirror evicts what it sees
carrying one.

### What lives where

| | |
| --- | --- |
| Recipes, ingredients, nutrition, substitutions | cloud + mirror |
| Favourites, cooked history | cloud + mirror |
| Photos | Supabase Storage, cached by the service worker |
| Explore filters, popped ingredients, recipes seen this run | local only |
| Last open screen | local only |

An Explore run is deliberately disposable — it holds what you want *today* — so it
was never a candidate for syncing. It stays in `localStorage` and resets on a new
calendar day.

### Offline

`public/sw.js` holds the app shell and the build assets. Without it the mirror would
be unreachable: a Home Screen PWA launched with no signal has no browser to fall back
on, and every cached recipe would sit behind a white screen. Recipe photos are cached
too — their paths carry a timestamp, so they are immutable. Supabase REST and auth are
never cached; a stale row or a stale token is worse than an honest failure, and the
app is built to survive that failure.

A photo added offline is compressed, parked in the mirror as a blob, and shown from an
`idb:` sentinel until the queue drains and rewrites it to the real URL.

### The account

One private account, met once. Email and password rather than a magic link,
deliberately: a link opens in Safari, and a Home Screen PWA on iOS keeps its own
storage — the session would land in the browser and never reach the installed app.
Supabase rotates the refresh token from then on.

### Setting it up

**[SETUP.md](SETUP.md) walks the whole thing** — creating the project, running the
migrations, the account, the seed, Vercel, and installing to the Home Screen.

The short version:

```bash
cp .env.example .env.local
```

1. Apply the migrations in `supabase/migrations` in order, each once.
2. Create your single account in the Supabase dashboard, then **disable sign-ups** —
   the RLS policies grant any authenticated session full access, and that is only
   safe because exactly one account exists.
3. Fill in `.env.local`, then seed the empty database once:

```bash
npm run seed:cloud
```

4. Put the two `NEXT_PUBLIC_` values in Vercel and redeploy — they are baked in at
   build time. The service-role key stays on your machine; it bypasses RLS.

---

## How it is put together

```
src/
  app/                 routes: setup (/), explore, recipe/[id], recipe/[id]/edit,
                       library, add, ingredients, settings, manifest + icons
  components/
    glass/             GradientField — the blurred colour field under frosted glass
    instrument/        dotted numerals, dotted scale, arc gauge, dot bars, ripple
    setup/             match readout, quantitative filter modules, chips, launch
    explore/           recipe plate, ingredient capsules, the glass mechanism
    recipe/            nutrition, score panels, servings, image prompt
    add/               the draft editor, match rows, bottom sheet, new-ingredient form
  lib/
    auth/              the single-account session
    db/                domain types, the IndexedDB mirror, the outbox,
                       CloudRepo and the Supabase remote
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

In the editor grams is therefore a *derived* readout, not a third field beside the
amount and the unit: the row says what it weighs and where that number came from, and
you only type one when it genuinely cannot be worked out. That happens honestly in two
cases — a count unit with no per-ingredient conversion (a slice, a clove), and a volume
the water-density table gets wrong (a cup of flour resolves to 240 g and is nearer
120). Adjusting corrects the weight without lying about the recipe's own wording.

### The two scores

Both are explicit heuristics with exported, tunable configs — not medical claims —
and both are auditable in the UI.

**Health Score** (`src/lib/scoring/health.ts`) starts at 40 and moves on protein
density, fibre, produce share, whole-food share, calorie density, fat quality, added
sugar and salty components. Low calorie density contributes at most +5, while protein,
fibre and produce are worth up to +42 between them — so a small plate of nothing never
outranks a substantial plate of real food. Across the starter collection the scores
span 43–94.

Protein, fibre and calorie density come from the summed macros. Produce, whole food,
added sugar and salt come from ingredient categories, because no macro distinguishes a
lentil from a lozenge. **Fat needs both**: the category says what kind of fat it is
(`SATURATED_SHARE` in `context.ts` — butter and olive oil are both essentially pure fat
and belong at opposite ends), and the ingredient's own `fat_100g` says how much of it
there is. Judging fat by category membership alone scored a light mozzarella exactly
like a mascarpone, and cost a dish sixteen points for containing any cheese at all.

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

### Importing and editing

Paste → parse → review → resolve → save. The parser handles what people actually
paste: unicode fractions, `1 1/2`, ranges, bullets, `Serves 4`, section headings.
Matching is trigram + token similarity against canonical names and aliases; anything
below the confidence threshold comes back as a question with three honest answers —
use it, search for the right one, or create it. Nothing uncertain is silently accepted.

A matched row takes the ingredient's **canonical name**, so "sourdough", "sourdough
bread" and "bread, sourdough" all settle on the same words and the collection reads
as one voice. Keeping your own wording is a checkbox on the row, not the default: the
nutrition stays attached either way.

A row folds down to a summary line as soon as it has its answer — most of a parsed
recipe is settled on arrival, and leaving fifteen open cards buried the two that
still needed reading.

Marking a row **swappable** opens an empty row attached beneath it for the
alternative; mark *that* one swappable and the chain carries on. A stand-in carries
its own quantity — 80 g halloumi *or* 120 g firm tofu — and falls back to the line it
replaces when it has none. A chain is stored as `substitutions` on the line it hangs
off, which is what keeps the nutrition honest: a dish made with chicken *or* tofu is
costed once, never twice. In Explore the chain leads with the recipe's own first
option, unless one of them is something you said you wanted, which moves to the front.

The same editor backs `/add` and `/recipe/[id]/edit`. Editing carries the photo,
image prompt, favourite mark and tags through untouched.

### Images

V1 deliberately does not *generate* images. Every recipe gets **Copy image prompt**,
which combines a fixed global photography direction with that recipe's subject, so
each shot belongs to the same library: top-down, soft diffused daylight, abundant,
restrained, no hands, no text, no props, and the least vessel the food actually needs.

The other half of that loop is the camera button on the recipe hero: generate the
photo elsewhere, then add it. Images are downscaled to 1100px and re-encoded as JPEG
under ~320 KB before storage — they go to the `recipe-images` bucket
(created by the migration), and one added with no signal waits in the device mirror
until the queue drains.

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
agree exactly. Strokes are sampled one at a time, so every glyph is walked once more
afterwards to drop dots that land on a neighbour — without it the waist of an 8 and
the tail of a 6 read as blots rather than as line.

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

```bash
npm run seed:cloud
```

`validate-seed` checks that every seeded recipe ingredient resolves to a seeded
ingredient. `seed:cloud` populates an empty database with the starter collection — it
writes through the same code path the app's own saves take, and every write is an
upsert on a stable id, so re-running it is safe.
