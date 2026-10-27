import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { Coffee, ArrowRight } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { api, message, parseUser, parseList } from "../services/api";
import { money } from "../services/catalog";
export function Protected({ children, admin = false }) {
  const { user, authLoading } = useShop(),
    location = useLocation();
  if (authLoading)
    return <div className="empty-state">Preparing your haven…</div>;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/account" replace />;
  return children;
}
export function Auth() {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    { user, setUser, notify } = useShop(),
    navigate = useNavigate(),
    location = useLocation();
  if (user) return <Navigate to="/account" replace />;
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api.post(
        `/auth/${register ? "register" : "login"}`,
        data,
      );
      setUser(parseUser(r.data));
      notify(register ? "Welcome to Brew Haven!" : "Welcome back.");
      navigate(location.state?.from || "/account", { replace: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-section">
      <div className="auth-card">
        <BrandMark className="auth-logo" />
        <p className="eyebrow">YOUR OWN LITTLE HAVEN</p>
        <h1>{register ? "Join the table." : "Welcome back."}</h1>
        <p>
          {register
            ? "Good coffee tastes even better together."
            : "Your next favorite cup is waiting."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Full name
              <input
                name="full_name"
                required
                maxLength={100}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email address
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              minLength={register ? 8 : 1}
              maxLength={register ? 15 : 72}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          {register && <small>Use 8–15 characters for your password.</small>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "One moment…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p>
          {register ? "Already have an account?" : "New around here?"}{" "}
          <button
            className="inline-link"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Join us"}
          </button>
        </p>
      </div>
    </section>
  );
}
export function Account() {
  const { user, logout } = useShop(),
    [orders, setOrders] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/orders/my-orders")
      .then((r) => {
        const orders = parseList(r.data, "orders");
        if (
          orders.some(
            (o) => !o || typeof o.id !== "string" || !Array.isArray(o.items),
          )
        )
          throw new Error("Invalid order history");
        setOrders(orders);
      })
      .catch((e) => setError(message(e)));
  }, []);
  return (
    <section className="section shell narrow">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR LITTLE CORNER</p>
          <h1>Hello, {user.full_name.split(" ")[0]}.</h1>
        </div>
        <button className="button secondary" onClick={logout}>
          Sign out
        </button>
      </div>
      <p>{user.email}</p>
      {user.role === "admin" && (
        <Link className="button" to="/admin">
          Open admin dashboard <ArrowRight size={16} />
        </Link>
      )}
      <h2 className="spaced">Your coffee moments</h2>
      {error && <p className="error">{error}</p>}
      {orders === null && !error && <p>Loading your orders…</p>}
      {orders?.length === 0 && (
        <div className="empty-state">
          <Coffee size={35} />
          <h3>Your first cup is calling.</h3>
          <Link to="/menu" className="button">
            Explore the menu
          </Link>
        </div>
      )}
      {orders?.map((o) => (
        <article className="order-card" key={o.id}>
          <div className="row-between">
            <strong>Order #{o.id.slice(0, 8)}</strong>
            <span className="status">{o.status}</span>
          </div>
          <p>
            {new Date(o.created_at).toLocaleString()} · {o.order_type} · Pay at
            Counter
          </p>
          {o.items.map((i) => (
            <p key={i.id}>
              {i.quantity} × {i.product_name}
              {i.size && i.size !== "Regular" ? ` · ${i.size}` : ""}
              <span className="float-right">
                {money(i.unit_price * i.quantity)}
              </span>
            </p>
          ))}
          <div className="row-between">
            <strong>Total</strong>
            <strong>{money(o.total_amount)}</strong>
          </div>
        </article>
      ))}
    </section>
  );
}
