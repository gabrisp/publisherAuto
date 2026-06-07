"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, CheckCircle2, Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type StagedFile = {
  id: string;
  file: File;
  preview: string;
  tags: string[];
  status: "pending" | "uploading" | "done" | "error";
};

type Props = {
  scope: "global" | "app" | "influencer";
  appId?: string;
  influencerId?: string;
  onUploaded?: () => void;
};

export function ImageUploader({ scope, appId, influencerId, onUploaded }: Props) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function tagsFromFilename(filename: string): string[] {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
    const parts = nameWithoutExt.split("_").filter((p) => /^[a-zA-Z]+$/.test(p));
    return parts.length > 0 ? parts : [""];
  }

  function addFiles(files: FileList | File[]) {
    const newItems: StagedFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        preview: URL.createObjectURL(f),
        tags: tagsFromFilename(f.name),
        status: "pending" as const,
      }));
    setStaged((prev) => [...prev, ...newItems]);
  }

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  function updateTag(id: string, i: number, val: string) {
    setStaged((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, tags: s.tags.map((t, idx) => (idx === i ? val : t)) }
          : s
      )
    );
  }

  function addTagSlot(id: string) {
    setStaged((prev) =>
      prev.map((s) =>
        s.id === id && s.tags.length < 3 ? { ...s, tags: [...s.tags, ""] } : s
      )
    );
  }

  function removeTagSlot(id: string, i: number) {
    setStaged((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = s.tags.filter((_, idx) => idx !== i);
        return { ...s, tags: next.length > 0 ? next : [""] };
      })
    );
  }

  async function uploadAll() {
    const pending = staged.filter((s) => s.status === "pending");
    if (!pending.length) return;

    let done = 0;
    for (const item of pending) {
      setStaged((prev) => prev.map((s) => s.id === item.id ? { ...s, status: "uploading" } : s));
      try {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("scope", scope);
        if (appId) fd.append("appId", appId);
        if (influencerId) fd.append("influencerId", influencerId);
        const validTags = item.tags.filter((t) => t.trim());
        if (!validTags.length) validTags.push("untagged");
        for (const t of validTags) fd.append("tags[]", t.trim().toLowerCase());

        const res = await fetch("/api/images", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        setStaged((prev) => prev.map((s) => s.id === item.id ? { ...s, status: "done" } : s));
        done++;
      } catch {
        setStaged((prev) => prev.map((s) => s.id === item.id ? { ...s, status: "error" } : s));
      }
    }

    if (done > 0) {
      toast.success(`${done} imagen${done > 1 ? "es" : ""} subida${done > 1 ? "s" : ""}`);
      onUploaded?.();
      setTimeout(() => setStaged((prev) => prev.filter((s) => s.status !== "done")), 1000);
    }
  }

  const pendingCount = staged.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:bg-muted/40"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-5 w-5 text-muted-foreground mb-1" />
        <p className="text-sm text-muted-foreground">
          Arrastra imágenes aquí o <span className="underline">selecciona</span>
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Múltiples · hasta 3 tags por imagen</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* Staged grid — same layout as ImageGrid */}
      {staged.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            {staged.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col rounded-xl border overflow-hidden ${
                  item.status === "done"
                    ? "border-green-500/50 opacity-60"
                    : item.status === "error"
                    ? "border-destructive/50"
                    : item.status === "uploading"
                    ? "border-primary/40 opacity-70"
                    : "bg-card"
                }`}
              >
                {/* Image preview */}
                <div className="relative overflow-hidden bg-muted">
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <AlertCircle className="h-8 w-8 text-red-400" />
                    </div>
                  )}
                  {item.status === "pending" && (
                    <button
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-destructive transition-colors"
                      onClick={() => removeStaged(item.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Tags below */}
                <div className="p-2.5 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <div className="space-y-1">
                    {item.tags.map((t, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={t}
                          onChange={(e) => updateTag(item.id, i, e.target.value)}
                          disabled={item.status !== "pending"}
                          placeholder={`tag ${i + 1}`}
                          className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                        />
                        {item.tags.length > 1 && item.status === "pending" && (
                          <button
                            onClick={() => removeTagSlot(item.id, i)}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {item.tags.length < 3 && item.status === "pending" && (
                      <button
                        onClick={() => addTagSlot(item.id)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" /> añadir tag
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pendingCount > 0 && (
            <Button className="w-full" onClick={uploadAll}>
              <Upload className="h-4 w-4 mr-2" />
              Subir {pendingCount} imagen{pendingCount > 1 ? "es" : ""}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
