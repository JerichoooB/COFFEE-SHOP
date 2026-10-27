import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { money } from "../services/catalog";
export default function ProductCard({ product, onDetails }) {
  const { add } = useShop();
  return (
    <article className="product-card">
      <button
        className="product-image"
        onClick={() => onDetails(product)}
        aria-label={`View ${product.name}`}
      >
        <img
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/coffee-fallback.svg";
          }}
          src={product.image_url}
          alt={product.name}
          loading="lazy"
        />
        {product.is_featured && (
          <span className="product-label">HOUSE FAVORITE</span>
        )}
      </button>
      <div className="product-meta">
        <span>{product.category_name}</span>
        <span>CRAFTED WITH CARE</span>
      </div>
      <button className="product-title" onClick={() => onDetails(product)}>
        {product.name}
      </button>
      <p>{product.description}</p>
      <div className="product-bottom">
        <strong>{money(product.price)}</strong>
        <button
          className="add-button"
          onClick={() => add(product)}
          disabled={!product.is_available}
          aria-label={`Add ${product.name} to cart`}
        >
          {product.is_available ? <Plus size={19} /> : "Sold out"}
        </button>
      </div>
    </article>
  );
}
export function ProductDetail({ product, onClose }) {
  const { add } = useShop();
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll(
          'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="product-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-modal"
          onClick={onClose}
          autoFocus
          aria-label="Close product details"
        >
          ×
        </button>
        <img
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/coffee-fallback.svg";
          }}
          src={product.image_url}
          alt={product.name}
        />
        <div>
          <p className="eyebrow">{product.category_name}</p>
          <h2>{product.name}</h2>
          <p>{product.description}</p>
          <strong>{money(product.price)}</strong>
          <button
            className="button"
            disabled={!product.is_available}
            onClick={() => add(product)}
          >
            {product.is_available ? "Add to cart" : "Currently unavailable"}{" "}
            <Plus size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
