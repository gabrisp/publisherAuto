"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Film, ChevronUp, ChevronDown, CheckCircle, ExternalLink, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Slide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
  texts?: string;
};

type Carousel = {
  id: string;
  name: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  sentAt: number | null;
  sentToAccountId: string | null;
  sentToAccountName: string | null;
  slides: Slide[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TextEl = { id: string; content: string };

function parseTexts(json?: string | null): TextEl[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fmtDayHeader(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase(),
    day: d,
    month: date.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
  };
}

function CoverCard({
  c,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onClick,
  dragging,
}: {
  c: Carousel;
  onDragStart: () => void;
  onDragEnd: () => void;
  onTouchStart: () => void;
  onClick: () => void;
  dragging: boolean;
}) {
  const slides = [...(c.slides ?? [])].sort((a, b) => a.order - b.order);
  const cover = slides[0];
  const src = cover?.generatedImagePath ?? cover?.imagePath;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative shrink-0 w-[88px] rounded-xl overflow-hidden bg-muted border cursor-grab active:cursor-grabbing transition-opacity select-none ${dragging ? "opacity-30" : "hover:ring-2 hover:ring-primary/50"}`}
      style={{ aspectRatio: "9/16" }}
    >
      {/* Touch drag handle — tap-hold to drag on mobile/iPad */}
      <div
        className="absolute top-1 left-1 z-10 touch-none md:hidden"
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); onTouchStart(); }}
      >
        <div className="bg-black/50 rounded-md p-0.5">
          <GripVertical className="h-3 w-3 text-white/70" />
        </div>
      </div>
      {/* Hover title popover */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] z-50 hidden group-hover:flex">
        <div className="bg-popover text-popover-foreground text-[11px] font-medium rounded-lg px-2.5 py-1.5 shadow-lg border whitespace-nowrap max-w-[200px] truncate">
          {c.name}
        </div>
      </div>
      {src ? (
        <img src={src} alt={c.name} draggable={false} className="w-full h-full object-cover pointer-events-none" />
      ) : (
        <div className="w-full h-full flex items-center justify-center pointer-events-none">
          <Film className="h-5 w-5 text-muted-foreground/30" />
        </div>
      )}
      {/* Absorb any stray pointer events so the parent drag works cleanly */}
      <div className="absolute inset-0 pointer-events-none" />
      {c.publishedAt && (
        <>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-white drop-shadow-lg" />
          </div>
        </>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        {c.scheduledTime && (
          <p className="text-[9px] text-white/80 font-medium leading-tight">{c.scheduledTime}</p>
        )}
        {c.sentToAccountName && (
          <p className="text-[9px] text-white font-semibold leading-tight truncate">@{c.sentToAccountName}</p>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const { data: all = [], mutate } = useSWR<Carousel[]>("/api/carousels", fetcher, {
    revalidateOnFocus: false,
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  const [preview, setPreview] = useState<Carousel | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const dragCounter = useRef<Record<string, number>>({});

  // Refs for touch drag — avoid stale closures in global listeners
  const draggingIdRef = useRef<string | null>(null);
  const allRef = useRef<Carousel[]>([]);
  useEffect(() => { allRef.current = all; }, [all]);
  useEffect(() => { draggingIdRef.current = draggingId; }, [draggingId]);

  // Always show today + 7 days, plus any other dates that have carousels
  const days = useMemo(() => {
    const map = new Map<string, Carousel[]>();

    // Seed the 7-day window (today + 6 more)
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
    }

    // Add all carousels with a scheduled date
    for (const c of all) {
      if (!c.scheduledDate) continue;
      if (!map.has(c.scheduledDate)) map.set(c.scheduledDate, []);
      map.get(c.scheduledDate)!.push(c);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, carousels]) => ({
        date,
        carousels: [...carousels].sort((a, b) =>
          (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "")
        ),
      }));
  }, [all, today]);

  // Bottom tray: has account but no date
  const tray = useMemo(
    () => all.filter((c) => c.sentToAccountId && !c.scheduledDate),
    [all]
  );

  const assignDate = useCallback(
    async (carouselId: string, date: string | null) => {
      mutate(
        (prev) => prev?.map((c) => c.id === carouselId ? { ...c, scheduledDate: date } : c),
        false
      );
      const res = await fetch(`/api/carousels/${carouselId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: date }),
      });
      if (!res.ok) { toast.error("Error al mover"); mutate(); }
    },
    [mutate]
  );

  // Touch drag support for iPad/mobile (HTML5 DnD doesn't fire on touch)
  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!draggingIdRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const dayEl = el?.closest("[data-date]") as HTMLElement | null;
      const trayEl = el?.closest("[data-tray]");
      setDropTarget(dayEl?.dataset.date ?? (trayEl ? "__tray" : null));
    }

    function onTouchEnd(e: TouchEvent) {
      const id = draggingIdRef.current;
      if (!id) return;
      draggingIdRef.current = null;
      setDraggingId(null);
      setDropTarget(null);
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const dayEl = el?.closest("[data-date]") as HTMLElement | null;
      const trayEl = el?.closest("[data-tray]");
      const c = allRef.current.find((x) => x.id === id);
      if (!c) return;
      if (dayEl?.dataset.date && c.scheduledDate !== dayEl.dataset.date) {
        assignDate(id, dayEl.dataset.date);
        toast.success(`Movido a ${dayEl.dataset.date}`);
      } else if (trayEl && c.scheduledDate) {
        assignDate(id, null);
        toast.success("Fecha eliminada");
      }
    }

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [assignDate]);

  function handleDropOnDay(date: string) {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setDropTarget(null);
    const c = all.find((x) => x.id === id);
    if (!c || c.scheduledDate === date) return;
    assignDate(id, date);
    toast.success(`Movido a ${date}`);
  }

  function handleDropOnTray() {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setDropTarget(null);
    const c = all.find((x) => x.id === id);
    if (!c || !c.scheduledDate) return;
    assignDate(id, null);
    toast.success("Fecha eliminada");
  }

  function onDayDragOver(e: React.DragEvent, date: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(date);
  }

  function onDayDragEnter(e: React.DragEvent, date: string) {
    e.preventDefault();
    dragCounter.current[date] = (dragCounter.current[date] ?? 0) + 1;
    setDropTarget(date);
  }

  function onDayDragLeave(e: React.DragEvent, date: string) {
    dragCounter.current[date] = (dragCounter.current[date] ?? 1) - 1;
    if (dragCounter.current[date] <= 0) {
      dragCounter.current[date] = 0;
      setDropTarget((t) => t === date ? null : t);
    }
  }

  return (
    <div className={`relative pt-16 ${trayOpen ? "pb-52" : "pb-14"}`}>
      {/* Timeline */}
      <div>
        <div className="flex flex-col">
            {days.map(({ date, carousels }, idx) => {
              const fmt = fmtDayHeader(date);
              const isToday = date === today;
              const isPast = date < today;
              const isDropTarget = dropTarget === date;

              return (
                <div key={date} className="flex flex-row">
                  {/* Left: vertical line + dot */}
                  <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                    {/* Top connector (all except first) */}
                    {idx > 0 && <div className={`w-px flex-none h-4 ${isToday ? "bg-primary/60" : "bg-border"}`} />}
                    {/* Dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 ${isToday ? "bg-primary border-primary" : isPast ? "bg-muted-foreground/30 border-muted-foreground/30" : "bg-background border-border"}`} />
                    {/* Bottom connector */}
                    <div className={`w-px flex-1 min-h-4 ${isToday ? "bg-primary/60" : "bg-border"}`} />
                  </div>

                  {/* Right: day header + carousels */}
                  <div className="flex-1 min-w-0 pb-8">
                    {/* Day header */}
                    <div className={`flex items-center gap-3 mb-3 mt-0.5 flex-wrap ${isPast && !isToday ? "opacity-50" : ""}`}>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                          {fmt.weekday}
                        </span>
                        <span className={`text-2xl font-black leading-none ${isToday ? "text-primary" : ""}`}>
                          {fmt.day}
                        </span>
                        <span className={`text-xs capitalize ${isToday ? "text-primary/70" : "text-muted-foreground"}`}>
                          {fmt.month}
                        </span>
                      </div>
                      {carousels.length > 0 && (() => {
                        const byAccount = new Map<string, number>();
                        for (const c of carousels) {
                          const key = c.sentToAccountName ?? "Sin cuenta";
                          byAccount.set(key, (byAccount.get(key) ?? 0) + 1);
                        }
                        const accountEntries = [...byAccount.entries()].filter(([k]) => k !== "Sin cuenta");
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              {carousels.length}
                            </span>
                            {accountEntries.map(([name, count]) => (
                              <span key={name} className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 whitespace-nowrap">
                                {count} @{name}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Carousel row — drop zone */}
                    <div
                      data-date={date}
                      onDragOver={(e) => onDayDragOver(e, date)}
                      onDragEnter={(e) => onDayDragEnter(e, date)}
                      onDragLeave={(e) => onDayDragLeave(e, date)}
                      onDrop={(e) => { e.preventDefault(); setDropTarget(null); handleDropOnDay(date); }}
                      className={`flex gap-2 overflow-x-auto pr-4 pb-1 min-h-[160px] rounded-xl transition-colors ${isDropTarget ? "bg-primary/10 ring-2 ring-primary/40 ring-dashed" : ""}`}
                      style={{ scrollbarWidth: "none" }}
                    >
                      {carousels.map((c) => (
                        <CoverCard
                          key={c.id}
                          c={c}
                          dragging={draggingId === c.id}
                          onDragStart={() => setDraggingId(c.id)}
                          onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                          onTouchStart={() => setDraggingId(c.id)}
                          onClick={() => { setPreview(c); setSlideIdx(0); }}
                        />
                      ))}
                      {/* Drop placeholder */}
                      {isDropTarget && draggingId && !carousels.find((c) => c.id === draggingId) && (
                        <div className="shrink-0 w-[88px] rounded-xl border-2 border-dashed border-primary/40 bg-primary/5" style={{ aspectRatio: "9/16" }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {/* Fixed bottom tray: carousels with account but no date */}
      {tray.length > 0 && (
        <div className={`fixed bottom-0 left-56 right-0 z-40 bg-background border-t shadow-xl transition-all duration-200 ${trayOpen ? "h-52" : "h-11"}`}>
          {/* Tray header */}
          <div className="flex items-center justify-between px-4 h-11 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Sin fecha</span>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{tray.length}</span>
            </div>
            <button
              onClick={() => setTrayOpen((o) => !o)}
              className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors"
            >
              {trayOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>

          {/* Tray carousels */}
          {trayOpen && (
            <div
              data-tray="true"
              onDragOver={(e) => { e.preventDefault(); setDropTarget("__tray"); }}
              onDragLeave={() => setDropTarget((t) => t === "__tray" ? null : t)}
              onDrop={(e) => { e.preventDefault(); setDropTarget(null); handleDropOnTray(); }}
              className={`flex gap-2 overflow-x-auto px-4 pb-3 h-[calc(100%-44px)] items-start pt-1 transition-colors ${dropTarget === "__tray" ? "bg-primary/5" : ""}`}
              style={{ scrollbarWidth: "none" }}
            >
              {tray.map((c) => (
                <CoverCard
                  key={c.id}
                  c={c}
                  dragging={draggingId === c.id}
                  onDragStart={() => setDraggingId(c.id)}
                  onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                  onTouchStart={() => setDraggingId(c.id)}
                  onClick={() => { setPreview(c); setSlideIdx(0); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
          {preview && (() => {
            const slides = [...(preview.slides ?? [])].sort((a, b) => a.order - b.order);
            const cur = slides[slideIdx];
            const src = cur?.generatedImagePath ?? cur?.imagePath;
            const slideText = parseTexts(cur?.texts)
              .map((item) => item.content?.trim())
              .filter(Boolean)
              .join("\n\n");
            return (
              <>
                <DialogTitle className="sr-only">{preview.name}</DialogTitle>
                <div className="flex flex-col">
                  {/* Slide viewer */}
                  <div className="bg-neutral-950 px-4 py-5 sm:px-6">
                    <div className="mx-auto w-full max-w-[360px]">
                      <div className="relative overflow-hidden rounded-[28px] bg-black shadow-2xl" style={{ aspectRatio: "9/16" }}>
                        {src ? (
                          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Film className="h-10 w-10 text-white/20" />
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
                              onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                              disabled={slideIdx === 0}
                              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white disabled:opacity-20"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                              disabled={slideIdx === slides.length - 1}
                              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white disabled:opacity-20"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white">
                              {slideIdx + 1}/{slides.length}
                            </span>
                          </>
                        )}

                        {preview.publishedAt && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <CheckCircle className="h-10 w-10 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info + actions */}
                  <div className="p-4 space-y-2">
                    <p className="font-semibold text-sm leading-snug">{preview.name}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {preview.sentToAccountName && <span>@{preview.sentToAccountName}</span>}
                      {preview.scheduledDate && (
                        <span>{preview.scheduledDate}{preview.scheduledTime ? ` · ${preview.scheduledTime}` : ""}</span>
                      )}
                      {preview.publishedAt && <span className="text-purple-500 font-medium">Publicado</span>}
                      {!!preview.sentAt && !preview.publishedAt && <span className="text-amber-500 font-medium">Draft</span>}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => { setPreview(null); router.push(`/carousels/${preview.id}`); }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir completo
                      </button>
                      <button
                        onClick={() => setPreview(null)}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
