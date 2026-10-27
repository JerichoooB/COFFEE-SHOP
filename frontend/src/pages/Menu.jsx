import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, Coffee } from "lucide-react";
import { BrandMark } from "../components/Brand";
import { useShop } from "../context/ShopContext";
import { categories } from "../services/catalog";
import ProductCard, { ProductDetail } from "../components/ProductCard";
export default function Menu() {
  const { products, demo, loading } = useShop(),
    [params, setParams] = useSearchParams(),
    [category, setCategory] = useState("All"),
    [detail, setDetail] = useState(null),
    [sort, setSort] = useState("favorites"),
    search = params.get("search") || "";
  const list = products.filter(
    (p) =>
      (category === "All" || p.category_name === category) &&
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const sorted = [...list].sort((a, b) =>
    sort === "price-low"
      ? Number(a.price) - Number(b.price)
      : sort === "price-high"
        ? Number(b.price) - Number(a.price)
        : Number(b.is_featured) - Number(a.is_featured),
  );
  return (
    <section className="section shell menu-page">
      <div className="page-intro menu-intro">
        <BrandMark className="menu-brand" />
        <p className="eyebrow">CRAFTED FOR YOUR EVERYDAY</p>
        <h1>
          A cup for <em>every mood.</em>
        </h1>
        <p>Find your familiar favorite. Or fall for something new.</p>
      </div>
      <div className="menu-ritual">
        <span>
          <Coffee size={18} strokeWidth={1.4} /> YOUR DAILY RITUAL, MADE
          PERSONAL.
        </span>
        <p>Pick your favorite. Choose your size. Find your moment.</p>
        <span className="ritual-sizes">
          <b>S</b>
          <b>M</b>
          <b>L</b>
        </span>
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
          {search && (
            <button
              className="clear-search"
              aria-label="Clear search"
              onClick={() => setParams({}, { replace: true })}
            >
              <X size={15} />
            </button>
          )}
        </label>
      </div>
      {demo && (
        <p className="notice">
          You’re browsing our sample menu. Live ordering will be available when
          the café database is connected.
        </p>
      )}
      <div className="menu-results">
        <p>
          <strong>{loading ? "…" : list.length}</strong>{" "}
          {category === "All"
            ? "little reasons to slow down"
            : category.toLowerCase() + " favorites"}
        </p>
        <label className="sort-menu">
          <SlidersHorizontal size={14} />
          <span className="sr-only">Sort products</span>
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="favorites">Café favorites</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
      </div>
      <div className="product-grid">
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton" />
            ))
          : sorted.map((p) => (
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
