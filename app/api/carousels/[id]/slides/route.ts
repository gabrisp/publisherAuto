import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides } from "@/db/schema";
import { eq, max } from "drizzle-orm";
import { newId, now } from "@/lib/ids";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [{ maxOrder }] = await db
    .select({ maxOrder: max(carouselSlides.order) })
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, id));

  const order = (maxOrder ?? -1) + 1;

  const [slide] = await db
    .insert(carouselSlides)
    .values({ id: newId(), carouselId: id, order, texts: "[]", createdAt: now(), updatedAt: now() })
    .returning();

  await db
    .update(carousels)
    .set({ status: "edited", updatedAt: now() })
    .where(eq(carousels.id, id));

  return NextResponse.json(slide);
}
