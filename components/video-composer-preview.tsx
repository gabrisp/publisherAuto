"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
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

type LibraryClip = {
  id: string;
  name: string;
  path?: string | null;
  durationMs?: number | null;
};

type Props = {
  videoId: string;
  clips: EditorClip[];
  libraryClips: LibraryClip[];
  audioPath: string | null;
  onClipsChange: (clips: EditorClip[]) => void;
  onAddClip: (clipId: string) => Promise<void>;
  onExported: (path: string) => Promise<void>;
};

type TwickTimelineElement = {
  id?: string;
  name?: string;
  type?: string;
  s?: number;
  e?: number;
  trimStart?: number;
  props?: { src?: string };
};

type TwickTimelineTrack = {
  elements?: TwickTimelineElement[];
};

type TwickTimeline = {
  tracks?: TwickTimelineTrack[];
};

type EtroRuntime = {
  Movie: new (options: { canvas: HTMLCanvasElement; background?: string }) => EtroMovie;
  layer: {
    Video: new (options: Record<string, unknown>) => unknown;
    Audio: new (options: Record<string, unknown>) => unknown;
  };
};

type EtroMovie = {
  addLayer: (layer: unknown) => EtroMovie;
  refresh: () => Promise<unknown>;
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

function clipDurationSeconds(clip: EditorClip) {
  const end = clip.trimEndMs ?? clip.durationMs ?? 0;
  return Math.max(0.1, toSeconds(end) - toSeconds(clip.trimStartMs));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function loadEtro() {
  return new Promise<EtroRuntime>((resolve, reject) => {
    if (window.etro) return resolve(window.etro);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ETRO_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => window.etro ? resolve(window.etro) : reject(new Error("Etro did not load")));
      existing.addEventListener("error", () => reject(new Error("Etro failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = ETRO_SRC;
    script.async = true;
    script.onload = () => window.etro ? resolve(window.etro) : reject(new Error("Etro did not load"));
    script.onerror = () => reject(new Error("Etro failed to load"));
    document.head.appendChild(script);
  });
}

function waitForMetadata(element: HTMLMediaElement) {
  return new Promise<void>((resolve) => {
    if (element.readyState >= 1) return resolve();
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

function timelineToClips(timeline: TwickTimeline, currentClips: EditorClip[], libraryClips: LibraryClip[], videoId: string) {
  const sources = new Map<string, { id: string; name: string | null; durationMs: number | null }>();

  for (const clip of currentClips) {
    if (clip.clipPath) {
      sources.set(clip.clipPath, {
        id: clip.id,
        name: clip.clipName,
        durationMs: clip.durationMs,
      });
    }
  }

  for (const clip of libraryClips) {
    if (clip.path) {
      sources.set(clip.path, {
        id: clip.id,
        name: clip.name,
        durationMs: clip.durationMs ?? null,
      });
    }
  }

  const elements = (timeline.tracks ?? [])
    .flatMap((track) => track.elements ?? [])
    .filter((element) => element.type === "video" && element.props?.src)
    .sort((a, b) => (a.s ?? 0) - (b.s ?? 0));

  return elements.map((element, index) => {
    const path = element.props?.src ?? "";
    const source = sources.get(path);
    const startMs = Math.max(0, Math.round((element.trimStart ?? 0) * 1000));
    const durationMs = Math.max(100, Math.round(((element.e ?? 0) - (element.s ?? 0)) * 1000));

    return {
      id: source?.id ?? element.id?.replace(/^e-/, "") ?? `${videoId}-${index}`,
      order: index,
      clipName: source?.name ?? element.name ?? "Clip",
      clipPath: path,
      durationMs: source?.durationMs ?? durationMs,
      trimStartMs: startMs,
      trimEndMs: startMs + durationMs,
      volume: 100,
    };
  });
}

function clipsSignature(clips: EditorClip[]) {
  return JSON.stringify(
    clips.map((clip) => ({
      id: clip.id,
      order: clip.order,
      path: clip.clipPath,
      start: clip.trimStartMs,
      end: clip.trimEndMs,
      volume: clip.volume,
    }))
  );
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

function buildTwickHtml(videoId: string, clips: EditorClip[], libraryClips: LibraryClip[]) {
  const media = libraryClips
    .filter((clip) => clip.path)
    .map((clip) => ({
      id: clip.id,
      name: clip.name,
      type: "video",
      url: clip.path,
      duration: clip.durationMs ?? 5000,
    }));

  let start = 0;
  const elements = clips
    .filter((clip) => clip.clipPath)
    .map((clip) => {
      const duration = clipDurationSeconds(clip);
      const item = {
        id: `e-${clip.id}`,
        trackId: "t-main",
        name: clip.clipName ?? "Clip",
        type: "video",
        s: start,
        e: start + duration,
        trimStart: toSeconds(clip.trimStartMs),
        mediaDuration: toSeconds(clip.durationMs),
        objectFit: "cover",
        props: { src: clip.clipPath },
      };
      start += duration;
      return item;
    });

  const initialData = {
    tracks: [
      { id: "t-main", name: "Video", type: "video", elements },
      { id: "t-audio", name: "Audio", type: "audio", elements: [] },
    ],
    version: 0,
  };

  const payload = escapeHtml(JSON.stringify({ videoId, media, initialData }));

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/@twick/video-editor@0.15.31/dist/video-editor.css" />
  <style>
    html,body,#root{margin:0;width:100%;height:100%;background:#090b0f;color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
    *{box-sizing:border-box}
    .shell{height:100%;display:flex;flex-direction:column;background:#090b0f}
    .topbar{height:46px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.1);padding:0 12px;background:#10131a}
    .brand{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}
    .tag{font-size:11px;color:#9ca3af;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:2px 7px}
    .editor{flex:1;min-height:0}
    .media-panel{height:100%;display:flex;flex-direction:column;gap:10px;padding:12px;background:#0f1117;border-right:1px solid rgba(255,255,255,.1)}
    .panel-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;font-weight:800}
    .dropzone{border:1px dashed rgba(255,255,255,.25);border-radius:8px;padding:12px;text-align:center;color:#cbd5e1;background:rgba(255,255,255,.035);font-size:12px}
    .dropzone.active{border-color:#22d3ee;background:rgba(34,211,238,.12)}
    .upload{cursor:pointer;display:inline-flex;margin-top:8px;border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:6px 9px;font-size:12px;font-weight:700;background:rgba(255,255,255,.08)}
    .asset-list{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}
    .asset{width:100%;display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;align-items:center;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.04);padding:7px;color:white;text-align:left;cursor:grab}
    .asset:active{cursor:grabbing}
    .asset video{width:64px;aspect-ratio:16/9;border-radius:5px;background:#000;object-fit:cover}
    .asset-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .asset-meta{font-size:11px;color:#94a3b8;margin-top:2px}
    .right-panel{height:100%;padding:12px;background:#0f1117;border-left:1px solid rgba(255,255,255,.1);font-size:12px;color:#cbd5e1}
    .hint{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px;background:rgba(255,255,255,.035);line-height:1.35}
    .btn{border:1px solid rgba(255,255,255,.16);border-radius:7px;padding:7px 10px;background:rgba(255,255,255,.08);color:white;font-weight:700;font-size:12px;cursor:pointer}
    .btn:hover{background:rgba(255,255,255,.14)}
    .boot-error{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#090b0f;color:#fca5a5;padding:24px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
  </style>
</head>
<body>
  <script type="application/json" id="payload">${payload}</script>
  <div id="root"></div>
  <div id="boot-error" class="boot-error"></div>
  <script>
    function showBootError(message){
      var node = document.getElementById("boot-error");
      if (node) {
        node.style.display = "flex";
        node.textContent = message;
      }
      parent.postMessage({ source: "twick-editor", type: "error", error: message }, "*");
    }
    window.addEventListener("error", function(event){ showBootError(event.message || "Twick runtime error"); });
    window.addEventListener("unhandledrejection", function(event){ showBootError(String(event.reason && event.reason.message || event.reason || "Twick promise rejection")); });
  </script>
  <script type="module">
    import React, {useMemo, useState} from "https://esm.sh/react@19.2.4";
    import {createRoot} from "https://esm.sh/react-dom@19.2.4/client";
    import VideoEditor, {TIMELINE_DROP_MEDIA_TYPE} from "https://esm.sh/@twick/video-editor@0.15.31?deps=react@19.2.4,react-dom@19.2.4";
    import {TimelineProvider, useTimelineContext} from "https://esm.sh/@twick/timeline@0.15.31?deps=react@19.2.4";
    import {LivePlayerProvider} from "https://esm.sh/@twick/live-player@0.15.31?deps=react@19.2.4,react-dom@19.2.4";

    const payload = JSON.parse(document.getElementById("payload").textContent);
    const h = React.createElement;

    function prettyMs(ms){ return ms ? Math.round(ms / 1000) + "s" : "video"; }
    function isVideo(file){ return file && file.type && file.type.startsWith("video/"); }

    function MediaPanel(){
      const [items,setItems] = useState(payload.media);
      const [active,setActive] = useState(false);
      const [uploading,setUploading] = useState(false);

      async function uploadFiles(files){
        const next = [];
        for (const file of Array.from(files || [])) {
          if (!isVideo(file)) continue;
          setUploading(true);
          try {
            const form = new FormData();
            form.append("file", file);
            form.append("name", file.name.replace(/\\.[^.]+$/, ""));
            const res = await fetch("/api/clips", { method: "POST", body: form });
            if (!res.ok) throw new Error(await res.text());
            const saved = await res.json();
            next.push({ id: saved.id, name: saved.name, type: "video", url: saved.path, duration: saved.durationMs || 5000 });
            parent.postMessage({ source: "twick-editor", type: "clip-uploaded", clip: saved }, "*");
          } catch (err) {
            parent.postMessage({ source: "twick-editor", type: "error", error: String(err && err.message || err) }, "*");
          } finally {
            setUploading(false);
          }
        }
        if (next.length) setItems((current) => [...next, ...current]);
      }

      function startDrag(e,item){
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData(TIMELINE_DROP_MEDIA_TYPE, JSON.stringify({ type: item.type, url: item.url }));
        e.dataTransfer.setData("text/plain", item.url);
      }

      return h("div",{className:"media-panel",onDragOver:e=>{e.preventDefault();setActive(true)},onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget))setActive(false)},onDrop:e=>{e.preventDefault();setActive(false);uploadFiles(e.dataTransfer.files)}},
        h("div",{className:"panel-title"},"Media"),
        h("div",{className:"dropzone " + (active ? "active" : "")},
          uploading ? "Subiendo..." : "Suelta clips desde tu ordenador",
          h("br"),
          h("label",{className:"upload"},"Importar clips",h("input",{type:"file",accept:"video/*",multiple:true,style:{display:"none"},onChange:e=>uploadFiles(e.target.files)}))
        ),
        h("div",{className:"asset-list"},
          items.map(item=>h("div",{key:item.id,className:"asset",draggable:true,onDragStart:e=>startDrag(e,item),title:"Arrastra a la timeline o al canvas"},
            h("video",{src:item.url,muted:true,preload:"metadata"}),
            h("div",null,h("div",{className:"asset-name"},item.name),h("div",{className:"asset-meta"},"Drag to timeline · ",prettyMs(item.duration)))
          ))
        )
      );
    }

    function Inspector(){
      let ctx = null;
      try { ctx = useTimelineContext(); } catch {}
      const selected = ctx && ctx.selectedItem;
      const label = selected ? (selected.getName ? selected.getName() : selected.getId()) : null;
      return h("div",{className:"right-panel"},
        h("div",{className:"panel-title"},"Inspector"),
        h("div",{className:"hint"},
          label ? h(React.Fragment,null,h("b",null,label),h("br"),"Usa la timeline para mover, recortar, hacer resize, split, zoom y reordenar tracks.") :
          "Selecciona un clip en canvas o timeline. Tambien puedes arrastrar archivos directamente desde tu ordenador a la timeline."
        )
      );
    }

    function Sync(){
      let ctx = null;
      try { ctx = useTimelineContext(); } catch {}
      React.useEffect(() => {
        if (!ctx || !ctx.editor) return;
        const data = ctx.editor.getTimelineData && ctx.editor.getTimelineData();
        parent.postMessage({ source:"twick-editor", type:"timeline", data }, "*");
      }, [ctx && ctx.changeLog]);
      return null;
    }

    function App(){
      const config = useMemo(() => ({
        videoProps: { width: 1080, height: 1920, backgroundColor: "#000000" },
        playerProps: { maxWidth: 420, maxHeight: 620, quality: 1 },
        canvasMode: true,
        canvasConfig: { enableShiftAxisLock: true, lockAspectRatio: true },
        fps: 30,
        timelineZoomConfig: { min: .25, max: 4, step: .25, default: 1 },
        timelineTickConfigs: [
          { durationThreshold: 30, majorInterval: 5, minorTicks: 5 },
          { durationThreshold: 300, majorInterval: 15, minorTicks: 5 },
          { durationThreshold: 3600, majorInterval: 60, minorTicks: 6 }
        ],
        elementColors: { video:"#6366f1", audio:"#14b8a6", image:"#f59e0b", text:"#a855f7", caption:"#22c55e", icon:"#38bdf8", emoji:"#f97316", circle:"#ec4899", rect:"#84cc16", element:"#64748b", fragment:"#111827", frameEffect:"#f43f5e", filters:"#06b6d4", transition:"#eab308", animation:"#8b5cf6" }
      }), []);

      return h("div",{className:"shell"},
        h("div",{className:"topbar"},
          h("div",{className:"brand"},"Twick Video Editor",h("span",{className:"tag"},"drag/drop timeline")),
          h("button",{className:"btn",onClick:()=>parent.postMessage({source:"twick-editor",type:"save-request"},"*")},"Guardar en proyecto")
        ),
        h("div",{className:"editor"},
          h(LivePlayerProvider,null,
            h(TimelineProvider,{contextId:payload.videoId,resolution:{width:1080,height:1920},initialData:payload.initialData,analytics:{enabled:false}},
              h(Sync,null),
              h(VideoEditor,{leftPanel:h(MediaPanel,null),rightPanel:h(Inspector,null),editorConfig:config,defaultPlayControls:true})
            )
          )
        )
      );
    }

    createRoot(document.getElementById("root")).render(h(App));
  </script>
</body>
</html>`;
}

export function VideoComposerPreview({ videoId, clips, libraryClips, audioPath, onClipsChange, onAddClip, onExported }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [exporting, setExporting] = useState(false);
  const srcDoc = useMemo(() => buildTwickHtml(videoId, clips, libraryClips), [videoId, clips, libraryClips]);

  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      const data = event.data as { source?: string; type?: string; clip?: { id?: string }; data?: TwickTimeline; error?: string };
      if (data?.source !== "twick-editor") return;
      if (data.type === "error") {
        toast.error(data.error ?? "Error en el editor", { duration: 12000 });
      }
      if (data.type === "timeline" && data.data) {
        const nextClips = timelineToClips(data.data, clips, libraryClips, videoId);
        if (clipsSignature(nextClips) !== clipsSignature(clips)) {
          onClipsChange(nextClips);
        }
      }
      if (data.type === "clip-uploaded" && data.clip?.id) {
        await onAddClip(data.clip.id);
        toast.success("Clip importado y añadido al proyecto");
      }
      if (data.type === "save-request") {
        toast.info("Timeline sincronizada. Usa Guardar arriba para persistir el video.");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [clips, libraryClips, onAddClip, onClipsChange, videoId]);

  async function exportPersistedClips() {
    if (clips.length === 0) return;
    setExporting(true);
    try {
      const etro = await loadEtro();
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const movie = new etro.Movie({ canvas, background: "#000000" });
      let startTime = 0;

      for (const clip of clips) {
        if (!clip.clipPath) continue;
        const duration = clipDurationSeconds(clip);
        movie.addLayer(new etro.layer.Video({
          startTime,
          duration,
          source: await createVideoSource(clip.clipPath),
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
        movie.addLayer(new etro.layer.Audio({
          startTime: 0,
          duration: Math.max(startTime, 0.1),
          source: await createAudioSource(audioPath),
          volume: 1,
        }));
      }

      await movie.refresh();
      const type = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = await movie.record({ frameRate: OUTPUT_FPS, duration: Math.max(startTime, 0.1), type, video: true, audio: true });
      movie.stop();

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
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <div className="min-h-0 flex-1 bg-black">
        <iframe
          ref={iframeRef}
          title="Twick video editor"
          srcDoc={srcDoc}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen; autoplay"
        />
      </div>
      <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-background px-3">
        <Button type="button" variant="outline" size="sm" onClick={() => iframeRef.current?.requestFullscreen()}>
          <ExternalLink className="h-4 w-4" />
          Pantalla completa
        </Button>
        <Button type="button" size="sm" onClick={exportPersistedClips} disabled={exporting || clips.length === 0}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar proyecto
        </Button>
      </div>
    </div>
  );
}
