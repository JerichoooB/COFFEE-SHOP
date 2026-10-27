import { pool, validateDatabaseURL } from "../config/database.js";
// Promote an existing registered account. No default admin credentials are created.
try {
  validateDatabaseURL(process.env.DATABASE_URL);
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email)
    throw new Error("Usage: npm run admin -w backend -- owner@example.com");
  const r = await pool.query(
    "UPDATE users SET role='admin' WHERE email=$1 RETURNING id",
    [email],
  );
  if (!r.rowCount)
    throw new Error("Register this account through the website first.");
  console.log("Existing account promoted to administrator.");
} catch (e) {
  console.error(e.code ? "Administrator setup failed: " + e.code : e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
