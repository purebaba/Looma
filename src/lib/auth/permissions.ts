import type { InferSelectModel } from "drizzle-orm";

import type { organizationMembers } from "@/lib/db/schema";

export type OrganizationRole = InferSelectModel<typeof organizationMembers>["role"];
export type Resource = "forms" | "workflows" | "agents" | "settings" | "team";
export type Action = "read" | "create" | "update" | "delete" | "publish" | "manage";

const roleRank: Record<OrganizationRole, number> = {
  guest: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function canAccess(role: OrganizationRole, resource: Resource, action: Action) {
  if (role === "owner" || role === "admin") return true;
  if (action === "read") return true;
  if (role === "manager" && resource !== "settings" && action !== "delete") {
    return true;
  }
  if (role === "member" && resource === "forms" && action === "create") {
    return true;
  }
  return false;
}

export function canManageMembers(role: OrganizationRole) {
  return roleRank[role] >= roleRank.admin;
}

export function isAtLeastRole(role: OrganizationRole, minimum: OrganizationRole) {
  return roleRank[role] >= roleRank[minimum];
}
