import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  receiptContent,
  deliverReceipt,
  safelyDeliverReceipt,
  gmailTransportOptions,
} from "../services/receipts.js";
import { createApp } from "../app.js";
const id = "11111111-1111-4111-8111-111111111111";
const order = {
  id,
  customer_name: "Coffee Friend",
  total_amount: "410.00",
  order_type: "pickup",
  notes: "No sugar",
  items: [
    {
      product_name: "Signature Latte",
      size: "Large",
      quantity: 2,
      unit_price: "205.00",
    },
  ],
};
const env = {
  GMAIL_USER: "sender@gmail.com",
  GMAIL_APP_PASSWORD: "abcdefghijklmnop",
};
function fakeDb({ status = "pending", claim = true } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT * FROM order_receipts"))
        return {
          rows: [
            { order_id: id, recipient_email: "customer@example.com", status },
          ],
        };
      if (sql.startsWith("UPDATE order_receipts SET status='sending'"))
        return {
          rows: claim ? [{ recipient_email: "customer@example.com" }] : [],
        };
      if (sql.startsWith("SELECT o.*")) return { rows: [order] };
      return { rows: [] };
    },
  };
}
test("receipt shows item sizes, correct totals and unpaid counter payment", () => {
  const content = receiptContent(order);
  assert.match(content.text, /2 × Signature Latte · Large — ₱410.00/);
  assert.match(content.text, /Total: ₱410.00/);
  assert.match(content.text, /Payment has not been collected online/);
  assert.match(content.subject, /11111111/);
});
test("receipt HTML escapes customer-supplied names and notes", () => {
  const content = receiptContent({
    ...order,
    customer_name: "<script>alert(1)</script>",
    notes: "<img src=x onerror=alert(1)>",
  });
  assert.ok(!content.html.includes("<script>"));
  assert.ok(!content.html.includes("<img src=x"));
  assert.ok(content.html.includes("&lt;script&gt;"));
});
test("missing provider credentials leave receipt pending without external requests", async () => {
  const db = fakeDb();
  let calls = 0;
  const result = await deliverReceipt(db, id, {
    env: {},
    mailer: async () => {
      calls++;
    },
  });
  assert.equal(result.status, "pending");
  assert.equal(calls, 0);
  assert.ok(!db.calls.some((c) => c.sql.startsWith("UPDATE")));
});
test("delivery uses saved recipient, stable message ID, and records Gmail acceptance", async () => {
  const db = fakeDb();
  let sent;
  const result = await deliverReceipt(db, id, {
    env,
    mailer: async (message) => {
      sent = message;
      return {
        accepted: ["customer@example.com"],
        messageId: message.messageId,
      };
    },
  });
  assert.equal(result.status, "sent");
  assert.equal(sent.messageId, `<brew-haven-receipt-${id}@gmail.com>`);
  assert.deepEqual(sent.to, ["customer@example.com"]);
  assert.equal(sent.from, "Brew Haven <sender@gmail.com>");
  assert.deepEqual(db.calls.at(-1).params, [id, sent.messageId]);
});
test("Gmail transport retains certificate verification and normalizes app password spaces", () => {
  const options = gmailTransportOptions({
    ...env,
    GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  });
  assert.equal(options.host, "smtp.gmail.com");
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.auth.pass, "abcdefghijklmnop");
  assert.equal(options.tls.minVersion, "TLSv1.2");
  assert.notEqual(options.tls.rejectUnauthorized, false);
});
test("already sent receipts and concurrent claims do not send duplicate emails", async () => {
  for (const options of [{ status: "sent" }, { claim: false }]) {
    let sent = false;
    const result = await deliverReceipt(fakeDb(options), id, {
      env,
      mailer: async () => {
        sent = true;
      },
    });
    assert.equal(result.status, options.status === "sent" ? "sent" : "sending");
    assert.equal(sent, false);
  }
});
test("provider failures are recorded without secrets or raw provider messages", async () => {
  const db = fakeDb();
  const result = await deliverReceipt(db, id, {
    env,
    mailer: async () => {
      throw Object.assign(new Error("private details"), { code: "EAUTH" });
    },
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(db.calls.at(-1).params, [id, "sender_authentication"]);
});
test("a provider timeout is recorded and a database outage is safely deferred", async () => {
  const db = fakeDb();
  await deliverReceipt(db, id, {
    env,
    mailer: async () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    },
  });
  assert.equal(db.calls.at(-1).params[1], "delivery_timeout");
  const previous = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await safelyDeliverReceipt(
        {
          query: async () => {
            throw Error("offline");
          },
        },
        id,
        { env },
      ),
      { status: "pending" },
    );
  } finally {
    console.error = previous;
  }
});
const secret = "receipt-test-secret-at-least-32-characters";
const cookie = `brewhaven_session=${jwt.sign({ sub: id }, secret, { issuer: "brew-haven", audience: "brew-haven-web" })}`;
const user = {
  id,
  full_name: "Coffee Friend",
  email: "customer@example.com",
  role: "customer",
};
test("receipt retry enforces order ownership and rejects alternate recipients", async () => {
  let sends = 0;
  const app = createApp({
    secret,
    db: {
      query: async (sql, values) => {
        if (sql.startsWith("SELECT id,full_name")) return { rows: [user] };
        assert.ok(sql.includes("user_id=$2"));
        assert.equal(values[1], id);
        return { rows: [] };
      },
    },
    sendReceipt: async () => {
      sends++;
      return { status: "sent" };
    },
  });
  await request(app)
    .post(`/api/orders/${id}/receipt`)
    .set("Origin", "http://localhost:5173")
    .expect(401);
  await request(app)
    .post(`/api/orders/${id}/receipt`)
    .set("Origin", "http://localhost:5173")
    .set("Cookie", cookie)
    .send({ recipient: "attacker@example.com" })
    .expect(400);
  await request(app)
    .post(`/api/orders/${id}/receipt`)
    .set("Origin", "http://localhost:5173")
    .set("Cookie", cookie)
    .send({})
    .expect(404);
  assert.equal(sends, 0);
});
test("email failure after checkout preserves the committed order and returns 201", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push(sql);
      if (sql.startsWith("SELECT id FROM carts"))
        return { rows: [{ id: "cart" }] };
      if (sql.startsWith("SELECT ci.quantity"))
        return {
          rows: [
            {
              id,
              name: "Latte",
              quantity: 1,
              price: "165",
              is_available: true,
            },
          ],
        };
      if (sql.startsWith("INSERT INTO orders("))
        return { rows: [{ id, total_amount: "165.00" }] };
      return { rows: [] };
    },
    release() {},
  };
  const db = {
    query: async () => ({ rows: [user] }),
    connect: async () => client,
  };
  const previous = console.error;
  console.error = () => {};
  try {
    const app = createApp({
      db,
      secret,
      sendReceipt: async () => {
        assert.equal(calls.at(-1), "COMMIT");
        throw Error("email offline");
      },
    });
    const response = await request(app)
      .post("/api/orders")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", cookie)
      .send({
        customer_name: "Coffee Friend",
        contact_number: "09123456789",
        order_type: "pickup",
      })
      .expect(201);
    assert.equal(response.body.id, id);
    assert.equal(response.body.receipt_status, "pending");
    assert.ok(
      calls.some((sql) => sql.startsWith("INSERT INTO order_receipts")),
    );
    assert.ok(!calls.includes("ROLLBACK"));
  } finally {
    console.error = previous;
  }
});

test("checkout responds while Gmail delivery is still running", async () => {
  let finishDelivery;
  const pending = new Promise((resolve) => {
    finishDelivery = resolve;
  });
  const client = {
    query: async (sql) => {
      if (sql.startsWith("SELECT id FROM carts"))
        return { rows: [{ id: "cart" }] };
      if (sql.startsWith("SELECT ci.quantity"))
        return {
          rows: [
            {
              id,
              name: "Latte",
              quantity: 1,
              price: "165",
              is_available: true,
            },
          ],
        };
      if (sql.startsWith("INSERT INTO orders("))
        return { rows: [{ id, total_amount: "165.00" }] };
      return { rows: [] };
    },
    release() {},
  };
  const app = createApp({
    secret,
    db: { query: async () => ({ rows: [user] }), connect: async () => client },
    sendReceipt: () => pending,
  });
  try {
    await request(app)
      .post("/api/orders")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", cookie)
      .send({
        customer_name: "Coffee Friend",
        contact_number: "09123456789",
        order_type: "pickup",
      })
      .timeout(1000)
      .expect(201);
  } finally {
    finishDelivery({ status: "sent" });
  }
});
