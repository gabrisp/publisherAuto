import { NextResponse } from "next/server";
import { db } from "@/db";
import { influencers } from "@/db/schema";
import { newId, now, slugify } from "@/lib/ids";

export async function GET() {
  const rows = await db.select().from(influencers).orderBy(influencers.createdAt);
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
    referenceImagePath: null,
    createdAt: now(),
  };
  await db.insert(influencers).values(row);
  return NextResponse.json(row, { status: 201 });
}
