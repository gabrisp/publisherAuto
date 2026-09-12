"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Loader2,
  Music,
  Send,
  UserCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  path: string;
  durationMs: number | null;
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

  async function appendClip(clipId: string) {
    try {
      await patchVideo({ addClipIds: [clipId] });
      toast.success("Clip añadido");
    } catch {
      toast.error("No se pudo añadir el clip");
    }
  }

  if (!data) return <p className="pt-6 text-sm text-muted-foreground">Cargando video…</p>;

  return (
    <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-background">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link href="/videos">
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs font-semibold" />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {clips.length} clip{clips.length !== 1 ? "s" : ""} · {Math.round(totalDuration / 1000)}s
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            Draft
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={markPublished}>
            <CheckCircle2 className="h-4 w-4" />
            Publicado
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={toggleArchive}>
            {data.archivedAt ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            Archivo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => audioInputRef.current?.click()} disabled={uploadingAudio}>
            {uploadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
            Audio
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
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
      </div>

      <main className="min-h-0 flex-1 bg-black">
        <VideoComposerPreview
          videoId={data.id}
          clips={clips}
          libraryClips={allClips}
          audioPath={audioPath}
          onClipsChange={setClips}
          onAddClip={appendClip}
          onExported={async (path) => {
            await patchVideo({ exportPath: path });
          }}
        />
      </main>
    </div>
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
