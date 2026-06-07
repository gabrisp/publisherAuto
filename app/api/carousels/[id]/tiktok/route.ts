import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, tiktokAccounts, images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compositeSlide } from "@/lib/image-processor";
import { uploadCarouselAsDraft } from "@/lib/tiktok";
import { uploadFile } from "@/lib/supabase";
import type { TextElement } from "@/db/schema";
import { newId, generateShortId } from "@/lib/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { accountId } = await req.json();

  let [carousel] = await db.select().from(carousels).where(eq(carousels.id, id));
  if (!carousel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!carousel.shortId) {
    const shortId = generateShortId();
    await db.update(carousels).set({ shortId }).where(eq(carousels.id, id));
    carousel = { ...carousel, shortId };
  }

  const [account] = await db.select().from(tiktokAccounts).where(eq(tiktokAccounts.id, accountId));
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const slides = await db
    .select({
      id: carouselSlides.id,
      order: carouselSlides.order,
      imageId: carouselSlides.imageId,
      texts: carouselSlides.texts,
    })
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, id))
    .orderBy(carouselSlides.order);

  const imageUrls: string[] = [];

  for (const slide of slides) {
    const texts: TextElement[] = carousel.renderText ? JSON.parse(slide.texts) : [];

    let bgPath: string | null = null;
    if (slide.imageId) {
      const [img] = await db.select().from(images).where(eq(images.id, slide.imageId));
      if (img) bgPath = img.path; // URL pública de Supabase
    }

    const buffer = await compositeSlide(bgPath, texts);
    const storagePath = `generated/tiktok_${id}_${newId()}_${slide.order}.jpg`;
    const publicUrl = await uploadFile(storagePath, buffer, "image/jpeg");
    imageUrls.push(publicUrl);
  }

  try {
    const { publishId, debug } = await uploadCarouselAsDraft(account, imageUrls, carousel.name);
    return NextResponse.json({ ok: true, publishId, shortId: carousel.shortId, imageUrls, debug });
  } catch (e) {
    const err = e as any;
    return NextResponse.json({ error: err.message, imageUrls, debug: err.debug ?? null }, { status: 500 });
  }
}
