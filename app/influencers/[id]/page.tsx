"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ImageUploader } from "@/components/image-uploader";
import { ImageGrid } from "@/components/image-grid";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Influencer, Image } from "@/db/schema";

export default function InfluencerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  async function loadInfluencer() {
    const res = await fetch(`/api/influencers/${id}`);
    if (res.ok) setInfluencer(await res.json());
  }

  async function loadImages() {
    const res = await fetch(`/api/images?scope=influencer&influencerId=${id}`);
    if (res.ok) setImages(await res.json());
  }

  useEffect(() => {
    loadInfluencer();
    loadImages();
  }, [id]);

  async function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/influencers/${id}/reference`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error();
      toast.success("Reference image updated");
      loadInfluencer();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingRef(false);
    }
  }

  if (!influencer) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 pt-4 md:pt-6">
      <div className="flex items-center gap-3">
        <Link href="/influencers">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{influencer.name}</h1>
        <span className="text-sm text-muted-foreground">/{influencer.slug}</span>
      </div>

      {/* Reference image */}
      <div className="rounded-lg border p-4 flex items-center gap-4">
        {influencer.referenceImagePath ? (
          <img
            src={influencer.referenceImagePath}
            alt="Reference"
            className="h-24 w-24 rounded-lg object-cover"
          />
        ) : (
          <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
            {influencer.name[0].toUpperCase()}
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Reference image</p>
          <p className="text-xs text-muted-foreground">
            Single identity photo — used for reference and future AI features.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refInputRef.current?.click()}
              disabled={uploadingRef}
            >
              <Upload className="h-3 w-3 mr-1" />
              {uploadingRef ? "Uploading…" : influencer.referenceImagePath ? "Replace" : "Upload"}
            </Button>
            {influencer.referenceImagePath && (
              <a href={influencer.referenceImagePath} download>
                <Button size="sm" variant="ghost">
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
              </a>
            )}
          </div>
          <input
            ref={refInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleRefUpload}
          />
        </div>
      </div>

      {/* Tagged image library */}
      <div className="space-y-4">
        <ImageUploader
          scope="influencer"
          influencerId={id}
          onUploaded={loadImages}
        />
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Image library ({images.length})
          </h2>
          <ImageGrid images={images} onDeleted={loadImages} />
        </div>
      </div>
    </div>
  );
}
