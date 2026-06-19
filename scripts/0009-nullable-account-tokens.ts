import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
  await sql`ALTER TABLE tiktok_accounts ALTER COLUMN access_token DROP NOT NULL`;
  await sql`ALTER TABLE tiktok_accounts ALTER COLUMN tiktok_user_id DROP NOT NULL`;
  console.log("Migration 0009 done");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
