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

export async function generateIdSlide(shortId: string): Promise<Buffer> {
  const w = DEFAULT_W;
  const h = DEFAULT_H;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="540" y="1050"
      font-family="Arial, sans-serif"
      font-size="300"
      font-weight="bold"
      fill="white"
      text-anchor="middle">${escapeXml(shortId)}</text>
    <text x="540" y="1200"
      font-family="Arial, sans-serif"
      font-size="48"
      fill="#888888"
      text-anchor="middle">PlataformaAUTO</text>
  </svg>`;

  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 17, g: 17, b: 17 },
    },
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
