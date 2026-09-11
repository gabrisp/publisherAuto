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

function toSeconds(ms: number | null | undefined) {
  return Math.max(0, (ms ?? 0) / 1000);
}

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const OUTPUT_FPS = 30;

export function VideoComposerPreview({ videoId, clips, audioPath, onExported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositionRef = useRef<any>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDuration = useMemo(() => {
    return clips.reduce((sum, clip) => {
      const duration = (clip.trimEndMs ?? clip.durationMs ?? 0) - clip.trimStartMs;
      return sum + Math.max(0, duration);
    }, 0);
  }, [clips]);

  useEffect(() => {
    let canceled = false;
    let movie: any;

    async function boot() {
      setError(null);
      setEngineReady(false);

      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!("MediaRecorder" in window)) {
        setError("Este navegador no permite grabar el canvas del editor.");
        return;
      }

      try {
        const { default: etro } = await import("etro");
        movie = new etro.Movie({
          canvas,
          background: new etro.Color(0, 0, 0),
        });

        let startTime = 0;
        for (const item of clips) {
          if (!item.clipPath) continue;
          const duration = Math.max(0, toSeconds((item.trimEndMs ?? item.durationMs ?? 0) - item.trimStartMs));
          if (!duration) continue;
          movie.addLayer(new etro.layer.Video({
            startTime,
            duration,
            source: item.clipPath,
            sourceStartTime: toSeconds(item.trimStartMs),
            destX: 0,
            destY: 0,
            destWidth: OUTPUT_WIDTH,
            destHeight: OUTPUT_HEIGHT,
            volume: item.volume / 100,
          }));
          startTime += duration;
        }

        if (audioPath && startTime > 0) {
          movie.addLayer(new etro.layer.Audio({
            startTime: 0,
            duration: startTime,
            source: audioPath,
          }));
        }

        if (canceled) {
          movie.stop?.();
          return;
        }

        compositionRef.current = movie;
        await movie.refresh();
        setEngineReady(true);
      } catch (e) {
        console.error(e);
        setError("No se pudo montar Etro.");
      }
    }

    boot();

    return () => {
      canceled = true;
      compositionRef.current = null;
      movie?.stop?.();
    };
  }, [audioPath, clips]);

  async function play() {
    if (!compositionRef.current) return;
    compositionRef.current.stop();
    await compositionRef.current.play({ duration: Math.max(0.1, compositionRef.current.duration || toSeconds(totalDuration)) });
  }

  async function exportVideo() {
    if (!compositionRef.current) return;
    setBusy(true);
    try {
      const type = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
      const blob = await compositionRef.current.record({
        frameRate: OUTPUT_FPS,
        duration: Math.max(0.1, compositionRef.current.duration || toSeconds(totalDuration)),
        type,
      });
      const ext = type === "video/mp4" ? "mp4" : "webm";
      const file = new File([blob], `${videoId}.${ext}`, { type });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/video", { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
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
        <canvas
          ref={canvasRef}
          width={OUTPUT_WIDTH}
          height={OUTPUT_HEIGHT}
          className="h-full w-full object-contain"
        />
        {!engineReady && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
            {error ?? "Preparando preview…"}
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
          Preview Etro
        </Button>
        <Button type="button" size="sm" onClick={exportVideo} disabled={!engineReady || busy || clips.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar
        </Button>
      </div>
    </div>
  );
}
