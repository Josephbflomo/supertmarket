import { useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, Leaf, Search, ShoppingBasket, Truck } from "lucide-react";
import { API_URL, USD_TO_LRD_RATE } from "./config.js";
import { apiRequest } from "./api.js";
import Header from "./components/Header.jsx";
import ProductCard, { productImageSource } from "./components/ProductCard.jsx";
import CartPanel from "./components/CartPanel.jsx";
import { useCart } from "./context/CartContext.jsx";

const categories = ["All", "Produce", "Bakery", "Dairy & Eggs", "Meat & Seafood", "Pantry", "Beverages", "Household"];
const promoSlides = [
  { title: "Good food, close to home", description: "Shop the everyday favorites you need, all in one place.", category: "All", illustration: "🥬", tone: "produce" },
  { title: "Fresh picks for your table", description: "Find something delicious for your next meal.", category: "Produce", illustration: "🍅", tone: "tomato" },
  { title: "Stock up with AllDayDash", description: "Browse local goods and order in just a few clicks.", category: "Pantry", illustration: "🧺", tone: "basket" }
];

function getReviewerId() {
  let reviewerId = localStorage.getItem("supertmarket-reviewer");
  if (!reviewerId) {
    reviewerId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("supertmarket-reviewer", reviewerId);
  }
  return reviewerId;
}

