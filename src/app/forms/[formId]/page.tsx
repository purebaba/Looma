import { eq } from "drizzle-orm";
import { Bot } from "lucide-react";

import { FormSubmitClient } from "@/components/forms/form-submit-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db/client";
import { forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { normalizeFormSettings } from "@/lib/forms/settings";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });

  const settings = form ? normalizeFormSettings(form.settings) : null;

  if (!form || form.status !== "published") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Form unavailable</CardTitle>
            <CardDescription>
              This form is not published or no longer exists.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!settings?.collectingEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Form closed</CardTitle>
            <CardDescription>{settings?.closedMessage}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <Bot className="size-8 text-primary" />
          <span className="text-xl font-bold">Looma</span>
        </div>
        <Card>
          <CardHeader>
            <h1 className="font-semibold leading-none tracking-tight">{form.name}</h1>
            {form.description ? (
              <CardDescription>{form.description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <FormSubmitClient
              formId={form.id}
              schema={form.schema as FormSchema}
              settings={settings}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
