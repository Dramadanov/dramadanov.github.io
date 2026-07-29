import { resolveClaims, type ResolvedClaim } from './resolve.js';
import { confidenceFromTier, weakestConfidence } from './trust.js';
import type {
  BarrierRef,
  Confidence,
  EvaluateOptions,
  GameWithClaims,
  Profile,
  ProfileNeed,
  Reason,
  ReasonStatus,
  VerdictWarning,
  SettingsRecipe,
  TaxonomyId,
  Verdict,
} from './types.js';

/** Plan §2.5: a recipe goes stale 180 days after it was verified. */
export const DEFAULT_STALE_AFTER_DAYS = 180;

/**
 * Claims decay more slowly than recipes. A recipe's menu paths move with every
 * patch; a game that shipped captions usually still has them. But "usually" is
 * not "verifiably", and a first-party test from four years ago should not be
 * presented with the same confidence as one from last month.
 */
export const DEFAULT_CLAIM_MEDIUM_AFTER_DAYS = 365;
export const DEFAULT_CLAIM_LOW_AFTER_DAYS = 730;

const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(capturedAt: string, now: Date): number | undefined {
  const captured = Date.parse(capturedAt);
  if (Number.isNaN(captured)) return undefined;
  return Math.floor((now.getTime() - captured) / DAY_MS);
}

interface NeedAnalysis {
  need: ProfileNeed;
  resolved: ResolvedClaim;
  barriers: BarrierRef[];
  /** HARD barriers with no workaround recipe — these gate. */
  gatingBarriers: BarrierRef[];
  recipes: SettingsRecipe[];
  status: ReasonStatus;
}

function recipeStaleAt(recipe: SettingsRecipe, staleAfterDays: number): number {
  if (recipe.staleAt !== undefined) return Date.parse(recipe.staleAt);
  return Date.parse(recipe.verifiedAt) + staleAfterDays * DAY_MS;
}

function isStale(
  recipe: SettingsRecipe,
  now: Date,
  staleAfterDays: number,
): boolean {
  const staleAt = recipeStaleAt(recipe, staleAfterDays);
  if (Number.isNaN(staleAt)) return true; // unparseable date — assume the worst
  return now.getTime() >= staleAt;
}

function describe(status: ReasonStatus, need: ProfileNeed): string {
  switch (status) {
    case 'MET_AS_SHIPPED':
      return `"${need.taxonomyId}" is present in the game as shipped.`;
    case 'MET_VIA_RECIPE':
      return `"${need.taxonomyId}" is met after applying the settings recipe below.`;
    case 'BLOCKED_BY_BARRIER':
      return `A hard barrier blocks "${need.taxonomyId}" and no workaround recipe exists.`;
    case 'UNMET':
      return `"${need.taxonomyId}" is documented as absent from this game.`;
    case 'PARTIAL':
      return `"${need.taxonomyId}" is only partially supported, and no recipe closes the gap.`;
    case 'NO_DATA':
      return `No sourced data on "${need.taxonomyId}" for this game. Treated as unverified, not absent.`;
  }
}

function analyseNeed(need: ProfileNeed, game: GameWithClaims): NeedAnalysis {
  const resolved = resolveClaims(need.taxonomyId, game.claims);

  const recipes = game.recipes.filter((r) =>
    r.addressesTaxonomyIds.includes(need.taxonomyId),
  );
  const recipeIds = new Set(recipes.map((r) => r.id));

  // A barrier obstructs a need when its own vocabulary entry declares that need
  // among the ones it impacts — barriers are not keyed by feature tag.
  const rawBarriers = game.barriers.filter((b) =>
    b.impactsTaxonomyIds.includes(need.taxonomyId),
  );

  const barriers: BarrierRef[] = rawBarriers.map((b) => ({
    id: b.id,
    barrierSlug: b.barrierSlug,
    severity: b.severity,
    description: b.description,
    sourceUrl: b.sourceUrl,
    capturedAt: b.capturedAt,
    // A workaround only counts if the recipe it names actually exists on this game.
    hasWorkaround:
      b.workaroundRecipeId !== undefined && recipeIds.has(b.workaroundRecipeId),
  }));

  const gatingBarriers = barriers.filter(
    (b) => b.severity === 'HARD' && !b.hasWorkaround,
  );

  const status = classify(resolved, gatingBarriers, barriers, recipes);

  return { need, resolved, barriers, gatingBarriers, recipes, status };
}

