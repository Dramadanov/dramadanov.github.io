import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import { NOW, barrier, claim, game, profile, recipe } from './fixtures.js';

const opts = { now: NOW };

describe('rule 1 — HARD barrier on a blocker need with no workaround', () => {
  it('is NOT_PLAYABLE even when the feature itself is claimed PRESENT', () => {
    const verdict = evaluate(
      profile([['no-qte', 'BLOCKER']]),
      game({
        claims: [claim('no-qte', 'PRESENT', 'FIRSTPARTY_TEST')],
        barriers: [barrier('no-qte', 'HARD')],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('NOT_PLAYABLE');
    expect(verdict.reasons[0]?.status).toBe('BLOCKED_BY_BARRIER');
    expect(verdict.reasons[0]?.decisive).toBe(true);
  });

  it('outranks an ABSENT blocker — rule 1 is evaluated first', () => {
    const verdict = evaluate(
      profile([
        ['a', 'BLOCKER'],
        ['b', 'BLOCKER'],
      ]),
      game({
        claims: [claim('b', 'ABSENT')],
        barriers: [barrier('a', 'HARD')],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('NOT_PLAYABLE');
    // Both needs drove it; both are reported.
    expect(verdict.reasons.filter((r) => r.decisive)).toHaveLength(2);
  });

  it('does not gate when the named workaround recipe exists', () => {
    const fix = recipe(['no-qte'], { id: 'fix-1' });
    const verdict = evaluate(
      profile([['no-qte', 'BLOCKER']]),
      game({
        barriers: [barrier('no-qte', 'HARD', { workaroundRecipeId: 'fix-1' })],
        recipes: [fix],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.recipes.map((r) => r.id)).toEqual(['fix-1']);
  });

  it('still gates when the workaround recipe id points at nothing', () => {
    const verdict = evaluate(
      profile([['no-qte', 'BLOCKER']]),
      game({
        barriers: [
          barrier('no-qte', 'HARD', { workaroundRecipeId: 'missing-recipe' }),
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('NOT_PLAYABLE');
    expect(verdict.reasons[0]?.barriers[0]?.hasWorkaround).toBe(false);
  });

  it('SITUATIONAL barriers do not gate, but are surfaced', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'PRESENT')],
        barriers: [barrier('captions', 'SITUATIONAL')],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.reasons[0]?.barriers).toHaveLength(1);
    expect(verdict.reasons[0]?.barriers[0]?.severity).toBe('SITUATIONAL');
  });

  it('ignores a HARD barrier that is not on a blocker need', () => {
    const verdict = evaluate(
      profile([['captions', 'FRICTION']]),
      game({
        claims: [claim('captions', 'PRESENT')],
        barriers: [barrier('captions', 'HARD')],
      }),
      opts,
    );

    // The need is not a blocker, so rule 1 does not fire.
    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.reasons[0]?.status).toBe('BLOCKED_BY_BARRIER');
    expect(verdict.reasons[0]?.decisive).toBe(false);
  });
});

describe('rule 2 — blocker need claimed ABSENT', () => {
  it('is NOT_PLAYABLE', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({ claims: [claim('captions', 'ABSENT')] }),
      opts,
    );

    expect(verdict.outcome).toBe('NOT_PLAYABLE');
    expect(verdict.reasons[0]?.status).toBe('UNMET');
  });

  it('is not triggered by an ABSENT claim on a non-blocker need', () => {
    const verdict = evaluate(
      profile([
        ['captions', 'FRICTION'],
        ['remap', 'PREFERENCE'],
      ]),
      game({
        claims: [claim('captions', 'ABSENT'), claim('remap', 'ABSENT')],
      }),
      opts,
    );

    // Blockers are the gate. Unmet friction is reported, not fatal.
    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.reasons.every((r) => r.status === 'UNMET')).toBe(true);
  });
});

describe('rule 3 — blocker need with no usable data', () => {
  it('is UNVERIFIED when there are no claims at all', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game(),
      opts,
    );

    expect(verdict.outcome).toBe('UNVERIFIED');
    expect(verdict.confidence).toBe('LOW');
    expect(verdict.reasons[0]?.status).toBe('NO_DATA');
    expect(verdict.gaps).toEqual(['captions']);
  });

  it('is UNVERIFIED when the only claim is explicitly UNVERIFIED', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({ claims: [claim('captions', 'UNVERIFIED', 'FIRSTPARTY_TEST')] }),
      opts,
    );

    expect(verdict.outcome).toBe('UNVERIFIED');
    // The claim is still shown — the reader can see who did not check.
    expect(verdict.reasons[0]?.evidence).toHaveLength(1);
  });

  it('is UNVERIFIED for a PARTIAL blocker with no recipe — never PLAYABLE', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({ claims: [claim('captions', 'PARTIAL')] }),
      opts,
    );

    expect(verdict.outcome).toBe('UNVERIFIED');
    expect(verdict.reasons[0]?.status).toBe('PARTIAL');
  });

  it('yields to rule 2 when another blocker is ABSENT', () => {
    const verdict = evaluate(
      profile([
        ['a', 'BLOCKER'],
        ['b', 'BLOCKER'],
      ]),
      game({ claims: [claim('b', 'ABSENT')] }),
      opts,
    );

    expect(verdict.outcome).toBe('NOT_PLAYABLE');
  });
});

