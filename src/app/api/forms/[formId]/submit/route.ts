import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { formSubmissions, forms } from "@/lib/db/schema";
import { validateForm, type FormSchema } from "@/lib/forms/field-schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const body = await request.json();
    const form = await db.query.forms.findFirst({
      where: eq(forms.id, formId),
    });

    if (!form || form.status !== "published") {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const data = body.data || {};
    const validation = validateForm(data, form.schema as FormSchema);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid submission", errors: validation.errors },
        { status: 400 }
      );
    }

    const session = await auth();
    const [submission] = await db
      .insert(formSubmissions)
      .values({
        formId,
        data,
        submittedBy: session?.user?.id,
        userAgent: request.headers.get("user-agent"),
      })
      .returning();

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
