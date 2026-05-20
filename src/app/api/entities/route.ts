import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { ensureDefaultApp, slugify } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields } from "@/lib/db/schema";

export async function GET() {
  try {
    const current = await requireResourceAccess("data", "read");
    const rows = await db
      .select()
      .from(entities)
      .where(eq(entities.orgId, current.organization.id))
      .orderBy(desc(entities.createdAt));

    const items = await Promise.all(
      rows.map(async (entity) => {
        const app = await db.query.apps.findFirst({
          where: eq(apps.id, entity.appId),
        });
        const fields = await db.query.entityFields.findMany({
          where: eq(entityFields.entityId, entity.id),
          orderBy: (table, { asc }) => [asc(table.order)],
        });
        return { ...entity, appName: app?.name ?? null, fields };
      })
    );

    return NextResponse.json({ entities: items });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireResourceAccess("data", "create");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const requestedApp = body.appId
      ? await db.query.apps.findFirst({
          where: and(
            eq(apps.id, String(body.appId)),
            eq(apps.orgId, current.organization.id)
          ),
        })
      : null;
    const app = requestedApp || (await ensureDefaultApp({
      orgId: current.organization.id,
      userId: current.userId,
    }));

    const [entity] = await db
      .insert(entities)
      .values({
        orgId: current.organization.id,
        appId: app.id,
        createdBy: current.userId,
        name,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        description: body.description || null,
        storageMode: "json",
      })
      .returning();

    const fields = Array.isArray(body.fields) ? body.fields : [];
    if (fields.length) {
      const usedSlugs = new Set<string>();
      await db.insert(entityFields).values(
        fields.map((field: Record<string, unknown>, index: number) => {
          const baseSlug = slugify(
            String(field.slug || field.name || field.label || `field-${index + 1}`)
          );
          let nextSlug = baseSlug;
          let suffix = 2;
          while (usedSlugs.has(nextSlug)) {
            nextSlug = `${baseSlug}-${suffix}`;
            suffix += 1;
          }
          usedSlugs.add(nextSlug);
          return {
            entityId: entity.id,
            name: String(field.name || field.label || `Field ${index + 1}`),
            slug: nextSlug,
            type: String(field.type || "text"),
            required: Boolean(field.required),
            config: field.config || {},
            order: index,
          };
        })
      );
    }

    return NextResponse.json({ entity }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
