"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ImageUploader } from "@/components/image-uploader";
import { ImageGrid } from "@/components/image-grid";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { App, Image } from "@/db/schema";

type CarouselItem = { id: string; name: string; shortId: string | null; sentAt: number | null };

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<App | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [carousels, setCarousels] = useState<CarouselItem[]>([]);

  async function loadApp() {
    const res = await fetch(`/api/apps/${id}`);
    if (res.ok) setApp(await res.json());
  }

  async function loadImages() {
    const res = await fetch(`/api/images?scope=app&appId=${id}`);
    if (res.ok) setImages(await res.json());
  }

  async function loadCarousels() {
    const res = await fetch(`/api/carousels?list=1&appId=${id}`);
    if (res.ok) setCarousels(await res.json());
  }

  useEffect(() => {
    loadApp();
    loadImages();
    loadCarousels();
  }, [id]);

  if (!app) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 pt-4 md:pt-6">
      <div className="flex items-center gap-3">
        <Link href="/apps">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{app.name}</h1>
        <span className="text-sm text-muted-foreground">/{app.slug}</span>
      </div>

      <div className="space-y-4">
        <ImageUploader
          scope="app"
          appId={id}
          onUploaded={loadImages}
        />
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Images ({images.length})
          </h2>
          <ImageGrid images={images} onDeleted={loadImages} />
        </div>
      </div>

      {/* Carousels */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Carousels ({carousels.length})</h2>
        {carousels.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Ningún carousel todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {carousels.map((c) => (
              <Link key={c.id} href={`/carousels/${c.id}`}>
                <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 hover:shadow-sm transition-shadow cursor-pointer">
                  <span className="font-black font-mono text-lg w-12 shrink-0 leading-none">{c.shortId ?? "—"}</span>
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  {c.sentAt && (
                    <span className="text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold shrink-0">Enviado</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
