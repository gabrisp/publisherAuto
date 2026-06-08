import sharp from "sharp";
import type { TextElement } from "@/db/schema";
import * as opentype from "opentype.js";
import { readFileSync } from "fs";
import path from "path";

// Dimensiones por defecto solo para el ID slide (fondo sintético)
const DEFAULT_W = 1080;
const DEFAULT_H = 1920;

// Carga la fuente una sola vez (Inter Bold) — nunca falla en servidor porque
// está bundleada en lib/fonts/, no depende de fuentes del sistema
let _font: opentype.Font | null = null;
function getFont(): opentype.Font {
  if (!_font) {
    const buf = readFileSync(path.join(process.cwd(), "lib/fonts/Inter-Bold.ttf"));
    // buf.buffer es el pool completo de Node — hay que slicear los bytes exactos
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    _font = opentype.parse(arrayBuf);
  }
  return _font;
}

function textToSvg(el: TextElement, canvasW: number, canvasH: number): Buffer {
  const anchor =
    el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
  const x =
    el.align === "center"
      ? el.x + el.width / 2
      : el.align === "right"
      ? el.x + el.width
      : el.x;

  const lines = wrapText(el.content, el.fontSize, el.width);
  const lineHeight = el.fontSize * 1.2;

  const textElements = lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${el.y + i * lineHeight + el.fontSize}"
          font-family="${el.fontFamily}, Arial, sans-serif"
          font-size="${el.fontSize}"
          font-weight="${el.fontWeight}"
          fill="${el.color}"
          ${el.stroke !== false ? `stroke="black" stroke-width="${el.strokeWidth ?? 1}" paint-order="stroke fill"` : ""}
          text-anchor="${anchor}">${escapeXml(line)}</text>`
    )
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
    ${textElements}
  </svg>`;

  return Buffer.from(svg);
}

function wrapText(text: string, _fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  const maxChars = Math.floor(maxWidth / (_fontSize * 0.6));

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Descarga una URL a buffer (para imágenes en Supabase Storage) */
async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function generateIdSlide(shortId: string): Promise<Buffer> {
  const CW = DEFAULT_W;   // 1080
  const CH = DEFAULT_H;   // 1920
  const fontSize = 380;

  const font = getFont();

  // Convierte el texto a paths SVG — sin texto, pura geometría, zero dependencia de fuentes
  const pathObj = font.getPath(shortId, 0, 0, fontSize);
  const bbox = pathObj.getBoundingBox();
  const textW = bbox.x2 - bbox.x1;
  const textH = bbox.y2 - bbox.y1;

  // Centrar en el canvas
  const tx = (CW - textW) / 2 - bbox.x1;
  const ty = (CH - textH) / 2 - bbox.y1;

  const centeredPath = font.getPath(shortId, tx, ty + textH, fontSize);
  centeredPath.fill = "white";
  const pathData = centeredPath.toSVG(1);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">${pathData}</svg>`;

  return sharp({
    create: { width: CW, height: CH, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 98 })
    .toBuffer();
}

/**
 * Composita una imagen de fondo con textos y devuelve el buffer JPEG.
 * bgImagePath puede ser una ruta de disco O una URL https:// (Supabase Storage).
 * Las imágenes se mantienen a su tamaño original — no se hace resize.
 */
export async function compositeSlide(
  bgImagePath: string | null,
  texts: TextElement[]
): Promise<Buffer> {
  let base: sharp.Sharp;
  let imgW = DEFAULT_W;
  let imgH = DEFAULT_H;

  if (bgImagePath) {
    const input = bgImagePath.startsWith("http")
      ? await fetchToBuffer(bgImagePath)
      : bgImagePath;
    // Leer dimensiones reales sin modificar la imagen
    const meta = await sharp(input).metadata();
    imgW = meta.width ?? DEFAULT_W;
    imgH = meta.height ?? DEFAULT_H;
    base = sharp(input); // sin resize
  } else {
    base = sharp({
      create: {
        width: imgW,
        height: imgH,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    });
  }

  const composites: sharp.OverlayOptions[] = texts.map((el) => ({
    input: textToSvg(el, imgW, imgH),
    top: 0,
    left: 0,
  }));

  return base.composite(composites).jpeg({ quality: 90 }).toBuffer();
}
