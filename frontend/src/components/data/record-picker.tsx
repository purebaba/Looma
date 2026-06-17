"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RecordOption = {
  id: string;
  label: string;
};

export function RecordPicker({
  targetEntityId,
  value,
  onChange,
}: {
  targetEntityId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [records, setRecords] = useState<RecordOption[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetEntityId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [entityRes, recordsRes] = await Promise.all([
          fetch(`/api/entities/${targetEntityId}`),
          fetch(`/api/entities/${targetEntityId}/records`),
        ]);

        if (!entityRes.ok || !recordsRes.ok) {
          if (!cancelled) setError("Failed to load records");
          return;
        }

        const entityData = await entityRes.json();
        const recordsData = await recordsRes.json();

        const fields: Array<{ slug: string; name: string; type: string }> =
          entityData.entity?.fields || [];
        const textField = fields.find(
          (f) => f.type === "text" || f.type === "email" || f.type === "phone"
        );

        const options: RecordOption[] = (recordsData.records || []).map(
          (record: { id: string; data: Record<string, unknown> }) => {
            const label =
              textField && record.data[textField.slug]
                ? String(record.data[textField.slug])
                : record.id.slice(0, 8);
            return { id: record.id, label };
          }
        );

        if (!cancelled) setRecords(options);
      } catch {
        if (!cancelled) setError("Failed to load records");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [targetEntityId]);

  const selectedRecord = records.find((r) => r.id === value);

  const filtered = search
    ? records.filter((r) => r.label.toLowerCase().includes(search.toLowerCase()))
    : records;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
        disabled={loading}
      >
        {loading
          ? "Loading..."
          : selectedRecord
            ? selectedRecord.label
            : "Select a record..."}
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <Input
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
              placeholder="Search records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {error ? (
              <p className="px-2 py-4 text-sm text-destructive">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                {loading ? "Loading..." : "No records found."}
              </p>
            ) : (
              filtered.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    record.id === value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => {
                    onChange(record.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      record.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {record.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
