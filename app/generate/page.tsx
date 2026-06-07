"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileJson, Trash2, ChevronRight, Download, Zap, Tag, ChevronDown, ClipboardPaste, CheckSquare } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { TagsReference } from "@/components/tags-reference";

type CarouselRow = {
  id: string;
  name: string;
  status: string;
  zipPath: string | null;
  createdAt: number;
  appName: string | null;
  influencerName: string | null;
  slideCount: number;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  generated: "default",
  edited: "outline",
};

export default function GeneratePage() {
  const [carousels, setCarousels] = useState<CarouselRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === carousels.length ? new Set() : new Set(carousels.map((c) => c.id))
    );
  }

  async function load() {
    const res = await fetch("/api/carousels?list=1");
    if (res.ok) setCarousels(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleFiles(files: FileList | File[]) {
    const jsonFiles = Array.from(files).filter(
      (f) => f.type === "application/json" || f.name.endsWith(".json")
    );
    if (jsonFiles.length === 0) {
      toast.error("No JSON files found");
      return;
    }
    setProcessing(true);
    let created = 0;
    for (const file of jsonFiles) {
      try {
        const text = await file.text();
        const res = await fetch("/api/carousels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: text }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(`${file.name}: ${err.error}`);
        } else {
          const { created: ids } = await res.json();
          created += ids.length;
        }
      } catch {
        toast.error(`Failed to process ${file.name}`);
      }
    }
    setProcessing(false);
    if (created > 0) {
      toast.success(`Created ${created} carousel${created > 1 ? "s" : ""}`);
      load();
    }
  }

  async function handlePasteImport() {
    const text = pasteText.trim();
    if (!text) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: text }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al importar");
      } else {
        const { created: ids } = await res.json();
        toast.success(`${ids.length} carousel${ids.length > 1 ? "s" : ""} creado${ids.length > 1 ? "s" : ""}`);
        setPasteText("");
        setShowPaste(false);
        load();
      }
    } catch {
      toast.error("JSON inválido");
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerate(id: string) {
    setGenerating(id);
    try {
      const res = await fetch(`/api/carousels/${id}/generate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Generated!");
      load();
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(null);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/carousels/${id}`, { method: "DELETE" });
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    load();
  }

  async function bulkGenerate() {
    if (!selected.size) return;
    setBulkGenerating(true);
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/carousels/${id}/generate`, { method: "POST" });
        if (res.ok) ok++;
      } catch {}
    }
    setBulkGenerating(false);
    toast.success(`${ok} carousel${ok > 1 ? "s" : ""} generado${ok > 1 ? "s" : ""}`);
    setSelected(new Set());
    load();
  }

  async function bulkDiscard() {
    if (!selected.size) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map((id) => fetch(`/api/carousels/${id}`, { method: "DELETE" })));
    toast.success(`${ids.length} eliminado${ids.length > 1 ? "s" : ""}`);
    setSelected(new Set());
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Generate Carousels</h1>
        <button
          onClick={() => setShowTags((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-2.5 py-1.5"
        >
          <Tag className="h-3.5 w-3.5" />
          Tags disponibles
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTags ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Collapsible tags reference */}
      {showTags && (
        <div className="rounded-xl border p-4 bg-muted/20">
          <TagsReference />
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:bg-muted/40"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <FileJson className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Drop JSON files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          One file can contain multiple carousels
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Paste JSON */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPaste((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          {showPaste ? "Cerrar paste" : "O pega el JSON directamente"}
        </button>
        {showPaste && (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder='{ "version": "1.0", "carousels": [...] }'
              rows={8}
              className="w-full rounded-xl border bg-muted/20 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <Button
              size="sm"
              onClick={handlePasteImport}
              disabled={!pasteText.trim() || processing}
            >
              <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
              {processing ? "Importando…" : "Importar JSON"}
            </Button>
          </div>
        )}
      </div>

      {processing && (
        <p className="text-sm text-muted-foreground animate-pulse">Processing…</p>
      )}

      {/* Carousel list */}
      <div className="space-y-2">
        {/* Bulk bar */}
        {carousels.length > 0 && (
          <div className="flex items-center gap-3 pb-1">
            <input
              type="checkbox"
              checked={selected.size === carousels.length && carousels.length > 0}
              onChange={toggleAll}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} seleccionado${selected.size > 1 ? "s" : ""}` : "Seleccionar todo"}
            </span>
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={bulkGenerate} disabled={bulkGenerating} className="h-7 text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {bulkGenerating ? "Generando…" : `Generar ${selected.size}`}
                </Button>
                <Button size="sm" variant="outline" onClick={bulkDiscard} className="h-7 text-xs text-destructive hover:text-destructive border-destructive/40 hover:border-destructive">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Descartar {selected.size}
                </Button>
              </>
            )}
          </div>
        )}

        {carousels.length === 0 && !processing && (
          <p className="text-sm text-muted-foreground py-4">
            No hay carousels. Sube un JSON para empezar.
          </p>
        )}
        {carousels.map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
              selected.has(c.id) ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggleSelect(c.id)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{c.name}</span>
                <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[c.influencerName, c.appName].filter(Boolean).join(" × ")} ·{" "}
                {c.slideCount} slides ·{" "}
                {new Date(c.createdAt * 1000).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => handleGenerate(c.id)} disabled={generating === c.id} className="h-7">
                <Zap className="h-3.5 w-3.5 mr-1" />
                {generating === c.id ? "…" : "Generate"}
              </Button>
              {c.zipPath && (
                <a href={`/api/carousels/${c.id}/download`}>
                  <Button size="sm" variant="ghost" className="h-7">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              )}
              <Link href={`/generate/${c.id}`}>
                <Button size="sm" variant="ghost" className="h-7">
                  Edit <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
              <button
                onClick={() => handleDelete(c.id)}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
