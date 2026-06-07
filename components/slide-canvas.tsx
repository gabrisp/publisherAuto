"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Transformer } from "react-konva";
import type { TextElement } from "@/db/schema";
import Konva from "konva";

type Props = {
  backgroundSrc: string | null;
  texts: TextElement[];
  onTextsChange: (texts: TextElement[]) => void;
  width?: number;
};

const CANVAS_W = 1080;
const CANVAS_H = 1920;

export function SlideCanvas({ backgroundSrc, texts, onTextsChange, width = 300 }: Props) {
  const scale = width / CANVAS_W;
  const height = CANVAS_H * scale;
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef<Map<string, Konva.Text>>(new Map());

  useEffect(() => {
    if (!backgroundSrc) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = backgroundSrc;
    img.onload = () => setBgImage(img);
  }, [backgroundSrc]);

  useEffect(() => {
    if (!transformerRef.current) return;
    const node = selected ? nodesRef.current.get(selected) : null;
    if (node) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  function handleDragEnd(id: string, e: Konva.KonvaEventObject<DragEvent>) {
    const updated = texts.map((t) =>
      t.id === id
        ? { ...t, x: Math.round(e.target.x() / scale), y: Math.round(e.target.y() / scale) }
        : t
    );
    onTextsChange(updated);
  }

  return (
    <div
      className="rounded-lg overflow-hidden border bg-muted"
      style={{ width, height }}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === "CANVAS") setSelected(null);
      }}
    >
      <Stage
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) setSelected(null);
        }}
      >
        <Layer>
          {bgImage && (
            <KonvaImage
              image={bgImage}
              width={CANVAS_W}
              height={CANVAS_H}
            />
          )}
          {!bgImage && (
            <KonvaImage
              image={undefined}
              width={CANVAS_W}
              height={CANVAS_H}
            />
          )}
        </Layer>
        <Layer>
          {texts.map((t) => (
            <Text
              key={t.id}
              ref={(node) => {
                if (node) nodesRef.current.set(t.id, node);
                else nodesRef.current.delete(t.id);
              }}
              x={t.x}
              y={t.y}
              text={t.content}
              fontSize={t.fontSize}
              fontFamily={t.fontFamily}
              fontStyle={t.fontWeight === "bold" ? "bold" : "normal"}
              fill={t.color}
              width={t.width}
              align={t.align}
              draggable
              onClick={() => setSelected(t.id)}
              onTap={() => setSelected(t.id)}
              onDragEnd={(e) => handleDragEnd(t.id, e)}
              stroke={selected === t.id ? "#3b82f6" : undefined}
              strokeWidth={selected === t.id ? 1 : 0}
            />
          ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            enabledAnchors={["middle-left", "middle-right"]}
          />
        </Layer>
      </Stage>
    </div>
  );
}
