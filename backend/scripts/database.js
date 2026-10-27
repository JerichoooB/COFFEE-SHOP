import { pool, validateDatabaseURL } from "../config/database.js";
import { migrate } from "../services/migrations.js";

try {
  validateDatabaseURL(process.env.DATABASE_URL);
  const command = process.argv[2];
  if (command === "migrate") {
    const applied = await migrate(pool);
    for (const name of applied) console.log("Applied " + name);
    console.log(
      applied.length
        ? "Database migrations completed."
        : "Database schema is up to date.",
    );
  } else if (command === "seed") {
    const { seed } = await import("../seeds/products.js");
    await seed(pool);
    console.log("Sample catalog seeded without overwriting existing products.");
  } else throw new Error("Use migrate or seed.");
} catch (error) {
  // Do not print connection details or query values.
  console.error("Database setup failed:", error.code || error.name);
  console.error(
    "Check that DATABASE_URL is a Neon pooled TLS connection string and the database is reachable.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
