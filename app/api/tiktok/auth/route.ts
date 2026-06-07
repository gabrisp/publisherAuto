import { NextResponse } from "next/server";
import { buildOAuthUrl } from "@/lib/tiktok";
import { randomBytes } from "crypto";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const url = await buildOAuthUrl(state);
  return NextResponse.redirect(url);
}
