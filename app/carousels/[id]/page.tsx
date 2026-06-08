"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Upload,
  ChevronDown,
  Trash2,
  X,
  ImageIcon,
  Grid2x2,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { parseTags } from "@/lib/ids";

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

  // Slides view toggle
  const [slidesView, setSlidesView] = useState<"normal" | "mini">("normal");

  // Picker de imagen
  const [pickerSlideId, setPickerSlideId] = useState<string | null>(null);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerTagFilter, setPickerTagFilter] = useState<string[]>([]);
  const [pickerAvailTags, setPickerAvailTags] = useState<string[]>([]);
  const [changingImage, setChangingImage] = useState(false);

  // Acciones
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function openPicker(slideId: string) {
    setPickerSlideId(slideId);
    setPickerTagFilter([]);
    setPickerLoading(true);
    const imgs: PickerImage[] = await fetch("/api/images").then((r) => r.json());
    setPickerImages(imgs);

    // Get tags from current slide's image for filter chips
    const currentSlide = carousel?.slides.find((s) => s.id === slideId);
    if (currentSlide?.imageId) {
      const currentImg = imgs.find((img) => img.id === currentSlide.imageId);
      if (currentImg) {
        setPickerAvailTags(parseTags(currentImg.tag).filter(Boolean));
      } else {
        setPickerAvailTags([]);
      }
    } else {
      setPickerAvailTags([]);
    }

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

  // Filtered picker images
  const displayPickerImages =
    pickerTagFilter.length === 0
      ? pickerImages
      : pickerImages.filter((img) =>
          pickerTagFilter.every((t) => parseTags(img.tag).includes(t))
        );

  return (
    <div className="space-y-5">
      {/* ── Sticky header with breadcrumb ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b -mx-4 md:-mx-6 px-4 md:px-6 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Back */}
          <Link href="/carousels">
            <Button variant="ghost" size="sm" className="-ml-1.5 h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>

          {/* Breadcrumb */}
          <span className="text-xs text-muted-foreground hidden sm:inline">Carousels</span>
          {carousel.shortId && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 hidden sm:block" />
              <span className="text-xs font-mono font-bold">{carousel.shortId}</span>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Prev / Next */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              disabled={!prevId}
              onClick={() => prevId && router.push(`/carousels/${prevId}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              disabled={!nextId}
              onClick={() => nextId && router.push(`/carousels/${nextId}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5">
            {isPending && (
              <>
                {accounts.length > 0 ? (
                  <DropdownMenu>
                    {/* @ts-expect-error radix asChild */}
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" disabled={uploading} className="h-8 gap-1">
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {uploading ? "Subiendo…" : "TikTok"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-70" />
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
                    <Button size="sm" variant="outline" className="h-8">
                      Conectar TikTok
                    </Button>
                  </Link>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            <a href={`/api/carousels/${carousel.id}/download`}>
              <Button size="sm" variant="outline" className="h-8 gap-1">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ZIP</span>
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* ── Carousel name + meta ── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold leading-tight">{carousel.name}</h1>
          {isSent && (
            <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold">
              Enviado
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {[carousel.influencerName, carousel.appName].filter(Boolean).join(" × ")}
          {carousel.sentToAccountName && (
            <span className="ml-2 font-medium text-foreground">
              · @{carousel.sentToAccountName}
            </span>
          )}
          {carousel.sentAt && (
            <span className="ml-1">· {fmtDate(carousel.sentAt)}</span>
          )}
        </div>
      </div>

      {/* ── ShortId + ID slide ── */}
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

      {/* ── Contenido: 2 columnas en desktop, 1 en móvil ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Slides */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Slides · {carousel.slides.length}</h2>
            <button
              onClick={() => setSlidesView((v) => (v === "normal" ? "mini" : "normal"))}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={
                slidesView === "normal"
                  ? "Vista mini (4 por fila)"
                  : "Vista normal (2 por fila)"
              }
            >
              {slidesView === "normal" ? (
                <Grid2x2 className="h-3.5 w-3.5" />
              ) : (
                <LayoutGrid className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div
            className={`grid gap-2 ${
              slidesView === "normal" ? "grid-cols-2" : "grid-cols-4"
            }`}
          >
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
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 opacity-30" />
                      </div>
                    )}
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] rounded px-1 font-medium">
                      {slide.order + 1}
                    </span>
                  </div>
                  {/* Change image button */}
                  {isPending &&
                    (slidesView === "normal" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        onClick={() => openPicker(slide.id)}
                      >
                        Cambiar imagen
                      </Button>
                    ) : (
                      <button
                        className="w-full flex items-center justify-center py-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => openPicker(slide.id)}
                        title="Cambiar imagen"
                      >
                        <ImageIcon className="h-3 w-3" />
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Textos */}
        <div className="md:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Textos</h2>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={copyAllTexts}
            >
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-[10px] px-1.5"
                      onClick={() => copySlideText(slide)}
                    >
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

      {/* ── Image picker modal ── */}
      {pickerSlideId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPickerSlideId(null)}
        >
          <div
            className="bg-background rounded-2xl border shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Seleccionar imagen</h3>
              <button
                onClick={() => setPickerSlideId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Cargando imágenes…
                </div>
              ) : (
                <>
                  {/* Tag filter chips */}
                  {pickerAvailTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {pickerAvailTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() =>
                            setPickerTagFilter((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            pickerTagFilter.includes(tag)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                      {pickerTagFilter.length > 0 && (
                        <button
                          onClick={() => setPickerTagFilter([])}
                          className="px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <X className="h-2.5 w-2.5" /> Limpiar
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                    {displayPickerImages.map((img) => (
                      <button
                        key={img.id}
                        className="rounded-lg overflow-hidden border hover:border-primary hover:shadow-md transition-all"
                        style={{ aspectRatio: "3/4" }}
                        disabled={changingImage}
                        onClick={() => handleImageChange(img.id)}
                      >
                        <img
                          src={img.path}
                          alt={img.originalName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                    {displayPickerImages.length === 0 && (
                      <div className="col-span-4 text-sm text-muted-foreground text-center py-8">
                        Sin imágenes con estos filtros.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
