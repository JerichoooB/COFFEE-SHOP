import { randomBytes } from "node:crypto";
import { pool } from "./config/database.js";
import { createApp } from "./app.js";
const configured = Boolean(process.env.DATABASE_URL);
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    !configured ||
    !process.env.CLIENT_URL)
)
  throw new Error(
    "Production requires DATABASE_URL, CLIENT_URL and a JWT_SECRET of at least 32 characters.",
  );
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET must contain at least 32 characters.");
const secret = process.env.JWT_SECRET || randomBytes(48).toString("hex");
if (!process.env.JWT_SECRET)
  console.warn(
    "Using a temporary development session key; sessions expire on restart. Set JWT_SECRET in backend/.env.",
  );
if (!configured)
  console.warn(
    "DATABASE_URL is missing. Database APIs will return 503; the frontend can display its sample menu.",
  );
export const app = createApp({
  db: pool,
  secret,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  databaseConfigured: configured,
});
