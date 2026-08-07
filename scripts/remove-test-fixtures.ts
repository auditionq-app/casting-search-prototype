// scripts/remove-test-fixtures.ts
//
// Removes all test fixture profiles added by add-test-fixtures.ts,
// identified by their @test-fixture.local email domain. Safe to run
// any time you want to clean these back out.
//
// Run with: npx tsx scripts/remove-test-fixtures.ts

import { prisma } from "../lib/prisma";

const TEST_EMAIL_DOMAIN = "test-fixture.local";

async function main() {
  const testUsers = await prisma.users.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    select: { id: true, email: true },
  });

  if (testUsers.length === 0) {
    console.log("No test fixtures found — nothing to remove.");
    return;
  }

  console.log(`Found ${testUsers.length} test fixture users. Removing...`);

  const userIds = testUsers.map((u) => u.id);

  // artist_profiles.user_id -> users.id has onDelete: NoAction, so
  // artist_profiles rows must be deleted explicitly before their users row.
  const deletedProfiles = await prisma.artist_profiles.deleteMany({
    where: { user_id: { in: userIds } },
  });

  const deletedUsers = await prisma.users.deleteMany({
    where: { id: { in: userIds } },
  });

  console.log(
    `Removed ${deletedProfiles.count} artist_profiles and ${deletedUsers.count} users.`
  );
}

main()
  .catch((err) => {
    console.error("remove-test-fixtures failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));