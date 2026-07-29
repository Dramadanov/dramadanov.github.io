/**
 * Build the static corpus from the authoring database.
 *
 * Run with: pnpm --filter @access-profile/db export:corpus [outDir]
 *
 * This is the only bridge between Postgres and the public site. It runs at build
 * time, writes plain JSON, and is the reason the database is never on the request
 * path. Output is deterministic apart from `generatedAt`: same data in, byte-identical
 * chunks out, so `corpusVersion` only changes when the corpus actually changes.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PrismaClient } from '../../generated/client/client.js';
import { chunkEntries, chunkId, mapEntry, type DbEntryRow } from './map.js';
import {
  CHUNK_FORMAT_VERSION,
  DEFAULT_CHUNK_SIZE,
  type ChunkRef,
  type CorpusChunk,
  type CorpusManifest,
  type ExportedBarrierTag,
  type ExportedEntry,
  type ExportedTaxonomyTag,
} from './types.js';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Stable JSON: sorted keys, so hashes are reproducible across runs. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) return val;
    const record = val as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, record[key]]),
    );
  });
}

export interface BuildResult {
  manifest: CorpusManifest;
  files: string[];
}

export async function buildCorpus(
  prisma: PrismaClient,
  outDir: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<BuildResult> {
  const taxonomyRows = await prisma.featureTaxonomy.findMany({
    orderBy: { slug: 'asc' },
  });

  const taxonomySlugById = new Map(taxonomyRows.map((t) => [t.id, t.slug]));

  const taxonomy: ExportedTaxonomyTag[] = taxonomyRows.map((t) => {
    const tag: ExportedTaxonomyTag = {
      slug: t.slug,
      label: t.label,
      description: t.description,
      category: t.category,
      source: t.source,
      sourceUrl: t.sourceUrl,
      capturedAt: t.capturedAt.toISOString(),
    };
    if (t.archiveUrl !== null) tag.archiveUrl = t.archiveUrl;
    if (t.contentHash !== null) tag.contentHash = t.contentHash;
    return tag;
  });

  const barrierRows = await prisma.barrierTaxonomy.findMany({
    orderBy: { slug: 'asc' },
    include: { impacts: { include: { taxonomy: true } } },
  });

  const barrierTaxonomy: ExportedBarrierTag[] = barrierRows.map((b) => {
    const tag: ExportedBarrierTag = {
      slug: b.slug,
      label: b.label,
      description: b.description,
      category: b.category,
      impactsTaxonomySlugs: b.impacts.map((i) => i.taxonomy.slug).sort(),
      sourceUrl: b.sourceUrl,
      capturedAt: b.capturedAt.toISOString(),
    };
    if (b.archiveUrl !== null) tag.archiveUrl = b.archiveUrl;
    if (b.contentHash !== null) tag.contentHash = b.contentHash;
    return tag;
  });

  // One entry per (game, platform) pair — the unit the match engine evaluates.
  const pairs = await prisma.gamePlatform.findMany({
    include: { game: true, platform: true },
    orderBy: [{ gameId: 'asc' }, { platformId: 'asc' }],
  });

  const entries: ExportedEntry[] = [];

  for (const pair of pairs) {
    const [claims, barriers, recipes] = await Promise.all([
      prisma.featureClaim.findMany({
        where: { gameId: pair.gameId, platformId: pair.platformId },
        include: { taxonomy: true, source: true },
        orderBy: { id: 'asc' },
      }),
      prisma.barrier.findMany({
        where: { gameId: pair.gameId, platformId: pair.platformId },
        include: {
          barrierTaxonomy: { include: { impacts: { include: { taxonomy: true } } } },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.settingsRecipe.findMany({
        where: { gameId: pair.gameId, platformId: pair.platformId },
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { id: 'asc' },
      }),
    ]);

    const row: DbEntryRow = {
      game: pair.game,
      platform: pair.platform,
      claims,
      barriers,
      recipes,
    };

    entries.push(mapEntry(row, taxonomySlugById));
  }

  const chunks = chunkEntries(entries, chunkSize);
  const chunkRefs: ChunkRef[] = [];
  const files: string[] = [];

  for (const [index, chunkEntriesList] of chunks.entries()) {
    const id = chunkId(index);
    const relativePath = join('chunks', `${id}.json`);
    const body: CorpusChunk = {
      formatVersion: CHUNK_FORMAT_VERSION,
      id,
      entries: chunkEntriesList,
    };
    const text = canonicalJson(body);
    const absolutePath = join(outDir, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text, 'utf8');

    chunkRefs.push({
      id,
      path: relativePath,
      entryCount: chunkEntriesList.length,
      sha256: sha256(text),
    });
    files.push(absolutePath);
  }

  const manifest: CorpusManifest = {
    formatVersion: CHUNK_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    corpusVersion: sha256(chunkRefs.map((c) => c.sha256).join('\n')),
    entryCount: entries.length,
    taxonomy,
    barrierTaxonomy,
    chunks: chunkRefs,
  };

  const manifestPath = join(outDir, 'manifest.json');
  await mkdir(outDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  files.push(manifestPath);

  return { manifest, files };
}

async function main(): Promise<void> {
  const outDir = process.argv[2] ?? 'dist/corpus';
  const prisma = new PrismaClient();

  try {
    const { manifest, files } = await buildCorpus(prisma, outDir);
    console.log(
      `Exported ${manifest.entryCount} game/platform entries across ` +
        `${manifest.chunks.length} chunk(s) to ${outDir}`,
    );
    console.log(`Corpus version: ${manifest.corpusVersion.slice(0, 12)}`);
    console.log(
      `Taxonomy: ${manifest.taxonomy.length} feature tags, ` +
        `${manifest.barrierTaxonomy.length} barrier tags`,
    );
    if (manifest.taxonomy.length === 0) {
      console.warn(
        '\nWarning: the feature taxonomy is empty, so this corpus cannot express ' +
          'any need. See docs/BLOCKED.md.',
      );
    }
    for (const file of files) console.log(`  ${file}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('build.ts')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
