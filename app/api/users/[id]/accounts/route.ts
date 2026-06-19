import { NextResponse } from "next/server";
import { db } from "@/db";
import { userTiktokAccounts, carousels } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

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

  // Backfill: carousels already assigned to this account but without a publisher user
  await db
    .update(carousels)
    .set({ publisherUserId: userId })
    .where(
      and(
        eq(carousels.sentToAccountId, accountId),
        isNull(carousels.publisherUserId)
      )
    );

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

  // Clear publisherUserId on carousels assigned to this account for this user
  await db
    .update(carousels)
    .set({ publisherUserId: null })
    .where(
      and(
        eq(carousels.sentToAccountId, accountId),
        eq(carousels.publisherUserId, userId)
      )
    );

  return NextResponse.json({ ok: true });
}
