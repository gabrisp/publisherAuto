import { NextResponse } from "next/server";
import { db } from "@/db";
import { hashtags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId, now } from "@/lib/ids";

export async function GET() {
  const rows = await db.select().from(hashtags).orderBy(hashtags.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { tag } = await req.json();
  if (!tag) return NextResponse.json({ error: "tag requerido" }, { status: 400 });

  // Normalizar: quitar # si viene con él, lowercase, sin espacios
  const normalized = tag.replace(/^#+/, "").toLowerCase().trim().replace(/\s+/g, "");
  if (!normalized) return NextResponse.json({ error: "tag inválido" }, { status: 400 });

  try {
    const row = { id: newId(), tag: normalized, createdAt: now() };
    await db.insert(hashtags).values(row);
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "El hashtag ya existe" }, { status: 409 });
  }
}
