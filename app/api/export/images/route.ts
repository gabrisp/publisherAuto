import { NextResponse } from "next/server";
import { db } from "@/db";
import { images, apps, influencers } from "@/db/schema";
import path from "path";
import JSZip from "jszip";
import { parseTags } from "@/lib/ids";

export async function GET() {
  const allImages = await db
    .select({
      id: images.id,
      path: images.path,
      tag: images.tag,
      scope: images.scope,
      appId: images.appId,
      influencerId: images.influencerId,
    })
    .from(images);

  const appRows = await db.select({ id: apps.id, slug: apps.slug }).from(apps);
  const infRows = await db.select({ id: influencers.id, slug: influencers.slug }).from(influencers);

  const appSlug = Object.fromEntries(appRows.map((a) => [a.id, a.slug]));
  const infSlug = Object.fromEntries(infRows.map((i) => [i.id, i.slug]));

  const zip = new JSZip();
  const usedNames: Record<string, Record<string, number>> = {};

  function uniqueName(folder: string, baseName: string, ext: string): string {
    if (!usedNames[folder]) usedNames[folder] = {};
    const count = usedNames[folder][baseName] ?? 0;
    usedNames[folder][baseName] = count + 1;
    return count === 0 ? `${baseName}${ext}` : `${baseName}_${count + 1}${ext}`;
  }

  for (const img of allImages) {
    const tags = parseTags(img.tag);
    const baseName = tags.join("_") || "untagged";
    const ext = path.extname(img.path) || ".jpg";

    let folder: string;
    if (img.scope === "global") {
      folder = "global";
    } else if (img.scope === "app" && img.appId) {
      folder = `apps/${appSlug[img.appId] ?? img.appId}`;
    } else if (img.scope === "influencer" && img.influencerId) {
      folder = `influencers/${infSlug[img.influencerId] ?? img.influencerId}`;
    } else {
      folder = "global";
    }

    const filename = uniqueName(folder, baseName, ext);

    try {
      const res = await fetch(img.path);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      zip.folder(folder)!.file(filename, buf);
    } catch {
      // skip missing files
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="images_export.zip"`,
    },
  });
}
