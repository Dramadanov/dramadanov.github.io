/**
 * Types for the match engine.
 *
 * This package is pure: no Prisma, no fetch, no env, no I/O. These types are a
 * structural mirror of the persisted shape (see packages/db), deliberately
 * decoupled so the engine can run unchanged in the browser against a static
 * data chunk.
 */

export type TaxonomyId = string;

/** VISUAL | AUDITORY | MOTOR | COGNITIVE | SPEECH */
export type TaxonomyCategory =
  | 'VISUAL'
  | 'AUDITORY'
  | 'MOTOR'
  | 'COGNITIVE'
  | 'SPEECH';

/**
 * Absence of data is UNVERIFIED, never ABSENT. A game with no caption tag is
 * not a game without captions.
 */
export type ClaimState = 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'UNVERIFIED';

export type NeedSeverity = 'BLOCKER' | 'FRICTION' | 'PREFERENCE';

export type BarrierSeverity = 'HARD' | 'SITUATIONAL';

export type SourceKind =
  | 'PUBLISHER'
  | 'STOREFRONT'
  | 'REVIEWER'
  | 'COMMUNITY'
  | 'FIRSTPARTY_TEST';

/**
 * Provenance. Every claim and every recipe step carries one of these — a claim
 * without a source does not get written, so this is non-optional by design.
 */
export interface SourceRef {
  id: string;
  name: string;
  kind: SourceKind;
  /** 1..4, higher is more trusted. See trust.ts for the canonical ladder. */
  trustTier: number;
}

export interface FeatureClaim {
  id: string;
  taxonomyId: TaxonomyId;
  state: ClaimState;
  note?: string;
  source: SourceRef;
  sourceUrl: string;
  capturedAt: string;
  /** sha256 of exactly what was read, so the claim survives the page changing. */
  contentHash?: string;
  /** Immutable copy of the source, for when the original rots. */
  archiveUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

/**
 * A barrier is something the game does to the player, not a feature it lacks.
 * "Has a colourblind mode" and "has an unskippable QTE requiring 8 inputs per
 * second" are not opposites, and only the second decides whether someone can
 * finish the game.
 *
 * Barriers therefore have their own vocabulary. Feature tags describe what a
 * game HAS; there is no feature tag for the QTE, and inventing one
 * (`no-unskippable-qte`) would corrupt the feature taxonomy to work around a
 * modelling mistake. Instead a barrier names itself from the barrier vocabulary
 * and declares which access needs it obstructs.
 */
export interface Barrier {
  id: string;
  /** Slug from the barrier vocabulary, e.g. "unskippable-high-apm-qte". */
  barrierSlug: string;
  /**
   * Feature-taxonomy ids this barrier obstructs — the needs a player might have
   * marked. Denormalised so the static chunk carries it without a join.
   */
  impactsTaxonomyIds: TaxonomyId[];
  severity: BarrierSeverity;
  description: string;
  /** A recipe that neutralises this barrier. Without one, a HARD barrier gates. */
  workaroundRecipeId?: string;
  /** A barrier is a claim about a game, so it carries provenance like any other. */
  sourceUrl: string;
  capturedAt: string;
  contentHash?: string;
  archiveUrl?: string;
}

export interface RecipeStep {
  id: string;
  order: number;
  /** "Options > Accessibility > Visual" */
  menuPath: string;
  /** "Set Subtitle Size to Large" */
  action: string;
  note?: string;
  screenshotUrl?: string;
}

export interface SettingsRecipe {
  id: string;
  title: string;
  summary: string;
  gameVersion: string;
  verifiedAt: string;
  verifiedBy: string;
  /** Explicit staleness date if the authoring side set one. */
  staleAt?: string;
  addressesTaxonomyIds: TaxonomyId[];
  steps: RecipeStep[];
  sourceUrl?: string;
}

export interface ProfileNeed {
  taxonomyId: TaxonomyId;
  severity: NeedSeverity;
}

export interface Profile {
  id: string;
  shareSlug?: string;
  needs: ProfileNeed[];
}

/**
 * A game already scoped to a single platform. Platform selection is a data-layer
 * concern; the engine evaluates one (game, platform) pair at a time.
 */
export interface GameWithClaims {
  gameId: string;
  platformId: string;
  name?: string;
  claims: FeatureClaim[];
  barriers: Barrier[];
  recipes: SettingsRecipe[];
}

export type Outcome =
  | 'PLAYABLE'
  | 'PLAYABLE_WITH_CONFIG'
  | 'NOT_PLAYABLE'
  | 'UNVERIFIED';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Why a single need landed where it did. */
export type ReasonStatus =
  | 'MET_AS_SHIPPED'
  | 'MET_VIA_RECIPE'
  | 'BLOCKED_BY_BARRIER'
  | 'UNMET'
  | 'PARTIAL'
  | 'NO_DATA';

export interface Evidence {
  sourceId: string;
  sourceName: string;
  sourceKind: SourceKind;
  trustTier: number;
  sourceUrl: string;
  capturedAt: string;
  /** Lets the UI offer an archived copy when the original has rotted. */
  archiveUrl?: string;
  contentHash?: string;
  claimState: ClaimState;
  note?: string;
}

export interface BarrierRef {
  id: string;
  barrierSlug: string;
  severity: BarrierSeverity;
  description: string;
  sourceUrl: string;
  capturedAt: string;
  hasWorkaround: boolean;
}

export interface Reason {
  taxonomyId: TaxonomyId;
  needSeverity: NeedSeverity;
  status: ReasonStatus;
  /** State after conflict resolution across all claims for this need. */
  resolvedState: ClaimState;
  /** Did this need drive the final outcome? */
  decisive: boolean;
  detail: string;
  evidence: Evidence[];
  barriers: BarrierRef[];
  recipeIds: string[];
  /** Set when contradictory claims sat at the same trust tier. */
  conflict?: {
    tier: number;
    states: ClaimState[];
  };
}

/**
 * Things a reader should know that do not change the outcome.
 *
 * Recipes and claims both decay, but at different rates and for different
 * reasons: a recipe's menu paths move with every patch, whereas a game that
 * shipped captions generally keeps them. So claims are given a longer rope than
 * recipes rather than the same one.
 */
export type VerdictWarning =
  | { kind: 'STALE_RECIPE'; recipeId: string; detail: string }
  | {
      kind: 'AGEING_CLAIM';
      taxonomyId: TaxonomyId;
      capturedAt: string;
      ageDays: number;
      detail: string;
    };

export interface Verdict {
  outcome: Outcome;
  confidence: Confidence;
  /** One per profile need, always populated — every verdict is explainable. */
  reasons: Reason[];
  recipes: SettingsRecipe[];
  /** Needs with no data at all. */
  gaps: TaxonomyId[];
  warnings: VerdictWarning[];
}

export interface EvaluateOptions {
  /**
   * Evaluation instant, for recipe staleness. Injected rather than read from the
   * clock so the engine stays deterministic under test.
   */
  now?: Date;
  /** Recipes go stale after this many days. Plan §2.5. */
  staleAfterDays?: number;
  /** A decisive claim older than this caps confidence at MEDIUM. */
  claimMediumAfterDays?: number;
  /** A decisive claim older than this caps confidence at LOW. */
  claimLowAfterDays?: number;
}
