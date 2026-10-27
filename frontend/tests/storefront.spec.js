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
  await expect(page.locator(".product-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Matcha", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search products" })
    .fill("butter croissant");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByLabel("Sort products", { exact: true })
    .selectOption("price-high");
  await expect(page.locator(".product-title").first()).toHaveText(
    "Dirty Matcha",
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

for (const register of [false, true]) {
  test(`${register ? "signup" : "login"} lands on account without browser errors`, async ({
    page,
  }) => {
    await mockShop(page);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        json: {
          id: "user",
          full_name: "Coffee Friend",
          email: "friend@example.com",
          role: "customer",
        },
      }),
    );
    await page.route("**/api/auth/register", (route) =>
      route.fulfill({
        json: {
          id: "user",
          full_name: "Coffee Friend",
          email: "friend@example.com",
          role: "customer",
        },
      }),
    );
    await page.route("**/api/orders/my-orders", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto("/login");
    if (register) {
      await page.getByRole("button", { name: "Join us", exact: true }).click();
      await page.getByLabel("Full name").fill("Coffee Friend");
    }
    await page
      .getByLabel("Email address", { exact: true })
      .fill("friend@example.com");
    await page.getByLabel("Password", { exact: true }).fill("testpassword");
    await page
      .getByRole("button", {
        name: register ? "Create account" : "Sign in",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Hello, Coffee." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your first cup is calling." }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("HTML auth responses stay on the form and display an error", async ({
  page,
}) => {
  await mockShop(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Wrong route</body></html>",
    }),
  );
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("friend@example.com");
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("unexpected page");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("malformed profile and order responses show errors without blanking the page", async ({
  page,
}) => {
  await mockShop(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { id: "user", email: "friend@example.com" } }),
  );
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("friend@example.com");
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "account could not be loaded",
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "user",
        full_name: "Coffee Friend",
        email: "friend@example.com",
        role: "customer",
      },
    }),
  );
  await page.route("**/api/orders/my-orders", (route) =>
    route.fulfill({ json: { unexpected: "object" } }),
  );
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Hello, Coffee." }),
  ).toBeVisible();
  await expect(page.locator(".error")).toContainText(
    "could not load your orders",
  );
  expect(errors).toEqual([]);
});

test("account details save and email changes require password confirmation", async ({
  page,
}) => {
  const writes = await mockShop(page, { signedIn: true });
  await page.route("**/api/orders/my-orders", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/auth/me", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push({ path: "/api/auth/me", body });
      return route.fulfill({
        json: {
          id: "test-user",
          full_name: body.full_name,
          email: body.email,
          role: "customer",
        },
      });
    }
    return route.fulfill({
      json: {
        id: "test-user",
        full_name: "Coffee Friend",
        email: "friend@example.com",
        role: "customer",
      },
    });
  });
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Personal information", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Coffee Pal");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Coffee." }),
  ).toBeVisible();
  await expect(page.getByText("Your details are up to date.")).toBeVisible();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("new@example.com");
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Current password", { exact: true })
    .fill("currentpass123");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".account-identity")).toContainText(
    "new@example.com",
  );
  expect(
    writes.filter((w) => w.path === "/api/auth/me").at(-1).body
      .current_password,
  ).toBe("currentpass123");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("password settings validate confirmation before sending and show success", async ({
  page,
}) => {
  await mockShop(page, { signedIn: true });
  await page.route("**/api/orders/my-orders", (route) =>
    route.fulfill({ json: [] }),
  );
  let calls = 0;
  await page.route("**/api/auth/password", (route) => {
    calls++;
    return route.fulfill({ json: { message: "Password updated." } });
  });
  await page.goto("/account?tab=security");
  await page
    .getByLabel("Current password", { exact: true })
    .fill("currentpass123");
  await page.getByLabel("New password", { exact: true }).fill("newpass123");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("different123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toContainText("do not match");
  expect(calls).toBe(0);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("newpass123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password changed successfully.")).toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toBeEmpty();
});

