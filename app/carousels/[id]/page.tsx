"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Download, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useParams } from "next/navigation";

type TextEl = { id: string; content: string };

type Slide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
  imageId: string | null;
  texts: string;
};

type CarouselDetail = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  zipPath: string | null;
  sentAt: number | null;
  createdAt: number;
  appName: string | null;
  influencerName: string | null;
  sentToAccountName: string | null;
  slides: Slide[];
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  generated: "default",
  edited: "outline",
};

function parseTexts(json: string): TextEl[] {
  try { return JSON.parse(json); } catch { return []; }
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-ES", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function CarouselDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [carousel, setCarousel] = useState<CarouselDetail | null>(null);

  useEffect(() => {
    fetch(`/api/carousels/${id}`)
      .then((r) => r.json())
      .then(setCarousel);
  }, [id]);

  function copySlideText(slide: Slide) {
    const content = parseTexts(slide.texts).map((t) => t.content).join("\n");
    if (!content.trim()) { toast("Sin texto"); return; }
    navigator.clipboard.writeText(content);
    toast.success("Copiado");
  }

  function copyAllTexts() {
    if (!carousel) return;
    const parts = carousel.slides.map((s, i) =>
      `SLIDE ${i + 1}\n${parseTexts(s.texts).map((t) => t.content).join("\n") || "(sin texto)"}`
    );
    navigator.clipboard.writeText(parts.join("\n\n"));
    toast.success("Todos los textos copiados");
  }

  if (!carousel) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const idSlideUrl = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/uploads/generated/idslide_${carousel.id}.jpg`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/carousels">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold truncate">{carousel.name}</h1>
            <Badge variant={STATUS_VARIANT[carousel.status] ?? "secondary"}>
              {carousel.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {[carousel.influencerName, carousel.appName].filter(Boolean).join(" × ")}
            {carousel.sentToAccountName && (
              <span className="ml-2 font-medium text-foreground">· @{carousel.sentToAccountName}</span>
            )}
            {carousel.sentAt && (
              <span className="ml-1">· {fmtDate(carousel.sentAt)}</span>
            )}
          </div>
        </div>
        {carousel.zipPath && (
          <a href={`/api/carousels/${carousel.id}/download`}>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />ZIP
            </Button>
          </a>
        )}
      </div>

      {/* ShortId + ID slide */}
      <div className="flex items-center gap-6 p-5 rounded-2xl border bg-muted/20">
        {idSlideUrl && (
          <img
            src={idSlideUrl}
            alt="ID slide"
            className="shrink-0 w-16 rounded-lg border shadow-sm"
            style={{ aspectRatio: "9/16", objectFit: "cover" }}
          />
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
            ID del carousel
          </span>
          <span className="text-5xl font-black font-mono tracking-[0.15em] leading-none">
            {carousel.shortId ?? "—"}
          </span>
        </div>
      </div>

      {/* Contenido: 2 columnas */}
      <div className="grid grid-cols-5 gap-6">
        {/* Izquierda: slides */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold">
            Slides · {carousel.slides.length}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {carousel.slides.map((slide) => {
              const src = slide.generatedImagePath ?? slide.imagePath;
              return (
                <div key={slide.id} className="space-y-1">
                  <div
                    className="relative rounded-lg overflow-hidden bg-muted border"
                    style={{ aspectRatio: "9/16" }}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={`Slide ${slide.order + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        {slide.order + 1}
                      </div>
                    )}
                    <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] rounded px-1 font-medium">
                      {slide.order + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Derecha: textos */}
        <div className="col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Textos</h2>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copyAllTexts}>
              <Copy className="h-3 w-3 mr-1" />Copiar todo
            </Button>
          </div>
          <div className="space-y-2">
            {carousel.slides.map((slide) => {
              const texts = parseTexts(slide.texts);
              const content = texts.map((t) => t.content).join("\n");
              return (
                <div key={slide.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      SLIDE {slide.order + 1}
                    </span>
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
                      onClick={() => copySlideText(slide)}>
                      <Copy className="h-2.5 w-2.5 mr-0.5" />Copiar
                    </Button>
                  </div>
                  {content.trim() ? (
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {content}
                    </pre>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sin texto</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
