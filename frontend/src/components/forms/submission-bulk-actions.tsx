"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function SubmissionBulkActions({
  formId,
  formDomId,
  status,
}: {
  formId: string;
  formDomId: string;
  status: "active" | "archived" | "all";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = useState(false);

  function selectedSubmissionIds() {
    const form = document.getElementById(formDomId);
    if (!(form instanceof HTMLFormElement)) return [];
    return Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="submissionId"]:checked')
    ).map((input) => input.value);
  }

  async function updateSelected(nextStatus: "active" | "archived") {
    const submissionIds = selectedSubmissionIds();
    if (submissionIds.length === 0) {
      toast({
        title: "No responses selected",
        description: "Select one or more responses first.",
        variant: "destructive",
      });
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch(`/api/forms/${formId}/submissions/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Bulk status update failed");
      const body = (await response.json()) as { count?: number };
      toast({
        title:
          nextStatus === "archived"
            ? "Responses archived"
            : "Responses restored",
        description: `${body.count || submissionIds.length} responses updated.`,
      });
      router.refresh();
    } catch {
      toast({
        title: "Update failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "archived" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => updateSelected("archived")}
        >
          <Archive className="size-4" />
          Archive selected
        </Button>
      ) : null}
      {status !== "active" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => updateSelected("active")}
        >
          <RotateCcw className="size-4" />
          Restore selected
        </Button>
      ) : null}
    </div>
  );
}
