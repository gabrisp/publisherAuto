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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const { data: videos = [], mutate: mutateVideos } = useSWR<Video[]>("/api/videos", fetcher, SWR_OPTS);
  const { data: accounts = [] } = useSWR<Account[]>("/api/tiktok/accounts", fetcher, SWR_OPTS);

  const [createOpen, setCreateOpen] = useState(false);
  const [videoName, setVideoName] = useState("");
  const [creating, setCreating] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<string | null>(null);

  const activeVideos = useMemo(() => videos.filter((v) => !v.publishedAt && !v.archivedAt), [videos]);
  const publishedVideos = useMemo(() => videos.filter((v) => v.publishedAt), [videos]);
  const archivedVideos = useMemo(() => videos.filter((v) => v.archivedAt), [videos]);

  async function patchVideo(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    await mutateVideos();
  }

  async function createVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: videoName.trim(),
          clipIds: [],
        }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      toast.success("Video creado");
      setVideoName("");
      setCreateOpen(false);
      window.location.href = `/videos/${id}`;
    } catch {
      toast.error("No se pudo crear el video");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 pb-24 pt-4 md:pb-6 md:pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clips, exportación y programación de videos.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button type="button" size="sm" />}>
            <Plus className="h-4 w-4" />
            Crear video
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo video</DialogTitle>
            </DialogHeader>
            <form onSubmit={createVideo} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="video-name">Nombre</Label>
                <Input
                  id="video-name"
                  autoFocus
                  value={videoName}
                  onChange={(e) => setVideoName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={!videoName.trim() || creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crear
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Videos activos" value={activeVideos.length} icon={Film} />
        <Metric label="Publicados" value={publishedVideos.length} icon={CheckCircle2} />
        <Metric label="Archivados" value={archivedVideos.length} icon={Archive} />
      </div>

      <div className="divide-y overflow-visible rounded-lg border bg-card">
        {videos.map((video) => (
          <div key={video.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Link href={`/videos/${video.id}`} className="min-w-0 self-center">
              <p className="truncate text-sm font-semibold">{video.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {video.clipCount} clip{video.clipCount !== 1 ? "s" : ""} · {stateLabel(video)}
                {video.publisherUsername && ` · ${video.publisherUsername}`}
              </p>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <AccountPill
                video={video}
                accounts={accounts}
                open={accountMenuOpen === video.id}
                onOpenChange={(open) => setAccountMenuOpen(open ? video.id : null)}
                onChange={async (accountId) => {
                  await patchVideo(video.id, { sentToAccountId: accountId });
                  setAccountMenuOpen(null);
                  toast.success(accountId ? "Cuenta asociada" : "Cuenta quitada");
                }}
              />
              <DatePill date={video.scheduledDate} onChange={(date) => patchVideo(video.id, { scheduledDate: date })} />
              <TimePill time={video.scheduledTime} onChange={(time) => patchVideo(video.id, { scheduledTime: time })} />
              <button
                type="button"
                onClick={() => patchVideo(video.id, { sentAt: video.sentAt ? null : Math.floor(Date.now() / 1000) })}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${video.sentAt ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
              >
                <Send className="h-3 w-3" />
                Draft
              </button>
              <button
                type="button"
                onClick={() => patchVideo(video.id, { publishedAt: video.publishedAt ? null : Math.floor(Date.now() / 1000) })}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${video.publishedAt ? "bg-purple-500/15 text-purple-700 dark:text-purple-300" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
              >
                <CheckCircle2 className="h-3 w-3" />
                Publicado
              </button>
              <button
                type="button"
                onClick={() => patchVideo(video.id, { archivedAt: video.archivedAt ? null : Math.floor(Date.now() / 1000) })}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60"
              >
                {video.archivedAt ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                {video.archivedAt ? "Desarchivar" : "Archivar"}
              </button>
            </div>
          </div>
        ))}
        {videos.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Crea el primer video. Los clips se importan desde la sección Clips.
          </p>
        )}
      </div>
    </div>
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

function AccountPill({
  video,
  accounts,
  open,
  onOpenChange,
  onChange,
}: {
  video: Video;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (accountId: string | null) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <UserCircle className="h-3 w-3" />
        {video.sentToAccountName ? `@${video.sentToAccountName}` : "Cuenta"}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-44 overflow-hidden rounded-lg border bg-background py-1 shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/60"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" />
            Sin cuenta
          </button>
          {accounts.length > 0 && <div className="my-1 border-t" />}
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/60 ${video.sentToAccountId === account.id ? "font-semibold text-primary" : ""}`}
              onClick={() => onChange(account.id)}
            >
              {account.avatarUrl
                ? <img src={account.avatarUrl} alt={account.name} className="h-4 w-4 rounded-full object-cover" />
                : <UserCircle className="h-3 w-3" />}
              @{account.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DatePill({ date, onChange }: { date: string | null; onChange: (date: string | null) => void }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-full border bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
      <Calendar className="h-3 w-3" />
      {date ? new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "Día"}
      <input
        type="date"
        value={date ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function TimePill({ time, onChange }: { time: string | null; onChange: (time: string | null) => void }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-full border bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
      <Clock className="h-3 w-3" />
      {time ?? "Hora"}
      <input
        type="time"
        value={time ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
