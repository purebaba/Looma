import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { slugify } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";

export async function GET() {
  try {
    const current = await requireResourceAccess("apps", "read");
    const rows = await db
      .select()
      .from(apps)
      .where(eq(apps.orgId, current.organization.id))
      .orderBy(desc(apps.createdAt));
    return NextResponse.json({ apps: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireResourceAccess("apps", "create");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [app] = await db
      .insert(apps)
      .values({
        orgId: current.organization.id,
        createdBy: current.userId,
        name,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        description: body.description || null,
        status: "active",
      })
      .returning();

    return NextResponse.json({ app }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
