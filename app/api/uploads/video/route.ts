import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "mp4";
  const filename = `${newId()}.${ext}`;
  const storagePath = `videos/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicUrl = await uploadFile(storagePath, buffer, file.type || "video/mp4");

  return NextResponse.json({ path: publicUrl }, { status: 201 });
}
