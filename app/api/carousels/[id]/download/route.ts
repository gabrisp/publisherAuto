import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [carousel] = await db.select().from(carousels).where(eq(carousels.id, id));

  if (!carousel?.zipPath) {
    return NextResponse.json({ error: "ZIP not generated yet" }, { status: 404 });
  }

  const res = await fetch(carousel.zipPath);
  if (!res.ok) {
    return NextResponse.json({ error: "ZIP not found in storage" }, { status: 404 });
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const safeName = carousel.name.replace(/[^a-z0-9_-]/gi, "_");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    },
  });
}
