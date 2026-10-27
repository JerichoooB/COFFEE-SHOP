import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp, checkoutSchema } from "../app.js";
import { createOrder, totalCents } from "../orders.js";
import { validateDatabaseURL } from "../config/database.js";
const secret = "test-only-secret-with-at-least-32-characters";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Test Customer",
  email: "test@example.com",
  role: "customer",
};
const cookie = () =>
  `brewhaven_session=${jwt.sign({ sub: user.id }, secret, { issuer: "brew-haven", audience: "brew-haven-web" })}`;
const db = {
  query: async (sql) => {
    if (sql.includes("FROM users WHERE id")) return { rows: [user] };
    return { rows: [] };
  },
};
const app = () => createApp({ db, secret });
test("health checks the database and reports failure without connection details", async () => {
  let checked = false;
  const healthy = createApp({
    secret,
    db: {
      query: async (sql) => {
        assert.equal(sql, "SELECT NOW()");
        checked = true;
      },
    },
  });
  await request(healthy)
    .get("/api/health")
    .expect(200, { status: "ok", database: "connected" });
  assert.ok(checked);
  const failed = createApp({
    secret,
    db: {
      query: async () => {
        throw Error("private connection string");
      },
    },
  });
  const r = await request(failed).get("/api/health").expect(503);
  assert.deepEqual(r.body, { status: "unavailable", database: "disconnected" });
});
test("missing database is explicitly unavailable", async () => {
  await request(createApp({ db, secret, databaseConfigured: false }))
    .get("/api/products")
    .expect(503);
});
test("unauthenticated carts and orders are protected", async () => {
  await request(app()).get("/api/cart").expect(401);
  await request(app()).get("/api/orders/my-orders").expect(401);
});
test("customer cannot call admin APIs", async () => {
  for (const path of [
    "/api/admin/orders",
    "/api/admin/customers",
    "/api/admin/dashboard/stats",
  ])
    await request(app()).get(path).set("Cookie", cookie()).expect(403);
  await request(app())
    .post("/api/products")
    .set("Origin", "http://localhost:5173")
    .set("Cookie", cookie())
    .send({})
    .expect(403);
});
test("cross-origin mutations are rejected, including logout", async () => {
  await request(app())
    .post("/api/auth/logout")
    .set("Origin", "https://attacker.example")
    .expect(403);
  await request(app()).post("/api/auth/logout").expect(403);
});
test("logout expires the HttpOnly session cookie", async () => {
  const r = await request(app())
    .post("/api/auth/logout")
    .set("Origin", "http://localhost:5173")
    .expect(204);
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.match(r.headers["set-cookie"][0], /SameSite=Lax/);
  assert.match(r.headers["set-cookie"][0], /Expires=Thu, 01 Jan 1970/);
});
test("invalid product IDs and cart quantities are rejected before querying", async () => {
  await request(app()).get("/api/products/not-an-id").expect(400);
  await request(app())
    .post("/api/cart/items")
    .set("Origin", "http://localhost:5173")
    .set("Cookie", cookie())
    .send({ product_id: user.id, quantity: 21 })
    .expect(400);
});
test("checkout rejects browser-submitted prices and totals", () => {
  assert.throws(() =>
    checkoutSchema.parse({
      customer_name: "Test",
      contact_number: "09123456789",
      order_type: "pickup",
      total_amount: 1,
    }),
  );
});
test("only Neon pooled TLS database URLs are accepted", () => {
  assert.throws(() => validateDatabaseURL("postgres://localhost/shop"));
  assert.throws(() =>
    validateDatabaseURL(
      "postgres://u:p@ep-example-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=disable",
    ),
  );
  assert.ok(
    validateDatabaseURL(
      "postgres://u:p@ep-example-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require",
    ),
  );
});
test("money totals use integer cents", () => {
  assert.equal(
    totalCents([
      { price: "0.10", quantity: 3 },
      { price: "165.25", quantity: 2 },
    ]),
    33080,
  );
});
function transactionDb(items, { failInsert = false } = {}) {
  const calls = [];
  let released = false;
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT id FROM carts"))
        return { rows: [{ id: "cart" }] };
      if (sql.startsWith("SELECT ci.quantity")) return { rows: items };
      if (sql.startsWith("INSERT INTO orders("))
        return { rows: [{ id: "order", total_amount: values[1] }] };
      if (failInsert && sql.startsWith("INSERT INTO order_items"))
        throw Error("insert failed");
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };
  return {
    db: { connect: async () => client },
    calls,
    released: () => released,
  };
}
const checkout = {
  customer_name: "Test",
  contact_number: "09123456789",
  order_type: "pickup",
  notes: "",
};
test("checkout uses database prices, inserts snapshots, clears cart and commits", async () => {
  const t = transactionDb([
    {
      id: "product",
      name: "Latte",
      price: "165.50",
      quantity: 2,
      is_available: true,
    },
  ]);
  const order = await createOrder(t.db, user.id, checkout);
  assert.equal(order.total_amount, "331.00");
  assert.ok(t.calls.some((c) => c.sql.includes("FOR UPDATE")));
  const insert = t.calls.find((c) =>
    c.sql.startsWith("INSERT INTO order_items"),
  );
  assert.deepEqual(insert.values, ["order", "product", "Latte", 2, "165.50"]);
  assert.ok(t.calls.some((c) => c.sql.startsWith("DELETE FROM cart_items")));
  assert.equal(t.calls.at(-1).sql, "COMMIT");
  assert.ok(t.released());
});
test("checkout rolls back when an item insert fails and retains the cart", async () => {
  const t = transactionDb(
    [
      {
        id: "p",
        name: "Coffee",
        price: "100",
        quantity: 1,
        is_available: true,
      },
    ],
    { failInsert: true },
  );
  await assert.rejects(createOrder(t.db, user.id, checkout));
  assert.equal(t.calls.at(-1).sql, "ROLLBACK");
  assert.ok(!t.calls.some((c) => c.sql.startsWith("DELETE FROM cart_items")));
  assert.ok(t.released());
});
test("empty and unavailable carts cannot create orders", async () => {
  for (const items of [[], [{ is_available: false }]]) {
    const t = transactionDb(items);
    await assert.rejects(createOrder(t.db, user.id, checkout));
    assert.equal(t.calls.at(-1).sql, "ROLLBACK");
    assert.ok(!t.calls.some((c) => c.sql.startsWith("INSERT INTO orders")));
  }
});
