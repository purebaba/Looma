import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { formSubmissions, forms } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "update");
    const body = await request.json();
    const status = String(body.status || "");
    const submissionIds = Array.isArray(body.submissionIds)
      ? body.submissionIds.filter((id: unknown) => typeof id === "string")
      : [];

    if (!["active", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid submission status" },
        { status: 400 }
      );
    }

    if (submissionIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one response" },
        { status: 400 }
      );
    }

    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const updatedSubmissions = await db
      .update(formSubmissions)
      .set({ status })
      .where(
        and(
          eq(formSubmissions.formId, form.id),
          inArray(formSubmissions.id, submissionIds)
        )
      )
      .returning();

    return NextResponse.json({
      count: updatedSubmissions.length,
      submissions: updatedSubmissions,
    });
  } catch (error) {
    return routeError(error);
  }
}
