"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CalendarClock, CheckCircle2, Clapperboard, Film, Loader2, Plus, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Clip = {
  id: string;
  name: string;
  path: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: number;
};

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
  stats: string | null;
  clipCount: number;
  sentToAccountName: string | null;
  mobileDeviceName: string | null;
  publisherUsername: string | null;
};

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
  mobileDeviceId: string | null;
  mobileDeviceName: string | null;
};

type MobileDevice = { id: string; name: string; notes: string | null };

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 10_000 };

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function stateLabel(video: Video) {
  if (video.publishedAt) return "Publicado";
  if (video.sentAt) return "Draft";
  if (video.scheduledDate) return "Programado";
  return "Activo";
}

async function readVideoMeta(file: File) {
  return new Promise<{ durationMs: number | null; width: number | null; height: number | null }>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ durationMs: null, width: null, height: null });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}

export default function VideosPage() {
  const { data: videos = [], mutate: mutateVideos } = useSWR<Video[]>("/api/videos", fetcher, SWR_OPTS);
  const { data: clips = [], mutate: mutateClips } = useSWR<Clip[]>("/api/clips", fetcher, SWR_OPTS);
  const { data: accounts = [], mutate: mutateAccounts } = useSWR<Account[]>("/api/tiktok/accounts", fetcher, SWR_OPTS);
  const { data: devices = [], mutate: mutateDevices } = useSWR<MobileDevice[]>("/api/mobile-devices", fetcher, SWR_OPTS);

  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [videoName, setVideoName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeVideos = useMemo(() => videos.filter((v) => !v.publishedAt), [videos]);
  const publishedVideos = useMemo(() => videos.filter((v) => v.publishedAt), [videos]);

  function toggleClip(id: string) {
    setSelectedClips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function uploadClip(file: File) {
    setUploading(true);
    try {
      const meta = await readVideoMeta(file);
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.[^.]+$/, ""));
      if (meta.durationMs) form.append("durationMs", String(meta.durationMs));
      if (meta.width) form.append("width", String(meta.width));
      if (meta.height) form.append("height", String(meta.height));
      const res = await fetch("/api/clips", { method: "POST", body: form });
      if (!res.ok) {
        const raw = await res.text();
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          throw new Error(parsed.error ?? raw);
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(raw);
          throw e;
        }
      }
      toast.success("Clip subido");
      await mutateClips();
    } catch (e) {
      const rawError = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(rawError, { duration: 12000 });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoName.trim() || selectedClips.size === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: videoName.trim(),
          clipIds: Array.from(selectedClips),
          sentToAccountId: accountId || null,
        }),
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

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceName.trim()) return;
    const res = await fetch("/api/mobile-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deviceName.trim() }),
    });
    if (res.ok) {
      toast.success("Móvil añadido");
      setDeviceName("");
      mutateDevices();
    } else {
      toast.error("No se pudo añadir el móvil");
    }
  }

  async function setAccountDevice(account: Account, mobileDeviceId: string) {
    const res = await fetch(`/api/tiktok/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileDeviceId: mobileDeviceId || null }),
    });
    if (res.ok) {
      toast.success("Cuenta actualizada");
      mutateAccounts();
    } else {
      toast.error("No se pudo actualizar la cuenta");
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
        <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir clip
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadClip(file);
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Videos activos" value={activeVideos.length} icon={Film} />
        <Metric label="Clips" value={clips.length} icon={Clapperboard} />
        <Metric label="Publicados" value={publishedVideos.length} icon={CheckCircle2} />
        <Metric label="Móviles" value={devices.length} icon={Smartphone} />
      </div>

      <Tabs defaultValue="videos">
        <TabsList>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="clips">Clips</TabsTrigger>
          <TabsTrigger value="devices">Móviles</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-4 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={createVideo} className="space-y-4 rounded-lg border bg-card p-4">
            <div>
              <h2 className="text-sm font-semibold">Crear video</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Desde un clip único o varios clips seleccionados.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-name">Nombre</Label>
              <Input id="video-name" value={videoName} onChange={(e) => setVideoName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-account">Cuenta</Label>
              <select
                id="video-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Sin cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    @{account.name}{account.mobileDeviceName ? ` · ${account.mobileDeviceName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {selectedClips.size} clip{selectedClips.size !== 1 ? "s" : ""} seleccionado{selectedClips.size !== 1 ? "s" : ""}
            </div>
            <Button type="submit" className="w-full" disabled={!videoName.trim() || selectedClips.size === 0 || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear video
            </Button>
          </form>

          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {videos.map((video) => (
              <Link key={video.id} href={`/videos/${video.id}`} className="grid gap-2 px-4 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_160px_120px]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{video.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {video.clipCount} clip{video.clipCount !== 1 ? "s" : ""}
                    {video.sentToAccountName && ` · @${video.sentToAccountName}`}
                    {video.mobileDeviceName && ` · ${video.mobileDeviceName}`}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {video.scheduledDate ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {video.scheduledDate}{video.scheduledTime ? ` · ${video.scheduledTime}` : ""}
                    </span>
                  ) : "Sin fecha"}
                </div>
                <div className="text-xs font-semibold">{stateLabel(video)}</div>
              </Link>
            ))}
            {videos.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Sube clips y crea el primer video.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="clips" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clips.map((clip) => {
              const selected = selectedClips.has(clip.id);
              return (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => toggleClip(clip.id)}
                  className={`overflow-hidden rounded-lg border bg-card text-left transition-colors hover:bg-muted/30 ${selected ? "ring-2 ring-primary" : ""}`}
                >
                  <video src={clip.path} className="aspect-video w-full bg-black object-cover" muted preload="metadata" />
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-semibold">{clip.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(clip.durationMs)}
                      {clip.width && clip.height ? ` · ${clip.width}×${clip.height}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
            {clips.length === 0 && (
              <p className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
                Todavía no hay clips.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="devices" className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <form onSubmit={createDevice} className="space-y-3 rounded-lg border bg-card p-4">
            <Label htmlFor="device-name">Nuevo móvil</Label>
            <Input id="device-name" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="iPhone cocina, Samsung 2…" />
            <Button type="submit" size="sm" disabled={!deviceName.trim()}>
              <Plus className="h-4 w-4" />
              Añadir móvil
            </Button>
          </form>

          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">@{account.name}</p>
                  <p className="text-xs text-muted-foreground">{account.mobileDeviceName ?? "Sin móvil asociado"}</p>
                </div>
                <select
                  value={account.mobileDeviceId ?? ""}
                  onChange={(e) => setAccountDevice(account, e.target.value)}
                  className="h-8 rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="">Sin móvil</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>{device.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
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
