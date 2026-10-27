import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { clientRateLimitKey } from "../middleware/rateLimit.js";
import { createApp } from "../app.js";
import { poolConnectionString } from "../config/database.js";

function incoming(headers = {}, address = "192.0.2.100") {
  return { get: (name) => headers[name], socket: { remoteAddress: address } };
}
test("Vercel rate limits use its authoritative client IP instead of forwarded chains", () => {
  const headers = {
    "x-real-ip": "198.51.100.10",
    "x-forwarded-for": "203.0.113.7",
    forwarded: "for=203.0.113.8",
  };
  assert.equal(clientRateLimitKey(incoming(headers), true), "198.51.100.10");
  assert.equal(
    clientRateLimitKey(
      incoming({ ...headers, "x-forwarded-for": "203.0.113.99" }),
      true,
    ),
    "198.51.100.10",
  );
  assert.notEqual(
    clientRateLimitKey(incoming({ "x-real-ip": "198.51.100.11" }), true),
    "198.51.100.10",
  );
});
test("local requests ignore spoofed headers, and malformed Vercel IPs fall back safely", () => {
  assert.equal(
    clientRateLimitKey(incoming({ "x-real-ip": "198.51.100.10" }), false),
    "192.0.2.100",
  );
  for (const value of [
    "invalid",
    "198.51.100.10, 198.51.100.11",
    "198.51.100.10:1234",
  ]) {
    assert.equal(
      clientRateLimitKey(incoming({ "x-real-ip": value }), true),
      "192.0.2.100",
    );
  }
});
test("IPv6 addresses use subnet keys to prevent rotation bypasses", () => {
  assert.equal(
    clientRateLimitKey(
      incoming({ "x-real-ip": "2001:db8:1234:5600::1" }),
      true,
    ),
    clientRateLimitKey(
      incoming({ "x-real-ip": "2001:db8:1234:56ff::2" }),
      true,
    ),
  );
});
test("Vercel forwarded headers produce no proxy validation errors in either limiter", async () => {
  const errors = [];
  const previous = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const app = createApp({
      vercel: true,
      secret: "a-test-secret-at-least-32-characters",
      db: { query: async () => ({ rows: [] }) },
    });
    const headers = {
      "x-real-ip": "198.51.100.10",
      "x-forwarded-for": "203.0.113.1",
      forwarded: "for=203.0.113.1",
    };
    await request(app).get("/api/products").set(headers).expect(200);
    await request(app)
      .post("/api/auth/login")
      .set(headers)
      .set("Origin", "http://localhost:5173")
      .send({})
      .expect(400);
    assert.deepEqual(errors, []);
  } finally {
    console.error = previous;
  }
});
test("authentication limiter enforces per-client limits on Vercel", async () => {
  const app = createApp({
    vercel: true,
    secret: "a-test-secret-at-least-32-characters",
    db: { query: async () => ({ rows: [] }) },
  });
  for (let i = 0; i < 20; i++)
    await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("x-real-ip", "198.51.100.20")
      .send({})
      .expect(400);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .set("x-real-ip", "198.51.100.20")
    .set("Forwarded", "for=203.0.113.99")
    .send({})
    .expect(429);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .set("x-real-ip", "198.51.100.21")
    .send({})
    .expect(400);
});
test("pool URL makes full TLS verification explicit and preserves Neon parameters", () => {
  const original =
    "postgresql://user:fake-password@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const secured = new URL(poolConnectionString(original));
  assert.equal(secured.searchParams.get("sslmode"), "verify-full");
  assert.equal(secured.searchParams.get("channel_binding"), "require");
  assert.equal(secured.hostname, new URL(original).hostname);
  assert.equal(secured.password, new URL(original).password);
  assert.equal(secured.pathname, "/neondb");
});
