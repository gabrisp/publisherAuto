import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, apps, influencers, images, tiktokAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteFile, urlToStoragePath } from "@/lib/supabase";
import { now } from "@/lib/ids";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [carousel] = await db
    .select({
      id: carousels.id,
      name: carousels.name,
      shortId: carousels.shortId,
      status: carousels.status,
      videoTitle: carousels.videoTitle,
      videoDescription: carousels.videoDescription,
      videoHashtags: carousels.videoHashtags,
      zipPath: carousels.zipPath,
      sentAt: carousels.sentAt,
      createdAt: carousels.createdAt,
      appName: apps.name,
      influencerName: influencers.name,
      sentToAccountName: tiktokAccounts.name,
    })
    .from(carousels)
    .leftJoin(apps, eq(carousels.appId, apps.id))
    .leftJoin(influencers, eq(carousels.influencerId, influencers.id))
    .leftJoin(tiktokAccounts, eq(carousels.sentToAccountId, tiktokAccounts.id))
    .where(eq(carousels.id, id));

  if (!carousel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slides = await db
    .select({
      id: carouselSlides.id,
      order: carouselSlides.order,
      generatedImagePath: carouselSlides.generatedImagePath,
      texts: carouselSlides.texts,
      imageId: carouselSlides.imageId,
      imagePath: images.path,
    })
    .from(carouselSlides)
    .leftJoin(images, eq(carouselSlides.imageId, images.id))
    .where(eq(carouselSlides.carouselId, id))
    .orderBy(carouselSlides.order);

  return NextResponse.json({ ...carousel, slides });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const patch: Record<string, unknown> = { updatedAt: now() };
  if ("folderId" in body) patch.folderId = body.folderId ?? null;
  if ("name" in body) patch.name = body.name;

  const [updated] = await db
    .update(carousels)
    .set(patch)
    .where(eq(carousels.id, id))
    .returning({ id: carousels.id });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [carousel] = await db.select({ zipPath: carousels.zipPath }).from(carousels).where(eq(carousels.id, id));
  const slides = await db.select({ generatedImagePath: carouselSlides.generatedImagePath }).from(carouselSlides).where(eq(carouselSlides.carouselId, id));

  await db.delete(carousels).where(eq(carousels.id, id));

  // Eliminar archivos de Supabase Storage (best-effort)
  const urlsToDelete: string[] = [];
  if (carousel?.zipPath) urlsToDelete.push(carousel.zipPath);
  for (const s of slides) {
    if (s.generatedImagePath) urlsToDelete.push(s.generatedImagePath);
  }
  await Promise.all(
    urlsToDelete.map((url) => deleteFile(urlToStoragePath(url)).catch(() => {}))
  );

  return NextResponse.json({ ok: true });
}
