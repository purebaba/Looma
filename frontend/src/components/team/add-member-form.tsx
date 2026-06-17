"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function AddMemberForm({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isSaving, setIsSaving] = useState(false);

  if (!canManage) return null;

  async function addMember() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) throw new Error("Add member failed");
      setEmail("");
      toast({ title: "Member added" });
      router.refresh();
    } catch {
      toast({
        title: "Could not add member",
        description: "The user must already have a Looma account.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row">
      <Input
        type="email"
        placeholder="teammate@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={role}
        onChange={(event) => setRole(event.target.value)}
      >
        <option value="member">Member</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      <Button disabled={!email || isSaving} onClick={addMember}>
        {isSaving ? "Adding..." : "Add member"}
      </Button>
    </div>
  );
}
