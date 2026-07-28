/**
 * Fetch the Accessible Games Initiative tag set from source.
 *
 * Plan §6 Phase 0 requires the taxonomy to be *fetched*, not authored from
 * memory, with the source URL recorded on every row. This module does the
 * fetching and nothing else — it never falls back to a hardcoded tag list,
 * because a hardcoded list is exactly the failure mode the rule exists to
 * prevent. If the fetch fails, seeding fails, loudly.
 */

export const AGI_TAG_SOURCES = [
  {
    name: 'Accessible Games Initiative — Tags',
    url: 'https://accessiblegames.com/accessibility-tags/',
  },
  {
    name: 'Microsoft Game Dev — Accessibility Feature Tags',
    url: 'https://learn.microsoft.com/en-us/xbox/accessibility/accessibility-feature-tags',
  },
] as const;

export interface FetchedTag {
  /** Slugified tag name, e.g. "narrated-menus". */
  slug: string;
  /** Verbatim tag name as published. */
  label: string;
  /** Verbatim criteria text as published. */
  description: string;
  /** Verbatim category heading as published, e.g. "Auditory". */
  rawCategory: string;
  /** The exact URL this row was read from. */
  sourceUrl: string;
  /** ISO timestamp of the fetch. */
  capturedAt: string;
}

export class TaxonomySourceUnavailableError extends Error {
  constructor(
    readonly url: string,
    readonly cause_: unknown,
  ) {
    super(
      `Could not fetch the AGI tag list from ${url}. ` +
        `Seeding is aborted rather than falling back to a remembered tag list — ` +
        `see the absolute rules in CLAUDE.md.`,
    );
    this.name = 'TaxonomySourceUnavailableError';
  }
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch and parse one source page.
 *
 * Deliberately left as an explicit TODO rather than a guessed selector: the
 * page structure has not been observed from this environment (outbound access
 * to accessiblegames.com and learn.microsoft.com is blocked by the network
 * policy here), and writing a parser against an imagined DOM would produce
 * silently wrong rows. Run this from an environment with network access,
 * inspect the markup, then implement the extraction.
 */
export async function fetchTagPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'text/html' },
  }).catch((cause: unknown) => {
    throw new TaxonomySourceUnavailableError(url, cause);
  });

  if (!response.ok) {
    throw new TaxonomySourceUnavailableError(
      url,
      new Error(`HTTP ${response.status}`),
    );
  }

  return response.text();
}
