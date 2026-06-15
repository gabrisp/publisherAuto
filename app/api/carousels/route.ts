import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides, apps, influencers, images, tiktokAccounts } from "@/db/schema";
import { and, eq, count } from "drizzle-orm";
import { processBatchJson } from "@/lib/carousel-generator";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listOnly = searchParams.get("list") === "1"; // skip slides payload when not needed

  // Optional entity filters
  const appId = searchParams.get("appId");
  const influencerId = searchParams.get("influencerId");
  const sentToAccountId = searchParams.get("sentToAccountId");
  const conditions = [
    appId ? eq(carousels.appId, appId) : undefined,
    influencerId ? eq(carousels.influencerId, influencerId) : undefined,
    sentToAccountId ? eq(carousels.sentToAccountId, sentToAccountId) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 3 flat queries — no N+1
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
        appId: carousels.appId,
        influencerId: carousels.influencerId,
        sentAt: carousels.sentAt,
        sentToAccountId: carousels.sentToAccountId,
        createdAt: carousels.createdAt,
        appName: apps.name,
        influencerName: influencers.name,
        sentToAccountName: tiktokAccounts.name,
      })
      .from(carousels)
      .leftJoin(apps, eq(carousels.appId, apps.id))
      .leftJoin(influencers, eq(carousels.influencerId, influencers.id))
      .leftJoin(tiktokAccounts, eq(carousels.sentToAccountId, tiktokAccounts.id))
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
      // URL estable en Supabase Storage del ID slide (generado junto con las slides)
      idSlideImagePath:
        r.status !== "draft" && supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/uploads/generated/idslide_${r.id}.jpg`
          : null,
      ...(listOnly ? {} : { slides: slidesMap[r.id] ?? [] }),
    }))
  );
}

export async function POST(req: Request) {
  const { json } = await req.json();
  if (!json) {
    return NextResponse.json({ error: "json field required" }, { status: 400 });
  }
  try {
    const ids = await processBatchJson(json);
    return NextResponse.json({ created: ids }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 422 }
    );
  }
}
