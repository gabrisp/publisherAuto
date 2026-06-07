import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  await sql`ALTER TABLE carousels ADD COLUMN IF NOT EXISTS sent_to_account_id text`;
  await sql`ALTER TABLE carousels ADD COLUMN IF NOT EXISTS sent_at bigint`;
  await sql`
    CREATE TABLE IF NOT EXISTS hashtags (
      id text PRIMARY KEY,
      tag text NOT NULL UNIQUE,
      created_at bigint NOT NULL
    )
  `;

  console.log("✓ Columnas sent_to_account_id, sent_at añadidas a carousels");
  console.log("✓ Tabla hashtags creada");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
