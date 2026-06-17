import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { and, asc, count, desc, eq, or } from "drizzle-orm";

import { AccessService } from "../auth/access.service";
import { ensureDefaultApp, slugify } from "@/lib/data/modeling";
import { validateRecordData, checkUniqueConstraints, validateReferenceIntegrity } from "@/lib/data/record-validation";
import { db } from "@/lib/db/client";
import {
  apps,
  detailViews,
  entities,
  entityFields,
  entityRecords,
  entityRecordVersions,
  entityRelations,
  tableViews,
} from "@/lib/db/schema";
import {
  normalizeDetailViewConfig,
  type DetailViewConfig,
} from "@/lib/views/detail-view";
import {
  normalizeTableViewConfig,
  type TableViewConfig,
} from "@/lib/views/table-view";

@Controller("entities")
export class EntitiesController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  private async getEntityForOrg(entityId: string, orgId: string) {
    return db.query.entities.findFirst({
      where: and(eq(entities.id, entityId), eq(entities.orgId, orgId)),
    });
  }

  private getFields(entityId: string) {
    return db.query.entityFields.findMany({
      where: eq(entityFields.entityId, entityId),
      orderBy: (table, { asc }) => [asc(table.order)],
    });
  }

  private async syncEntityRelations(
    entityId: string,
    fields: Array<typeof entityFields.$inferSelect>,
    orgId: string,
  ) {
    await db.delete(entityRelations).where(eq(entityRelations.sourceEntityId, entityId));

    for (const field of fields) {
      if (field.type !== "reference") continue;
      const config = (field.config || {}) as Record<string, unknown>;
      const targetEntityId = config.targetEntityId as string | undefined;
      if (!targetEntityId) continue;

      await db.insert(entityRelations).values({
        orgId,
        sourceEntityId: entityId,
        sourceFieldId: field.id,
        targetEntityId,
        type: "reference",
      });
    }
  }

  @Get()
  async list(@Req() request: Request) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const rows = await db
      .select()
      .from(entities)
      .where(eq(entities.orgId, current.organization.id))
      .orderBy(desc(entities.createdAt));

    const items = await Promise.all(
      rows.map(async (entity) => {
        const app = await db.query.apps.findFirst({ where: eq(apps.id, entity.appId) });
        const fields = await this.getFields(entity.id);
        return { ...entity, appName: app?.name ?? null, fields };
      })
    );

    return { entities: items };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const current = await this.access.requireResourceAccess(request, "data", "create");
    const name = String(body.name || "").trim();
    if (!name) throw new BadRequestException("Name is required");

    const requestedApp = body.appId
      ? await db.query.apps.findFirst({
          where: and(
            eq(apps.id, String(body.appId)),
            eq(apps.orgId, current.organization.id)
          ),
        })
      : null;
    const app =
      requestedApp ||
      (await ensureDefaultApp({
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
        description: body.description ? String(body.description) : null,
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
          while (usedSlugs.has(nextSlug)) nextSlug = `${baseSlug}-${suffix++}`;
          usedSlugs.add(nextSlug);
          return {
            entityId: entity.id,
            name: String(field.name || field.label || `Field ${index + 1}`),
            slug: nextSlug,
            type: String(field.type || "text"),
            required: Boolean(field.required),
            unique: Boolean(field.unique),
            defaultValue: field.defaultValue ?? null,
            config: field.config || {},
            order: index,
          };
        })
      );

      const createdFields = await db
        .select()
        .from(entityFields)
        .where(eq(entityFields.entityId, entity.id));
      await this.syncEntityRelations(entity.id, createdFields, current.organization.id);
    }

    return { entity };
  }

  @Get(":entityId")
  async get(@Req() request: Request, @Param("entityId") entityId: string) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const entity = await db.query.entities.findFirst({
      where: and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)),
      with: { fields: true },
    });
    if (!entity) throw new NotFoundException("Entity not found");
    return { entity };
  }

  @Put(":entityId")
  async update(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "update");
    const name = String(body.name || "").trim();
    if (!name) throw new BadRequestException("Name is required");

    const [entity] = await db
      .update(entities)
      .set({
        name,
        description: body.description ? String(body.description) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)))
      .returning();
    if (!entity) throw new NotFoundException("Entity not found");

    if (Array.isArray(body.fields)) {
      await db.delete(entityFields).where(eq(entityFields.entityId, entity.id));
      await db.delete(entityRelations).where(eq(entityRelations.sourceEntityId, entity.id));
      const usedSlugs = new Set<string>();
      const fields = body.fields
        .map((field: Record<string, unknown>, index: number) => {
          const baseSlug = slugify(String(field.slug || field.name || `field-${index + 1}`));
          let nextSlug = baseSlug;
          let suffix = 2;
          while (usedSlugs.has(nextSlug)) nextSlug = `${baseSlug}-${suffix++}`;
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
        const createdFields = await db
          .select()
          .from(entityFields)
          .where(eq(entityFields.entityId, entity.id));
        await this.syncEntityRelations(entity.id, createdFields, current.organization.id);
      }
    }

    const fields = await db.query.entityFields.findMany({
      where: eq(entityFields.entityId, entity.id),
    });
    return { entity: { ...entity, fields } };
  }

  @Get(":entityId/records")
  async records(@Req() request: Request, @Param("entityId") entityId: string) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const records = await db
      .select()
      .from(entityRecords)
      .where(eq(entityRecords.entityId, entity.id))
      .orderBy(desc(entityRecords.createdAt));
    return { records };
  }

  @Post(":entityId/records")
  async createRecord(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "create");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");

    const fields = await this.getFields(entity.id);
    const data = (body.data || {}) as Record<string, unknown>;

    const validation = validateRecordData(data, fields, { mode: "create" });
    if (!validation.valid) {
      throw new BadRequestException({
        error: "Validation failed",
        errors: validation.errors,
      });
    }

    const uniqueErrors = await checkUniqueConstraints(data, fields, db, {
      entityId: entity.id,
    });
    if (uniqueErrors.length > 0) {
      throw new ConflictException({
        error: "Unique constraint violation",
        errors: uniqueErrors,
      });
    }

    const refErrors = await validateReferenceIntegrity(data, fields, db, current.organization.id);
    if (refErrors.length > 0) {
      throw new BadRequestException({
        error: "Referential integrity violation",
        errors: refErrors,
      });
    }

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
    return { record };
  }

  @Get(":entityId/records/:recordId")
  async record(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Param("recordId") recordId: string
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const record = await db.query.entityRecords.findFirst({
      where: and(eq(entityRecords.id, recordId), eq(entityRecords.entityId, entity.id)),
    });
    if (!record) throw new NotFoundException("Record not found");
    return { record };
  }

  @Put(":entityId/records/:recordId")
  async updateRecord(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Param("recordId") recordId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "update");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");

    const existingRecord = await db.query.entityRecords.findFirst({
      where: and(eq(entityRecords.id, recordId), eq(entityRecords.entityId, entity.id)),
    });
    if (!existingRecord) throw new NotFoundException("Record not found");

    const fields = await this.getFields(entity.id);
    const incomingData = (body.data || {}) as Record<string, unknown>;
    const mergedData = {
      ...(existingRecord.data as Record<string, unknown>),
      ...incomingData,
    };

    const validation = validateRecordData(mergedData, fields, { mode: "update" });
    if (!validation.valid) {
      throw new BadRequestException({
        error: "Validation failed",
        errors: validation.errors,
      });
    }

    const uniqueErrors = await checkUniqueConstraints(mergedData, fields, db, {
      entityId: entity.id,
      excludeRecordId: recordId,
    });
    if (uniqueErrors.length > 0) {
      throw new ConflictException({
        error: "Unique constraint violation",
        errors: uniqueErrors,
      });
    }

    const refErrors = await validateReferenceIntegrity(mergedData, fields, db, current.organization.id);
    if (refErrors.length > 0) {
      throw new BadRequestException({
        error: "Referential integrity violation",
        errors: refErrors,
      });
    }

    const [record] = await db
      .update(entityRecords)
      .set({ data: mergedData, updatedBy: current.userId, updatedAt: new Date() })
      .where(and(eq(entityRecords.id, recordId), eq(entityRecords.entityId, entity.id)))
      .returning();
    if (!record) throw new NotFoundException("Record not found");

    const [versionCount] = await db
      .select({ value: count() })
      .from(entityRecordVersions)
      .where(eq(entityRecordVersions.recordId, record.id));
    await db.insert(entityRecordVersions).values({
      recordId: record.id,
      version: (versionCount?.value ?? 0) + 1,
      data: mergedData,
      changedBy: current.userId,
    });
    return { record };
  }

  @Delete(":entityId/records/:recordId")
  async deleteRecord(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Param("recordId") recordId: string,
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "delete");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");

    const record = await db.query.entityRecords.findFirst({
      where: and(eq(entityRecords.id, recordId), eq(entityRecords.entityId, entity.id)),
    });
    if (!record) throw new NotFoundException("Record not found");

    const blockingRelations = await db
      .select({
        id: entityRelations.id,
        sourceEntityId: entityRelations.sourceEntityId,
        sourceFieldId: entityRelations.sourceFieldId,
      })
      .from(entityRelations)
      .where(eq(entityRelations.targetEntityId, entity.id));

    if (blockingRelations.length > 0) {
      for (const rel of blockingRelations) {
        if (!rel.sourceFieldId) continue;
        const sourceRecords = await db
          .select()
          .from(entityRecords)
          .where(eq(entityRecords.entityId, rel.sourceEntityId));

        const sourceField = await db.query.entityFields.findFirst({
          where: eq(entityFields.id, rel.sourceFieldId),
        });

        for (const sourceRecord of sourceRecords) {
          const sourceData = sourceRecord.data as Record<string, unknown>;
          if (sourceData[sourceField?.slug ?? ""] === recordId) {
            throw new ConflictException({
              error: "Record is referenced by other records",
              message: `Cannot delete this record because it is referenced by records in another entity.`,
            });
          }
        }
      }
    }

    await db.delete(entityRecordVersions).where(eq(entityRecordVersions.recordId, record.id));
    await db.delete(entityRecords).where(eq(entityRecords.id, record.id));
    return { success: true };
  }

  @Get(":entityId/relations")
  async relations(@Req() request: Request, @Param("entityId") entityId: string) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");

    const outgoing = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.sourceEntityId, entity.id));

    const incoming = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.targetEntityId, entity.id));

    const allEntityIds = new Set<string>();
    for (const rel of [...outgoing, ...incoming]) {
      allEntityIds.add(rel.sourceEntityId);
      allEntityIds.add(rel.targetEntityId);
    }
    const allFieldIds = new Set<string>();
    for (const rel of [...outgoing, ...incoming]) {
      if (rel.sourceFieldId) allFieldIds.add(rel.sourceFieldId);
      if (rel.targetFieldId) allFieldIds.add(rel.targetFieldId);
    }

    const entityMap = new Map<string, typeof entities.$inferSelect>();
    const fieldMap = new Map<string, typeof entityFields.$inferSelect>();

    if (allEntityIds.size > 0) {
      const entityRows = await db
        .select()
        .from(entities)
        .where(and(eq(entities.orgId, current.organization.id)));
      for (const row of entityRows) entityMap.set(row.id, row);
    }
    if (allFieldIds.size > 0) {
      const fieldRows = await db
        .select()
        .from(entityFields)
        .where(and(eq(entityFields.entityId, entity.id)));
      for (const row of fieldRows) fieldMap.set(row.id, row);
    }

    const resolveRelation = (rel: typeof entityRelations.$inferSelect) => ({
      ...rel,
      sourceEntityName: entityMap.get(rel.sourceEntityId)?.name ?? null,
      targetEntityName: entityMap.get(rel.targetEntityId)?.name ?? null,
      sourceFieldName: rel.sourceFieldId ? (fieldMap.get(rel.sourceFieldId)?.name ?? null) : null,
      targetFieldName: rel.targetFieldId ? (fieldMap.get(rel.targetFieldId)?.name ?? null) : null,
    });

    return {
      relations: {
        outgoing: outgoing.map(resolveRelation),
        incoming: incoming.map(resolveRelation),
      },
    };
  }

  @Get(":entityId/views/table")
  async tableView(@Req() request: Request, @Param("entityId") entityId: string) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const views = await db
      .select()
      .from(tableViews)
      .where(eq(tableViews.entityId, entity.id))
      .orderBy(asc(tableViews.createdAt));
    return { view: views.find((item) => item.isDefault) || views[0] || null, views };
  }

  @Post(":entityId/views/table")
  async createTableView(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "update");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const fields = await this.getFields(entity.id);
    const config = normalizeTableViewConfig(body.config as Partial<TableViewConfig>, fields);
    const isDefault = Boolean(body.isDefault);
    if (isDefault) {
      await db
        .update(tableViews)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(tableViews.entityId, entity.id));
    }
    const [view] = await db
      .insert(tableViews)
      .values({
        orgId: current.organization.id,
        appId: entity.appId,
        entityId: entity.id,
        createdBy: current.userId,
        name: String(body.name || "New table view").trim(),
        description: body.description ? String(body.description) : null,
        config,
        isDefault,
      })
      .returning();
    return { view };
  }

  @Put(":entityId/views/table")
  async updateTableView(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "update");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const fields = await this.getFields(entity.id);
    const config = normalizeTableViewConfig(body.config as Partial<TableViewConfig>, fields);
    const requestedViewId = body.viewId ? String(body.viewId) : null;
    const existing = requestedViewId
      ? await db.query.tableViews.findFirst({
          where: and(eq(tableViews.id, requestedViewId), eq(tableViews.entityId, entity.id)),
        })
      : await db.query.tableViews.findFirst({
          where: and(eq(tableViews.entityId, entity.id), eq(tableViews.isDefault, true)),
        });
    if (!existing) throw new NotFoundException("View not found");
    const isDefault = Boolean(body.isDefault);
    if (isDefault) {
      await db
        .update(tableViews)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(tableViews.entityId, entity.id));
    }
    const [view] = await db
      .update(tableViews)
      .set({
        name: String(body.name || "Default table").trim(),
        description: body.description ? String(body.description) : null,
        config,
        isDefault,
        updatedAt: new Date(),
      })
      .where(eq(tableViews.id, existing.id))
      .returning();
    return { view };
  }

  @Get(":entityId/views/detail")
  async detailView(@Req() request: Request, @Param("entityId") entityId: string) {
    const current = await this.access.requireResourceAccess(request, "data", "read");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const view = await db.query.detailViews.findFirst({
      where: and(eq(detailViews.entityId, entity.id), eq(detailViews.isDefault, true)),
    });
    return { view };
  }

  @Put(":entityId/views/detail")
  async updateDetailView(
    @Req() request: Request,
    @Param("entityId") entityId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "data", "update");
    const entity = await this.getEntityForOrg(entityId, current.organization.id);
    if (!entity) throw new NotFoundException("Entity not found");
    const fields = await this.getFields(entity.id);
    const config = normalizeDetailViewConfig(body.config as Partial<DetailViewConfig>, fields);
    const existing = await db.query.detailViews.findFirst({
      where: and(eq(detailViews.entityId, entity.id), eq(detailViews.isDefault, true)),
    });

    if (existing) {
      const [view] = await db
        .update(detailViews)
        .set({
          name: String(body.name || "Default detail").trim(),
          description: body.description ? String(body.description) : null,
          config,
          updatedAt: new Date(),
        })
        .where(eq(detailViews.id, existing.id))
        .returning();
      return { view };
    }

    const [view] = await db
      .insert(detailViews)
      .values({
        orgId: current.organization.id,
        appId: entity.appId,
        entityId: entity.id,
        createdBy: current.userId,
        name: String(body.name || "Default detail").trim(),
        description: body.description ? String(body.description) : null,
        config,
        isDefault: true,
      })
      .returning();
    return { view };
  }
}
