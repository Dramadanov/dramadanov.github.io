/**
 * End-to-end check of the export I/O path.
 *
 * The mapper is unit-tested without a database; this exercises everything the
 * unit tests cannot — the Prisma queries, the joins, the file writing and the
 * hashing — by seeding a fixture, running the real exporter, and reading the
 * JSON back off disk.
 *
 * Run with: pnpm --filter @access-profile/db verify:export
 *
 * The fixture is deliberately, visibly fictional. It is not a claim about any
 * real game, and it must never end up in an authoring database — hence the
 * emptiness guard below, which refuses to run anywhere that already has data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate } from '@access-profile/match';
import { PrismaClient } from '../../generated/client/client.js';
import { buildCorpus } from './build.js';
import type { CorpusChunk } from './types.js';

const FIXTURE_IGDB_ID = 999_001;

async function assertDatabaseIsEmpty(prisma: PrismaClient): Promise<void> {
  const [games, taxonomy] = await Promise.all([
    prisma.game.count(),
    prisma.featureTaxonomy.count(),
  ]);

  if (games > 0 || taxonomy > 0) {
    throw new Error(
      `Refusing to run: this database already holds ${games} game(s) and ` +
        `${taxonomy} taxonomy row(s). This script writes fictional fixture data ` +
        `and is only ever meant to run against a throwaway database.`,
    );
  }
}

async function seedFixture(prisma: PrismaClient): Promise<void> {
  const captions = await prisma.featureTaxonomy.create({
    data: {
      slug: 'fixture-captions',
      label: 'Fixture Captions',
      description: 'Fictional tag used to verify the export path.',
      category: 'AUDITORY',
      source: 'EXTENDED',
      sourceUrl: 'https://fixtures.test/tags/captions',
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
      contentHash: 'a'.repeat(64),
      archiveUrl: 'https://web.archive.org/web/20260701000000/https://fixtures.test/tags/captions',
    },
  });

  const oneHanded = await prisma.featureTaxonomy.create({
    data: {
      slug: 'fixture-one-handed',
      label: 'Fixture One-Handed Play',
      description: 'Fictional tag used to verify the export path.',
      category: 'MOTOR',
      source: 'EXTENDED',
      sourceUrl: 'https://fixtures.test/tags/one-handed',
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
  });

  const qte = await prisma.barrierTaxonomy.create({
    data: {
      slug: 'fixture-unskippable-qte',
      label: 'Fixture Unskippable QTE',
      description: 'Fictional barrier used to verify the export path.',
      category: 'MOTOR',
      sourceUrl: 'https://fixtures.test/barriers/qte',
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
      impacts: { create: [{ taxonomyId: oneHanded.id }] },
    },
  });

  const source = await prisma.source.create({
    data: { name: 'Fixture publisher', kind: 'PUBLISHER', trustTier: 3 },
  });

  const game = await prisma.game.create({
    data: { igdbId: FIXTURE_IGDB_ID, name: 'Fixture Quest (not a real game)' },
  });
  const platform = await prisma.platform.create({
    data: { slug: 'pc-steam', name: 'PC (Steam)' },
  });
  await prisma.gamePlatform.create({
    data: { gameId: game.id, platformId: platform.id },
  });

  await prisma.featureClaim.create({
    data: {
      gameId: game.id,
      platformId: platform.id,
      taxonomyId: captions.id,
      state: 'PRESENT',
      sourceId: source.id,
      sourceUrl: 'https://fixtures.test/games/quest/accessibility',
      capturedAt: new Date('2026-06-01T00:00:00.000Z'),
      contentHash: 'b'.repeat(64),
      archiveUrl:
        'https://web.archive.org/web/20260601000000/https://fixtures.test/games/quest/accessibility',
    },
  });

  await prisma.settingsRecipe.create({
    data: {
      gameId: game.id,
      platformId: platform.id,
      title: 'Enable one-handed control scheme',
      summary: 'Three toggles.',
      gameVersion: '1.4.2',
      verifiedAt: new Date('2026-07-01T00:00:00.000Z'),
      verifiedBy: 'fixture-curator',
      staleAt: new Date('2026-12-28T00:00:00.000Z'),
      addressesTaxonomyIds: [oneHanded.id],
      published: true,
      steps: {
        create: [
          { order: 2, menuPath: 'Options > Controls', action: 'Select One-Handed preset' },
          { order: 1, menuPath: 'Options > Accessibility', action: 'Enable Auto-QTE' },
        ],
      },
    },
  });

  // Unpublished, and pointed at by the barrier below. Neither may reach the corpus.
  const draft = await prisma.settingsRecipe.create({
    data: {
      gameId: game.id,
      platformId: platform.id,
      title: 'Draft workaround',
      summary: 'Not yet verified.',
      gameVersion: '1.4.2',
      verifiedAt: new Date('2026-07-01T00:00:00.000Z'),
      verifiedBy: 'fixture-curator',
      staleAt: new Date('2026-12-28T00:00:00.000Z'),
      addressesTaxonomyIds: [oneHanded.id],
      published: false,
      steps: { create: [{ order: 1, menuPath: 'X', action: 'Y' }] },
    },
  });

  await prisma.barrier.create({
    data: {
      gameId: game.id,
      platformId: platform.id,
      barrierTaxonomyId: qte.id,
      severity: 'HARD',
      description: 'Unskippable QTE requiring 8 inputs per second.',
      workaroundRecipeId: draft.id,
      sourceUrl: 'https://fixtures.test/games/quest/barriers',
      capturedAt: new Date('2026-06-15T00:00:00.000Z'),
    },
  });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const outDir = await mkdtemp(join(tmpdir(), 'corpus-verify-'));
  const checks: string[] = [];

  try {
    await assertDatabaseIsEmpty(prisma);
    await seedFixture(prisma);

    const { manifest } = await buildCorpus(prisma, outDir);

    assert.equal(manifest.formatVersion, 1, 'format version');
    assert.equal(manifest.entryCount, 1, 'one game/platform entry');
    assert.equal(manifest.chunks.length, 1, 'one chunk');
    assert.equal(manifest.taxonomy.length, 2, 'two feature tags');
    assert.equal(manifest.barrierTaxonomy.length, 1, 'one barrier tag');
    checks.push('manifest shape');

    const tag = manifest.taxonomy.find((t) => t.slug === 'fixture-captions');
    assert.ok(tag?.archiveUrl?.includes('web.archive.org'), 'taxonomy archive url');
    assert.equal(tag?.contentHash, 'a'.repeat(64), 'taxonomy content hash');
    checks.push('vocabulary provenance carried');

    assert.deepEqual(
      manifest.barrierTaxonomy[0]?.impactsTaxonomySlugs,
      ['fixture-one-handed'],
      'barrier impact mapping',
    );
    checks.push('barrier vocabulary mapping');

    const chunkRef = manifest.chunks[0];
    assert.ok(chunkRef, 'chunk ref present');
    const chunkPath = join(outDir, chunkRef.path);
    const chunkText = await readFile(chunkPath, 'utf8');

    assert.equal(
      createHash('sha256').update(chunkText, 'utf8').digest('hex'),
      chunkRef.sha256,
      'chunk hash matches the bytes on disk',
    );
    checks.push('chunk integrity hash');

    const chunk = JSON.parse(chunkText) as CorpusChunk;
    const entry = chunk.entries[0];
    assert.ok(entry, 'entry present');

    assert.equal(entry.name, 'Fixture Quest (not a real game)');
    assert.equal(entry.platformSlug, 'pc-steam');
    assert.equal(entry.claims[0]?.taxonomyId, 'fixture-captions', 'claims keyed by slug');
    assert.equal(
      entry.recipes[0]?.addressesTaxonomyIds[0],
      'fixture-one-handed',
      'recipes keyed by slug',
    );
    assert.equal(
      entry.barriers[0]?.impactsTaxonomyIds[0],
      'fixture-one-handed',
      'barriers keyed by slug',
    );
    checks.push('everything keyed by slug, not cuid');

    assert.equal(entry.recipes.length, 1, 'unpublished recipe excluded');
    assert.equal(
      entry.barriers[0]?.workaroundRecipeId,
      undefined,
      'workaround pointing at an unpublished recipe is dropped',
    );
    checks.push('unpublished recipes never ship');

    assert.deepEqual(
      entry.recipes[0]?.steps.map((s) => s.order),
      [1, 2],
      'recipe steps ordered',
    );
    checks.push('recipe steps ordered');

    assert.equal(entry.claims[0]?.contentHash, 'b'.repeat(64), 'claim content hash');
    assert.ok(entry.claims[0]?.archiveUrl?.includes('web.archive.org'), 'claim archive url');
    checks.push('claim provenance carried');

    // The whole point: exported JSON feeds the engine with no adapter.
    const verdict = evaluate(
      {
        id: 'verify',
        needs: [
          { taxonomyId: 'fixture-captions', severity: 'BLOCKER' },
          { taxonomyId: 'fixture-one-handed', severity: 'BLOCKER' },
        ],
      },
      entry,
      { now: new Date('2026-07-29T00:00:00.000Z') },
    );

    assert.equal(
      verdict.outcome,
      'NOT_PLAYABLE',
      'hard barrier with no shipped workaround gates the verdict',
    );
    assert.ok(
      verdict.reasons.some((r) => r.evidence.some((e) => e.archiveUrl !== undefined)),
      'archive url reaches the verdict as evidence',
    );
    checks.push('exported JSON drives the match engine unchanged');

    // Same data in, same chunk bytes out.
    const second = await buildCorpus(prisma, join(outDir, 'again'));
    assert.equal(
      second.manifest.corpusVersion,
      manifest.corpusVersion,
      'corpus version is stable across runs',
    );
    checks.push('export is deterministic');

    for (const check of checks) console.log(`  ok  ${check}`);
    console.log(`\nExport verified end to end (${checks.length} checks).`);
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
