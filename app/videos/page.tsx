"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Film,
  Loader2,
  Plus,
  Send,
  UserCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Video = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  hashtags: string | null;
  exportPath: string | null;
  sentAt: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  archivedAt: number | null;
  stats: string | null;
  clipCount: number;
  sentToAccountId: string | null;
  sentToAccountName: string | null;
  publisherUsername: string | null;
};

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 10_000 };

function stateLabel(video: Video) {
  if (video.archivedAt) return "Archivado";
  if (video.publishedAt) return "Publicado";
  if (video.sentAt) return "Draft";
  if (video.scheduledDate) return "Programado";
  return "Activo";
}

export default function VideosPage() {
  const { data: videos = [], mutate } = useSWR<Video[]>("/api/videos", fetcher, SWR_OPTS);
  const { data: accounts = [] } = useSWR<Account[]>("/api/tiktok/accounts", fetcher, SWR_OPTS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [videoName, setVideoName] = useState("");
  const [creating, setCreating] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<string | null>(null);

  const activeVideos = useMemo(() => videos.filter((v) => !v.publishedAt && !v.archivedAt), [videos]);
  const publishedVideos = useMemo(() => videos.filter((v) => v.publishedAt), [videos]);
  const archivedVideos = useMemo(() => videos.filter((v) => v.archivedAt), [videos]);

  async function createVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: videoName.trim(), clipIds: [] }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      toast.success("Video creado");
      window.location.href = `/videos/${id}`;
    } catch {
      toast.error("No se pudo crear el video");
    } finally {
      setCreating(false);
    }
  }

  async function patchVideo(video: Video, body: Record<string, unknown>) {
    const res = await fetch(`/api/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    await mutate();
  }

  async function applyPatch(video: Video, body: Record<string, unknown>) {
    try {
      await patchVideo(video, body);
      toast.success("Video actualizado");
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  return (
    <div className="space-y-6 pb-24 pt-4 md:pb-6 md:pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Videos montados desde clips o creados vacíos.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Crear video
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Activos" value={activeVideos.length} icon={Film} />
        <Metric label="Drafts" value={videos.filter((v) => v.sentAt && !v.publishedAt && !v.archivedAt).length} icon={Send} />
        <Metric label="Publicados" value={publishedVideos.length} icon={CheckCircle2} />
        <Metric label="Archivados" value={archivedVideos.length} icon={Archive} />
      </div>

      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {videos.map((video) => (
          <div key={video.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Link href={`/videos/${video.id}`} className="min-w-0 transition-colors hover:text-primary">
              <p className="truncate text-sm font-semibold">{video.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {video.clipCount} clip{video.clipCount !== 1 ? "s" : ""}
                {video.publisherUsername ? ` · @${video.publisherUsername}` : ""}
              </p>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <AccountPill
                video={video}
                accounts={accounts}
                open={accountMenuOpen === video.id}
                setOpen={(open) => setAccountMenuOpen(open ? video.id : null)}
                onSelect={(sentToAccountId) => applyPatch(video, { sentToAccountId })}
              />
              <DatePill value={video.scheduledDate} onChange={(scheduledDate) => applyPatch(video, { scheduledDate })} />
              <TimePill value={video.scheduledTime} onChange={(scheduledTime) => applyPatch(video, { scheduledTime })} />
              <button
                type="button"
                onClick={() => applyPatch(video, { sentAt: video.sentAt ? null : Math.floor(Date.now() / 1000) })}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50 ${video.sentAt ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : ""}`}
              >
                <Send className="h-3.5 w-3.5" />
                Draft
              </button>
              <button
                type="button"
                onClick={() => applyPatch(video, { publishedAt: video.publishedAt ? null : Math.floor(Date.now() / 1000) })}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50 ${video.publishedAt ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Publicado
              </button>
              <button
                type="button"
                onClick={() => applyPatch(video, { archivedAt: video.archivedAt ? null : Math.floor(Date.now() / 1000) })}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50 ${video.archivedAt ? "bg-muted text-muted-foreground" : ""}`}
              >
                {video.archivedAt ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {stateLabel(video)}
              </button>
            </div>
          </div>
        ))}
        {videos.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Crea el primer video.</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo video</DialogTitle>
            <DialogDescription>Puede empezar vacío y añadir clips después desde el editor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createVideo} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="video-name">Nombre</Label>
              <Input id="video-name" value={videoName} onChange={(e) => setVideoName(e.target.value)} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!videoName.trim() || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountPill({
  video,
  accounts,
  open,
  setOpen,
  onSelect,
}: {
  video: Video;
  accounts: Account[];
  open: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (accountId: string | null) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50"
      >
        <UserCircle className="h-3.5 w-3.5" />
        {video.sentToAccountName ? `@${video.sentToAccountName}` : "Cuenta"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-lg">
          <button type="button" onClick={() => { onSelect(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
            <X className="h-4 w-4" />
            Sin cuenta
          </button>
          {accounts.map((account) => (
            <button key={account.id} type="button" onClick={() => { onSelect(account.id); setOpen(false); }} className="block w-full truncate rounded-md px-2 py-2 text-left hover:bg-muted">
              @{account.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DatePill({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50">
      <Calendar className="h-3.5 w-3.5" />
      <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-[8.2rem] bg-transparent outline-none" />
    </label>
  );
}

function TimePill({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50">
      <Clock className="h-3.5 w-3.5" />
      <input type="time" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-[4.9rem] bg-transparent outline-none" />
    </label>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Film }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
