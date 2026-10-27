import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Coffee,
  ShoppingBag,
  Search,
  Menu,
  X,
  ArrowUpRight,
  Instagram,
} from "lucide-react";
import Brand from "./Brand";
import EmailForm from "./EmailForm";
import { useShop } from "../context/ShopContext";
export default function Layout() {
  const { user, cart } = useShop(),
    [open, setOpen] = useState(false),
    navigate = useNavigate();
  return (
    <>
      <div className="announcement">
        A little pause. A better day. <span>Freshly brewed, just for you.</span>
      </div>
      <header>
        <div className="nav shell">
          <Link to="/" className="brand" aria-label="Brew Haven home">
            <Brand />
          </Link>
          <nav
            className={open ? "nav-links open" : "nav-links"}
            aria-label="Main navigation"
          >
            {[
              ["/", "Home"],
              ["/menu", "Menu"],
              ["/#about", "Our Story"],
              ["/#gallery", "Gallery"],
              ["/#contact", "Contact"],
            ].map(([to, label]) =>
              to.includes("#") ? (
                <a key={to} href={to} onClick={() => setOpen(false)}>
                  {label}
                </a>
              ) : (
                <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                  {label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="nav-actions">
            <button
              className="icon-button"
              aria-label="Search menu"
              onClick={() => navigate("/menu?search=")}
            >
              <Search size={19} />
            </button>
            <Link
              className="cart-link icon-button"
              to="/cart"
              aria-label={`Cart, ${cart.reduce((s, i) => s + i.quantity, 0)} items`}
            >
              <ShoppingBag size={19} />
              <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </Link>
            <Link className="account-link" to={user ? "/account" : "/login"}>
              {user ? "My account" : "Sign in"}
            </Link>
            <Link className="button small nav-order" to="/menu">
              Order now <ArrowUpRight size={15} />
            </Link>
            <button
              className="mobile-toggle icon-button"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <div className="shell footer-top">
          <div>
            <Link className="brand" to="/">
              <Brand />
            </Link>
            <p>
              A good cup. A warm welcome.
              <br />A place to make your own.
            </p>
          </div>
          <div>
            <h3>Find your haven</h3>
            <Link to="/menu">Our menu</Link>
            <a href="/#about">Our story</a>
            <a href="/#contact">Visit us</a>
          </div>
          <div>
            <h3>A little goodness in your inbox</h3>
            <p>Leave your email to hear about what’s brewing.</p>
            <EmailForm newsletter />
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>
            © {new Date().getFullYear()} Brew Haven. Crafted with care.
          </span>
          <span>
            Slow down. Sip something good. <Instagram size={15} />
          </span>
        </div>
      </footer>
    </>
  );
}
