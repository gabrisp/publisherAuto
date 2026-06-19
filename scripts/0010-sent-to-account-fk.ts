import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
  await sql`
    ALTER TABLE carousels
    ADD CONSTRAINT carousels_sent_to_account_id_fkey
    FOREIGN KEY (sent_to_account_id) REFERENCES tiktok_accounts(id) ON DELETE SET NULL
  `;
  console.log("Migration 0010 done");
  await sql.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
