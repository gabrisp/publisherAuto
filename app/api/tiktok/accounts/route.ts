import { NextResponse } from "next/server";
import { db } from "@/db";
import { tiktokAccounts } from "@/db/schema";
import { fetchTiktokUserInfo } from "@/lib/tiktok";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const rows = await db
    .select({
      id: tiktokAccounts.id,
      name: tiktokAccounts.name,
      tiktokUserId: tiktokAccounts.tiktokUserId,
      createdAt: tiktokAccounts.createdAt,
    })
    .from(tiktokAccounts)
    .orderBy(tiktokAccounts.createdAt);
  return NextResponse.json(rows);
}

/** Manually add a TikTok account by pasting an access token directly. */
export async function POST(req: Request) {
  const { handle, openId, accessToken, refreshToken, expiresIn } = await req.json() as {
    handle: string;
    openId?: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  };

  if (!handle?.trim() || !accessToken?.trim()) {
    return NextResponse.json(
      { error: "handle and accessToken are required" },
      { status: 400 }
    );
  }

  // Use provided open_id, or try fetching from API, or fall back to handle
  let tiktokUserId = openId?.trim() || handle.trim().toLowerCase();
  let displayName = handle.trim();
  if (!openId?.trim()) {
    try {
      const info = await fetchTiktokUserInfo(accessToken.trim());
      if (info?.display_name) displayName = info.display_name;
    } catch {
      // Token may be valid but user info fetch failed — proceed with handle
    }
  }

  // Calculate expiry timestamp if expires_in was provided
  const tokenExpiresAt = expiresIn && expiresIn > 0
    ? Math.floor(Date.now() / 1000) + expiresIn
    : null;

  await db.insert(tiktokAccounts).values({
    id: newId(),
    name: displayName,
    tiktokUserId,
    accessToken: accessToken.trim(),
    refreshToken: refreshToken?.trim() || null,
    tokenExpiresAt,
    createdAt: now(),
  });

  return NextResponse.json({ ok: true });
}
