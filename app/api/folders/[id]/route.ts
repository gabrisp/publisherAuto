import { NextResponse } from "next/server";
import { db } from "@/db";
import { folders, carousels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { now } from "@/lib/ids";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const [folder] = await db
    .update(folders)
    .set({ name: name.trim() })
    .where(eq(folders.id, id))
    .returning();

  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(folder);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Move carousels out of this folder before deleting
  await db
    .update(carousels)
    .set({ folderId: null, updatedAt: now() })
    .where(eq(carousels.folderId, id));

  await db.delete(folders).where(eq(folders.id, id));
  return NextResponse.json({ ok: true });
}
