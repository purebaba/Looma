import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { findUserByEmail, requireResourceAccess } from "@/lib/auth/organization";
import { canManageMembers } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { organizationMembers } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const current = await requireResourceAccess("team", "manage");
    if (!canManageMembers(current.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const email = String(body.email || "").toLowerCase().trim();
    const role = body.role || "member";
    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "User must register before they can be added." },
        { status: 404 }
      );
    }

    const existing = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.orgId, current.organization.id),
        eq(organizationMembers.userId, user.id)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member." },
        { status: 400 }
      );
    }

    const [member] = await db
      .insert(organizationMembers)
      .values({
        orgId: current.organization.id,
        userId: user.id,
        role,
      })
      .returning();

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
