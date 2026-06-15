"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Search, X, LayoutGrid, List, Trash2, CheckSquare, Plus,
  FileJson, ClipboardPaste, Folder, FolderOpen, MoreHorizontal,
  ChevronRight, Copy, MoveRight, Pencil, FolderInput, Archive,
  ArchiveRestore, Calendar, ArrowUpDown,
} from "lucide-react";
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
  folderId: string | null;
  archivedAt: number | null;
  scheduledDate: string | null;
  publishedAt: number | null;
};

type FolderRecord = {
  id: string;
  name: string;
  createdAt: number;
  carouselCount: number;
};

type FilterVal = "all" | "pending" | "draft" | "published";
type SortBy = "created" | "scheduled";
type ViewMode = "grid" | "row";

type ContextMenu = {
  carouselId: string;
  top: number;
  right: number;
  submenu: "move" | null;
} | null;

type FolderMenu = { id: string; top: number; right: number } | null;

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 10_000 };

/* ── Page ────────────────────────────────────────────────────────────── */
export default function CarouselsPage() {
  const router = useRouter();

  /* archive view toggle */
  const [showArchived, setShowArchived] = useState(false);
  const apiUrl = showArchived ? "/api/carousels?archived=1" : "/api/carousels";
  const { data: all = [], mutate } = useSWR<Carousel[]>(apiUrl, fetcher, SWR_OPTS);
  const { data: folders = [], mutate: mutateFolders } = useSWR<FolderRecord[]>("/api/folders", fetcher, SWR_OPTS);

  /* filter / view */
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterVal>("all");
  const [sortBy, setSortBy] = useState<SortBy>("created");
  const [filterApp, setFilterApp] = useState("");
  const [filterInfluencer, setFilterInfluencer] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* folder state */
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const newFolderRef = useRef<HTMLInputElement>(null);
  const renamingInputRef = useRef<HTMLInputElement>(null);
  /* guards against double-fire from onBlur + onKeyDown(Enter) */
  const creatingFolderGuard = useRef(false);
  const renamingGuard = useRef(false);

  /* drag carousel → folder — use ref for reliability in drop handler */
  const draggingCarouselRef = useRef<string | null>(null);
  const [draggingCarouselId, setDraggingCarouselId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  /* context menus */
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [folderMenu, setFolderMenu] = useState<FolderMenu>(null);

  /* bulk move popup */
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  /* import modal */
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<"file" | "paste">("file");
  const [importDragging, setImportDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* close menus on outside click — BUBBLE phase so stopPropagation inside menus works */
  useEffect(() => {
    if (!contextMenu && !folderMenu && !bulkMoveOpen) return;
    const close = () => {
      setContextMenu(null);
      setFolderMenu(null);
      setBulkMoveOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu, folderMenu, bulkMoveOpen]);

  useEffect(() => {
    if (showNewFolder) setTimeout(() => newFolderRef.current?.focus(), 50);
  }, [showNewFolder]);

  useEffect(() => {
    if (renamingFolderId) setTimeout(() => renamingInputRef.current?.focus(), 50);
  }, [renamingFolderId]);

  /* reset selection + folder when switching archive mode */
  useEffect(() => {
    setSelected(new Set());
    setActiveFolder(null);
    setSearch("");
  }, [showArchived]);

  /* ── Import ── */
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

  /* ── Folders ── */
  async function createFolder() {
    if (creatingFolderGuard.current) return;
    const name = newFolderName.trim();
    if (!name) { setShowNewFolder(false); return; }
    creatingFolderGuard.current = true;
    setNewFolderName("");
    setShowNewFolder(false);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) toast.error("Error al crear carpeta");
      else mutateFolders();
    } finally { creatingFolderGuard.current = false; }
  }

  async function renameFolder() {
    if (renamingGuard.current || !renamingFolderId) return;
    const id = renamingFolderId;
    const name = renamingName.trim();
    renamingGuard.current = true;
    setRenamingFolderId(null);
    if (!name) { renamingGuard.current = false; return; }
    try {
      await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      mutateFolders();
    } finally { renamingGuard.current = false; }
  }

  async function deleteFolder(id: string) {
    setFolderMenu(null);
    if (!confirm("¿Eliminar carpeta? Los carousels pasarán a Sin carpeta.")) return;
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (activeFolder === id) setActiveFolder(null);
    mutateFolders();
    mutate();
  }

  /* ── Move to folder ── */
  async function moveToFolder(carouselId: string, folderId: string | null) {
    mutate((prev) => prev?.map((c) => c.id === carouselId ? { ...c, folderId } : c), false);
    const res = await fetch(`/api/carousels/${carouselId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) { toast.error("Error al mover"); mutate(); }
    mutateFolders();
  }

  async function handleBulkMove(folderId: string | null) {
    setBulkMoveOpen(false);
    const ids = [...selected];
    mutate((prev) => prev?.map((c) => ids.includes(c.id) ? { ...c, folderId } : c), false);
    await Promise.all(ids.map((id) =>
      fetch(`/api/carousels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      })
    ));
    mutateFolders();
  }

  /* ── Archive ── */
  async function setArchived(carouselId: string, archive: boolean) {
    setContextMenu(null);
    const archivedAt = archive ? Math.floor(Date.now() / 1000) : null;
    mutate((prev) => prev?.filter((c) => c.id !== carouselId), false);
    await fetch(`/api/carousels/${carouselId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivedAt }),
    });
  }

  async function handleBulkArchive(archive: boolean) {
    const ids = [...selected];
    setSelected(new Set());
    const archivedAt = archive ? Math.floor(Date.now() / 1000) : null;
    mutate((prev) => prev?.filter((c) => !ids.includes(c.id)), false);
    await Promise.all(ids.map((id) =>
      fetch(`/api/carousels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt }),
      })
    ));
  }

  /* ── Drag ── */
  function handleDragStart(carouselId: string) {
    draggingCarouselRef.current = carouselId;
    setDraggingCarouselId(carouselId);
  }

  function handleDragEnd() {
    draggingCarouselRef.current = null;
    setDraggingCarouselId(null);
    setDragOverFolderId(null);
  }

  async function handleDropOnFolder(folderId: string | null) {
    const cid = draggingCarouselRef.current;
    if (!cid) return;
    draggingCarouselRef.current = null;
    setDraggingCarouselId(null);
    setDragOverFolderId(null);
    await moveToFolder(cid, folderId);
  }

  /* ── Duplicate ── */
  async function duplicateCarousel(id: string) {
    setContextMenu(null);
    const res = await fetch(`/api/carousels/${id}/duplicate`, { method: "POST" });
    if (!res.ok) { toast.error("Error al duplicar"); return; }
    toast.success("Carousel duplicado");
    mutate();
  }

  /* ── Context menus ── */
  function openContextMenu(carouselId: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ carouselId, top: rect.bottom + 6, right: window.innerWidth - rect.right, submenu: null });
    setFolderMenu(null);
    setBulkMoveOpen(false);
  }

  function openFolderMenu(folderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFolderMenu({ id: folderId, top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setContextMenu(null);
    setBulkMoveOpen(false);
  }

  async function deleteCarousel(id: string) {
    setContextMenu(null);
    if (!confirm("¿Eliminar este carousel?")) return;
    mutate((prev) => prev?.filter((c) => c.id !== id), false);
    const res = await fetch(`/api/carousels/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Error al eliminar"); mutate(); }
  }

  /* ── Filters ── */
  const counts = useMemo(() => ({
    all: all.length,
    pending: all.filter((c) => !c.sentAt && !c.publishedAt).length,
    draft: all.filter((c) => !!c.sentAt && !c.publishedAt).length,
    published: all.filter((c) => !!c.publishedAt).length,
  }), [all]);

  const appOptions = useMemo(() =>
    [...new Set(all.map((c) => c.appName).filter((n): n is string => !!n))].sort(), [all]);
  const influencerOptions = useMemo(() =>
    [...new Set(all.map((c) => c.influencerName).filter((n): n is string => !!n))].sort(), [all]);

  const filtered = useMemo(() => {
    let rows = all;
    if (activeFolder === "__none__") rows = rows.filter((c) => !c.folderId);
    else if (activeFolder) rows = rows.filter((c) => c.folderId === activeFolder);
    if (filter === "pending") rows = rows.filter((c) => !c.sentAt && !c.publishedAt);
    if (filter === "draft") rows = rows.filter((c) => !!c.sentAt && !c.publishedAt);
    if (filter === "published") rows = rows.filter((c) => !!c.publishedAt);
    if (filterApp) rows = rows.filter((c) => c.appName === filterApp);
    if (filterInfluencer) rows = rows.filter((c) => c.influencerName === filterInfluencer);
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
  }, [all, activeFolder, filter, filterApp, filterInfluencer, search]);

  const sorted = useMemo(() => {
    if (sortBy === "scheduled") {
      return [...filtered].sort((a, b) => {
        if (!a.scheduledDate && !b.scheduledDate) return 0;
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return a.scheduledDate.localeCompare(b.scheduledDate);
      });
    }
    return filtered;
  }, [filtered, sortBy]);

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
  function selectAll() { setSelected(new Set(sorted.map((c) => c.id))); }
  function clearSelection() { setSelected(new Set()); }

  async function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selected.size} carousel${selected.size > 1 ? "s" : ""}?`)) return;
    const ids = [...selected];
    setSelected(new Set());
    mutate((prev) => prev?.filter((c) => !ids.includes(c.id)), false);
    try { await Promise.all(ids.map((id) => fetch(`/api/carousels/${id}`, { method: "DELETE" }))); }
    catch { toast.error("Error al eliminar"); mutate(); }
  }

  async function handleDateChange(carouselId: string, date: string | null) {
    mutate((prev) => prev?.map((c) => c.id === carouselId ? { ...c, scheduledDate: date } : c), false);
    await fetch(`/api/carousels/${carouselId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: date }),
    });
  }

  const allFilteredSelected = sorted.length > 0 && sorted.every((c) => selected.has(c.id));
  const isDragging = !!draggingCarouselId;

  return (
    <div className="flex flex-col gap-6 pb-24 pt-4 md:pt-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showArchived && (
            <button
              onClick={() => setShowArchived(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          )}
          <h1 className="text-2xl font-bold">{showArchived ? "Archivados" : "Carousels"}</h1>
        </div>
        {!showArchived && (
          <button
            onClick={() => setShowImport(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ── Controls block ── */}
      <div className="flex flex-col gap-2.5">

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border bg-background pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-0.5 rounded-lg border p-1 bg-muted/30 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
            {([
              ["all", `Todos (${counts.all})`],
              ["pending", `Sin subir (${counts.pending})`],
              ["draft", `Draft (${counts.draft})`],
              ["published", `Publicados (${counts.published})`],
            ] as [FilterVal, string][]).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-0.5 rounded-lg border p-1 bg-muted/30 shrink-0">
            {(["grid", "row"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)} title={v === "grid" ? "Grid" : "Lista"}
                className={`p-1.5 rounded-md transition-colors ${view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {v === "grid" ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortBy((s) => s === "created" ? "scheduled" : "created")}
            title={sortBy === "created" ? "Ordenar por fecha programada" : "Ordenar por creación"}
            className={`shrink-0 p-1.5 rounded-lg border transition-colors ${
              sortBy === "scheduled" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Secondary filters */}
        {(appOptions.length > 1 || influencerOptions.length > 1) && (
          <div className="flex items-center gap-2 flex-wrap">
            {appOptions.length > 1 && (
              <select value={filterApp} onChange={(e) => setFilterApp(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los apps</option>
                {appOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            {influencerOptions.length > 1 && (
              <select value={filterInfluencer} onChange={(e) => setFilterInfluencer(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los influencers</option>
                {influencerOptions.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            )}
            {(filterApp || filterInfluencer) && (
              <button onClick={() => { setFilterApp(""); setFilterInfluencer(""); }}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted/50">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Folder strip (only in normal view) */}
        {!showArchived && (
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>

            {/* Sin carpeta */}
            <div
              className={`shrink-0 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all cursor-pointer select-none
                ${activeFolder === "__none__"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted/30 hover:bg-muted/60 border-transparent hover:border-muted-foreground/20 text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setActiveFolder(activeFolder === "__none__" ? null : "__none__")}
            >
              <FolderInput className="h-3.5 w-3.5 shrink-0" />
              <span>Sin carpeta</span>
            </div>

            {folders.map((f) => {
              const isActive = activeFolder === f.id;
              const isDropTarget = dragOverFolderId === f.id;
              return (
                <div
                  key={f.id}
                  className={`group relative shrink-0 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all cursor-pointer select-none
                    ${isActive
                      ? "bg-foreground text-background border-foreground"
                      : isDropTarget
                      ? "border-dashed border-2 border-primary bg-primary/10 text-primary scale-105"
                      : isDragging
                      ? "border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 hover:text-primary"
                      : "bg-muted/30 hover:bg-muted/60 border-transparent hover:border-muted-foreground/20 text-muted-foreground hover:text-foreground"
                    }`}
                  onClick={() => !renamingFolderId && setActiveFolder(isActive ? null : f.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(f.id); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverFolderId(null); }}
                  onDrop={(e) => { e.preventDefault(); handleDropOnFolder(f.id); }}
                >
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  {renamingFolderId === f.id ? (
                    <input
                      ref={renamingInputRef}
                      value={renamingName}
                      onChange={(e) => setRenamingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameFolder();
                        if (e.key === "Escape") setRenamingFolderId(null);
                        e.stopPropagation();
                      }}
                      onBlur={renameFolder}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent outline-none w-28 text-sm"
                    />
                  ) : (
                    <span className="leading-none">{f.name}</span>
                  )}
                  <span className="opacity-40 leading-none tabular-nums text-xs">{f.carouselCount}</span>
                  {!isDragging && renamingFolderId !== f.id && (
                    <button
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                      onClick={(e) => openFolderMenu(f.id, e)}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {showNewFolder ? (
              <div className="shrink-0 flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/5 px-3.5 py-2">
                <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
                <input
                  ref={newFolderRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder();
                    if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
                  }}
                  onBlur={createFolder}
                  placeholder="Nombre…"
                  className="bg-transparent outline-none text-sm w-28"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Carpeta
              </button>
            )}

            {/* Archive toggle */}
            <button
              onClick={() => setShowArchived(true)}
              className="shrink-0 ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <Archive className="h-3.5 w-3.5" />
              Archivados
            </button>
          </div>
        )}
      </div>

      {/* Grid / List */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          {search
            ? `Sin resultados para "${search}".`
            : showArchived
            ? "No hay carousels archivados."
            : all.length === 0
            ? <><Link href="/generate" className="underline">Importa un JSON</Link> para crear carousels.</>
            : "Sin carousels en esta categoría."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {(() => {
            const shouldGroup = !!activeFolder || sortBy === "scheduled";
            const groups = shouldGroup ? groupByDate(sorted) : [{ date: null as string | null, items: sorted }];
            return groups.map(({ date, items }) => (
            <div key={date ?? "__nodate"} className="flex flex-col gap-3">
              {(activeFolder || sortBy === "scheduled") && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                    {date ? fmtDateHeader(date) : "Sin fecha"}
                  </span>
                  <div className="flex-1 border-t border-dashed" />
                </div>
              )}
              {view === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((c) => (
                    <CarouselGridCard
                      key={c.id}
                      c={c}
                      selected={selected.has(c.id)}
                      onToggleSelect={(e) => toggleSelect(c.id, e)}
                      onOpen={() => router.push(`/carousels/${c.id}`)}
                      onContextMenu={(e) => openContextMenu(c.id, e)}
                      onDragStart={() => handleDragStart(c.id)}
                      onDragEnd={handleDragEnd}
                      onDateChange={handleDateChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((c) => (
                    <CarouselRowItem
                      key={c.id}
                      c={c}
                      selected={selected.has(c.id)}
                      onToggleSelect={(e) => toggleSelect(c.id, e)}
                      onOpen={() => router.push(`/carousels/${c.id}`)}
                      onContextMenu={(e) => openContextMenu(c.id, e)}
                      onDragStart={() => handleDragStart(c.id)}
                      onDragEnd={handleDragEnd}
                      onDateChange={handleDateChange}
                    />
                  ))}
                </div>
              )}
            </div>
          ));
          })()}
        </div>
      )}

      {/* ── Carousel context menu ── */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-background border shadow-2xl rounded-xl overflow-hidden min-w-44 py-1"
          style={{ top: contextMenu.top, right: contextMenu.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.submenu === "move" ? (
            <>
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); setContextMenu((m) => m ? { ...m, submenu: null } : null); }}
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Atrás
              </button>
              <div className="border-t my-1" />
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                onClick={(e) => { e.stopPropagation(); const cid = contextMenu.carouselId; setContextMenu(null); moveToFolder(cid, null); }}
              >
                <FolderInput className="h-3.5 w-3.5" />
                Sin carpeta
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); const cid = contextMenu.carouselId; setContextMenu(null); moveToFolder(cid, f.id); }}
                >
                  <Folder className="h-3.5 w-3.5" />
                  {f.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                onClick={(e) => { e.stopPropagation(); const id = contextMenu.carouselId; setContextMenu(null); router.push(`/carousels/${id}`); }}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Abrir
              </button>
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                onClick={(e) => { e.stopPropagation(); duplicateCarousel(contextMenu.carouselId); }}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicar
              </button>
              {!showArchived && folders.length > 0 && (
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); setContextMenu((m) => m ? { ...m, submenu: "move" } : null); }}
                >
                  <MoveRight className="h-3.5 w-3.5" />
                  Mover a…
                  <ChevronRight className="h-3 w-3 ml-auto" />
                </button>
              )}
              <div className="border-t my-1" />
              {showArchived ? (
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); setArchived(contextMenu.carouselId, false); }}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  Desarchivar
                </button>
              ) : (
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); setArchived(contextMenu.carouselId, true); }}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archivar
                </button>
              )}
              <div className="border-t my-1" />
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); deleteCarousel(contextMenu.carouselId); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Folder context menu ── */}
      {folderMenu && (
        <div
          className="fixed z-[100] bg-background border shadow-2xl rounded-xl overflow-hidden min-w-36 py-1"
          style={{ top: folderMenu.top, right: folderMenu.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
            onClick={(e) => {
              e.stopPropagation();
              const folder = folders.find((f) => f.id === folderMenu.id);
              if (!folder) return;
              setRenamingFolderId(folderMenu.id);
              setRenamingName(folder.name);
              setFolderMenu(null);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Renombrar
          </button>
          <div className="border-t my-1" />
          <button
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); deleteFolder(folderMenu.id); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      )}

      {/* ── Import modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowImport(false)}>
          <div className="bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
              <h2 className="font-semibold">Nuevo carousel</h2>
              <button onClick={() => setShowImport(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
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
                      importDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:bg-muted/40"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
                    onDragLeave={() => setImportDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setImportDragging(false); handleFiles(e.dataTransfer.files); }}
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
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'{ "version": "1.0", "carousels": [...] }'}
                    rows={8}
                    className="w-full rounded-xl border bg-muted/20 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                  <button onClick={() => importJson(pasteText)}
                    disabled={!pasteText.trim() || importing}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
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
          <button
            onClick={allFilteredSelected ? clearSelection : selectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {allFilteredSelected ? "Deseleccionar" : "Seleccionar todo"}
          </button>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm font-semibold px-1 tabular-nums">
            {selected.size} sel.
          </span>
          <div className="w-px h-4 bg-border" />

          {/* Mover a — only in normal view with folders */}
          {!showArchived && folders.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setBulkMoveOpen((o) => !o); setContextMenu(null); setFolderMenu(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <MoveRight className="h-3.5 w-3.5" />
                Mover
              </button>
              {bulkMoveOpen && (
                <div
                  className="absolute bottom-full mb-2 left-0 bg-background border shadow-2xl rounded-xl overflow-hidden min-w-40 py-1 z-[110]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                    onClick={(e) => { e.stopPropagation(); handleBulkMove(null); }}
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                    Sin carpeta
                  </button>
                  <div className="border-t my-1" />
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted/60"
                      onClick={(e) => { e.stopPropagation(); handleBulkMove(f.id); }}
                    >
                      <Folder className="h-3.5 w-3.5" />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Archive / Unarchive */}
          {showArchived ? (
            <button
              onClick={() => handleBulkArchive(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Desarchivar
            </button>
          ) : (
            <button
              onClick={() => handleBulkArchive(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Archive className="h-3.5 w-3.5" />
              Archivar
            </button>
          )}

          <div className="w-px h-4 bg-border" />
          <button onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleBulkDelete}
            className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg px-3 py-1.5 transition-colors">
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
            <div key={slide.id} className="shrink-0 rounded-md overflow-hidden bg-muted" style={{ width: w, height: h }}>
              {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted/50" />}
            </div>
          );
        })
      ) : (
        <div className="rounded-md bg-muted/50 flex items-center justify-center text-[10px] text-muted-foreground" style={{ width: w, height: h }}>–</div>
      )}
    </div>
  );
}

function DraftPill() {
  return (
    <span className="shrink-0 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full px-2 py-0.5 font-semibold leading-tight">
      Draft
    </span>
  );
}

function PublishedPill() {
  return (
    <span className="shrink-0 text-[10px] bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-full px-2 py-0.5 font-semibold leading-tight">
      Publicado
    </span>
  );
}

function DatePill({ date, onChange }: { date: string | null; onChange: (d: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative inline-flex items-center gap-1 rounded-full bg-muted/40 border border-transparent hover:border-muted-foreground/20 px-2 py-0.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors shrink-0"
      onClick={(e) => { e.stopPropagation(); ref.current?.showPicker?.(); }}
    >
      <Calendar className="h-2.5 w-2.5 shrink-0" />
      <span>{date ? fmtShortDate(date) : "Fecha"}</span>
      <input
        ref={ref}
        type="date"
        value={date ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
      />
    </div>
  );
}

/* ── Date helpers ─────────────────────────────────────────────────────── */
function fmtShortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function fmtDateHeader(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(items: Carousel[]): { date: string | null; items: Carousel[] }[] {
  const withDate = items.filter((c) => c.scheduledDate).sort((a, b) =>
    (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")
  );
  const noDate = items.filter((c) => !c.scheduledDate);
  const map = new Map<string, Carousel[]>();
  for (const c of withDate) {
    const d = c.scheduledDate!;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(c);
  }
  const result: { date: string | null; items: Carousel[] }[] = [];
  for (const [date, cs] of map) result.push({ date, items: cs });
  if (noDate.length > 0) result.push({ date: null, items: noDate });
  return result;
}

function Checkbox({ checked, onClick }: { checked: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0
        ${checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 bg-background/80 hover:border-primary/60"}`}
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
  c, selected, onToggleSelect, onOpen, onContextMenu, onDragStart, onDragEnd, onDateChange,
}: {
  c: Carousel;
  selected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDateChange: (id: string, date: string | null) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col rounded-2xl border bg-card overflow-hidden transition-all cursor-pointer hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"}`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <div
        className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={onToggleSelect}
      >
        <Checkbox checked={selected} onClick={onToggleSelect} />
      </div>

      <button
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-lg bg-background/80 border backdrop-blur-sm hover:bg-background"
        onClick={onContextMenu}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      <div className="p-2 pt-8 bg-muted/20">
        <SlideThumbs slides={c.slides} />
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl font-black font-mono leading-none tracking-wide">{c.shortId ?? "—"}</span>
          <div className="flex flex-col items-end gap-1">
            {!!c.publishedAt ? <PublishedPill /> : !!c.sentAt ? <DraftPill /> : null}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug truncate">{c.name}</p>
        <div className="flex items-end justify-between gap-1">
          <div className="text-[11px] text-muted-foreground leading-snug truncate">
            {c.sentToAccountName && <span className="font-medium text-foreground">@{c.sentToAccountName}</span>}
            {c.sentToAccountName && (c.appName || c.influencerName) && " · "}
            {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
          </div>
          <DatePill date={c.scheduledDate} onChange={(d) => onDateChange(c.id, d)} />
        </div>
      </div>
    </div>
  );
}

/* ── Row item ────────────────────────────────────────────────────────── */
function CarouselRowItem({
  c, selected, onToggleSelect, onOpen, onContextMenu, onDragStart, onDragEnd, onDateChange,
}: {
  c: Carousel;
  selected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDateChange: (id: string, date: string | null) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer transition-all hover:shadow-sm active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"}`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <Checkbox checked={selected} onClick={onToggleSelect} />
      <SlideThumbs slides={c.slides} small />
      <span className="text-xl font-black font-mono tracking-wide shrink-0 w-14 leading-none">{c.shortId ?? "—"}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate leading-tight">{c.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-muted-foreground truncate">
            {c.sentToAccountName && <span className="font-medium text-foreground">@{c.sentToAccountName} · </span>}
            {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
          </p>
          <DatePill date={c.scheduledDate} onChange={(d) => onDateChange(c.id, d)} />
        </div>
      </div>
      {!!c.publishedAt ? <PublishedPill /> : !!c.sentAt ? <DraftPill /> : (
        <span className="shrink-0 text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium leading-tight">
          Pendiente
        </span>
      )}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-lg border bg-background hover:bg-muted/60 shrink-0"
        onClick={onContextMenu}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
