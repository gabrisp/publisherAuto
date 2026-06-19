import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  publisherUsers,
  carousels,
  userTiktokAccounts,
  tiktokAccounts,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, gt, lte } from "drizzle-orm";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [user] = await db
    .select()
    .from(publisherUsers)
    .where(eq(publisherUsers.id, id));

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const [assignedCarousels, assignedAccounts] = await Promise.all([
    db
      .select({
        id: carousels.id,
        name: carousels.name,
        status: carousels.status,
        scheduledDate: carousels.scheduledDate,
        scheduledTime: carousels.scheduledTime,
        publishedAt: carousels.publishedAt,
        stats: carousels.stats,
        videoTitle: carousels.videoTitle,
        archivedAt: carousels.archivedAt,
      })
      .from(carousels)
      .where(eq(carousels.publisherUserId, id)),

    db
      .select({
        id: tiktokAccounts.id,
        name: tiktokAccounts.name,
        avatarUrl: tiktokAccounts.avatarUrl,
      })
      .from(userTiktokAccounts)
      .innerJoin(
        tiktokAccounts,
        eq(userTiktokAccounts.accountId, tiktokAccounts.id)
      )
      .where(eq(userTiktokAccounts.userId, id)),
  ]);

  return NextResponse.json({
    ...user,
    carousels: assignedCarousels,
    accounts: assignedAccounts,
    today,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { displayName, password } = await req.json();

  if (password) {
    const supabase = getAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(id, { password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (displayName !== undefined) {
    await db
      .update(publisherUsers)
      .set({ displayName: displayName?.trim() || null })
      .where(eq(publisherUsers.id, id));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = getAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // DB row cascades via FK; but if not, delete manually
  await db.delete(publisherUsers).where(eq(publisherUsers.id, id));

  return NextResponse.json({ ok: true });
}
