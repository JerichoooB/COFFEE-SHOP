import { useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import { Auth, Account, Protected } from "./pages/Account";
import { Cart, Checkout, Confirmation } from "./pages/Cart";
import Admin from "./pages/Admin";
export default function App() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      requestAnimationFrame(() =>
        document.querySelector(location.hash)?.scrollIntoView(),
      );
    } else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="login" element={<Auth />} />
        <Route path="cart" element={<Cart />} />
        <Route
          path="checkout"
          element={
            <Protected>
              <Checkout />
            </Protected>
          }
        />
        <Route
          path="account"
          element={
            <Protected>
              <Account />
            </Protected>
          }
        />
        <Route
          path="orders/:id"
          element={
            <Protected>
              <Confirmation />
            </Protected>
          }
        />
        <Route
          path="admin"
          element={
            <Protected admin>
              <Admin />
            </Protected>
          }
        />
        <Route
          path="*"
          element={
            <section className="empty-state">
              <h1>A little off the beaten path.</h1>
              <Link className="button" to="/">
                Back to the haven
              </Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
