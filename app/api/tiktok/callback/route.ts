import { NextResponse } from "next/server";
import { db } from "@/db";
import { tiktokAccounts } from "@/db/schema";
import { exchangeCodeForToken, fetchTiktokUserInfo } from "@/lib/tiktok";
import { newId, now } from "@/lib/ids";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/tiktok?error=${error ?? "no_code"}`, req.url)
    );
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    const user = await fetchTiktokUserInfo(tokens.access_token);

    const existing = await db
      .select()
      .from(tiktokAccounts)
      .where(eq(tiktokAccounts.tiktokUserId, tokens.open_id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(tiktokAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
          name: user?.display_name ?? existing[0].name,
        })
        .where(eq(tiktokAccounts.tiktokUserId, tokens.open_id));
    } else {
      await db.insert(tiktokAccounts).values({
        id: newId(),
        name: user?.display_name ?? tokens.open_id,
        tiktokUserId: tokens.open_id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
        createdAt: now(),
      });
    }

    return NextResponse.redirect(new URL("/tiktok?connected=1", req.url));
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/tiktok?error=${encodeURIComponent((e as Error).message)}`, req.url)
    );
  }
}
