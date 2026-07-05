"use client";

import { useState, useRef, useEffect, useCallback } from "react"; // editor deploy
import { X, Type, ImageIcon, Trash2, Loader2, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { toast } from "sonner";

const CW = 1080;
const CH = 1920;

type TextLayer = {
  id: string;
  content: string;
  x: number; y: number;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  width: number;
  stroke: boolean;
};

type StickerLayer = {
  id: string;
  src: string;
  x: number; y: number;
  w: number; h: number;
};

type ImageAdjust = { brightness: number; contrast: number; saturation: number };

type PickerImage = { id: string; path: string; tag: string; originalName: string; scope: string };

interface SlideEditorProps {
  open: boolean;
  slide: { id: string; order: number; generatedImagePath: string | null; imagePath: string | null };
  carouselId: string;
  onClose: () => void;
  onGenerated: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function applyPixelAdjustments(ctx: CanvasRenderingContext2D, w: number, h: number, brightness: number, contrast: number, saturation: number) {
  if (brightness === 1 && contrast === 1 && saturation === 1) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    r *= brightness; g *= brightness; b *= brightness;
    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + saturation * (r - lum);
    g = lum + saturation * (g - lum);
    b = lum + saturation * (b - lum);
    d[i]     = Math.max(0, Math.min(255, r * 255));
    d[i + 1] = Math.max(0, Math.min(255, g * 255));
    d[i + 2] = Math.max(0, Math.min(255, b * 255));
  }
  ctx.putImageData(imageData, 0, 0);
}

function canvasWrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ");
    let cur = "";
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = word; }
      else cur = test;
    }
    lines.push(cur);
  }
  return lines;
}

