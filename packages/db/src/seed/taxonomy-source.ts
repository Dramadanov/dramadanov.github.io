/**
 * Fetch the Accessible Games Initiative tag set from source.
 *
 * Plan §6 Phase 0 requires the taxonomy to be *fetched*, not authored from
 * memory, with the source URL recorded on every row. This module does the
 * fetching and nothing else — it never falls back to a hardcoded tag list,
 * because a hardcoded list is exactly the failure mode the rule exists to
 * prevent. If the fetch fails, seeding fails, loudly.
 */

import {
  captureSource,
  type CaptureOptions,
  type CapturedSource,
} from './capture.js';

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
  /** sha256 of the page this tag was read from. */
  contentHash: string;
  /** Immutable copy of that page, when one could be made. */
  archiveUrl?: string;
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
 * Fetch one source page and capture it.
 *
 * Capture, not just fetch: the page is hashed and pushed to an archive so that
 * every tag row remains checkable after the source moves or changes. A URL alone
 * is a promise that something was once readable at an address.
 */
export async function fetchTagPage(
  url: string,
  options: CaptureOptions = {},
): Promise<CapturedSource> {
  try {
    return await captureSource(url, { archive: true, ...options });
  } catch (cause: unknown) {
    throw new TaxonomySourceUnavailableError(url, cause);
  }
}
