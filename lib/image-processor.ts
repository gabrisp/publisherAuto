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
 * Dibuja un dígito como display de 7 segmentos usando solo <rect>.
 * Sin dependencia de fuentes del sistema — funciona en cualquier servidor.
 */
function sevenSegDigit(ch: string, x: number, y: number, dw: number, dh: number, t: number): string {
  const midH = Math.floor((dh - 3 * t) / 2);
  const seg = {
    a: `<rect x="${x + t}" y="${y}" width="${dw - 2 * t}" height="${t}"/>`,                  // top
    b: `<rect x="${x + dw - t}" y="${y + t}" width="${t}" height="${midH}"/>`,               // top-right
    c: `<rect x="${x + dw - t}" y="${y + t + midH + t}" width="${t}" height="${midH}"/>`,    // bottom-right
    d: `<rect x="${x + t}" y="${y + dh - t}" width="${dw - 2 * t}" height="${t}"/>`,         // bottom
    e: `<rect x="${x}" y="${y + t + midH + t}" width="${t}" height="${midH}"/>`,             // bottom-left
    f: `<rect x="${x}" y="${y + t}" width="${t}" height="${midH}"/>`,                        // top-left
    g: `<rect x="${x + t}" y="${y + t + midH}" width="${dw - 2 * t}" height="${t}"/>`,       // middle
  };
  const ON: Record<string, (keyof typeof seg)[]> = {
    "0": ["a","b","c","d","e","f"],
    "1": ["b","c"],
    "2": ["a","b","d","e","g"],
    "3": ["a","b","c","d","g"],
    "4": ["b","c","f","g"],
    "5": ["a","c","d","f","g"],
    "6": ["a","c","d","e","f","g"],
    "7": ["a","b","c"],
    "8": ["a","b","c","d","e","f","g"],
    "9": ["a","b","c","d","f","g"],
  };
  return (ON[ch] ?? ON["8"]).map((s) => seg[s]).join("");
}

export async function generateIdSlide(shortId: string): Promise<Buffer> {
  const CW = DEFAULT_W;   // 1080
  const CH = DEFAULT_H;   // 1920

  // Dimensiones de cada dígito
  const DW = 200, DH = 380, T = 36, GAP = 28;
  const chars = shortId.slice(0, 6);
  const totalW = chars.length * DW + (chars.length - 1) * GAP;
  const startX = Math.floor((CW - totalW) / 2);
  const startY = Math.floor((CH - DH) / 2);

  let rects = "";
  for (let i = 0; i < chars.length; i++) {
    rects += sevenSegDigit(chars[i], startX + i * (DW + GAP), startY, DW, DH, T);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
    <g fill="white">${rects}</g>
  </svg>`;

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
