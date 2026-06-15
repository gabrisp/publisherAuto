"use client";

import { useState, useRef } from "react";
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
  Copy,
  Upload,
  ChevronDown,
  Trash2,
  X,
  ImageIcon,
  Share2,
  GripVertical,
  ArrowUpDown,
  Pencil,
  Check,
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
  videoTitle: string | null;
  videoDescription: string | null;
  videoHashtags: string | null;
  zipPath: string | null;
  sentAt: number | null;
  createdAt: number;
  appName: string | null;
  influencerName: string | null;
  sentToAccountName: string | null;
  slides: Slide[];
};

type PickerImage = { id: string; path: string; tag: string; originalName: string; scope: string };
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


  // Picker de imagen
  const [pickerSlideId, setPickerSlideId] = useState<string | null>(null);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerTagFilter, setPickerTagFilter] = useState<string[]>([]);
  const [pickerAvailTags, setPickerAvailTags] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerScope, setPickerScope] = useState<"all" | "global" | "app" | "influencer">("all");
  const [changingImage, setChangingImage] = useState(false);

  // Text editing
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editingTexts, setEditingTexts] = useState<TextEl[]>([]);
  const [savingText, setSavingText] = useState(false);

  // Acciones
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Reorder modal
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderSlides, setReorderSlides] = useState<Slide[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const dragIndex = useRef<number | null>(null);

  async function openPicker(slideId: string) {
    setPickerSlideId(slideId);
    setPickerTagFilter([]);
    setPickerSearch("");
    setPickerScope("all");
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

  // Appends a random byte after the JPEG EOI marker (FF D9).
  // Decoders ignore trailing data so quality is untouched, but the file
  // hash changes — enough to avoid TikTok file-level duplicate detection.
  async function rehashImage(blob: Blob): Promise<Blob> {
    const arr = await blob.arrayBuffer();
    const extra = new Uint8Array([Math.floor(Math.random() * 256)]);
    return new Blob([arr, extra], { type: blob.type });
  }

  async function handleShareSlides() {
    if (!carousel || sharing) return;
    setSharing(true);
    try {
      const files: File[] = [];
      for (const slide of carousel.slides) {
        const url = slide.generatedImagePath ?? slide.imagePath;
        if (!url) continue;
        const raw = await fetch(url).then((r) => r.blob());
        const unique = await rehashImage(raw);
        files.push(new File([unique], `slide-${slide.order + 1}.jpg`, { type: "image/jpeg" }));
      }
      if (files.length === 0) { toast.error("Sin imágenes"); return; }

      if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
        await navigator.share({ files, title: carousel.name });
      } else {
        for (const file of files) {
          const href = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = href;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(href);
        }
      }
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "AbortError") toast.error("Error al compartir");
    } finally {
      setSharing(false);
    }
  }

  function openReorder() {
    setReorderSlides([...carousel!.slides].sort((a, b) => a.order - b.order));
    setReorderOpen(true);
  }

  function onDragStart(i: number) {
    dragIndex.current = i;
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === i) return;
    const next = [...reorderSlides];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(i, 0, moved);
    dragIndex.current = i;
    setReorderSlides(next);
  }

  // Renumbers leading "N. " / "N) " patterns across all slides in new order.
  // Only increments counter for slides that actually have a numbered text.
  function renumberTexts(slides: Slide[]): Slide[] {
    let n = 1;
    return slides.map((slide) => {
      let raw: Array<Record<string, unknown>> = [];
      try { raw = JSON.parse(slide.texts); } catch { return slide; }
      let found = false;
      const updated = raw.map((t) => {
        const content = typeof t.content === "string" ? t.content : "";
        const m = content.match(/^(\d+)([.)]\s)([\s\S]*)$/);
        if (m) { found = true; return { ...t, content: `${n}${m[2]}${m[3]}` }; }
        return t;
      });
      if (found) n++;
      return { ...slide, texts: JSON.stringify(updated) };
    });
  }

  async function saveReorder() {
    if (!carousel) return;
    setReorderSaving(true);
    try {
      const renumbered = renumberTexts(reorderSlides);
      await fetch(`/api/carousels/${carousel.id}/slides/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renumbered.map((s, i) => ({ id: s.id, order: i, texts: s.texts }))),
      });
      await mutate();
      setReorderOpen(false);
      toast.success("Orden guardado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setReorderSaving(false);
    }
  }

  function copySlideText(slide: Slide) {
    const content = parseTexts(slide.texts).map((t) => t.content).join("\n");
    if (!content.trim()) { toast("Sin texto", { duration: 1000 }); return; }
    navigator.clipboard.writeText(content);
    toast("✓ Copiado", { duration: 800 });
  }

  function copyAllTexts() {
    if (!carousel) return;
    const parts = carousel.slides.map((s, i) =>
      `SLIDE ${i + 1}\n${parseTexts(s.texts).map((t) => t.content).join("\n") || "(sin texto)"}`
    );
    navigator.clipboard.writeText(parts.join("\n\n"));
    toast("✓ Copiado todo", { duration: 800 });
  }

  async function saveSlideTexts() {
    if (!carousel || !editingSlideId) return;
    setSavingText(true);
    try {
      await fetch(`/api/carousels/${carousel.id}/slides/${editingSlideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: editingTexts }),
      });
      await mutate();
      setEditingSlideId(null);
      toast.success("Texto guardado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSavingText(false);
    }
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
  const displayPickerImages = pickerImages.filter((img) => {
    if (pickerScope !== "all" && img.scope !== pickerScope) return false;
    if (pickerTagFilter.length > 0 && !pickerTagFilter.every((t) => parseTags(img.tag).includes(t))) return false;
    if (pickerSearch) {
      const q = pickerSearch.toLowerCase();
      if (!img.tag.toLowerCase().includes(q) && !img.originalName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ── Sticky bar: nav + actions only ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b -mx-4 md:-mx-6 px-4 md:px-6 py-2">
        <div className="flex items-center gap-2">
          {/* Prev / Next */}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={!prevId}
            onClick={() => prevId && router.push(`/carousels/${prevId}`)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={!nextId}
            onClick={() => nextId && router.push(`/carousels/${nextId}`)}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {isPending && (
            <>
              {accounts.length > 0 ? (
                <DropdownMenu>
                  {/* @ts-expect-error radix asChild */}
                  <DropdownMenuTrigger asChild>
                    <Button disabled={uploading} className="gap-2">
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
              <button onClick={handleDelete} disabled={deleting}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}

          <a href={`/api/carousels/${carousel.id}/download`}
            className="hidden md:block text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
            ZIP
          </a>
        </div>
      </div>

      {/* ── Title + meta (in scroll, above ID block) ── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold leading-tight">{carousel.name}</h1>
          {isSent && (
            <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold">
              Enviado
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[carousel.influencerName, carousel.appName].filter(Boolean).join(" × ")}
          {carousel.sentToAccountName && (
            <span className="ml-2 font-medium text-foreground">· @{carousel.sentToAccountName}</span>
          )}
          {carousel.sentAt && <span className="ml-1">· {fmtDate(carousel.sentAt)}</span>}
        </p>
      </div>

      {/* ── ShortId ── */}
      <div className="flex items-center gap-6 p-5 rounded-2xl border bg-muted/20">
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
            <div className="flex gap-1.5">
              {isPending && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openReorder}>
                  <ArrowUpDown className="h-3 w-3 mr-1" />Ordenar
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleShareSlides} disabled={sharing}>
                <Share2 className="h-3 w-3 mr-1" />{sharing ? "Cargando…" : "Guardar fotos"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {carousel.slides.map((slide) => {
              const src = slide.generatedImagePath ?? slide.imagePath;
              return (
                <div
                  key={slide.id}
                  className={`relative rounded-lg overflow-hidden bg-muted border ${isPending ? "cursor-pointer active:opacity-80" : ""}`}
                  style={{ aspectRatio: "9/16" }}
                  onClick={isPending ? () => openPicker(slide.id) : undefined}
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
              );
            })}
          </div>
        </div>

        {/* Textos */}
        <div className="md:col-span-3 space-y-3">
          {/* Caption de TikTok */}
          {(carousel.videoTitle || carousel.videoDescription) && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Caption</h2>
              {carousel.videoTitle && (
                <div
                  className="rounded-lg border bg-muted/30 p-3 cursor-pointer active:bg-muted/60 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(carousel.videoTitle!);
                    toast("✓ Título copiado", { duration: 800 });
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Título</span>
                    <span className="text-[10px] text-muted-foreground">{carousel.videoTitle.length}/90</span>
                  </div>
                  <p className="text-sm leading-snug">{carousel.videoTitle}</p>
                </div>
              )}
              {carousel.videoDescription && (
                <div
                  className="rounded-lg border bg-muted/30 p-3 cursor-pointer active:bg-muted/60 transition-colors"
                  onClick={() => {
                    const hashtags = carousel.videoHashtags
                      ? (JSON.parse(carousel.videoHashtags) as string[]).map((h) => `#${h}`).join(" ")
                      : "";
                    const full = hashtags ? `${carousel.videoDescription}\n${hashtags}` : carousel.videoDescription!;
                    navigator.clipboard.writeText(full);
                    toast("✓ Descripción copiada", { duration: 800 });
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Descripción</span>
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{carousel.videoDescription}</p>
                  {carousel.videoHashtags && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {(JSON.parse(carousel.videoHashtags) as string[]).map((h) => `#${h}`).join(" ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
              const isEditing = editingSlideId === slide.id;
              return (
                <div
                  key={slide.id}
                  className={`rounded-lg border bg-muted/30 p-3 transition-colors ${isEditing ? "" : "cursor-pointer active:bg-muted/60"}`}
                  onClick={isEditing ? undefined : () => copySlideText(slide)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      SLIDE {slide.order + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            disabled={savingText}
                            onClick={(e) => { e.stopPropagation(); saveSlideTexts(); }}
                            className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-50"
                          >
                            <Check className="h-2.5 w-2.5" />
                            {savingText ? "…" : "Guardar"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSlideId(null); }}
                            className="h-6 px-1.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[10px] px-1.5 hidden md:inline-flex"
                            onClick={() => copySlideText(slide)}
                          >
                            <Copy className="h-2.5 w-2.5 mr-0.5" />Copiar
                          </Button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSlideId(slide.id);
                              setEditingTexts(texts.length > 0 ? texts : [{ id: "t0", content: "" }]);
                            }}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5">
                      {editingTexts.map((t, i) => (
                        <textarea
                          key={t.id}
                          value={t.content}
                          autoFocus={i === 0}
                          rows={Math.max(2, t.content.split("\n").length)}
                          onChange={(e) => setEditingTexts((prev) =>
                            prev.map((el) => el.id === t.id ? { ...el, content: e.target.value } : el)
                          )}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveSlideTexts();
                            if (e.key === "Escape") setEditingSlideId(null);
                          }}
                          className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm font-sans leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ))}
                    </div>
                  ) : content.trim() ? (
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
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setPickerSlideId(null)}
        >
          <div
            className="bg-background rounded-t-2xl sm:rounded-2xl border shadow-xl w-full sm:max-w-2xl max-h-[88vh] sm:max-h-[82vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="shrink-0 border-b">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="font-semibold text-sm">Seleccionar imagen</h3>
                <button
                  onClick={() => setPickerSlideId(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-4 pb-3 space-y-2.5">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Buscar por tag o nombre…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full h-8 rounded-lg border bg-muted/40 px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Scope pills */}
                <div className="flex gap-1.5">
                  {(["all", "global", "app", "influencer"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPickerScope(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        pickerScope === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      {s === "all" ? "Todos" : s === "global" ? "Global" : s === "app" ? "App" : "Influencer"}
                    </button>
                  ))}
                </div>

                {/* Tag chips del slide actual */}
                {pickerAvailTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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
              </div>
            </div>

            {/* Scrollable grid */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Cargando imágenes…
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reorder modal ── */}
      {reorderOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setReorderOpen(false)}
        >
          <div
            className="bg-background rounded-2xl border shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Reorganizar slides</h3>
              <button onClick={() => setReorderOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-2 flex-1">
              {reorderSlides.map((slide, i) => {
                const src = slide.generatedImagePath ?? slide.imagePath;
                const firstText = parseTexts(slide.texts)[0]?.content ?? "";
                return (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={() => { dragIndex.current = null; }}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20 cursor-grab active:cursor-grabbing select-none"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    {src && (
                      <img
                        src={src}
                        alt={`Slide ${i + 1}`}
                        className="h-14 rounded shrink-0 object-cover"
                        style={{ aspectRatio: "9/16" }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                      <p className="text-sm truncate leading-snug">{firstText || "(sin texto)"}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 p-3 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setReorderOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={reorderSaving} onClick={saveReorder}>
                {reorderSaving ? "Guardando…" : "Guardar orden"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
