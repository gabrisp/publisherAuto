import sharp from "sharp";
import type { TextElement } from "@/db/schema";

// Dimensiones por defecto solo para el ID slide (fondo sintético)
const DEFAULT_W = 1080;
const DEFAULT_H = 1920;

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

/**
 * 7-segment display digit as SVG <rect> elements.
 * Zero font dependency — librsvg renders geometry without needing system fonts.
 */
function sevenSegDigit(d: number, ox: number, oy: number): string {
  const W = 180;   // digit width
  const H = 300;   // digit height
  const T = 32;    // segment thickness
  const G = 6;     // gap at each segment tip
  const R = 10;    // corner radius

  // 7 segment rectangles (local coords)
  const seg: Record<string, string> = {
    a: `<rect x="${T + G}" y="${G}" width="${W - 2 * T - 2 * G}" height="${T}" rx="${R}"/>`,                          // top
    b: `<rect x="${W - T}" y="${T + G}" width="${T}" height="${H / 2 - T - 2 * G}" rx="${R}"/>`,                      // top-right
    c: `<rect x="${W - T}" y="${H / 2 + G}" width="${T}" height="${H / 2 - T - 2 * G}" rx="${R}"/>`,                  // bottom-right
    d: `<rect x="${T + G}" y="${H - T - G}" width="${W - 2 * T - 2 * G}" height="${T}" rx="${R}"/>`,                  // bottom
    e: `<rect x="0" y="${H / 2 + G}" width="${T}" height="${H / 2 - T - 2 * G}" rx="${R}"/>`,                        // bottom-left
    f: `<rect x="0" y="${T + G}" width="${T}" height="${H / 2 - T - 2 * G}" rx="${R}"/>`,                            // top-left
    g: `<rect x="${T + G}" y="${(H - T) / 2}" width="${W - 2 * T - 2 * G}" height="${T}" rx="${R}"/>`,               // middle
  };

  const on: Record<number, string[]> = {
    0: ["a","b","c","d","e","f"],
    1: ["b","c"],
    2: ["a","b","d","e","g"],
    3: ["a","b","c","d","g"],
    4: ["b","c","f","g"],
    5: ["a","c","d","f","g"],
    6: ["a","c","d","e","f","g"],
    7: ["a","b","c"],
    8: ["a","b","c","d","e","f","g"],
    9: ["a","b","c","d","f","g"],
  };

  const rects = on[d].map((s) => seg[s]).join("");
  return `<g transform="translate(${ox},${oy})" fill="white">${rects}</g>`;
}

export async function generateIdSlide(shortId: string): Promise<Buffer> {
  const CW = DEFAULT_W;   // 1080
  const CH = DEFAULT_H;   // 1920

  const DW = 180;  // digit bounding box width
  const DH = 300;  // digit bounding box height
  const GAP = 28;  // gap between digits

  const digits = shortId.padStart(4, "0").split("").map(Number);
  const totalW = 4 * DW + 3 * GAP;
  const startX = Math.floor((CW - totalW) / 2);   // ~138
  const startY = Math.floor((CH - DH) / 2);        // ~810

  const digitElems = digits
    .map((d, i) => sevenSegDigit(d, startX + i * (DW + GAP), startY))
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">${digitElems}</svg>`;

  return sharp({
    create: { width: CW, height: CH, channels: 3, background: { r: 17, g: 17, b: 17 } },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
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