function classify(
  resolved: ResolvedClaim,
  gatingBarriers: readonly BarrierRef[],
  barriers: readonly BarrierRef[],
  recipes: readonly SettingsRecipe[],
): ReasonStatus {
  // A hard barrier with no way around it outranks everything, including a
  // PRESENT feature claim: the feature can exist and still not be reachable.
  if (gatingBarriers.length > 0) return 'BLOCKED_BY_BARRIER';

  // A HARD barrier whose named workaround recipe is present is met *via* that
  // recipe, never as shipped.
  const neutralisedBarrier = barriers.some(
    (b) => b.severity === 'HARD' && b.hasWorkaround,
  );
  if (neutralisedBarrier) return 'MET_VIA_RECIPE';

  if (resolved.state === 'PRESENT') return 'MET_AS_SHIPPED';

  // For ABSENT, PARTIAL and UNVERIFIED, a recipe is what closes the gap. A
  // recipe is verified against a named game build by a named person, so it is
  // evidence in its own right — not a guess.
  if (recipes.length > 0) return 'MET_VIA_RECIPE';

  if (resolved.state === 'ABSENT') return 'UNMET';
  if (resolved.state === 'PARTIAL') return 'PARTIAL';
  return 'NO_DATA';
}

/**
 * Evaluate one profile against one game/platform pair.
 *
 * Pure: same inputs always produce the same verdict. `options.now` is injected
 * rather than read from the clock so staleness is deterministic under test.
 *
 * Rule order is exactly plan §5. Blockers are hard gates — there is no
 * weighting, no scoring, and no probabilistic softening anywhere below.
 */
export function evaluate(
  profile: Profile,
  game: GameWithClaims,
  options: EvaluateOptions = {},
): Verdict {
  const now = options.now ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const claimMediumAfterDays =
    options.claimMediumAfterDays ?? DEFAULT_CLAIM_MEDIUM_AFTER_DAYS;
  const claimLowAfterDays =
    options.claimLowAfterDays ?? DEFAULT_CLAIM_LOW_AFTER_DAYS;

  const analyses = profile.needs.map((need) => analyseNeed(need, game));

  const blockers = analyses.filter((a) => a.need.severity === 'BLOCKER');

  // ---- Ordered rules (plan §5) -------------------------------------------
  let outcome: Verdict['outcome'];
  let decisive: NeedAnalysis[];

  // Rule 1: HARD barrier on a blocker need, no workaround recipe.
  const barrierBlocked = blockers.filter(
    (a) => a.status === 'BLOCKED_BY_BARRIER',
  );
  // Rule 2: blocker need whose resolved claim is ABSENT.
  const absentBlocked = blockers.filter((a) => a.status === 'UNMET');
  // Rule 3: blocker need with no usable data. Do not guess.
  const unverifiedBlocked = blockers.filter(
    (a) => a.status === 'NO_DATA' || a.status === 'PARTIAL',
  );
  // Rule 4: anything met only by applying a recipe.
  const recipeMet = analyses.filter((a) => a.status === 'MET_VIA_RECIPE');

  if (barrierBlocked.length > 0 || absentBlocked.length > 0) {
    outcome = 'NOT_PLAYABLE';
    decisive = [...barrierBlocked, ...absentBlocked];
  } else if (unverifiedBlocked.length > 0) {
    outcome = 'UNVERIFIED';
    decisive = unverifiedBlocked;
  } else if (recipeMet.length > 0) {
    outcome = 'PLAYABLE_WITH_CONFIG';
    // Rule 5 still has to hold for everything else, so every met need backs
    // this verdict, not just the recipe-met ones.
    decisive = analyses.filter(
      (a) => a.status === 'MET_VIA_RECIPE' || a.status === 'MET_AS_SHIPPED',
    );
  } else {
    outcome = 'PLAYABLE';
    decisive = analyses.filter((a) => a.status === 'MET_AS_SHIPPED');
  }

  const decisiveSet = new Set(decisive.map((a) => a.need.taxonomyId));

  // ---- Recipes and staleness ---------------------------------------------
  const attachedRecipes: SettingsRecipe[] = [];
  const seenRecipes = new Set<string>();
  for (const analysis of analyses) {
    for (const recipe of analysis.recipes) {
      if (seenRecipes.has(recipe.id)) continue;
      seenRecipes.add(recipe.id);
      attachedRecipes.push(recipe);
    }
  }

  const warnings: VerdictWarning[] = [];
  const staleRecipeIds = new Set<string>();
  for (const recipe of attachedRecipes) {
    if (!isStale(recipe, now, staleAfterDays)) continue;
    staleRecipeIds.add(recipe.id);
    warnings.push({
      kind: 'STALE_RECIPE',
      recipeId: recipe.id,
      detail: `Recipe "${recipe.title}" was verified against ${recipe.gameVersion} on ${recipe.verifiedAt} and is past the ${staleAfterDays}-day freshness window. Menu paths may have moved.`,
    });
  }

  // Warn about ageing evidence wherever it exists; confidence is only capped
  // below where that evidence actually drove the outcome.
  for (const analysis of analyses) {
    const { decidedAt } = analysis.resolved;
    if (decidedAt === undefined) continue;
    const age = ageInDays(decidedAt, now);
    if (age === undefined || age < claimMediumAfterDays) continue;
    warnings.push({
      kind: 'AGEING_CLAIM',
      taxonomyId: analysis.need.taxonomyId,
      capturedAt: decidedAt,
      ageDays: age,
      detail: `The strongest evidence for "${analysis.need.taxonomyId}" was captured ${age} days ago. The game may have changed since.`,
    });
  }

  // ---- Confidence ---------------------------------------------------------
  const confidence = deriveConfidence(outcome, decisive, staleRecipeIds, now, {
    mediumAfterDays: claimMediumAfterDays,
    lowAfterDays: claimLowAfterDays,
  });

  // ---- Reasons: one per need, always ------------------------------------
  const reasons: Reason[] = analyses.map((a) => {
    const reason: Reason = {
      taxonomyId: a.need.taxonomyId,
      needSeverity: a.need.severity,
      status: a.status,
      resolvedState: a.resolved.state,
      decisive: decisiveSet.has(a.need.taxonomyId),
      detail: describe(a.status, a.need),
      evidence: a.resolved.evidence,
      barriers: a.barriers,
      recipeIds: a.recipes.map((r) => r.id),
    };
    if (a.resolved.conflict !== undefined) reason.conflict = a.resolved.conflict;
    return reason;
  });

  // ---- Gaps: needs with no data at all -----------------------------------
  const gaps: TaxonomyId[] = analyses
    .filter(
      (a) =>
        a.resolved.state === 'UNVERIFIED' &&
        a.barriers.length === 0 &&
        a.recipes.length === 0,
    )
    .map((a) => a.need.taxonomyId);

  return { outcome, confidence, reasons, recipes: attachedRecipes, gaps, warnings };
}

