import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";

export async function PUT(request: Request) {
  try {
    const current = await requireResourceAccess("settings", "update");
    const body = await request.json();
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    const [organization] = await db
      .update(organizations)
      .set({ name, slug, updatedAt: new Date() })
      .where(eq(organizations.id, current.organization.id))
      .returning();

    return NextResponse.json({ organization });
  } catch (error) {
    return routeError(error);
  }
}
