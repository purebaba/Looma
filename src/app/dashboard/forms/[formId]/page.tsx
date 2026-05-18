import { and, eq } from "drizzle-orm";

import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const current = await requireResourceAccess("forms", "update");
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
  });

  if (!form) {
    return (
      <PageHeader
        title="Form not found"
        description="This form does not exist in the current organization."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit form"
        description="Update fields, preview the experience, and publish changes."
      />
      <FormBuilder
        initialForm={{
          id: form.id,
          name: form.name,
          description: form.description,
          schema: form.schema as FormSchema,
          status: form.status,
        }}
      />
    </div>
  );
}
