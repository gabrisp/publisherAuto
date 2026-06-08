import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, tiktokAccounts, images, hashtags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateIdSlide } from "@/lib/image-processor";
import { uploadCarouselAsDraft } from "@/lib/tiktok";
import { uploadFile } from "@/lib/supabase";
import { now, generateShortId } from "@/lib/ids";

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

  // Slides con sus URLs originales — sin compositar
  const slides = await db
    .select({
      id: carouselSlides.id,
      order: carouselSlides.order,
      imagePath: images.path,
    })
    .from(carouselSlides)
    .leftJoin(images, eq(carouselSlides.imageId, images.id))
    .where(eq(carouselSlides.carouselId, id))
    .orderBy(carouselSlides.order);

  const imageUrls: string[] = [];

  try {
    // 1. ID slide como primera imagen (URL estable en Supabase)
    const idSlidePath = `generated/idslide_${id}.jpg`;
    const idSlideBuffer = await generateIdSlide(carousel.shortId!);
    const idSlideUrl = await uploadFile(idSlidePath, idSlideBuffer, "image/jpeg");
    imageUrls.push(idSlideUrl);

    // 2. Imágenes originales directamente (sin ningún procesado)
    for (const slide of slides) {
      if (slide.imagePath) imageUrls.push(slide.imagePath);
    }

    // 3. Hashtags como description (tabla puede no existir → ignorar)
    let description: string | undefined;
    try {
      const hashtagRows = await db.select().from(hashtags).orderBy(hashtags.createdAt);
      if (hashtagRows.length > 0) {
        const shuffled = [...hashtagRows].sort(() => Math.random() - 0.5).slice(0, 5);
        description = shuffled.map((h) => `#${h.tag}`).join(" ");
      }
    } catch {
      // tabla hashtags no existe o query falla — continuar sin description
    }

    // 4. Subir a TikTok
    const { publishId, debug } = await uploadCarouselAsDraft(
      account,
      imageUrls,
      carousel.name,
      description
    );

    // Guardar cuenta y fecha de envío
    await db
      .update(carousels)
      .set({ sentToAccountId: accountId, sentAt: now() })
      .where(eq(carousels.id, id));

    return NextResponse.json({ ok: true, publishId, shortId: carousel.shortId, imageUrls, debug });
  } catch (e) {
    const err = e as any;
    return NextResponse.json(
      { error: err.message ?? String(err), imageUrls, debug: err.debug ?? null },
      { status: 500 }
    );
  }
}
