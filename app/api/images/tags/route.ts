import { NextResponse } from "next/server";
import { db } from "@/db";
import { images, apps, influencers } from "@/db/schema";
import { eq } from "drizzle-orm";

export type TagsResponse = {
  global: string[];
  apps: { id: string; name: string; slug: string; tags: string[] }[];
  influencers: { id: string; name: string; slug: string; tags: string[] }[];
};

export async function GET() {
  const [allImages, allApps, allInfluencers] = await Promise.all([
    db.select({
      tag: images.tag,
      scope: images.scope,
      appId: images.appId,
      influencerId: images.influencerId,
    }).from(images),
    db.select().from(apps).orderBy(apps.name),
    db.select().from(influencers).orderBy(influencers.name),
  ]);

  // Global tags — deduplicated, sorted
  const globalTags = [
    ...new Set(
      allImages
        .filter((i) => i.scope === "global")
        .map((i) => i.tag)
    ),
  ].sort();

  // App tags — grouped by app
  const appGroups = allApps.map((app) => ({
    id: app.id,
    name: app.name,
    slug: app.slug,
    tags: [
      ...new Set(
        allImages
          .filter((i) => i.appId === app.id)
          .map((i) => i.tag)
      ),
    ].sort(),
  }));

  // Influencer tags — grouped by influencer
  const influencerGroups = allInfluencers.map((inf) => ({
    id: inf.id,
    name: inf.name,
    slug: inf.slug,
    tags: [
      ...new Set(
        allImages
          .filter((i) => i.influencerId === inf.id)
          .map((i) => i.tag)
      ),
    ].sort(),
  }));

  const result: TagsResponse = {
    global: globalTags,
    apps: appGroups,
    influencers: influencerGroups,
  };

  return NextResponse.json(result);
}
