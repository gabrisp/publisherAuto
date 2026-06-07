import { NextResponse } from "next/server";
import { db } from "@/db";
import { tiktokAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(tiktokAccounts).where(eq(tiktokAccounts.id, id));
  return NextResponse.json({ ok: true });
}
