"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function FormLifecycleActions({
  formId,
  status,
  compact = false,
}: {
  formId: string;
  status?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = useState(false);

  async function updateStatus(nextStatus: "draft" | "archived") {
    setIsBusy(true);
    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Status update failed");
      toast({
        title: nextStatus === "archived" ? "Form archived" : "Form restored",
        description:
          nextStatus === "archived"
            ? "The public fill page is now unavailable."
            : "The form is back in draft and can be published again.",
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

  async function deleteForm() {
    if (!window.confirm("Delete this form and all of its responses?")) return;
    setIsBusy(true);
    try {
      const response = await fetch(`/api/forms/${formId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      toast({
        title: "Form deleted",
        description: "The form and its responses were removed.",
      });
      router.push("/studio/interfaces/forms");
      router.refresh();
    } catch {
      toast({
        title: "Delete failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  }

  const size = compact ? "sm" : "default";

  return (
    <>
      {status === "archived" ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={isBusy}
          onClick={() => updateStatus("draft")}
        >
          <RotateCcw className="size-4" />
          Restore
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={isBusy}
          onClick={() => updateStatus("archived")}
        >
          <Archive className="size-4" />
          Archive
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={isBusy}
        onClick={deleteForm}
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
    </>
  );
}
