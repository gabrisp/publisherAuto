import { NextResponse } from "next/server";
import { db } from "@/db";
import { tiktokAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [account] = await db.select().from(tiktokAccounts).where(eq(tiktokAccounts.id, id));
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    avatarUrl?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if ("name" in body && body.name?.trim()) patch.name = body.name.trim();
  if ("avatarUrl" in body) patch.avatarUrl = body.avatarUrl?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no changes" }, { status: 400 });
  }

  await db.update(tiktokAccounts).set(patch).where(eq(tiktokAccounts.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(tiktokAccounts).where(eq(tiktokAccounts.id, id));
  return NextResponse.json({ ok: true });
}
