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
export { default as Account } from "./AccountSettings";
