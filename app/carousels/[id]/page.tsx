"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, Download, Copy, Upload, ChevronDown, Trash2, X, ImageIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

/* ── Types ──────────────────────────────────────────────────────────── */
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

type PickerImage = { id: string; path: string; tag: string; originalName: string };
type TikTokAccount = { id: string; name: string };

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function parseTexts(json: string): TextEl[] {
  try { return JSON.parse(json); } catch { return []; }
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-ES", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary", generated: "default", edited: "outline",
};

/* ── Page ────────────────────────────────────────────────────────────── */
export default function CarouselDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: carousel, mutate } = useSWR<CarouselDetail>(`/api/carousels/${id}`, fetcher);
  const { data: accounts = [] } = useSWR<TikTokAccount[]>("/api/tiktok/accounts", fetcher);
  // Lista completa para prev/next — usa el mismo caché que /carousels
  const { data: allCarousels = [] } = useSWR<{ id: string }[]>("/api/carousels", fetcher);
  const currentIndex = allCarousels.findIndex((c) => c.id === id);
  const prevId = currentIndex > 0 ? allCarousels[currentIndex - 1].id : null;
  const nextId = currentIndex < allCarousels.length - 1 ? allCarousels[currentIndex + 1].id : null;

  // Picker de imagen
  const [pickerSlideId, setPickerSlideId] = useState<string | null>(null);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [changingImage, setChangingImage] = useState(false);

  // Acciones
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function openPicker(slideId: string) {
    setPickerSlideId(slideId);
    setPickerLoading(true);
    setPickerImages(await fetch("/api/images").then((r) => r.json()));
    setPickerLoading(false);
  }

  async function handleImageChange(imageId: string) {
    if (!pickerSlideId || !carousel) return;
    setChangingImage(true);
    try {
      await fetch(`/api/carousels/${carousel.id}/slides/${pickerSlideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      await mutate();
      setPickerSlideId(null);
      toast.success("Imagen actualizada");
    } catch {
      toast.error("Error al cambiar imagen");
    } finally {
      setChangingImage(false);
    }
  }

  async function handleUpload(accountId: string) {
    if (!carousel) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/carousels/${carousel.id}/tiktok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al subir");
      } else {
        toast.success("Subido como draft ✓");
        await mutate();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!carousel || !confirm("¿Eliminar este carousel?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/carousels/${carousel.id}`, { method: "DELETE" });
      router.push("/carousels");
    } catch {
      toast.error("Error al eliminar");
      setDeleting(false);
    }
  }

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

  /* ── Loading ── */
  if (!carousel) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  const isSent = !!carousel.sentAt;
  const isPending = !isSent;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const idSlideUrl = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/uploads/generated/idslide_${carousel.id}.jpg`
    : null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/carousels">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{carousel.name}</h1>
            <Badge variant={STATUS_VARIANT[carousel.status] ?? "secondary"}>
              {carousel.status}
            </Badge>
            {isSent && (
              <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold">
                Enviado
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {[carousel.influencerName, carousel.appName].filter(Boolean).join(" × ")}
            {carousel.sentToAccountName && (
              <span className="ml-2 font-medium text-foreground">· @{carousel.sentToAccountName}</span>
            )}
            {carousel.sentAt && <span className="ml-1">· {fmtDate(carousel.sentAt)}</span>}
          </div>
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm"
            disabled={!prevId}
            onClick={() => prevId && router.push(`/carousels/${prevId}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm"
            disabled={!nextId}
            onClick={() => nextId && router.push(`/carousels/${nextId}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Acciones header */}
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              {/* Subir a TikTok */}
              {accounts.length > 0 ? (
                <DropdownMenu>
                  {/* @ts-expect-error radix asChild */}
                  <DropdownMenuTrigger asChild>
                    <Button disabled={uploading} className="gap-1.5">
                      <Upload className="h-4 w-4" />
                      {uploading ? "Subiendo…" : "Subir a TikTok"}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {accounts.map((acc) => (
                      <DropdownMenuItem key={acc.id} onClick={() => handleUpload(acc.id)}>
                        @{acc.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/tiktok">
                  <Button variant="outline">Conectar TikTok</Button>
                </Link>
              )}

              {/* Borrar */}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Descargar ZIP */}
          <a href={`/api/carousels/${carousel.id}/download`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" />ZIP
            </Button>
          </a>
        </div>
      </div>

      {/* ── ShortId + ID slide ── */}
      <div className="flex items-center gap-6 p-5 rounded-2xl border bg-muted/20">
        {idSlideUrl && (
          <img src={idSlideUrl} alt="ID slide"
            className="shrink-0 w-16 rounded-lg border shadow-sm"
            style={{ aspectRatio: "9/16", objectFit: "cover" }} />
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

      {/* ── Contenido: 2 columnas ── */}
      <div className="grid grid-cols-5 gap-6">
        {/* Izquierda: slides */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold">Slides · {carousel.slides.length}</h2>
          <div className="grid grid-cols-2 gap-2">
            {carousel.slides.map((slide) => {
              const src = slide.generatedImagePath ?? slide.imagePath;
              return (
                <div key={slide.id} className="space-y-1.5">
                  <div className="relative rounded-lg overflow-hidden bg-muted border"
                    style={{ aspectRatio: "9/16" }}>
                    {src ? (
                      <img src={src} alt={`Slide ${slide.order + 1}`}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 opacity-30" />
                      </div>
                    )}
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] rounded px-1 font-medium">
                      {slide.order + 1}
                    </span>
                  </div>
                  {/* Botón cambiar imagen — solo en pendientes */}
                  {isPending && (
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs"
                      onClick={() => openPicker(slide.id)}>
                      Cambiar imagen
                    </Button>
                  )}
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
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sin texto</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Image picker modal ── */}
      {pickerSlideId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPickerSlideId(null)}>
          <div className="bg-background rounded-2xl border shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Seleccionar imagen</h3>
              <button onClick={() => setPickerSlideId(null)}
                className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">Cargando imágenes…</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {pickerImages.map((img) => (
                    <button key={img.id}
                      className="rounded-lg overflow-hidden border hover:border-primary hover:shadow-md transition-all"
                      style={{ aspectRatio: "3/4" }}
                      disabled={changingImage}
                      onClick={() => handleImageChange(img.id)}>
                      <img src={img.path} alt={img.originalName}
                        className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
