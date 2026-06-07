import { NextResponse } from "next/server";
import { db } from "@/db";
import { images, apps, influencers } from "@/db/schema";
import path from "path";
import JSZip from "jszip";
import { newId, now, serializeTags } from "@/lib/ids";
import sharp from "sharp";
import { uploadFile } from "@/lib/supabase";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("zip") as File | null;
  if (!file) return NextResponse.json({ error: "No zip file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const appRows = await db.select({ id: apps.id, slug: apps.slug }).from(apps);
  const infRows = await db.select({ id: influencers.id, slug: influencers.slug }).from(influencers);
  const appId = Object.fromEntries(appRows.map((a) => [a.slug, a.id]));
  const infId = Object.fromEntries(infRows.map((i) => [i.slug, i.id]));

  let imported = 0;
  let skipped = 0;

  for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

    const parts = zipPath.split("/");
    if (parts.length < 2) continue;

    const filename = parts[parts.length - 1];
    const ext = path.extname(filename).toLowerCase();
    const validExts = [".jpg", ".jpeg", ".png", ".webp"];
    if (!validExts.includes(ext)) continue;

    const nameWithoutExt = path.basename(filename, ext);
    const tags = nameWithoutExt.split("_").filter((p) => /^[a-zA-Z]+$/.test(p));
    if (tags.length === 0) { skipped++; continue; }

    let scope: "global" | "app" | "influencer" = "global";
    let resolvedAppId: string | null = null;
    let resolvedInfluencerId: string | null = null;

    if (parts[0] === "global") {
      scope = "global";
    } else if (parts[0] === "apps" && parts[1]) {
      scope = "app";
      resolvedAppId = appId[parts[1]] ?? null;
      if (!resolvedAppId) { skipped++; continue; }
    } else if (parts[0] === "influencers" && parts[1]) {
      scope = "influencer";
      resolvedInfluencerId = infId[parts[1]] ?? null;
      if (!resolvedInfluencerId) { skipped++; continue; }
    }

    const buf = Buffer.from(await zipEntry.async("arraybuffer"));
    const id = newId();
    const outFilename = `${id}${ext}`;
    const storagePath = `images/${outFilename}`;

    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const publicUrl = await uploadFile(storagePath, buf, mimeMap[ext] ?? "image/jpeg");

    let width: number | null = null;
    let height: number | null = null;
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {}

    const serializedTag = serializeTags(tags);

    await db.insert(images).values({
      id,
      filename: outFilename,
      originalName: filename,
      path: publicUrl,
      tag: serializedTag,
      scope,
      appId: resolvedAppId,
      influencerId: resolvedInfluencerId,
      width,
      height,
      createdAt: now(),
    });

    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
