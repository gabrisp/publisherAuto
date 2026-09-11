"use client";

import { useEffect, useRef, useState } from "react";
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
  const mountRef = useRef<HTMLDivElement>(null);
  const compositionRef = useRef<any>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    let composition: any;

    async function boot() {
      setError(null);
      setEngineReady(false);

      if (!mountRef.current) return;
      if (!("VideoEncoder" in window) || !("VideoDecoder" in window)) {
        setError("Este navegador no expone WebCodecs; usa el preview simple.");
        return;
      }

      try {
        const core = await import("@diffusionstudio/core");
        composition = new core.Composition({
          width: OUTPUT_WIDTH,
          height: OUTPUT_HEIGHT,
          background: "#000000",
        });

        const layer = await composition.add(new core.Layer({ mode: "SEQUENTIAL" }));

        for (const item of clips) {
          if (!item.clipPath) continue;
          const source = await core.Source.from<any>(item.clipPath);
          const clip = new core.VideoClip(source, {
            width: OUTPUT_WIDTH,
            height: OUTPUT_HEIGHT,
            position: "center",
          });
          clip.range = [
            toSeconds(item.trimStartMs),
            item.trimEndMs ? toSeconds(item.trimEndMs) : undefined,
          ];
          clip.volume = item.volume / 100;
          await layer.add(clip);
        }

        if (audioPath) {
          const source = await core.Source.from<any>(audioPath);
          const audioLayer = await composition.add(new core.Layer({ mode: "SEQUENTIAL" }));
          await audioLayer.add(new core.AudioClip(source, { delay: 0 }));
        }

        if (canceled) {
          composition.unmount();
          return;
        }

        composition.mount(mountRef.current);
        await composition.seek(0);
        compositionRef.current = composition;
        setEngineReady(true);
      } catch (e) {
        console.error(e);
        setError("No se pudo montar el preview.");
      }
    }

    boot();

    return () => {
      canceled = true;
      compositionRef.current = null;
      composition?.unmount?.();
    };
  }, [audioPath, clips]);

  async function play() {
    if (!compositionRef.current) return;
    await compositionRef.current.play(0);
  }

  async function exportVideo() {
    if (!compositionRef.current) return;
    setBusy(true);
    try {
      const core = await import("@diffusionstudio/core");
      const result = await new core.Encoder(compositionRef.current, {
        video: { fps: OUTPUT_FPS },
      }).render();
      if (result.type !== "success" || !result.data) {
        throw new Error(result.type === "error" ? result.error.message : "export canceled");
      }
      const blob = result.data;
      const file = new File([blob], `${videoId}.mp4`, { type: "video/mp4" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/video", { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      const { path } = await res.json();
      await onExported(path);
      toast.success("Video exportado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar el video");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[9/16] max-h-[68vh] overflow-hidden rounded-lg border bg-black">
        <div ref={mountRef} className="h-full w-full [&_canvas]:h-full [&_canvas]:w-full [&_canvas]:object-contain" />
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
          Preview
        </Button>
        <Button type="button" size="sm" onClick={exportVideo} disabled={!engineReady || busy || clips.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar MP4
        </Button>
      </div>
    </div>
  );
}
