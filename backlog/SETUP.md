# Switching on accounts

Backlogged works with no backend at all. Everything below is optional — it adds
cross-device sync and public profiles. Skip it and the app stays exactly as it is:
local to one browser, no network, no sign-in UI anywhere.

Budget about twenty minutes, most of it waiting on DNS for the email step.

---

## 1. Create the Supabase project

<https://supabase.com/dashboard> → **New project**. Any region near you.

From **Settings → API**, copy two values:

| Value | Where it goes | Safe to commit? |
|---|---|---|
| Project URL | `backlog/index.html` | Yes |
| `anon` `public` key | `backlog/index.html` | **Yes** — see below |
| `service_role` key | nowhere | **Never** |

The `anon` key is *designed* to be public. It identifies the project, it does not grant
access — row-level security does that, and the policies are in `schema.sql`. The
`service_role` key is the opposite: it bypasses every policy. It must never appear in this
repository, in a commit, or in a screenshot.

## 2. Create the tables

**SQL Editor → New query**, paste the whole of [`schema.sql`](./schema.sql), run it.

It is idempotent, so re-running after an edit is fine.

This creates three tables and, more importantly, the policies that make the rest safe:

- `libraries` — your private document. Owner-only, all four verbs, **no public policy at
  all**. This is where journal notes, prices and drop reasons live.
- `profiles` — handle, display name, bio, and whether you are public. Default private.
- `public_shelves` — the projection strangers can read. Written *only* by
  `publish_shelf()`, a `security definer` function that whitelists fields on the server, so
  a bug in the browser cannot leak a private field.

## 3. Point the app at it

In `backlog/index.html`, near the top of the `<script>`:

```js
const SUPABASE = {
  url:     "https://YOUR-PROJECT.supabase.co",
  anonKey: "eyJhbG..."
};
```

That is the only code change. Leave both strings empty to switch accounts back off.

## 4. Sign-in providers

**Authentication → URL Configuration**

- Site URL: `https://dramadanov.github.io/backlog/`
- Redirect URLs: add `https://dramadanov.github.io/backlog/` and, for local work,
  `http://127.0.0.1:8899/backlog/`

**Authentication → Providers** — enable **GitHub** and **Google**. Each wants a client ID
and secret from that provider's developer console, with the callback set to the value
Supabase shows you on the same screen.

## 5. Email — the step that quietly breaks things

**Authentication → Emails → SMTP Settings.**

Supabase's built-in mailer is capped at a handful of messages per hour and is explicitly
not for production. If you skip this, magic links will work while you test and then
silently stop for real visitors, which looks exactly like the app being broken.

Any transactional provider works — [Resend](https://resend.com) and
[Postmark](https://postmarkapp.com) both have free tiers big enough for this. You will need
to verify a sending domain, which is the DNS wait.

## 6. Check it

```bash
node backlog/verify_live.mjs https://YOUR-PROJECT.supabase.co YOUR_ANON_KEY

# add your email as a third argument to test magic-link delivery too
node backlog/verify_live.mjs https://YOUR-PROJECT.supabase.co YOUR_ANON_KEY you@example.com
```

It checks the things that cannot be proven without a real project: that the schema is
installed, that an anonymous caller cannot read `libraries`, that `handle_available()` and
the publish/withdraw functions respond correctly, and that magic-link delivery is accepted.
It does not create accounts or write data.

---

## Things that will surprise you later

**Free projects sleep.** After about a week with no requests, Supabase pauses a free
project. The first visitor afterwards gets errors until you resume it from the dashboard.
For a portfolio piece that is usually fine; just know that "it broke" often means "it
napped".

**Handles are globally unique**, so `handle_available()` will tell a stranger whether a name
is taken — including one belonging to a private profile. That is true of every username
field on the web. It reveals the name only, never the account behind it.

**Public means public.** Anything you tick as shared, plus any review you mark shareable, is
readable by anyone with the URL and by search engines. Notes, prices, drop reasons and
logged hours are never published — that is enforced in the database, not the browser — but
what you do share is genuinely out there.

**Moderation becomes your problem** the moment other people can publish profiles on your
domain. Profiles default to private, the report link on each profile emails you, and you can
delete any row from `public_shelves` directly. Decide how you want that handled before you
promote it anywhere.

## If something goes wrong

| Symptom | Cause |
|---|---|
| Sign-in does nothing, no email | SMTP not configured, or you hit the built-in cap |
| Redirected but still signed out | Redirect URL not on the allow-list in step 4 |
| "Failed to fetch" in the console | Project is paused, or the URL has a typo |
| Sync stuck on "Sync failed" | `schema.sql` not run, so `libraries` does not exist |
| Publishing says "pick a handle" | Save a handle before making the shelf public |
