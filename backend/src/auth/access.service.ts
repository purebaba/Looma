import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { getToken } from "next-auth/jwt";
import { eq } from "drizzle-orm";

import { canAccess, type Action, type Resource } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { organizationMembers, users } from "@/lib/db/schema";

@Injectable()
export class AccessService {
  async getUserId(request: unknown) {
    const token = await getToken({
      req: request as never,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://"),
    });
    const userId = (token?.id || token?.sub) as string | undefined;
    if (!userId) return null;
    return userId;
  }

  async getCurrentOrganization(request: unknown) {
    const userId = await this.getUserId(request);
    if (!userId) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user?.email) return null;

    const membership = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, userId),
      with: { organization: true },
    });

    if (!membership?.organization) return null;

    return {
      userId,
      userEmail: user.email,
      organization: membership.organization,
      membership,
    };
  }

  async requireResourceAccess(
    request: unknown,
    resource: Resource,
    action: Action
  ) {
    const current = await this.getCurrentOrganization(request);
    if (!current) throw new UnauthorizedException("Authentication required");
    if (!canAccess(current.membership.role, resource, action)) {
      throw new ForbiddenException("Forbidden");
    }
    return current;
  }
}
