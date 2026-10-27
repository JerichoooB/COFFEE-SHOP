import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Mail,
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useShop } from "../context/ShopContext";
import { api, message } from "../services/api";
import EmailReceipt from "../components/EmailReceipt";
import { money } from "../services/catalog";
export function Cart() {
  const { cart, quantity, user } = useShop();
  const total = cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  return (
    <section className="section shell narrow">
      <p className="eyebrow">A LITTLE SOMETHING FOR YOU</p>
      <h1>Your coffee bag.</h1>
      {!cart.length ? (
        <div className="empty-state">
          <ShoppingBag size={44} />
          <h2>Good things belong here.</h2>
          <p>
            {user
              ? "Your bag is waiting for its first favorite."
              : "Sign in to save a cart and start your order."}
          </p>
          <Link className="button" to={user ? "/menu" : "/login"}>
            {user ? "Explore our menu" : "Sign in"}
            <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div>
            {cart.map((i) => (
              <article className="cart-item" key={i.id}>
                <img
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/product-placeholder.svg";
                  }}
                  src={i.image_url}
                  alt={i.name}
                />
                <div>
                  <h3>{i.name}</h3>
                  <p>
                    <span className="cart-size">{i.size || "Regular"}</span>{" "}
                    {i.is_available ? money(i.price) : "Currently unavailable"}
                  </p>
                  <div className="quantity">
                    <button
                      aria-label={`Decrease ${i.name}`}
                      onClick={() => quantity(i, i.quantity - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={`Increase ${i.name}`}
                      disabled={i.quantity >= 20}
                      onClick={() => quantity(i, i.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Remove ${i.name}`}
                  onClick={() => quantity(i, 0)}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </div>
          <aside className="summary">
            <h2>The good stuff</h2>
            <div className="row-between">
              <span>Subtotal</span>
              <strong>{money(total)}</strong>
            </div>
            <p>Pickup or dine-in. Pay at Counter.</p>
            {cart.some((i) => !i.is_available) ? (
              <p className="error">Remove unavailable items before checkout.</p>
            ) : (
              <Link to="/checkout" className="button">
                Checkout <ArrowRight size={16} />
              </Link>
            )}
            <small>Final prices are confirmed when you place your order.</small>
          </aside>
        </div>
      )}
    </section>
  );
}
export function Checkout() {
  const { user, cart, setCart } = useShop(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    navigate = useNavigate();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.post(
        "/orders",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setCart([]);
      navigate(`/orders/${r.data.id}`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (cart.some((i) => !i.is_available))
    return (
      <section className="empty-state">
        <h1>Let’s freshen up your bag.</h1>
        <p>A product or size is no longer available.</p>
        <Link className="button" to="/cart">
          Review bag
        </Link>
      </section>
    );
  if (!cart.length)
    return (
      <section className="empty-state">
        <h1>Your bag is empty.</h1>
        <Link className="button" to="/menu">
          Find your favorite
        </Link>
      </section>
    );
  return (
    <section className="section shell narrow">
      <p className="eyebrow">ALMOST COFFEE TIME</p>
      <h1>Make it yours.</h1>
      <div className="cart-layout">
        <form className="panel" onSubmit={submit}>
          <div className="checkout-receipt-note">
            <Mail size={17} />
            <p>
              Your receipt will be emailed to <strong>{user.email}</strong>{" "}
              after your order is placed.
            </p>
          </div>
          <label>
            Customer name
            <input
              name="customer_name"
              required
              maxLength={100}
              defaultValue={user.full_name}
            />
          </label>
          <label>
            Contact number
            <input
              name="contact_number"
              type="tel"
              required
              minLength={7}
              maxLength={30}
            />
          </label>
          <label>
            Enjoy your order
            <select name="order_type">
              <option value="pickup">Pickup</option>
              <option value="dine-in">Dine-in</option>
            </select>
          </label>
          <label>
            Anything we should know?
            <textarea
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder="Optional notes"
            />
          </label>
          <p className="notice">
            Payment: Pay at Counter. No online payment is collected.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Placing your order…" : "Place order"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <aside className="summary">
          <h2>Your order</h2>
          {cart.map((i) => (
            <p className="row-between" key={i.id}>
              <span>
                {i.quantity} × {i.name}
                {i.size && i.size !== "Regular" ? ` · ${i.size}` : ""}
              </span>
              <strong>{money(i.quantity * i.price)}</strong>
            </p>
          ))}
          <div className="row-between">
            <strong>Estimated total</strong>
            <strong>
              {money(
                cart.reduce((s, i) => s + i.quantity * Number(i.price), 0),
              )}
            </strong>
          </div>
          <p>The café confirms current prices when your order is placed.</p>
        </aside>
      </div>
    </section>
  );
}
export function Confirmation() {
  const { id } = useParams(),
    [order, setOrder] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((r) => setOrder(r.data))
      .catch((e) => setError(message(e)));
  }, [id]);
  return (
    <section className="section shell narrow center">
      {error ? (
        <p className="error">{error}</p>
      ) : !order ? (
        <p>Checking your order…</p>
      ) : (
        <>
          <CheckCircle size={50} />
          <p className="eyebrow">A GOOD MOMENT IS ON ITS WAY</p>
          <h1>Thank you, {order.customer_name}.</h1>
          <p>Your order #{order.id.slice(0, 8)} has been received.</p>
          <div className="order-card">
            <span className="status">{order.status}</span>
            <p>{order.order_type} · Pay at Counter</p>
            {order.items.map((i) => (
              <p key={i.id}>
                {i.quantity} × {i.product_name}
                {i.size && i.size !== "Regular" ? ` · ${i.size}` : ""}
              </p>
            ))}
            <strong>{money(order.total_amount)}</strong>
          </div>
          <EmailReceipt order={order} poll />
          <Link to="/account" className="button">
            View your orders
          </Link>
        </>
      )}
    </section>
  );
}
