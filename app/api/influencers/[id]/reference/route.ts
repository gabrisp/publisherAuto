import { NextResponse } from "next/server";
import { db } from "@/db";
import { influencers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `references/ref_${newId()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

  await db
    .update(influencers)
    .set({ referenceImagePath: publicUrl })
    .where(eq(influencers.id, id));

  return NextResponse.json({ path: publicUrl });
}
