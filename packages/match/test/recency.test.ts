/**
 * Claim recency.
 *
 * Trust tier answers "who looked". This answers "when", which matters because a
 * game patched forty times since a first-party test is not the game that was
 * tested. Recipes already decayed; claims did not, and their capturedAt was
 * written but never read.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLAIM_LOW_AFTER_DAYS,
  DEFAULT_CLAIM_MEDIUM_AFTER_DAYS,
  evaluate,
  resolveClaims,
} from '../src/index.js';
import { NOW, claim, game, profile, recipe } from './fixtures.js';

const opts = { now: NOW };

/** Days before NOW, as an ISO string. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('thresholds', () => {
  it('lets claims decay more slowly than recipes', () => {
    // A recipe's menu paths move every patch; a shipped feature usually persists.
    expect(DEFAULT_CLAIM_MEDIUM_AFTER_DAYS).toBe(365);
    expect(DEFAULT_CLAIM_LOW_AFTER_DAYS).toBe(730);
    expect(DEFAULT_CLAIM_MEDIUM_AFTER_DAYS).toBeGreaterThan(180);
  });
});

describe('resolveClaims records when the deciding look happened', () => {
  it('uses the freshest capture among the deciding claims', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'PRESENT', 'PUBLISHER', { capturedAt: daysAgo(500) }),
      claim('captions', 'PRESENT', 'PUBLISHER', { capturedAt: daysAgo(30) }),
    ]);

    expect(resolved.decidedAt).toBe(daysAgo(30));
  });

  it('ignores captures from claims that lost on trust tier', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(900) }),
      claim('captions', 'ABSENT', 'COMMUNITY', { capturedAt: daysAgo(1) }),
    ]);

    // The community claim is fresher but was overruled; it did not decide anything.
    expect(resolved.state).toBe('PRESENT');
    expect(resolved.decidedAt).toBe(daysAgo(900));
  });

  it('is undefined when nothing decided the state', () => {
    expect(resolveClaims('captions', []).decidedAt).toBeUndefined();
  });

  it('ignores unparseable capture dates when picking the freshest', () => {
    const resolved = resolveClaims('captions', [
      claim('captions', 'PRESENT', 'PUBLISHER', { capturedAt: 'not-a-date' }),
      claim('captions', 'PRESENT', 'PUBLISHER', { capturedAt: daysAgo(10) }),
    ]);

    expect(resolved.decidedAt).toBe(daysAgo(10));
  });
});

describe('confidence caps on age', () => {
  it('leaves fresh first-party evidence at HIGH', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(30) }),
        ],
      }),
      opts,
    );

    expect(verdict.confidence).toBe('HIGH');
    expect(verdict.warnings).toEqual([]);
  });

  it('caps at MEDIUM once a decisive claim passes a year', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(400) }),
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.confidence).toBe('MEDIUM');
  });

  it('caps at LOW once a decisive claim passes two years', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(900) }),
        ],
      }),
      opts,
    );

    expect(verdict.confidence).toBe('LOW');
  });

  it('never raises confidence — age is a ceiling, not a score', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'PRESENT', 'COMMUNITY', { capturedAt: daysAgo(1) })],
      }),
      opts,
    );

    // Fresh, but still only a community report.
    expect(verdict.confidence).toBe('LOW');
  });

  it('takes the weakest across needs, ageing included', () => {
    const verdict = evaluate(
      profile([
        ['a', 'BLOCKER'],
        ['b', 'BLOCKER'],
      ]),
      game({
        claims: [
          claim('a', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(10) }),
          claim('b', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(400) }),
        ],
      }),
      opts,
    );

    expect(verdict.confidence).toBe('MEDIUM');
  });

  it('treats an unparseable capture date as old, not fresh', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [
          claim('captions', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: 'someday' }),
        ],
      }),
      opts,
    );

    expect(verdict.confidence).toBe('LOW');
  });

  it('does not cap on a claim that did not drive the verdict', () => {
    const verdict = evaluate(
      profile([
        ['a', 'BLOCKER'],
        ['b', 'PREFERENCE'],
      ]),
      game({
        claims: [
          claim('a', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(10) }),
          // Ancient, but absent and non-blocking, so it decides nothing.
          claim('b', 'ABSENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(2000) }),
        ],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.confidence).toBe('HIGH');
  });

  it('respects custom thresholds', () => {
    const g = game({
      claims: [
        claim('captions', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(60) }),
      ],
    });

    expect(
      evaluate(profile([['captions', 'BLOCKER']]), g, {
        now: NOW,
        claimMediumAfterDays: 30,
        claimLowAfterDays: 90,
      }).confidence,
    ).toBe('MEDIUM');

    expect(
      evaluate(profile([['captions', 'BLOCKER']]), g, {
        now: NOW,
        claimMediumAfterDays: 10,
        claimLowAfterDays: 20,
      }).confidence,
    ).toBe('LOW');
  });

  it('does not disturb a recipe-driven verdict with no claims behind it', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({ recipes: [recipe(['captions'])] }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.confidence).toBe('LOW');
  });
});

describe('ageing claim warnings', () => {
  it('warns with the age and capture date', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'PRESENT', 'PUBLISHER', { capturedAt: daysAgo(400) })],
      }),
      opts,
    );

    expect(verdict.warnings).toHaveLength(1);
    const warning = verdict.warnings[0];
    expect(warning?.kind).toBe('AGEING_CLAIM');
    if (warning?.kind !== 'AGEING_CLAIM') throw new Error('wrong warning kind');
    expect(warning.taxonomyId).toBe('captions');
    expect(warning.ageDays).toBe(400);
    expect(warning.capturedAt).toBe(daysAgo(400));
  });

  it('warns on ageing evidence even where it did not drive the outcome', () => {
    const verdict = evaluate(
      profile([
        ['a', 'BLOCKER'],
        ['b', 'PREFERENCE'],
      ]),
      game({
        claims: [
          claim('a', 'PRESENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(10) }),
          claim('b', 'ABSENT', 'FIRSTPARTY_TEST', { capturedAt: daysAgo(2000) }),
        ],
      }),
      opts,
    );

    // Warn broadly, cap narrowly: the reader is told, the verdict is not moved.
    expect(verdict.confidence).toBe('HIGH');
    expect(verdict.warnings).toHaveLength(1);
    expect(verdict.warnings[0]?.kind).toBe('AGEING_CLAIM');
  });

  it('does not warn on fresh evidence', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'PRESENT', 'PUBLISHER', { capturedAt: daysAgo(100) })],
      }),
      opts,
    );

    expect(verdict.warnings).toEqual([]);
  });

  it('reports recipe staleness and claim ageing side by side', () => {
    const verdict = evaluate(
      profile([['captions', 'BLOCKER']]),
      game({
        claims: [claim('captions', 'ABSENT', 'PUBLISHER', { capturedAt: daysAgo(800) })],
        recipes: [recipe(['captions'], { verifiedAt: daysAgo(400) })],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.warnings.map((w) => w.kind).sort()).toEqual([
      'AGEING_CLAIM',
      'STALE_RECIPE',
    ]);
  });
});
