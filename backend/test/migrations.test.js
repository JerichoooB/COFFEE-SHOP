import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../services/migrations.js";

function fakePool({ fail = false } = {}) {
  const calls = [],
    applied = new Set();
  let released = false;
  const client = {
    query: async (sql, values) => {
      calls.push(sql);
      if (sql.startsWith("SELECT name FROM schema_migrations"))
        return { rowCount: applied.has(values[0]) ? 1 : 0 };
      if (sql.startsWith("INSERT INTO schema_migrations"))
        applied.add(values[0]);
      if (fail && sql.includes("ALTER TABLE products ADD COLUMN"))
        throw Error("migration failed");
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { connect: async () => client },
    calls,
    released: () => released,
  };
}
test("migrations use one pooled-connection-safe transaction and skip applied files", async () => {
  const t = fakePool();
  assert.deepEqual(await migrate(t.pool), [
    "001_initial.sql",
    "002_drink_sizes.sql",
  ]);
  assert.deepEqual(t.calls.slice(0, 2), [
    "BEGIN",
    "SELECT pg_advisory_xact_lock(8472191)",
  ]);
  assert.equal(t.calls.at(-1), "COMMIT");
  assert.ok(t.released());
  const boundary = t.calls.length;
  assert.deepEqual(await migrate(t.pool), []);
  assert.ok(
    !t.calls
      .slice(boundary)
      .some((sql) => sql.includes("ALTER TABLE products ADD COLUMN")),
  );
});
test("a failed schema migration rolls back and releases its connection", async () => {
  const t = fakePool({ fail: true });
  await assert.rejects(migrate(t.pool), /migration failed/);
  assert.equal(t.calls.at(-1), "ROLLBACK");
  assert.ok(!t.calls.includes("COMMIT"));
  assert.ok(t.released());
});
