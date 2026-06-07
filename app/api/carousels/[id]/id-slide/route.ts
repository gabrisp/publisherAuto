import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateIdSlide } from "@/lib/image-processor";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [carousel] = await db
    .select({ shortId: carousels.shortId })
    .from(carousels)
    .where(eq(carousels.id, id));

  if (!carousel) return new NextResponse("Not found", { status: 404 });

  const buffer = await generateIdSlide(carousel.shortId ?? "----");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
