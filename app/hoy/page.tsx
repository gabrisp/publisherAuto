"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Slide = { id: string; order: number; generatedImagePath: string | null; imagePath: string | null };

type Carousel = {
  id: string;
  name: string;
  shortId: string | null;
  folderId: string | null;
  scheduledDate: string | null;
  sentAt: number | null;
  publishedAt: number | null;
  appName: string | null;
  influencerName: string | null;
  slides: Slide[];
};

type FolderRecord = { id: string; name: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtToday() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export default function HoyPage() {
  const today = todayStr();
  const { data: all = [], mutate } = useSWR<Carousel[]>("/api/carousels", fetcher, { revalidateOnFocus: false });
  const { data: folders = [] } = useSWR<FolderRecord[]>("/api/folders", fetcher, { revalidateOnFocus: false });

  const todayCarousels = all.filter((c) => c.scheduledDate === today);

  // Group by folderId
  const folderMap = new Map<string | null, Carousel[]>();
  for (const c of todayCarousels) {
    const key = c.folderId ?? null;
    if (!folderMap.has(key)) folderMap.set(key, []);
    folderMap.get(key)!.push(c);
  }

  // Order: folders first (by name), then sin carpeta
  const folderGroups: { folder: FolderRecord | null; items: Carousel[] }[] = [];
  for (const f of folders) {
    const items = folderMap.get(f.id);
    if (items?.length) folderGroups.push({ folder: f, items });
  }
  const sinCarpeta = folderMap.get(null);
  if (sinCarpeta?.length) folderGroups.push({ folder: null, items: sinCarpeta });

  async function patchCarousel(id: string, body: Record<string, unknown>) {
    await fetch(`/api/carousels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    mutate();
  }

  async function toggleDraft(c: Carousel) {
    const sentAt = c.sentAt ? null : Math.floor(Date.now() / 1000);
    await patchCarousel(c.id, { sentAt });
    toast(sentAt ? "Marcado como draft" : "Quitado de draft", { duration: 1200 });
  }

  async function togglePublished(c: Carousel) {
    const publishedAt = c.publishedAt ? null : Math.floor(Date.now() / 1000);
    await patchCarousel(c.id, { publishedAt });
    toast(publishedAt ? "Publicado ✓" : "Desmarcado", { duration: 1200 });
  }

  return (
    <div className="space-y-6 pb-24 pt-4 md:pt-6">
      <div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Hoy</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 capitalize">{fmtToday()}</p>
      </div>

      {todayCarousels.length === 0 ? (
        <div className="rounded-2xl border bg-muted/20 py-20 text-center space-y-2">
          <p className="text-muted-foreground text-sm">Nada programado para hoy.</p>
          <Link href="/carousels" className="text-xs text-primary underline underline-offset-2">
            Ver todos los carousels
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {folderGroups.map(({ folder, items }) => (
            <div key={folder?.id ?? "__none"} className="space-y-3">
              {/* Folder header = account */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {folder?.name ?? "Sin carpeta"}
                </span>
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </div>

              <div className="space-y-2">
                {items.map((c) => (
                  <CarouselRow
                    key={c.id}
                    c={c}
                    onToggleDraft={() => toggleDraft(c)}
                    onTogglePublished={() => togglePublished(c)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CarouselRow({
  c,
  onToggleDraft,
  onTogglePublished,
}: {
  c: Carousel;
  onToggleDraft: () => void;
  onTogglePublished: () => void;
}) {
  const firstSlide = c.slides[0];
  const src = firstSlide?.generatedImagePath ?? firstSlide?.imagePath;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-muted/20">
      {/* Thumbnail */}
      <Link href={`/carousels/${c.id}`} className="shrink-0">
        <div className="rounded-lg overflow-hidden bg-muted border" style={{ width: 36, height: 64 }}>
          {src
            ? <img src={src} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-3 w-3 opacity-30" /></div>}
        </div>
      </Link>

      {/* Info */}
      <Link href={`/carousels/${c.id}`} className="flex-1 min-w-0">
        <p className="font-black font-mono text-lg leading-none tracking-wide">{c.shortId ?? "—"}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{c.name}</p>
        {(c.influencerName || c.appName) && (
          <p className="text-[11px] text-muted-foreground/70 truncate">
            {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
          </p>
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Draft toggle */}
        {!c.publishedAt && (
          <button
            onClick={onToggleDraft}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              c.sentAt
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {c.sentAt ? "Draft" : "Draft"}
          </button>
        )}

        {/* Published toggle */}
        <button
          onClick={onTogglePublished}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            c.publishedAt
              ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          <CheckCircle2 className="h-3 w-3" />
          {c.publishedAt ? "Publicado" : "Publicar"}
        </button>
      </div>
    </div>
  );
}
