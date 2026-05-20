import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import {
  entities,
  entityRecords,
  entityRecordVersions,
} from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const current = await requireResourceAccess("data", "read");
    const entity = await db.query.entities.findFirst({
      where: and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)),
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const records = await db
      .select()
      .from(entityRecords)
      .where(eq(entityRecords.entityId, entity.id))
      .orderBy(desc(entityRecords.createdAt));

    return NextResponse.json({ records });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const current = await requireResourceAccess("data", "create");
    const body = await request.json();
    const entity = await db.query.entities.findFirst({
      where: and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)),
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const data = body.data || {};
    const [record] = await db
      .insert(entityRecords)
      .values({
        orgId: current.organization.id,
        appId: entity.appId,
        entityId: entity.id,
        data,
        createdBy: current.userId,
        updatedBy: current.userId,
      })
      .returning();

    await db.insert(entityRecordVersions).values({
      recordId: record.id,
      version: 1,
      data,
      changedBy: current.userId,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
