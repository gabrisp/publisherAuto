import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse("tiktok-developers-site-verification=L039HpZ3fQCGsvetLET3AKN0eFMQeHJa", {
    headers: { "Content-Type": "text/plain" },
  });
}
