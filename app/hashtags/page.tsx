"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Hash, Trash2, Plus } from "lucide-react";

type Hashtag = {
  id: string;
  tag: string;
  createdAt: number;
};

export default function HashtagsPage() {
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/hashtags");
    setHashtags(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addHashtag() {
    const tag = input.trim().replace(/^#+/, "");
    if (!tag) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al añadir");
      } else {
        setInput("");
        toast.success(`#${tag} añadido`);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeHashtag(id: string, tag: string) {
    await fetch(`/api/hashtags/${id}`, { method: "DELETE" });
    toast.success(`#${tag} eliminado`);
    load();
  }

  const previewDescription =
    hashtags.length > 0
      ? hashtags.map((h) => `#${h.tag}`).join(" ")
      : "(sin hashtags — se usará el nombre del carousel)";

  return (
    <div className="space-y-8 max-w-xl pt-4 md:pt-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Hashtags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Se usan automáticamente como description al subir un carousel a TikTok
        </p>
      </div>

      {/* Añadir hashtag */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Añadir hashtag</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="fitness, gym, workout…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHashtag();
              }}
            />
          </div>
          <Button
            onClick={addHashtag}
            disabled={saving || !input.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Puedes escribir con o sin <code>#</code> · pulsa Enter para añadir
        </p>
      </div>

      {/* Preview de la description */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Description en TikTok
        </div>
        <p className="text-sm font-mono break-all leading-relaxed">
          {previewDescription}
        </p>
      </div>

      {/* Lista de hashtags */}
      {hashtags.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Sin hashtags. Añade algunos arriba.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {hashtags.length} hashtag{hashtags.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((h) => (
              <div
                key={h.id}
                className="group flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm"
              >
                <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-medium">{h.tag}</span>
                <button
                  onClick={() => removeHashtag(h.id, h.tag)}
                  className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  title={`Eliminar #${h.tag}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
