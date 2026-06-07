import { NextResponse } from "next/server";
import { db } from "@/db";
import { carousels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { now } from "@/lib/ids";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { renderText } = await req.json();
  await db
    .update(carousels)
    .set({ renderText: renderText ? 1 : 0, updatedAt: now() })
    .where(eq(carousels.id, id));
  return NextResponse.json({ ok: true });
}
