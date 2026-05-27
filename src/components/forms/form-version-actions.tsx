"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function FormVersionActions({
  formId,
  versionId,
  version,
}: {
  formId: string;
  versionId: string;
  version: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isRestoring, setIsRestoring] = useState(false);

  async function restoreVersion() {
    if (!window.confirm(`Restore version ${version} as a new draft?`)) return;
    setIsRestoring(true);
    try {
      const response = await fetch(
        `/api/forms/${formId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Restore failed");
      toast({
        title: "Draft restored",
        description: `Version ${version} is now the current draft.`,
      });
      router.refresh();
    } catch {
      toast({
        title: "Restore failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={`restore-version-${version}`}
      disabled={isRestoring}
      onClick={restoreVersion}
    >
      <RotateCcw className="size-4" />
      Restore draft
    </Button>
  );
}
