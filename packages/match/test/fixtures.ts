/**
 * Test fixtures.
 *
 * These are synthetic: invented taxonomy slugs, invented games, invented source
 * URLs on an example.invalid domain. They exercise the rule set and are NOT
 * accessibility claims about any real game. Real claims require a real fetched
 * source — see the absolute rules in CLAUDE.md.
 */
import type {
  Barrier,
  BarrierSeverity,
  ClaimState,
  FeatureClaim,
  GameWithClaims,
  NeedSeverity,
  Profile,
  SettingsRecipe,
  SourceKind,
  SourceRef,
} from '../src/types.js';
import { defaultTrustTier } from '../src/trust.js';

export const NOW = new Date('2026-07-28T00:00:00.000Z');

let seq = 0;
const nextId = (prefix: string): string => `${prefix}-${++seq}`;

export function source(kind: SourceKind, overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    id: nextId('src'),
    name: `${kind} source`,
    kind,
    trustTier: defaultTrustTier(kind),
    ...overrides,
  };
}

export function claim(
  taxonomyId: string,
  state: ClaimState,
  kind: SourceKind = 'PUBLISHER',
  overrides: Partial<FeatureClaim> = {},
): FeatureClaim {
  return {
    id: nextId('claim'),
    taxonomyId,
    state,
    source: source(kind),
    sourceUrl: `https://example.invalid/${taxonomyId}`,
    capturedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * `impacts` is the list of needs this barrier obstructs. Passing a single string
 * is shorthand for a barrier that obstructs exactly one need.
 */
export function barrier(
  impacts: string | string[],
  severity: BarrierSeverity,
  overrides: Partial<Barrier> = {},
): Barrier {
  const impactsTaxonomyIds = typeof impacts === 'string' ? [impacts] : impacts;
  return {
    id: nextId('barrier'),
    barrierSlug: `synthetic-${severity.toLowerCase()}-barrier`,
    impactsTaxonomyIds,
    severity,
    description: `${severity} barrier on ${impactsTaxonomyIds.join(', ')}`,
    sourceUrl: `https://example.invalid/barrier/${impactsTaxonomyIds[0] ?? 'x'}`,
    capturedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

export function recipe(
  addresses: string[],
  overrides: Partial<SettingsRecipe> = {},
): SettingsRecipe {
  const id = overrides.id ?? nextId('recipe');
  const base: SettingsRecipe = {
    id,
    title: `Recipe for ${addresses.join(', ')}`,
    summary: 'Synthetic recipe used in tests.',
    gameVersion: '1.0.0',
    // Fresh relative to NOW unless a test overrides it.
    verifiedAt: '2026-07-01T00:00:00.000Z',
    verifiedBy: 'test-fixture',
    addressesTaxonomyIds: addresses,
    steps: [
      {
        id: nextId('step'),
        order: 1,
        menuPath: 'Options > Accessibility',
        action: `Enable ${addresses[0] ?? 'setting'}`,
      },
    ],
  };
  return { ...base, ...overrides, id };
}

export function game(overrides: Partial<GameWithClaims> = {}): GameWithClaims {
  return {
    gameId: nextId('game'),
    platformId: 'pc-steam',
    name: 'Synthetic Game',
    claims: [],
    barriers: [],
    recipes: [],
    ...overrides,
  };
}

export function profile(
  needs: Array<[string, NeedSeverity]>,
  overrides: Partial<Profile> = {},
): Profile {
  return {
    id: nextId('profile'),
    needs: needs.map(([taxonomyId, severity]) => ({ taxonomyId, severity })),
    ...overrides,
  };
}
