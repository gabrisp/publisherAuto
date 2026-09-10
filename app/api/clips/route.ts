import { NextResponse } from "next/server";
import { db } from "@/db";
import { clips } from "@/db/schema";
import { newId, now } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

export async function GET() {
  const rows = await db.select().from(clips).orderBy(clips.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const durationMsRaw = formData.get("durationMs") as string | null;
  const widthRaw = formData.get("width") as string | null;
  const heightRaw = formData.get("height") as string | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "mp4";
  const filename = `${newId()}.${ext}`;
  const storagePath = `clips/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicUrl = await uploadFile(storagePath, buffer, file.type || "video/mp4");

  const [row] = await db
    .insert(clips)
    .values({
      id: newId(),
      name: name?.trim() || file.name.replace(/\.[^.]+$/, ""),
      filename,
      originalName: file.name,
      path: publicUrl,
      mimeType: file.type || null,
      durationMs: durationMsRaw ? Number(durationMsRaw) : null,
      width: widthRaw ? Number(widthRaw) : null,
      height: heightRaw ? Number(heightRaw) : null,
      createdAt: now(),
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
