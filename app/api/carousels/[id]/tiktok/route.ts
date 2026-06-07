import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, tiktokAccounts, images, hashtags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compositeSlide, generateIdSlide } from "@/lib/image-processor";
import { uploadCarouselAsDraft } from "@/lib/tiktok";
import { uploadFile } from "@/lib/supabase";
import { now, generateShortId } from "@/lib/ids";
import type { TextElement } from "@/db/schema";
import { newId } from "@/lib/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { accountId } = await req.json();

  let [carousel] = await db.select().from(carousels).where(eq(carousels.id, id));
  if (!carousel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Asegurar shortId
  if (!carousel.shortId) {
    const shortId = generateShortId();
    await db.update(carousels).set({ shortId }).where(eq(carousels.id, id));
    carousel = { ...carousel, shortId };
  }

  const [account] = await db
    .select()
    .from(tiktokAccounts)
    .where(eq(tiktokAccounts.id, accountId));
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

  // 1. ID slide como primera imagen (URL estable en Supabase)
  const idSlidePath = `generated/idslide_${id}.jpg`;
  const idSlideBuffer = await generateIdSlide(carousel.shortId!);
  await uploadFile(idSlidePath, idSlideBuffer, "image/jpeg");
  const idSlideUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads/${idSlidePath}`;
  imageUrls.push(idSlideUrl);

  // 2. Slides del carousel
  for (const slide of slides) {
    const texts: TextElement[] = carousel.renderText ? JSON.parse(slide.texts) : [];

    let bgPath: string | null = null;
    if (slide.imageId) {
      const [img] = await db.select().from(images).where(eq(images.id, slide.imageId));
      if (img) bgPath = img.path;
    }

    const buffer = await compositeSlide(bgPath, texts);
    const storagePath = `generated/tiktok_${id}_${newId()}_${slide.order}.jpg`;
    const publicUrl = await uploadFile(storagePath, buffer, "image/jpeg");
    imageUrls.push(publicUrl);
  }

  // 3. Hashtags como description
  const hashtagRows = await db.select().from(hashtags).orderBy(hashtags.createdAt);
  const description = hashtagRows.length > 0
    ? hashtagRows.map((h) => `#${h.tag}`).join(" ")
    : undefined;

  try {
    const { publishId, debug } = await uploadCarouselAsDraft(
      account,
      imageUrls,
      carousel.name,
      description
    );

    // 4. Guardar cuenta y fecha de envío
    await db
      .update(carousels)
      .set({ sentToAccountId: accountId, sentAt: now() })
      .where(eq(carousels.id, id));

    return NextResponse.json({
      ok: true,
      publishId,
      shortId: carousel.shortId,
      imageUrls,
      debug,
    });
  } catch (e) {
    const err = e as any;
    return NextResponse.json(
      { error: err.message, imageUrls, debug: err.debug ?? null },
      { status: 500 }
    );
  }
}
