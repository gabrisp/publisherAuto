import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const KEYS = ["tiktok_client_key", "tiktok_client_secret", "tiktok_redirect_uri"] as const;

export async function GET() {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    clientKey: map["tiktok_client_key"] ?? "",
    clientSecretSet: !!(map["tiktok_client_secret"]),
    redirectUri: map["tiktok_redirect_uri"] ?? "",
    publicBaseUrl: map["public_base_url"] ?? process.env.PUBLIC_BASE_URL ?? "",
    envConfigured: !!(process.env.TIKTOK_CLIENT_KEY),
  });
}

export async function POST(req: Request) {
  const body = await req.json() as {
    clientKey?: string;
    clientSecret?: string;
    redirectUri?: string;
    publicBaseUrl?: string;
  };

  const upserts: { key: string; value: string }[] = [];

  if (body.clientKey !== undefined) {
    upserts.push({ key: "tiktok_client_key", value: body.clientKey.trim() });
  }
  if (body.clientSecret !== undefined && body.clientSecret.trim() !== "") {
    upserts.push({ key: "tiktok_client_secret", value: body.clientSecret.trim() });
  }
  if (body.redirectUri !== undefined) {
    upserts.push({ key: "tiktok_redirect_uri", value: body.redirectUri.trim() });
  }
  if (body.publicBaseUrl !== undefined) {
    upserts.push({ key: "public_base_url", value: body.publicBaseUrl.trim() });
  }

  for (const { key, value } of upserts) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  for (const key of KEYS) {
    await db.delete(settings).where(eq(settings.key, key));
  }
  return NextResponse.json({ ok: true });
}
