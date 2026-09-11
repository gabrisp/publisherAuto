"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  audioPath: string | null;
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

export function VideoComposerPreview({ videoId, clips, audioPath, onExported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const movieRef = useRef<EtroMovie | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + clipDurationSeconds(clip), 0),
    [clips]
  );

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

  return (
    <div className="space-y-3">
      <div className="relative aspect-[9/16] max-h-[68vh] overflow-hidden rounded-lg border bg-black">
        <canvas ref={canvasRef} width={OUTPUT_WIDTH} height={OUTPUT_HEIGHT} className="h-full w-full object-contain" />
        {!engineReady && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
            {error ?? "Preparando Etro..."}
          </div>
        )}
      </div>

      {!engineReady && clips[0]?.clipPath && (
        <video
          src={clips[0].clipPath}
          controls
          className="aspect-[9/16] max-h-80 w-full rounded-lg border bg-black object-contain"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={play} disabled={!engineReady || busy}>
          <Play className="h-4 w-4" />
          Preview
        </Button>
        <Button type="button" size="sm" onClick={exportVideo} disabled={!engineReady || busy || clips.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar
        </Button>
      </div>
    </div>
  );
}
