import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import { clientRateLimitKey } from "./middleware/rateLimit.js";
import { z } from "zod";
import {
  auth,
  admin,
  issueSession,
  cookieName,
  cookieOptions,
  originGuard,
  publicUser,
} from "./middleware/security.js";
import { priceForSize } from "./pricing.js";
import { createOrder, HttpError } from "./orders.js";
const uuid = z.string().uuid();
const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(15, "Password must be at most 15 characters.")
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "Password must be at most 72 bytes.",
  );
const productSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    price: z
      .number()
      .positive()
      .max(100000)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-7,
        "Use at most two decimal places.",
      ),
    category_id: uuid,
    image_url: z
      .url()
      .refine((s) => s.startsWith("https://"), "Use an HTTPS image URL.")
      .max(2000),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    size_options: z
      .array(
        z.object({
          name: z.enum(["Small", "Medium", "Large"]),
          price: z
            .number()
            .positive()
            .max(100000)
            .refine(
              (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-7,
              "Use at most two decimal places.",
            ),
        }),
      )
      .default([]),
  })
  .superRefine((p, ctx) => {
    if (!p.size_options.length) return;
    if (
      p.size_options.length !== 3 ||
      p.size_options.map((o) => o.name).join(",") !== "Small,Medium,Large"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["size_options"],
        message: "Provide Small, Medium, and Large prices in that order.",
      });
      return;
    }
    if (
      p.size_options[0].price !== p.price ||
      p.size_options[1].price < p.price ||
      p.size_options[2].price < p.size_options[1].price
    )
      ctx.addIssue({
        code: "custom",
        path: ["size_options"],
        message:
          "Small must match the base price; prices must increase or stay equal for larger sizes.",
      });
  });
const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().max(500).default(""),
});
export const checkoutSchema = z
  .object({
    customer_name: z.string().trim().min(1).max(100),
    contact_number: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[+\d\s()-]+$/),
    order_type: z.enum(["pickup", "dine-in"]),
    notes: z.string().trim().max(1000).default(""),
  })
  .strict();
const productSelect =
  "SELECT p.*,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id";
