import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { formSubmissions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { submissionsToCsv } from "@/lib/forms/submissions";

function filenameFor(name: string) {
  return `${name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "form"}-responses.csv`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "read");
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, form.id))
      .orderBy(desc(formSubmissions.createdAt));

    const csv = submissionsToCsv({
      schema: form.schema as FormSchema,
      submissions,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameFor(form.name)}"`,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
