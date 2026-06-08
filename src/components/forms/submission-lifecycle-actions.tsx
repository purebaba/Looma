"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function SubmissionLifecycleActions({
  formId,
  submissionId,
  status,
}: {
  formId: string;
  submissionId: string;
  status?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const isArchived = status === "archived";

  async function updateStatus(nextStatus: "active" | "archived") {
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/forms/${formId}/submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!response.ok) throw new Error("Submission status update failed");
      toast({
        title: nextStatus === "archived" ? "Response archived" : "Response restored",
        description:
          nextStatus === "archived"
            ? "The response is hidden from the active list."
            : "The response is visible in the active list again.",
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

  return isArchived ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isBusy}
      onClick={() => updateStatus("active")}
    >
      <RotateCcw className="size-4" />
      Restore
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isBusy}
      onClick={() => updateStatus("archived")}
    >
      <Archive className="size-4" />
      Archive
    </Button>
  );
}
