"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Search, X, LayoutGrid, List, Trash2, CheckSquare, Plus, FileJson, ClipboardPaste } from "lucide-react";
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

type FilterVal = "all" | "pending" | "sent";
type ViewMode = "grid" | "row";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 10_000 };

/* ── Page ────────────────────────────────────────────────────────────── */
export default function CarouselsPage() {
  const router = useRouter();
  const { data: all = [], mutate } = useSWR<Carousel[]>("/api/carousels", fetcher, SWR_OPTS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterVal>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ── Import modal ── */
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<"file" | "paste">("file");
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function importJson(text: string) {
    setImporting(true);
    try {
      const res = await fetch("/api/carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: text }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Error"); return; }
      toast.success(`${data.created.length} carousel${data.created.length !== 1 ? "s" : ""} creado${data.created.length !== 1 ? "s" : ""}`);
      setShowImport(false);
      setPasteText("");
      mutate();
    } catch { toast.error("JSON inválido"); }
    finally { setImporting(false); }
  }

  async function handleFiles(files: FileList | File[]) {
    const jsons = Array.from(files).filter((f) => f.name.endsWith(".json") || f.type === "application/json");
    if (!jsons.length) { toast.error("Sin archivos JSON"); return; }
    for (const f of jsons) await importJson(await f.text());
  }

  /* ── Filtering ── */
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

  /* ── Selection ── */
  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((c) => c.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  /* ── Bulk delete ── */
  async function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selected.size} carousel${selected.size > 1 ? "s" : ""}?`)) return;
    const ids = [...selected];
    setSelected(new Set());
    mutate((prev) => prev?.filter((c) => !ids.includes(c.id)), false);
    try {
      await Promise.all(ids.map((id) => fetch(`/api/carousels/${id}`, { method: "DELETE" })));
    } catch {
      toast.error("Error al eliminar");
      mutate();
    }
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carousels</h1>
        <button
          onClick={() => setShowImport(true)}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
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

        {/* Filtros */}
        <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
          {(["all", "pending", "sent"] as FilterVal[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              {f === "all" ? `Todos (${counts.all})`
                : f === "pending" ? `Pendientes (${counts.pending})`
                : `Enviados (${counts.sent})`}
            </button>
          ))}
        </div>

        {/* Vista */}
        <div className="flex gap-0.5 rounded-lg border p-1 bg-muted/30">
          <button
            onClick={() => setView("grid")}
            title="Grid"
            className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView("row")}
            title="Lista"
            className={`p-1.5 rounded-md transition-colors ${view === "row" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Lista vacía */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          {search
            ? `Sin resultados para "${search}".`
            : all.length === 0
            ? <><Link href="/generate" className="underline">Importa un JSON</Link> para crear carousels.</>
            : "Sin carousels en esta categoría."}
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <CarouselGridCard
              key={c.id}
              c={c}
              selected={selected.has(c.id)}
              onToggleSelect={(e) => toggleSelect(c.id, e)}
              onOpen={() => router.push(`/carousels/${c.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => (
            <CarouselRowItem
              key={c.id}
              c={c}
              selected={selected.has(c.id)}
              onToggleSelect={(e) => toggleSelect(c.id, e)}
              onOpen={() => router.push(`/carousels/${c.id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Import modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowImport(false)}>
          <div className="bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
              <h2 className="font-semibold">Nuevo carousel</h2>
              <button onClick={() => setShowImport(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {(["file", "paste"] as const).map((t) => (
                <button key={t} onClick={() => setImportTab(t)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    importTab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
                  }`}>
                  {t === "file" ? <><FileJson className="h-3.5 w-3.5" /> Archivo</> : <><ClipboardPaste className="h-3.5 w-3.5" /> Pegar</>}
                </button>
              ))}
            </div>

            <div className="p-4">
              {importTab === "file" ? (
                <>
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors ${
                      dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:bg-muted/40"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                  >
                    <FileJson className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Arrastra un .json o toca para seleccionar</p>
                    <p className="text-xs text-muted-foreground mt-1">Un archivo puede tener varios carousels</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".json,application/json" multiple className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                </>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'{ "version": "1.0", "carousels": [...] }'}
                    rows={8}
                    className="w-full rounded-xl border bg-muted/20 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <button
                    onClick={() => importJson(pasteText)}
                    disabled={!pasteText.trim() || importing}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-opacity"
                  >
                    {importing ? "Importando…" : "Importar JSON"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-[88px] md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background border shadow-2xl rounded-2xl px-4 py-2.5">
          {/* Select all toggle */}
          <button
            onClick={allFilteredSelected ? clearSelection : selectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {allFilteredSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>

          <div className="w-px h-4 bg-border" />

          <span className="text-sm font-semibold px-1 tabular-nums">
            {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
          </span>

          <div className="w-px h-4 bg-border" />

          <button
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────────── */
function SlideThumbs({ slides, small = false }: { slides: Slide[]; small?: boolean }) {
  const w = small ? 36 : 54;
  const h = small ? 64 : 96;
  return (
    <div className="flex gap-1 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
      {slides.length > 0 ? (
        slides.map((slide) => {
          const src = slide.generatedImagePath ?? slide.imagePath;
          return (
            <div key={slide.id}
              className="shrink-0 rounded-md overflow-hidden bg-muted"
              style={{ width: w, height: h }}>
              {src
                ? <img src={src} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-muted/50" />}
            </div>
          );
        })
      ) : (
        <div className="rounded-md bg-muted/50 flex items-center justify-center text-[10px] text-muted-foreground"
          style={{ width: w, height: h }}>–</div>
      )}
    </div>
  );
}

function SentPill() {
  return (
    <span className="shrink-0 text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold leading-tight">
      Enviado
    </span>
  );
}

function Checkbox({ checked, onClick }: { checked: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0
        ${checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-background/80 hover:border-primary/60"
        }`}
    >
      {checked && (
        <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-current stroke-[1.8]">
          <polyline points="1,4 4,7 9,1" />
        </svg>
      )}
    </div>
  );
}

/* ── Grid card ───────────────────────────────────────────────────────── */
function CarouselGridCard({
  c, selected, onToggleSelect, onOpen,
}: {
  c: Carousel;
  selected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
}) {
  const isSent = !!c.sentAt;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative flex flex-col rounded-2xl border bg-card overflow-hidden transition-all cursor-pointer hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"}`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Checkbox — aparece solo al hover o cuando está seleccionado */}
      <div
        className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={onToggleSelect}
      >
        <Checkbox checked={selected} onClick={onToggleSelect} />
      </div>

      {/* Slides strip */}
      <div className="p-2 pt-8 bg-muted/20">
        <SlideThumbs slides={c.slides} />
      </div>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl font-black font-mono leading-none tracking-wide">
            {c.shortId ?? "—"}
          </span>
          {isSent && <SentPill />}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug truncate">{c.name}</p>
        <div className="text-[11px] text-muted-foreground leading-snug">
          {c.sentToAccountName && (
            <span className="font-medium text-foreground">@{c.sentToAccountName}</span>
          )}
          {c.sentToAccountName && (c.appName || c.influencerName) && " · "}
          {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
        </div>
      </div>
    </div>
  );
}

/* ── Row item ────────────────────────────────────────────────────────── */
function CarouselRowItem({
  c, selected, onToggleSelect, onOpen,
}: {
  c: Carousel;
  selected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
}) {
  const isSent = !!c.sentAt;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer transition-all hover:shadow-sm active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"}`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Checkbox */}
      <Checkbox checked={selected} onClick={onToggleSelect} />

      {/* Slides */}
      <SlideThumbs slides={c.slides} small />

      {/* ID */}
      <span className="text-xl font-black font-mono tracking-wide shrink-0 w-14 leading-none">
        {c.shortId ?? "—"}
      </span>

      {/* Nombre + meta */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate leading-tight">{c.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {c.sentToAccountName && (
            <span className="font-medium text-foreground">@{c.sentToAccountName} · </span>
          )}
          {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
        </p>
      </div>

      {/* Pill */}
      {isSent ? <SentPill /> : (
        <span className="shrink-0 text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium leading-tight">
          Pendiente
        </span>
      )}
    </div>
  );
}
