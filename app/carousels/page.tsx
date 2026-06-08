"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Upload, Trash2, Search, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────────────────── */
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
  zipPath: string | null;
  appName: string | null;
  influencerName: string | null;
  sentAt: number | null;
  sentToAccountName: string | null;
  slideCount: number;
  slides: Slide[];
};

type TikTokAccount = { id: string; name: string };
type FilterVal = "all" | "pending" | "sent";

/* ── Page ────────────────────────────────────────────────────────────── */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CarouselsPage() {
  const router = useRouter();
  const { data: all = [], mutate: mutateCarousels } = useSWR<Carousel[]>("/api/carousels", fetcher);
  const { data: accounts = [] } = useSWR<TikTokAccount[]>("/api/tiktok/accounts", fetcher);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterVal>("all");
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleUpload(carouselId: string, accountId: string) {
    setUploading(carouselId);
    try {
      const res = await fetch(`/api/carousels/${carouselId}/tiktok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al subir");
      } else {
        toast.success("Subido como draft ✓");
        mutateCarousels(); // revalida en background, sin bloquear UI
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(carouselId: string) {
    setDeleting(carouselId);
    // Optimistic: quitar de la cache al instante
    mutateCarousels((prev) => prev?.filter((c) => c.id !== carouselId), false);
    try {
      await fetch(`/api/carousels/${carouselId}`, { method: "DELETE" });
    } catch {
      toast.error("Error al eliminar");
      mutateCarousels(); // revertir si falla
    } finally {
      setDeleting(null);
    }
  }

  const counts = useMemo(() => ({
    all: all.length,
    pending: all.filter((c) => !c.sentAt).length,
    sent: all.filter((c) => !!c.sentAt).length,
  }), [all]);

  const filtered = useMemo(() => {
    let rows = all;
    if (filter === "pending") rows = rows.filter((c) => !c.sentAt);
    if (filter === "sent") rows = rows.filter((c) => !!c.sentAt);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((c) =>
        (c.shortId ?? "").toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.sentToAccountName ?? "").toLowerCase().includes(q) ||
        (c.appName ?? "").toLowerCase().includes(q) ||
        (c.influencerName ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [all, filter, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Carousels</h1>
        {accounts.length === 0 && (
          <Link href="/tiktok">
            <Button variant="outline" size="sm">Conectar TikTok</Button>
          </Link>
        )}
      </div>

      {/* Search + filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, nombre, cuenta…"
            className="w-full rounded-lg border bg-background pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
          {(["all", "pending", "sent"] as FilterVal[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all"
                ? `Todos (${counts.all})`
                : f === "pending"
                ? `Pendientes (${counts.pending})`
                : `Enviados (${counts.sent})`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          {search
            ? `Sin resultados para "${search}".`
            : all.length === 0
            ? <><Link href="/generate" className="underline">Importa un JSON</Link> para crear carousels.</>
            : "Sin carousels en esta categoría."}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <CarouselCard
              key={c.id}
              c={c}
              accounts={accounts}
              uploading={uploading}
              deleting={deleting}
              onUpload={handleUpload}
              onDelete={handleDelete}
              onOpen={() => router.push(`/carousels/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────────────────── */
function CarouselCard({
  c, accounts, uploading, deleting, onUpload, onDelete, onOpen,
}: {
  c: Carousel;
  accounts: TikTokAccount[];
  uploading: string | null;
  deleting: string | null;
  onUpload: (id: string, accountId: string) => void;
  onDelete: (id: string) => void;
  onOpen: () => void;
}) {
  const isSent = !!c.sentAt;
  const isLoading = uploading === c.id || deleting === c.id;

  return (
    <div
      className="flex flex-col rounded-2xl border bg-card overflow-hidden transition-all cursor-pointer hover:shadow-md hover:border-foreground/20 active:scale-[0.99]"
      onClick={onOpen}
    >
      {/* Slides — scroll horizontal */}
      <div
        className="flex gap-1 overflow-x-auto p-2 bg-muted/20"
        style={{ scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {c.slides.length > 0 ? (
          c.slides.map((slide) => {
            const src = slide.generatedImagePath ?? slide.imagePath;
            return (
              <div key={slide.id}
                className="shrink-0 rounded-md overflow-hidden bg-muted"
                style={{ width: 54, height: 96 }}>
                {src
                  ? <img src={src} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-muted/50" />}
              </div>
            );
          })
        ) : (
          <div className="w-full h-24 flex items-center justify-center text-xs text-muted-foreground">
            Sin slides
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {/* ID + pill */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl font-black font-mono leading-none tracking-wide">
            {c.shortId ?? "—"}
          </span>
          {isSent && (
            <span className="shrink-0 text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold leading-tight mt-0.5">
              Enviado
            </span>
          )}
        </div>

        {/* @cuenta · influencer × app */}
        <div className="text-[11px] text-muted-foreground leading-snug">
          {c.sentToAccountName && (
            <span className="font-medium text-foreground">@{c.sentToAccountName}</span>
          )}
          {c.sentToAccountName && (c.appName || c.influencerName) && " · "}
          {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
        </div>

        {/* Acciones — solo pendientes */}
        {!isSent && (
          <div
            className="flex items-center gap-2 mt-auto pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            {accounts.length > 0 ? (
              <DropdownMenu>
                {/* @ts-expect-error radix asChild */}
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 gap-1.5" disabled={isLoading}>
                    <Upload className="h-4 w-4" />
                    {uploading === c.id ? "Subiendo…" : "Subir a TikTok"}
                    <ChevronDown className="h-3.5 w-3.5 ml-auto opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {accounts.map((acc) => (
                    <DropdownMenuItem key={acc.id} onClick={() => onUpload(c.id, acc.id)}>
                      @{acc.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/tiktok" className="flex-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" className="w-full">Conectar cuenta</Button>
              </Link>
            )}

            <button
              onClick={() => onDelete(c.id)}
              disabled={isLoading}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
