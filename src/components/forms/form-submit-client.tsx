"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { FormRenderer } from "@/components/forms/form-renderer";
import { Card, CardContent } from "@/components/ui/card";
import type { FormSchema } from "@/lib/forms/field-schema";
import type { FormSettings } from "@/lib/forms/settings";

const HONEYPOT_FIELD = "_loomaWebsite";

export function FormSubmitClient({
  formId,
  recordId,
  schema,
  settings,
  initialValues,
}: {
  formId: string;
  recordId?: string;
  schema: FormSchema;
  settings: FormSettings;
  initialValues?: Record<string, unknown>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">{settings.successTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {settings.successMessage}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <FormRenderer
      schema={schema}
      initialValues={initialValues}
      submitLabel={recordId ? "Update record" : "Submit response"}
      hiddenFields={
        <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
          <label htmlFor={HONEYPOT_FIELD}>Website</label>
          <input
            id={HONEYPOT_FIELD}
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>
      }
      onSubmit={async (data) => {
        const response = await fetch(`/api/forms/${formId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, recordId, [HONEYPOT_FIELD]: honeypot }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(
            result?.error || "We could not submit this form. Please try again."
          );
        }
        if (settings.redirectUrl) {
          window.location.href = settings.redirectUrl;
          return;
        }
        setSubmitted(true);
      }}
    />
  );
}
