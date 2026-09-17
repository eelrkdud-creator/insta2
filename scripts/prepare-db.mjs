import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (process.env.DATABASE_URL) {
  await import("./migrate.mjs");
} else {
  console.log(
    "DATABASE_URL is not configured: lookup remains available; saving and analytics require a database connection.",
  );
}
