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
  const body = await req.json();

  const updates: Partial<typeof carouselSlides.$inferInsert> & { updatedAt: number } = {
    updatedAt: now(),
  };

  if (body.texts !== undefined) {
    updates.texts = JSON.stringify(body.texts);
  }

  if (body.imageId !== undefined) {
    updates.imageId = body.imageId;
    // Borrar imagen generada (obsoleta tras el cambio de imagen fuente)
    updates.generatedImagePath = null;
  }

  await db
    .update(carouselSlides)
    .set(updates)
    .where(eq(carouselSlides.id, slideId));

  // Marcar carousel como editado
  await db
    .update(carousels)
    .set({ status: "edited", updatedAt: now() })
    .where(eq(carousels.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;

  await db.delete(carouselSlides).where(eq(carouselSlides.id, slideId));

  // Renumber remaining slides to keep order contiguous
  const remaining = await db
    .select()
    .from(carouselSlides)
    .where(eq(carouselSlides.carouselId, id))
    .orderBy(carouselSlides.order);

  await Promise.all(
    remaining.map((s, i) =>
      db.update(carouselSlides).set({ order: i, updatedAt: now() }).where(eq(carouselSlides.id, s.id))
    )
  );

  await db
    .update(carousels)
    .set({ status: "edited", updatedAt: now() })
    .where(eq(carousels.id, id));

  return NextResponse.json({ ok: true });
}