const orderSelect = `SELECT o.*,COALESCE((SELECT json_agg(i ORDER BY i.id) FROM order_items i WHERE i.order_id=o.id),'[]'::json) AS items FROM orders o`;
export function createApp({
  db,
  secret,
  clientUrl = "http://localhost:5173",
  databaseConfigured = true,
  vercel = process.env.VERCEL === "1",
}) {
  const app = express();
  app.disable("x-powered-by");
  const keyGenerator = (request) => clientRateLimitKey(request, vercel);
  app.use(helmet());
  app.use(cors({ origin: clientUrl, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", originGuard(clientUrl));
  app.use(
    "/api",
    rateLimit({
      keyGenerator,
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again shortly." },
    }),
  );
  const authenticate = auth(db, secret),
    protectedAdmin = [authenticate, admin];
  const limitedAuth = rateLimit({
    keyGenerator,
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please try again later." },
  });
  app.get("/api/health", async (req, res) => {
    if (!databaseConfigured)
      return res
        .status(503)
        .json({ status: "unavailable", database: "disconnected" });
    try {
      await db.query("SELECT NOW()");
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(503).json({ status: "unavailable", database: "disconnected" });
    }
  });
  app.use("/api", (req, res, next) => {
    if (!databaseConfigured)
      return res.status(503).json({
        error:
          "The café database is not connected yet. Please try again later.",
      });
    next();
  });
  app.post("/api/auth/register", limitedAuth, async (req, res) => {
    const data = z
      .object({ full_name: z.string().trim().min(1).max(100), email, password })
      .parse(req.body);
    const hash = await bcrypt.hash(data.password, 12);
    const r = await db.query(
      "INSERT INTO users(full_name,email,password_hash) VALUES($1,$2,$3) RETURNING id,full_name,email,role",
      [data.full_name, data.email, hash],
    );
    issueSession(res, r.rows[0], secret);
    res.status(201).json(r.rows[0]);
  });
  app.post("/api/auth/login", limitedAuth, async (req, res) => {
    const data = z
      .object({ email, password: z.string().min(1).max(72) })
      .parse(req.body);
    const result = await db.query("SELECT * FROM users WHERE email=$1", [
      data.email,
    ]);
    const user = result.rows[0];
    const valid = await bcrypt.compare(
      data.password,
      user?.password_hash ||
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxYLHFrcDapQ.eChMZ8P7V2cC1G",
    );
    if (!user || !valid)
      throw new HttpError(401, "Email or password is incorrect.");
    issueSession(res, user, secret);
    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    });
  });
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(cookieName, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: "/",
    });
    res.status(204).end();
  });
  app.get("/api/auth/me", authenticate, (req, res) =>
    res.json(publicUser(req.user)),
  );
  app.put("/api/auth/me", authenticate, limitedAuth, async (req, res) => {
    const data = z
      .object({
        full_name: z.string().trim().min(1).max(100),
        email,
        current_password: z.string().min(1).max(72).optional(),
      })
      .strict()
      .parse(req.body);
    const current = (
      await db.query("SELECT password_hash,email FROM users WHERE id=$1", [
        req.user.id,
      ])
    ).rows[0];
    if (!current) throw new HttpError(401, "Please sign in again.");
    const changingEmail = data.email !== current.email;
    if (
      changingEmail &&
      (!data.current_password ||
        !(await bcrypt.compare(data.current_password, current.password_hash)))
    )
      throw new HttpError(
        400,
        "Enter your correct current password to change your email.",
      );
    const result = await db.query(
      "UPDATE users SET full_name=$1,email=$2,session_version=session_version+$3 WHERE id=$4 AND password_hash=$5 AND email=$6 RETURNING id,full_name,email,role,session_version",
      [
        data.full_name,
        data.email,
        changingEmail ? 1 : 0,
        req.user.id,
        current.password_hash,
        current.email,
      ],
    );
    if (!result.rowCount)
      throw new HttpError(
        409,
        "Your account changed during this update. Refresh and try again.",
      );
    issueSession(res, result.rows[0], secret);
    res.json(publicUser(result.rows[0]));
  });
  app.put("/api/auth/password", authenticate, limitedAuth, async (req, res) => {
    const data = z
      .object({
        current_password: z.string().min(1).max(72),
        new_password: password,
      })
      .strict()
      .parse(req.body);
    const current = (
      await db.query("SELECT password_hash FROM users WHERE id=$1", [
        req.user.id,
      ])
    ).rows[0];
    if (
      !current ||
      !(await bcrypt.compare(data.current_password, current.password_hash))
    )
      throw new HttpError(400, "Your current password is incorrect.");
    if (data.current_password === data.new_password)
      throw new HttpError(
        400,
        "Choose a new password different from your current password.",
      );
    const hash = await bcrypt.hash(data.new_password, 12);
    const result = await db.query(
      "UPDATE users SET password_hash=$1,session_version=session_version+1 WHERE id=$2 AND password_hash=$3 RETURNING id,full_name,email,role,session_version",
      [hash, req.user.id, current.password_hash],
    );
    if (!result.rowCount)
      throw new HttpError(
        409,
        "Your password changed during this update. Please sign in again.",
      );
    issueSession(res, result.rows[0], secret);
    res.json({
      message: "Password updated. Your other sessions have been signed out.",
    });
  });
  app.get("/api/products", async (req, res) => {
    const query = z
      .object({
        category: uuid.optional(),
        search: z.string().max(100).optional(),
      })
      .parse(req.query);
    const values = [],
      where = [];
    if (query.category) {
      values.push(query.category);
      where.push(`p.category_id=$${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search}%`);
      where.push(
        `(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`,
      );
    }
    res.json(
      (
        await db.query(
          productSelect +
            (where.length ? " WHERE " + where.join(" AND ") : "") +
            " ORDER BY p.created_at,p.id",
          values,
        )
      ).rows,
    );
  });
  app.get("/api/products/:id", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const p = (await db.query(productSelect + " WHERE p.id=$1", [id])).rows[0];
    if (!p) throw new HttpError(404, "Product not found.");
    res.json(p);
  });
  app.post("/api/products", ...protectedAdmin, async (req, res) => {
    const p = productSchema.parse(req.body);
    const r = await db.query(
      "INSERT INTO products(name,description,price,category_id,image_url,is_available,is_featured,size_options) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *",
      [
        p.name,
        p.description,
        p.price,
        p.category_id,
        p.image_url,
        p.is_available,
        p.is_featured,
        JSON.stringify(p.size_options),
      ],
    );
    res.status(201).json(r.rows[0]);
  });
  app.put("/api/products/:id", ...protectedAdmin, async (req, res) => {
    const id = uuid.parse(req.params.id),
      p = productSchema.parse(req.body);
    const r = await db.query(
      "UPDATE products SET name=$1,description=$2,price=$3,category_id=$4,image_url=$5,is_available=$6,is_featured=$7,size_options=$8::jsonb WHERE id=$9 RETURNING *",
      [
        p.name,
        p.description,
        p.price,
        p.category_id,
        p.image_url,
        p.is_available,
        p.is_featured,
        JSON.stringify(p.size_options),
        id,
      ],
    );
    if (!r.rowCount) throw new HttpError(404, "Product not found.");
    res.json(r.rows[0]);
  });
  app.delete("/api/products/:id", ...protectedAdmin, async (req, res) => {
    const r = await db.query("DELETE FROM products WHERE id=$1", [
      uuid.parse(req.params.id),
    ]);
    if (!r.rowCount) throw new HttpError(404, "Product not found.");
    res.status(204).end();
  });
  app.get("/api/categories", async (req, res) =>
    res.json((await db.query("SELECT * FROM categories ORDER BY name")).rows),
  );
  app.post("/api/categories", ...protectedAdmin, async (req, res) => {
    const c = categorySchema.parse(req.body);
    res
      .status(201)
      .json(
        (
          await db.query(
            "INSERT INTO categories(name,slug,description) VALUES($1,$2,$3) RETURNING *",
            Object.values(c),
          )
        ).rows[0],
      );
  });
  app.put("/api/categories/:id", ...protectedAdmin, async (req, res) => {
    const c = categorySchema.parse(req.body);
    const r = await db.query(
      "UPDATE categories SET name=$1,slug=$2,description=$3 WHERE id=$4 RETURNING *",
      [...Object.values(c), uuid.parse(req.params.id)],
    );
    if (!r.rowCount) throw new HttpError(404, "Category not found.");
    res.json(r.rows[0]);
  });
  app.delete("/api/categories/:id", ...protectedAdmin, async (req, res) => {
    const r = await db.query("DELETE FROM categories WHERE id=$1", [
      uuid.parse(req.params.id),
    ]);
    if (!r.rowCount) throw new HttpError(404, "Category not found.");
    res.status(204).end();
  });
  app.get("/api/cart", authenticate, async (req, res) => {
    const result = await db.query(
      "SELECT ci.id,ci.product_id,ci.quantity,ci.size,p.name,p.price,p.size_options,p.image_url,p.is_available FROM cart_items ci JOIN carts c ON c.id=ci.cart_id JOIN products p ON p.id=ci.product_id WHERE c.user_id=$1 ORDER BY ci.id",
      [req.user.id],
    );
    res.json(
      result.rows.map((item) => {
        try {
          return { ...item, price: priceForSize(item, item.size) };
        } catch {
          return { ...item, price: null, is_available: false };
        }
      }),
    );
  });
  async function mutateCart(req, operation) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO carts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
        [req.user.id],
      );
      const cart = (
        await client.query("SELECT id FROM carts WHERE user_id=$1 FOR UPDATE", [
          req.user.id,
        ])
      ).rows[0];
      await operation(client, cart.id);
      await client.query("UPDATE carts SET updated_at=now() WHERE id=$1", [
        cart.id,
      ]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  app.post("/api/cart/items", authenticate, async (req, res) => {
    const p = z
      .object({
        product_id: uuid,
        quantity: z.number().int().min(1).max(20),
        size: z
          .enum(["Regular", "Small", "Medium", "Large"])
          .default("Regular"),
      })
      .strict()
      .parse(req.body);
    await mutateCart(req, async (c, id) => {
      const product = (
        await c.query(
          "SELECT id,is_available,price,size_options FROM products WHERE id=$1 FOR SHARE",
          [p.product_id],
        )
      ).rows[0];
      if (!product || !product.is_available)
        throw new HttpError(409, "This product is currently unavailable.");
      priceForSize(product, p.size);
      const existing = (
        await c.query(
          "SELECT quantity FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND size=$3",
          [id, p.product_id, p.size],
        )
      ).rows[0];
      if ((existing?.quantity || 0) + p.quantity > 20)
        throw new HttpError(
          400,
          "A maximum of 20 of each product can be ordered.",
        );
      await c.query(
        "INSERT INTO cart_items(cart_id,product_id,quantity,size) VALUES($1,$2,$3,$4) ON CONFLICT(cart_id,product_id,size) DO UPDATE SET quantity=cart_items.quantity+EXCLUDED.quantity",
        [id, p.product_id, p.quantity, p.size],
      );
    });
    res.status(201).json({ message: "Added to cart." });
  });
  app.patch("/api/cart/items/:id", authenticate, async (req, res) => {
    const id = uuid.parse(req.params.id),
      { quantity } = z
        .object({ quantity: z.number().int().min(1).max(20) })
        .parse(req.body);
    await mutateCart(req, async (c, cartId) => {
      const r = await c.query(
        "UPDATE cart_items SET quantity=$1 WHERE id=$2 AND cart_id=$3",
        [quantity, id, cartId],
      );
      if (!r.rowCount) throw new HttpError(404, "Cart item not found.");
    });
    res.status(204).end();
  });
  app.delete("/api/cart/items/:id", authenticate, async (req, res) => {
    const id = uuid.parse(req.params.id);
    await mutateCart(req, async (c, cartId) => {
      const r = await c.query(
        "DELETE FROM cart_items WHERE id=$1 AND cart_id=$2",
        [id, cartId],
      );
      if (!r.rowCount) throw new HttpError(404, "Cart item not found.");
    });
    res.status(204).end();
  });
  app.post("/api/orders", authenticate, async (req, res) => {
    const data = checkoutSchema.parse(req.body);
    res.status(201).json(await createOrder(db, req.user.id, data));
  });
  app.get("/api/orders/my-orders", authenticate, async (req, res) =>
    res.json(
      (
        await db.query(
          orderSelect + " WHERE o.user_id=$1 ORDER BY o.created_at DESC",
          [req.user.id],
        )
      ).rows,
    ),
  );
  app.get("/api/orders/:id", authenticate, async (req, res) => {
    const order = (
      await db.query(orderSelect + " WHERE o.id=$1 AND o.user_id=$2", [
        uuid.parse(req.params.id),
        req.user.id,
      ])
    ).rows[0];
    if (!order) throw new HttpError(404, "Order not found.");
    res.json(order);
  });
  app.get("/api/admin/orders", ...protectedAdmin, async (req, res) => {
    const status = z
      .enum(["pending", "preparing", "ready", "completed", "cancelled"])
      .optional()
      .parse(req.query.status);
    res.json(
      (
        await db.query(
          orderSelect +
            (status ? " WHERE o.status=$1" : "") +
            " ORDER BY o.created_at DESC",
          status ? [status] : [],
        )
      ).rows,
    );
  });
  app.patch(
    "/api/admin/orders/:id/status",
    ...protectedAdmin,
    async (req, res) => {
      const status = z
        .enum(["pending", "preparing", "ready", "completed", "cancelled"])
        .parse(req.body.status);
      const r = await db.query(
        "UPDATE orders SET status=$1 WHERE id=$2 RETURNING *",
        [status, uuid.parse(req.params.id)],
      );
      if (!r.rowCount) throw new HttpError(404, "Order not found.");
      res.json(r.rows[0]);
    },
  );
  app.get("/api/admin/customers", ...protectedAdmin, async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT id,full_name,email,created_at FROM users WHERE role='customer' ORDER BY created_at DESC",
        )
      ).rows,
    ),
  );
  app.get(
    "/api/admin/customers/:id/orders",
    ...protectedAdmin,
    async (req, res) =>
      res.json(
        (
          await db.query(
            orderSelect + " WHERE o.user_id=$1 ORDER BY o.created_at DESC",
            [uuid.parse(req.params.id)],
          )
        ).rows,
      ),
  );
  app.get("/api/admin/dashboard/stats", ...protectedAdmin, async (req, res) => {
    const [stats, sales, recent] = await Promise.all([
      db.query(
        "SELECT (SELECT count(*)::int FROM orders) total_orders,(SELECT count(*)::int FROM users WHERE role='customer') total_customers,(SELECT COALESCE(sum(total_amount),0) FROM orders WHERE status='completed') total_sales,(SELECT count(*)::int FROM orders WHERE status='pending') pending_orders",
      ),
      db.query(
        "SELECT d::date AS date,COALESCE(sum(o.total_amount),0) AS total FROM generate_series(current_date-6,current_date,'1 day'::interval) d LEFT JOIN orders o ON o.created_at::date=d::date AND o.status='completed' GROUP BY d ORDER BY d",
      ),
      db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5"),
    ]);
    res.json({
      ...stats.rows[0],
      sales: sales.rows,
      recent_orders: recent.rows,
    });
  });
  app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: err.issues
          .map((i) => `${i.path.join(".") || "Request"}: ${i.message}`)
          .join("; "),
      });
    if (err.status && err.status < 500)
      return res.status(err.status).json({ error: err.message });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "That email, name, or slug is already in use." });
    if (err.code === "23503")
      return res.status(409).json({
        error: "This item is in use or its related item no longer exists.",
      });
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON request." });
    console.error("API request failed:", err.code || err.name);
    res.status(503).json({
      error: "The café service is temporarily unavailable. Please try again.",
    });
  });
  return app;
}
