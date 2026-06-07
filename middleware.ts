import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname ===
    "/api/tiktokL039HpZ3fQCGsvetLET3AKN0eFMQeHJa.txt"
  ) {
    return new NextResponse(
      "tiktok-developers-site-verification=L039HpZ3fQCGsvetLET3AKN0eFMQeHJa",
      {
        headers: { "Content-Type": "text/plain" },
      }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/tiktokL039HpZ3fQCGsvetLET3AKN0eFMQeHJa.txt",
};
