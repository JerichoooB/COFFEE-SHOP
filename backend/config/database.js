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
// Keep today's certificate/hostname verification explicit across future pg upgrades.
// Preserve every other Neon parameter, including channel_binding and certificates.
export function poolConnectionString(value) {
  const url = new URL(validateDatabaseURL(value));
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
// No rejectUnauthorized overrides or disabled verification.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
    ? poolConnectionString(process.env.DATABASE_URL)
    : undefined,
  max: 10,
  connectionTimeoutMillis: 7000,
  idleTimeoutMillis: 30000,
});
pool.on("error", () => console.error("An idle database connection failed."));
