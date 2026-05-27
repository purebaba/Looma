import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { auth } from "@/lib/auth/config";
import { createRecordAndSubmission } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { forms } from "@/lib/db/schema";
import { validateForm, type FormSchema } from "@/lib/forms/field-schema";
import { normalizeFormSettings } from "@/lib/forms/settings";
import {
  checkSubmissionRateLimit,
  getClientIp,
  hasHoneypotValue,
} from "@/lib/forms/submission-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const body = await request.json();
    const clientIp = getClientIp(request);
    const form = await db.query.forms.findFirst({
      where: eq(forms.id, formId),
    });

    if (!form || form.status !== "published") {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    const settings = normalizeFormSettings(form.settings);
    if (!settings.collectingEnabled) {
      return NextResponse.json(
        { error: "Form is not accepting responses" },
        { status: 409 }
      );
    }

    if (hasHoneypotValue(body)) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const rateLimit = checkSubmissionRateLimit({ formId, clientIp });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        }
      );
    }

    const data = body.data || {};
    const validation = validateForm(data, form.schema as FormSchema);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid submission", errors: validation.errors },
        { status: 400 }
      );
    }

    if (!form.appId || !form.entityId) {
      return NextResponse.json(
        { error: "Form is not bound to a data entity" },
        { status: 409 }
      );
    }

    const session = await auth();
    const { record, submission } = await createRecordAndSubmission({
      form,
      data,
      submittedBy: session?.user?.id,
      ipAddress: clientIp,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      { submission, submissionId: submission.id, recordId: record.id },
      { status: 201 }
    );
  } catch (error) {
    return routeError(error);
  }
}
