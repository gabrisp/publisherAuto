import { NextResponse } from "next/server";
import { db } from "@/db";
import { publisherUsers, carousels, userTiktokAccounts } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { getAdminClient } from "@/lib/supabase";
import { now } from "@/lib/ids";

export async function GET() {
  const rows = await db
    .select({
      id: publisherUsers.id,
      username: publisherUsers.username,
      displayName: publisherUsers.displayName,
      createdAt: publisherUsers.createdAt,
      carouselCount: count(carousels.id),
    })
    .from(publisherUsers)
    .leftJoin(carousels, eq(carousels.publisherUserId, publisherUsers.id))
    .groupBy(publisherUsers.id)
    .orderBy(publisherUsers.createdAt);

  // Get account counts separately
  const accountCounts = await db
    .select({ userId: userTiktokAccounts.userId, cnt: count() })
    .from(userTiktokAccounts)
    .groupBy(userTiktokAccounts.userId);

  const accountCountMap = Object.fromEntries(
    accountCounts.map((r) => [r.userId, r.cnt])
  );

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      accountCount: accountCountMap[r.id] ?? 0,
    }))
  );
}

export async function POST(req: Request) {
  const { username, password, displayName } = await req.json();

  if (!username?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "username y password son obligatorios" },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  // Create Supabase Auth user with synthetic email
  const email = `${username.trim().toLowerCase()}@pub.setlog.app`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: "publisher", username: username.trim() },
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userId = data.user.id;

  // Insert companion DB row
  const row = {
    id: userId,
    username: username.trim().toLowerCase(),
    displayName: displayName?.trim() || null,
    createdAt: now(),
  };

  await db.insert(publisherUsers).values(row);

  return NextResponse.json(row, { status: 201 });
}
