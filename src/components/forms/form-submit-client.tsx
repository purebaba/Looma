"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { FormRenderer } from "@/components/forms/form-renderer";
import { Card, CardContent } from "@/components/ui/card";
import type { FormSchema } from "@/lib/forms/field-schema";

export function FormSubmitClient({
  formId,
  schema,
}: {
  formId: string;
  schema: FormSchema;
}) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Submission received</h2>
            <p className="text-sm text-muted-foreground">
              Your response has been saved.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <FormRenderer
      schema={schema}
      submitLabel="Submit response"
      onSubmit={async (data) => {
        const response = await fetch(`/api/forms/${formId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!response.ok) {
          throw new Error("Failed to submit form");
        }
        setSubmitted(true);
      }}
    />
  );
}
