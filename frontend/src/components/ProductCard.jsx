import { Plus, Star } from "lucide-react";
import { API_URL } from "../config.js";

export function productImageSource(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_URL.replace(/\/api\/?$/, "")}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

export function formatPrice(price, currency, rate) {
  const value = currency === "LRD" ? price * rate : price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "LRD" ? 0 : 2
  }).format(value);
}

export default function ProductCard({ product, currency, rate, onAdd, onRate, ratingBusy }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.imageUrl
          ? <img className="product-image" src={productImageSource(product.imageUrl)} alt={product.title} />
          : <div className="product-placeholder" aria-label="No product image">🥬</div>}
        <span className="product-category">{product.category}</span>
      </div>
      <div className="product-details">
        <div className="product-title-row">
          <h3>{product.title}</h3>
          <div className="product-prices">
            {product.regularPrice > product.price && <del>{formatPrice(product.regularPrice, currency, rate)}</del>}
            <strong>{formatPrice(product.price, currency, rate)}</strong>
            {product.regularPrice > product.price && <span className="sale-label">SALE</span>}
          </div>
        </div>
        <p className="product-description">{product.description || "Fresh pick from our market."}</p>
        <div className="rating-row">
          <span><Star size={14} fill="currentColor" /> {Number(product.ratingAverage || 0).toFixed(1)} <small>({product.ratingCount || 0})</small></span>
          <div className="rate-buttons" aria-label={`Rate ${product.title}`}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button key={rating} disabled={ratingBusy} onClick={() => onRate(product, rating)} aria-label={`Rate ${product.title} ${rating} stars`}>
                <Star size={14} />
              </button>
            ))}
          </div>
        </div>
        <div className="product-card-bottom">
          <span className="stock-label">{product.stock > 0 ? `${product.stock} available` : "Sold out"}</span>
          <button className="add-button" onClick={() => onAdd(product)} disabled={product.stock < 1}>
            <Plus size={16} /> Buy
          </button>
        </div>
      </div>
    </article>
  );
}
