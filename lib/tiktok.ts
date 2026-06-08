import type { TiktokAccount } from "@/db/schema";
import { db } from "@/db";
import { tiktokAccounts, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { now } from "@/lib/ids";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

/** Reads TikTok credentials from DB (manual entry) — falls back to env vars. */
async function getTiktokConfig() {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const clientKey =
    map["tiktok_client_key"] || process.env.TIKTOK_CLIENT_KEY || "";
  const clientSecret =
    map["tiktok_client_secret"] || process.env.TIKTOK_CLIENT_SECRET || "";
  const redirectUri =
    map["tiktok_redirect_uri"] ||
    process.env.TIKTOK_REDIRECT_URI ||
    "http://localhost:3000/api/tiktok/callback";

  return { clientKey, clientSecret, redirectUri };
}

export async function refreshTokenIfNeeded(
  account: TiktokAccount
): Promise<TiktokAccount> {
  // Manual tokens have no known expiry — skip refresh, use as-is
  if (!account.tokenExpiresAt) return account;

  const buffered = account.tokenExpiresAt - 60 * 5; // refresh 5 min before expiry
  if (Date.now() / 1000 < buffered) return account;

  if (!account.refreshToken) throw new Error("No refresh token available");

  const { clientKey, clientSecret } = await getTiktokConfig();

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Token refresh failed: ${data.error_description ?? data.error}`);
  }

  const updated = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? account.refreshToken,
    tokenExpiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };

  await db
    .update(tiktokAccounts)
    .set(updated)
    .where(eq(tiktokAccounts.id, account.id));

  return { ...account, ...updated };
}

type UploadResult = {
  publishId: string;
  debug: Record<string, unknown>;
};

export async function uploadCarouselAsDraft(
  account: TiktokAccount,
  imageUrls: string[],
  title: string,
  description?: string   // hashtags string, e.g. "#fitness #gym #workout"
): Promise<UploadResult> {
  const fresh = await refreshTokenIfNeeded(account);

  // Nombre del carousel + hashtags (o solo nombre si no hay hashtags)
  const caption = description
    ? `${title}\n${description}`.slice(0, 2200)
    : title.slice(0, 2200);

  const endpoint = `${TIKTOK_API}/post/publish/content/init/`;
  const requestBody = {
    "post_info": {
        "description": description, //post caption (title + hashtags)
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: imageUrls,
    },
    post_mode: "MEDIA_UPLOAD",
    media_type: "PHOTO",
  };

  const initRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(requestBody),
  });

  const initData = await initRes.json();

  const debug = {
    endpoint,
    request: requestBody,
    response: initData,
    httpStatus: initRes.status,
  };

  if (!initRes.ok || initData.error?.code !== "ok") {
    const err = new Error(`TikTok init failed: ${JSON.stringify(initData.error ?? initData)}`);
    (err as any).debug = debug;
    throw err;
  }

  return { publishId: initData.data.publish_id as string, debug };
}

export async function buildOAuthUrl(state: string): Promise<string> {
  const { clientKey, redirectUri } = await getTiktokConfig();
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: "user.info.basic,video.upload",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const { clientKey, clientSecret, redirectUri } = await getTiktokConfig();
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Token exchange failed: ${data.error_description ?? data.error}`);
  }
  return data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    open_id: string;
  };
}

export async function fetchTiktokUserInfo(accessToken: string) {
  const res = await fetch(
    `${TIKTOK_API}/user/info/?fields=display_name,avatar_url`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.data?.user as { display_name: string; avatar_url: string };
}
