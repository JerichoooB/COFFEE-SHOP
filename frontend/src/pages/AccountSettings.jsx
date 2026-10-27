import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Coffee,
  ArrowUpRight,
  ArrowRight,
  UserRound,
  ShieldCheck,
  ShoppingBag,
  LayoutDashboard,
  LogOut,
  Check,
  LockKeyhole,
  Mail,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useShop } from "../context/ShopContext";
import { api, message, parseUser, parseList } from "../services/api";
import EmailReceipt from "../components/EmailReceipt";
import { money } from "../services/catalog";

const sections = [
  ["overview", "Overview", LayoutDashboard],
  ["orders", "My orders", ShoppingBag],
  ["profile", "Personal information", UserRound],
  ["security", "Password & security", ShieldCheck],
];
export default function AccountSettings() {
  const { user, setUser, logout, notify } = useShop();
  const [params, setParams] = useSearchParams();
  const tab = sections.some(([id]) => id === params.get("tab"))
    ? params.get("tab")
    : "overview";
  const [orders, setOrders] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [signingOut, setSigningOut] = useState(false);
  async function loadOrders() {
    setError("");
    setLoading(true);
    try {
      const data = parseList(
        (await api.get("/orders/my-orders")).data,
        "orders",
      );
      if (
        data.some(
          (o) => !o || typeof o.id !== "string" || !Array.isArray(o.items),
        )
      )
        throw new Error("Invalid order history");
      setOrders(data);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadOrders();
  }, []);
  const active = orders?.filter((o) =>
    ["pending", "preparing", "ready"].includes(o.status),
  ).length;
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <section className="section shell account-page">
      <div className="account-welcome">
        <div>
          <p className="eyebrow">YOUR OWN LITTLE HAVEN</p>
          <h1>Hello, {user.full_name.split(" ")[0]}.</h1>
          <p>Your favorites, your details, your next coffee moment.</p>
        </div>
        <Link className="button secondary" to="/menu">
          Find your next favorite <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="account-layout">
        <aside className="account-sidebar">
          <div className="account-identity">
            <div className="account-avatar">
              {user.full_name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <strong>{user.full_name}</strong>
            <span>{user.email}</span>
            <small>
              <span /> A place at our table
            </small>
          </div>
          <nav aria-label="Account settings">
            {sections.map(([id, label, Icon]) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "selected" : ""}
                onClick={() => setParams(id === "overview" ? {} : { tab: id })}
              >
                <Icon size={17} strokeWidth={1.5} />
                {label}
                <ArrowRight size={13} />
              </button>
            ))}
          </nav>
          {user.role === "admin" && (
            <Link className="account-admin-link" to="/admin">
              <LayoutDashboard size={16} /> Admin dashboard{" "}
              <ArrowUpRight size={14} />
            </Link>
          )}
          <button
            className="account-signout"
            disabled={signingOut}
            onClick={signOut}
          >
            <LogOut size={16} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </aside>
        <div className="account-content">
          {tab === "overview" && (
            <>
              <div className="account-banner">
                <div className="account-banner-icon">
                  <Coffee size={31} strokeWidth={1.2} />
                </div>
                <div>
                  <p className="eyebrow">A LITTLE PAUSE, JUST FOR YOU</p>
                  <h2>Good to have you back.</h2>
                  <p>
                    Make time for a familiar favorite. We’ll take care of the
                    coffee.
                  </p>
                </div>
                <Link to="/menu" aria-label="Explore the menu">
                  <ArrowUpRight size={23} />
                </Link>
              </div>
              <div className="account-stats">
                <div>
                  <ShoppingBag size={19} />
                  <span>Total orders</span>
                  <strong>{orders ? orders.length : "—"}</strong>
                </div>
                <div>
                  <Clock3 size={19} />
                  <span>On the way</span>
                  <strong>{orders ? active : "—"}</strong>
                </div>
                <div>
                  <Check size={19} />
                  <span>Completed</span>
                  <strong>
                    {orders
                      ? orders.filter((o) => o.status === "completed").length
                      : "—"}
                  </strong>
                </div>
              </div>
              <div className="account-section-title">
                <div>
                  <p className="eyebrow">YOUR COFFEE MOMENTS</p>
                  <h2>Recent orders</h2>
                </div>
                <button
                  className="text-link"
                  onClick={() => setParams({ tab: "orders" })}
                >
                  View all <ArrowRight size={15} />
                </button>
              </div>
              <OrderList
                orders={orders?.slice(0, 3)}
                error={error}
                loading={loading}
                retry={loadOrders}
              />
              <div className="account-quick-links">
                <button onClick={() => setParams({ tab: "profile" })}>
                  <UserRound size={20} />
                  <span>
                    <strong>Make it personal</strong>
                    <small>Keep your account details up to date.</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
                <button onClick={() => setParams({ tab: "security" })}>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>A little peace of mind</strong>
                    <small>Manage your password and security.</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </>
          )}
          {tab === "orders" && (
            <>
              <div className="settings-heading">
                <p className="eyebrow">EVERY CUP HAS A STORY</p>
                <h2>Your coffee moments</h2>
                <p>
                  All your orders, from the first sip to your next favorite.
                </p>
              </div>
              <OrderList
                orders={orders}
                error={error}
                loading={loading}
                retry={loadOrders}
              />
            </>
          )}
          {tab === "profile" && (
            <ProfileForm
              key={user.id}
              user={user}
              onSave={(value) => {
                setUser(value);
                notify("Your account details have been updated.");
              }}
            />
          )}
          {tab === "security" && <PasswordForm notify={notify} />}
        </div>
      </div>
    </section>
  );
}
function OrderList({ orders, error, loading, retry }) {
  if (error)
    return (
      <div className="settings-panel">
        <p className="error" role="alert">
          {error}
        </p>
        <button className="text-link" onClick={retry}>
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  if (loading || !orders)
    return (
      <div className="account-order-loading" role="status">
        Loading your coffee moments…
      </div>
    );
  if (!orders.length)
    return (
      <div className="account-empty">
        <div>
          <Coffee size={32} strokeWidth={1.3} />
        </div>
        <h3>Your first cup is calling.</h3>
        <p>Once you place an order, you’ll find it right here.</p>
        <Link to="/menu" className="button">
          Explore the menu <ArrowUpRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="account-orders">
      {orders.map((o) => (
        <article key={o.id} className="account-order">
          <div className="row-between">
            <span className="order-number">
              <ShoppingBag size={17} />
              Order #{o.id.slice(0, 8)}
            </span>
            <span className={`status status-${o.status}`}>{o.status}</span>
          </div>
          <p className="order-date">
            {new Date(o.created_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {o.order_type === "dine-in" ? "Dine-in" : "Pickup"} · Pay at
            Counter
          </p>
          <div className="account-order-items">
            {o.items.map((i) => (
              <span key={i.id}>
                {i.quantity} × {i.product_name}
                {i.size && i.size !== "Regular" ? ` · ${i.size}` : ""}
              </span>
            ))}
          </div>
          <div className="row-between order-footer">
            <strong>{money(o.total_amount)}</strong>
            <Link className="text-link" to={`/orders/${o.id}`}>
              View order <ArrowRight size={14} />
            </Link>
          </div>
          <EmailReceipt order={o} />
        </article>
      ))}
    </div>
  );
}
function ProfileForm({ user, onSave }) {
  const [name, setName] = useState(user.full_name),
    [email, setEmail] = useState(user.email),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const emailChanged = email.trim().toLowerCase() !== user.email;
  const dirty = name.trim() !== user.full_name || emailChanged;
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const payload = {
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(emailChanged ? { current_password: password } : {}),
      };
      const updated = parseUser((await api.put("/auth/me", payload)).data);
      onSave(updated);
      setName(updated.full_name);
      setEmail(updated.email);
      setPassword("");
      setSaved(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="settings-heading">
        <p className="eyebrow">THE PERSON BEHIND THE CUP</p>
        <h2>Personal information</h2>
        <p>A few details that make your haven yours.</p>
      </div>
      <form className="settings-panel" onSubmit={submit}>
        <div className="settings-panel-heading">
          <UserRound size={20} />
          <div>
            <h3>Your details</h3>
            <p>Update your name and the email you use to sign in.</p>
          </div>
        </div>
        <div className="settings-form-grid">
          <label>
            Full name
            <input
              required
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
            />
          </label>
        </div>
        {emailChanged && (
          <div className="account-security-note">
            <LockKeyhole size={18} />
            <div>
              <p>Changing your email? Confirm it’s you.</p>
              <small>
                Enter your current password. Your other sessions will be signed
                out.
              </small>
              <label>
                Current password
                <input
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="settings-success" role="status">
            <Check size={16} />
            Your details are up to date.
          </p>
        )}
        <div className="settings-form-footer">
          <span>Your details stay private.</span>
          <button className="button" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save changes"}
            <Check size={15} />
          </button>
        </div>
      </form>
      <div className="account-footnote">
        <Mail size={17} />
        <p>
          Your email is used to sign in to Brew Haven. Make sure it’s an address
          you can access.
        </p>
      </div>
    </>
  );
}
function PasswordForm({ notify }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      data = Object.fromEntries(new FormData(form));
    setError("");
    setSaved(false);
    if (data.new_password !== data.confirm_password) {
      setError("Your new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.put("/auth/password", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      form.reset();
      setSaved(true);
      notify("Password updated. Your other sessions have been signed out.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="settings-heading">
        <p className="eyebrow">A LITTLE PEACE OF MIND</p>
        <h2>Password & security</h2>
        <p>Keep your account as comfortable as your favorite corner.</p>
      </div>
      <form className="settings-panel" onSubmit={submit}>
        <div className="settings-panel-heading">
          <LockKeyhole size={20} />
          <div>
            <h3>Change your password</h3>
            <p>Choose a new password you haven’t used here before.</p>
          </div>
        </div>
        <label>
          Current password
          <input
            name="current_password"
            type="password"
            required
            maxLength={72}
            autoComplete="current-password"
          />
        </label>
        <div className="settings-form-grid">
          <label>
            New password
            <input
              name="new_password"
              type="password"
              required
              minLength={8}
              maxLength={15}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirm_password"
              type="password"
              required
              minLength={8}
              maxLength={15}
              autoComplete="new-password"
            />
          </label>
        </div>
        <p className="password-help">
          Use 8–15 characters. A mix of letters, numbers, and symbols is a good
          place to start.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="settings-success" role="status">
            <Check size={16} />
            Password changed successfully.
          </p>
        )}
        <div className="settings-form-footer">
          <span>
            <ShieldCheck size={14} />
            Other sessions will be signed out.
          </span>
          <button className="button" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
      <div className="account-footnote">
        <ShieldCheck size={18} />
        <p>
          After an email or password change, this device stays signed in. Your
          other devices will need to sign in again.
        </p>
      </div>
    </>
  );
}
