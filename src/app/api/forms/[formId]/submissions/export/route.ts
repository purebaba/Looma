import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { formSubmissions, formVersions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import {
  filterSubmissions,
  sortSubmissions,
  submissionsToCsv,
} from "@/lib/forms/submissions";
import {
  formVersionSchema,
  getLatestPublishedFormVersion,
} from "@/lib/forms/versions";

function filenameFor(name: string) {
  return `${name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "form"}-responses.csv`;
}

export async function GET(
  request: Request,
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
    const versions = await db
      .select()
      .from(formVersions)
      .where(eq(formVersions.formId, form.id));
    const versionsById = new Map(versions.map((version) => [version.id, version]));
    const searchParams = new URL(request.url).searchParams;
    const publishedVersion = await getLatestPublishedFormVersion(form.id);
    const schema = publishedVersion
      ? formVersionSchema(publishedVersion)
      : (form.schema as FormSchema);
    const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
    const filteredSubmissions = sortSubmissions(
      filterSubmissions({
        schema,
        submissions,
        query: searchParams.get("q"),
        fieldId: searchParams.get("fieldId"),
        fieldValue: searchParams.get("fieldValue"),
        versionsById,
      }),
      sort
    );

    const csv = submissionsToCsv({
      schema,
      submissions: filteredSubmissions,
      versionsById,
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
