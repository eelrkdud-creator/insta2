import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be configured.");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
try {
  const schema = await readFile(
    new URL("../db/001_posts.sql", import.meta.url),
    "utf8",
  );
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await sql.transaction(
    statements.map((statement) => sql.query(statement, [])),
  );
  console.log("PostgreSQL metadata table and index are ready.");
} catch {
  console.error(
    "Database migration failed. Check connection and schema permissions.",
  );
  process.exit(1);
}
