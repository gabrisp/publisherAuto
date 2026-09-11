"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Clapperboard, Loader2, PackageOpen, Upload } from "lucide-react";
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
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 10_000 };

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

async function rawError(res: Response) {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    return parsed.error ?? raw;
  } catch {
    return raw;
  }
}

export default function ClipsPage() {
  const { data: clips = [], mutate } = useSWR<Clip[]>("/api/clips", fetcher, SWR_OPTS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

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
      if (!res.ok) throw new Error(await rawError(res));

      toast.success("Clip subido");
      await mutate();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(message, { duration: 12000 });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importZip(file: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("zip", file);
      const res = await fetch("/api/import/clips", { method: "POST", body: form });
      if (!res.ok) throw new Error(await rawError(res));
      const result = (await res.json()) as { imported: number; skipped: number };
      toast.success(`${result.imported} clip${result.imported !== 1 ? "s" : ""} importado${result.imported !== 1 ? "s" : ""}`);
      await mutate();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(message, { duration: 12000 });
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
          <p className="mt-1 text-sm text-muted-foreground">Library de clips para montar videos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => zipInputRef.current?.click()} disabled={importing || uploading}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="h-4 w-4" />}
            Importar ZIP
          </Button>
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || importing}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Subir clip
          </Button>
        </div>
        <input
          ref={fileInputRef}
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
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importZip(file);
          }}
        />
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
          <div className="rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
            <Clapperboard className="mx-auto mb-2 h-5 w-5" />
            Todavía no hay clips.
          </div>
        )}
      </div>
    </div>
  );
}
