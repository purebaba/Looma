import { BadRequestException, Body, Controller, Inject, Put, Req } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { AccessService } from "../auth/access.service";
import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";

@Controller("organizations")
export class OrganizationsController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  @Put("current")
  async updateCurrent(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const current = await this.access.requireResourceAccess(request, "settings", "update");
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!name || !slug) throw new BadRequestException("Name and slug are required");

    const [organization] = await db
      .update(organizations)
      .set({ name, slug, updatedAt: new Date() })
      .where(eq(organizations.id, current.organization.id))
      .returning();
    return { organization };
  }
}
