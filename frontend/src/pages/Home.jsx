import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Coffee,
  Leaf,
  Heart,
  MapPin,
  Clock,
  Mail,
  Star,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useShop } from "../context/ShopContext";
import { coffeeImage } from "../services/catalog";
import ProductCard, { ProductDetail } from "../components/ProductCard";
export default function Home() {
  const { products, loading, demo } = useShop(),
    [detail, setDetail] = useState(null),
    reduced = useReducedMotion();
  return (
    <>
      <section className="hero shell">
        <motion.div
          className="hero-copy"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <p className="eyebrow">
            <span className="tiny-line" /> GOOD COFFEE · BRIGHTER DAYS
          </p>
          <h1>
            Your daily dose
            <br />
            of <em>something</em>
            <br />
            <em>wonderful.</em>
          </h1>
          <p className="hero-description">
            Welcome to Brew Haven. Thoughtfully crafted coffee,
            <br className="desktop" /> freshly baked comforts, and a little
            space to slow down.
          </p>
          <div className="hero-buttons">
            <Link to="/menu" className="button">
              Explore our menu <ArrowUpRight size={18} />
            </Link>
            <a className="text-link" href="#about">
              Our story <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-proof">
            <div className="proof-icon">
              <Coffee size={26} strokeWidth={1.3} />
            </div>
            <div>
              <div className="stars">★★★★★</div>
              <p>A little happiness, in every cup.</p>
            </div>
            <span className="proof-divider" />
            <span className="proof-note">
              GOOD BEANS.
              <br />
              GREAT COMPANY.
            </span>
          </div>
        </motion.div>
        <motion.div
          className="hero-visual"
          initial={reduced ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9 }}
        >
          <div className="hero-image-wrap">
            <img
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/coffee-fallback.svg";
              }}
              src={coffeeImage}
              alt="Fresh cappuccino with delicate latte art in a ceramic cup"
              fetchPriority="high"
            />
            <span className="image-corner">SAVOR THE LITTLE THINGS</span>
          </div>
          <div className="round-stamp">
            BREWED WITH LOVE
            <Coffee size={28} strokeWidth={1} />
            <span>EVERY SINGLE DAY</span>
          </div>
          <div className="hero-caption">
            <span>THE ART OF A GOOD CUP</span>
            <span>
              01 — 03 <span className="caption-line" />
            </span>
          </div>
        </motion.div>
      </section>
      <div className="values-strip">
        <div className="shell">
          <span>
            <Coffee /> Thoughtfully sourced beans
          </span>
          <span className="value-star">✳</span>
          <span>
            <Leaf /> Freshly crafted, always
          </span>
          <span className="value-star">✳</span>
          <span>
            <Heart /> Made with a little extra love
          </span>
        </div>
      </div>
      <section className="section shell" id="favorites">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR NEXT FAVORITE</p>
            <h2>
              Good things, <em>on repeat.</em>
            </h2>
          </div>
          <Link to="/menu" className="text-link">
            View full menu <ArrowUpRight size={18} />
          </Link>
        </div>
        <p className="section-subtitle">
          The cups and little comforts you’ll keep coming back for.
        </p>
        {demo && (
          <p className="demo-note">
            A taste of our menu · Sample products shown while the café database
            is offline. Ordering requires a live connection.
          </p>
        )}
        <div className="product-grid">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton" />
              ))
            : products
                .filter((p) => p.is_featured)
                .slice(0, 4)
                .map((p) => (
                  <ProductCard key={p.id} product={p} onDetails={setDetail} />
                ))}
        </div>
      </section>
      <section className="story-section" id="about">
        <div className="shell story-grid">
          <div className="story-photos">
            <img
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/coffee-fallback.svg";
              }}
              src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1000&q=85"
              alt="Carefully preparing a pour-over coffee"
              loading="lazy"
            />
            <span className="story-label">A PASSION FOR THE POUR.</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">MORE THAN A COFFEE SHOP</p>
            <h2>
              A place to pause.
              <br />A reason to <em>stay.</em>
            </h2>
            <p>
              We believe the best things in life are simple. A beautifully
              brewed coffee. The smell of something fresh from the oven. A
              conversation that lasts a little longer.
            </p>
            <p>
              That’s what Brew Haven is all about — making room for the small
              moments that make your day.
            </p>
            <a href="#contact" className="text-link">
              Come find your haven <ArrowUpRight size={18} />
            </a>
            <div className="story-signature">
              With warmth, <span>Brew Haven</span>
            </div>
          </div>
        </div>
      </section>
      <section className="section shell" id="gallery">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIFE, A LITTLE SLOWER</p>
            <h2>
              A few moments <em>at the haven.</em>
            </h2>
          </div>
          <span className="gallery-tag">COFFEE. COMFORT. CONNECTION.</span>
        </div>
        <div className="gallery-grid">
          {[
            ["photo-1501339847302-ac426a4a7cbb", "A sunlit café corner"],
            [
              "photo-1447933601403-0c6688de566e",
              "Freshly roasted coffee beans",
            ],
            ["photo-1509042239860-f550ce710b93", "Coffee made to savor"],
            ["photo-1495474472287-4d71bcdd2085", "The simple joy of brewing"],
          ].map(([photo, alt]) => (
            <div key={photo}>
              <img
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/coffee-fallback.svg";
                }}
                src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=650&q=80`}
                alt={alt}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>
      <section className="contact-section" id="contact">
        <div className="shell contact-grid">
          <div>
            <p className="eyebrow">THERE’S A CUP WAITING FOR YOU</p>
            <h2>
              Make yourself
              <br />
              <em>at home.</em>
            </h2>
            <p>
              Stop by for your usual, or discover a new favorite.
              <br />
              We’d love to be a part of your day.
            </p>
            <div className="contact-line">
              <MapPin size={18} />
              <span>
                {import.meta.env.VITE_CAFE_ADDRESS ||
                  "Our location will be announced soon."}
              </span>
            </div>
            <div className="contact-line">
              <Clock size={18} />
              <span>
                {import.meta.env.VITE_CAFE_HOURS ||
                  "Opening hours coming soon."}
              </span>
            </div>
            {import.meta.env.VITE_CAFE_EMAIL && (
              <a
                className="contact-line"
                href={`mailto:${import.meta.env.VITE_CAFE_EMAIL}`}
              >
                <Mail size={18} />
                {import.meta.env.VITE_CAFE_EMAIL}
              </a>
            )}
            {import.meta.env.VITE_CAFE_PHONE && (
              <p>{import.meta.env.VITE_CAFE_PHONE}</p>
            )}
          </div>
          <div className="map-placeholder">
            <div className="map-road road-one" />
            <div className="map-road road-two" />
            <div className="map-road road-three" />
            <div className="map-pin">
              <Coffee size={28} />
              <strong>brew haven</strong>
              <span>Your new happy place.</span>
            </div>
            <span className="map-note">LOCATION DETAILS COMING SOON</span>
          </div>
        </div>
      </section>
      {detail && (
        <ProductDetail product={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
