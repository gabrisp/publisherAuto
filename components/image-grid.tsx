"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Save, Plus, X, LayoutGrid, List, Grid2x2 } from "lucide-react";
import { toast } from "sonner";
import type { Image } from "@/db/schema";
import { parseTags } from "@/lib/ids";

type View = "grid" | "small" | "list";

type Props = {
  images: Image[];
  onDeleted?: () => void;
  onTagsSaved?: () => void;
};

// ── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ img, onClose }: { img: Image; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={img.path}
          alt={img.originalName}
          className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 rounded-full bg-white/10 p-1.5 text-white backdrop-blur hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mt-2 text-center text-sm text-white/70">
          {img.originalName}
          {parseTags(img.tag).filter(Boolean).length > 0 && (
            <span className="ml-2 font-mono text-white/50">
              [{parseTags(img.tag).join(", ")}]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tag editor shared ────────────────────────────────────────────────────────
function TagEditor({
  tags,
  onUpdate,
  onAdd,
  onRemove,
  compact = false,
}: {
  tags: string[];
  onUpdate: (i: number, val: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex flex-wrap gap-1" : "space-y-1"}>
      {tags.map((t, i) => (
        <div key={i} className={compact ? "flex items-center gap-0.5" : "flex items-center gap-1"}>
          <input
            type="text"
            value={t}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder={`tag ${i + 1}`}
            className={`flex-1 min-w-0 rounded-md border border-input bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary ${
              compact ? "px-1 py-0.5 text-[10px] w-16" : "px-2 py-1 text-xs"
            }`}
          />
          {tags.length > 1 && (
            <button onClick={() => onRemove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
              <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            </button>
          )}
        </div>
      ))}
      {tags.length < 3 && (
        <button
          onClick={onAdd}
          className={`flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors ${
            compact ? "text-[9px]" : "text-[11px]"
          }`}
        >
          <Plus className={compact ? "h-2 w-2" : "h-3 w-3"} /> tag
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function ImageGrid({ images, onDeleted, onTagsSaved }: Props) {
  const [view, setView] = useState<View>("grid");
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Image | null>(null);

  function getTags(img: Image): string[] {
    return edits[img.id] ?? parseTags(img.tag);
  }
  function isDirty(img: Image) {
    if (!edits[img.id]) return false;
    return parseTags(img.tag).join(",") !== edits[img.id].join(",");
  }
  function setImgTags(id: string, tags: string[]) {
    setEdits((p) => ({ ...p, [id]: tags.slice(0, 3) }));
  }
  function updateTag(img: Image, i: number, val: string) {
    const cur = [...getTags(img)]; cur[i] = val; setImgTags(img.id, cur);
  }
  function addTag(img: Image) {
    const cur = getTags(img); if (cur.length >= 3) return;
    setImgTags(img.id, [...cur, ""]);
  }
  function removeTag(img: Image, i: number) {
    const cur = getTags(img).filter((_, idx) => idx !== i);
    setImgTags(img.id, cur.length ? cur : [""]);
  }

  const dirtyCount = images.filter(isDirty).length;

  async function saveAll() {
    const dirty = images.filter(isDirty);
    if (!dirty.length) return;
    setSaving(true);
    try {
      await Promise.all(
        dirty.map((img) =>
          fetch(`/api/images/${img.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags: edits[img.id].filter(Boolean) }),
          })
        )
      );
      toast.success(`${dirty.length} imagen${dirty.length > 1 ? "es" : ""} guardada${dirty.length > 1 ? "s" : ""}`);
      setEdits((p) => { const n = { ...p }; dirty.forEach((i) => delete n[i.id]); return n; });
      onTagsSaved?.();
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleDelete(img: Image) {
    setDeleting(img.id);
    try {
      const res = await fetch(`/api/images/${img.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Imagen eliminada");
      onDeleted?.();
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleting(null); }
  }

  if (images.length === 0) return <p className="text-sm text-muted-foreground py-4">No hay imágenes.</p>;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{images.length} imagen{images.length !== 1 ? "es" : ""}</span>
        <div className="flex items-center gap-1">
          {dirtyCount > 0 && (
            <Button size="sm" variant="outline" onClick={saveAll} disabled={saving} className="mr-2 h-7 text-xs">
              <Save className="h-3 w-3 mr-1" />
              {saving ? "Guardando…" : `Guardar ${dirtyCount}`}
            </Button>
          )}
          <button
            onClick={() => setView("small")}
            className={`rounded p-1.5 transition-colors ${view === "small" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Grid pequeño"
          >
            <Grid2x2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`rounded p-1.5 transition-colors ${view === "grid" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Grid normal"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded p-1.5 transition-colors ${view === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Lista"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── GRID (default 3-col) ── */}
      {view === "grid" && (
        <div className="grid grid-cols-3 gap-4">
          {images.map((img) => {
            const tags = getTags(img);
            return (
              <div key={img.id} className={`group flex flex-col rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow ${isDirty(img) ? "ring-2 ring-primary/50" : ""}`}>
                <div className="relative overflow-hidden bg-muted cursor-zoom-in" onClick={() => setLightbox(img)}>
                  <img src={img.path} alt={img.originalName} className="aspect-[3/4] w-full object-cover" />
                  <button
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                    disabled={deleting === img.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-2.5 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground truncate">{img.originalName}</p>
                  <TagEditor
                    tags={tags}
                    onUpdate={(i, v) => updateTag(img, i, v)}
                    onAdd={() => addTag(img)}
                    onRemove={(i) => removeTag(img, i)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SMALL GRID (5-col) ── */}
      {view === "small" && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img) => {
            const tags = getTags(img);
            return (
              <div key={img.id} className={`group flex flex-col rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow ${isDirty(img) ? "ring-2 ring-primary/50" : ""}`}>
                <div className="relative overflow-hidden bg-muted cursor-zoom-in" onClick={() => setLightbox(img)}>
                  <img src={img.path} alt={img.originalName} className="aspect-[3/4] w-full object-cover" />
                  <button
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                    disabled={deleting === img.id}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="p-1.5 space-y-1">
                  <TagEditor
                    tags={tags}
                    onUpdate={(i, v) => updateTag(img, i, v)}
                    onAdd={() => addTag(img)}
                    onRemove={(i) => removeTag(img, i)}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="divide-y rounded-xl border overflow-hidden">
          {images.map((img) => {
            const tags = getTags(img);
            return (
              <div key={img.id} className={`group flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/30 transition-colors ${isDirty(img) ? "border-l-2 border-primary" : ""}`}>
                {/* Thumbnail */}
                <div
                  className="shrink-0 cursor-zoom-in rounded-lg overflow-hidden bg-muted"
                  onClick={() => setLightbox(img)}
                >
                  <img src={img.path} alt={img.originalName} className="h-14 w-10 object-cover" />
                </div>
                {/* Name */}
                <p className="w-40 shrink-0 text-xs text-muted-foreground truncate" title={img.originalName}>
                  {img.originalName}
                </p>
                {/* Tags inline */}
                <div className="flex-1 flex flex-wrap items-center gap-1">
                  {tags.map((t, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <input
                        type="text"
                        value={t}
                        onChange={(e) => updateTag(img, i, e.target.value)}
                        placeholder={`tag ${i + 1}`}
                        className="w-24 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {tags.length > 1 && (
                        <button onClick={() => removeTag(img, i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {tags.length < 3 && (
                    <button onClick={() => addTag(img)} className="text-muted-foreground hover:text-foreground">
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {/* Delete */}
                <button
                  className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  onClick={() => handleDelete(img)}
                  disabled={deleting === img.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox img={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
