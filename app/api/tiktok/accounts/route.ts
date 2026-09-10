import { NextResponse } from "next/server";
import { db } from "@/db";
import { mobileDevices, tiktokAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const rows = await db
    .select({
      id: tiktokAccounts.id,
      name: tiktokAccounts.name,
      avatarUrl: tiktokAccounts.avatarUrl,
      mobileDeviceId: tiktokAccounts.mobileDeviceId,
      mobileDeviceName: mobileDevices.name,
      createdAt: tiktokAccounts.createdAt,
    })
    .from(tiktokAccounts)
    .leftJoin(mobileDevices, eq(tiktokAccounts.mobileDeviceId, mobileDevices.id))
    .orderBy(tiktokAccounts.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name, avatarUrl, mobileDeviceId } = await req.json() as {
    name: string;
    avatarUrl?: string;
    mobileDeviceId?: string | null;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  await db.insert(tiktokAccounts).values({
    id: newId(),
    name: name.trim(),
    tiktokUserId: null,
    avatarUrl: avatarUrl?.trim() || null,
    mobileDeviceId: mobileDeviceId || null,
    accessToken: null,
    createdAt: now(),
  });

  return NextResponse.json({ ok: true });
}
