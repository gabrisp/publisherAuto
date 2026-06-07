import { NextResponse } from "next/server";
import { db } from "@/db";
import { influencers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db.select().from(influencers).where(eq(influencers.id, id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(influencers).where(eq(influencers.id, id));
  return NextResponse.json({ ok: true });
}
