"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Clapperboard, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Clip = {
  id: string;
  name: string;
  path: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDuration(ms: number | null) {
  if (!ms) return "-";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function readVideoMeta(file: File) {
  return new Promise<{ durationMs: number | null; width: number | null; height: number | null }>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ durationMs: null, width: null, height: null });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}

export default function ClipsPage() {
  const { data: clips = [], mutate } = useSWR<Clip[]>("/api/clips", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  async function uploadClip(file: File) {
    setUploading(true);
    try {
      const meta = await readVideoMeta(file);
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.[^.]+$/, ""));
      if (meta.durationMs) form.append("durationMs", String(meta.durationMs));
      if (meta.width) form.append("width", String(meta.width));
      if (meta.height) form.append("height", String(meta.height));

      const res = await fetch("/api/clips", { method: "POST", body: form });
      if (!res.ok) {
        const raw = await res.text();
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          throw new Error(parsed.error ?? raw);
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(raw);
          throw e;
        }
      }

      toast.success("Clip importado");
      await mutate();
    } catch (e) {
      const rawError = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(rawError, { duration: 12000 });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importZip(file: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("zip", file);
      const res = await fetch("/api/import/clips", { method: "POST", body: form });
      const raw = await res.text();
      let data: { imported?: number; skipped?: number; error?: string } = {};
      try {
        data = JSON.parse(raw);
      } catch {}
      if (!res.ok) throw new Error(data.error ?? raw);
      toast.success(`${data.imported ?? 0} clip${data.imported === 1 ? "" : "s"} importado${data.imported === 1 ? "" : "s"}${data.skipped ? ` · ${data.skipped} omitidos` : ""}`);
      await mutate();
    } catch (e) {
      const rawError = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(rawError, { duration: 12000 });
    } finally {
      setImporting(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6 pb-24 pt-4 md:pb-6 md:pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clips</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Librería de clips disponibles para montar videos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => zipInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Importar ZIP
          </Button>
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar clip
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadClip(file);
          }}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importZip(file);
          }}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Clapperboard className="h-4 w-4 text-muted-foreground" />
            Library
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{clips.length}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {clips.map((clip) => (
          <div key={clip.id} className="overflow-hidden rounded-lg border bg-card">
            <video src={clip.path} className="aspect-video w-full bg-black object-cover" controls preload="metadata" />
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-semibold">{clip.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(clip.durationMs)}
                {clip.width && clip.height ? ` · ${clip.width}x${clip.height}` : ""}
              </p>
            </div>
          </div>
        ))}
        {clips.length === 0 && (
          <p className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay clips importados.
          </p>
        )}
      </div>
    </div>
  );
}
