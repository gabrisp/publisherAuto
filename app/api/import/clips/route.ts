import { NextResponse } from "next/server";
import path from "path";
import JSZip from "jszip";
import { db } from "@/db";
import { clips } from "@/db/schema";
import { newId, now } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

const mimeMap: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("zip") as File | null;
    if (!file) return NextResponse.json({ error: "No zip file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let imported = 0;
    let skipped = 0;

    for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      const filename = zipPath.split("/").pop() ?? "";
      const ext = path.extname(filename).toLowerCase();
      if (!mimeMap[ext]) {
        skipped++;
        continue;
      }

      const id = newId();
      const outFilename = `${id}${ext}`;
      const buffer = Buffer.from(await zipEntry.async("arraybuffer"));
      const publicUrl = await uploadFile(`clips/${outFilename}`, buffer, mimeMap[ext]);

      await db.insert(clips).values({
        id,
        name: path.basename(filename, ext),
        filename: outFilename,
        originalName: filename,
        path: publicUrl,
        mimeType: mimeMap[ext],
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
