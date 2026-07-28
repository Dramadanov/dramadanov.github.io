/**
 * Property tests.
 *
 * The headline invariant from plan §5: no input should ever produce PLAYABLE
 * when any blocker need lacks a PRESENT claim. Everything else here guards the
 * same failure mode from a different angle — over-promising playability is the
 * one bug in this engine that costs a disabled player money and trust.
 *
 * No external property-testing dependency: the input space that matters is
 * small enough to enumerate exhaustively, which is stronger than sampling it.
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import type {
  Barrier,
  ClaimState,
  FeatureClaim,
  GameWithClaims,
  NeedSeverity,
  Profile,
  SettingsRecipe,
  SourceKind,
} from '../src/types.js';
import { defaultTrustTier } from '../src/trust.js';

const NOW = new Date('2026-07-28T00:00:00.000Z');

const SEVERITIES: NeedSeverity[] = ['BLOCKER', 'FRICTION', 'PREFERENCE'];
const CLAIM_STATES: Array<ClaimState | 'NONE'> = [
  'PRESENT',
  'ABSENT',
  'PARTIAL',
  'UNVERIFIED',
  'NONE',
];
const BARRIER_SHAPES = [
  'NONE',
  'SITUATIONAL',
  'HARD_NO_WORKAROUND',
  'HARD_WITH_WORKAROUND',
] as const;
const SOURCE_KINDS: SourceKind[] = [
  'FIRSTPARTY_TEST',
  'PUBLISHER',
  'STOREFRONT',
  'REVIEWER',
  'COMMUNITY',
];

type BarrierShape = (typeof BARRIER_SHAPES)[number];

interface Combo {
  severity: NeedSeverity;
  claimState: ClaimState | 'NONE';
  barrierShape: BarrierShape;
  hasRecipe: boolean;
  sourceKind: SourceKind;
}

function buildCase(
  taxonomyId: string,
  combo: Combo,
): { claims: FeatureClaim[]; barriers: Barrier[]; recipes: SettingsRecipe[] } {
  const recipeId = `recipe-${taxonomyId}`;

  const claims: FeatureClaim[] =
    combo.claimState === 'NONE'
      ? []
      : [
          {
            id: `claim-${taxonomyId}`,
            taxonomyId,
            state: combo.claimState,
            source: {
              id: `src-${taxonomyId}`,
              name: combo.sourceKind,
              kind: combo.sourceKind,
              trustTier: defaultTrustTier(combo.sourceKind),
            },
            sourceUrl: `https://example.invalid/${taxonomyId}`,
            capturedAt: '2026-06-01T00:00:00.000Z',
          },
        ];

  const recipes: SettingsRecipe[] = combo.hasRecipe
    ? [
        {
          id: recipeId,
          title: `Fix ${taxonomyId}`,
          summary: 'synthetic',
          gameVersion: '1.0.0',
          verifiedAt: '2026-07-01T00:00:00.000Z',
          verifiedBy: 'test',
          addressesTaxonomyIds: [taxonomyId],
          steps: [
            {
              id: `step-${taxonomyId}`,
              order: 1,
              menuPath: 'Options',
              action: 'Toggle',
            },
          ],
        },
      ]
    : [];

  const barriers: Barrier[] = [];
  if (combo.barrierShape !== 'NONE') {
    const base: Barrier = {
      id: `barrier-${taxonomyId}`,
      taxonomyId,
      severity: combo.barrierShape === 'SITUATIONAL' ? 'SITUATIONAL' : 'HARD',
      description: 'synthetic barrier',
      sourceUrl: `https://example.invalid/barrier/${taxonomyId}`,
    };
    barriers.push(
      combo.barrierShape === 'HARD_WITH_WORKAROUND'
        ? { ...base, workaroundRecipeId: recipeId }
        : base,
    );
  }

  return { claims, barriers, recipes };
}

function* allCombos(): Generator<Combo> {
  for (const severity of SEVERITIES) {
    for (const claimState of CLAIM_STATES) {
      for (const barrierShape of BARRIER_SHAPES) {
        for (const hasRecipe of [true, false]) {
          yield {
            severity,
            claimState,
            barrierShape,
            hasRecipe,
            sourceKind: 'PUBLISHER',
          };
        }
      }
    }
  }
}

/** Deterministic PRNG so a failure is always reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)] as T;
}

function randomScenario(
  rand: () => number,
): { profile: Profile; game: GameWithClaims } {
  const needCount = 1 + Math.floor(rand() * 4);
  const claims: FeatureClaim[] = [];
  const barriers: Barrier[] = [];
  const recipes: SettingsRecipe[] = [];
  const needs: Profile['needs'] = [];

  for (let i = 0; i < needCount; i++) {
    const taxonomyId = `need-${i}`;
    const combo: Combo = {
      severity: pick(rand, SEVERITIES),
      claimState: pick(rand, CLAIM_STATES),
      barrierShape: pick(rand, BARRIER_SHAPES),
      hasRecipe: rand() > 0.5,
      sourceKind: pick(rand, SOURCE_KINDS),
    };
    needs.push({ taxonomyId, severity: combo.severity });
    const built = buildCase(taxonomyId, combo);
    claims.push(...built.claims);
    barriers.push(...built.barriers);
    recipes.push(...built.recipes);

    // Sometimes add a second, contradicting claim from another source.
    if (rand() > 0.7) {
      const other = pick(rand, SOURCE_KINDS);
      claims.push({
        id: `claim-${taxonomyId}-b`,
        taxonomyId,
        state: pick(rand, ['PRESENT', 'ABSENT', 'PARTIAL', 'UNVERIFIED']),
        source: {
          id: `src-${taxonomyId}-b`,
          name: other,
          kind: other,
          trustTier: defaultTrustTier(other),
        },
        sourceUrl: `https://example.invalid/${taxonomyId}/b`,
        capturedAt: '2026-06-02T00:00:00.000Z',
      });
    }
  }

  return {
    profile: { id: 'p', needs },
    game: { gameId: 'g', platformId: 'pc-steam', claims, barriers, recipes },
  };
}

function assertInvariants(profile: Profile, game: GameWithClaims): void {
  const verdict = evaluate(profile, game, { now: NOW });

  // Every verdict is explainable: one reason per need, always.
  expect(verdict.reasons).toHaveLength(profile.needs.length);

  const blockerReasons = verdict.reasons.filter(
    (r) => r.needSeverity === 'BLOCKER',
  );

  if (verdict.outcome === 'PLAYABLE') {
    // The headline invariant.
    for (const reason of blockerReasons) {
      expect(reason.resolvedState).toBe('PRESENT');
      expect(reason.status).toBe('MET_AS_SHIPPED');
    }
    // Nothing needing configuration can hide inside a PLAYABLE verdict.
    expect(verdict.reasons.some((r) => r.status === 'MET_VIA_RECIPE')).toBe(false);
  }

  if (verdict.outcome === 'PLAYABLE' || verdict.outcome === 'PLAYABLE_WITH_CONFIG') {
    // A blocker can never be left unmet behind a positive verdict.
    for (const reason of blockerReasons) {
      expect(['MET_AS_SHIPPED', 'MET_VIA_RECIPE']).toContain(reason.status);
    }
  }

  // Gaps are a subset of the profile's needs, and never claim to be met.
  const needIds = new Set(profile.needs.map((n) => n.taxonomyId));
  for (const gap of verdict.gaps) {
    expect(needIds.has(gap)).toBe(true);
  }

  // Determinism: the engine is pure.
  expect(evaluate(profile, game, { now: NOW })).toEqual(verdict);
}

describe('property: PLAYABLE is never returned over an unmet blocker', () => {
  it('holds across every single-need combination', () => {
    let checked = 0;
    for (const combo of allCombos()) {
      const built = buildCase('need-0', combo);
      assertInvariants(
        { id: 'p', needs: [{ taxonomyId: 'need-0', severity: combo.severity }] },
        { gameId: 'g', platformId: 'pc-steam', ...built },
      );
      checked++;
    }
    expect(checked).toBe(120);
  });

  it('holds across every single-need combination at every trust tier', () => {
    for (const sourceKind of SOURCE_KINDS) {
      for (const combo of allCombos()) {
        const withKind: Combo = { ...combo, sourceKind };
        const built = buildCase('need-0', withKind);
        assertInvariants(
          { id: 'p', needs: [{ taxonomyId: 'need-0', severity: combo.severity }] },
          { gameId: 'g', platformId: 'pc-steam', ...built },
        );
      }
    }
  });

  it('holds across 2000 seeded multi-need scenarios', () => {
    const rand = mulberry32(20260728);
    for (let i = 0; i < 2000; i++) {
      const { profile, game } = randomScenario(rand);
      assertInvariants(profile, game);
    }
  });
});
