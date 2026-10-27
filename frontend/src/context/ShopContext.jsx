import { createContext, useContext, useEffect, useState } from "react";
import { api, message } from "../services/api";
import { sampleProducts } from "../services/catalog";
const ShopContext = createContext(null);
export function ShopProvider({ children }) {
  const [user, setUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [products, setProducts] = useState([]),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false),
    [cart, setCart] = useState([]),
    [toast, setToast] = useState("");
  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {})
      .finally(() => setAuthLoading(false));
    reloadProducts();
  }, []);
  useEffect(() => {
    if (user)
      api
        .get("/cart")
        .then((r) => setCart(r.data))
        .catch((e) => notify(message(e)));
    else setCart([]);
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  function notify(value) {
    setToast(value);
  }
  async function reloadProducts() {
    setLoading(true);
    try {
      const r = await api.get("/products");
      setProducts(r.data);
      setDemo(false);
    } catch {
      setProducts(sampleProducts);
      setDemo(true);
    } finally {
      setLoading(false);
    }
  }
  async function add(product) {
    if (!user) {
      notify("Please sign in to save your cart and place an order.");
      return false;
    }
    try {
      await api.post("/cart/items", { product_id: product.id, quantity: 1 });
      setCart((await api.get("/cart")).data);
      notify(`${product.name} added to your cart`);
      return true;
    } catch (e) {
      notify(message(e));
      return false;
    }
  }
  async function quantity(item, value) {
    try {
      if (value <= 0) await api.delete(`/cart/items/${item.id}`);
      else await api.patch(`/cart/items/${item.id}`, { quantity: value });
      setCart((await api.get("/cart")).data);
    } catch (e) {
      notify(message(e));
    }
  }
  async function logout() {
    try {
      await api.post("/auth/logout");
      setUser(null);
      notify("You have been signed out.");
    } catch (e) {
      notify(message(e));
    }
  }
  return (
    <ShopContext.Provider
      value={{
        user,
        setUser,
        authLoading,
        products,
        loading,
        demo,
        cart,
        setCart,
        add,
        quantity,
        notify,
        logout,
        reloadProducts,
      }}
    >
      {children}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </ShopContext.Provider>
  );
}
export const useShop = () => useContext(ShopContext);
