import type { ClaimState, Evidence, FeatureClaim, TaxonomyId } from './types.js';

export interface ResolvedClaim {
  taxonomyId: TaxonomyId;
  state: ClaimState;
  /** Trust tier of the claims that decided the state. 0 when there is no data. */
  tier: number;
  /**
   * Capture date of the freshest claim that decided this state. Undefined when
   * nothing decided it. Trust tells you who looked; this tells you when — and a
   * game patched forty times since is a different game.
   */
  decidedAt?: string;
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
  if (claim.archiveUrl !== undefined) evidence.archiveUrl = claim.archiveUrl;
  if (claim.contentHash !== undefined) evidence.contentHash = claim.contentHash;
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
  const decidedAt = newestCapture(atTopTier);

  if (distinctStates.length === 1) {
    const state = distinctStates[0] as ClaimState;
    const resolved: ResolvedClaim = { taxonomyId, state, tier: topTier, evidence };
    if (decidedAt !== undefined) resolved.decidedAt = decidedAt;
    return resolved;
  }

  const resolved: ResolvedClaim = {
    taxonomyId,
    state: 'PARTIAL',
    tier: topTier,
    evidence,
    conflict: { tier: topTier, states: distinctStates },
  };
  if (decidedAt !== undefined) resolved.decidedAt = decidedAt;
  return resolved;
}

/**
 * The freshest capture among the claims that decided the state. If two sources
 * agree, the more recent look is what the age of the finding should be judged on.
 */
function newestCapture(claims: readonly FeatureClaim[]): string | undefined {
  let newest: string | undefined;
  let newestMs = Number.NEGATIVE_INFINITY;

  for (const claim of claims) {
    const ms = Date.parse(claim.capturedAt);
    if (Number.isNaN(ms)) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = claim.capturedAt;
    }
  }

  // Claims decided this but none of them carry a usable date. Hand back the
  // unparseable value rather than undefined: "dated, illegibly" and "no claim at
  // all" must stay distinguishable, because the first should cost confidence and
  // the second should not.
  return newest ?? claims[0]?.capturedAt;
}
