# Blocked: AGI taxonomy seed

Task 3 of the build plan's §10 — *"Fetch the AGI tag list from source and write
the taxonomy seed with URLs and capture dates attached"* — is **not done**, and
was not faked.

## What happened

The environment this was scaffolded in routes outbound traffic through a proxy
with a domain allowlist. Both authoritative sources for the tag set are blocked:

```
accessiblegames.com          CONNECT tunnel failed, response 403
learn.microsoft.com          CONNECT tunnel failed, response 403
developer.microsoft.com      CONNECT tunnel failed, response 403
caniplaythat.com             CONNECT tunnel failed, response 403
```

Only `github.com` and package registries are reachable.

## Why the table was left empty

Plan §2.1 and the first absolute rule in `CLAUDE.md`:

> NEVER write accessibility data from your own knowledge. Every FeatureClaim and
> RecipeStep needs a real sourceUrl fetched during this session. If you cannot
> source it, leave it out and say so.

The 24 tag names are the kind of thing a model will happily produce from memory,
and the result would look completely correct — 24 plausible tags, each with a
plausible `sourceUrl` pointing at a page never actually read. That is worse than
an empty table, because nothing downstream could tell the difference. So: empty
table, loud failure.

## What is in place

- `packages/db/src/seed/taxonomy-source.ts` — the two source URLs, the fetcher,
  and a `slugify` helper. **No embedded tag list and no fallback.**
- `packages/db/src/seed/taxonomy.ts` — the seed entry point. Fetches, provenance-
  checks every row, exits non-zero with an explanation if sources are unreachable.
- `packages/db/src/seed/guard.ts` — `requireProvenance`, which rejects any row
  without a real https URL and parseable capture date, and rejects placeholder
  hosts. Tested.

Verified behaviour in this environment:

```
$ pnpm --filter @access-profile/db seed:taxonomy
Could not fetch the AGI tag list from https://accessiblegames.com/accessibility-tags/.
Seeding is aborted rather than falling back to a remembered tag list.

The taxonomy table has been left empty. This is the intended behaviour when
sources are unreachable.
$ echo $?
1
```

## To finish it

1. Run from a machine with network access, or add these domains to the
   environment's allowlist:
   - `https://accessiblegames.com/accessibility-tags/`
   - `https://learn.microsoft.com/en-us/xbox/accessibility/accessibility-feature-tags`
2. Fetch both pages and **read the markup**. Do not guess selectors.
3. Implement `parseTags` in `taxonomy-source.ts` against the real structure.
4. Map the published category headings (auditory, gameplay, input, visual) onto
   `TaxonomyCategory` (`VISUAL | AUDITORY | MOTOR | COGNITIVE | SPEECH`). These
   do not line up one-to-one — the AGI "gameplay" and "input" groupings cut
   across `MOTOR` and `COGNITIVE`. Record the mapping decision in a comment.
5. Upsert by slug, with `sourceUrl` and `capturedAt` on every row.
6. Cross-check the two sources against each other. Microsoft's page documents
   the AGI tags plus older Xbox-specific tags; only the AGI set belongs in
   `source: AGI`, the rest are `EXTENDED` or excluded.

Both pages were confirmed to exist via search before being attempted — the
blocker is network policy, not a dead link.
