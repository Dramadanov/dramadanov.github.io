import { describe, expect, it } from 'vitest';
import { DEFAULT_STALE_AFTER_DAYS, evaluate } from '../src/index.js';
import { NOW, claim, game, profile, recipe } from './fixtures.js';

const opts = { now: NOW };

describe('recipe staleness', () => {
  it('defaults to a 180-day window', () => {
    expect(DEFAULT_STALE_AFTER_DAYS).toBe(180);
  });

  it('does not warn on a recipe verified inside the window', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ recipes: [recipe(['a'], { verifiedAt: '2026-07-01T00:00:00.000Z' })] }),
      opts,
    );

    expect(verdict.warnings).toEqual([]);
  });

  it('warns and caps confidence when a decisive recipe is past the window', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({
        claims: [claim('a', 'ABSENT', 'FIRSTPARTY_TEST')],
        recipes: [recipe(['a'], { verifiedAt: '2025-01-01T00:00:00.000Z' })],
      }),
      opts,
    );

    expect(verdict.outcome).toBe('PLAYABLE_WITH_CONFIG');
    expect(verdict.warnings).toHaveLength(1);
    expect(verdict.warnings[0]?.kind).toBe('STALE');
    // First-party evidence would otherwise be HIGH.
    expect(verdict.confidence).toBe('LOW');
  });

  it('honours an explicit staleAt over the computed window', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({
        recipes: [
          recipe(['a'], {
            verifiedAt: '2025-01-01T00:00:00.000Z',
            staleAt: '2027-01-01T00:00:00.000Z',
          }),
        ],
      }),
      opts,
    );

    expect(verdict.warnings).toEqual([]);
  });

  it('treats an unparseable verified date as stale', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ recipes: [recipe(['a'], { verifiedAt: 'not-a-date' })] }),
      opts,
    );

    expect(verdict.warnings).toHaveLength(1);
  });

  it('respects a custom staleAfterDays', () => {
    const g = game({
      recipes: [recipe(['a'], { verifiedAt: '2026-07-01T00:00:00.000Z' })],
    });

    expect(
      evaluate(profile([['a', 'BLOCKER']]), g, { now: NOW, staleAfterDays: 7 })
        .warnings,
    ).toHaveLength(1);
  });

  it('warns about a stale recipe without downgrading a verdict it did not drive', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({
        claims: [claim('a', 'PRESENT', 'FIRSTPARTY_TEST')],
        recipes: [recipe(['a'], { verifiedAt: '2025-01-01T00:00:00.000Z' })],
      }),
      opts,
    );

    // The feature is present as shipped, so the stale recipe is advisory only.
    expect(verdict.outcome).toBe('PLAYABLE');
    expect(verdict.warnings).toHaveLength(1);
    expect(verdict.confidence).toBe('HIGH');
  });

  it('uses the real clock when no now is supplied', () => {
    const verdict = evaluate(
      profile([['a', 'BLOCKER']]),
      game({ recipes: [recipe(['a'], { verifiedAt: '2000-01-01T00:00:00.000Z' })] }),
    );

    expect(verdict.warnings).toHaveLength(1);
  });
});
