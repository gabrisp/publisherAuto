import { NextResponse } from "next/server";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { newId, now, slugify } from "@/lib/ids";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(apps).orderBy(apps.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const row = {
    id: newId(),
    name: name.trim(),
    slug: slugify(name),
    createdAt: now(),
  };
  await db.insert(apps).values(row);
  return NextResponse.json(row, { status: 201 });
}
