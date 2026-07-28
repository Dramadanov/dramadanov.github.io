/**
 * Provenance guard.
 *
 * The single rule this codebase cannot bend: no accessibility row is written
 * without a real source URL and a capture timestamp. This is enforced in code,
 * at the seam where data enters the database, so that a well-meaning "just for
 * now" seed cannot slip past review.
 */

export class MissingProvenanceError extends Error {
  constructor(what: string, detail: string) {
    super(`Refusing to write ${what}: ${detail}`);
    this.name = 'MissingProvenanceError';
  }
}

export interface Provenanced {
  sourceUrl?: string | undefined;
  capturedAt?: string | Date | undefined;
}

const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'example.invalid',
  'localhost',
]);

/**
 * Throws unless the row carries a plausible, non-placeholder source URL and a
 * parseable capture date. Returns the normalised pair on success.
 */
export function requireProvenance(
  what: string,
  row: Provenanced,
): { sourceUrl: string; capturedAt: Date } {
  const { sourceUrl, capturedAt } = row;

  if (typeof sourceUrl !== 'string' || sourceUrl.trim() === '') {
    throw new MissingProvenanceError(what, 'sourceUrl is empty');
  }

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new MissingProvenanceError(what, `sourceUrl is not a URL: ${sourceUrl}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new MissingProvenanceError(
      what,
      `sourceUrl must be http(s), got ${url.protocol}`,
    );
  }

  if (PLACEHOLDER_HOSTS.has(url.hostname)) {
    throw new MissingProvenanceError(
      what,
      `sourceUrl points at the placeholder host ${url.hostname}. ` +
        `A real, fetched source is required.`,
    );
  }

  if (capturedAt === undefined) {
    throw new MissingProvenanceError(what, 'capturedAt is missing');
  }

  const captured =
    capturedAt instanceof Date ? capturedAt : new Date(capturedAt);

  if (Number.isNaN(captured.getTime())) {
    throw new MissingProvenanceError(
      what,
      `capturedAt is not a valid date: ${String(capturedAt)}`,
    );
  }

  return { sourceUrl, capturedAt: captured };
}
