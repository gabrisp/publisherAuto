import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { now } from "@/lib/ids";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  const { texts } = await req.json();

  await db
    .update(carouselSlides)
    .set({ texts: JSON.stringify(texts), updatedAt: now() })
    .where(eq(carouselSlides.id, slideId));

  // Mark carousel as edited
  await db
    .update(carousels)
    .set({ status: "edited", updatedAt: now() })
    .where(eq(carousels.id, id));

  return NextResponse.json({ ok: true });
}
