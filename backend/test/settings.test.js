import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
const secret = "settings-test-secret-at-least-32-characters";
const currentPassword = "currentpass123";
const hash = await bcrypt.hash(currentPassword, 4);
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Coffee Friend",
  email: "friend@example.com",
  role: "customer",
  session_version: 0,
};
const cookie = (version = 0) =>
  `brewhaven_session=${jwt.sign({ sub: user.id, version }, secret, { issuer: "brew-haven", audience: "brew-haven-web" })}`;
function setup({ version = 0 } = {}) {
  const writes = [];
  const db = {
    query: async (sql, values) => {
      if (sql.startsWith("SELECT id,full_name"))
        return { rows: [{ ...user, session_version: version }] };
      if (sql.startsWith("SELECT password_hash"))
        return { rows: [{ password_hash: hash, email: user.email }] };
      if (sql.startsWith("UPDATE users")) {
        writes.push({ sql, values });
        return {
          rowCount: 1,
          rows: [
            {
              ...user,
              full_name: sql.includes("SET full_name")
                ? values[0]
                : user.full_name,
              email: sql.includes("SET full_name") ? values[1] : user.email,
              session_version: sql.includes("SET full_name") ? values[2] : 1,
            },
          ],
        };
      }
      throw Error("Unexpected query");
    },
  };
  return { app: createApp({ db, secret }), writes };
}
function put(app, path, body) {
  return request(app)
    .put(path)
    .set("Origin", "http://localhost:5173")
    .set("Cookie", cookie())
    .send(body);
}
test("profile name changes persist without changing roles or leaking password data", async () => {
  const t = setup();
  const r = await put(t.app, "/api/auth/me", {
    full_name: "Coffee Pal",
    email: user.email,
  }).expect(200);
  assert.deepEqual(r.body, {
    id: user.id,
    full_name: "Coffee Pal",
    email: user.email,
    role: "customer",
  });
  assert.equal(t.writes[0].values[2], 0);
  await put(t.app, "/api/auth/me", {
    full_name: "Coffee Pal",
    email: user.email,
    role: "admin",
  }).expect(400);
  assert.equal(t.writes.length, 1);
});
test("changing email requires the correct password and rotates the session", async () => {
  const t = setup();
  const body = { full_name: user.full_name, email: "new@example.com" };
  await put(t.app, "/api/auth/me", body).expect(400);
  await put(t.app, "/api/auth/me", {
    ...body,
    current_password: "incorrect",
  }).expect(400);
  assert.equal(t.writes.length, 0);
  const r = await put(t.app, "/api/auth/me", {
    ...body,
    current_password: currentPassword,
  }).expect(200);
  assert.equal(r.body.email, "new@example.com");
  assert.equal(t.writes[0].values[2], 1);
  const token = r.headers["set-cookie"][0].split(";")[0].split("=")[1];
  assert.equal(jwt.verify(token, secret).version, 1);
});
test("password changes check the current password and enforce 8–15 characters", async () => {
  const t = setup();
  await put(t.app, "/api/auth/password", {
    current_password: "incorrect",
    new_password: "newpass123",
  }).expect(400);
  for (const length of [7, 16])
    await put(t.app, "/api/auth/password", {
      current_password: currentPassword,
      new_password: "a".repeat(length),
    }).expect(400);
  await put(t.app, "/api/auth/password", {
    current_password: currentPassword,
    new_password: currentPassword,
  }).expect(400);
  assert.equal(t.writes.length, 0);
  const r = await put(t.app, "/api/auth/password", {
    current_password: currentPassword,
    new_password: "newpass123",
  }).expect(200);
  assert.ok(await bcrypt.compare("newpass123", t.writes[0].values[0]));
  assert.ok(!("password_hash" in r.body));
  const token = r.headers["set-cookie"][0].split(";")[0].split("=")[1];
  assert.equal(jwt.verify(token, secret).version, 1);
});
test("old sessions are rejected after a credential change; renewed sessions work", async () => {
  const t = setup({ version: 1 });
  await request(t.app).get("/api/auth/me").set("Cookie", cookie(0)).expect(401);
  const r = await request(t.app)
    .get("/api/auth/me")
    .set("Cookie", cookie(1))
    .expect(200);
  assert.equal(r.body.id, user.id);
  assert.ok(!("session_version" in r.body));
});
test("account settings APIs require authentication and the correct origin", async () => {
  const t = setup();
  await request(t.app)
    .put("/api/auth/me")
    .set("Origin", "http://localhost:5173")
    .send({})
    .expect(401);
  await request(t.app)
    .put("/api/auth/password")
    .set("Origin", "http://localhost:5173")
    .send({})
    .expect(401);
  await request(t.app)
    .put("/api/auth/me")
    .set("Origin", "https://attacker.example")
    .set("Cookie", cookie())
    .send({})
    .expect(403);
  assert.equal(t.writes.length, 0);
});
