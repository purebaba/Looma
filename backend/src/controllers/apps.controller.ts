import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";

import { AccessService } from "../auth/access.service";
import { slugify } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";

@Controller("apps")
export class AppsController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  @Get()
  async list(@Req() request: Request) {
    const current = await this.access.requireResourceAccess(request, "apps", "read");
    const rows = await db
      .select()
      .from(apps)
      .where(eq(apps.orgId, current.organization.id))
      .orderBy(desc(apps.createdAt));
    return { apps: rows };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const current = await this.access.requireResourceAccess(request, "apps", "create");
    const name = String(body.name || "").trim();
    if (!name) throw new BadRequestException("Name is required");

    const [app] = await db
      .insert(apps)
      .values({
        orgId: current.organization.id,
        createdBy: current.userId,
        name,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        description: body.description ? String(body.description) : null,
        status: "active",
      })
      .returning();

    return { app };
  }

  @Get(":appId")
  async get(@Req() request: Request, @Param("appId") appId: string) {
    const current = await this.access.requireResourceAccess(request, "apps", "read");
    const app = await db.query.apps.findFirst({
      where: and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)),
    });
    if (!app) throw new NotFoundException("App not found");
    return { app };
  }

  @Put(":appId")
  async update(
    @Req() request: Request,
    @Param("appId") appId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "apps", "update");
    const name = String(body.name || "").trim();
    if (!name) throw new BadRequestException("Name is required");

    const [app] = await db
      .update(apps)
      .set({
        name,
        slug: body.slug ? slugify(String(body.slug)) : undefined,
        description: body.description ? String(body.description) : null,
        status: body.status === "draft" || body.status === "archived" ? body.status : "active",
        updatedAt: new Date(),
      })
      .where(and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)))
      .returning();

    if (!app) throw new NotFoundException("App not found");
    return { app };
  }
}
