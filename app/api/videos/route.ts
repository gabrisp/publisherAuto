import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  clips,
  publisherUsers,
  tiktokAccounts,
  userTiktokAccounts,
  videoClips,
  videos,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const rows = await db
    .select({
      id: videos.id,
      name: videos.name,
      status: videos.status,
      description: videos.description,
      hashtags: videos.hashtags,
      audioPath: videos.audioPath,
      exportPath: videos.exportPath,
      sentToAccountId: videos.sentToAccountId,
      sentAt: videos.sentAt,
      publisherUserId: videos.publisherUserId,
      scheduledDate: videos.scheduledDate,
      scheduledTime: videos.scheduledTime,
      publishedAt: videos.publishedAt,
      archivedAt: videos.archivedAt,
      stats: videos.stats,
      createdAt: videos.createdAt,
      updatedAt: videos.updatedAt,
      sentToAccountName: tiktokAccounts.name,
      publisherUsername: publisherUsers.username,
    })
    .from(videos)
    .leftJoin(tiktokAccounts, eq(videos.sentToAccountId, tiktokAccounts.id))
    .leftJoin(publisherUsers, eq(videos.publisherUserId, publisherUsers.id))
    .orderBy(desc(videos.createdAt));

  const counts = await db
    .select({ videoId: videoClips.videoId })
    .from(videoClips)
    .orderBy(videoClips.order);

  const countMap = new Map<string, number>();
  for (const item of counts) {
    countMap.set(item.videoId, (countMap.get(item.videoId) ?? 0) + 1);
  }

  return NextResponse.json(rows.map((row) => ({ ...row, clipCount: countMap.get(row.id) ?? 0 })));
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    clipIds?: string[];
    sentToAccountId?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const ts = now();
  const videoId = newId();
  let publisherUserId: string | null = null;

  if (body.sentToAccountId) {
    const [uta] = await db
      .select({ userId: userTiktokAccounts.userId })
      .from(userTiktokAccounts)
      .where(eq(userTiktokAccounts.accountId, body.sentToAccountId));
    publisherUserId = uta?.userId ?? null;
  }

  await db.insert(videos).values({
    id: videoId,
    name: body.name.trim(),
    status: "draft",
    sentToAccountId: body.sentToAccountId || null,
    publisherUserId,
    createdAt: ts,
    updatedAt: ts,
  });

  for (const [index, clipId] of (body.clipIds ?? []).entries()) {
    const [clip] = await db.select({ id: clips.id }).from(clips).where(eq(clips.id, clipId));
    if (!clip) continue;
    await db.insert(videoClips).values({
      id: newId(),
      videoId,
      clipId,
      order: index,
      trimStartMs: 0,
      trimEndMs: null,
      volume: 100,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return NextResponse.json({ id: videoId }, { status: 201 });
}
