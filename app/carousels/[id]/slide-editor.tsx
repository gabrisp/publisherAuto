"use client";

import { useState, useRef, useEffect } from "react";
import { X, Type, ImageIcon, ImagePlus, Trash2, Loader2, AlignLeft, AlignCenter, AlignRight, Crop as CropIcon, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

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
type CropRect = { x: number; y: number; w: number; h: number };
type PickerImage = { id: string; path: string; tag: string; originalName: string; scope: string };

interface SlideEditorProps {
  open: boolean;
  slide: { id: string; order: number; generatedImagePath: string | null; imagePath: string | null };
  carouselId: string;
  onClose: () => void;
  onGenerated: (freshUrl: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function applyPixelAdjustments(ctx: CanvasRenderingContext2D, w: number, h: number, b: number, c: number, s: number) {
  if (b === 1 && c === 1 && s === 1) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, g = d[i + 1] / 255, bl = d[i + 2] / 255;
    r *= b; g *= b; bl *= b;
    r = (r - 0.5) * c + 0.5; g = (g - 0.5) * c + 0.5; bl = (bl - 0.5) * c + 0.5;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    r = lum + s * (r - lum); g = lum + s * (g - lum); bl = lum + s * (bl - lum);
    d[i]     = Math.max(0, Math.min(255, r * 255));
    d[i + 1] = Math.max(0, Math.min(255, g * 255));
    d[i + 2] = Math.max(0, Math.min(255, bl * 255));
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
  const [containerWidth, setContainerWidth] = useState(0);

  // Image natural dimensions — the canonical coordinate space for everything
  const [IW, setIW] = useState(1080);
  const [IH, setIH] = useState(1920);
  const IWRef = useRef(1080);
  const IHRef = useRef(1920);
  function setImageDims(w: number, h: number) {
    IWRef.current = w; IHRef.current = h;
    setIW(w); setIH(h);
  }

  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "text">("select");

  const [adjust, setAdjust] = useState<ImageAdjust>({ brightness: 1, contrast: 1, saturation: 1 });
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, w: 1080, h: 1920 });
  const cropRectRef = useRef<CropRect>({ x: 0, y: 0, w: 1080, h: 1920 });
  function updateCropRect(r: CropRect) { cropRectRef.current = r; setCropRect(r); }
  const [cropMode, setCropMode] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerScope, setPickerScope] = useState<"all" | "global" | "app" | "influencer">("all");
  const [generating, setGenerating] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const [snapGuides, setSnapGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  const localImgRef = useRef<HTMLInputElement>(null);
  const dragging = useRef<{ id: string; kind: "text" | "sticker"; ox: number; oy: number; lW: number; lH: number } | null>(null);
  const resizing = useRef<{ id: string; startCX: number; startCY: number; startW: number; startH: number; ar: number } | null>(null);
  const cropDragging = useRef<{ type: "move" | "nw" | "ne" | "sw" | "se"; startCX: number; startCY: number; startCrop: CropRect } | null>(null);

  // Track container width for font scale
  useEffect(() => {
    if (!canvasRef.current) return;
    const update = () => { if (canvasRef.current) setContainerWidth(canvasRef.current.offsetWidth); };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [open]);

  // Reset on open — also load image to get natural dimensions
  useEffect(() => {
    if (!open) return;
    setTextLayers([]);
    setStickerLayers([]);
    setSelectedId(null);
    setEditingTextId(null);
    setMode("select");
    setAdjust({ brightness: 1, contrast: 1, saturation: 1 });
    setCropMode(false);
    setImgLoading(true);

    const url = slide.generatedImagePath ?? slide.imagePath;
    if (url) {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 1080;
        const h = img.naturalHeight || 1920;
        setImageDims(w, h);
        updateCropRect({ x: 0, y: 0, w, h });
        setImgLoading(false);
      };
      img.onerror = () => {
        setImageDims(1080, 1920);
        updateCropRect({ x: 0, y: 0, w: 1080, h: 1920 });
        setImgLoading(false);
      };
      img.src = url;
    } else {
      setImageDims(1080, 1920);
      updateCropRect({ x: 0, y: 0, w: 1080, h: 1920 });
      setImgLoading(false);
    }
  }, [open, slide.id]);

  // Global pointer events
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
      const IW = IWRef.current;
      const IH = IHRef.current;

      if (dragging.current) {
        // Canvas shows crop region — convert mouse to image space
        const cr = cropRectRef.current;
        const mouseImgX = (cx - rect.left) / rect.width * cr.w + cr.x;
        const mouseImgY = (cy - rect.top) / rect.height * cr.h + cr.y;
        const rawX = mouseImgX - dragging.current.ox;
        const rawY = mouseImgY - dragging.current.oy;

        // Snap to crop-region thirds / center / edges (all in image space)
        const T = cr.w * 0.025;
        const lW = dragging.current.lW;
        const lH = dragging.current.lH;
        let newX = rawX, newY = rawY;
        const vG: number[] = [], hG: number[] = [];

        for (const sp of [cr.x, cr.x + cr.w / 3, cr.x + cr.w / 2, cr.x + 2 * cr.w / 3, cr.x + cr.w]) {
          const pct = ((sp - cr.x) / cr.w) * 100;
          if (Math.abs(rawX + lW / 2 - sp) < T)      { newX = sp - lW / 2; vG.push(pct); break; }
          else if (Math.abs(rawX - sp) < T)           { newX = sp;          vG.push(pct); break; }
          else if (Math.abs(rawX + lW - sp) < T)      { newX = sp - lW;     vG.push(pct); break; }
        }
        for (const sp of [cr.y, cr.y + cr.h / 3, cr.y + cr.h / 2, cr.y + 2 * cr.h / 3, cr.y + cr.h]) {
          const pct = ((sp - cr.y) / cr.h) * 100;
          if (Math.abs(rawY + lH / 2 - sp) < T)      { newY = sp - lH / 2; hG.push(pct); break; }
          else if (Math.abs(rawY - sp) < T)           { newY = sp;          hG.push(pct); break; }
          else if (Math.abs(rawY + lH - sp) < T)      { newY = sp - lH;     hG.push(pct); break; }
        }
        setSnapGuides({ v: vG, h: hG });

        if (dragging.current.kind === "text") {
          setTextLayers(prev => prev.map(l => l.id === dragging.current!.id ? { ...l, x: newX, y: newY } : l));
        } else {
          setStickerLayers(prev => prev.map(l => l.id === dragging.current!.id ? { ...l, x: newX, y: newY } : l));
        }
      }

      if (resizing.current) {
        if ("touches" in e) (e as TouchEvent).preventDefault();
        const cr = cropRectRef.current;
        const dx = (cx - resizing.current.startCX) / rect.width * cr.w;
        const newW = Math.max(50, resizing.current.startW + dx);
        const newH = newW / resizing.current.ar;
        setStickerLayers(prev => prev.map(l => l.id === resizing.current!.id ? { ...l, w: newW, h: newH } : l));
      }

      if (cropDragging.current) {
        // Crop mode: canvas shows full image (IW×IH)
        if ("touches" in e) (e as TouchEvent).preventDefault();
        const dx = (cx - cropDragging.current.startCX) / rect.width * IW;
        const dy = (cy - cropDragging.current.startCY) / rect.height * IH;
        const sc = cropDragging.current.startCrop;
        const MIN = Math.min(IW, IH) * 0.05;
        let { x, y, w, h } = sc;

        switch (cropDragging.current.type) {
          case "move":
            x = Math.max(0, Math.min(IW - w, sc.x + dx));
            y = Math.max(0, Math.min(IH - h, sc.y + dy));
            break;
          case "nw": {
            const nx = Math.max(0, Math.min(sc.x + sc.w - MIN, sc.x + dx));
            const ny = Math.max(0, Math.min(sc.y + sc.h - MIN, sc.y + dy));
            w = sc.x + sc.w - nx; h = sc.y + sc.h - ny; x = nx; y = ny; break;
          }
          case "ne": {
            const ny = Math.max(0, Math.min(sc.y + sc.h - MIN, sc.y + dy));
            w = Math.max(MIN, Math.min(IW - sc.x, sc.w + dx));
            h = sc.y + sc.h - ny; y = ny; break;
          }
          case "sw": {
            const nx = Math.max(0, Math.min(sc.x + sc.w - MIN, sc.x + dx));
            w = sc.x + sc.w - nx; x = nx;
            h = Math.max(MIN, Math.min(IH - sc.y, sc.h + dy)); break;
          }
          case "se":
            w = Math.max(MIN, Math.min(IW - sc.x, sc.w + dx));
            h = Math.max(MIN, Math.min(IH - sc.y, sc.h + dy)); break;
        }
        updateCropRect({ x, y, w, h });
      }
    }

    function onUp() {
      dragging.current = null;
      resizing.current = null;
      cropDragging.current = null;
      setSnapGuides({ v: [], h: [] });
    }

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
    // Canvas shows crop region — convert mouse to image space
    const canvasX = (cx - rect.left) / rect.width * cropRect.w + cropRect.x;
    const canvasY = (cy - rect.top) / rect.height * cropRect.h + cropRect.y;
    const layer = kind === "text" ? textLayers.find(l => l.id === id) : stickerLayers.find(l => l.id === id);
    if (!layer) return;
    const lW = kind === "sticker" ? (layer as StickerLayer).w : (layer as TextLayer).width;
    const lH = kind === "sticker" ? (layer as StickerLayer).h : (layer as TextLayer).fontSize * 2;
    dragging.current = { id, kind, ox: canvasX - layer.x, oy: canvasY - layer.y, lW, lH };
    setSelectedId(id);
  }

  function startResize(e: React.MouseEvent | React.TouchEvent, id: string) {
    e.stopPropagation(); e.preventDefault();
    const sticker = stickerLayers.find(l => l.id === id);
    if (!sticker) return;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    resizing.current = { id, startCX: cx, startCY: cy, startW: sticker.w, startH: sticker.h, ar: sticker.w / sticker.h };
  }

  function startCropDrag(e: React.MouseEvent | React.TouchEvent, type: "move" | "nw" | "ne" | "sw" | "se") {
    e.stopPropagation(); e.preventDefault();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    cropDragging.current = { type, startCX: cx, startCY: cy, startCrop: { ...cropRect } };
  }

  function scaleSticker(factor: number) {
    setStickerLayers(prev => prev.map(l => l.id === selectedId
      ? { ...l, w: Math.max(20, l.w * factor), h: Math.max(20, l.h * factor) } : l));
  }

  function handleCanvasPointerDown(e: React.MouseEvent) {
    if (cropMode) return;
    if (mode !== "text") { setSelectedId(null); return; }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Canvas shows crop region — convert click to image space
    const x = (e.clientX - rect.left) / rect.width * cropRect.w + cropRect.x;
    const y = (e.clientY - rect.top) / rect.height * cropRect.h + cropRect.y;
    const id = `t${Date.now()}`;
    const defFontSize = Math.round(IW * 0.074); // ~80px at 1080w
    const defWidth = Math.round(IW * 0.833);    // ~900px at 1080w
    setTextLayers(prev => [...prev, {
      id, content: "Texto",
      x: Math.max(0, x - defWidth / 2), y: Math.max(0, y - defFontSize),
      fontSize: defFontSize, color: "#FFFFFF", fontWeight: "bold",
      align: "left", width: defWidth, stroke: true,
    }]);
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

  function handleLocalImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight;
      const w = IW * 0.37; // ~400px at 1080w
      const id = `s${Date.now()}`;
      setStickerLayers(prev => [...prev, { id, src, x: (IW - w) / 2, y: (IH - w / ar) / 2, w, h: w / ar }]);
      setSelectedId(id);
    };
    img.src = src;
    e.target.value = "";
  }

  async function insertSticker(src: string) {
    setPickerOpen(false);
    try {
      const blob = await fetch(src).then(r => r.blob());
      const img = await loadImage(URL.createObjectURL(blob));
      const ar = img.naturalWidth / img.naturalHeight;
      const w = IW * 0.37;
      const id = `s${Date.now()}`;
      setStickerLayers(prev => [...prev, { id, src, x: (IW - w) / 2, y: (IH - w / ar) / 2, w, h: w / ar }]);
      setSelectedId(id);
    } catch { toast.error("Error al cargar sticker"); }
  }

  function deleteSelected() {
    if (!selectedId) return;
    setTextLayers(prev => prev.filter(l => l.id !== selectedId));
    setStickerLayers(prev => prev.filter(l => l.id !== selectedId));
    setSelectedId(null); setEditingTextId(null);
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

      const nw = baseImg.naturalWidth || IW;
      const nh = baseImg.naturalHeight || IH;

      // Crop in natural pixel space — no stretching
      const srcX = Math.round((cropRect.x / IW) * nw);
      const srcY = Math.round((cropRect.y / IH) * nh);
      const srcW = Math.round((cropRect.w / IW) * nw);
      const srcH = Math.round((cropRect.h / IH) * nh);

      const canvas = document.createElement("canvas");
      canvas.width = srcW; canvas.height = srcH;
      const ctx = canvas.getContext("2d")!;

      // Draw base image 1:1 (crop only, no scale)
      ctx.drawImage(baseImg, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      applyPixelAdjustments(ctx, srcW, srcH, adjust.brightness, adjust.contrast, adjust.saturation);

      // Scale from image coordinate space to natural pixels
      const sx = nw / IW;
      const sy = nh / IH;

      // Stickers — offset by crop origin
      for (const s of stickerLayers) {
        const sBlob = await fetch(s.src).then(r => r.blob());
        const sImg = await loadImage(URL.createObjectURL(sBlob));
        ctx.drawImage(sImg, (s.x - cropRect.x) * sx, (s.y - cropRect.y) * sy, s.w * sx, s.h * sy);
      }

      // Text layers — offset by crop origin
      for (const t of textLayers) {
        const fs = t.fontSize * sx;
        ctx.save();
        ctx.font = `${t.fontWeight} ${fs}px Arial, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.textAlign = t.align as CanvasTextAlign;
        const tx = (t.x - cropRect.x) * sx;
        const anchorX = t.align === "center" ? tx + (t.width * sx) / 2
                      : t.align === "right"  ? tx + t.width * sx : tx;
        const lines = canvasWrapText(ctx, t.content, t.width * sx);
        lines.forEach((line, i) => {
          const y = (t.y - cropRect.y + (i + 1) * t.fontSize * 1.2) * sy;
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
      const freshUrl = URL.createObjectURL(blob);
      const form = new FormData();
      form.append("file", new File([blob], "slide.jpg", { type: "image/jpeg" }));
      const res = await fetch(`/api/carousels/${carouselId}/slides/${slide.id}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      onGenerated(freshUrl);
    } catch {
      toast.error("Error al generar");
    } finally {
      setGenerating(false);
    }
  }

  const baseUrl = slide.generatedImagePath ?? slide.imagePath;
  const selectedText = textLayers.find(l => l.id === selectedId);
  const selectedSticker = stickerLayers.find(l => l.id === selectedId);

  const displayPicker = pickerImages.filter(img => {
    if (pickerScope !== "all" && img.scope !== pickerScope) return false;
    if (pickerSearch) {
      const q = pickerSearch.toLowerCase();
      return img.tag.toLowerCase().includes(q) || img.originalName.toLowerCase().includes(q);
    }
    return true;
  });

  // Crop overlay geometry (used in crop mode — full image canvas)
  const cropL = (cropRect.x / IW) * 100;
  const cropT = (cropRect.y / IH) * 100;
  const cropR = ((IW - cropRect.x - cropRect.w) / IW) * 100;
  const cropB = ((IH - cropRect.y - cropRect.h) / IH) * 100;

  const isCropped = cropRect.x !== 0 || cropRect.y !== 0 || cropRect.w !== IW || cropRect.h !== IH;

  // Viewport: in crop mode show full image, otherwise show crop region
  const viewW = cropMode ? IW : cropRect.w;
  const viewH = cropMode ? IH : cropRect.h;
  const viewX = cropMode ? 0 : cropRect.x;
  const viewY = cropMode ? 0 : cropRect.y;

  // Scale: canvas pixels per image-space unit
  const scale = containerWidth > 0 ? containerWidth / viewW : 0.3;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ fontFamily: "inherit" }}>
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-background/95 backdrop-blur-sm flex-wrap">
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-muted-foreground">Slide {slide.order + 1}</span>
        {!imgLoading && <span className="text-[10px] text-muted-foreground font-mono">{IW}×{IH}</span>}
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => { setMode(m => m === "text" ? "select" : "text"); setCropMode(false); }}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${mode === "text" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}
        >
          <Type className="h-3.5 w-3.5" /> Texto
        </button>
        <button
          onClick={() => { openPicker(); setCropMode(false); setMode("select"); }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border hover:bg-muted/60 transition-colors"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Sticker
        </button>
        <button
          onClick={() => { setCropMode(false); setMode("select"); localImgRef.current?.click(); }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border hover:bg-muted/60 transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Imagen
        </button>
        <input ref={localImgRef} type="file" accept="image/*" className="hidden" onChange={handleLocalImage} />
        <button
          onClick={() => { setCropMode(m => !m); setMode("select"); setSelectedId(null); }}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${cropMode ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}
        >
          <CropIcon className="h-3.5 w-3.5" /> Recortar
        </button>
        {cropMode && (
          <button
            onClick={() => { updateCropRect({ x: 0, y: 0, w: IW, h: IH }); setCropMode(false); }}
            className="h-8 px-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/60 border transition-colors"
          >Reset</button>
        )}
        {selectedId && !cropMode && (
          <button onClick={deleteSelected}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 border border-destructive/30 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={generate} disabled={generating}
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
            className="relative bg-black select-none overflow-hidden"
            style={{
              height: "100%",
              maxHeight: "100%",
              aspectRatio: `${viewW} / ${viewH}`,
              cursor: cropMode ? "default" : mode === "text" ? "crosshair" : "default",
            }}
            onMouseDown={handleCanvasPointerDown}
          >
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
              </div>
            )}

            {/* Base image — isolated so CSS filter never bleeds into sibling sticker elements.
                In crop mode: canvas = full image, show as-is.
                Otherwise: canvas = crop region, scale/offset the full image so only crop is visible. */}
            {baseUrl && !imgLoading && (
              <div
                className="absolute pointer-events-none overflow-hidden"
                style={{
                  isolation: "isolate",
                  ...(cropMode ? { inset: 0, width: "100%", height: "100%" } : {
                    width: `${(IW / cropRect.w) * 100}%`,
                    height: `${(IH / cropRect.h) * 100}%`,
                    left: `${-(cropRect.x / cropRect.w) * 100}%`,
                    top: `${-(cropRect.y / cropRect.h) * 100}%`,
                  }),
                  filter: `brightness(${adjust.brightness}) contrast(${adjust.contrast}) saturate(${adjust.saturation})`,
                }}
              >
                <img src={baseUrl} alt="" draggable={false} className="w-full h-full" style={{ objectFit: "cover" }} />
              </div>
            )}

            {!baseUrl && !imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-white/20" />
              </div>
            )}

            {/* Sticker layers */}
            {stickerLayers.map(s => {
              const sel = selectedId === s.id && !cropMode;
              return (
                <div key={s.id}
                  className={`absolute ${sel ? "outline outline-2 outline-blue-400 outline-offset-0" : ""}`}
                  style={{ left: `${((s.x - viewX) / viewW) * 100}%`, top: `${((s.y - viewY) / viewH) * 100}%`, width: `${(s.w / viewW) * 100}%`, height: `${(s.h / viewH) * 100}%`, cursor: "grab", willChange: "transform", transform: "translateZ(0)" }}
                  onMouseDown={(e) => { if (!cropMode) startDrag(e, s.id, "sticker"); }}
                  onTouchStart={(e) => { if (!cropMode) startDrag(e, s.id, "sticker"); }}
                  onClick={(e) => { e.stopPropagation(); if (!cropMode) setSelectedId(s.id); }}
                >
                  <img src={s.src} alt="" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
                  {sel && (
                    <div
                      className="absolute bottom-0 right-0 w-7 h-7 bg-blue-400 hover:bg-blue-500 cursor-se-resize rounded-tl flex items-center justify-center"
                      onMouseDown={(e) => startResize(e, s.id)}
                      onTouchStart={(e) => startResize(e, s.id)}
                    >
                      <svg viewBox="0 0 8 8" className="w-3 h-3"><path d="M1 7L7 1M4 7L7 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Text layers */}
            {textLayers.map(t => {
              const sel = selectedId === t.id && !cropMode;
              const isEditing = editingTextId === t.id;
              return (
                <div key={t.id}
                  className={`absolute ${sel ? "outline outline-2 outline-blue-400 outline-offset-0" : ""}`}
                  style={{
                    left: `${((t.x - viewX) / viewW) * 100}%`,
                    top: `${((t.y - viewY) / viewH) * 100}%`,
                    width: `${(t.width / viewW) * 100}%`,
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
                  onMouseDown={(e) => { if (!cropMode && !isEditing) { e.stopPropagation(); startDrag(e, t.id, "text"); } }}
                  onTouchStart={(e) => { if (!cropMode && !isEditing) startDrag(e, t.id, "text"); }}
                  onDoubleClick={(e) => { if (!cropMode) { e.stopPropagation(); setEditingTextId(t.id); setSelectedId(t.id); } }}
                  onClick={(e) => { e.stopPropagation(); if (!cropMode) setSelectedId(t.id); }}
                >
                  {isEditing ? (
                    <textarea autoFocus value={t.content}
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

            {/* Snap guide lines — shown while dragging */}
            {snapGuides.v.map(pct => (
              <div key={pct} className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{ left: `${pct}%`, width: 1, background: "rgba(236,72,153,0.85)" }} />
            ))}
            {snapGuides.h.map(pct => (
              <div key={pct} className="absolute left-0 right-0 pointer-events-none z-20"
                style={{ top: `${pct}%`, height: 1, background: "rgba(236,72,153,0.85)" }} />
            ))}

            {/* Crop overlay */}
            {cropMode && (
              <>
                <div className="absolute pointer-events-none bg-black/55" style={{ top: 0, left: 0, right: 0, height: `${cropT}%` }} />
                <div className="absolute pointer-events-none bg-black/55" style={{ bottom: 0, left: 0, right: 0, height: `${cropB}%` }} />
                <div className="absolute pointer-events-none bg-black/55" style={{ left: 0, top: `${cropT}%`, bottom: `${cropB}%`, width: `${cropL}%` }} />
                <div className="absolute pointer-events-none bg-black/55" style={{ right: 0, top: `${cropT}%`, bottom: `${cropB}%`, width: `${cropR}%` }} />
                <div
                  className="absolute border-2 border-white cursor-move"
                  style={{ left: `${cropL}%`, top: `${cropT}%`, right: `${cropR}%`, bottom: `${cropB}%` }}
                  onMouseDown={(e) => startCropDrag(e, "move")}
                  onTouchStart={(e) => startCropDrag(e, "move")}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", borderRight: "1px solid rgba(255,255,255,0.3)", left: "33.3%", right: "33.3%" }} />
                  <div className="absolute inset-0 pointer-events-none" style={{ borderTop: "1px solid rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.3)", top: "33.3%", bottom: "33.3%" }} />
                  {(["nw", "ne", "sw", "se"] as const).map(corner => (
                    <div key={corner}
                      className="absolute w-6 h-6 bg-white border-2 border-blue-400 rounded-sm"
                      style={{
                        top: corner.startsWith("n") ? -12 : undefined,
                        bottom: corner.startsWith("s") ? -12 : undefined,
                        left: corner.endsWith("w") ? -12 : undefined,
                        right: corner.endsWith("e") ? -12 : undefined,
                        cursor: `${corner}-resize`,
                      }}
                      onMouseDown={(e) => startCropDrag(e, corner)}
                      onTouchStart={(e) => startCropDrag(e, corner)}
                    />
                  ))}
                </div>
              </>
            )}
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
            {([["brightness", "Exposición", 0.5, 1.5], ["contrast", "Contraste", 0.5, 1.5], ["saturation", "Saturación", 0.0, 2.0]] as [keyof ImageAdjust, string, number, number][]).map(([key, label, min, max]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <span className="text-[10px] font-mono tabular-nums w-8 text-right">{adjust[key].toFixed(2)}</span>
                </div>
                <input type="range" min={min} max={max} step={0.01} value={adjust[key]}
                  onChange={(e) => setAdjust(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 accent-primary cursor-pointer" />
              </div>
            ))}
          </div>

          {/* Selected sticker */}
          {selectedSticker && !cropMode && (
            <div className="p-4 border-b space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sticker</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => scaleSticker(0.8)} className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted/60 transition-colors"><Minus className="h-3.5 w-3.5" /></button>
                <span className="text-xs text-muted-foreground flex-1 text-center">{Math.round((selectedSticker.w / IW) * 100)}%</span>
                <button onClick={() => scaleSticker(1.25)} className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted/60 transition-colors"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <p className="text-[10px] text-muted-foreground">También arrastra la esquina azul</p>
            </div>
          )}

          {/* Selected text */}
          {selectedText && !cropMode && (
            <div className="p-4 border-b space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Texto</h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Tamaño</label>
                  <span className="text-[10px] font-mono w-8 text-right">{selectedText.fontSize}</span>
                </div>
                <input type="range" min={10} max={Math.round(IW * 0.37)} step={1} value={selectedText.fontSize}
                  onChange={(e) => updateText({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-primary cursor-pointer" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Color</label>
                <input type="color" value={selectedText.color} onChange={(e) => updateText({ color: e.target.value })} className="w-8 h-6 rounded border cursor-pointer p-0" />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => updateText({ fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}
                  className={`h-7 w-7 flex items-center justify-center rounded text-xs font-bold border transition-colors ${selectedText.fontWeight === "bold" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}>B</button>
                <button onClick={() => updateText({ stroke: !selectedText.stroke })}
                  className={`h-7 px-2 flex items-center justify-center rounded text-[10px] font-medium border transition-colors ${selectedText.stroke ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}>Borde</button>
                <div className="ml-auto flex gap-0.5">
                  {([["left", <AlignLeft key="L" className="h-3 w-3" />], ["center", <AlignCenter key="C" className="h-3 w-3" />], ["right", <AlignRight key="R" className="h-3 w-3" />]] as [string, React.ReactNode][]).map(([a, icon]) => (
                    <button key={a} onClick={() => updateText({ align: a as TextLayer["align"] })}
                      className={`h-7 w-7 flex items-center justify-center rounded border transition-colors ${selectedText.align === a ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/60"}`}>{icon}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Ancho máx</label>
                  <span className="text-[10px] font-mono w-12 text-right">{selectedText.width}px</span>
                </div>
                <input type="range" min={Math.round(IW * 0.1)} max={IW} step={10} value={selectedText.width}
                  onChange={(e) => updateText({ width: parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-primary cursor-pointer" />
              </div>
            </div>
          )}

          {/* Layer list */}
          <div className="p-4 space-y-1.5 flex-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Capas</h3>
            {textLayers.length === 0 && stickerLayers.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin capas</p>
            )}
            {textLayers.map(l => (
              <div key={l.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedId === l.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                onClick={() => { setSelectedId(l.id); setCropMode(false); }}>
                <Type className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs truncate flex-1">{l.content || "(vacío)"}</span>
                <button onClick={(e) => { e.stopPropagation(); setTextLayers(p => p.filter(x => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {stickerLayers.map((l, i) => (
              <div key={l.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedId === l.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                onClick={() => { setSelectedId(l.id); setCropMode(false); }}>
                <img src={l.src} alt="" className="h-8 w-5 object-cover rounded shrink-0" />
                <span className="text-xs flex-1">Sticker {i + 1}</span>
                <button onClick={(e) => { e.stopPropagation(); setStickerLayers(p => p.filter(x => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom controls ── */}
      <div className="md:hidden shrink-0 border-t bg-background">
        <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto border-b">
          {([["brightness", "Exp", 0.5, 1.5], ["contrast", "Cont", 0.5, 1.5], ["saturation", "Sat", 0.0, 2.0]] as [keyof ImageAdjust, string, number, number][]).map(([key, label, min, max]) => (
            <div key={key} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground w-6">{label}</span>
              <input type="range" min={min} max={max} step={0.01} value={adjust[key]}
                onChange={(e) => setAdjust(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                className="w-20 h-1 accent-primary cursor-pointer" />
              <span className="text-[10px] font-mono w-6 tabular-nums">{adjust[key].toFixed(1)}</span>
            </div>
          ))}
        </div>
        {selectedSticker && !cropMode && (
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-xs text-muted-foreground">Sticker:</span>
            <button onClick={() => scaleSticker(0.8)} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-muted/60"><Minus className="h-3.5 w-3.5" /></button>
            <span className="text-xs font-mono">{Math.round((selectedSticker.w / IW) * 100)}%</span>
            <button onClick={() => scaleSticker(1.25)} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-muted/60"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {selectedText && !cropMode && (
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
            <input type="color" value={selectedText.color} onChange={(e) => updateText({ color: e.target.value })} className="w-7 h-7 rounded border cursor-pointer p-0 shrink-0" />
            <input type="range" min={10} max={Math.round(IW * 0.37)} step={1} value={selectedText.fontSize}
              onChange={(e) => updateText({ fontSize: parseInt(e.target.value) })}
              className="w-24 h-1 accent-primary cursor-pointer shrink-0" />
            <span className="text-[10px] font-mono shrink-0">{selectedText.fontSize}px</span>
            <button onClick={() => updateText({ fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}
              className={`h-7 w-7 flex items-center justify-center rounded text-xs font-bold border shrink-0 ${selectedText.fontWeight === "bold" ? "bg-primary text-primary-foreground border-primary" : ""}`}>B</button>
            <button onClick={() => updateText({ stroke: !selectedText.stroke })}
              className={`h-7 px-1.5 flex items-center justify-center rounded text-[10px] border shrink-0 ${selectedText.stroke ? "bg-primary text-primary-foreground border-primary" : ""}`}>Borde</button>
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
                  {displayPicker.length === 0 && <div className="col-span-4 text-sm text-muted-foreground text-center py-8">Sin imágenes.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
