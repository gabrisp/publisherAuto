import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import sharp from "sharp";
import { newId, now, serializeTags } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const appId = searchParams.get("appId");
  const influencerId = searchParams.get("influencerId");

  const conditions = [];
  if (scope) conditions.push(eq(images.scope, scope));
  if (appId) conditions.push(eq(images.appId, appId));
  if (influencerId) conditions.push(eq(images.influencerId, influencerId));

  const rows =
    conditions.length > 0
      ? await db.select().from(images).where(and(...conditions)).orderBy(images.createdAt)
      : await db.select().from(images).orderBy(images.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const scope = formData.get("scope") as string | null;
  const appId = formData.get("appId") as string | null;
  const influencerId = formData.get("influencerId") as string | null;

  const rawTags = formData.getAll("tags[]") as string[];
  const rawTag = formData.get("tag") as string | null;
  const tagValues = rawTags.length > 0 ? rawTags : rawTag ? [rawTag] : [];

  if (!file || tagValues.length === 0 || !scope) {
    return NextResponse.json(
      { error: "file, tag(s), and scope are required" },
      { status: 400 }
    );
  }

  // Expand underscore-separated tags: "front-day_gym" → ["front-day", "gym"]
  const expandedTags = tagValues.flatMap((t) =>
    t.split("_").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  const tag = serializeTags(expandedTags);
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${newId()}.${ext}`;
  const storagePath = `images/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const publicUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {}

  const row = {
    id: newId(),
    filename,
    originalName: file.name,
    path: publicUrl,
    tag: tag.trim().toLowerCase(),
    scope,
    appId: appId || null,
    influencerId: influencerId || null,
    width,
    height,
    createdAt: now(),
  };

  await db.insert(images).values(row);
  return NextResponse.json(row, { status: 201 });
}
