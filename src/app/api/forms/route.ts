import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { formSubmissions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";

export async function GET() {
  try {
    const current = await requireResourceAccess("forms", "read");
    const rows = await db
      .select()
      .from(forms)
      .where(eq(forms.orgId, current.organization.id))
      .orderBy(desc(forms.createdAt));

    const items = await Promise.all(
      rows.map(async (form) => {
        const [submissionCount] = await db
          .select({ value: count() })
          .from(formSubmissions)
          .where(eq(formSubmissions.formId, form.id));
        return { ...form, submissionCount: submissionCount?.value ?? 0 };
      })
    );

    return NextResponse.json({ forms: items });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireResourceAccess("forms", "create");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const schema = (body.schema || { fields: [] }) as FormSchema;
    const [form] = await db
      .insert(forms)
      .values({
        orgId: current.organization.id,
        createdBy: current.userId,
        name,
        description: body.description || null,
        schema,
      })
      .returning();

    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
