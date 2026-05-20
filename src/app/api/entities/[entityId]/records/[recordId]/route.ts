import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import {
  entities,
  entityRecords,
  entityRecordVersions,
} from "@/lib/db/schema";

async function getEntityForOrg(entityId: string, orgId: string) {
  return db.query.entities.findFirst({
    where: and(eq(entities.id, entityId), eq(entities.orgId, orgId)),
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityId: string; recordId: string }> }
) {
  try {
    const { entityId, recordId } = await params;
    const current = await requireResourceAccess("data", "read");
    const entity = await getEntityForOrg(entityId, current.organization.id);

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const record = await db.query.entityRecords.findFirst({
      where: and(
        eq(entityRecords.id, recordId),
        eq(entityRecords.entityId, entity.id)
      ),
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ record });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entityId: string; recordId: string }> }
) {
  try {
    const { entityId, recordId } = await params;
    const current = await requireResourceAccess("data", "update");
    const body = await request.json();
    const entity = await getEntityForOrg(entityId, current.organization.id);

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const data = body.data || {};
    const [record] = await db
      .update(entityRecords)
      .set({
        data,
        updatedBy: current.userId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(entityRecords.id, recordId), eq(entityRecords.entityId, entity.id))
      )
      .returning();

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await db.insert(entityRecordVersions).values({
      recordId: record.id,
      version: Date.now(),
      data,
      changedBy: current.userId,
    });

    return NextResponse.json({ record });
  } catch (error) {
    return routeError(error);
  }
}
