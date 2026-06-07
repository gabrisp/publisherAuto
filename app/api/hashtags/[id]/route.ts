import { NextResponse } from "next/server";
import { db } from "@/db";
import { hashtags } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(hashtags).where(eq(hashtags.id, id));
  return NextResponse.json({ ok: true });
}
