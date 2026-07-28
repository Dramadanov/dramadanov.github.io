import type { ClaimState, Evidence, FeatureClaim, TaxonomyId } from './types.js';

export interface ResolvedClaim {
  taxonomyId: TaxonomyId;
  state: ClaimState;
  /** Trust tier of the claims that decided the state. 0 when there is no data. */
  tier: number;
  evidence: Evidence[];
  conflict?: {
    tier: number;
    states: ClaimState[];
  };
}

function toEvidence(claim: FeatureClaim): Evidence {
  const evidence: Evidence = {
    sourceId: claim.source.id,
    sourceName: claim.source.name,
    sourceKind: claim.source.kind,
    trustTier: claim.source.trustTier,
    sourceUrl: claim.sourceUrl,
    capturedAt: claim.capturedAt,
    claimState: claim.state,
  };
  if (claim.note !== undefined) evidence.note = claim.note;
  return evidence;
}

/**
 * Collapse every claim for one taxonomy id into a single state.
 *
 * Rules (plan §5):
 *  - An explicit UNVERIFIED claim means "nobody checked", not "we found nothing".
 *    It never outranks a real observation, so those claims are set aside unless
 *    they are all we have.
 *  - Conflicting claims resolve to the higher trust tier.
 *  - A tie between contradictory claims at the same tier resolves to PARTIAL,
 *    with both notes surfaced.
 */
export function resolveClaims(
  taxonomyId: TaxonomyId,
  claims: readonly FeatureClaim[],
): ResolvedClaim {
  const forNeed = claims.filter((c) => c.taxonomyId === taxonomyId);

  if (forNeed.length === 0) {
    return { taxonomyId, state: 'UNVERIFIED', tier: 0, evidence: [] };
  }

  const substantive = forNeed.filter((c) => c.state !== 'UNVERIFIED');

  if (substantive.length === 0) {
    return {
      taxonomyId,
      state: 'UNVERIFIED',
      tier: 0,
      evidence: forNeed.map(toEvidence),
    };
  }

  const topTier = Math.max(...substantive.map((c) => c.source.trustTier));
  const atTopTier = substantive.filter((c) => c.source.trustTier === topTier);
  const distinctStates = [...new Set(atTopTier.map((c) => c.state))];

  // All the evidence is surfaced, not just the winning claims — the UI has to be
  // able to show a reader why a lower-tier contradiction was set aside.
  const evidence = forNeed.map(toEvidence);

  if (distinctStates.length === 1) {
    const state = distinctStates[0] as ClaimState;
    return { taxonomyId, state, tier: topTier, evidence };
  }

  return {
    taxonomyId,
    state: 'PARTIAL',
    tier: topTier,
    evidence,
    conflict: { tier: topTier, states: distinctStates },
  };
}
