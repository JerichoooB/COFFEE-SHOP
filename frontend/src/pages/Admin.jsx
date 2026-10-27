import { useEffect, useState } from "react";
import { api, message } from "../services/api";
import { money } from "../services/catalog";
import { useShop } from "../context/ShopContext";
const statuses = ["pending", "preparing", "ready", "completed", "cancelled"];
export default function Admin() {
  const [tab, setTab] = useState("Overview"),
    [stats, setStats] = useState(null),
    [orders, setOrders] = useState([]),
    [customers, setCustomers] = useState([]),
    [products, setProducts] = useState([]),
    [categories, setCategories] = useState([]),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(""),
    [customerOrders, setCustomerOrders] = useState(null),
    [busy, setBusy] = useState(false),
    { notify, reloadProducts } = useShop();
  async function load() {
    setError("");
    try {
      const r = await Promise.all([
        api.get("/admin/dashboard/stats"),
        api.get("/admin/orders"),
        api.get("/admin/customers"),
        api.get("/products"),
        api.get("/categories"),
      ]);
      setStats(r[0].data);
      setOrders(r[1].data);
      setCustomers(r[2].data);
      setProducts(r[3].data);
      setCategories(r[4].data);
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function action(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      notify("Changes saved.");
      await load();
      reloadProducts();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const payload = {
      ...f,
      price: Number(f.price),
      is_available: f.is_available === "on",
      is_featured: f.is_featured === "on",
    };
    await action(async () => {
      if (editing.id) await api.put(`/products/${editing.id}`, payload);
      else await api.post("/products", payload);
      setEditing(null);
    });
  }
  return (
    <section className="section shell">
      <p className="eyebrow">BEHIND THE COUNTER</p>
      <h1>Your café, at a glance.</h1>
      <div className="category-tabs admin-tabs">
        {["Overview", "Orders", "Products", "Categories", "Customers"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => {
                setTab(t);
                setCustomerOrders(null);
              }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "Overview" && stats && (
        <>
          <div className="stats-grid">
            {[
              ["Total orders", stats.total_orders],
              ["Customers", stats.total_customers],
              ["Sales (completed)", money(stats.total_sales)],
              ["Pending orders", stats.pending_orders],
            ].map(([l, v]) => (
              <div className="panel" key={l}>
                <p>{l}</p>
                <strong className="stat-number">{v}</strong>
              </div>
            ))}
          </div>
          <div className="panel spaced">
            <h2>Sales · last 7 days</h2>
            <div className="sales-chart">
              {stats.sales.map((d) => (
                <div key={d.date}>
                  <span>{money(d.total)}</span>
                  <div className="chart-track">
                    <div
                      style={{
                        height: `${Math.max(2, (Number(d.total) / Math.max(1, ...stats.sales.map((x) => Number(x.total)))) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {new Date(d.date).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <h2 className="spaced">Recent orders</h2>
          {stats.recent_orders.map((o) => (
            <div className="order-card row-between" key={o.id}>
              <span>
                #{o.id.slice(0, 8)} · {o.customer_name}
              </span>
              <span>
                {money(o.total_amount)} · {o.status}
              </span>
            </div>
          ))}
        </>
      )}
      {tab === "Orders" && (
        <>
          <label className="filter-label">
            Filter status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All orders</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {orders
            .filter((o) => !filter || o.status === filter)
            .map((o) => (
              <article className="order-card" key={o.id}>
                <div className="row-between">
                  <h3>
                    #{o.id.slice(0, 8)} · {o.customer_name}
                  </h3>
                  <select
                    aria-label={`Status for ${o.id}`}
                    disabled={busy}
                    value={o.status}
                    onChange={(e) =>
                      action(() =>
                        api.patch(`/admin/orders/${o.id}/status`, {
                          status: e.target.value,
                        }),
                      )
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <p>
                  {o.contact_number} · {o.order_type} ·{" "}
                  {new Date(o.created_at).toLocaleString()}
                </p>
                {o.items.map((i) => (
                  <p key={i.id}>
                    {i.quantity} × {i.product_name} — {money(i.unit_price)}
                  </p>
                ))}
                {o.notes && <p>Notes: {o.notes}</p>}
                <strong>{money(o.total_amount)}</strong>
              </article>
            ))}
        </>
      )}
      {tab === "Products" && (
        <>
          <button
            className="button"
            onClick={() =>
              setEditing({ is_available: true, is_featured: false })
            }
          >
            Add product
          </button>
          {editing && (
            <form className="panel product-form spaced" onSubmit={saveProduct}>
              <h2>{editing.id ? "Edit product" : "New product"}</h2>
              <label>
                Name
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editing.name}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  required
                  maxLength={1000}
                  defaultValue={editing.description}
                />
              </label>
              <label>
                Price (₱)
                <input
                  name="price"
                  type="number"
                  required
                  min="0.01"
                  max="100000"
                  step="0.01"
                  defaultValue={editing.price}
                />
              </label>
              <label>
                Category
                <select
                  name="category_id"
                  required
                  defaultValue={editing.category_id}
                >
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Image URL
                <input
                  name="image_url"
                  type="url"
                  required
                  defaultValue={editing.image_url}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="is_available"
                  defaultChecked={editing.is_available}
                />{" "}
                Available
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="is_featured"
                  defaultChecked={editing.is_featured}
                />{" "}
                Featured
              </label>
              <div className="button-row">
                <button className="button" disabled={busy}>
                  Save product
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="admin-table">
            {products.map((p) => (
              <div key={p.id}>
                <img
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/coffee-fallback.svg";
                  }}
                  src={p.image_url}
                  alt=""
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.category_name} ·{" "}
                    {p.is_available ? "Available" : "Unavailable"}
                    {p.is_featured ? " · Featured" : ""}
                  </small>
                </span>
                <span>{money(p.price)}</span>
                <button onClick={() => setEditing(p)}>Edit</button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(`Delete ${p.name}? This cannot be undone.`)
                    )
                      action(() => api.delete(`/products/${p.id}`));
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Categories" && (
        <>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              action(async () => {
                await api.post(
                  "/categories",
                  Object.fromEntries(new FormData(form)),
                );
                form.reset();
              });
            }}
          >
            <h2>Add category</h2>
            <label>
              Name
              <input name="name" required maxLength={80} />
            </label>
            <label>
              Slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="hot-coffee"
              />
            </label>
            <label>
              Description
              <input name="description" maxLength={500} />
            </label>
            <button className="button" disabled={busy}>
              Create category
            </button>
          </form>
          {categories.map((c) => (
            <div className="order-card" key={c.id}>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <button
                onClick={() => {
                  const name = window.prompt("Category name", c.name);
                  if (name)
                    action(() =>
                      api.put(`/categories/${c.id}`, {
                        name,
                        slug: c.slug,
                        description: c.description,
                      }),
                    );
                }}
              >
                Rename
              </button>{" "}
              <button
                onClick={() => {
                  if (window.confirm(`Delete category ${c.name}?`))
                    action(() => api.delete(`/categories/${c.id}`));
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "Customers" && (
        <>
          {customers.map((c) => (
            <div className="order-card row-between" key={c.id}>
              <span>
                <strong>{c.full_name}</strong>
                <br />
                {c.email}
              </span>
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    setCustomerOrders({
                      name: c.full_name,
                      orders: (await api.get(`/admin/customers/${c.id}/orders`))
                        .data,
                    });
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              >
                Order history →
              </button>
            </div>
          ))}
          {customerOrders && (
            <div className="panel">
              <h2>{customerOrders.name}’s orders</h2>
              {!customerOrders.orders.length && <p>No orders yet.</p>}
              {customerOrders.orders.map((o) => (
                <div key={o.id} className="order-card">
                  <p>
                    #{o.id.slice(0, 8)} · {o.status} · {money(o.total_amount)}
                  </p>
                  {o.items.map((i) => (
                    <p key={i.id}>
                      {i.quantity} × {i.product_name}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
