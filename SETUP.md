# Setting up Served

Start to finish: empty Supabase project → seeded database → private account → deployed
on Vercel → installed on the iPhone.

Do it in this order. Roughly 20 minutes, most of it waiting for the project to boot.

Dashboard labels move around between Supabase releases. Where that's likely, the
wording below says what you're looking for rather than only where it was last.

---

## 1. Create the Supabase project

1. Go to **[supabase.com](https://supabase.com)** and sign in (GitHub login is fine).
2. **New project**.
3. Fill in:
   - **Name** — `served`
   - **Database password** — generate one and **save it in your password manager**.
     This is the *Postgres* password. It is not the password you will log into the app
     with, and the app never uses it. You will likely never need it again, but it
     cannot be recovered — only reset.
   - **Region** — pick the one closest to you. Every recipe load goes there.
   - **Plan** — Free is plenty. A personal recipe box is a few hundred kilobytes.
4. **Create new project**, then wait ~2 minutes for it to finish provisioning.

---

## 2. Run the migrations

Left sidebar → **SQL Editor** → **New query**.

Run these **one at a time, in this order**. For each: open the file, copy the whole
thing, paste it in, press **Run**, wait for success, then clear the editor and do the
next one.

| Order | File |
| --- | --- |
| 1 | `supabase/migrations/0001_init.sql` |
| 2 | `supabase/migrations/0002_course_main.sql` |
| 3 | `supabase/migrations/0003_substitution_amounts.sql` |
| 4 | `supabase/migrations/0004_sync.sql` |

**Run each one exactly once.** `0001` creates types and tables and will error on a
second run — that's expected, not something to fix. (`0002`, `0003` and `0004` are
written to be safe to re-run.)

`0001` also creates the `recipe-images` storage bucket and its access policies, so
there is nothing to set up by hand for photos.

**To check it worked:** sidebar → **Table Editor**. You should see `recipes`,
`ingredients`, `recipe_ingredients`, `cook_log`, `tags` and friends — all empty for now.

---

## 3. Create your account, then lock the door

This is the one account that will ever exist. It is what stops anyone else reading
your collection.

### Create the user

Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.

- **Email** — your address.
- **Password** — pick a real one and save it in your password manager. This *is* the
  app password, the one you'll type on your phone once.
- **Auto Confirm User** — **tick this.** Without it the account starts unconfirmed and
  sign-in fails with "Email not confirmed".

### Turn off sign-ups

Sidebar → **Authentication** → **Sign In / Providers** → **Email**, and turn **off**
the setting that allows new users to sign up. (On older dashboards it lives under
Authentication → Settings, worded "Allow new users to sign up".)

**Do not skip this.** The row-level security policies grant *any* authenticated
session full access to everything. That is only safe because exactly one account
exists. Leave sign-ups on and anyone who finds the URL can register themselves an
account and read — and delete — your recipes.

---

## 4. Get the API keys

Sidebar → **Project Settings** → **API Keys** (older dashboards: **Project Settings** →
**API**).

You need three values:

| What you need | Where it is | Looks like |
| --- | --- | --- |
| Project URL | Project Settings → API → *Project URL* | `https://abcdefgh.supabase.co` |
| Public key | *anon / public*, or *publishable* on newer projects | `eyJhbGci…` or `sb_publishable_…` |
| Secret key | *service_role*, or *secret* on newer projects — click to reveal | `eyJhbGci…` or `sb_secret_…` |

Either key format works; the app doesn't care which your project uses.

> **The public key is safe to expose.** It ships to the browser by design and is
> useless without a login, because RLS requires an authenticated session.
>
> **The secret key is not.** It bypasses row-level security entirely. It goes in
> `.env.local` on your machine and **nowhere else** — never in Vercel, never committed,
> never prefixed `NEXT_PUBLIC_`.

---

## 5. Local environment and seed

