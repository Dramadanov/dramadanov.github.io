/**
 * Source capture.
 *
 * A `sourceUrl` alone is a promise that something was once readable at an
 * address. In three years a meaningful share of those addresses will 404, sit
 * behind a paywall, or quietly say something different — and an unverifiable
 * claim of provenance is barely better than none.
 *
 * So capture records three things, not one:
 *   - the URL that was read
 *   - a hash of exactly what was read
 *   - where an immutable copy of it lives
 *
 * This is nearly free while ingesting and impossible to do retroactively. The
 * project exists because things disappear when nobody archives them; the
 * dataset should not have the same shape of hole.
 */
import { createHash } from 'node:crypto';

export interface CapturedSource {
  sourceUrl: string;
  capturedAt: Date;
  /** sha256 of the response body, lowercase hex. */
  contentHash: string;
  /** Immutable copy, when one could be made. */
  archiveUrl?: string;
  /** Exactly what was read — the bytes `contentHash` covers. */
  body: string;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export class SourceCaptureError extends Error {
  constructor(
    readonly url: string,
    detail: string,
  ) {
    super(`Could not capture ${url}: ${detail}`);
    this.name = 'SourceCaptureError';
  }
}

export function hashContent(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/** The Wayback Machine's save endpoint. Public, documented, no key required. */
export function waybackSaveUrl(url: string): string {
  return `https://web.archive.org/save/${url}`;
}

/** Where a snapshot taken at a given instant will live. */
export function waybackSnapshotUrl(url: string, capturedAt: Date): string {
  const stamp = capturedAt
    .toISOString()
    .replace(/[-:T]/g, '')
    .replace(/\..+$/, '');
  return `https://web.archive.org/web/${stamp}/${url}`;
}

export interface CaptureOptions {
  fetchImpl?: FetchLike;
  now?: Date;
  /**
   * Submit the URL to the Wayback Machine. Off by default: it is an outbound
   * side effect on a third-party service, so callers opt in.
   */
  archive?: boolean;
}

/**
 * Fetch a source, hash what came back, and optionally push a copy to an archive.
 *
 * `fetchImpl` is injectable so this is testable without network access — which
 * matters, because the environments this runs in do not always have any.
 */
export async function captureSource(
  url: string,
  options: CaptureOptions = {},
): Promise<CapturedSource> {
  const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const now = options.now ?? new Date();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SourceCaptureError(url, 'not a valid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SourceCaptureError(url, `unsupported protocol ${parsed.protocol}`);
  }

  const response = await doFetch(url, { headers: { accept: 'text/html' } }).catch(
    (cause: unknown) => {
      throw new SourceCaptureError(url, String(cause));
    },
  );

  if (!response.ok) {
    throw new SourceCaptureError(url, `HTTP ${response.status}`);
  }

  const body = await response.text();
  if (body.trim() === '') {
    throw new SourceCaptureError(url, 'empty response body');
  }

  const captured: CapturedSource = {
    sourceUrl: url,
    capturedAt: now,
    contentHash: hashContent(body),
    body,
  };

  if (options.archive === true) {
    const archiveUrl = await submitToArchive(url, now, doFetch);
    if (archiveUrl !== undefined) captured.archiveUrl = archiveUrl;
  }

  return captured;
}

/**
 * Best-effort archive submission. A failure here must never lose the capture:
 * a hashed claim with no archive URL is still far better than no claim, so this
 * swallows errors and returns undefined rather than throwing.
 */
async function submitToArchive(
  url: string,
  now: Date,
  doFetch: FetchLike,
): Promise<string | undefined> {
  try {
    const response = await doFetch(waybackSaveUrl(url));
    if (!response.ok) return undefined;
    return waybackSnapshotUrl(url, now);
  } catch {
    return undefined;
  }
}

/**
 * Has the source changed since it was captured?
 *
 * Used by the staleness job: a claim whose source no longer hashes the same is
 * not necessarily wrong, but it is no longer evidenced by what was read.
 */
export function sourceHasChanged(
  captured: Pick<CapturedSource, 'contentHash'>,
  currentBody: string,
): boolean {
  return hashContent(currentBody) !== captured.contentHash;
}
