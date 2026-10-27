import { useEffect, useRef, useState } from "react";
import { Plus, Coffee, Check, ArrowUpRight } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { money, sizeOptions } from "../services/catalog";
export default function ProductCard({ product, onDetails }) {
  const { add } = useShop();
  const options = sizeOptions(product);
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
          <span className="product-label">
            <span>✦</span> HOUSE FAVORITE
          </span>
        )}
        <span className="product-peek">
          <ArrowUpRight size={18} />
        </span>
      </button>
      <div className="product-content">
        <div className="product-meta">
          <span>{product.category_name}</span>
          {options.length > 0 && <span className="size-hint">S / M / L</span>}
        </div>
        <button className="product-title" onClick={() => onDetails(product)}>
          {product.name}
        </button>
        <p>{product.description}</p>
        <div className="product-bottom">
          <div className="price-block">
            {options.length > 0 && <small>STARTING AT</small>}
            <strong>{money(product.price)}</strong>
          </div>
          <button
            className="add-button"
            onClick={() => (options.length ? onDetails(product) : add(product))}
            disabled={!product.is_available}
            aria-label={
              options.length
                ? `Choose size for ${product.name}`
                : `Add ${product.name} to cart`
            }
          >
            {product.is_available ? (
              <>
                <span>{options.length ? "Choose size" : "Add to bag"}</span>
                <Plus size={16} />
              </>
            ) : (
              "Sold out"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
export function ProductDetail({ product, onClose }) {
  const { add } = useShop();
  const options = sizeOptions(product);
  const [size, setSize] = useState(options[0]?.name || "Regular");
  const [adding, setAdding] = useState(false);
  const price = options.find((o) => o.name === size)?.price ?? product.price;
  const dialog = useRef(null);
  async function addSelected() {
    if (adding) return;
    setAdding(true);
    try {
      if (await add(product, size)) onClose();
    } finally {
      setAdding(false);
    }
  }
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
          {options.length > 0 && (
            <fieldset className="size-picker">
              <legend>
                Make it your size <span>Choose one</span>
              </legend>
              <div className="size-options">
                {options.map((option, index) => (
                  <label
                    key={option.name}
                    className={
                      size === option.name
                        ? "size-option selected"
                        : "size-option"
                    }
                  >
                    <input
                      type="radio"
                      name="drink-size"
                      value={option.name}
                      checked={size === option.name}
                      onChange={() => setSize(option.name)}
                    />
                    <Coffee size={22 + index * 4} strokeWidth={1.3} />
                    <strong>{option.name}</strong>
                    <span>{money(option.price)}</span>
                    {size === option.name && (
                      <Check className="size-check" size={12} />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="detail-total">
            <span>Your cup, your way</span>
            <strong>{money(price)}</strong>
          </div>
          <button
            className="button"
            disabled={!product.is_available || adding}
            onClick={addSelected}
          >
            {adding
              ? "Adding…"
              : product.is_available
                ? `Add to bag · ${money(price)}`
                : "Currently unavailable"}{" "}
            <Plus size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
