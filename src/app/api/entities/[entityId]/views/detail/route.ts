import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { detailViews, entities, entityFields } from "@/lib/db/schema";
import {
  normalizeDetailViewConfig,
  type DetailViewConfig,
} from "@/lib/views/detail-view";

async function getEntityForOrg(entityId: string, orgId: string) {
  return db.query.entities.findFirst({
    where: and(eq(entities.id, entityId), eq(entities.orgId, orgId)),
  });
}

async function getFields(entityId: string) {
  return db.query.entityFields.findMany({
    where: eq(entityFields.entityId, entityId),
    orderBy: (table, { asc }) => [asc(table.order)],
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const current = await requireResourceAccess("data", "read");
    const entity = await getEntityForOrg(entityId, current.organization.id);

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const view = await db.query.detailViews.findFirst({
      where: and(eq(detailViews.entityId, entity.id), eq(detailViews.isDefault, true)),
    });

    return NextResponse.json({ view });
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
    const entity = await getEntityForOrg(entityId, current.organization.id);

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const fields = await getFields(entity.id);
    const config = normalizeDetailViewConfig(
      body.config as Partial<DetailViewConfig>,
      fields
    );
    const existing = await db.query.detailViews.findFirst({
      where: and(eq(detailViews.entityId, entity.id), eq(detailViews.isDefault, true)),
    });

    if (existing) {
      const [view] = await db
        .update(detailViews)
        .set({
          name: String(body.name || "Default detail").trim(),
          description: body.description || null,
          config,
          updatedAt: new Date(),
        })
        .where(eq(detailViews.id, existing.id))
        .returning();
      return NextResponse.json({ view });
    }

    const [view] = await db
      .insert(detailViews)
      .values({
        orgId: current.organization.id,
        appId: entity.appId,
        entityId: entity.id,
        createdBy: current.userId,
        name: String(body.name || "Default detail").trim(),
        description: body.description || null,
        config,
        isDefault: true,
      })
      .returning();

    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
