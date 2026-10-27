import { readFile, readdir } from "node:fs/promises";

export async function migrate(pool) {
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query("BEGIN");
    // Transaction-scoped locks work with Neon's pooled connections.
    await client.query("SELECT pg_advisory_xact_lock(8472191)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const directory = new URL("../migrations/", import.meta.url);
    const files = (await readdir(directory))
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
      await client.query(await readFile(new URL(name, directory), "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      applied.push(name);
    }
    await client.query("COMMIT");
    return applied;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
