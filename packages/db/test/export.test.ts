import { describe, expect, it } from 'vitest';
import { evaluate, type GameWithClaims, type Profile } from '@access-profile/match';
import { MissingProvenanceError } from '../src/seed/guard.js';
import {
  ExportIntegrityError,
  chunkEntries,
  chunkId,
  mapEntry,
  type DbBarrierRow,
  type DbClaimRow,
  type DbEntryRow,
  type DbRecipeRow,
} from '../src/export/map.js';
import { CHUNK_FORMAT_VERSION } from '../src/export/types.js';

const SLUGS = new Map([
  ['tax-captions', 'large-clear-subtitles'],
  ['tax-remap', 'full-input-remapping'],
]);

function claimRow(overrides: Partial<DbClaimRow> = {}): DbClaimRow {
  return {
    id: 'claim-1',
    taxonomy: { slug: 'large-clear-subtitles' },
    state: 'PRESENT',
    note: null,
    source: {
      id: 'src-1',
      name: 'Publisher accessibility page',
      kind: 'PUBLISHER',
      trustTier: 3,
    },
    sourceUrl: 'https://publisher.test/accessibility/game',
    capturedAt: new Date('2026-06-01T00:00:00.000Z'),
    contentHash: null,
    archiveUrl: null,
    verifiedBy: null,
    verifiedAt: null,
    ...overrides,
  };
}

function recipeRow(overrides: Partial<DbRecipeRow> = {}): DbRecipeRow {
  return {
    id: 'recipe-1',
    title: 'Turn on large subtitles',
    summary: 'Six toggles, in order.',
    gameVersion: '1.4.2',
    verifiedAt: new Date('2026-07-01T00:00:00.000Z'),
    verifiedBy: 'curator',
    staleAt: new Date('2026-12-28T00:00:00.000Z'),
    addressesTaxonomyIds: ['tax-captions'],
    published: true,
    steps: [
      {
        id: 'step-2',
        order: 2,
        menuPath: 'Options > Accessibility > Visual',
        action: 'Set Subtitle Size to Large',
        note: null,
        screenshotUrl: null,
      },
      {
        id: 'step-1',
        order: 1,
        menuPath: 'Options > Accessibility',
        action: 'Enable Subtitles',
        note: 'Off by default.',
        screenshotUrl: 'https://cdn.test/step1.png',
      },
    ],
    ...overrides,
  };
}

function barrierRow(overrides: Partial<DbBarrierRow> = {}): DbBarrierRow {
  return {
    id: 'barrier-1',
    barrierTaxonomy: {
      slug: 'unskippable-high-apm-qte',
      impacts: [
        { taxonomy: { slug: 'full-input-remapping' } },
        { taxonomy: { slug: 'large-clear-subtitles' } },
      ],
    },
    severity: 'HARD',
    description: 'Unskippable QTE requiring 8 inputs per second.',
    workaroundRecipeId: null,
    sourceUrl: 'https://reviewer.test/game/barriers',
    capturedAt: new Date('2026-06-15T00:00:00.000Z'),
    contentHash: null,
    archiveUrl: null,
    ...overrides,
  };
}

function entryRow(overrides: Partial<DbEntryRow> = {}): DbEntryRow {
  return {
    game: {
      id: 'game-1',
      igdbId: 12345,
      name: 'Synthetic Game',
      coverUrl: null,
      releaseDate: null,
    },
    platform: { id: 'plat-1', slug: 'pc-steam' },
    claims: [claimRow()],
    barriers: [],
    recipes: [],
    ...overrides,
  };
}

