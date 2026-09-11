import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  clips,
  mobileDevices,
  publisherUsers,
  tiktokAccounts,
  userTiktokAccounts,
  videoClips,
  videos,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { newId, now } from "@/lib/ids";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [video] = await db
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
      stats: videos.stats,
      createdAt: videos.createdAt,
      updatedAt: videos.updatedAt,
      sentToAccountName: tiktokAccounts.name,
      mobileDeviceName: mobileDevices.name,
      publisherUsername: publisherUsers.username,
    })
    .from(videos)
    .leftJoin(tiktokAccounts, eq(videos.sentToAccountId, tiktokAccounts.id))
    .leftJoin(mobileDevices, eq(tiktokAccounts.mobileDeviceId, mobileDevices.id))
    .leftJoin(publisherUsers, eq(videos.publisherUserId, publisherUsers.id))
    .where(eq(videos.id, id));

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db
    .select({
      id: videoClips.id,
      order: videoClips.order,
      trimStartMs: videoClips.trimStartMs,
      trimEndMs: videoClips.trimEndMs,
      volume: videoClips.volume,
      clipId: clips.id,
      clipName: clips.name,
      clipPath: clips.path,
      durationMs: clips.durationMs,
      width: clips.width,
      height: clips.height,
    })
    .from(videoClips)
    .leftJoin(clips, eq(videoClips.clipId, clips.id))
    .where(eq(videoClips.videoId, id))
    .orderBy(asc(videoClips.order));

  return NextResponse.json({ ...video, clips: items });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = { updatedAt: now() };

  if ("name" in body) patch.name = body.name;
  if ("status" in body) patch.status = body.status;
  if ("description" in body) patch.description = body.description ?? null;
  if ("hashtags" in body) patch.hashtags = body.hashtags ?? null;
  if ("audioPath" in body) patch.audioPath = body.audioPath ?? null;
  if ("exportPath" in body) patch.exportPath = body.exportPath ?? null;
  if ("scheduledDate" in body) patch.scheduledDate = body.scheduledDate ?? null;
  if ("scheduledTime" in body) patch.scheduledTime = body.scheduledTime ?? null;
  if ("sentAt" in body) patch.sentAt = body.sentAt ?? null;
  if ("publishedAt" in body) patch.publishedAt = body.publishedAt ?? null;
  if ("stats" in body) patch.stats = body.stats ? JSON.stringify(body.stats) : null;
  if ("publisherUserId" in body) patch.publisherUserId = body.publisherUserId ?? null;

  if ("sentToAccountId" in body) {
    patch.sentToAccountId = body.sentToAccountId ?? null;
    if (body.sentToAccountId) {
      const [uta] = await db
        .select({ userId: userTiktokAccounts.userId })
        .from(userTiktokAccounts)
        .where(eq(userTiktokAccounts.accountId, body.sentToAccountId));
      patch.publisherUserId = uta?.userId ?? null;
    } else {
      patch.publisherUserId = null;
    }
  }

  const [updated] = await db
    .update(videos)
    .set(patch)
    .where(eq(videos.id, id))
    .returning({ id: videos.id });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (Array.isArray(body.clips)) {
    for (const item of body.clips as {
      id: string;
      order: number;
      trimStartMs?: number;
      trimEndMs?: number | null;
      volume?: number;
    }[]) {
      await db
        .update(videoClips)
        .set({
          order: item.order,
          trimStartMs: Math.max(0, Number(item.trimStartMs ?? 0)),
          trimEndMs: item.trimEndMs == null ? null : Math.max(0, Number(item.trimEndMs)),
          volume: Math.max(0, Math.min(200, Number(item.volume ?? 100))),
          updatedAt: now(),
        })
        .where(eq(videoClips.id, item.id));
    }
  }

  if (Array.isArray(body.addClipIds) && body.addClipIds.length > 0) {
    const existing = await db
      .select({ order: videoClips.order })
      .from(videoClips)
      .where(eq(videoClips.videoId, id))
      .orderBy(asc(videoClips.order));
    let nextOrder = existing.length ? Math.max(...existing.map((item) => item.order)) + 1 : 0;
    const ts = now();

    for (const clipId of body.addClipIds as string[]) {
      const [clip] = await db.select({ id: clips.id }).from(clips).where(eq(clips.id, clipId));
      if (!clip) continue;
      await db.insert(videoClips).values({
        id: newId(),
        videoId: id,
        clipId,
        order: nextOrder++,
        trimStartMs: 0,
        trimEndMs: null,
        volume: 100,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
