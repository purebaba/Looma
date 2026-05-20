import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { entities, entityFields, tableViews } from "@/lib/db/schema";
import {
  normalizeTableViewConfig,
  type TableViewConfig,
} from "@/lib/views/table-view";

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

    const view = await db.query.tableViews.findFirst({
      where: and(eq(tableViews.entityId, entity.id), eq(tableViews.isDefault, true)),
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
    const config = normalizeTableViewConfig(
      body.config as Partial<TableViewConfig>,
      fields
    );
    const existing = await db.query.tableViews.findFirst({
      where: and(eq(tableViews.entityId, entity.id), eq(tableViews.isDefault, true)),
    });

    if (existing) {
      const [view] = await db
        .update(tableViews)
        .set({
          name: String(body.name || "Default table").trim(),
          description: body.description || null,
          config,
          updatedAt: new Date(),
        })
        .where(eq(tableViews.id, existing.id))
        .returning();
      return NextResponse.json({ view });
    }

    const [view] = await db
      .insert(tableViews)
      .values({
        orgId: current.organization.id,
        appId: entity.appId,
        entityId: entity.id,
        createdBy: current.userId,
        name: String(body.name || "Default table").trim(),
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