export default function SlideEditor({ open, slide, carouselId, onClose, onGenerated }: SlideEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "text">("select");

  const [adjust, setAdjust] = useState<ImageAdjust>({ brightness: 1, contrast: 1, saturation: 1 });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerScope, setPickerScope] = useState<"all" | "global" | "app" | "influencer">("all");

  const [generating, setGenerating] = useState(false);

  // Drag / resize refs (avoids stale closure issues)
  const dragging = useRef<{ id: string; kind: "text" | "sticker"; ox: number; oy: number; startCX: number; startCY: number } | null>(null);
  const resizing = useRef<{ id: string; startCX: number; startCY: number; startW: number; startH: number; ar: number } | null>(null);

  // Track container width for scale
  useEffect(() => {
    if (!canvasRef.current) return;
    const update = () => { if (canvasRef.current) setScale(canvasRef.current.offsetWidth / CW); };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTextLayers([]);
      setStickerLayers([]);
      setSelectedId(null);
      setEditingTextId(null);
      setMode("select");
      setAdjust({ brightness: 1, contrast: 1, saturation: 1 });
    }
  }, [open, slide.id]);

  // Global pointer move + up
  useEffect(() => {
    function getClient(e: MouseEvent | TouchEvent) {
      return "touches" in e
        ? { cx: e.touches[0].clientX, cy: e.touches[0].clientY }
        : { cx: e.clientX, cy: e.clientY };
    }

    function onMove(e: MouseEvent | TouchEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { cx, cy } = getClient(e);

      if (dragging.current) {
        // Convert pointer to canvas coords
        const canvasX = (cx - rect.left) / rect.width * CW;
        const canvasY = (cy - rect.top) / rect.height * CH;
        const newX = Math.max(0, canvasX - dragging.current.ox);
        const newY = Math.max(0, canvasY - dragging.current.oy);
        if (dragging.current.kind === "text") {
          setTextLayers(prev => prev.map(l => l.id === dragging.current!.id ? { ...l, x: newX, y: newY } : l));
        } else {
          setStickerLayers(prev => prev.map(l => l.id === dragging.current!.id ? { ...l, x: newX, y: newY } : l));
        }
      }

      if (resizing.current) {
        if ("touches" in e) (e as TouchEvent).preventDefault();
        const dx = (cx - resizing.current.startCX) / rect.width * CW;
        const newW = Math.max(50, resizing.current.startW + dx);
        const newH = newW / resizing.current.ar;
        setStickerLayers(prev => prev.map(l => l.id === resizing.current!.id ? { ...l, w: newW, h: newH } : l));
      }
    }

    function onUp() { dragging.current = null; resizing.current = null; }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  function startDrag(e: React.MouseEvent | React.TouchEvent, id: string, kind: "text" | "sticker") {
    e.stopPropagation();
    if (editingTextId === id) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    const canvasX = (cx - rect.left) / rect.width * CW;
    const canvasY = (cy - rect.top) / rect.height * CH;
    const layer = kind === "text" ? textLayers.find(l => l.id === id) : stickerLayers.find(l => l.id === id);
    if (!layer) return;
    dragging.current = { id, kind, ox: canvasX - layer.x, oy: canvasY - layer.y, startCX: cx, startCY: cy };
    setSelectedId(id);
  }

  function startResize(e: React.MouseEvent | React.TouchEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    const sticker = stickerLayers.find(l => l.id === id);
    if (!sticker) return;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    resizing.current = { id, startCX: cx, startCY: cy, startW: sticker.w, startH: sticker.h, ar: sticker.w / sticker.h };
  }

  function handleCanvasPointerDown(e: React.MouseEvent) {
    if (mode !== "text") { setSelectedId(null); return; }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width * CW;
    const y = (e.clientY - rect.top) / rect.height * CH;
    const id = `t${Date.now()}`;
    const newText: TextLayer = {
      id, content: "Texto", x: Math.max(0, x - 200), y: Math.max(0, y - 40),
      fontSize: 80, color: "#FFFFFF", fontWeight: "bold",
      align: "left", width: 900, stroke: true,
    };
    setTextLayers(prev => [...prev, newText]);
    setSelectedId(id);
    setEditingTextId(id);
    setMode("select");
  }

  async function openPicker() {
    setPickerOpen(true);
    if (pickerImages.length === 0) {
      setPickerLoading(true);
      const imgs = await fetch("/api/images").then(r => r.json());
      setPickerImages(imgs);
      setPickerLoading(false);
    }
  }

  async function insertSticker(src: string) {
    setPickerOpen(false);
    try {
      const blob = await fetch(src).then(r => r.blob());
      const img = await loadImage(URL.createObjectURL(blob));
      const ar = img.naturalWidth / img.naturalHeight;
      const w = 400, h = w / ar;
      const id = `s${Date.now()}`;
      setStickerLayers(prev => [...prev, { id, src, x: (CW - w) / 2, y: (CH - h) / 2, w, h }]);
      setSelectedId(id);
    } catch { toast.error("Error al cargar sticker"); }
  }

  function deleteSelected() {
    if (!selectedId) return;
    setTextLayers(prev => prev.filter(l => l.id !== selectedId));
    setStickerLayers(prev => prev.filter(l => l.id !== selectedId));
    setSelectedId(null);
    setEditingTextId(null);
  }

  function updateText(partial: Partial<TextLayer>) {
    setTextLayers(prev => prev.map(l => l.id === selectedId ? { ...l, ...partial } : l));
  }

  async function generate() {
    const baseUrl = slide.generatedImagePath ?? slide.imagePath;
    if (!baseUrl) { toast.error("Sin imagen base"); return; }
    setGenerating(true);
    try {
      const baseBlob = await fetch(baseUrl).then(r => r.blob());
      const baseImg = await loadImage(URL.createObjectURL(baseBlob));

      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth || CW;
      canvas.height = baseImg.naturalHeight || CH;
      const ctx = canvas.getContext("2d")!;
      const sx = canvas.width / CW;
      const sy = canvas.height / CH;

      // Base image + pixel-level adjustments (reliable cross-browser)
      ctx.drawImage(baseImg, 0, 0);
      applyPixelAdjustments(ctx, canvas.width, canvas.height, adjust.brightness, adjust.contrast, adjust.saturation);

      // Stickers (no filter)
      for (const s of stickerLayers) {
        const sBlob = await fetch(s.src).then(r => r.blob());
        const sImg = await loadImage(URL.createObjectURL(sBlob));
        ctx.drawImage(sImg, s.x * sx, s.y * sy, s.w * sx, s.h * sy);
      }

      // Text layers
      for (const t of textLayers) {
        const fs = t.fontSize * sx;
        ctx.save();
        ctx.font = `${t.fontWeight} ${fs}px Arial, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.textAlign = t.align as CanvasTextAlign;
        const anchorX = t.align === "center" ? (t.x + t.width / 2) * sx
                      : t.align === "right" ? (t.x + t.width) * sx
                      : t.x * sx;
        const lines = canvasWrapText(ctx, t.content, t.width * sx);
        lines.forEach((line, i) => {
          const y = (t.y + (i + 1) * t.fontSize * 1.2) * sy;
          if (t.stroke) {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2.5 * sx;
            ctx.lineJoin = "round";
            ctx.strokeText(line, anchorX, y);
          }
          ctx.fillText(line, anchorX, y);
        });
        ctx.restore();
      }

      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), "image/jpeg", 0.95));
      const form = new FormData();
      form.append("file", new File([blob], "slide.jpg", { type: "image/jpeg" }));
      const res = await fetch(`/api/carousels/${carouselId}/slides/${slide.id}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      onGenerated();
    } catch {
      toast.error("Error al generar");
    } finally {
      setGenerating(false);
    }
  }

  const baseUrl = slide.generatedImagePath ?? slide.imagePath;
  const selectedText = textLayers.find(l => l.id === selectedId);

  const displayPicker = pickerImages.filter(img => {
    if (pickerScope !== "all" && img.scope !== pickerScope) return false;
    if (pickerSearch) {
      const q = pickerSearch.toLowerCase();
      return img.tag.toLowerCase().includes(q) || img.originalName.toLowerCase().includes(q);
    }
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ fontFamily: "inherit" }}>
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-background/95 backdrop-blur-sm">
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-muted-foreground">Slide {slide.order + 1}</span>
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setMode(m => m === "text" ? "select" : "text")}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${mode === "text" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}
        >
          <Type className="h-3.5 w-3.5" /> Texto
        </button>
        <button
          onClick={openPicker}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border hover:bg-muted/60 transition-colors"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Sticker
        </button>
        {selectedId && (
          <button
            onClick={deleteSelected}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 border border-destructive/30 transition-colors"
            title="Eliminar capa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
        >
          {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {generating ? "Generando…" : "Generar"}
        </button>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-neutral-950 p-4 overflow-hidden">
          <div
            ref={canvasRef}
            className="relative bg-black select-none"
            style={{ height: "100%", aspectRatio: "9/16", maxHeight: "100%", cursor: mode === "text" ? "crosshair" : "default" }}
            onMouseDown={handleCanvasPointerDown}
          >
            {/* Base image (CSS filter for live preview) */}
            {baseUrl && (
              <img
                src={baseUrl}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ filter: `brightness(${adjust.brightness}) contrast(${adjust.contrast}) saturate(${adjust.saturation})` }}
              />
            )}
            {!baseUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-white/20" />
              </div>
            )}

            {/* Sticker layers */}
            {stickerLayers.map(s => {
              const sel = selectedId === s.id;
              return (
                <div
                  key={s.id}
                  className={`absolute ${sel ? "outline outline-2 outline-blue-400 outline-offset-0" : ""}`}
                  style={{ left: `${(s.x / CW) * 100}%`, top: `${(s.y / CH) * 100}%`, width: `${(s.w / CW) * 100}%`, height: `${(s.h / CH) * 100}%`, cursor: "grab" }}
                  onMouseDown={(e) => startDrag(e, s.id, "sticker")}
                  onTouchStart={(e) => startDrag(e, s.id, "sticker")}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(s.id); }}
                >
                  <img src={s.src} alt="" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
                  {sel && (
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 bg-blue-400 cursor-se-resize rounded-tl-sm"
                      onMouseDown={(e) => startResize(e, s.id)}
                      onTouchStart={(e) => startResize(e, s.id)}
                    />
                  )}
                </div>
              );
            })}

            {/* Text layers */}
            {textLayers.map(t => {
              const sel = selectedId === t.id;
              const isEditing = editingTextId === t.id;
              return (
                <div
                  key={t.id}
                  className={`absolute ${sel ? "outline outline-2 outline-blue-400 outline-offset-0" : ""}`}
                  style={{
                    left: `${(t.x / CW) * 100}%`,
                    top: `${(t.y / CH) * 100}%`,
                    width: `${(t.width / CW) * 100}%`,
                    fontSize: t.fontSize * scale,
                    color: t.color,
                    fontWeight: t.fontWeight,
                    textAlign: t.align,
                    cursor: isEditing ? "text" : "grab",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.2,
                    textShadow: t.stroke ? "1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 1px 0 #000,0 -1px 0 #000,1px 0 0 #000,-1px 0 0 #000" : "none",
                  }}
                  onMouseDown={(e) => { if (!isEditing) { e.stopPropagation(); startDrag(e, t.id, "text"); } }}
                  onTouchStart={(e) => { if (!isEditing) startDrag(e, t.id, "text"); }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(t.id); setSelectedId(t.id); }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(t.id); }}
                >
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={t.content}
                      onChange={(e) => updateText({ content: e.target.value })}
                      onBlur={() => setEditingTextId(null)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingTextId(null); e.stopPropagation(); }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      rows={3}
                      className="w-full bg-transparent border-none outline-none resize-none"
                      style={{ fontSize: "inherit", color: "inherit", fontWeight: "inherit", textAlign: "inherit" as "left", lineHeight: "inherit", textShadow: "inherit", caretColor: t.color }}
                    />
                  ) : t.content || "(vacío)"}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right sidebar (md+) ── */}
        <div className="hidden md:flex flex-col w-60 shrink-0 border-l bg-background overflow-y-auto">
          {/* Image adjustments */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Imagen</h3>
              <button onClick={() => setAdjust({ brightness: 1, contrast: 1, saturation: 1 })} className="text-[10px] text-muted-foreground hover:text-foreground">Reset</button>
            </div>
            {([
              ["brightness", "Exposición", 0.5, 1.5],
              ["contrast", "Contraste", 0.5, 1.5],
              ["saturation", "Saturación", 0.0, 2.0],
            ] as [keyof ImageAdjust, string, number, number][]).map(([key, label, min, max]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <span className="text-[10px] font-mono tabular-nums w-8 text-right">{adjust[key].toFixed(2)}</span>
                </div>
                <input
                  type="range" min={min} max={max} step={0.01}
                  value={adjust[key]}
                  onChange={(e) => setAdjust(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 accent-primary cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Selected text props */}
          {selectedText && (
            <div className="p-4 border-b space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Texto</h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Tamaño</label>
                  <span className="text-[10px] font-mono w-8 text-right">{selectedText.fontSize}</span>
                </div>
                <input type="range" min={20} max={200} step={2} value={selectedText.fontSize}
                  onChange={(e) => updateText({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-primary cursor-pointer" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Color</label>
                <input type="color" value={selectedText.color}
                  onChange={(e) => updateText({ color: e.target.value })}
                  className="w-8 h-6 rounded border cursor-pointer p-0" />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => updateText({ fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}
                  className={`h-7 w-7 flex items-center justify-center rounded text-xs font-bold border transition-colors ${selectedText.fontWeight === "bold" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}
                >B</button>
                <button
                  onClick={() => updateText({ stroke: !selectedText.stroke })}
                  className={`h-7 px-2 flex items-center justify-center rounded text-[10px] font-medium border transition-colors ${selectedText.stroke ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}
                >Borde</button>
                <div className="ml-auto flex gap-0.5">
                  {([["left", <AlignLeft key="L" className="h-3 w-3" />], ["center", <AlignCenter key="C" className="h-3 w-3" />], ["right", <AlignRight key="R" className="h-3 w-3" />]] as [string, React.ReactNode][]).map(([a, icon]) => (
                    <button key={a} onClick={() => updateText({ align: a as TextLayer["align"] })}
                      className={`h-7 w-7 flex items-center justify-center rounded border transition-colors ${selectedText.align === a ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Ancho máx</label>
                  <span className="text-[10px] font-mono w-12 text-right">{selectedText.width}px</span>
                </div>
                <input type="range" min={200} max={1080} step={10} value={selectedText.width}
                  onChange={(e) => updateText({ width: parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-primary cursor-pointer" />
              </div>
            </div>
          )}

          {/* Layer list */}
          <div className="p-4 space-y-1.5 flex-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Capas</h3>
            {textLayers.length === 0 && stickerLayers.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin capas — añade texto o stickers</p>
            )}
            {textLayers.map(l => (
              <div key={l.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedId === l.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                onClick={() => setSelectedId(l.id)}>
                <Type className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs truncate flex-1">{l.content || "(vacío)"}</span>
                <button onClick={(e) => { e.stopPropagation(); setTextLayers(p => p.filter(x => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }}
                  className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {stickerLayers.map((l, i) => (
              <div key={l.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedId === l.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                onClick={() => setSelectedId(l.id)}>
                <img src={l.src} alt="" className="h-8 w-5 object-cover rounded shrink-0" />
                <span className="text-xs flex-1">Sticker {i + 1}</span>
                <button onClick={(e) => { e.stopPropagation(); setStickerLayers(p => p.filter(x => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }}
                  className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom controls ── */}
      <div className="md:hidden shrink-0 border-t bg-background">
        {/* Adjustment sliders */}
        <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto border-b">
          {([
            ["brightness", "Exp", 0.5, 1.5],
            ["contrast", "Cont", 0.5, 1.5],
            ["saturation", "Sat", 0.0, 2.0],
          ] as [keyof ImageAdjust, string, number, number][]).map(([key, label, min, max]) => (
            <div key={key} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground w-6">{label}</span>
              <input type="range" min={min} max={max} step={0.01} value={adjust[key]}
                onChange={(e) => setAdjust(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                className="w-20 h-1 accent-primary cursor-pointer" />
              <span className="text-[10px] font-mono w-6 tabular-nums">{adjust[key].toFixed(1)}</span>
            </div>
          ))}
        </div>
        {/* Selected text (compact) */}
        {selectedText && (
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
            <input type="color" value={selectedText.color} onChange={(e) => updateText({ color: e.target.value })} className="w-7 h-7 rounded border cursor-pointer p-0 shrink-0" />
            <input type="range" min={20} max={200} step={2} value={selectedText.fontSize}
              onChange={(e) => updateText({ fontSize: parseInt(e.target.value) })}
              className="w-24 h-1 accent-primary cursor-pointer shrink-0" />
            <span className="text-[10px] font-mono shrink-0">{selectedText.fontSize}px</span>
            <button onClick={() => updateText({ fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}
              className={`h-7 w-7 flex items-center justify-center rounded text-xs font-bold border shrink-0 transition-colors ${selectedText.fontWeight === "bold" ? "bg-primary text-primary-foreground border-primary" : ""}`}>B</button>
            <button onClick={() => updateText({ stroke: !selectedText.stroke })}
              className={`h-7 px-1.5 flex items-center justify-center rounded text-[10px] border shrink-0 transition-colors ${selectedText.stroke ? "bg-primary text-primary-foreground border-primary" : ""}`}>Borde</button>
          </div>
        )}
      </div>

      {/* ── Sticker picker modal ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setPickerOpen(false)}>
          <div className="bg-background rounded-t-2xl sm:rounded-2xl border shadow-xl w-full sm:max-w-2xl max-h-[88vh] sm:max-h-[82vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 border-b">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="font-semibold text-sm">Añadir sticker</h3>
                <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="px-4 pb-3 space-y-2">
                <input type="text" placeholder="Buscar…" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full h-8 rounded-lg border bg-muted/40 px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="flex gap-1.5">
                  {(["all", "global", "app", "influencer"] as const).map(s => (
                    <button key={s} onClick={() => setPickerScope(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${pickerScope === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"}`}>
                      {s === "all" ? "Todos" : s === "global" ? "Global" : s === "app" ? "App" : "Influencer"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {displayPicker.map(img => (
                    <button key={img.id} className="rounded-lg overflow-hidden border hover:border-primary hover:shadow-md transition-all" style={{ aspectRatio: "3/4" }} onClick={() => insertSticker(img.path)}>
                      <img src={img.path} alt={img.originalName} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {displayPicker.length === 0 && (
                    <div className="col-span-4 text-sm text-muted-foreground text-center py-8">Sin imágenes.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
