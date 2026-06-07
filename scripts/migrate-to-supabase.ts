/**
 * Migración one-shot: lee datos de SQLite local, sube archivos a Supabase Storage
 * e inserta todos los registros en PostgreSQL.
 *
 * Uso: npx tsx scripts/migrate-to-supabase.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import ws from "ws";

// ---- Clientes ----
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { realtime: { transport: ws } }
);

const pgClient = postgres(process.env.DATABASE_URL!, { ssl: "require" });
const pg = drizzlePg(pgClient, { schema });

const sqlitePath = path.join(process.cwd(), "plataforma.db");
const sqlite = new Database(sqlitePath);
const sq = drizzleSqlite(sqlite, { schema });

const BUCKET = "uploads";

async function upload(storagePath: string, localRelPath: string, mime: string): Promise<string | null> {
  const absPath = path.join(process.cwd(), "public", localRelPath);
  try {
    const buffer = await readFile(absPath);
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType: mime, upsert: true });
    if (error) { console.error(`  ✗ ${storagePath}: ${error.message}`); return null; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch {
    console.error(`  ✗ No existe en disco: ${localRelPath}`);
    return null;
  }
}

function mime(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".zip") return "application/zip";
  return "image/jpeg";
}

async function main() {
  console.log("🚀 Leyendo datos de SQLite...\n");

  const apps = sq.select().from(schema.apps).all();
  const influencers = sq.select().from(schema.influencers).all();
  const images = sq.select().from(schema.images).all();
  const carousels = sq.select().from(schema.carousels).all();
  const slides = sq.select().from(schema.carouselSlides).all();
  const settings = sq.select().from(schema.settings).all();
  const tiktok = sq.select().from(schema.tiktokAccounts).all();

  console.log(`Apps: ${apps.length}, Influencers: ${influencers.length}, Images: ${images.length}`);
  console.log(`Carousels: ${carousels.length}, Slides: ${slides.length}\n`);

  // 1. Apps
  if (apps.length) {
    await pg.insert(schema.apps).values(apps).onConflictDoNothing();
    console.log(`✓ ${apps.length} apps insertados`);
  }

  // 2. Influencers + reference images
  for (const inf of influencers) {
    let refPath = inf.referenceImagePath;
    if (refPath && !refPath.startsWith("http")) {
      const filename = path.basename(refPath);
      const url = await upload(`references/${filename}`, refPath, mime(refPath));
      if (url) { refPath = url; console.log(`  ✓ ref ${inf.name}`); }
    }
    await pg.insert(schema.influencers).values({ ...inf, referenceImagePath: refPath }).onConflictDoNothing();
  }
  console.log(`✓ ${influencers.length} influencers insertados`);

  // 3. Images → subir a Storage
  const imageUrlMap: Record<string, string> = {};
  for (const img of images) {
    let imgPath = img.path;
    if (!imgPath.startsWith("http")) {
      const filename = path.basename(imgPath);
      const url = await upload(`images/${filename}`, imgPath, mime(imgPath));
      if (url) { imgPath = url; imageUrlMap[img.id] = url; console.log(`  ✓ ${img.filename}`); }
    } else {
      imageUrlMap[img.id] = imgPath;
    }
    await pg.insert(schema.images).values({ ...img, path: imgPath }).onConflictDoNothing();
  }
  console.log(`✓ ${images.length} imágenes insertadas\n`);

  // 4. Settings
  if (settings.length) {
    await pg.insert(schema.settings).values(settings).onConflictDoNothing();
    console.log(`✓ ${settings.length} settings insertados`);
  }

  // 5. TikTok accounts
  if (tiktok.length) {
    await pg.insert(schema.tiktokAccounts).values(tiktok).onConflictDoNothing();
    console.log(`✓ ${tiktok.length} cuentas TikTok insertadas`);
  }

  // 6. Carousels
  const carouselUrlMap: Record<string, string> = {};
  for (const c of carousels) {
    let zipPath = c.zipPath;
    if (zipPath && !zipPath.startsWith("http")) {
      const filename = path.basename(zipPath);
      const url = await upload(`generated/${filename}`, zipPath, "application/zip");
      if (url) { zipPath = url; carouselUrlMap[c.id] = url; console.log(`  ✓ zip ${c.name}`); }
    }
    await pg.insert(schema.carousels).values({ ...c, zipPath }).onConflictDoNothing();
  }
  console.log(`✓ ${carousels.length} carousels insertados\n`);

  // 7. Slides + generated images
  for (const s of slides) {
    let genPath = s.generatedImagePath;
    if (genPath && !genPath.startsWith("http")) {
      const filename = path.basename(genPath);
      const url = await upload(`generated/${filename}`, genPath, "image/jpeg");
      if (url) { genPath = url; console.log(`  ✓ slide ${s.id}`); }
    }
    await pg.insert(schema.carouselSlides).values({ ...s, generatedImagePath: genPath }).onConflictDoNothing();
  }
  console.log(`✓ ${slides.length} slides insertados`);

  console.log("\n✅ Migración completada.");
  await pgClient.end();
  sqlite.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
