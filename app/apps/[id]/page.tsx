"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ImageUploader } from "@/components/image-uploader";
import { ImageGrid } from "@/components/image-grid";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { App, Image } from "@/db/schema";

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<App | null>(null);
  const [images, setImages] = useState<Image[]>([]);

  async function loadApp() {
    const res = await fetch(`/api/apps/${id}`);
    if (res.ok) setApp(await res.json());
  }

  async function loadImages() {
    const res = await fetch(`/api/images?scope=app&appId=${id}`);
    if (res.ok) setImages(await res.json());
  }

  useEffect(() => {
    loadApp();
    loadImages();
  }, [id]);

  if (!app) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
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
    </div>
  );
}