describe('rule 4 — met via recipe', () => {
  it('upgrades an ABSENT blocker to PLAYABLE_WITH_CONFIG when a recipe addresses it', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'ABSENT')],
        recipes: [recipe(['captions'])],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.reasons[0]?.status).toBe('MET_VIA_RECIPE');
    expect(verdict.recipes).toHaveLength(1);
  });

  it('fires for a non-blocker need too', () => {
    const verdict = evaluate(
      profile([['captions', 'PREFERENCE']]),
      game({
        claims: [claim('captions', 'ABSENT')],
        recipes: [recipe(['captions'])],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
  });

  it('handles a recipe that addresses only some of several blockers', () => {
    const verdict = evaluate(
      profile([
        ['captions', 'BLOCKER'],
        ['remap', 'BLOCKER'],
      ]),
      game({
        claims: [claim('captions', 'ABSENT'), claim('remap', 'ABSENT')],
        recipes: [recipe(['captions'])],
      }),
      opts,
    );

    // The uncovered blocker still gates. A partial fix is not a pass.
    expect(verdict.outcome).toBe('NOT_PLAYABLE');
    expect(
      verdict.reasons.find((r) => r.taxonomyId === 'remap')?.status,
    ).toBe('UNMET');
  });

  it('does not double-attach a recipe that covers two needs', () => {
    const shared = recipe(['captions', 'remap']);
    const verdict = evaluate(
      profile([
        ['captions', 'BLOCKER'],
        ['remap', 'BLOCKER'],
      ]),
      game({ recipes: [shared] }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.recipes).toHaveLength(1);
  });

  it('ignores recipes that address none of the profile needs', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'PRESENT')],
        recipes: [recipe(['unrelated-need'])],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.recipes).toHaveLength(0);
  });
});

describe('rule 5 — all needs met as shipped', () => {
  it('is PLAYABLE', () => {
    const verdict = evaluate(
      profile([
        ['captions', 'BLOCKER'],
        ['remap', 'FRICTION'],
      ]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'FIRSTPARTY_TEST'),
          claim('remap', 'PRESENT', 'FIRSTPARTY_TEST'),
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.confidence).toBe('HIGH');
    expect(verdict.reasons.every((r) => r.status === 'MET_AS_SHIPPED')).toBe(true);
  });

  it('returns PLAYABLE with LOW confidence for an empty profile', () => {
    const verdict = evaluate(profile([]), game(), opts);

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.confidence).toBe('LOW');
    expect(verdict.reasons).toEqual([]);
    expect(verdict.gaps).toEqual([]);
  });
});

describe('reasons and gaps', () => {
  it('always returns exactly one reason per profile need', () => {
    const needs = profile([
      ['a', 'BLOCKER'],
      ['b', 'FRICTION'],
      ['c', 'PREFERENCE'],
    ]);
    const verdict = evaluate(needs, game({ claims: [claim('a', 'ABSENT')] }), opts);

    expect(verdict.reasons.map((r) => r.taxonomyId)).toEqual(['a', 'b', 'c']);
    expect(verdict.reasons.map((r) => r.needSeverity)).toEqual([
      'BLOCKER',
      'FRICTION',
      'PREFERENCE',
    ]);
  });

  it('carries sourceUrl and capturedAt on every piece of evidence', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({ claims: [claim('captions', 'PRESENT')] }),
      opts,
    );

    const evidence = verdict.reasons[0]?.evidence ?? [];
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.sourceUrl).toBeTruthy();
    expect(evidence[0]?.capturedAt).toBeTruthy();
  });

  it('surfaces claim notes as evidence notes', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'PRESENT', 'PUBLISHER', { note: 'Size adjustable.' })],
      }),
      opts,
    );

    expect(verdict.reasons[0]?.evidence[0]?.note).toBe('Size adjustable.');
  });

  it('does not list a need as a gap when a barrier documents it', () => {
    const verdict = evaluate(
      profile([['captions', 'FRICTION']]),
      game({ barriers: [barrier('captions', 'SITUATIONAL')] }),
      opts,
    );

    expect(verdict.gaps).toEqual([]);
  });

  it('does not list a need as a gap when a recipe covers it', () => {
    const verdict = evaluate(
      profile([['captions', 'FRICTION']]),
      game({ recipes: [recipe(['captions'])] }),
      opts,
    );

    expect(verdict.gaps).toEqual([]);
  });
});
