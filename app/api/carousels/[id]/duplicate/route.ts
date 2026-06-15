import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId, now, generateShortId } from "@/lib/ids";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [source] = await db.select().from(carousels).where(eq(carousels.id, id));
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slides = await db
    .select()
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, id))
    .orderBy(carouselSlides.order);

  const newCarouselId = newId();
  const ts = now();

  await db.insert(carousels).values({
    ...source,
    id: newCarouselId,
    name: `${source.name} (copia)`,
    shortId: generateShortId(),
    status: "draft",
    sentAt: null,
    sentToAccountId: null,
    zipPath: null,
    createdAt: ts,
    updatedAt: ts,
  });

  if (slides.length > 0) {
    await db.insert(carouselSlides).values(
      slides.map((s) => ({
        ...s,
        id: newId(),
        carouselId: newCarouselId,
        generatedImagePath: null,
        createdAt: ts,
        updatedAt: ts,
      }))
    );
  }

  return NextResponse.json({ id: newCarouselId }, { status: 201 });
}
