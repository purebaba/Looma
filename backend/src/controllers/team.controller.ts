import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Inject,
  NotFoundException,
  Post,
  Req,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { AccessService } from "../auth/access.service";
import { canManageMembers } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { organizationMembers, users } from "@/lib/db/schema";

@Controller("team")
export class TeamController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  @Post("members")
  async addMember(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const current = await this.access.requireResourceAccess(request, "team", "manage");
    if (!canManageMembers(current.membership.role)) throw new ForbiddenException("Forbidden");

    const email = String(body.email || "").toLowerCase().trim();
    const role = String(body.role || "member") as "owner" | "admin" | "manager" | "member" | "guest";
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      throw new NotFoundException("User must register before they can be added.");
    }

    const existing = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.orgId, current.organization.id),
        eq(organizationMembers.userId, user.id)
      ),
    });
    if (existing) throw new BadRequestException("User is already a member.");

    const [member] = await db
      .insert(organizationMembers)
      .values({ orgId: current.organization.id, userId: user.id, role })
      .returning();
    return { member };
  }
}
