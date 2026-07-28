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

### Provenance is enforced in code, not by convention
`packages/db/src/seed/guard.ts` rejects any row without a real https source URL
and a parseable capture date, and rejects placeholder hosts like `example.com`.
Route every write of claim-shaped data through it.

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
