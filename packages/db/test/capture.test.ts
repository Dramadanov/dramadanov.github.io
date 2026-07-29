import { describe, expect, it, vi } from 'vitest';
import {
  SourceCaptureError,
  captureSource,
  hashContent,
  sourceHasChanged,
  waybackSaveUrl,
  waybackSnapshotUrl,
  type FetchLike,
} from '../src/seed/capture.js';

const NOW = new Date('2026-07-29T12:34:56.000Z');

function fetchReturning(
  body: string,
  init: { ok?: boolean; status?: number } = {},
): FetchLike {
  return vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => body,
  }));
}

describe('hashContent', () => {
  it('is stable for identical bodies', () => {
    expect(hashContent('<html>captions</html>')).toBe(
      hashContent('<html>captions</html>'),
    );
  });

  it('differs for any change at all', () => {
    expect(hashContent('captions: yes')).not.toBe(hashContent('captions: no'));
  });

  it('produces lowercase hex sha256', () => {
    expect(hashContent('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('captureSource', () => {
  it('records url, capture time and a hash of what was read', async () => {
    const captured = await captureSource('https://publisher.test/a11y', {
      fetchImpl: fetchReturning('<html>captions</html>'),
      now: NOW,
    });

    expect(captured.sourceUrl).toBe('https://publisher.test/a11y');
    expect(captured.capturedAt).toEqual(NOW);
    expect(captured.contentHash).toBe(hashContent('<html>captions</html>'));
  });

  it('does not archive unless asked', async () => {
    const fetchImpl = fetchReturning('<html>x</html>');
    const captured = await captureSource('https://publisher.test/a11y', {
      fetchImpl,
      now: NOW,
    });

    expect(captured.archiveUrl).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns an archive url when archiving succeeds', async () => {
    const captured = await captureSource('https://publisher.test/a11y', {
      fetchImpl: fetchReturning('<html>x</html>'),
      now: NOW,
      archive: true,
    });

    expect(captured.archiveUrl).toBe(
      waybackSnapshotUrl('https://publisher.test/a11y', NOW),
    );
  });

  it('keeps the capture when archiving fails', async () => {
    // An archive outage must not cost us a hashed claim.
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      if (url.startsWith('https://web.archive.org')) throw new Error('down');
      return { ok: true, status: 200, text: async () => '<html>x</html>' };
    });

    const captured = await captureSource('https://publisher.test/a11y', {
      fetchImpl,
      now: NOW,
      archive: true,
    });

    expect(captured.contentHash).toBe(hashContent('<html>x</html>'));
    expect(captured.archiveUrl).toBeUndefined();
  });

  it('keeps the capture when the archive returns an error status', async () => {
    const fetchImpl: FetchLike = vi.fn(async (url: string) =>
      url.startsWith('https://web.archive.org')
        ? { ok: false, status: 523, text: async () => '' }
        : { ok: true, status: 200, text: async () => '<html>x</html>' },
    );

    const captured = await captureSource('https://publisher.test/a11y', {
      fetchImpl,
      now: NOW,
      archive: true,
    });

    expect(captured.archiveUrl).toBeUndefined();
  });

  it('rejects a non-URL', async () => {
    await expect(
      captureSource('somewhere in my memory', { fetchImpl: fetchReturning('x') }),
    ).rejects.toThrow(SourceCaptureError);
  });

  it('rejects a non-http protocol', async () => {
    await expect(
      captureSource('file:///etc/passwd', { fetchImpl: fetchReturning('x') }),
    ).rejects.toThrow(/unsupported protocol/);
  });

  it('rejects an error response', async () => {
    await expect(
      captureSource('https://publisher.test/gone', {
        fetchImpl: fetchReturning('', { ok: false, status: 404 }),
      }),
    ).rejects.toThrow(/HTTP 404/);
  });

  it('rejects an empty body — there is nothing to hash', async () => {
    await expect(
      captureSource('https://publisher.test/blank', {
        fetchImpl: fetchReturning('   \n  '),
      }),
    ).rejects.toThrow(/empty response body/);
  });

  it('surfaces a network failure as a capture error', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(
      captureSource('https://publisher.test/a11y', { fetchImpl }),
    ).rejects.toThrow(SourceCaptureError);
  });
});

describe('archive urls', () => {
  it('builds the save endpoint', () => {
    expect(waybackSaveUrl('https://publisher.test/a')).toBe(
      'https://web.archive.org/save/https://publisher.test/a',
    );
  });

  it('builds a timestamped snapshot url', () => {
    expect(waybackSnapshotUrl('https://publisher.test/a', NOW)).toBe(
      'https://web.archive.org/web/20260729123456/https://publisher.test/a',
    );
  });
});

describe('sourceHasChanged', () => {
  it('is false when the page still hashes the same', () => {
    const body = '<html>captions</html>';
    expect(sourceHasChanged({ contentHash: hashContent(body) }, body)).toBe(false);
  });

  it('is true when the page has been edited', () => {
    expect(
      sourceHasChanged({ contentHash: hashContent('captions: yes') }, 'captions: no'),
    ).toBe(true);
  });
});
