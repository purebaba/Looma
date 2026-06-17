import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";

async function main() {
  const email = "owner@looma.local";
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    console.log("Seed user already exists:", email);
    return;
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: "Looma Owner",
      passwordHash: await bcrypt.hash("password123", 12),
    })
    .returning();

  const [organization] = await db
    .insert(organizations)
    .values({
      name: "Looma Demo",
      slug: "looma-demo",
    })
    .returning();

  await db.insert(organizationMembers).values({
    orgId: organization.id,
    userId: user.id,
    role: "owner",
  });

  console.log("Seeded demo account:");
  console.log("  email: owner@looma.local");
  console.log("  password: password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
