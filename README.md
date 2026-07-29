# Access Profile

A player describes their access needs once. For any game, the app returns one of:

- **Playable as shipped**
- **Playable after configuration** — with the exact settings to change, in order
- **Not playable / not verified**

Directories of accessibility features already exist. Nobody turns a personal
profile into "turn these six toggles on, in this menu, in this order." That is
the product.

No paywalls, no ads, no upsells, ever. The player's profile never leaves their
device.

## Status

| Phase | State |
|---|---|
| 0 — Spine | Schema + migrations done. Taxonomy seed **blocked**, see [docs/BLOCKED.md](docs/BLOCKED.md) |
| 1 — Match engine | Done. 50 tests, 100% branch coverage |
| — Corpus export | Done, ahead of Phase 2 so curation targets a settled format |
| 2 — Curated corpus | Not started |
| 3 — Profile builder | Not started |
| 4 — Results | Not started |
| 5 — Recipe authoring | Not started |
| 6 — Ingestion | Not started |

## Layout

```
packages/match   pure match engine — no imports, no I/O, runs client-side
packages/db      Prisma schema, migrations, provenance-guarded seeds,
                 and the static corpus exporter
docs/            architecture notes and known blockers
index.html       the existing GitHub Pages site, untouched
```

## How the read side works

Postgres is authoring only and never on the request path. `export:corpus` builds
versioned JSON chunks plus a manifest with integrity hashes; the browser
downloads those once and runs the match engine locally. No per-query server
cost, no user database, no breach surface, and the site keeps working with the
database down.

The exporter emits `ExportedEntry`, which `extends GameWithClaims` — the exact
type `evaluate()` consumes — so the published format cannot drift from what the
engine reads. Chunks are keyed by slug rather than database id, because profiles
live in share-link fragments and must survive a database rebuild.

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm test

# Database (authoring only)
cp packages/db/.env.example packages/db/.env
pnpm --filter @access-profile/db exec prisma migrate deploy
pnpm --filter @access-profile/db seed:sources
```

`pnpm --filter @access-profile/db seed:taxonomy` fetches the AGI tag set from
source. It has no embedded tag list and will fail loudly rather than invent one.

## The rule that matters

A wrong "playable" verdict costs a disabled player money and trust.
Under-promising is always the safe failure. Concretely:

- No accessibility claim is written without a fetched source URL and a capture
  date. Enforced in code by `packages/db/src/seed/guard.ts`, not by convention.
- Sources are archived, not just cited — every claim carries a hash of what was
  read and a link to an immutable copy, so it stays checkable after the page
  changes or disappears.
- Absence of data is `UNVERIFIED`, never `false`.
- Blocker needs are hard gates — no weighting, no probabilistic softening.
- Confidence combines who looked with how long ago; old evidence cannot be
  presented as certain.
- Every verdict returns the reasoning and sources that produced it.

The property test in `packages/match/test/properties.test.ts` enumerates every
single-need combination at every trust tier, plus 2000 seeded multi-need
scenarios, asserting that `PLAYABLE` is never returned over an unmet blocker.

## Licence

Code MIT. Dataset, once it exists, CC BY-SA. Open source from commit one so that
if this stops being maintained, someone else can pick it up and users lose
nothing.
