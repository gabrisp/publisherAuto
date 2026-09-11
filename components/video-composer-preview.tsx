"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Film, Loader2, Plus, Scissors, Volume2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type EditorClip = {
  id: string;
  order: number;
  clipName: string | null;
  clipPath: string | null;
  durationMs: number | null;
  trimStartMs: number;
  trimEndMs: number | null;
  volume: number;
};

type Props = {
  videoId: string;
  clips: EditorClip[];
  libraryClips: { id: string; name: string; path?: string | null; durationMs?: number | null }[];
  audioPath: string | null;
  onClipsChange: (clips: EditorClip[]) => void;
  onAddClip: (clipId: string) => Promise<void>;
  onExported: (path: string) => Promise<void>;
};

type EtroRuntime = {
  Movie: new (options: { canvas: HTMLCanvasElement; background?: string }) => EtroMovie;
  layer: {
    Video: new (options: Record<string, unknown>) => unknown;
    Audio: new (options: Record<string, unknown>) => unknown;
  };
};

type EtroMovie = {
  duration: number;
  addLayer: (layer: unknown) => EtroMovie;
  refresh: () => Promise<unknown>;
  play: (options?: { duration?: number }) => Promise<void>;
  record: (options: { frameRate: number; duration?: number; type?: string; video?: boolean; audio?: boolean }) => Promise<Blob>;
  stop: () => EtroMovie;
};

declare global {
  interface Window {
    etro?: EtroRuntime;
  }
}

const ETRO_SRC = "https://unpkg.com/etro@0.14.1/dist/etro-iife.js";
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const OUTPUT_FPS = 30;

function toSeconds(ms: number | null | undefined) {
  return Math.max(0, (ms ?? 0) / 1000);
}

function loadEtro() {
  return new Promise<EtroRuntime>((resolve, reject) => {
    if (window.etro) {
      resolve(window.etro);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ETRO_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => window.etro ? resolve(window.etro) : reject(new Error("Etro no se cargó")));
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Etro")));
      return;
    }

    const script = document.createElement("script");
    script.src = ETRO_SRC;
    script.async = true;
    script.onload = () => window.etro ? resolve(window.etro) : reject(new Error("Etro no se cargó"));
    script.onerror = () => reject(new Error("No se pudo cargar Etro"));
    document.head.appendChild(script);
  });
}

function clipDurationSeconds(clip: EditorClip) {
  const end = clip.trimEndMs ?? clip.durationMs ?? 0;
  return Math.max(0.1, toSeconds(end) - toSeconds(clip.trimStartMs));
}

function waitForMetadata(element: HTMLMediaElement) {
  return new Promise<void>((resolve) => {
    if (element.readyState >= 1) {
      resolve();
      return;
    }
    const done = () => {
      window.clearTimeout(timeout);
      element.removeEventListener("loadedmetadata", done);
      element.removeEventListener("error", done);
      resolve();
    };
    const timeout = window.setTimeout(done, 2500);
    element.addEventListener("loadedmetadata", done);
    element.addEventListener("error", done);
  });
}

async function createVideoSource(src: string) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  await waitForMetadata(video);
  return video;
}

async function createAudioSource(src: string) {
  const audio = document.createElement("audio");
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  audio.src = src;
  await waitForMetadata(audio);
  return audio;
}

