"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function SettingsForm({
  organization,
  canEdit,
}: {
  organization: { name: string; slug: string; plan: string | null };
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/organizations/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!response.ok) throw new Error("Save failed");
      toast({ title: "Settings saved" });
      router.refresh();
    } catch {
      toast({
        title: "Save failed",
        description: "Please check your organization settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>Manage the current workspace basics.</CardDescription>
      </CardHeader>
      <CardContent className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            value={name}
            disabled={!canEdit}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            value={slug}
            disabled={!canEdit}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Plan</span>
          <span className="text-muted-foreground">{organization.plan || "free"}</span>
        </div>
        {canEdit ? (
          <Button className="w-fit" disabled={isSaving} onClick={save}>
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
