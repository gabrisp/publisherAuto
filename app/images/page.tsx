"use client";

import { useState, useEffect, useRef } from "react";
import { ImageUploader } from "@/components/image-uploader";
import { ImageGrid } from "@/components/image-grid";
import { TagsReference } from "@/components/tags-reference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Image } from "@/db/schema";

export default function GlobalImagesPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [refreshTags, setRefreshTags] = useState(0);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/images?scope=global");
    if (res.ok) setImages(await res.json());
  }

  function handleUploaded() {
    load();
    setRefreshTags((n) => n + 1);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("zip", file);
      const res = await fetch("/api/import/images", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.imported} imagen${data.imported !== 1 ? "es" : ""} importada${data.imported !== 1 ? "s" : ""}${data.skipped ? ` · ${data.skipped} omitidas` : ""}`);
      handleUploaded();
    } catch (err) {
      toast.error(`Error al importar: ${(err as Error).message}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Global Images</h1>
        <div className="flex gap-2">
          <a href="/api/export/images" download="images_export.zip">
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar todo
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importing}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {importing ? "Importando…" : "Importar ZIP"}
          </Button>
          <input ref={importRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Images available to all carousels regardless of app or influencer.
      </p>

      <ImageUploader scope="global" onUploaded={handleUploaded} />

      <div>
        <h2 className="text-sm font-semibold mb-3">
          Library ({images.length})
        </h2>
        <ImageGrid images={images} onDeleted={handleUploaded} onTagsSaved={handleUploaded} />
      </div>

      {/* Tags Reference — all tags across all scopes for JSON authoring */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tags disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <TagsReference onRefresh={refreshTags} />
        </CardContent>
      </Card>
    </div>
  );
}