describe('mapEntry', () => {
  it('keys everything by slug, never by database id', () => {
    const entry = mapEntry(entryRow({ recipes: [recipeRow()] }), SLUGS);

    expect(entry.claims[0]?.taxonomyId).toBe('large-clear-subtitles');
    expect(entry.recipes[0]?.addressesTaxonomyIds).toEqual([
      'large-clear-subtitles',
    ]);
    expect(entry.platformSlug).toBe('pc-steam');
  });

  it('produces something the match engine consumes unchanged', () => {
    const entry = mapEntry(
      entryRow({ recipes: [recipeRow()] }),
      SLUGS,
    );

    // The compile-time guarantee, exercised at runtime.
    const asGame: GameWithClaims = entry;
    const profile: Profile = {
      id: 'p',
      needs: [{ taxonomyId: 'large-clear-subtitles', severity: 'BLOCKER' }],
    };

    const verdict = evaluate(profile, asGame, {
      now: new Date('2026-07-29T00:00:00.000Z'),
    });

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.confidence).toBe('HIGH');
    expect(verdict.reasons[0]?.evidence[0]?.sourceUrl).toBe(
      'https://publisher.test/accessibility/game',
    );
  });

  it('sorts recipe steps by order', () => {
    const entry = mapEntry(entryRow({ recipes: [recipeRow()] }), SLUGS);

    expect(entry.recipes[0]?.steps.map((s) => s.order)).toEqual([1, 2]);
    expect(entry.recipes[0]?.steps[0]?.action).toBe('Enable Subtitles');
  });

  it('excludes unpublished recipes', () => {
    const entry = mapEntry(
      entryRow({
        recipes: [recipeRow({ published: false })],
      }),
      SLUGS,
    );

    expect(entry.recipes).toEqual([]);
  });

  it('drops a workaround reference to a recipe that is not published', () => {
    // Otherwise the engine treats a HARD barrier as neutralised by a recipe the
    // player can never read, and reports the game as playable.
    const entry = mapEntry(
      entryRow({
        barriers: [barrierRow({ workaroundRecipeId: 'recipe-1' })],
        recipes: [recipeRow({ published: false })],
      }),
      SLUGS,
    );

    expect(entry.barriers[0]?.workaroundRecipeId).toBeUndefined();

    const verdict = evaluate(
      { id: 'p', needs: [{ taxonomyId: 'full-input-remapping', severity: 'BLOCKER' }] },
      entry,
      { now: new Date('2026-07-29T00:00:00.000Z') },
    );
    expect(verdict.outcome).toBe('NOT_PLAYABLE');
  });

  it('keeps a workaround reference to a published recipe', () => {
    const entry = mapEntry(
      entryRow({
        barriers: [barrierRow({ workaroundRecipeId: 'recipe-1' })],
        recipes: [recipeRow({ addressesTaxonomyIds: ['tax-remap'] })],
      }),
      SLUGS,
    );

    expect(entry.barriers[0]?.workaroundRecipeId).toBe('recipe-1');
  });

  it('carries the barrier vocabulary slug and every need it obstructs', () => {
    const entry = mapEntry(entryRow({ barriers: [barrierRow()] }), SLUGS);

    expect(entry.barriers[0]?.barrierSlug).toBe('unskippable-high-apm-qte');
    expect(entry.barriers[0]?.impactsTaxonomyIds).toEqual([
      'full-input-remapping',
      'large-clear-subtitles',
    ]);
  });

  it('refuses to export a claim without real provenance', () => {
    expect(() =>
      mapEntry(entryRow({ claims: [claimRow({ sourceUrl: '' })] }), SLUGS),
    ).toThrow(MissingProvenanceError);
  });

  it('refuses to export a claim sourced from a placeholder host', () => {
    expect(() =>
      mapEntry(
        entryRow({ claims: [claimRow({ sourceUrl: 'https://example.com/x' })] }),
        SLUGS,
      ),
    ).toThrow(MissingProvenanceError);
  });

  it('refuses to export a barrier without real provenance', () => {
    expect(() =>
      mapEntry(entryRow({ barriers: [barrierRow({ sourceUrl: '' })] }), SLUGS),
    ).toThrow(MissingProvenanceError);
  });

  it('refuses to export a recipe with no steps', () => {
    expect(() =>
      mapEntry(entryRow({ recipes: [recipeRow({ steps: [] })] }), SLUGS),
    ).toThrow(ExportIntegrityError);
  });

  it('refuses to export a dangling taxonomy reference', () => {
    expect(() =>
      mapEntry(
        entryRow({ recipes: [recipeRow({ addressesTaxonomyIds: ['tax-ghost'] })] }),
        SLUGS,
      ),
    ).toThrow(ExportIntegrityError);
  });

  it('carries the content hash and archive url into the corpus', () => {
    // Without these the published claim points at an address that may 404, and
    // nobody can check what it said when it was read.
    const entry = mapEntry(
      entryRow({
        claims: [
          claimRow({
            contentHash: 'a'.repeat(64),
            archiveUrl: 'https://web.archive.org/web/20260601000000/https://publisher.test/x',
          }),
        ],
        barriers: [barrierRow({ contentHash: 'b'.repeat(64), archiveUrl: 'https://web.archive.org/web/20260615000000/https://reviewer.test/y' })],
      }),
      SLUGS,
    );

    expect(entry.claims[0]?.contentHash).toBe('a'.repeat(64));
    expect(entry.claims[0]?.archiveUrl).toContain('web.archive.org');
    expect(entry.barriers[0]?.contentHash).toBe('b'.repeat(64));
    expect(entry.barriers[0]?.archiveUrl).toContain('web.archive.org');
  });

  it('surfaces the archive url as evidence the UI can link to', () => {
    const entry = mapEntry(
      entryRow({
        claims: [
          claimRow({
            archiveUrl: 'https://web.archive.org/web/20260601000000/https://publisher.test/x',
            contentHash: 'c'.repeat(64),
          }),
        ],
      }),
      SLUGS,
    );

    const verdict = evaluate(
      { id: 'p', needs: [{ taxonomyId: 'large-clear-subtitles', severity: 'BLOCKER' }] },
      entry,
      { now: new Date('2026-07-29T00:00:00.000Z') },
    );

    expect(verdict.reasons[0]?.evidence[0]?.archiveUrl).toContain('web.archive.org');
    expect(verdict.reasons[0]?.evidence[0]?.contentHash).toBe('c'.repeat(64));
  });

  it('omits optional fields rather than emitting nulls', () => {
    const entry = mapEntry(entryRow(), SLUGS);

    expect('coverUrl' in entry).toBe(false);
    expect('releaseDate' in entry).toBe(false);
    expect('note' in (entry.claims[0] ?? {})).toBe(false);
  });

  it('emits optional fields when present', () => {
    const entry = mapEntry(
      entryRow({
        game: {
          id: 'game-1',
          igdbId: 1,
          name: 'G',
          coverUrl: 'https://cdn.test/cover.jpg',
          releaseDate: new Date('2024-03-01T00:00:00.000Z'),
        },
        claims: [claimRow({ note: 'Adjustable.', verifiedBy: 'curator', verifiedAt: new Date('2026-06-02T00:00:00.000Z') })],
        recipes: [recipeRow()],
      }),
      SLUGS,
    );

    expect(entry.coverUrl).toBe('https://cdn.test/cover.jpg');
    expect(entry.releaseDate).toBe('2024-03-01T00:00:00.000Z');
    expect(entry.claims[0]?.note).toBe('Adjustable.');
    expect(entry.claims[0]?.verifiedBy).toBe('curator');
    expect(entry.recipes[0]?.steps[0]?.screenshotUrl).toBe(
      'https://cdn.test/step1.png',
    );
  });

  it('serialises dates as ISO strings so the chunk is plain JSON', () => {
    const entry = mapEntry(entryRow({ barriers: [barrierRow()] }), SLUGS);
    const roundTripped = JSON.parse(JSON.stringify(entry)) as typeof entry;

    expect(roundTripped.claims[0]?.capturedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(roundTripped.barriers[0]?.capturedAt).toBe('2026-06-15T00:00:00.000Z');
    expect(roundTripped).toEqual(entry);
  });
});

describe('chunking', () => {
  const entry = (id: string) => ({ ...mapEntry(entryRow(), SLUGS), gameId: id });

  it('splits entries into fixed-size chunks preserving order', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map(entry);
    const chunks = chunkEntries(entries, 2);

    expect(chunks.map((c) => c.length)).toEqual([2, 2, 1]);
    expect(chunks.flat().map((e) => e.gameId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns no chunks for an empty corpus', () => {
    expect(chunkEntries([], 10)).toEqual([]);
  });

  it('rejects a chunk size below 1', () => {
    expect(() => chunkEntries([entry('a')], 0)).toThrow(ExportIntegrityError);
  });

  it('names chunks stably and sortably', () => {
    expect(chunkId(0)).toBe('games-0001');
    expect(chunkId(11)).toBe('games-0012');
  });

  it('pins the format version so clients can detect a breaking change', () => {
    expect(CHUNK_FORMAT_VERSION).toBe(1);
  });
});
