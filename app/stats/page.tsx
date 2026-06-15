"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Eye, Heart, MessageCircle, Share2, Bookmark,
  ChevronDown, ChevronRight, TrendingUp, BarChart2,
  ArrowUp, ArrowDown,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────────────────── */
type Slide = { id: string; order: number; generatedImagePath: string | null; imagePath: string | null };

type PublishedCarousel = {
  id: string;
  name: string;
  shortId: string | null;
  publishedAt: number;
  scheduledDate: string | null;
  videoTitle: string | null;
  stats: string | null;
  appName: string | null;
  influencerName: string | null;
  sentToAccountName: string | null;
  slides: Slide[];
};

type StatsData = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
};

type SortCol = "publishedAt" | "views" | "likes" | "comments" | "shares" | "saves" | "engagement";

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function parseStats(s: string | null): StatsData {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}

function engagementRate(s: StatsData): number {
  const v = s.views ?? 0;
  if (!v) return 0;
  return ((s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0) + (s.saves ?? 0)) / v * 100;
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("es-ES");
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function engagementColor(rate: number): string {
  if (rate >= 8) return "text-emerald-500";
  if (rate >= 4) return "text-green-500";
  if (rate >= 2) return "text-yellow-500";
  return "text-muted-foreground";
}

function engagementBg(rate: number): string {
  if (rate >= 8) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (rate >= 4) return "bg-green-500/15 text-green-600 dark:text-green-400";
  if (rate >= 2) return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function StatsPage() {
  const { data: raw = [] } = useSWR<PublishedCarousel[]>(
    "/api/carousels?published=1",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("publishedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  const enriched = useMemo(() =>
    raw.map((c) => {
      const s = parseStats(c.stats);
      return { ...c, statsData: s, eng: engagementRate(s) };
    }), [raw]);

  const totals = useMemo(() => ({
    count: enriched.length,
    views: enriched.reduce((a, c) => a + (c.statsData.views ?? 0), 0),
    likes: enriched.reduce((a, c) => a + (c.statsData.likes ?? 0), 0),
    comments: enriched.reduce((a, c) => a + (c.statsData.comments ?? 0), 0),
    shares: enriched.reduce((a, c) => a + (c.statsData.shares ?? 0), 0),
    saves: enriched.reduce((a, c) => a + (c.statsData.saves ?? 0), 0),
    avgEng: enriched.length
      ? enriched.reduce((a, c) => a + c.eng, 0) / enriched.length
      : 0,
  }), [enriched]);

  const maxViews = useMemo(() =>
    Math.max(...enriched.map((c) => c.statsData.views ?? 0), 1), [enriched]);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortCol === "publishedAt") { av = a.publishedAt; bv = b.publishedAt; }
      else if (sortCol === "engagement") { av = a.eng; bv = b.eng; }
      else {
        av = a.statsData[sortCol as keyof StatsData] ?? 0;
        bv = b.statsData[sortCol as keyof StatsData] ?? 0;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [enriched, sortCol, sortDir]);

  /* ── Render ── */
  return (
    <div className="space-y-6 pb-24 pt-4 md:pt-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Stats</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{totals.count} carousels publicados</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<BarChart2 className="h-4 w-4" />} label="Publicados" value={totals.count.toString()} />
        <SummaryCard icon={<Eye className="h-4 w-4" />} label="Views" value={fmt(totals.views)} accent="blue" />
        <SummaryCard icon={<Heart className="h-4 w-4" />} label="Likes" value={fmt(totals.likes)} accent="rose" />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Engagement medio" value={totals.avgEng.toFixed(1) + "%"} accent="emerald" />
      </div>

      {/* Table */}
      {enriched.length === 0 ? (
        <div className="rounded-2xl border bg-muted/20 py-20 text-center text-sm text-muted-foreground">
          Ningún carousel marcado como publicado todavía.
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-8" />
                  <th className="w-14 px-3 py-3 text-left" />
                  <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">ID</th>
                  <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Carousel</th>
                  <SortTh col="publishedAt" current={sortCol} dir={sortDir} onSort={handleSort}>Publicado</SortTh>
                  <SortTh col="views" current={sortCol} dir={sortDir} onSort={handleSort}>
                    <Eye className="h-3 w-3 inline mr-1 opacity-60" />Views
                  </SortTh>
                  <SortTh col="likes" current={sortCol} dir={sortDir} onSort={handleSort}>
                    <Heart className="h-3 w-3 inline mr-1 opacity-60" />Likes
                  </SortTh>
                  <SortTh col="comments" current={sortCol} dir={sortDir} onSort={handleSort}>
                    <MessageCircle className="h-3 w-3 inline mr-1 opacity-60" />Coments.
                  </SortTh>
                  <SortTh col="shares" current={sortCol} dir={sortDir} onSort={handleSort}>
                    <Share2 className="h-3 w-3 inline mr-1 opacity-60" />Shares
                  </SortTh>
                  <SortTh col="saves" current={sortCol} dir={sortDir} onSort={handleSort}>
                    <Bookmark className="h-3 w-3 inline mr-1 opacity-60" />Saves
                  </SortTh>
                  <SortTh col="engagement" current={sortCol} dir={sortDir} onSort={handleSort}>Engage</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const s = c.statsData;
                  const viewPct = maxViews ? ((s.views ?? 0) / maxViews) * 100 : 0;

                  return (
                    <>
                      <tr
                        key={c.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        {/* Expand chevron */}
                        <td className="pl-3 pr-0 py-3 text-muted-foreground">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                        </td>

                        {/* Thumbnail */}
                        <td className="px-2 py-2">
                          <ThumbStack slides={c.slides} />
                        </td>

                        {/* ShortId */}
                        <td className="px-3 py-3">
                          <span className="font-black font-mono tracking-wide text-base leading-none">
                            {c.shortId ?? "—"}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-3 py-3 min-w-[160px] max-w-[220px]">
                          <p className="font-medium truncate leading-tight">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
                            {c.sentToAccountName && ` · @${c.sentToAccountName}`}
                          </p>
                        </td>

                        {/* Published date */}
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground text-xs">
                          {fmtDate(c.publishedAt)}
                        </td>

                        {/* Views with mini bar */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1 min-w-[60px]">
                            <span className="font-semibold tabular-nums">{fmt(s.views)}</span>
                            <div className="h-1 rounded-full bg-muted overflow-hidden w-16">
                              <div
                                className="h-full rounded-full bg-blue-500/60"
                                style={{ width: `${viewPct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 font-semibold tabular-nums">{fmt(s.likes)}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums">{fmt(s.comments)}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums">{fmt(s.shares)}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums">{fmt(s.saves)}</td>

                        {/* Engagement */}
                        <td className="px-3 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${engagementBg(c.eng)}`}>
                            {c.eng > 0 ? c.eng.toFixed(1) + "%" : "—"}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr key={`${c.id}-expanded`} className="bg-muted/10">
                          <td colSpan={11} className="px-6 py-5">
                            <div className="flex flex-col md:flex-row gap-6">

                              {/* Slides strip */}
                              <div className="flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                                {c.slides.length > 0 ? c.slides.map((slide) => {
                                  const src = slide.generatedImagePath ?? slide.imagePath;
                                  return (
                                    <div
                                      key={slide.id}
                                      className="shrink-0 rounded-lg overflow-hidden bg-muted border"
                                      style={{ width: 56, height: 100 }}
                                    >
                                      {src
                                        ? <img src={src} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full bg-muted/50" />}
                                    </div>
                                  );
                                }) : (
                                  <div className="text-xs text-muted-foreground italic">Sin slides</div>
                                )}
                              </div>

                              {/* Info + big stats */}
                              <div className="flex-1 min-w-0 space-y-4">
                                {c.videoTitle && (
                                  <p className="text-sm font-semibold leading-snug">{c.videoTitle}</p>
                                )}

                                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                  {([
                                    ["Views", s.views, <Eye className="h-3.5 w-3.5" />],
                                    ["Likes", s.likes, <Heart className="h-3.5 w-3.5" />],
                                    ["Coments.", s.comments, <MessageCircle className="h-3.5 w-3.5" />],
                                    ["Shares", s.shares, <Share2 className="h-3.5 w-3.5" />],
                                    ["Saves", s.saves, <Bookmark className="h-3.5 w-3.5" />],
                                  ] as [string, number | undefined, React.ReactNode][]).map(([label, val, icon]) => (
                                    <div key={label} className="rounded-xl border bg-background p-3 space-y-1">
                                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                        {icon}
                                        {label}
                                      </div>
                                      <p className="text-xl font-black tabular-nums">{fmt(val)}</p>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>Publicado {fmtDate(c.publishedAt)}</span>
                                  {c.scheduledDate && <span>· Programado {new Date(c.scheduledDate + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}
                                  <span className={`ml-auto font-semibold text-sm ${engagementColor(c.eng)}`}>
                                    {c.eng > 0 ? c.eng.toFixed(2) + "% engagement" : "Sin stats"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {/* Totals row */}
                <tr className="border-t-2 bg-muted/20 font-semibold">
                  <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground uppercase tracking-wider">
                    Totales · {totals.count} publicados
                  </td>
                  <td className="px-3 py-3 tabular-nums">{fmt(totals.views)}</td>
                  <td className="px-3 py-3 tabular-nums">{fmt(totals.likes)}</td>
                  <td className="px-3 py-3 tabular-nums">{fmt(totals.comments)}</td>
                  <td className="px-3 py-3 tabular-nums">{fmt(totals.shares)}</td>
                  <td className="px-3 py-3 tabular-nums">{fmt(totals.saves)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${engagementBg(totals.avgEng)}`}>
                      {totals.avgEng.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */
function SummaryCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "blue" | "rose" | "emerald";
}) {
  const iconColor = accent === "blue" ? "text-blue-500 bg-blue-500/10"
    : accent === "rose" ? "text-rose-500 bg-rose-500/10"
    : accent === "emerald" ? "text-emerald-500 bg-emerald-500/10"
    : "text-muted-foreground bg-muted";

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function SortTh({
  col, current, dir, onSort, children,
}: {
  col: SortCol;
  current: SortCol;
  dir: "asc" | "desc";
  onSort: (col: SortCol) => void;
  children: React.ReactNode;
}) {
  const active = current === col;
  return (
    <th
      className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active
          ? dir === "desc"
            ? <ArrowDown className="h-3 w-3 text-primary" />
            : <ArrowUp className="h-3 w-3 text-primary" />
          : <ArrowDown className="h-3 w-3 opacity-20" />}
      </span>
    </th>
  );
}

function ThumbStack({ slides }: { slides: Slide[] }) {
  const first = slides[0];
  const src = first?.generatedImagePath ?? first?.imagePath;
  return (
    <div className="relative w-10 h-[72px] shrink-0">
      {slides.length > 1 && (
        <div className="absolute top-0 left-2 w-8 h-[66px] rounded-md bg-muted border" />
      )}
      <div className="absolute top-1 left-0 w-9 h-[68px] rounded-md overflow-hidden bg-muted border shadow-sm">
        {src
          ? <img src={src} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-muted/50" />}
      </div>
    </div>
  );
}
