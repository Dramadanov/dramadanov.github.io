/**
 * Pure mapping from database rows to corpus entries.
 *
 * Deliberately free of Prisma and the filesystem so it can be tested exhaustively
 * without a database. `build.ts` supplies the I/O.
 */
import type {
  Barrier,
  ClaimState,
  FeatureClaim,
  SettingsRecipe,
  SourceKind,
} from '@access-profile/match';
import { requireProvenance } from '../seed/guard.js';
import type { ExportedEntry } from './types.js';

export interface DbClaimRow {
  id: string;
  taxonomy: { slug: string };
  state: ClaimState;
  note: string | null;
  source: { id: string; name: string; kind: SourceKind; trustTier: number };
  sourceUrl: string;
  capturedAt: Date;
  verifiedBy: string | null;
  verifiedAt: Date | null;
}

export interface DbBarrierRow {
  id: string;
  barrierTaxonomy: {
    slug: string;
    impacts: Array<{ taxonomy: { slug: string } }>;
  };
  severity: 'HARD' | 'SITUATIONAL';
  description: string;
  workaroundRecipeId: string | null;
  sourceUrl: string;
  capturedAt: Date;
}

export interface DbRecipeStepRow {
  id: string;
  order: number;
  menuPath: string;
  action: string;
  note: string | null;
  screenshotUrl: string | null;
}

export interface DbRecipeRow {
  id: string;
  title: string;
  summary: string;
  gameVersion: string;
  verifiedAt: Date;
  verifiedBy: string;
  staleAt: Date;
  /** Taxonomy ids (cuids) — resolved to slugs on the way out. */
  addressesTaxonomyIds: string[];
  published: boolean;
  steps: DbRecipeStepRow[];
}

export interface DbEntryRow {
  game: {
    id: string;
    igdbId: number;
    name: string;
    coverUrl: string | null;
    releaseDate: Date | null;
  };
  platform: { id: string; slug: string };
  claims: DbClaimRow[];
  barriers: DbBarrierRow[];
  recipes: DbRecipeRow[];
}

export class ExportIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportIntegrityError';
  }
}

function resolveSlug(
  taxonomySlugById: ReadonlyMap<string, string>,
  taxonomyId: string,
  context: string,
): string {
  const slug = taxonomySlugById.get(taxonomyId);
  if (slug === undefined) {
    throw new ExportIntegrityError(
      `${context} references taxonomy id ${taxonomyId}, which is not in the taxonomy. ` +
        `Refusing to publish a corpus with dangling references.`,
    );
  }
  return slug;
}

function mapClaim(row: DbClaimRow, gameName: string): FeatureClaim {
  // A claim without real provenance must never reach the public corpus.
  const { sourceUrl, capturedAt } = requireProvenance(
    `claim on "${gameName}" for "${row.taxonomy.slug}"`,
    { sourceUrl: row.sourceUrl, capturedAt: row.capturedAt },
  );

  const claim: FeatureClaim = {
    id: row.id,
    taxonomyId: row.taxonomy.slug,
    state: row.state,
    source: {
      id: row.source.id,
      name: row.source.name,
      kind: row.source.kind,
      trustTier: row.source.trustTier,
    },
    sourceUrl,
    capturedAt: capturedAt.toISOString(),
  };

  if (row.note !== null) claim.note = row.note;
  if (row.verifiedBy !== null) claim.verifiedBy = row.verifiedBy;
  if (row.verifiedAt !== null) claim.verifiedAt = row.verifiedAt.toISOString();

  return claim;
}

function mapRecipe(
  row: DbRecipeRow,
  taxonomySlugById: ReadonlyMap<string, string>,
  gameName: string,
): SettingsRecipe {
  if (row.steps.length === 0) {
    throw new ExportIntegrityError(
      `Recipe "${row.title}" on "${gameName}" has no steps. A recipe with no ` +
        `steps tells a player nothing and must not be published.`,
    );
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    gameVersion: row.gameVersion,
    verifiedAt: row.verifiedAt.toISOString(),
    verifiedBy: row.verifiedBy,
    staleAt: row.staleAt.toISOString(),
    addressesTaxonomyIds: row.addressesTaxonomyIds.map((id) =>
      resolveSlug(taxonomySlugById, id, `Recipe "${row.title}"`),
    ),
    steps: [...row.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => {
        const mapped: SettingsRecipe['steps'][number] = {
          id: step.id,
          order: step.order,
          menuPath: step.menuPath,
          action: step.action,
        };
        if (step.note !== null) mapped.note = step.note;
        if (step.screenshotUrl !== null) mapped.screenshotUrl = step.screenshotUrl;
        return mapped;
      }),
  };
}

function mapBarrier(
  row: DbBarrierRow,
  publishedRecipeIds: ReadonlySet<string>,
  gameName: string,
): Barrier {
  const { sourceUrl, capturedAt } = requireProvenance(
    `barrier "${row.barrierTaxonomy.slug}" on "${gameName}"`,
    { sourceUrl: row.sourceUrl, capturedAt: row.capturedAt },
  );

  const barrier: Barrier = {
    id: row.id,
    barrierSlug: row.barrierTaxonomy.slug,
    impactsTaxonomyIds: row.barrierTaxonomy.impacts.map((i) => i.taxonomy.slug),
    severity: row.severity,
    description: row.description,
    sourceUrl,
    capturedAt: capturedAt.toISOString(),
  };

  // A workaround only counts if the recipe actually ships. Pointing at an
  // unpublished recipe would let the engine treat a HARD barrier as neutralised
  // by something the player can never read.
  if (
    row.workaroundRecipeId !== null &&
    publishedRecipeIds.has(row.workaroundRecipeId)
  ) {
    barrier.workaroundRecipeId = row.workaroundRecipeId;
  }

  return barrier;
}

/**
 * Map one (game, platform) row into a corpus entry.
 *
 * Throws rather than skipping on integrity problems: a corpus that quietly drops
 * rows is harder to debug than a build that fails.
 */
export function mapEntry(
  row: DbEntryRow,
  taxonomySlugById: ReadonlyMap<string, string>,
): ExportedEntry {
  const gameName = row.game.name;

  // Nothing publishes unverified (plan §6, Phase 5).
  const publishedRecipes = row.recipes.filter((r) => r.published);
  const publishedRecipeIds = new Set(publishedRecipes.map((r) => r.id));

  const entry: ExportedEntry = {
    gameId: row.game.id,
    igdbId: row.game.igdbId,
    name: gameName,
    platformId: row.platform.id,
    platformSlug: row.platform.slug,
    claims: row.claims.map((c) => mapClaim(c, gameName)),
    barriers: row.barriers.map((b) =>
      mapBarrier(b, publishedRecipeIds, gameName),
    ),
    recipes: publishedRecipes.map((r) =>
      mapRecipe(r, taxonomySlugById, gameName),
    ),
  };

  if (row.game.coverUrl !== null) entry.coverUrl = row.game.coverUrl;
  if (row.game.releaseDate !== null) {
    entry.releaseDate = row.game.releaseDate.toISOString();
  }

  return entry;
}

/** Split entries into fixed-size chunks, preserving order. */
export function chunkEntries(
  entries: readonly ExportedEntry[],
  chunkSize: number,
): ExportedEntry[][] {
  if (chunkSize < 1) {
    throw new ExportIntegrityError(`chunkSize must be at least 1, got ${chunkSize}`);
  }
  const chunks: ExportedEntry[][] = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  return chunks;
}

export function chunkId(index: number): string {
  return `games-${String(index + 1).padStart(4, '0')}`;
}
