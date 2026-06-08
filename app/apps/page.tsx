"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { App } from "@/db/schema";

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/apps");
    setApps(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      toast.success("App created");
      setName("");
      load();
    } catch {
      toast.error("Failed to create app");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this app and all its images?")) return;
    await fetch(`/api/apps/${id}`, { method: "DELETE" });
    toast.success("App deleted");
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl pt-4 md:pt-6">
      <h1 className="text-2xl font-bold">Apps</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">New app</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Creatinely"
              className="flex-1"
            />
            <Button type="submit" disabled={creating || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {apps.map((app) => (
          <Link
            key={app.id}
            href={`/apps/${app.id}`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div>
              <p className="font-medium">{app.name}</p>
              <p className="text-xs text-muted-foreground">/{app.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleDelete(app.id, e)}
                className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
        {apps.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No apps yet.</p>
        )}
      </div>
    </div>
  );
}