test("contact form submits to Formspree and newsletter failures stay visible", async ({
  page,
}) => {
  await mockShop(page);
  const submissions = [];
  await page.route("https://formspree.io/f/xvkkkley", (route) => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({
      json: { ok: true },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/");
  const contact = page.getByRole("form", { name: "Contact Brew Haven" });
  await contact.getByLabel("Your name", { exact: true }).fill("Coffee Friend");
  await contact
    .getByLabel("Your email", { exact: true })
    .fill("friend@example.com");
  await contact
    .getByLabel("Your message", { exact: true })
    .fill("I would love to know more about your coffee.");
  await contact.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Your message has been sent. Thanks for reaching out!"),
  ).toBeVisible();
  expect(submissions[0].form_type).toBe("Contact enquiry");
  await page
    .getByLabel("Newsletter email address", { exact: true })
    .fill("friend@example.com");
  await page.getByRole("button", { name: "Send newsletter request" }).click();
  await expect(
    page.getByText("Thanks! Your newsletter request has been sent."),
  ).toBeVisible();
  expect(submissions[1].form_type).toBe("Newsletter request");
  await page.route("https://formspree.io/f/xvkkkley", (route) =>
    route.fulfill({
      status: 429,
      json: { error: "Rate limit" },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page
    .getByLabel("Newsletter email address", { exact: true })
    .fill("friend@example.com");
  await page.getByRole("button", { name: "Send newsletter request" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many messages");
});

test("order receipt status supports a safe retry without placing another order", async ({
  page,
}) => {
  await mockShop(page, { signedIn: true });
  const order = {
    id: "11111111-1111-4111-8111-111111111111",
    customer_name: "Coffee Friend",
    total_amount: "205.00",
    order_type: "pickup",
    status: "pending",
    receipt_status: "pending",
    receipt_email: "friend@example.com",
    items: [
      {
        id: "item",
        product_name: "Latte",
        quantity: 1,
        unit_price: 205,
        size: "Large",
      },
    ],
  };
  await page.route(
    "**/api/orders/11111111-1111-4111-8111-111111111111",
    (route) => route.fulfill({ json: order }),
  );
  let retries = 0;
  await page.route(
    "**/api/orders/11111111-1111-4111-8111-111111111111/receipt",
    (route) => {
      retries++;
      expect(route.request().method()).toBe("POST");
      return route.fulfill({ json: { status: "sent" } });
    },
  );
  await page.goto("/orders/" + order.id);
  await expect(page.getByText("Your email receipt is pending")).toBeVisible();
  await page.getByRole("button", { name: "Try sending receipt" }).click();
  await expect(
    page.getByText("Your email receipt is on its way"),
  ).toBeVisible();
  await expect(page.getByText(/Sent to friend@example.com/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try sending receipt" }),
  ).toHaveCount(0);
  expect(retries).toBe(1);
});

test("all 24 matched product images load and photo credits are available", async ({
  page,
}) => {
  await mockShop(page);
  await page.goto("/menu");
  await expect(page.locator(".product-card")).toHaveCount(24);
  await page
    .locator(".product-card img")
    .evaluateAll((images) =>
      images.forEach((image) => (image.loading = "eager")),
    );
  await expect
    .poll(() =>
      page
        .locator(".product-card img")
        .evaluateAll(
          (images) =>
            images.filter((image) => image.complete && image.naturalWidth > 0)
              .length,
        ),
    )
    .toBe(24);
  const paths = await page
    .locator(".product-card img")
    .evaluateAll((images) =>
      images.map((image) => new URL(image.src).pathname),
    );
  expect(new Set(paths).size).toBe(24);
  expect(paths.every((path) => path.startsWith("/products/"))).toBe(true);
  await page.getByRole("link", { name: "Photo credits", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Photo credits", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Strawberry Matcha product illustration", { exact: true }),
  ).toBeVisible();
});
