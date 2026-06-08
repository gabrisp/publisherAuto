import { db } from "@/db";
import {
  carousels,
  carouselSlides,
  images,
  apps,
  influencers,
} from "@/db/schema";
import type { TextElement } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId, now, generateShortId, parseTags } from "@/lib/ids";
import { compositeSlide, generateIdSlide } from "@/lib/image-processor";
import { uploadFile, deleteFile, urlToStoragePath } from "@/lib/supabase";
import JSZip from "jszip";

type SlideJson = {
  id?: string;
  image: {
    scope: "influencer" | "app" | "global";
    tags?: string[];
    tag?: string;
  };
  texts: TextElement[];
};

type CarouselJson = {
  name: string;
  app: string;
  influencer: string;
  slides: SlideJson[];
};

type BatchJson = {
  version: string;
  carousels: CarouselJson[];
};

export async function processBatchJson(jsonStr: string): Promise<string[]> {
  const batch: BatchJson = JSON.parse(jsonStr);
  const created: string[] = [];
  for (const c of batch.carousels) {
    const id = await processCarouselJson(c, jsonStr);
    created.push(id);
  }
  return created;
}

async function processCarouselJson(
  c: CarouselJson,
  rawJson: string
): Promise<string> {
  const [app] = await db.select().from(apps).where(eq(apps.slug, c.app));
  const [influencer] = await db
    .select()
    .from(influencers)
    .where(eq(influencers.slug, c.influencer));

  const carouselId = newId();
  const ts = now();

  await db.insert(carousels).values({
    id: carouselId,
    name: c.name,
    shortId: generateShortId(),
    appId: app?.id ?? null,
    influencerId: influencer?.id ?? null,
    status: "draft",
    jsonSource: rawJson,
    zipPath: null,
    createdAt: ts,
    updatedAt: ts,
  });

  for (let i = 0; i < c.slides.length; i++) {
    const s = c.slides[i];
    const tagList: string[] =
      s.image.tags && s.image.tags.length > 0
        ? s.image.tags
        : s.image.tag
          ? [s.image.tag]
          : [];

    const image = await resolveImage(
      s.image.scope,
      tagList,
      app?.id ?? null,
      influencer?.id ?? null
    );

    await db.insert(carouselSlides).values({
      id: newId(),
      carouselId,
      order: i,
      imageId: image?.id ?? null,
      generatedImagePath: null,
      texts: JSON.stringify(s.texts ?? []),
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return carouselId;
}

async function resolveImage(
  scope: string,
  tags: string[],
  appId: string | null,
  influencerId: string | null
) {
  const tagsLower = tags.map((t) => t.toLowerCase()).filter(Boolean);

  let candidates: typeof images.$inferSelect[];

  if (scope === "influencer" && influencerId) {
    candidates = await db.select().from(images).where(eq(images.influencerId, influencerId));
  } else if (scope === "app" && appId) {
    candidates = await db.select().from(images).where(eq(images.appId, appId));
  } else {
    candidates = await db.select().from(images).where(eq(images.scope, "global"));
  }

  const matches = candidates.filter((img) => {
    const imgTags = parseTags(img.tag);
    return tagsLower.every((t) => imgTags.includes(t));
  });

  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

export async function generateCarouselZip(carouselId: string): Promise<void> {
  const [carousel] = await db
    .select()
    .from(carousels)
    .where(eq(carousels.id, carouselId));
  if (!carousel) throw new Error("Carousel not found");

  // 1. Borrar archivos antiguos de Supabase Storage (best-effort)
  const oldSlides = await db
    .select({ generatedImagePath: carouselSlides.generatedImagePath })
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, carouselId));

  const pathsToDelete: string[] = [];
  if (carousel.zipPath) pathsToDelete.push(urlToStoragePath(carousel.zipPath));
  pathsToDelete.push(`generated/idslide_${carouselId}.jpg`); // ID slide anterior
  for (const s of oldSlides) {
    if (s.generatedImagePath) pathsToDelete.push(urlToStoragePath(s.generatedImagePath));
  }
  await Promise.all(pathsToDelete.map((p) => deleteFile(p).catch(() => {})));

  // 2. Generar nuevos slides
  const slides = await db
    .select()
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, carouselId))
    .orderBy(carouselSlides.order);

  const zip = new JSZip();

  for (const slide of slides) {
    // Texto guardado en DB solo para copiar/pegar — nunca se renderiza sobre la imagen
    const texts: TextElement[] = [];

    const slideFilename = `slide_${String(slide.order + 1).padStart(2, "0")}.jpg`;
    const storagePath = `generated/${carouselId}_${slideFilename}`;

    let imgPath: string | null = null;
    if (slide.imageId) {
      const [img] = await db.select().from(images).where(eq(images.id, slide.imageId));
      if (img) imgPath = img.path; // URL pública de Supabase
    }

    const buffer = await compositeSlide(imgPath, texts);
    const publicUrl = await uploadFile(storagePath, buffer, "image/jpeg");
    zip.file(`${String(slide.order + 1).padStart(2, "0")}.jpg`, buffer);

    await db
      .update(carouselSlides)
      .set({ generatedImagePath: publicUrl, updatedAt: now() })
      .where(eq(carouselSlides.id, slide.id));
  }

  // 3. Generar y subir ID slide (URL estable en Supabase, disponible para TikTok)
  const idSlideBuffer = await generateIdSlide(carousel.shortId ?? carouselId.slice(0, 4));
  await uploadFile(`generated/idslide_${carouselId}.jpg`, idSlideBuffer, "image/jpeg");

  // 4. Construir y subir ZIP
  const zipFilename = `${carouselId}.zip`;
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipUrl = await uploadFile(`generated/${zipFilename}`, zipBuffer, "application/zip");

  await db
    .update(carousels)
    .set({
      zipPath: zipUrl,
      status: "generated",
      updatedAt: now(),
    })
    .where(eq(carousels.id, carouselId));
}
