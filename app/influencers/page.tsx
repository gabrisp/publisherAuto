"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Influencer } from "@/db/schema";

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/influencers");
    setInfluencers(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/influencers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      toast.success("Influencer created");
      setName("");
      load();
    } catch {
      toast.error("Failed to create influencer");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this influencer and all their images?")) return;
    await fetch(`/api/influencers/${id}`, { method: "DELETE" });
    toast.success("Influencer deleted");
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl pt-4 md:pt-6">
      <h1 className="text-2xl font-bold">Influencers</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">New influencer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ivan"
              className="flex-1"
            />
            <Button type="submit" disabled={creating || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {influencers.map((inf) => (
          <Link
            key={inf.id}
            href={`/influencers/${inf.id}`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {inf.referenceImagePath ? (
                <img
                  src={inf.referenceImagePath}
                  alt={inf.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {inf.name[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium">{inf.name}</p>
                <p className="text-xs text-muted-foreground">/{inf.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleDelete(inf.id, e)}
                className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
        {influencers.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No influencers yet.</p>
        )}
      </div>
    </div>
  );
}
