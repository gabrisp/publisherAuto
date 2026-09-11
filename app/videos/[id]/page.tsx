"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Loader2,
  Music,
  Plus,
  Send,
  UserCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VideoComposerPreview, type EditorClip } from "@/components/video-composer-preview";

type VideoDetail = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  hashtags: string | null;
  audioPath: string | null;
  exportPath: string | null;
  sentToAccountId: string | null;
  sentAt: number | null;
  publisherUserId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  archivedAt: number | null;
  stats: string | null;
  sentToAccountName: string | null;
  publisherUsername: string | null;
  clips: EditorClip[];
};

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type ClipLibraryItem = {
  id: string;
  name: string;
};

type Stats = {
  views: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const emptyStats: Stats = { views: "", likes: "", comments: "", shares: "", saves: "" };

function parseStats(raw: string | null): Stats {
  if (!raw) return emptyStats;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof Stats, number | string>>;
    return {
      views: parsed.views?.toString() ?? "",
      likes: parsed.likes?.toString() ?? "",
      comments: parsed.comments?.toString() ?? "",
      shares: parsed.shares?.toString() ?? "",
      saves: parsed.saves?.toString() ?? "",
    };
  } catch {
    return emptyStats;
  }
}

function toNumberOrZero(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, mutate } = useSWR<VideoDetail>(`/api/videos/${id}`, fetcher, { revalidateOnFocus: false });
  const { data: accounts = [] } = useSWR<Account[]>("/api/tiktok/accounts", fetcher, { revalidateOnFocus: false });
  const { data: allClips = [] } = useSWR<ClipLibraryItem[]>("/api/clips", fetcher, { revalidateOnFocus: false });
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [accountId, setAccountId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [appendClipId, setAppendClipId] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setDescription(data.description ?? "");
    setHashtags(data.hashtags ?? "");
    setAccountId(data.sentToAccountId ?? "");
    setScheduledDate(data.scheduledDate ?? "");
    setScheduledTime(data.scheduledTime ?? "");
    setAudioPath(data.audioPath);
    setClips(data.clips);
    setStats(parseStats(data.stats));
  }, [data]);

  const totalDuration = useMemo(() => {
    return clips.reduce((sum, clip) => {
      const end = clip.trimEndMs ?? clip.durationMs ?? 0;
      return sum + Math.max(0, end - clip.trimStartMs);
    }, 0);
  }, [clips]);

  function updateClip(id: string, patch: Partial<EditorClip>) {
    setClips((prev) => prev.map((clip) => clip.id === id ? { ...clip, ...patch } : clip));
  }

  async function patchVideo(body: Record<string, unknown>) {
    const res = await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    await mutate();
  }

  async function save() {
    setSaving(true);
    try {
      await patchVideo({
        name: name.trim(),
        description: description.trim() || null,
        hashtags: hashtags.trim() || null,
        sentToAccountId: accountId || null,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
        audioPath,
        clips: clips.map((clip, index) => ({
          id: clip.id,
          order: index,
          trimStartMs: clip.trimStartMs,
          trimEndMs: clip.trimEndMs,
          volume: clip.volume,
        })),
        stats: {
          views: toNumberOrZero(stats.views),
          likes: toNumberOrZero(stats.likes),
          comments: toNumberOrZero(stats.comments),
          shares: toNumberOrZero(stats.shares),
          saves: toNumberOrZero(stats.saves),
        },
      });
      toast.success("Video guardado");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAudio(file: File) {
    setUploadingAudio(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/audio", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const { path } = await res.json();
      setAudioPath(path);
      await patchVideo({ audioPath: path });
      toast.success("Audio añadido");
    } catch {
      toast.error("No se pudo subir el audio");
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  async function markDraft() {
    await patchVideo({ sentAt: data?.sentAt ? null : Math.floor(Date.now() / 1000) });
  }

  async function markPublished() {
    await patchVideo({ publishedAt: data?.publishedAt ? null : Math.floor(Date.now() / 1000) });
  }

  async function toggleArchive() {
    await patchVideo({ archivedAt: data?.archivedAt ? null : Math.floor(Date.now() / 1000) });
  }

  async function appendClip() {
    if (!appendClipId) return;
    try {
      await patchVideo({ addClipIds: [appendClipId] });
      setAppendClipId("");
      toast.success("Clip añadido");
    } catch {
      toast.error("No se pudo añadir el clip");
    }
  }

  if (!data) return <p className="pt-6 text-sm text-muted-foreground">Cargando video…</p>;

  return (
    <div className="space-y-5 pb-24 pt-4 md:pb-6 md:pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/videos">
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {clips.length} clip{clips.length !== 1 ? "s" : ""} · {Math.round(totalDuration / 1000)}s
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountPill
            value={accountId}
            label={data.sentToAccountName ? `@${data.sentToAccountName}` : "Cuenta"}
            accounts={accounts}
            open={accountMenuOpen}
            setOpen={setAccountMenuOpen}
            onSelect={async (value) => {
              setAccountId(value ?? "");
              await patchVideo({ sentToAccountId: value });
            }}
          />
          <DatePill value={scheduledDate} onChange={async (value) => { setScheduledDate(value ?? ""); await patchVideo({ scheduledDate: value }); }} />
          <TimePill value={scheduledTime} onChange={async (value) => { setScheduledTime(value ?? ""); await patchVideo({ scheduledTime: value }); }} />
          <Button type="button" variant="outline" size="sm" onClick={markDraft}>
            <Send className="h-4 w-4" />
            {data.sentAt ? "Quitar draft" : "Draft"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={markPublished}>
            <CheckCircle2 className="h-4 w-4" />
            {data.publishedAt ? "Despublicar" : "Publicado"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={toggleArchive}>
            {data.archivedAt ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {data.archivedAt ? "Desarchivar" : "Archivar"}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <VideoComposerPreview
          videoId={data.id}
          clips={clips}
          audioPath={audioPath}
          onExported={async (path) => {
            await patchVideo({ exportPath: path });
          }}
        />

        <div className="space-y-5">
          {data.exportPath && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm font-semibold">Export final</p>
              <video src={data.exportPath} controls className="aspect-[9/16] max-h-80 rounded-md bg-black" />
            </div>
          )}

          <section className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Input id="hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#gymtok #viral" />
            </div>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40 md:col-span-2"
              disabled={uploadingAudio}
            >
              {uploadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
              {audioPath ? "Cambiar audio" : "Añadir audio"}
            </button>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAudio(file);
              }}
            />
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Clips</h2>
            </div>
            <div className="grid gap-2 rounded-md bg-muted/35 p-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={appendClipId}
                onChange={(e) => setAppendClipId(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Añadir clip al final…</option>
                {allClips.map((clip) => (
                  <option key={clip.id} value={clip.id}>{clip.name}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={appendClip} disabled={!appendClipId}>
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            </div>
            <div className="space-y-2">
              {clips.map((clip, index) => (
                <div key={clip.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_92px_92px_92px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{index + 1}. {clip.clipName}</p>
                    <p className="text-xs text-muted-foreground">{clip.clipPath}</p>
                  </div>
                  <NumberField label="Inicio ms" value={clip.trimStartMs} onChange={(value) => updateClip(clip.id, { trimStartMs: value })} />
                  <NumberField label="Fin ms" value={clip.trimEndMs ?? ""} onChange={(value) => updateClip(clip.id, { trimEndMs: value || null })} />
                  <NumberField label="Vol %" value={clip.volume} onChange={(value) => updateClip(clip.id, { volume: value })} />
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-5">
            {(["views", "likes", "comments", "shares", "saves"] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`stat-${key}`} className="capitalize">{key}</Label>
                <Input
                  id={`stat-${key}`}
                  inputMode="numeric"
                  value={stats[key]}
                  onChange={(e) => setStats((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8"
      />
    </label>
  );
}

function AccountPill({
  label,
  accounts,
  open,
  setOpen,
  onSelect,
}: {
  value: string;
  label: string;
  accounts: Account[];
  open: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (accountId: string | null) => void | Promise<void>;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50"
      >
        <UserCircle className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-lg">
          <button type="button" onClick={() => { void onSelect(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
            <X className="h-4 w-4" />
            Sin cuenta
          </button>
          {accounts.map((account) => (
            <button key={account.id} type="button" onClick={() => { void onSelect(account.id); setOpen(false); }} className="block w-full truncate rounded-md px-2 py-2 text-left hover:bg-muted">
              @{account.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DatePill({ value, onChange }: { value: string | null; onChange: (value: string | null) => void | Promise<void> }) {
  return (
    <label className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50">
      <Calendar className="h-3.5 w-3.5" />
      <input type="date" value={value ?? ""} onChange={(e) => { void onChange(e.target.value || null); }} className="w-[8.2rem] bg-transparent outline-none" />
    </label>
  );
}

function TimePill({ value, onChange }: { value: string | null; onChange: (value: string | null) => void | Promise<void> }) {
  return (
    <label className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted/50">
      <Clock className="h-3.5 w-3.5" />
      <input type="time" value={value ?? ""} onChange={(e) => { void onChange(e.target.value || null); }} className="w-[4.9rem] bg-transparent outline-none" />
    </label>
  );
}