function deriveConfidence(
  outcome: Verdict['outcome'],
  decisive: readonly NeedAnalysis[],
  staleRecipeIds: ReadonlySet<string>,
  now: Date,
  claimAge: { mediumAfterDays: number; lowAfterDays: number },
): Confidence {
  // We know nothing by definition — never dress that up.
  if (outcome === 'UNVERIFIED') return 'LOW';

  let confidence: Confidence | undefined;

  for (const analysis of decisive) {
    // Barrier-driven decisions carry a sourceUrl but no trust tier in the data
    // model, so they contribute the middle of the road rather than nothing.
    let perNeed: Confidence =
      analysis.resolved.tier > 0
        ? confidenceFromTier(analysis.resolved.tier)
        : analysis.status === 'BLOCKED_BY_BARRIER'
          ? 'MEDIUM'
          : 'LOW';

    // Who looked is only half of it; when they looked is the other half.
    perNeed = weakestConfidence(
      perNeed,
      confidenceFromClaimAge(analysis.resolved.decidedAt, now, claimAge),
    );

    confidence =
      confidence === undefined ? perNeed : weakestConfidence(confidence, perNeed);
  }

  // Nothing backed this verdict — an empty profile, or one whose needs were all
  // met by recipes with no claims behind them.
  if (confidence === undefined) confidence = 'LOW';

  // A stale recipe that actually drove the verdict caps confidence.
  const leansOnStaleRecipe = decisive.some(
    (a) => a.status === 'MET_VIA_RECIPE' && a.recipes.some((r) => staleRecipeIds.has(r.id)),
  );
  if (leansOnStaleRecipe) confidence = weakestConfidence(confidence, 'LOW');

  return confidence;
}

/**
 * The ceiling that a claim's age puts on confidence. Undated or unparseable
 * evidence is treated as old rather than fresh — under-promising is the safe
 * failure everywhere in this engine.
 */
function confidenceFromClaimAge(
  decidedAt: string | undefined,
  now: Date,
  { mediumAfterDays, lowAfterDays }: { mediumAfterDays: number; lowAfterDays: number },
): Confidence {
  if (decidedAt === undefined) return 'HIGH'; // no claim drove this; nothing to age
  const age = ageInDays(decidedAt, now);
  if (age === undefined) return 'LOW';
  if (age >= lowAfterDays) return 'LOW';
  if (age >= mediumAfterDays) return 'MEDIUM';
  return 'HIGH';
}