export function VideoComposerPreview({ videoId, clips, libraryClips, audioPath, onClipsChange, onAddClip, onExported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const movieRef = useRef<EtroMovie | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(clips[0]?.id ?? null);
  const [addingClipId, setAddingClipId] = useState<string | null>(null);

  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + clipDurationSeconds(clip), 0),
    [clips]
  );
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? clips[0] ?? null;

  useEffect(() => {
    if (!selectedClipId && clips[0]) setSelectedClipId(clips[0].id);
    if (selectedClipId && clips.length > 0 && !clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(clips[0].id);
    }
  }, [clips, selectedClipId]);

  useEffect(() => {
    let canceled = false;

    async function boot() {
      setError(null);
      setEngineReady(false);
      movieRef.current = null;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (clips.length === 0) {
        setError("Video vacío. Añade clips desde la library.");
        return;
      }

      try {
        const etro = await loadEtro();
        if (canceled) return;

        const movie = new etro.Movie({ canvas, background: "#000000" });
        let startTime = 0;

        for (const clip of clips) {
          if (!clip.clipPath) continue;
          const duration = clipDurationSeconds(clip);
          const source = await createVideoSource(clip.clipPath);
          movie.addLayer(new etro.layer.Video({
            startTime,
            duration,
            source,
            sourceStartTime: toSeconds(clip.trimStartMs),
            destX: 0,
            destY: 0,
            destWidth: OUTPUT_WIDTH,
            destHeight: OUTPUT_HEIGHT,
            volume: clip.volume / 100,
          }));
          startTime += duration;
        }

        if (audioPath) {
          const source = await createAudioSource(audioPath);
          movie.addLayer(new etro.layer.Audio({
            startTime: 0,
            duration: Math.max(startTime, 0.1),
            source,
            volume: 1,
          }));
        }

        await movie.refresh();
        if (canceled) {
          movie.stop();
          return;
        }

        movieRef.current = movie;
        setEngineReady(true);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "No se pudo montar Etro.");
      }
    }

    boot();

    return () => {
      canceled = true;
      movieRef.current?.stop();
      movieRef.current = null;
    };
  }, [audioPath, clips]);

  async function play() {
    const movie = movieRef.current;
    if (!movie) return;
    movie.stop();
    await movie.play({ duration: Math.max(totalDuration, 0.1) });
  }

  async function exportVideo() {
    const movie = movieRef.current;
    if (!movie) return;
    setBusy(true);
    try {
      movie.stop();
      const type = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = await movie.record({
        frameRate: OUTPUT_FPS,
        duration: Math.max(totalDuration, 0.1),
        type,
        video: true,
        audio: true,
      });
      const file = new File([blob], `${videoId}.${ext}`, { type });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/video", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const { path } = await res.json();
      await onExported(path);
      toast.success("Video exportado");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo exportar el video");
    } finally {
      setBusy(false);
    }
  }

  function updateClip(id: string, patch: Partial<EditorClip>) {
    onClipsChange(clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip));
  }

  function moveClip(id: string, direction: -1 | 1) {
    const index = clips.findIndex((clip) => clip.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= clips.length) return;
    const next = [...clips];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onClipsChange(next.map((clip, order) => ({ ...clip, order })));
  }

  async function appendFromLibrary(clipId: string) {
    setAddingClipId(clipId);
    try {
      await onAddClip(clipId);
    } finally {
      setAddingClipId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-[#101216] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-white/65" />
          <span className="text-sm font-semibold">Editor de video</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">Etro</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={play} disabled={!engineReady || busy}>
            <Play className="h-4 w-4" />
            Preview
          </Button>
          <Button type="button" size="sm" onClick={exportVideo} disabled={!engineReady || busy || clips.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid min-h-[640px] lg:grid-cols-[240px_minmax(320px,1fr)_260px]">
        <aside className="border-b border-white/10 bg-black/20 p-3 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Media</p>
          <div className="space-y-2">
            {libraryClips.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => appendFromLibrary(clip.id)}
                className="group grid w-full grid-cols-[52px_minmax(0,1fr)_24px] items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.07]"
                disabled={addingClipId === clip.id}
              >
                <div className="aspect-video overflow-hidden rounded bg-black">
                  {clip.path ? <video src={clip.path} muted preload="metadata" className="h-full w-full object-cover" /> : null}
                </div>
                <span className="truncate text-xs font-medium">{clip.name}</span>
                {addingClipId === clip.id ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : <Plus className="h-4 w-4 text-white/45 group-hover:text-white" />}
              </button>
            ))}
            {libraryClips.length === 0 && <p className="rounded-md border border-dashed border-white/15 p-3 text-xs text-white/50">No hay clips en library.</p>}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col bg-[#14171d]">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="relative aspect-[9/16] h-[58vh] max-h-[720px] min-h-[420px] overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl">
              <canvas ref={canvasRef} width={OUTPUT_WIDTH} height={OUTPUT_HEIGHT} className="h-full w-full object-contain" />
              {!engineReady && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
                  {error ?? "Preparando Etro..."}
                </div>
              )}
            </div>
          </div>

          <section className="border-t border-white/10 bg-[#0b0d10] p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-white/55">
              <span>Timeline</span>
              <span>{Math.round(totalDuration)}s</span>
            </div>
            <div className="relative min-h-28 overflow-x-auto rounded-md border border-white/10 bg-[#171a21] p-3">
              <div className="mb-2 flex h-5 min-w-[720px] items-center gap-px text-[10px] text-white/35">
                {Array.from({ length: 13 }).map((_, i) => <span key={i} className="w-16 shrink-0">{i * 5}s</span>)}
              </div>
              <div className="relative min-w-[720px] border-t border-white/10 pt-3">
                <div className="mb-2 flex h-8 items-center rounded bg-white/[0.04] px-2 text-[11px] text-white/45">Audio</div>
                <div className="flex min-h-12 items-center gap-2 rounded bg-white/[0.04] p-2">
                  {clips.map((clip, index) => {
                    const selected = selectedClip?.id === clip.id;
                    const width = Math.max(90, clipDurationSeconds(clip) * 42);
                    return (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => setSelectedClipId(clip.id)}
                        className={`h-10 shrink-0 overflow-hidden rounded border px-2 text-left text-[11px] font-semibold ${selected ? "border-cyan-300 bg-cyan-500/25 text-cyan-50" : "border-indigo-300/30 bg-indigo-500/35 text-white"}`}
                        style={{ width }}
                      >
                        <span className="block truncate">{index + 1}. {clip.clipName ?? "Clip"}</span>
                        <span className="text-white/50">{clipDurationSeconds(clip).toFixed(1)}s</span>
                      </button>
                    );
                  })}
                  {clips.length === 0 && <span className="px-2 text-xs text-white/45">Arrastra o añade clips desde Media.</span>}
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="border-t border-white/10 bg-black/20 p-3 lg:border-l lg:border-t-0">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Inspector</p>
          {selectedClip ? (
            <div className="space-y-3">
              <div>
                <p className="truncate text-sm font-semibold">{selectedClip.clipName}</p>
                <p className="truncate text-xs text-white/45">{selectedClip.clipPath}</p>
              </div>
              <label className="space-y-1 text-xs text-white/60">
                <span className="inline-flex items-center gap-1"><Scissors className="h-3.5 w-3.5" /> Inicio ms</span>
                <Input type="number" min={0} value={selectedClip.trimStartMs} onChange={(e) => updateClip(selectedClip.id, { trimStartMs: Number(e.target.value) })} className="h-8 border-white/10 bg-white/5 text-white" />
              </label>
              <label className="space-y-1 text-xs text-white/60">
                <span className="inline-flex items-center gap-1"><Scissors className="h-3.5 w-3.5" /> Fin ms</span>
                <Input type="number" min={0} value={selectedClip.trimEndMs ?? ""} onChange={(e) => updateClip(selectedClip.id, { trimEndMs: e.target.value ? Number(e.target.value) : null })} className="h-8 border-white/10 bg-white/5 text-white" />
              </label>
              <label className="space-y-1 text-xs text-white/60">
                <span className="inline-flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" /> Volumen</span>
                <Input type="range" min={0} max={200} value={selectedClip.volume} onChange={(e) => updateClip(selectedClip.id, { volume: Number(e.target.value) })} className="h-8 border-white/10 bg-white/5" />
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => moveClip(selectedClip.id, -1)}>←</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => moveClip(selectedClip.id, 1)}>→</Button>
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-white/15 p-3 text-xs text-white/50">Selecciona un clip de la timeline.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
