import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { slugify } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { entities, entityFields } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const current = await requireResourceAccess("data", "read");
    const entity = await db.query.entities.findFirst({
      where: and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)),
      with: { fields: true },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    return NextResponse.json({ entity });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const current = await requireResourceAccess("data", "update");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [entity] = await db
      .update(entities)
      .set({
        name,
        description: body.description || null,
        updatedAt: new Date(),
      })
      .where(and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)))
      .returning();

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    if (Array.isArray(body.fields)) {
      await db.delete(entityFields).where(eq(entityFields.entityId, entity.id));
      const usedSlugs = new Set<string>();
      const fields = body.fields
        .map((field: Record<string, unknown>, index: number) => {
          const baseSlug = slugify(
            String(field.slug || field.name || `field-${index + 1}`)
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
            name: String(field.name || "").trim(),
            slug: nextSlug,
            type: String(field.type || "text"),
            required: Boolean(field.required),
            unique: Boolean(field.unique),
            defaultValue: field.defaultValue ?? null,
            config: field.config || {},
            order: index,
          };
        })
        .filter((field: { name: string }) => field.name);
      if (fields.length) {
        await db.insert(entityFields).values(fields);
      }
    }

    const fields = await db.query.entityFields.findMany({
      where: eq(entityFields.entityId, entity.id),
    });
    return NextResponse.json({ entity: { ...entity, fields } });
  } catch (error) {
    return routeError(error);
  }
}
