"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Film } from "lucide-react";

type Slide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
};

type Carousel = {
  id: string;
  name: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  sentAt: number | null;
  sentToAccountName: string | null;
  slides: Slide[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmtDay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString("es-ES", { weekday: "long" }),
    day: d,
    month: date.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
    full: date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
  };
}

export default function SchedulePage() {
  const router = useRouter();
  const { data: all = [] } = useSWR<Carousel[]>("/api/carousels", fetcher, {
    revalidateOnFocus: false,
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Group by date, only dates that have carousels, sorted ascending
  const days = useMemo(() => {
    const map = new Map<string, Carousel[]>();
    for (const c of all) {
      if (!c.scheduledDate) continue;
      if (!map.has(c.scheduledDate)) map.set(c.scheduledDate, []);
      map.get(c.scheduledDate)!.push(c);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, carousels]) => ({ date, carousels }));
  }, [all]);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No hay carousels programados
      </div>
    );
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex gap-0 min-w-max pb-6 pr-12">
        {days.map(({ date, carousels }, dayIdx) => {
          const fmt = fmtDay(date);
          const isPast = date < today;
          const isToday = date === today;
          const sorted = [...carousels].sort((a, b) =>
            (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "")
          );

          return (
            <div key={date} className="flex flex-row">
              {/* Day column */}
              <div className="flex flex-col items-center w-[140px] shrink-0">
                {/* Date header */}
                <div className={`mb-4 text-center ${isPast && !isToday ? "opacity-50" : ""}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider capitalize ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {fmt.weekday}
                  </p>
                  <p className={`text-2xl font-black leading-none ${isToday ? "text-primary" : ""}`}>
                    {fmt.day}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">{fmt.month}</p>
                </div>

                {/* Carousels stacked */}
                <div className="flex flex-col gap-3 w-full px-3 relative">
                  {/* Vertical line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-px ${isToday ? "bg-primary/40" : "bg-border"}`} />

                  {sorted.map((c) => {
                    const slides = [...(c.slides ?? [])].sort((a, b) => a.order - b.order);
                    const cover = slides[0];
                    const coverSrc = cover?.generatedImagePath ?? cover?.imagePath;
                    const isPublished = !!c.publishedAt;

                    return (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/carousels/${c.id}`)}
                        className={`group relative w-full rounded-xl overflow-hidden bg-muted border hover:ring-2 hover:ring-primary/50 transition-all text-left ${isPast && !isToday ? "opacity-60" : ""}`}
                        style={{ aspectRatio: "9/16" }}
                      >
                        {coverSrc ? (
                          <img src={coverSrc} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                        {isPublished && <div className="absolute inset-0 bg-black/25" />}

                        {/* Status */}
                        {isPublished && (
                          <span className="absolute top-1.5 left-1.5 text-[9px] bg-purple-500 text-white rounded-full px-1.5 py-0.5 font-bold">✓</span>
                        )}
                        {!!c.sentAt && !isPublished && (
                          <span className="absolute top-1.5 left-1.5 text-[9px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold">D</span>
                        )}

                        {/* Bottom info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          {c.scheduledTime && (
                            <p className="text-[10px] text-white/80 font-medium">{c.scheduledTime}</p>
                          )}
                          {c.sentToAccountName && (
                            <p className="text-[10px] text-white font-semibold">@{c.sentToAccountName}</p>
                          )}
                          <p className="text-[9px] text-white/70 leading-tight line-clamp-1 mt-0.5">{c.name}</p>
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horizontal connector line between days */}
              {dayIdx < days.length - 1 && (
                <div className="flex items-start pt-[72px] w-8 shrink-0">
                  <div className="w-full h-px bg-border mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
