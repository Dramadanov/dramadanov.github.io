import type { Confidence, SourceKind } from './types.js';

/**
 * The trust ladder from plan §5:
 *   first-party testing > publisher/storefront > established reviewer > community
 *
 * Persisted as Source.trustTier so it can be tuned per-source without a code
 * change; this map is the default used when seeding a source row.
 */
export const DEFAULT_TRUST_TIER: Record<SourceKind, number> = {
  FIRSTPARTY_TEST: 4,
  PUBLISHER: 3,
  STOREFRONT: 3,
  REVIEWER: 2,
  COMMUNITY: 1,
};

export function defaultTrustTier(kind: SourceKind): number {
  return DEFAULT_TRUST_TIER[kind];
}

/**
 * Confidence is derived from the *weakest* source backing any decisive claim.
 * Four trust ranks collapse onto three confidence levels.
 */
export function confidenceFromTier(tier: number): Confidence {
  if (tier >= 3) return 'HIGH';
  if (tier === 2) return 'MEDIUM';
  return 'LOW';
}

const CONFIDENCE_RANK: Record<Confidence, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** Returns the more pessimistic of two confidence levels. */
export function weakestConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}
