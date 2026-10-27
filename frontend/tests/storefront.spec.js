import { test, expect } from "@playwright/test";
import { sampleProducts } from "../src/services/catalog.js";

async function mockShop(page, { signedIn = false, admin = false } = {}) {
  let cart = [];
  let placed = null;
  const writes = [];
  const user = {
    id: "test-user",
    full_name: "Coffee Friend",
    email: "friend@example.com",
    role: admin ? "admin" : "customer",
  };
  await page.route("https://images.unsplash.com/**", (route) => route.abort());
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method();
    let body = {};
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (method !== "GET") {
      body = request.postDataJSON() || {};
      writes.push({ path, body });
    }
    if (path === "/api/auth/me")
      return json(
        signedIn || admin ? user : { error: "Sign in" },
        signedIn || admin ? 200 : 401,
      );
    if (path === "/api/products" && method === "GET")
      return json(sampleProducts);
    if (path === "/api/categories")
      return json(
        [...new Set(sampleProducts.map((p) => p.category_name))].map(
          (name, i) => ({ id: "category-" + i, name }),
        ),
      );
    if (path === "/api/cart" && method === "GET") return json(cart);
    if (path === "/api/cart/items" && method === "POST") {
      const product = sampleProducts.find((p) => p.id === body.product_id);
      const price =
        product.size_options.find((s) => s.name === body.size)?.price ??
        product.price;
      const existing = cart.find(
        (i) => i.product_id === product.id && i.size === body.size,
      );
      if (existing) existing.quantity++;
      else
        cart.push({
          ...product,
          id: "line-" + cart.length,
          product_id: product.id,
          size: body.size,
          price,
          quantity: 1,
        });
      return json({}, 201);
    }
    if (path === "/api/orders" && method === "POST") {
      placed = {
        ...body,
        id: "order-12345678",
        status: "pending",
        total_amount: cart.reduce((s, i) => s + i.price * i.quantity, 0),
        items: cart.map((i) => ({
          ...i,
          product_name: i.name,
          unit_price: i.price,
        })),
      };
      cart = [];
      return json({ id: placed.id }, 201);
    }
    if (path.startsWith("/api/orders/order-")) return json(placed);
    if (path === "/api/admin/dashboard/stats")
      return json({
        total_orders: 0,
        total_customers: 0,
        total_sales: 0,
        pending_orders: 0,
        sales: [],
        recent_orders: [],
      });
    if (path === "/api/admin/orders" || path === "/api/admin/customers")
      return json([]);
    if (path.startsWith("/api/products/") && method === "PUT")
      return json(body);
    return json({ error: "Unmocked endpoint" }, 404);
  });
  return writes;
}

test("logo, mobile navigation, search, filters, and sorting", async ({
  page,
  isMobile,
}) => {
  await mockShop(page);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Brew Haven home" }).locator("svg"),
  ).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/logo.svg",
  );
  if (isMobile) {
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Menu", exact: true })
      .click();
  } else await page.getByRole("link", { name: "Explore our menu" }).click();
  await expect(page.locator(".product-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Matcha", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search products" })
    .fill("croissant");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByLabel("Sort products", { exact: true })
    .selectOption("price-high");
  await expect(page.locator(".product-title").first()).toHaveText(
    "Basque Cheesecake",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("drink size selection updates prices; pastries remain single-size", async ({
  page,
}) => {
  await mockShop(page);
  await page.goto("/menu");
  await page
    .getByRole("button", { name: "Choose size for Signature Latte" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /Small/ })).toBeChecked();
  await dialog.getByRole("radio", { name: /Large/ }).check();
  await expect(
    dialog.getByRole("button", { name: /Add to bag · ₱205.00/ }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Add to bag/ }).click();
  await expect(page.getByRole("status")).toContainText("Please sign in");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "View Butter Croissant" }).click();
  await expect(page.getByRole("dialog").getByRole("radio")).toHaveCount(0);
});

test("selected sizes travel through bag, checkout, and order confirmation", async ({
  page,
}) => {
  const writes = await mockShop(page, { signedIn: true });
  await page.goto("/menu");
  for (const size of ["Large", "Small"]) {
    await page
      .getByRole("button", { name: "Choose size for Signature Latte" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: new RegExp(size) }).check();
    await dialog.getByRole("button", { name: /Add to bag/ }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.goto("/cart");
  await expect(page.locator(".cart-item")).toHaveCount(2);
  await expect(page.locator(".cart-size")).toHaveText(["Large", "Small"]);
  await expect(page.locator(".summary")).toContainText("₱370.00");
  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page.locator(".summary")).toContainText(
    "Signature Latte · Large",
  );
  await page.getByLabel("Contact number").fill("09123456789");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you, Coffee Friend." }),
  ).toBeVisible();
  await expect(page.locator(".order-card")).toContainText(
    "Signature Latte · Large",
  );
  await expect(page.locator(".order-card")).toContainText("₱370.00");
  const adds = writes.filter((w) => w.path === "/api/cart/items");
  expect(adds.map((w) => w.body.size)).toEqual(["Large", "Small"]);
  expect(adds.every((w) => !("price" in w.body))).toBe(true);
});

test("signup shows 8–15 limits while login retains compatibility", async ({
  page,
}) => {
  await mockShop(page);
  await page.goto("/login");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("maxlength", "72");
  await page.getByRole("button", { name: "Join us", exact: true }).click();
  await expect(password).toHaveAttribute("minlength", "8");
  await expect(password).toHaveAttribute("maxlength", "15");
  await expect(
    page.getByText("Use 8–15 characters for your password."),
  ).toBeVisible();
});

test("admin edits the complete drink size price list", async ({ page }) => {
  const writes = await mockShop(page, { admin: true });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page
    .locator(".admin-table>div")
    .filter({ hasText: "Signature Latte" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Offer Small, Medium, and Large")).toBeChecked();
  await page.getByLabel("Medium price (₱)").fill("195");
  await page.getByLabel("Large price (₱)").fill("225");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
  const update = writes.find((w) => w.path.startsWith("/api/products/"));
  expect(update.body.size_options).toEqual([
    { name: "Small", price: 165 },
    { name: "Medium", price: 195 },
    { name: "Large", price: 225 },
  ]);
});
