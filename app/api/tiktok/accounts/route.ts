import { NextResponse } from "next/server";
import { db } from "@/db";
import { tiktokAccounts } from "@/db/schema";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const rows = await db
    .select({
      id: tiktokAccounts.id,
      name: tiktokAccounts.name,
      avatarUrl: tiktokAccounts.avatarUrl,
      createdAt: tiktokAccounts.createdAt,
    })
    .from(tiktokAccounts)
    .orderBy(tiktokAccounts.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name, avatarUrl } = await req.json() as { name: string; avatarUrl?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  await db.insert(tiktokAccounts).values({
    id: newId(),
    name: name.trim(),
    tiktokUserId: null,
    avatarUrl: avatarUrl?.trim() || null,
    accessToken: null,
    createdAt: now(),
  });

  return NextResponse.json({ ok: true });
}
