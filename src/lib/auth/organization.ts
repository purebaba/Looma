import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { organizationMembers, organizations, users } from "@/lib/db/schema";
import { canAccess, type Action, type Resource } from "@/lib/auth/permissions";

type Organization = typeof organizations.$inferSelect;
type Membership = typeof organizationMembers.$inferSelect;

export type CurrentOrganization = {
  userId: string;
  userEmail: string;
  organization: Organization;
  membership: Membership;
};

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

export async function getCurrentOrganization(): Promise<CurrentOrganization | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, session.user.id),
    with: {
      organization: true,
    },
  });

  if (!membership?.organization) return null;

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    organization: membership.organization,
    membership,
  };
}

export async function requireCurrentOrganization() {
  const current = await getCurrentOrganization();
  if (!current) redirect("/login");
  return current;
}

export async function requireResourceAccess(resource: Resource, action: Action) {
  const current = await requireCurrentOrganization();
  if (!canAccess(current.membership.role, resource, action)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return current;
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  });
}
