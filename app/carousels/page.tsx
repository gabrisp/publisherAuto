"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Download,
  Trash2,
  LayoutList,
  Copy,
  X,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

/* ─── tipos ─────────────────────────────────────────────────────────────── */

type TextEl = { id: string; content: string };

type Slide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
  imageId: string | null;
  texts: string;
};

type CarouselRow = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  zipPath: string | null;
  appId: string | null;
  influencerId: string | null;
  appName: string | null;
  influencerName: string | null;
  idSlideImagePath: string | null;
  sentAt: number | null;
  sentToAccountId: string | null;
  sentToAccountName: string | null;
  slideCount: number;
  slides: Slide[];
};

type PickerImage = {
  id: string;
  path: string;
  tag: string;
  filename: string;
  scope: string;
};

type TikTokAccount = { id: string; name: string };

type DebugEntry = {
  carouselName: string;
  ok: boolean;
  imageUrls?: string[];
  debug: object | null;
  error?: string;
};

/* ─── helpers ────────────────────────────────────────────────────────────── */

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
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── página ─────────────────────────────────────────────────────────────── */

export default function CarouselsPage() {
  const [all, setAll] = useState<CarouselRow[]>([]);
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [tab, setTab] = useState<"pending" | "sent">("sent");

  // Pendientes: estado de acciones
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  // Panel de contenido
  const [contentOpen, setContentOpen] = useState<Set<string>>(new Set());

  // Selector de imagen
  const [pickerState, setPickerState] = useState<{ carouselId: string; slideId: string } | null>(null);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [changingImage, setChangingImage] = useState(false);

  async function load() {
    const [cRes, aRes] = await Promise.all([
      fetch("/api/carousels"),
      fetch("/api/tiktok/accounts"),
    ]);
    setAll(await cRes.json());
    setAccounts(await aRes.json());
  }

  useEffect(() => { load(); }, []);

  const pending = all.filter((c) => c.sentAt === null);
  const sent = all.filter((c) => c.sentAt !== null);
  const rows = tab === "pending" ? pending : sent;

  /* selección */
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => prev.size === pending.length ? new Set() : new Set(pending.map((c) => c.id)));
  }

  /* contenido */
  function toggleContent(id: string) {
    setContentOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  /* textos */
  function copySlideText(slide: Slide) {
    const content = parseTexts(slide.texts).map((t) => t.content).join("\n");
    if (!content.trim()) { toast("Sin texto"); return; }
    navigator.clipboard.writeText(content);
    toast.success("Copiado");
  }
  function copyAllTexts(slides: Slide[]) {
    const parts = slides.map((s, i) => `SLIDE ${i + 1}\n${parseTexts(s.texts).map((t) => t.content).join("\n") || "(sin texto)"}`);
    navigator.clipboard.writeText(parts.join("\n\n"));
    toast.success("Todos los textos copiados");
  }

  /* acciones carousel */
  async function handleDelete(id: string) {
    await fetch(`/api/carousels/${id}`, { method: "DELETE" });
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    load();
  }

  async function bulkDiscard() {
    if (!selected.size) return;
    if (!confirm(`¿Eliminar ${selected.size} carousel${selected.size !== 1 ? "s" : ""}?`)) return;
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/carousels/${id}`, { method: "DELETE" })));
    toast.success(`${selected.size} eliminado${selected.size !== 1 ? "s" : ""}`);
    setSelected(new Set());
    load();
  }

  async function handleUpload(accountId: string) {
    if (!selected.size) { toast.error("Selecciona al menos uno"); return; }
    const ids = Array.from(selected);
    const newLogs: DebugEntry[] = [];
    let ok = 0;
    for (const id of ids) {
      setUploading(id);
      const name = all.find((c) => c.id === id)?.name ?? id;
      try {
        const res = await fetch(`/api/carousels/${id}/tiktok`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`Error: ${data.error}`);
          newLogs.push({ carouselName: name, ok: false, imageUrls: data.imageUrls, debug: data.debug, error: data.error });
        } else {
          ok++;
          newLogs.push({ carouselName: name, ok: true, imageUrls: data.imageUrls, debug: data.debug });
        }
      } catch (e) {
        toast.error("Error de conexión");
        newLogs.push({ carouselName: name, ok: false, debug: null, error: String(e) });
      }
    }
    setUploading(null);
    setDebugLog((prev) => [...newLogs, ...prev]);
    if (ok > 0) {
      toast.success(`${ok} subido${ok !== 1 ? "s" : ""} como draft`);
      setSelected(new Set());
      await load();
      setTab("sent");
    }
  }

  /* image picker */
  async function openPicker(carouselId: string, slideId: string) {
    setPickerState({ carouselId, slideId });
    setPickerLoading(true);
    setPickerImages(await fetch("/api/images").then((r) => r.json()));
    setPickerLoading(false);
  }
  async function handleImageChange(imageId: string) {
    if (!pickerState) return;
    setChangingImage(true);
    await fetch(`/api/carousels/${pickerState.carouselId}/slides/${pickerState.slideId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    setPickerState(null);
    setChangingImage(false);
    toast.success("Imagen actualizada · Genera para ver el resultado");
    load();
  }

  /* ─── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carousels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""} · {sent.length} enviado{sent.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Botón subir — solo en pestaña pendientes */}
        {tab === "pending" && (
          accounts.length > 0 ? (
            <DropdownMenu>
              {/* @ts-expect-error — asChild Radix types mismatch */}
              <DropdownMenuTrigger asChild>
                <Button disabled={selected.size === 0 || !!uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Subiendo…" : `Subir (${selected.size}) a TikTok`}
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
              <Button variant="outline">Conectar TikTok primero</Button>
            </Link>
          )
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["pending", "sent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pending" ? `Pendientes (${pending.length})` : `Enviados (${sent.length})`}
          </button>
        ))}
      </div>

      {/* Barra de acciones bulk — solo pendientes */}
      {tab === "pending" && pending.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.size === pending.length && pending.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} seleccionado${selected.size !== 1 ? "s" : ""}` : "Seleccionar todo"}
          </span>
          {selected.size > 0 && (
            <Button size="sm" variant="outline" onClick={bulkDiscard}
              className="h-7 text-xs text-destructive hover:text-destructive border-destructive/40 hover:border-destructive">
              <Trash2 className="h-3 w-3 mr-1" />
              Descartar {selected.size}
            </Button>
          )}
        </div>
      )}

      {/* Lista */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          {tab === "pending"
            ? <>No hay carousels pendientes. <Link href="/generate" className="underline">Genera uno nuevo.</Link></>
            : "Ningún carousel enviado aún."}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.id}
              className={`relative rounded-xl border p-4 transition-colors ${
                tab === "pending" && selected.has(c.id) ? "border-primary bg-primary/5" : "hover:bg-muted/30"
              } ${tab === "sent" ? "cursor-pointer" : ""}`}
            >
              {/* Overlay clickable en enviados — el botón ZIP queda encima con z-10 */}
              {tab === "sent" && (
                <Link href={`/carousels/${c.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={c.name} />
              )}
              {/* ── Cabecera ── */}
              <div className="relative z-10 flex items-center gap-3 flex-wrap">
                {/* Checkbox (solo pendientes) */}
                {tab === "pending" && (
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                    className="h-4 w-4 cursor-pointer accent-primary" />
                )}

                {/* ShortId */}
                {c.shortId && (
                  <code className="bg-primary/10 text-primary text-sm font-mono font-black px-2 py-0.5 rounded tracking-widest shrink-0">
                    {c.shortId}
                  </code>
                )}

                {/* Nombre + estado */}
                <span className="font-semibold text-sm">{c.name}</span>
                <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {[c.influencerName, c.appName].filter(Boolean).join(" × ")} · {c.slideCount} slides
                </span>

                {/* Enviado a (tab sent) */}
                {tab === "sent" && c.sentToAccountName && (
                  <span className="text-xs font-medium ml-auto">
                    @{c.sentToAccountName}
                    {c.sentAt && <span className="text-muted-foreground font-normal"> · {fmtDate(c.sentAt)}</span>}
                  </span>
                )}

                {/* Acciones (tab pending) */}
                {tab === "pending" && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button size="sm" variant={contentOpen.has(c.id) ? "secondary" : "ghost"}
                      onClick={() => toggleContent(c.id)}>
                      <LayoutList className="h-3.5 w-3.5 mr-1" /> Contenido
                    </Button>
                    <a href={`/api/carousels/${c.id}/download`}>
                      <Button size="sm" variant="ghost"><Download className="h-3.5 w-3.5 mr-1" />ZIP</Button>
                    </a>
                    <button onClick={() => handleDelete(c.id)}
                      className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Descarga ZIP (tab sent) — z-10 para estar encima del overlay */}
                {tab === "sent" && (
                  <a href={`/api/carousels/${c.id}/download`} className="relative z-10 ml-auto"
                    onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                )}
              </div>

              {/* ── Slides strip (pendientes sin panel abierto) ── */}
              {tab === "pending" && !contentOpen.has(c.id) && c.slides?.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 mt-3">
                  {c.slides.map((slide) => {
                    const src = slide.generatedImagePath ?? slide.imagePath;
                    return (
                      <div key={slide.id} className="shrink-0 relative rounded-lg overflow-hidden bg-muted"
                        style={{ width: 140, height: 249 }}>
                        {src ? (
                          <img src={src} alt={`Slide ${slide.order + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            {slide.order + 1}
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-1 text-[10px] text-white/80 font-medium">
                          {slide.order + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Panel de contenido ── */}
              {tab === "pending" && contentOpen.has(c.id) && c.slides?.length > 0 && (
                <div className="mt-3 space-y-4">
                  {/* ShortId destacado + ID slide thumbnail */}
                  <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">ID</div>
                      <code className="bg-background text-2xl px-4 py-1.5 rounded border font-mono font-black tracking-[0.25em] shadow-sm">
                        {c.shortId ?? "—"}
                      </code>
                    </div>
                    {c.idSlideImagePath && (
                      <img src={c.idSlideImagePath} alt="ID slide"
                        className="ml-auto w-16 rounded border shadow-sm" style={{ aspectRatio: "9/16", objectFit: "cover" }} />
                    )}
                  </div>

                  {/* 2 columnas */}
                  <div className="grid grid-cols-5 gap-5">
                    {/* Izq: thumbnails */}
                    <div className="col-span-2 space-y-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Slides
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {c.slides.map((slide) => {
                          const src = slide.generatedImagePath ?? slide.imagePath;
                          return (
                            <div key={slide.id} className="space-y-1">
                              <div className="relative rounded-lg overflow-hidden bg-muted border"
                                style={{ aspectRatio: "9/16" }}>
                                {src
                                  ? <img src={src} alt={`Slide ${slide.order + 1}`} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-5 w-5 opacity-30" /></div>}
                                <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] rounded px-1 font-medium">
                                  {slide.order + 1}
                                </span>
                              </div>
                              <Button size="sm" variant="outline" className="w-full h-6 text-[10px] px-1"
                                onClick={() => openPicker(c.id, slide.id)}>
                                Cambiar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Der: textos */}
                    <div className="col-span-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Textos</div>
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => copyAllTexts(c.slides)}>
                          <Copy className="h-3 w-3 mr-1" />Copiar todo
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {c.slides.map((slide) => {
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
                              {content.trim()
                                ? <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
                                : <span className="text-xs text-muted-foreground italic">Sin texto</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Debug log TikTok */}
      {debugLog.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">TikTok API log</h2>
            <button onClick={() => setDebugLog([])} className="text-xs text-muted-foreground hover:text-foreground">Limpiar</button>
          </div>
          {debugLog.map((entry, i) => (
            <div key={i} className={`rounded-lg border p-3 text-xs font-mono space-y-2 ${entry.ok ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 font-sans text-sm font-medium">
                <span className={entry.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}>{entry.ok ? "✓" : "✗"}</span>
                {entry.carouselName}
                {entry.error && <span className="text-destructive font-normal text-xs">{entry.error}</span>}
              </div>
              {entry.imageUrls && entry.imageUrls.length > 0 && (
                <div className="space-y-1">
                  <div className="font-sans text-[10px] uppercase tracking-wide text-muted-foreground">
                    URLs enviadas ({entry.imageUrls.length})
                  </div>
                  {entry.imageUrls.map((url, j) => (
                    <div key={j} className="text-[11px] break-all opacity-80">
                      <span className="text-muted-foreground mr-1">{j + 1}.</span>
                      <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{url}</a>
                    </div>
                  ))}
                </div>
              )}
              {entry.debug && (
                <details>
                  <summary className="cursor-pointer font-sans text-[10px] uppercase tracking-wide text-muted-foreground select-none">
                    TikTok API response
                  </summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] opacity-80">
                    {JSON.stringify(entry.debug, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal imagen picker */}
      {pickerState && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          onClick={() => !changingImage && setPickerState(null)}>
          <div className="bg-background rounded-xl border max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
              <h3 className="font-semibold">Seleccionar imagen</h3>
              <button onClick={() => !changingImage && setPickerState(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {pickerLoading
                ? <div className="text-center text-sm text-muted-foreground py-16">Cargando…</div>
                : pickerImages.length === 0
                  ? <div className="text-center text-sm text-muted-foreground py-16">No hay imágenes</div>
                  : (
                    <div className="grid grid-cols-4 gap-3">
                      {pickerImages.map((img) => (
                        <button key={img.id}
                          className="rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all relative group"
                          style={{ aspectRatio: "9/16" }}
                          onClick={() => handleImageChange(img.id)}
                          disabled={changingImage}>
                          <img src={img.path} alt={img.tag} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.tag}
                          </div>
                        </button>
                      ))}
                    </div>
                  )
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
