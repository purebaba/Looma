import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { slugify } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;
    const current = await requireResourceAccess("apps", "read");
    const app = await db.query.apps.findFirst({
      where: and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)),
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({ app });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;
    const current = await requireResourceAccess("apps", "update");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [app] = await db
      .update(apps)
      .set({
        name,
        slug: body.slug ? slugify(String(body.slug)) : undefined,
        description: body.description || null,
        status: body.status || "active",
        updatedAt: new Date(),
      })
      .where(and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)))
      .returning();

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({ app });
  } catch (error) {
    return routeError(error);
  }
}
