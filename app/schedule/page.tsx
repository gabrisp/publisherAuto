"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Film, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Slide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
};

type Carousel = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  sentAt: number | null;
  sentToAccountName: string | null;
  publisherUsername: string | null;
  slides: Slide[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtWeekday(d: Date) {
  return d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
}

function fmtDayNum(d: Date) {
  return d.getDate();
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

const DAYS = 7;

export default function SchedulePage() {
  const router = useRouter();
  const { data: all = [] } = useSWR<Carousel[]>("/api/carousels", fetcher, {
    revalidateOnFocus: false,
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [weekOffset, setWeekOffset] = useState(0);

  // Start of current visible week (Monday)
  const weekStart = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay(); // 0=Sun, 1=Mon
    const diffToMon = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMon + weekOffset * 7);
    return d;
  }, [today, weekOffset]);

  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Carousel[]>();
    for (const c of all) {
      if (!c.scheduledDate) continue;
      if (!map.has(c.scheduledDate)) map.set(c.scheduledDate, []);
      map.get(c.scheduledDate)!.push(c);
    }
    return map;
  }, [all]);

  // Unscheduled carousels
  const unscheduled = useMemo(
    () => all.filter((c) => !c.scheduledDate && !c.publishedAt),
    [all]
  );

  const todayStr = toISO(today);

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <h2 className="text-sm font-semibold capitalize">
            {fmtMonthYear(weekStart)}
            {weekOffset === 0 && " · Esta semana"}
            {weekOffset === 1 && " · Próxima semana"}
            {weekOffset < 0 && ` · hace ${Math.abs(weekOffset)} semana${Math.abs(weekOffset) > 1 ? "s" : ""}`}
          </h2>
        </div>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoy</Button>
        )}
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const iso = toISO(day);
          const isToday = iso === todayStr;
          const isPast = iso < todayStr;
          const carousels = byDate.get(iso) ?? [];

          return (
            <div key={iso} className={`flex flex-col gap-2 min-h-[120px] rounded-xl p-2 border ${isToday ? "border-primary/40 bg-primary/5" : "border-transparent"}`}>
              {/* Day header */}
              <div className={`text-center ${isPast && !isToday ? "opacity-40" : ""}`}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {fmtWeekday(day)}
                </p>
                <p className={`text-lg font-bold leading-tight ${isToday ? "text-primary" : ""}`}>
                  {fmtDayNum(day)}
                </p>
              </div>

              {/* Carousel covers */}
              <div className="flex flex-col gap-1.5">
                {carousels.map((c) => {
                  const sortedSlides = [...(c.slides ?? [])].sort((a, b) => a.order - b.order);
                  const cover = sortedSlides[0];
                  const coverSrc = cover?.generatedImagePath ?? cover?.imagePath;
                  const isPublished = !!c.publishedAt;

                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/carousels/${c.id}`)}
                      className={`group relative w-full aspect-[9/16] rounded-lg overflow-hidden bg-muted border hover:ring-2 hover:ring-primary/40 transition-all ${isPast && !isToday ? "opacity-60" : ""}`}
                    >
                      {coverSrc ? (
                        <img src={coverSrc} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                      {isPublished && <div className="absolute inset-0 bg-black/25" />}
                      {isPublished && (
                        <div className="absolute top-1 left-1">
                          <span className="text-[8px] bg-purple-500 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">✓</span>
                        </div>
                      )}
                      {c.scheduledTime && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] font-medium px-1 py-0.5 text-center">
                          {c.scheduledTime}
                        </div>
                      )}
                      {/* Tooltip on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-1 opacity-0 group-hover:opacity-100">
                        <p className="text-[9px] text-white font-medium leading-tight line-clamp-2">{c.name}</p>
                      </div>
                    </button>
                  );
                })}
                {carousels.length === 0 && !isPast && (
                  <div className="w-full aspect-[9/16] rounded-lg border border-dashed opacity-20" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sin fecha · {unscheduled.length}</span>
            <div className="flex-1 border-t border-dashed" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {unscheduled.map((c) => {
              const sortedSlides = [...(c.slides ?? [])].sort((a, b) => a.order - b.order);
              const cover = sortedSlides[0];
              const coverSrc = cover?.generatedImagePath ?? cover?.imagePath;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/carousels/${c.id}`)}
                  className="relative w-full aspect-[9/16] rounded-lg overflow-hidden bg-muted border hover:ring-2 hover:ring-primary/40 transition-all"
                >
                  {coverSrc ? (
                    <img src={coverSrc} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
