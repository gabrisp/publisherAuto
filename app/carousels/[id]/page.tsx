"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Shuffle,
  ChevronDown,
  Trash2,
  X,
  ImageIcon,
  Share2,
  GripVertical,
  ArrowUpDown,
  Pencil,
  Check,
  Folder,
  FolderInput,
  Archive,
  ArchiveRestore,
  Calendar,
  BarChart2,
  CheckCircle2,
  Loader2,
  UserCircle,
  Clock,
  Plus,
  Upload,
  Play,
  Sun,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { parseTags } from "@/lib/ids";
import { processImageForDownload } from "@/lib/image-download";

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

type Stats = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
};

type CarouselDetail = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  folderId: string | null;
  archivedAt: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  stats: string | null;
  videoTitle: string | null;
  videoDescription: string | null;
  videoHashtags: string | null;
  zipPath: string | null;
  sentAt: number | null;
  sentToAccountId: string | null;
  sentToAccountName: string | null;
  publisherUserId: string | null;
  publisherUsername: string | null;
  createdAt: number;
  appName: string | null;
  influencerName: string | null;
  slides: Slide[];
};

type FolderRecord = { id: string; name: string };
type TikTokAccountRecord = { id: string; name: string; avatarUrl: string | null };

type PickerImage = { id: string; path: string; tag: string; originalName: string; scope: string };

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
  const { data: folders = [] } = useSWR<FolderRecord[]>("/api/folders", fetcher);
  const { data: tiktokAccountsList = [] } = useSWR<TikTokAccountRecord[]>("/api/tiktok/accounts", fetcher);
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

  // Folder picker dropdown
  const [folderOpen, setFolderOpen] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  useEffect(() => {
    if (!folderOpen) return;
    const close = () => setFolderOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [folderOpen]);

  // Desktop tab
  const [activeTab, setActiveTab] = useState<"contenido" | "stats">("contenido");

  // Stats form
  const [statsForm, setStatsForm] = useState<Stats>({});
  const [savingStats, setSavingStats] = useState(false);
  useEffect(() => {
    if (carousel?.stats) {
      try { setStatsForm(JSON.parse(carousel.stats)); } catch { /* */ }
    }
  }, [carousel?.stats]);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [savingName, setSavingName] = useState(false);
  useEffect(() => {
    if (carousel?.name) setNameVal(carousel.name);
  }, [carousel?.id]);

  // Caption editing
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionTitle, setCaptionTitle] = useState("");
  const [captionDesc, setCaptionDesc] = useState("");
  const [captionTags, setCaptionTags] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  useEffect(() => {
    if (!carousel) return;
    setCaptionTitle(carousel.videoTitle ?? "");
    setCaptionDesc(carousel.videoDescription ?? "");
    try {
      const arr: string[] = carousel.videoHashtags ? JSON.parse(carousel.videoHashtags) : [];
      setCaptionTags(arr.map((h) => h.replace(/^#/, "")).join(" "));
    } catch { setCaptionTags(""); }
  }, [carousel?.id]);

  // Text editing
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editingTexts, setEditingTexts] = useState<TextEl[]>([]);
  const [savingText, setSavingText] = useState(false);

  // Acciones
  const [shuffling, setShuffling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Published-at editing
  const [editingPublishedAt, setEditingPublishedAt] = useState(false);
  const [publishedAtInput, setPublishedAtInput] = useState("");

  // Drag-and-drop images onto slide grid
  const [gridDragOver, setGridDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);

  // Per-slide brightness override (null = random 80–100%)
  const [brightnessBySlide, setBrightnessBySlide] = useState<Record<string, number>>({});

  // Bulk slide text editing
  const [bulkTextOpen, setBulkTextOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Reorder modal
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderSlides, setReorderSlides] = useState<Slide[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const dragIndex = useRef<number | null>(null);

  async function saveName() {
    if (!carousel || !nameVal.trim()) return;
    setSavingName(true);
    try {
      await fetch(`/api/carousels/${carousel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameVal.trim() }),
      });
      await mutate();
      setEditingName(false);
      toast.success("Nombre guardado");
    } catch {
      toast.error("Error al guardar nombre");
    } finally {
      setSavingName(false);
    }
  }

  async function saveBulkTexts() {
    if (!carousel) return;
    setSavingBulk(true);
    try {
      const parts = bulkText.split(/^SLIDE \d+$/m);
      parts.shift(); // drop content before first SLIDE marker
      const sorted = [...carousel.slides].sort((a, b) => a.order - b.order);
      await Promise.all(
        parts.slice(0, sorted.length).map((part, i) => {
          const content = part.trim();
          const slide = sorted[i];
          const texts: TextEl[] = content ? [{ id: "t0", content }] : [];
          return fetch(`/api/carousels/${carousel.id}/slides/${slide.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts }),
          });
        })
      );
      await mutate();
      setBulkTextOpen(false);
      toast.success("Textos guardados");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSavingBulk(false);
    }
  }

  async function saveCaption() {
    if (!carousel) return;
    setSavingCaption(true);
    try {
      const hashArr = captionTags
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, "").trim())
        .filter(Boolean);
      await fetch(`/api/carousels/${carousel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: captionTitle.trim() || null,
          videoDescription: captionDesc.trim() || null,
          videoHashtags: hashArr.length ? JSON.stringify(hashArr) : null,
        }),
      });
      await mutate();
      setEditingCaption(false);
      toast.success("Caption guardado");
    } catch {
      toast.error("Error al guardar caption");
    } finally {
      setSavingCaption(false);
    }
  }

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

  async function handleShuffle() {
    if (!carousel) return;
    setShuffling(true);
    try {
      const res = await fetch(`/api/carousels/${carousel.id}/shuffle`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error("Error al barajar"); return; }
      if (data.shuffled === 0) {
        toast("Sin alternativas para ninguna imagen", { duration: 2000 });
      } else {
        toast.success(`${data.shuffled} imagen${data.shuffled > 1 ? "es" : ""} cambiada${data.shuffled > 1 ? "s" : ""}`);
        await mutate();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setShuffling(false);
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



  async function handleShareSlides() {
    if (!carousel || sharing) return;
    setSharing(true);
    try {
      const sorted = [...carousel.slides]
        .sort((a, b) => a.order - b.order)
        .filter((s) => !!(s.generatedImagePath ?? s.imagePath));
      if (!sorted.length) { toast.error("Sin imágenes"); return; }
      // All 4×N canvas ops in parallel — keeps total time ~500ms so iOS gesture doesn't expire
      const ts = Date.now();
      const files = await Promise.all(
        sorted.map((slide) => {
          const url = (slide.generatedImagePath ?? slide.imagePath)!;
          return processImageForDownload(url, brightnessBySlide[slide.id]).then(
            (blob) => new File([blob], `${ts}-s${slide.order + 1}.jpg`, { type: "image/jpeg" })
          );
        })
      );
      if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
        await navigator.share({ files, title: carousel.name });
      } else {
        for (const file of files) {
          const href = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = href; a.download = file.name; a.click();
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

  async function uploadSlideImage(slideId: string, file: File) {
    if (!carousel) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/carousels/${carousel.id}/slides/${slideId}/upload`, { method: "POST", body: form });
    if (!res.ok) { toast.error("Error al subir imagen"); return; }
    await mutate();
    toast.success("Imagen subida");
  }

  async function handleGridDrop(e: React.DragEvent) {
    e.preventDefault();
    setGridDragOver(false);
    if (!carousel) return;
    const files = Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    if (!files.length) return;
    setUploading(true);
    try {
      const sorted = [...carousel.slides].sort((a, b) => a.order - b.order);
      // Empty slots first (no image at all)
      const emptySlides = sorted.filter((s) => !s.generatedImagePath && !s.imagePath);

      const targets: { slideId: string; file: File }[] = [];
      for (let i = 0; i < files.length; i++) {
        if (i < emptySlides.length) {
          // Fill existing empty slot
          targets.push({ slideId: emptySlides[i].id, file: files[i] });
        } else {
          // No empty slot left — create a new slide
          const res = await fetch(`/api/carousels/${carousel.id}/slides`, { method: "POST" });
          const slide = await res.json();
          targets.push({ slideId: slide.id, file: files[i] });
        }
      }

      // Upload all in parallel
      await Promise.all(
        targets.map(({ slideId, file }) => {
          const form = new FormData();
          form.append("file", file);
          return fetch(`/api/carousels/${carousel.id}/slides/${slideId}/upload`, { method: "POST", body: form });
        })
      );
      await mutate();
      toast.success(`${files.length} imagen${files.length > 1 ? "es" : ""} subida${files.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Error al subir imágenes");
    } finally {
      setUploading(false);
    }
  }

  async function addSlide() {
    if (!carousel) return;
    await fetch(`/api/carousels/${carousel.id}/slides`, { method: "POST" });
    await mutate();
    toast.success("Slide añadida");
  }

  async function deleteSlide(slideId: string) {
    if (!carousel) return;
    await fetch(`/api/carousels/${carousel.id}/slides/${slideId}`, { method: "DELETE" });
    await mutate();
    toast.success("Slide eliminada");
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

  async function handleScheduledDateChange(date: string | null) {
    await patchCarousel({ scheduledDate: date });
  }

  async function toggleDraft() {
    if (!carousel) return;
    const sentAt = carousel.sentAt ? null : Math.floor(Date.now() / 1000);
    await patchCarousel({ sentAt });
    toast(sentAt ? "Marcado como draft" : "Quitado de draft", { duration: 1500 });
  }

  async function togglePublished() {
    if (!carousel) return;
    const publishedAt = carousel.publishedAt ? null : Math.floor(Date.now() / 1000);
    await patchCarousel({ publishedAt });
    toast(publishedAt ? "Marcado como publicado" : "Desmarcado", { duration: 1500 });
  }

  async function savePublishedAt() {
    if (!carousel || !publishedAtInput) return;
    const publishedAt = Math.floor(new Date(publishedAtInput).getTime() / 1000);
    await patchCarousel({ publishedAt });
    setEditingPublishedAt(false);
    toast.success("Fecha de publicación guardada");
  }

  async function saveStats() {
    if (!carousel) return;
    setSavingStats(true);
    try {
      await patchCarousel({ stats: statsForm });
      toast.success("Stats guardadas");
    } finally {
      setSavingStats(false);
    }
  }

  async function patchCarousel(body: Record<string, unknown>) {
    await fetch(`/api/carousels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await mutate();
  }

  async function moveToFolder(folderId: string | null) {
    setFolderOpen(false);
    await patchCarousel({ folderId });
  }

  async function toggleArchive() {
    if (!carousel) return;
    const archivedAt = carousel.archivedAt ? null : Math.floor(Date.now() / 1000);
    await patchCarousel({ archivedAt });
    if (archivedAt) toast("Archivado", { duration: 1500 });
    else toast("Desarchivado", { duration: 1500 });
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

  const isPending = !carousel.publishedAt;
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

          <button
            onClick={handleShuffle}
            disabled={shuffling}
            title="Barajar imágenes"
            className="h-9 w-9 flex items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
          >
            {shuffling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
          <a href={`/api/carousels/${carousel.id}/download`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
            ZIP
          </a>
        </div>
      </div>

      {/* ── Title + meta (in scroll, above ID block) ── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {editingName ? (
            <>
              <input
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                autoFocus
                className="text-xl font-bold leading-tight bg-transparent outline-none border-b border-primary min-w-0 flex-1"
              />
              <button onClick={saveName} disabled={savingName} className="h-6 px-2 rounded-md text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />{savingName ? "…" : "OK"}
              </button>
              <button onClick={() => setEditingName(false)} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted/60">
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold leading-tight">{carousel.name}</h1>
              <button onClick={() => { setNameVal(carousel.name); setEditingName(true); }} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </>
          )}
          {!!carousel.publishedAt && (
            <span className="text-xs bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-full px-2 py-0.5 font-semibold">
              Publicado
            </span>
          )}
          {!!carousel.sentAt && !carousel.publishedAt && (
            <span className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full px-2 py-0.5 font-semibold">
              Draft
            </span>
          )}
          {carousel.archivedAt && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
              Archivado
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[carousel.influencerName, carousel.appName].filter(Boolean).join(" × ")}
        </p>

        {/* Folder + archive actions */}
        <div className="flex items-center gap-2 mt-2.5">
          {/* Folder picker */}
          <div className="relative">
            <button
              onClick={() => setFolderOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/60 bg-muted/30"
            >
              <Folder className="h-3 w-3 shrink-0" />
              {carousel.folderId
                ? (folders.find((f) => f.id === carousel.folderId)?.name ?? "Carpeta")
                : "Sin carpeta"}
              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
            </button>
            {folderOpen && (
              <div className="absolute top-full mt-1.5 left-0 z-50 bg-background border shadow-xl rounded-xl overflow-hidden min-w-40 py-1">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/60"
                  onClick={() => moveToFolder(null)}
                >
                  <FolderInput className="h-3 w-3" />
                  Sin carpeta
                </button>
                {folders.length > 0 && <div className="border-t my-1" />}
                {folders.map((f) => (
                  <button
                    key={f.id}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/60 ${carousel.folderId === f.id ? "font-semibold text-primary" : ""}`}
                    onClick={() => moveToFolder(f.id)}
                  >
                    <Folder className="h-3 w-3" />
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled date */}
          <div className="relative">
            <label className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/60 bg-muted/30 text-muted-foreground hover:text-foreground cursor-pointer">
              <Calendar className="h-3 w-3 shrink-0" />
              {carousel.scheduledDate
                ? new Date(carousel.scheduledDate + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })
                : "Fecha"}
              <input
                type="date"
                value={carousel.scheduledDate ?? ""}
                onChange={(e) => handleScheduledDateChange(e.target.value || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Scheduled time */}
          <label className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/60 bg-muted/30 text-muted-foreground hover:text-foreground cursor-pointer">
            <Clock className="h-3 w-3 shrink-0" />
            {carousel.scheduledTime ?? "Hora"}
            <input
              type="time"
              value={carousel.scheduledTime ?? ""}
              onChange={(e) => patchCarousel({ scheduledTime: e.target.value || null })}
              className="absolute opacity-0 w-0 h-0"
            />
          </label>

          {/* TikTok account picker → auto-assigns publisher user */}
          {tiktokAccountsList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setUserPickerOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/60 bg-muted/30 text-muted-foreground hover:text-foreground"
              >
                <UserCircle className="h-3 w-3 shrink-0" />
                {carousel.sentToAccountName ? `@${carousel.sentToAccountName}` : "Cuenta"}
                {carousel.publisherUsername && (
                  <span className="text-[10px] opacity-60">· {carousel.publisherUsername}</span>
                )}
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </button>
              {userPickerOpen && (
                <div className="absolute top-full mt-1.5 left-0 z-50 bg-background border shadow-xl rounded-xl overflow-hidden min-w-44 py-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/60"
                    onClick={() => { patchCarousel({ sentToAccountId: null }); setUserPickerOpen(false); }}
                  >
                    <X className="h-3 w-3" />
                    Sin asignar
                  </button>
                  <div className="border-t my-1" />
                  {tiktokAccountsList.map((acc) => (
                    <button
                      key={acc.id}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/60 ${carousel.sentToAccountId === acc.id ? "font-semibold text-primary" : ""}`}
                      onClick={() => { patchCarousel({ sentToAccountId: acc.id }); setUserPickerOpen(false); toast.success(`Asignado a @${acc.name}`, { duration: 1500 }); }}
                    >
                      {acc.avatarUrl
                        ? <img src={acc.avatarUrl} alt={acc.name} className="h-4 w-4 rounded-full object-cover" />
                        : <UserCircle className="h-3 w-3" />}
                      @{acc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Archive toggle */}
          <button
            onClick={toggleArchive}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/60 bg-muted/30 text-muted-foreground hover:text-foreground"
          >
            {carousel.archivedAt
              ? <><ArchiveRestore className="h-3 w-3" /> Desarchivar</>
              : <><Archive className="h-3 w-3" /> Archivar</>}
          </button>
        </div>
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

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b">
        {(["contenido", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "contenido" ? <><ImageIcon className="h-3.5 w-3.5" />Contenido</> : <><BarChart2 className="h-3.5 w-3.5" />Stats</>}
          </button>
        ))}
      </div>

      {/* ── Stats tab ── */}
      <div className={activeTab !== "stats" ? "hidden" : "block"}>
        <div className="max-w-md space-y-6">
          {/* Draft + Published toggles */}
          <div className="space-y-2">
            {/* Draft */}
            {!carousel.publishedAt && (
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                <div>
                  <p className="text-sm font-semibold">Draft</p>
                  {carousel.sentAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Subido el {new Date(carousel.sentAt * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
                <button
                  onClick={toggleDraft}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    carousel.sentAt
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                      : "bg-muted hover:bg-muted/70 text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {carousel.sentAt ? "Draft" : "Marcar draft"}
                </button>
              </div>
            )}

            {/* Published */}
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm font-semibold">Publicado</p>
                {carousel.publishedAt && !editingPublishedAt && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {new Date(carousel.publishedAt * 1000).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <button
                      onClick={() => {
                        const d = new Date(carousel.publishedAt! * 1000);
                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        setPublishedAtInput(local);
                        setEditingPublishedAt(true);
                      }}
                      className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
                {editingPublishedAt && (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="datetime-local"
                      value={publishedAtInput}
                      onChange={(e) => setPublishedAtInput(e.target.value)}
                      className="text-xs bg-transparent border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button onClick={savePublishedAt} className="h-5 px-1.5 rounded text-[10px] font-medium bg-primary text-primary-foreground flex items-center gap-0.5">
                      <Check className="h-2.5 w-2.5" />OK
                    </button>
                    <button onClick={() => setEditingPublishedAt(false)} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted/60">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={togglePublished}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  carousel.publishedAt
                    ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25"
                    : "bg-muted hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {carousel.publishedAt ? "Publicado" : "Marcar publicado"}
              </button>
            </div>
          </div>

          {/* Stats form */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Estadísticas</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["views", "Visualizaciones"],
                ["likes", "Me gusta"],
                ["comments", "Comentarios"],
                ["shares", "Compartidos"],
                ["saves", "Guardados"],
              ] as [keyof Stats, string][]).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={statsForm[key] ?? ""}
                    onChange={(e) => setStatsForm((prev) => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="—"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveStats}
              disabled={savingStats}
              className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {savingStats ? "Guardando…" : "Guardar stats"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className={`grid grid-cols-1 md:grid-cols-5 gap-6 ${activeTab === "stats" ? "hidden" : ""}`}>
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
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPreviewSlideIdx(0); setPreviewOpen(true); }}>
                <Play className="h-3 w-3 mr-1" />Play
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleShareSlides} disabled={sharing}>
                <Share2 className="h-3 w-3 mr-1" />{sharing ? "Guardando…" : "Guardar fotos"}
              </Button>
            </div>
          </div>
          <div
            className={`grid grid-cols-4 gap-2 rounded-xl transition-colors ${gridDragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""} ${uploading ? "opacity-60 pointer-events-none" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setGridDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setGridDragOver(false); }}
            onDrop={handleGridDrop}
          >
            {[...carousel.slides].sort((a, b) => a.order - b.order).map((slide) => {
              const src = slide.generatedImagePath ?? slide.imagePath;
              const bVal = brightnessBySlide[slide.id];
              return (
                <div key={slide.id} className="flex flex-col gap-0.5">
                  <div
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
                    <button
                      className="absolute top-1 right-1 bg-black/60 hover:bg-destructive/80 text-white rounded p-0.5 transition-colors"
                      onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                      title="Eliminar slide"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <label
                      className="absolute bottom-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded p-0.5 transition-colors cursor-pointer"
                      title="Subir imagen"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Upload className="h-2.5 w-2.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSlideImage(slide.id, f); e.target.value = ""; }}
                      />
                    </label>
                  </div>
                  {/* Brightness slider — opacity-30 = auto (random), full = fixed */}
                  <div className="flex items-center gap-0.5 px-0.5">
                    <Sun className={`h-2 w-2 shrink-0 ${bVal == null ? "opacity-25" : "text-amber-400"}`} />
                    <input
                      type="range"
                      min={50} max={100} step={1}
                      value={bVal != null ? Math.round(bVal * 100) : 90}
                      onChange={(e) => { e.stopPropagation(); setBrightnessBySlide((prev) => ({ ...prev, [slide.id]: Number(e.target.value) / 100 })); }}
                      onDoubleClick={(e) => { e.stopPropagation(); setBrightnessBySlide((prev) => { const n = { ...prev }; delete n[slide.id]; return n; }); }}
                      onClick={(e) => e.stopPropagation()}
                      className={`flex-1 h-1 cursor-pointer accent-amber-400 ${bVal == null ? "opacity-25" : ""}`}
                      title={bVal != null ? `Brillo fijo: ${Math.round(bVal * 100)}% (doble clic → auto)` : "Brillo: auto (80–100%)"}
                    />
                  </div>
                </div>
              );
            })}
            {/* Add slide button */}
            <button
              onClick={addSlide}
              className="relative rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40 transition-colors flex items-center justify-center"
              style={{ aspectRatio: "9/16" }}
              title="Añadir slide"
            >
              <Plus className="h-5 w-5 text-muted-foreground/50" />
            </button>
            {/* Drop overlay hint */}
            {gridDragOver && (
              <div className="col-span-4 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 py-4">
                <p className="text-xs font-medium text-primary">Suelta las imágenes aquí</p>
              </div>
            )}
            {uploading && (
              <div className="col-span-4 flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Subiendo…</p>
              </div>
            )}
          </div>
        </div>

        {/* Textos */}
        <div className="md:col-span-3 space-y-3">
          {/* Caption de TikTok */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Caption</h2>
              {editingCaption ? (
                <div className="flex items-center gap-1">
                  <button
                    disabled={savingCaption}
                    onClick={saveCaption}
                    className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="h-2.5 w-2.5" />
                    {savingCaption ? "…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditingCaption(false)}
                    className="h-6 px-1.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingCaption(true)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            {editingCaption ? (
              <div className="space-y-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Título</span>
                    <span className="text-[10px] text-muted-foreground">{captionTitle.length}/90</span>
                  </div>
                  <input
                    value={captionTitle}
                    onChange={(e) => setCaptionTitle(e.target.value)}
                    placeholder="Título del vídeo…"
                    maxLength={90}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Descripción</span>
                  </div>
                  <textarea
                    value={captionDesc}
                    onChange={(e) => setCaptionDesc(e.target.value)}
                    placeholder="Descripción del vídeo…"
                    rows={5}
                    className="w-full bg-transparent text-sm outline-none resize-none leading-relaxed"
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Hashtags</span>
                  </div>
                  <input
                    value={captionTags}
                    onChange={(e) => setCaptionTags(e.target.value)}
                    placeholder="trending viral fyp …"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Separados por espacio, sin #</p>
                </div>
              </div>
            ) : (carousel.videoTitle || carousel.videoDescription) ? (
              <div className="space-y-2">
                {carousel.videoTitle && (
                  <div
                    className="rounded-lg border bg-muted/30 p-3 cursor-pointer active:bg-muted/60 transition-colors"
                    onClick={() => { navigator.clipboard.writeText(carousel.videoTitle!); toast("✓ Título copiado", { duration: 800 }); }}
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
            ) : (
              <p className="text-xs text-muted-foreground italic">Sin caption — pulsa el lápiz para añadir</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Textos</h2>
            <div className="flex items-center gap-1">
              {bulkTextOpen ? (
                <>
                  <button
                    disabled={savingBulk}
                    onClick={saveBulkTexts}
                    className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="h-2.5 w-2.5" />{savingBulk ? "…" : "Guardar todo"}
                  </button>
                  <button
                    onClick={() => setBulkTextOpen(false)}
                    className="h-6 px-1.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copyAllTexts}>
                    <Copy className="h-3 w-3 mr-1" />Copiar todo
                  </Button>
                  <button
                    onClick={() => {
                      const sorted = [...carousel.slides].sort((a, b) => a.order - b.order);
                      const text = sorted.map((slide, i) => {
                        const texts = parseTexts(slide.texts);
                        const content = texts.map((t) => t.content).join("\n");
                        return `SLIDE ${i + 1}\n${content}`;
                      }).join("\n\n");
                      setBulkText(text);
                      setBulkTextOpen(true);
                    }}
                    className="flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium border hover:bg-muted/50"
                  >
                    <Pencil className="h-3 w-3" />Bulk
                  </button>
                </>
              )}
            </div>
          </div>
          {bulkTextOpen ? (
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full bg-muted/30 border rounded-lg p-3 text-sm font-mono resize-none outline-none min-h-[320px] leading-relaxed"
              placeholder={"SLIDE 1\ntexto...\n\nSLIDE 2\ntexto..."}
              spellCheck={false}
            />
          ) : (
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
          )}
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

      {/* ── Preview modal ── */}
      <Dialog open={previewOpen} onOpenChange={(o) => { if (!o) setPreviewOpen(false); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
          {(() => {
            const slides = [...carousel.slides].sort((a, b) => a.order - b.order);
            const cur = slides[previewSlideIdx];
            const src = cur?.generatedImagePath ?? cur?.imagePath;
            const slideText = parseTexts(cur?.texts)
              .map((item) => item.content?.trim())
              .filter(Boolean)
              .join("\n\n");
            return (
              <>
                <DialogTitle className="sr-only">{carousel.name}</DialogTitle>
                <div className="flex flex-col">
                  <div className="bg-neutral-950 px-4 py-5 sm:px-6">
                    <div className="mx-auto w-full max-w-[360px]">
                      <div className="relative overflow-hidden rounded-[28px] bg-black shadow-2xl" style={{ aspectRatio: "9/16" }}>
                        {src ? (
                          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="h-10 w-10 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/18" />
                        <div className="absolute inset-0 flex items-center justify-center p-7 text-center">
                          {slideText ? (
                            <div className="max-w-[82%] rounded-2xl bg-black/30 px-4 py-3 backdrop-blur-[2px]">
                              <p className="whitespace-pre-wrap text-[clamp(18px,2.4vw,26px)] font-semibold leading-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.6)]">
                                {slideText}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        {slides.length > 1 && (
                          <>
                            <button
                              onClick={() => setPreviewSlideIdx((i) => Math.max(0, i - 1))}
                              disabled={previewSlideIdx === 0}
                              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white disabled:opacity-20"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setPreviewSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                              disabled={previewSlideIdx === slides.length - 1}
                              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white disabled:opacity-20"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white">
                              {previewSlideIdx + 1}/{slides.length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <p className="font-semibold text-sm leading-snug truncate mr-4">{carousel.name}</p>
                    <button
                      onClick={() => setPreviewOpen(false)}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
