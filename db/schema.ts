import { pgTable, text, integer, bigint, primaryKey } from "drizzle-orm/pg-core";

export const apps = pgTable("apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const influencers = pgTable("influencers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  referenceImagePath: text("reference_image_path"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Tagged image library — used for carousel slide resolution.
export const images = pgTable("images", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  path: text("path").notNull(),
  tag: text("tag").notNull(),
  scope: text("scope").notNull(), // 'global' | 'app' | 'influencer'
  appId: text("app_id").references(() => apps.id, { onDelete: "cascade" }),
  influencerId: text("influencer_id").references(() => influencers.id, {
    onDelete: "cascade",
  }),
  width: integer("width"),
  height: integer("height"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const folders = pgTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const carousels = pgTable("carousels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortId: text("short_id").unique(),
  appId: text("app_id").references(() => apps.id, { onDelete: "set null" }),
  influencerId: text("influencer_id").references(() => influencers.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("draft"),
  renderText: integer("render_text").notNull().default(1),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
  archivedAt: bigint("archived_at", { mode: "number" }),
  scheduledDate: text("scheduled_date"), // "YYYY-MM-DD"
  publishedAt: bigint("published_at", { mode: "number" }),
  stats: text("stats"), // JSON: {views,likes,comments,shares,saves}
  videoTitle: text("video_title"),
  videoDescription: text("video_description"),
  videoHashtags: text("video_hashtags"), // JSON array string, e.g. '["gymtok","musclegrowth",...]'
  jsonSource: text("json_source"),
  zipPath: text("zip_path"),
  // TikTok draft info
  sentToAccountId: text("sent_to_account_id"),
  sentAt: bigint("sent_at", { mode: "number" }),
  // Publisher user assignment
  publisherUserId: text("publisher_user_id").references(() => publisherUsers.id, { onDelete: "set null" }),
  scheduledTime: text("scheduled_time"), // "HH:MM", e.g. "10:30"
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const carouselSlides = pgTable("carousel_slides", {
  id: text("id").primaryKey(),
  carouselId: text("carousel_id")
    .notNull()
    .references(() => carousels.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  imageId: text("image_id").references(() => images.id, {
    onDelete: "set null",
  }),
  generatedImagePath: text("generated_image_path"),
  texts: text("texts").notNull().default("[]"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const hashtags = pgTable("hashtags", {
  id: text("id").primaryKey(),
  tag: text("tag").notNull().unique(), // sin el símbolo #
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const userTiktokAccounts = pgTable(
  "user_tiktok_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => publisherUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tiktokAccounts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.accountId] })]
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const publisherUsers = pgTable("publisher_users", {
  id: text("id").primaryKey(), // matches Supabase auth.users.id
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const tiktokAccounts = pgTable("tiktok_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tiktokUserId: text("tiktok_user_id").unique(),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: bigint("token_expires_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type Influencer = typeof influencers.$inferSelect;
export type NewInfluencer = typeof influencers.$inferInsert;
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export type Carousel = typeof carousels.$inferSelect;
export type NewCarousel = typeof carousels.$inferInsert;
export type CarouselSlide = typeof carouselSlides.$inferSelect;
export type NewCarouselSlide = typeof carouselSlides.$inferInsert;

export type TiktokAccount = typeof tiktokAccounts.$inferSelect;
export type NewTiktokAccount = typeof tiktokAccounts.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type Hashtag = typeof hashtags.$inferSelect;
export type NewHashtag = typeof hashtags.$inferInsert;
export type PublisherUser = typeof publisherUsers.$inferSelect;
export type NewPublisherUser = typeof publisherUsers.$inferInsert;

export type TextElement = {
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  fontFamily: string;
  align: "left" | "center" | "right";
  width: number;
  stroke?: boolean;
  strokeWidth?: number;
};
