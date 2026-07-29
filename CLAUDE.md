# Access Profile

Accessibility profile → game matching + verified settings recipes.

## Absolute rules
- NEVER write accessibility data from your own knowledge. Every FeatureClaim
  and RecipeStep needs a real sourceUrl fetched during this session. If you
  cannot source it, leave it out and say so.
- Missing data is UNVERIFIED, never ABSENT.
- Blocker-severity needs are hard gates in the match engine. Do not soften
  them, weight them, or add fallbacks.
- packages/match imports nothing. No Prisma, no fetch, no env. Pure functions.

## Working style
- Small commits, one concern each.
- Match engine changes require tests in the same commit.
- Run `pnpm typecheck && pnpm test` before declaring anything done.
- Radix primitives for anything interactive. Do not hand-roll dropdowns,
  dialogs, or tab lists.
- Every interactive element must be keyboard-operable and labelled. Treat an
  a11y lint failure as a build failure.

## Stack
Next.js App Router, TypeScript strict, Postgres + Prisma, Tailwind, Radix.

## Layout
apps/web        Next.js app
packages/match  pure match engine
packages/db     Prisma schema + client
packages/ingest workers, one module per source

---

## Notes for whoever picks this up next

### The taxonomy table is intentionally empty
`FeatureTaxonomy` has no rows yet. The AGI tag set must be **fetched** from
source, and the environment this was scaffolded in had no outbound access to
`accessiblegames.com` or `learn.microsoft.com`. Rather than author 24 tags from
memory — the exact thing the first absolute rule forbids — `pnpm --filter
@access-profile/db seed:taxonomy` fetches, and exits non-zero with an
explanation when it cannot. See `docs/BLOCKED.md`.

To finish it: run the seed from a machine with network access, inspect the real
markup of both source pages, and implement `parseTags` in
`packages/db/src/seed/taxonomy-source.ts` against what is actually there.

### Barriers have their own vocabulary, deliberately
`Barrier` does not point at `FeatureTaxonomy`. Feature tags describe what a game
*has*; a barrier is what a game *does to you*. There is no AGI feature tag for
"unskippable QTE requiring 8 inputs per second", and inventing `no-unskippable-qte`
to make one fit would bend the feature vocabulary around a modelling mistake.

So: `BarrierTaxonomy` names barriers, and `BarrierImpact` maps each barrier type
to the needs it obstructs — many-to-many, because one QTE can block one-handed
play and low-dexterity play at once. In the match engine a barrier carries
`impactsTaxonomyIds` and gates every need it names.

### The chunk format is the contract, and it is keyed by slug
`ExportedEntry extends GameWithClaims`, so what the exporter publishes is exactly
what `evaluate()` consumes — the compiler enforces it and there is no adapter to
drift.

Everything in a chunk is keyed by **slug, never database id**. A profile lives in
localStorage and in the fragment of a share link, potentially for years. If it
referenced cuids, rebuilding the database would silently invalidate every profile
and every share link in existence.

Two export rules exist for safety, both tested:
- Unpublished recipes never ship.
- A barrier's `workaroundRecipeId` is dropped when it points at a recipe that is
  not published — otherwise the engine would treat a HARD barrier as neutralised
  by a recipe no player can read.

### Provenance is enforced in code, not by convention
`packages/db/src/seed/guard.ts` rejects any row without a real https source URL
and a parseable capture date, and rejects placeholder hosts like `example.com`.
Route every write of claim-shaped data through it.

Capture, don't just cite: `capture.ts` fetches a source, hashes exactly what it
read, and pushes a copy to the Wayback Machine. `contentHash` and `archiveUrl`
ride along to the exported corpus, so a claim stays checkable after its source
404s or quietly changes. Archiving is free while ingesting and impossible
retroactively — do it at write time or not at all.

### Confidence is trust × recency
Trust tier answers who looked, `capturedAt` answers when. A decisive claim past
a year caps confidence at MEDIUM, past two years at LOW — a longer rope than the
180-day recipe window, because menu paths move every patch while a game that
shipped captions usually still has them.

Age is a ceiling, never a boost: a same-day community report is still LOW.
Warnings are emitted wherever evidence is ageing; confidence is only capped
where that evidence actually drove the outcome.

### Test fixtures use example.invalid on purpose
Fixtures in `packages/match/test` invent games, tags and URLs. They exercise the
rule set; they are not claims about real games. The provenance guard rejects that
host precisely so fixture data can never be mistaken for a source.

### Interpretations made where plan §5 was silent
Recorded so they can be challenged rather than rediscovered:
- A `PARTIAL` claim on a blocker with no recipe resolves to `UNVERIFIED`, not
  `NOT_PLAYABLE`. Partial support is not evidence of absence, and under-promising
  is the safe failure.
- A verified recipe can satisfy a blocker whose claim is `ABSENT`, `PARTIAL` or
  missing. Plan rule 1 already exempts hard barriers with a workaround recipe, so
  recipes are treated as evidence in their own right — they carry `gameVersion`,
  `verifiedAt` and `verifiedBy`.
- An unmet `FRICTION` or `PREFERENCE` need does not stop a `PLAYABLE` verdict.
  Blockers are the gate; the unmet need is still reported in `reasons`.
- An explicit `UNVERIFIED` claim never outranks a real observation from a lower
  tier. "Nobody checked" is not a finding.
- A stale recipe that actually drove the verdict caps confidence at `LOW` rather
  than changing the outcome.
