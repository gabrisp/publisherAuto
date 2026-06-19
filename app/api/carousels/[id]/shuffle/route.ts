import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, images, apps, influencers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { now } from "@/lib/ids";
import { parseTags } from "@/lib/ids";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [carousel] = await db
    .select({ appId: carousels.appId, influencerId: carousels.influencerId })
    .from(carousels)
    .where(eq(carousels.id, id));

  if (!carousel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slides = await db
    .select({
      id: carouselSlides.id,
      imageId: carouselSlides.imageId,
    })
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, id))
    .orderBy(carouselSlides.order);

  const changed: string[] = [];

  for (const slide of slides) {
    if (!slide.imageId) continue;

    const [currentImg] = await db.select().from(images).where(eq(images.id, slide.imageId));
    if (!currentImg) continue;

    // Find candidates with same tag and scope
    let candidates: typeof images.$inferSelect[];
    if (currentImg.scope === "influencer" && carousel.influencerId) {
      candidates = await db.select().from(images).where(eq(images.influencerId, carousel.influencerId));
    } else if (currentImg.scope === "app" && carousel.appId) {
      candidates = await db.select().from(images).where(eq(images.appId, carousel.appId));
    } else {
      candidates = await db.select().from(images).where(eq(images.scope, "global"));
    }

    const currentTags = parseTags(currentImg.tag);
    const alternatives = candidates.filter(
      (img) => img.id !== currentImg.id &&
        currentTags.every((t) => parseTags(img.tag).includes(t))
    );

    if (alternatives.length === 0) continue;

    const picked = alternatives[Math.floor(Math.random() * alternatives.length)];

    await db
      .update(carouselSlides)
      .set({ imageId: picked.id, generatedImagePath: picked.path, updatedAt: now() })
      .where(eq(carouselSlides.id, slide.id));

    changed.push(slide.id);
  }

  return NextResponse.json({ shuffled: changed.length });
}
