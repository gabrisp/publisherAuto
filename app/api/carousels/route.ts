import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, apps, influencers, images, tiktokAccounts, publisherUsers } from "@/db/schema";
import { and, eq, count, isNull, isNotNull } from "drizzle-orm";
import { processBatchJson } from "@/lib/carousel-generator";
import { newId, now, generateShortId } from "@/lib/ids";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listOnly = searchParams.get("list") === "1";
  const archivedOnly = searchParams.get("archived") === "1";
  const publishedOnly = searchParams.get("published") === "1";

  const appId = searchParams.get("appId");
  const influencerId = searchParams.get("influencerId");
  const sentToAccountId = searchParams.get("sentToAccountId");

  // published=1 shows all published regardless of archived status
  const archiveCondition = publishedOnly
    ? isNotNull(carousels.publishedAt)
    : archivedOnly ? isNotNull(carousels.archivedAt) : isNull(carousels.archivedAt);

  const conditions = [
    archiveCondition,
    appId ? eq(carousels.appId, appId) : undefined,
    influencerId ? eq(carousels.influencerId, influencerId) : undefined,
    sentToAccountId ? eq(carousels.sentToAccountId, sentToAccountId) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const whereClause = and(...conditions);

  const [rows, counts, allSlides] = await Promise.all([
    db
      .select({
        id: carousels.id,
        name: carousels.name,
        shortId: carousels.shortId,
        status: carousels.status,
        renderText: carousels.renderText,
        zipPath: carousels.zipPath,
        folderId: carousels.folderId,
        archivedAt: carousels.archivedAt,
        scheduledDate: carousels.scheduledDate,
        publishedAt: carousels.publishedAt,
        stats: carousels.stats,
        videoTitle: carousels.videoTitle,
        appId: carousels.appId,
        influencerId: carousels.influencerId,
        sentAt: carousels.sentAt,
        sentToAccountId: carousels.sentToAccountId,
        publisherUserId: carousels.publisherUserId,
        scheduledTime: carousels.scheduledTime,
        createdAt: carousels.createdAt,
        appName: apps.name,
        influencerName: influencers.name,
        sentToAccountName: tiktokAccounts.name,
        publisherUsername: publisherUsers.username,
      })
      .from(carousels)
      .leftJoin(apps, eq(carousels.appId, apps.id))
      .leftJoin(influencers, eq(carousels.influencerId, influencers.id))
      .leftJoin(tiktokAccounts, eq(carousels.sentToAccountId, tiktokAccounts.id))
      .leftJoin(publisherUsers, eq(carousels.publisherUserId, publisherUsers.id))
      .where(whereClause)
      .orderBy(carousels.createdAt),

    db
      .select({ carouselId: carouselSlides.carouselId, cnt: count() })
      .from(carouselSlides)
      .groupBy(carouselSlides.carouselId),

    listOnly
      ? Promise.resolve([] as {
          carouselId: string;
          id: string;
          order: number;
          generatedImagePath: string | null;
          imageId: string | null;
          texts: string;
          imagePath: string | null;
        }[])
      : db
          .select({
            carouselId: carouselSlides.carouselId,
            id: carouselSlides.id,
            order: carouselSlides.order,
            generatedImagePath: carouselSlides.generatedImagePath,
            imageId: carouselSlides.imageId,
            texts: carouselSlides.texts,
            imagePath: images.path,
          })
          .from(carouselSlides)
          .leftJoin(images, eq(carouselSlides.imageId, images.id))
          .orderBy(carouselSlides.order),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.carouselId, c.cnt]));
  const slidesMap: Record<string, typeof allSlides> = {};
  for (const s of allSlides) {
    if (!slidesMap[s.carouselId]) slidesMap[s.carouselId] = [];
    slidesMap[s.carouselId].push(s);
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "";

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      slideCount: countMap[r.id] ?? 0,
      idSlideImagePath:
        r.status !== "draft" && supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/uploads/generated/idslide_${r.id}.jpg`
          : null,
      ...(listOnly ? {} : { slides: slidesMap[r.id] ?? [] }),
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json();

  // Manual creation: { name, slideCount? }
  if ("name" in body) {
    const { name, slideCount = 1 } = body as { name: string; slideCount?: number };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const id = newId();
    const ts = now();
    await db.insert(carousels).values({
      id, name: name.trim(), shortId: generateShortId(), status: "draft",
      appId: null, influencerId: null, videoTitle: null, videoDescription: null,
      videoHashtags: null, jsonSource: null, zipPath: null, createdAt: ts, updatedAt: ts,
    });
    const count = Math.max(1, Math.min(Number(slideCount) || 1, 20));
    for (let i = 0; i < count; i++) {
      await db.insert(carouselSlides).values({
        id: newId(), carouselId: id, order: i, imageId: null,
        generatedImagePath: null, texts: "[]", createdAt: ts, updatedAt: ts,
      });
    }
    return NextResponse.json({ id }, { status: 201 });
  }

  // Batch JSON import
  const { json } = body;
  if (!json) return NextResponse.json({ error: "json field required" }, { status: 400 });
  try {
    const ids = await processBatchJson(json);
    return NextResponse.json({ created: ids }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
