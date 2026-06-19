import { NextResponse } from "next/server";
import { db } from "@/db";
import { userTiktokAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const { accountId } = await req.json();

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  await db
    .insert(userTiktokAccounts)
    .values({ userId, accountId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const { accountId } = await req.json();

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  await db
    .delete(userTiktokAccounts)
    .where(
      and(
        eq(userTiktokAccounts.userId, userId),
        eq(userTiktokAccounts.accountId, accountId)
      )
    );

  return NextResponse.json({ ok: true });
}
