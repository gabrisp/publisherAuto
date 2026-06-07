import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { serializeTags } from "@/lib/ids";
import { deleteFile, urlToStoragePath } from "@/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { tag?: string; tags?: string[] };
  const tagValues = body.tags ?? (body.tag ? [body.tag] : []);
  if (tagValues.length === 0) return NextResponse.json({ error: "tags required" }, { status: 400 });
  await db.update(images).set({ tag: serializeTags(tagValues) }).where(eq(images.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db.select().from(images).where(eq(images.id, id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteFile(urlToStoragePath(row.path));
  } catch {}

  await db.delete(images).where(eq(images.id, id));
  return NextResponse.json({ ok: true });
}
