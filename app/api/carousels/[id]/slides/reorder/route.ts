import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { now } from "@/lib/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: { id: string; order: number; texts: string }[] = await req.json();

  await Promise.all(
    body.map((s) =>
      db
        .update(carouselSlides)
        .set({ order: s.order, texts: s.texts, updatedAt: now() })
        .where(eq(carouselSlides.id, s.id))
    )
  );

  await db
    .update(carousels)
    .set({ status: "edited", updatedAt: now() })
    .where(eq(carousels.id, id));

  return NextResponse.json({ ok: true });
}
