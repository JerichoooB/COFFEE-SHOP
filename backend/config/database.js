import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
export function validateDatabaseURL(value) {
  if (!value)
    throw new Error(
      "DATABASE_URL is required. Add a Neon pooled PostgreSQL connection string to backend/.env.",
    );
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname.endsWith(".neon.tech") ||
    !url.hostname.includes("-pooler.")
  )
    throw new Error("DATABASE_URL must use a Neon pooled PostgreSQL host.");
  if (
    !["require", "verify-full", "verify-ca"].includes(
      url.searchParams.get("sslmode"),
    )
  )
    throw new Error(
      "Keep sslmode=require or a stronger TLS mode in the Neon connection string.",
    );
  return value;
}
// Preserve all TLS parameters supplied by Neon. No rejectUnauthorized overrides.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
    ? validateDatabaseURL(process.env.DATABASE_URL)
    : undefined,
  max: 10,
  connectionTimeoutMillis: 7000,
  idleTimeoutMillis: 30000,
});
pool.on("error", () => console.error("An idle database connection failed."));
