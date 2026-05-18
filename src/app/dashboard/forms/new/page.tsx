import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  await requireResourceAccess("forms", "create");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New form"
        description="Build a form from fields, configure validation, and publish when ready."
      />
      <FormBuilder />
    </div>
  );
}
