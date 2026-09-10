import { NextResponse } from "next/server";
import { db } from "@/db";
import { mobileDevices } from "@/db/schema";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const rows = await db.select().from(mobileDevices).orderBy(mobileDevices.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name, notes } = (await req.json()) as { name?: string; notes?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [row] = await db
    .insert(mobileDevices)
    .values({
      id: newId(),
      name: name.trim(),
      notes: notes?.trim() || null,
      createdAt: now(),
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
