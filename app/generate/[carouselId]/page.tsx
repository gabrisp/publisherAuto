"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Download, Zap, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { TextElement } from "@/db/schema";

// React-Konva requires browser — disable SSR
const SlideCanvas = dynamic(
  () => import("@/components/slide-canvas").then((m) => m.SlideCanvas),
  { ssr: false }
);

type Slide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
  texts: string;
};

type CarouselDetail = {
  id: string;
  name: string;
  status: string;
  zipPath: string | null;
  appName: string | null;
  influencerName: string | null;
  slides: Slide[];
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  generated: "default",
  edited: "outline",
};

export default function CarouselEditorPage() {
  const { carouselId } = useParams<{ carouselId: string }>();
  const [carousel, setCarousel] = useState<CarouselDetail | null>(null);
  const [slideTexts, setSlideTexts] = useState<Record<string, TextElement[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    const res = await fetch(`/api/carousels/${carouselId}`);
    if (!res.ok) return;
    const data: CarouselDetail = await res.json();
    setCarousel(data);
    const textsMap: Record<string, TextElement[]> = {};
    for (const s of data.slides) {
      textsMap[s.id] = JSON.parse(s.texts);
    }
    setSlideTexts(textsMap);
  }

  useEffect(() => { load(); }, [carouselId]);

  async function handleSaveSlide(slideId: string) {
    setSaving(slideId);
    try {
      const res = await fetch(
        `/api/carousels/${carouselId}/slides/${slideId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: slideTexts[slideId] }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success("Slide saved");
      load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/carousels/${carouselId}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Carousel generated!");
      load();
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function updateText(slideId: string, textId: string, field: keyof TextElement, value: string | number) {
    setSlideTexts((prev) => ({
      ...prev,
      [slideId]: (prev[slideId] ?? []).map((t) =>
        t.id === textId ? { ...t, [field]: value } : t
      ),
    }));
  }

  if (!carousel) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/generate">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{carousel.name}</h1>
            <p className="text-xs text-muted-foreground">
              {[carousel.influencerName, carousel.appName].filter(Boolean).join(" × ")}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[carousel.status]}>{carousel.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={generating}>
            <Zap className="h-4 w-4 mr-1" />
            {generating ? "Generating…" : "Generate ZIP"}
          </Button>
          {carousel.zipPath && (
            <a href={`/api/carousels/${carouselId}/download`}>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-1" /> Download ZIP
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {carousel.slides.map((slide) => {
          const texts = slideTexts[slide.id] ?? [];
          const bgSrc = slide.generatedImagePath ?? slide.imagePath;

          return (
            <div key={slide.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Slide {slide.order + 1}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSaveSlide(slide.id)}
                  disabled={saving === slide.id}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving === slide.id ? "Saving…" : "Save"}
                </Button>
              </div>

              <SlideCanvas
                backgroundSrc={bgSrc}
                texts={texts}
                onTextsChange={(updated) =>
                  setSlideTexts((prev) => ({ ...prev, [slide.id]: updated }))
                }
                width={280}
              />

              {/* Text element editors */}
              <div className="space-y-2">
                {texts.map((t) => (
                  <div key={t.id} className="rounded-md border p-2 space-y-2 text-xs">
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <Label className="text-[10px]">Content</Label>
                        <Input
                          value={t.content}
                          onChange={(e) =>
                            updateText(slide.id, t.id, "content", e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="w-16">
                        <Label className="text-[10px]">Size</Label>
                        <Input
                          type="number"
                          value={t.fontSize}
                          onChange={(e) =>
                            updateText(slide.id, t.id, "fontSize", Number(e.target.value))
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <Label className="text-[10px]">Color</Label>
                        <div className="flex gap-1">
                          <input
                            type="color"
                            value={t.color}
                            onChange={(e) =>
                              updateText(slide.id, t.id, "color", e.target.value)
                            }
                            className="h-7 w-8 rounded border cursor-pointer"
                          />
                          <Input
                            value={t.color}
                            onChange={(e) =>
                              updateText(slide.id, t.id, "color", e.target.value)
                            }
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div className="w-24">
                        <Label className="text-[10px]">X / Y</Label>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          {t.x}, {t.y}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
