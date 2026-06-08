import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { formSubmissions, forms } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string; submissionId: string }> }
) {
  try {
    const { formId, submissionId } = await params;
    const current = await requireResourceAccess("forms", "update");
    const body = await request.json();
    const status = String(body.status || "");

    if (!["active", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid submission status" },
        { status: 400 }
      );
    }

    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const [submission] = await db
      .update(formSubmissions)
      .set({ status })
      .where(
        and(
          eq(formSubmissions.id, submissionId),
          eq(formSubmissions.formId, form.id)
        )
      )
      .returning();

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ submission });
  } catch (error) {
    return routeError(error);
  }
}
