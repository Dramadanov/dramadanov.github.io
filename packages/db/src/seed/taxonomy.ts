/**
 * Seed FeatureTaxonomy from the AGI tag set.
 *
 * Run with: pnpm --filter @access-profile/db seed:taxonomy
 *
 * This script fetches. It has no embedded tag list and no fallback, by design.
 * If the network is unavailable it exits non-zero with an explanation, and the
 * taxonomy table stays empty — an empty table is a correct, honest state; a
 * table full of remembered tags is not.
 */
import {
  AGI_TAG_SOURCES,
  TaxonomySourceUnavailableError,
  fetchTagPage,
  type FetchedTag,
} from './taxonomy-source.js';
import { requireProvenance } from './guard.js';

async function collectTags(): Promise<FetchedTag[]> {
  const tags: FetchedTag[] = [];

  for (const source of AGI_TAG_SOURCES) {
    const html = await fetchTagPage(source.url);
    const parsed = parseTags(html, source.url);
    tags.push(...parsed);
  }

  return tags;
}

/**
 * Extract tag rows from a fetched page.
 *
 * NOT YET IMPLEMENTED. The parser must be written against the real markup, with
 * the page open. Guessing at selectors here would produce rows that look sourced
 * but are not, which is worse than having none.
 */
function parseTags(html: string, sourceUrl: string): FetchedTag[] {
  void html;
  throw new Error(
    `No parser implemented for ${sourceUrl}. ` +
      `Fetch the page, inspect its markup, and implement parseTags against what ` +
      `is actually there. Do not populate this from memory.`,
  );
}

async function main(): Promise<void> {
  let tags: FetchedTag[];

  try {
    tags = await collectTags();
  } catch (error) {
    if (error instanceof TaxonomySourceUnavailableError) {
      console.error(error.message);
      console.error(
        '\nThe taxonomy table has been left empty. This is the intended ' +
          'behaviour when sources are unreachable.',
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  // Every row is provenance-checked before it goes near the database.
  for (const tag of tags) {
    requireProvenance(`taxonomy tag "${tag.slug}"`, tag);
  }

  console.log(`Fetched ${tags.length} sourced taxonomy tags.`);
  console.log(
    'Next: map rawCategory onto TaxonomyCategory and upsert by slug via Prisma.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