export default function App() {
  const { items, addItem, setQuantity, clear } = useCart();
  const [currency, setCurrency] = useState(() => localStorage.getItem("supertmarket-currency") || "USD");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [ratingBusy, setRatingBusy] = useState({});
  const [heroIndex, setHeroIndex] = useState(0);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const heroSlides = useMemo(() => {
    const featuredProducts = products
      .filter((product) => product.imageUrl)
      .slice(0, 5)
      .map((product) => ({
        title: product.title,
        description: product.description || `Shop ${product.category.toLowerCase()} at AllDayDash.`,
        category: product.category,
        imageUrl: product.imageUrl,
        product
      }));
    return [...featuredProducts.slice(0, 3), ...promoSlides];
  }, [products]);
  const activeHeroSlide = heroSlides[heroIndex % heroSlides.length];

  useEffect(() => localStorage.setItem("supertmarket-currency", currency), [currency]);

  useEffect(() => {
    if (heroSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    apiRequest("/settings")
      .then((data) => setMobileMoneyNumber(data.mobileMoneyNumber))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(pagination.page), limit: "12", sort });
    if (category !== "All") params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    setError("");
    fetch(`${API_URL}/products?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load products.");
        return data;
      })
      .then((data) => {
        setProducts(data.products);
        setPagination((current) => ({ ...current, ...data.pagination }));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, search, sort, pagination.page, reload]);

  function chooseCategory(nextCategory) {
    setCategory(nextCategory);
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function addProduct(product) {
    setNotice(addItem(product)
      ? `${product.title} added to your basket.`
      : `${product.title} has reached its available stock in your basket.`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function rateProduct(product, rating) {
    setRatingBusy((current) => ({ ...current, [product._id]: true }));
    try {
      const data = await apiRequest("/ratings", {
        method: "POST",
        body: JSON.stringify({ productId: product._id, rating, reviewerId: getReviewerId() })
      });
      setProducts((current) => current.map((item) => item._id === product._id ? { ...item, ...data } : item));
      setNotice("Thanks for rating this product.");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (requestError) {
      setNotice(requestError.message);
      window.setTimeout(() => setNotice(""), 3500);
    } finally {
      setRatingBusy((current) => ({ ...current, [product._id]: false }));
    }
  }

  async function submitOrder(details) {
    const result = await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        ...details,
        items: items.map((item) => ({ productId: item._id, quantity: item.quantity }))
      })
    });
    clear();
    setReload((current) => current + 1);
    return result;
  }

  function confirmPayment(result) {
    return apiRequest(`/orders/${result.order.id}/confirm-payment`, {
      method: "POST",
      body: JSON.stringify({ confirmationToken: result.confirmationToken })
    });
  }

  return (
    <>
      <Header
        currency={currency}
        setCurrency={setCurrency}
        itemCount={itemCount}
        onCart={() => setCartOpen(true)}
        onSearch={() => document.getElementById("product-search")?.focus()}
        onAccount={() => {
          setNotice("Customer accounts aren't available yet. You can place orders as a guest from your basket.");
          window.setTimeout(() => setNotice(""), 4000);
        }}
      />
      <main className="storefront-layout">
        <aside className="storefront-sidebar" aria-label="Shop by category">
          <h2>Shop by category</h2>
          <div className="sidebar-category-list">
            {categories.map((item) => (
              <button key={item} className={category === item ? "sidebar-category active" : "sidebar-category"} onClick={() => chooseCategory(item)}>
                <span>{item === "All" ? "All goods" : item}</span><ChevronRight size={16} />
              </button>
            ))}
          </div>
        </aside>
        <div className="storefront-content">
          <section
            className={`hero-carousel hero-${activeHeroSlide.tone || "product"}${activeHeroSlide.imageUrl ? " has-background-image" : ""}`}
            style={activeHeroSlide.imageUrl ? { "--hero-background": `url("${productImageSource(activeHeroSlide.imageUrl)}")` } : undefined}
            aria-label="Featured goods"
          >
            <div className="hero-slide-copy">
              <p className="eyebrow">WELCOME TO WATERSIDE</p>
              <h1>{activeHeroSlide.title}</h1>
              <p>{activeHeroSlide.description}</p>
              <button className="hero-shop-button" onClick={() => {
                chooseCategory(activeHeroSlide.category);
                document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" });
              }}>Shop now <ChevronRight size={16} /></button>
            </div>
            {!activeHeroSlide.imageUrl && <div className="hero-slide-art" key={activeHeroSlide.title} aria-hidden="true"><span>{activeHeroSlide.illustration}</span></div>}
            <div className="hero-slide-controls">
              <button aria-label="Previous featured good" onClick={() => setHeroIndex((current) => (current - 1 + heroSlides.length) % heroSlides.length)}><ChevronLeft size={20} /></button>
              <span>{(heroIndex % heroSlides.length) + 1} / {heroSlides.length}</span>
              <button aria-label="Next featured good" onClick={() => setHeroIndex((current) => (current + 1) % heroSlides.length)}><ChevronRight size={20} /></button>
            </div>
          </section>
        </div>
      </main>
      <section className="market-section market-wide" id="marketplace">
        <div className="section-title">
          <div><p className="eyebrow">SHOP THE MARKET</p><h2>What can we get you?</h2><p>Choose your goods, rate what you love, and place your order.</p></div>
          <span className="market-count">{pagination.total} goods</span>
        </div>
        <div className="market-toolbar">
          <div className="market-controls">
            <label className="search-field"><Search size={17} /><input id="product-search" value={search} onChange={(event) => { setSearch(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="Search goods" /><span className="sr-only">Search products</span></label>
            <label className="sort-select"><ArrowDownWideNarrow size={16} /><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="price_asc">Lowest price</option><option value="price_desc">Highest price</option><option value="rating">Top rated</option></select></label>
          </div>
        </div>
        {loading ? <div className="loading-state"><span className="spinner"></span>Loading the market...</div>
          : error ? <div className="error-state"><h3>We couldn't load the market.</h3><p>{error}</p><button className="outline-button" onClick={() => setReload((current) => current + 1)}>Try again</button></div>
            : products.length === 0 ? <div className="empty-market"><span>🧺</span><h3>The market is getting ready.</h3><p>Please check back soon for fresh goods.</p></div>
              : <div className="product-grid">{products.map((product) => (
                <ProductCard key={product._id} product={product} currency={currency} rate={USD_TO_LRD_RATE}
                  onAdd={addProduct} onRate={rateProduct} ratingBusy={Boolean(ratingBusy[product._id])} />
              ))}</div>}
        {!loading && !error && pagination.pages > 1 && (
          <div className="pagination">
            <button className="outline-button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
            <span>Page {pagination.page} of {pagination.pages}</span>
            <button className="outline-button" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
          </div>
        )}
      </section>
      <footer className="site-footer" id="footer">
        <section className="footer-benefits" aria-label="Shopping benefits">
          <div><span className="benefit-icon"><Leaf size={18} /></span><span><strong>Fresh and local</strong><small>Picked for your table</small></span></div>
          <div><span className="benefit-icon"><ShoppingBasket size={18} /></span><span><strong>One simple basket</strong><small>Everything in one order</small></span></div>
          <div><span className="benefit-icon"><Truck size={18} /></span><span><strong>Easy delivery</strong><small>Tell us where to bring it</small></span></div>
          <div><span className="benefit-icon"><span className="money-symbol">L$</span></span><span><strong>Mobile money</strong><small>Pay from your phone</small></span></div>
        </section>
        <section className="footer-faq" id="faq">
          <h2>Frequently asked questions</h2>
          <details><summary>How do I place an order?</summary><p>Add goods to your basket, enter your delivery details, and confirm your order.</p></details>
          <details><summary>How do I pay?</summary><p>Mobile money payment instructions and the shop number appear during checkout.</p></details>
          <details><summary>Do I need a customer account?</summary><p>No. You can order as a guest. Keep your order number for reference.</p></details>
        </section>
        <div className="footer-bottom" id="about-us">
          <div className="footer-about">
            <div className="footer-brand"><span className="brand-mark"><ShoppingBasket size={19} /></span><strong>AllDay<span className="brand-green">Dash</span></strong></div>
            <p>Good food. Good neighbors. All in one place.</p>
          </div>
          <span>© {new Date().getFullYear()} AllDayDash</span>
          <a className="admin-link" href="/admin">Admin</a>
        </div>
      </footer>
      {cartOpen && <CartPanel
        items={items} currency={currency} rate={USD_TO_LRD_RATE} mobileMoneyNumber={mobileMoneyNumber}
        onQuantity={setQuantity} onClose={() => setCartOpen(false)}
        onSubmitOrder={submitOrder} onConfirmPayment={confirmPayment}
      />}
      {notice && <div className="toast" role="status">{notice}</div>}
      <span className="sr-only" aria-live="polite">{itemCount} items in basket</span>
    </>
  );
}
