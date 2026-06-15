import { NextResponse } from "next/server";
import { db } from "@/db";
import { folders, carousels } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const [rows, counts] = await Promise.all([
    db.select().from(folders).orderBy(folders.createdAt),
    db
      .select({ folderId: carousels.folderId, cnt: count() })
      .from(carousels)
      .groupBy(carousels.folderId),
  ]);

  const countMap = Object.fromEntries(
    counts.filter((c) => c.folderId).map((c) => [c.folderId!, c.cnt])
  );

  return NextResponse.json(
    rows.map((f) => ({ ...f, carouselCount: countMap[f.id] ?? 0 }))
  );
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const [folder] = await db
    .insert(folders)
    .values({ id: newId(), name: name.trim(), createdAt: now() })
    .returning();

  return NextResponse.json(folder, { status: 201 });
}
