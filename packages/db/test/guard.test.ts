import { describe, expect, it } from 'vitest';
import { MissingProvenanceError, requireProvenance } from '../src/seed/guard.js';
import { slugify } from '../src/seed/taxonomy-source.js';
import { SOURCE_SEEDS } from '../src/seed/sources.js';

describe('requireProvenance', () => {
  it('accepts a real https source with a capture date', () => {
    const result = requireProvenance('a claim', {
      sourceUrl: 'https://accessiblegames.com/accessibility-tags/',
      capturedAt: '2026-07-28T00:00:00.000Z',
    });

    expect(result.sourceUrl).toBe('https://accessiblegames.com/accessibility-tags/');
    expect(result.capturedAt.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('accepts a Date instance for capturedAt', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(
      requireProvenance('a claim', {
        sourceUrl: 'https://example-publisher.test/accessibility',
        capturedAt: now,
      }).capturedAt,
    ).toEqual(now);
  });

  it.each([
    ['missing url', { capturedAt: '2026-07-28' }],
    ['empty url', { sourceUrl: '   ', capturedAt: '2026-07-28' }],
    ['not a url', { sourceUrl: 'somewhere in my memory', capturedAt: '2026-07-28' }],
    ['non-http scheme', { sourceUrl: 'file:///etc/passwd', capturedAt: '2026-07-28' }],
    ['placeholder host', { sourceUrl: 'https://example.com/x', capturedAt: '2026-07-28' }],
    ['another placeholder host', { sourceUrl: 'https://example.invalid/x', capturedAt: '2026-07-28' }],
    ['missing capturedAt', { sourceUrl: 'https://real.test/x' }],
    ['unparseable capturedAt', { sourceUrl: 'https://real.test/x', capturedAt: 'someday' }],
  ])('rejects %s', (_label, row) => {
    expect(() => requireProvenance('a claim', row)).toThrow(MissingProvenanceError);
  });

  it('names what it refused to write', () => {
    expect(() =>
      requireProvenance('taxonomy tag "narrated-menus"', { sourceUrl: '' }),
    ).toThrow(/taxonomy tag "narrated-menus"/);
  });
});

describe('slugify', () => {
  it.each([
    ['Narrated Menus', 'narrated-menus'],
    ['Large & Clear Subtitles', 'large-clear-subtitles'],
    ['  Save Anytime  ', 'save-anytime'],
    ['Playable with Keyboard Only', 'playable-with-keyboard-only'],
  ])('slugifies %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('source seeds', () => {
  it('has unique names', () => {
    const names = SOURCE_SEEDS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('assigns trust tiers consistent with the plan §5 ladder', () => {
    const tierOf = (name: string): number =>
      SOURCE_SEEDS.find((s) => s.name === name)?.trustTier ?? -1;

    expect(tierOf('First-party test')).toBeGreaterThan(
      tierOf('Publisher accessibility page'),
    );
    expect(tierOf('Publisher accessibility page')).toBeGreaterThan(
      tierOf('Can I Play That?'),
    );
    expect(tierOf('Can I Play That?')).toBeGreaterThan(
      tierOf('Community submission'),
    );
  });

  it('keeps every tier inside the 1..4 range', () => {
    for (const seed of SOURCE_SEEDS) {
      expect(seed.trustTier).toBeGreaterThanOrEqual(1);
      expect(seed.trustTier).toBeLessThanOrEqual(4);
    }
  });
});
