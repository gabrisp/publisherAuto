import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels, carouselSlides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId, now } from "@/lib/ids";
import { uploadFile } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `images/${newId()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

  await db
    .update(carouselSlides)
    .set({ generatedImagePath: publicUrl, imageId: null, updatedAt: now() })
    .where(eq(carouselSlides.id, slideId));

  await db
    .update(carousels)
    .set({ status: "edited", updatedAt: now() })
    .where(eq(carousels.id, id));

  return NextResponse.json({ url: publicUrl });
}
