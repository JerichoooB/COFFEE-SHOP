import { readFile, readdir } from "node:fs/promises";
import { pool, validateDatabaseURL } from "../config/database.js";
validateDatabaseURL(process.env.DATABASE_URL);
const command = process.argv[2];
try {
  if (command === "migrate") {
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(8472191)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
      );
      const files = (await readdir(new URL("../migrations/", import.meta.url)))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const name of files) {
        if (
          (
            await client.query(
              "SELECT name FROM schema_migrations WHERE name=$1",
              [name],
            )
          ).rowCount
        )
          continue;
        await client.query("BEGIN");
        try {
          await client.query(
            await readFile(
              new URL("../migrations/" + name, import.meta.url),
              "utf8",
            ),
          );
          await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
            name,
          ]);
          await client.query("COMMIT");
          console.log("Applied " + name);
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock(8472191)");
      client.release();
    }
  } else if (command === "seed") {
    const { seed } = await import("../seeds/products.js");
    await seed(pool);
    console.log("Sample catalog seeded without overwriting existing products.");
  } else throw new Error("Use migrate or seed.");
} catch (e) {
  console.error("Database setup failed:", e.code || e.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