In the project folder:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all three:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
```

`.env.local` is already in `.gitignore`, so it will not be committed.

Install dependencies if you haven't:

```bash
npm install
```

Now put the starter collection in the empty database — 137 ingredients and 18 recipes:

```bash
npm run seed:cloud
```

It prints each recipe as it goes and ends with `done`. It's idempotent: every write is
an upsert on a fixed id, so running it twice changes nothing.

**To check it worked:** Table Editor → `recipes` should have 18 rows, `ingredients`
137.

---

## 6. Check it locally

```bash
npm run dev
```

Open `http://localhost:3000` in a phone-sized viewport.

1. You should get the **Sign in** screen. Enter the email and password from step 3.
2. The collection loads.
3. **Reload the page.** It should come back instantly — that second load is served from
   the device mirror, not the network.
4. Go to **Settings → Sync**. It should say *Everything is synced*.

---

## 7. Deploy to Vercel

### If the project isn't on Vercel yet

1. **[vercel.com](https://vercel.com)** → **Add New** → **Project**.
2. Import the `served` repository from GitHub.
3. Leave the framework preset (Next.js) and all build settings alone.
4. **Before clicking Deploy**, add the environment variables below.

### Environment variables

Vercel → your project → **Settings** → **Environment Variables**. Add exactly two:

| Name | Value | Environments |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your public key | Production, Preview, Development |

**Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel.** Nothing deployed uses it. It
exists only so the seed script can run from your machine, and it bypasses all access
control.

> **`NEXT_PUBLIC_` variables are baked in at build time, not read at runtime.** Adding
> or changing one does nothing to the site that is already live — you have to
> **redeploy**. If you added them after deploying: Deployments → the latest one → ⋯ →
> **Redeploy**.

### Then

Open the deployed URL. You should get the same sign-in screen, and the same collection
after signing in.

---

## 8. Install on the iPhone

1. Open the deployed URL **in Safari** (not Chrome — only Safari can install to the
   Home Screen).
2. **Share** → **Add to Home Screen**.
3. Open it from the Home Screen. It launches full screen with no browser chrome.
4. Sign in **once**. The session persists and refreshes itself; in normal use you will
   never see that screen again.

**Test that offline actually works** — this is the whole point of the build:

1. Open the app from the Home Screen and let it load.
2. Turn on **Aeroplane Mode**.
3. Open the app again. It still loads, and every recipe is still there.
4. Favourite something, or edit a recipe. It saves instantly. Settings → Sync says
   *1 change waiting to send*.
5. Turn Aeroplane Mode off and reopen the app. The queue drains and Sync goes back to
   *Everything is synced*.

---

## Troubleshooting

**"No database configured"**
The two `NEXT_PUBLIC_` variables aren't reaching the app. Locally: check `.env.local`
spelling and restart `npm run dev` — it only reads env at startup. On Vercel: check
they're set for the right environment, then **redeploy**.

**"Invalid login credentials"**
The email or password doesn't match a user. Authentication → Users — is the user there?
You can set a new password from that screen.

**"Email not confirmed"**
The user was created without auto-confirm. Authentication → Users → your user → confirm
it manually, or delete it and re-create with **Auto Confirm User** ticked.

**Signed in, but the collection is empty**
`npm run seed:cloud` hasn't run, or ran against a different project. Check Table Editor
→ `recipes` for rows. If rows *are* there but the app shows none, check the migrations
all ran — particularly `0001`, which creates the RLS policies.

**Photos don't appear after adding one**
If you were offline, the photo is queued — Settings → Sync will say so, and it uploads
when you reconnect. If you were online, check Storage → `recipe-images` for the file.

**Something is stuck at "N changes waiting to send"**
Settings → Sync, tap the row to retry. If it says a change *could not be saved*, that
one was rejected by the database rather than by the network, and retrying won't help on
its own.

**Starting over completely**
Settings → **Refresh from cloud** throws away the copy on the device and downloads
everything again. It won't run while there are unsent changes, so sync first.
