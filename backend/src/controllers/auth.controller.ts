import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { organizationMembers, organizations, users } from "@/lib/db/schema";

@Controller("auth")
export class AuthController {
  @Post("register")
  async register(@Body() body: Record<string, unknown>) {
    const name = String(body.name || "").trim();
    const normalizedEmail = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!name || !normalizedEmail || !password) {
      throw new BadRequestException("Missing required fields");
    }
    if (password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    if (existingUser) throw new BadRequestException("User already exists");

    const passwordHash = await bcrypt.hash(password, 12);
    const [newUser] = await db
      .insert(users)
      .values({ name, email: normalizedEmail, passwordHash })
      .returning();
    const slug =
      name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") +
      "-" +
      Date.now();
    const [newOrg] = await db
      .insert(organizations)
      .values({ name: `${name}'s Organization`, slug })
      .returning();

    await db.insert(organizationMembers).values({
      orgId: newOrg.id,
      userId: newUser.id,
      role: "owner",
    });

    return {
      success: true,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    };
  }
}
