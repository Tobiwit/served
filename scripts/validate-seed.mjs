// Sanity check: every recipe ingredient must resolve to a seeded ingredient.
import { readFileSync, readdirSync } from 'node:fs';

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const known = new Set();
for (const f of ['ingredients.ts', 'ingredients-b.ts', 'ingredients-c.ts']) {
  const src = readFileSync(`src/seed/${f}`, 'utf8');
  for (const m of src.matchAll(/^\s*\['([^']+)',\s*'[a-z_]+',/gm)) known.add(slug(m[1]));
}

const missing = new Map();
const note = (n) => missing.set(n, (missing.get(n) ?? 0) + 1);
for (const f of readdirSync('src/seed').filter((x) => /^recipes-[abc]\.ts$/.test(x))) {
  const src = readFileSync(`src/seed/${f}`, 'utf8');
  for (const m of src.matchAll(/^\s*\['([^']+)',\s*(?:null|[\d.]+),/gm)) if (!known.has(slug(m[1]))) note(m[1]);
  for (const m of src.matchAll(/subs: \{([^}]*)\}/g))
    for (const s of m[1].matchAll(/'([^']+)'/g)) if (!known.has(slug(s[1]))) note(s[1]);
}

console.log(`ingredients: ${known.size}`);
if (missing.size) {
  console.log('UNRESOLVED:');
  for (const [k, v] of missing) console.log(`  ${k} (x${v})`);
  process.exit(1);
}
console.log('all recipe ingredients resolve');
