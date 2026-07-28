import { describe, expect, it } from 'vitest';
import { evaluate, resolveClaims } from '../src/index.js';
import { NOW, claim, game, profile, recipe } from './fixtures.js';

const opts = { now: NOW };

describe('conflict resolution', () => {
  it('resolves to the higher trust tier', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'ABSENT', 'COMMUNITY'),
      claim('captions', 'PRESENT', 'FIRSTPARTY_TEST'),
    ]);

    expect(resolved.state).toBe('PRESENT');
    expect(resolved.tier).toBe(4);
    expect(resolved.conflict).toBeUndefined();
    // The overruled claim is still visible to the reader.
    expect(resolved.evidence).toHaveLength(2);
  });

  it('resolves a same-tier contradiction to PARTIAL and surfaces both states', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'PRESENT', 'PUBLISHER'),
      claim('captions', 'ABSENT', 'STOREFRONT'),
    ]);

    // PUBLISHER and STOREFRONT share tier 3.
    expect(resolved.state).toBe('PARTIAL');
    expect(resolved.conflict?.tier).toBe(3);
    expect(resolved.conflict?.states).toEqual(
      expect.arrayContaining(['PRESENT', 'ABSENT']),
    );
  });

  it('agreeing claims at the same tier are not a conflict', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'PRESENT', 'PUBLISHER'),
      claim('captions', 'PRESENT', 'STOREFRONT'),
    ]);

    expect(resolved.state).toBe('PRESENT');
    expect(resolved.conflict).toBeUndefined();
  });

  it('an explicit UNVERIFIED claim never outranks a real observation', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'UNVERIFIED', 'FIRSTPARTY_TEST'),
      claim('captions', 'PRESENT', 'COMMUNITY'),
    ]);

    // "Nobody checked" is not a finding, so the community observation stands.
    expect(resolved.state).toBe('PRESENT');
    expect(resolved.tier).toBe(1);
  });

  it('ignores claims for other taxonomy ids', () => {
    const resolved = resolveClaims('captions', [
      claim('remap', 'ABSENT', 'FIRSTPARTY_TEST'),
    ]);

    expect(resolved.state).toBe('UNVERIFIED');
    expect(resolved.tier).toBe(0);
    expect(resolved.evidence).toEqual([]);
  });

  it('a contradiction on a blocker resolves to PARTIAL and blocks the verdict', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'PUBLISHER'),
          claim('captions', 'ABSENT', 'STOREFRONT'),
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('UNVERIFIED');
    expect(verdict.reasons[0]?.conflict).toBeDefined();
    expect(verdict.reasons[0]?.evidence).toHaveLength(2);
  });

  it('a recipe resolves a contradicted blocker to PLAYABLE_WITH_CONFIG', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'PUBLISHER'),
          claim('captions', 'ABSENT', 'STOREFRONT'),
        ],
        recipes: [recipe(['captions'])],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
  });
});

describe('confidence', () => {
  it('takes the weakest source backing a decisive claim', () => {
    const verdict = evaluate(
      profile([
        ['a', 'BLOCKER'],
        ['b', 'BLOCKER'],
      ]),
      game({
        claims: [
          claim('a', 'PRESENT', 'FIRSTPARTY_TEST'),
          claim('b', 'PRESENT', 'COMMUNITY'),
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.confidence).toBe('LOW');
  });

  it('is MEDIUM when an established reviewer is the weakest decisive source', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ claims: [claim('a', 'PRESENT', 'REVIEWER')] }),
      opts,
    );

    expect(verdict.confidence).toBe('MEDIUM');
  });

  it('is HIGH when a storefront backs the only decisive claim', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ claims: [claim('a', 'PRESENT', 'STOREFRONT')] }),
      opts,
    );

    expect(verdict.confidence).toBe('HIGH');
  });

  it('is always LOW for an UNVERIFIED outcome', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ claims: [claim('a', 'UNVERIFIED', 'FIRSTPARTY_TEST')] }),
      opts,
    );

    expect(verdict.confidence).toBe('LOW');
  });

  it('is MEDIUM for a barrier-driven NOT_PLAYABLE with no claim behind it', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({
        barriers: [
          {
            id: 'b1',
            taxonomyId: 'a',
            severity: 'HARD',
            description: 'Unskippable timed sequence.',
            sourceUrl: 'https://example.invalid/b1',
          },
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('NOT_PLAYABLE');
    expect(verdict.confidence).toBe('MEDIUM');
  });

  it('is LOW when a recipe with no claims behind it carries the verdict', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ recipes: [recipe(['a'])] }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.confidence).toBe('LOW');
  });
});
