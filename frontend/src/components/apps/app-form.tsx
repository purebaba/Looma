"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type AppFormValue = {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string | null;
};

export function AppForm({ initialApp }: { initialApp?: AppFormValue }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialApp?.name || "");
  const [slug, setSlug] = useState(initialApp?.slug || "");
  const [description, setDescription] = useState(initialApp?.description || "");
  const [status, setStatus] = useState(initialApp?.status || "active");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        initialApp?.id ? `/api/apps/${initialApp.id}` : "/api/apps",
        {
          method: initialApp?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug, description, status }),
        }
      );
      if (!response.ok) throw new Error("Save failed");
      const { app } = await response.json();
      toast({
        title: initialApp?.id ? "App updated" : "App created",
        description: "The business application container was saved.",
      });
      router.push(`/studio/apps/${app.id}`);
      router.refresh();
    } catch {
      toast({
        title: "Save failed",
        description: "Check the app details and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App details</CardTitle>
        <CardDescription>
          Apps group entities, forms, workflows, and agents into a business application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="app-name">Name</Label>
            <Input
              id="app-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="CRM"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-slug">Slug</Label>
            <Input
              id="app-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="crm"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-description">Description</Label>
            <Textarea
              id="app-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What business area does this app cover?"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-status">Status</Label>
            <select
              id="app-status"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save app"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
