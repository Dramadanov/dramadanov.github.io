/**
 * Seed Source rows with trust tiers.
 *
 * Note what this is and is not. Trust tiers are *our own editorial policy* about
 * how much weight to give each kind of publisher — they are not accessibility
 * claims about any game, so authoring them here is legitimate. The rule against
 * writing data from memory applies to FeatureClaim and RecipeStep rows, which
 * assert facts about games. This file asserts nothing about any game.
 *
 * Ladder (plan §5):
 *   first-party testing > publisher/storefront > established reviewer > community
 */
import { PrismaClient, SourceKind } from '../../generated/client/client.js';

export interface SourceSeed {
  name: string;
  kind: SourceKind;
  trustTier: number;
}

export const SOURCE_SEEDS: SourceSeed[] = [
  {
    name: 'First-party test',
    kind: 'FIRSTPARTY_TEST',
    trustTier: 4,
  },
  { name: 'Publisher accessibility page', kind: 'PUBLISHER', trustTier: 3 },
  { name: 'Xbox Store', kind: 'STOREFRONT', trustTier: 3 },
  { name: 'Steam Store', kind: 'STOREFRONT', trustTier: 3 },
  { name: 'PlayStation Store', kind: 'STOREFRONT', trustTier: 3 },
  { name: 'Nintendo eShop', kind: 'STOREFRONT', trustTier: 3 },
  { name: 'Can I Play That?', kind: 'REVIEWER', trustTier: 2 },
  { name: 'DAGERSystem / Accessible Games Database', kind: 'REVIEWER', trustTier: 2 },
  { name: 'Community submission', kind: 'COMMUNITY', trustTier: 1 },
];

export async function seedSources(prisma: PrismaClient): Promise<number> {
  for (const seed of SOURCE_SEEDS) {
    await prisma.source.upsert({
      where: { name: seed.name },
      update: { kind: seed.kind, trustTier: seed.trustTier },
      create: seed,
    });
  }
  return SOURCE_SEEDS.length;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const count = await seedSources(prisma);
    console.log(`Seeded ${count} sources.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run directly, not when imported by a test.
if (process.argv[1]?.endsWith('sources.ts')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
