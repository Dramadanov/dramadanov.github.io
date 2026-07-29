/**
 * The static corpus format.
 *
 * This is the contract between the authoring database and the public site.
 * Postgres is never on the request path (plan §3): the read side ships as
 * versioned JSON chunks that the browser downloads once and matches against
 * locally. That is what keeps hosting free at any traffic level, and what makes
 * the site work with the database down — or gone.
 *
 * Two rules hold this together:
 *
 * 1. `ExportedEntry extends GameWithClaims`, so what we publish is exactly what
 *    `evaluate()` consumes. The compiler enforces it; there is no adapter layer
 *    to drift.
 * 2. Everything is keyed by **slug, never by database id**. A player's profile
 *    lives in localStorage and in the fragment of a share link, potentially for
 *    years. If it referenced cuids, rebuilding the database from scratch would
 *    silently invalidate every profile and share link in existence.
 */
import type { GameWithClaims } from '@access-profile/match';

/** Bump when the chunk shape changes incompatibly. Clients check this. */
export const CHUNK_FORMAT_VERSION = 1;

/** Entries per chunk. One request per chunk, so keep them modest. */
export const DEFAULT_CHUNK_SIZE = 250;

/**
 * One (game, platform) pair, ready to hand straight to the match engine.
 * Extending GameWithClaims is the compile-time proof of that.
 */
export interface ExportedEntry extends GameWithClaims {
  /** Required here, unlike on GameWithClaims. */
  name: string;
  igdbId: number;
  platformSlug: string;
  coverUrl?: string;
  releaseDate?: string;
}

export interface ExportedTaxonomyTag {
  slug: string;
  label: string;
  description: string;
  category: string;
  source: string;
  sourceUrl: string;
  capturedAt: string;
}

export interface ExportedBarrierTag {
  slug: string;
  label: string;
  description: string;
  category: string;
  /** Feature-taxonomy slugs this barrier type obstructs. */
  impactsTaxonomySlugs: string[];
  sourceUrl: string;
  capturedAt: string;
}

export interface ChunkRef {
  id: string;
  path: string;
  entryCount: number;
  /** Integrity hash of the chunk file as written. */
  sha256: string;
}

export interface CorpusChunk {
  formatVersion: number;
  id: string;
  entries: ExportedEntry[];
}

export interface CorpusManifest {
  formatVersion: number;
  generatedAt: string;
  /** Hash over every chunk hash — changes iff the corpus changed. */
  corpusVersion: string;
  entryCount: number;
  /** The vocabularies ship with the corpus so the UI can label needs offline. */
  taxonomy: ExportedTaxonomyTag[];
  barrierTaxonomy: ExportedBarrierTag[];
  chunks: ChunkRef[];
}
