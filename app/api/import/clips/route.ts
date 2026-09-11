import { NextResponse } from "next/server";
import path from "path";
import JSZip from "jszip";
import { db } from "@/db";
import { clips } from "@/db/schema";
import { newId, now } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

const mimeByExt: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("zip") as File | null;
    if (!file) return NextResponse.json({ error: "No zip file" }, { status: 400 });

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    let imported = 0;
    let skipped = 0;

    for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      const originalName = path.basename(zipPath);
      const ext = path.extname(originalName).toLowerCase();
      if (!mimeByExt[ext]) {
        skipped++;
        continue;
      }

      const id = newId();
      const filename = `${id}${ext}`;
      const buffer = Buffer.from(await zipEntry.async("arraybuffer"));
      const publicUrl = await uploadFile(`clips/${filename}`, buffer, mimeByExt[ext]);

      await db.insert(clips).values({
        id,
        name: path.basename(originalName, ext),
        filename,
        originalName,
        path: publicUrl,
        mimeType: mimeByExt[ext],
        durationMs: null,
        width: null,
        height: null,
        createdAt: now(),
      });

      imported++;
    }

    return NextResponse.json({ imported, skipped });
  } catch (e) {
    const rawError = e instanceof Error ? e.stack ?? `${e.name}: ${e.message}` : String(e);
    return NextResponse.json({ error: rawError }, { status: 500 });
  }
}
