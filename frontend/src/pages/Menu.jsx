import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { categories } from "../services/catalog";
import ProductCard, { ProductDetail } from "../components/ProductCard";
export default function Menu() {
  const { products, demo, loading } = useShop(),
    [params, setParams] = useSearchParams(),
    [category, setCategory] = useState("All"),
    [detail, setDetail] = useState(null),
    search = params.get("search") || "";
  const list = products.filter(
    (p) =>
      (category === "All" || p.category_name === category) &&
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="section shell menu-page">
      <div className="page-intro">
        <p className="eyebrow">CRAFTED FOR YOUR EVERYDAY</p>
        <h1>
          A cup for <em>every mood.</em>
        </h1>
        <p>Find your familiar favorite. Or fall for something new.</p>
      </div>
      <div className="menu-controls">
        <div className="category-tabs">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            autoFocus={params.has("search")}
            aria-label="Search products"
            value={search}
            placeholder="Find your favorite…"
            onChange={(e) =>
              setParams(e.target.value ? { search: e.target.value } : {}, {
                replace: true,
              })
            }
          />
        </label>
      </div>
      {demo && (
        <p className="notice">
          You’re browsing our sample menu. Live ordering will be available when
          the café database is connected.
        </p>
      )}
      <div className="product-grid">
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton" />
            ))
          : list.map((p) => (
              <ProductCard key={p.id} product={p} onDetails={setDetail} />
            ))}
      </div>
      {!loading && !list.length && (
        <div className="empty-state">
          <h2>No cups found.</h2>
          <p>Try another search or explore a different category.</p>
        </div>
      )}
      {detail && (
        <ProductDetail product={detail} onClose={() => setDetail(null)} />
      )}
    </section>
  );
}
