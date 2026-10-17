import { useCallback, useEffect, useState } from "react";
import { Bell, Check, ChartNoAxesColumn, History, KeyRound, LogOut, Mail, Package, Plus, RefreshCw, Search, Store } from "lucide-react";
import { apiRequest } from "../api.js";
import { formatPrice, productImageSource } from "./ProductCard.jsx";

const categories = ["Produce", "Bakery", "Dairy & Eggs", "Meat & Seafood", "Pantry", "Beverages", "Household"];
const emptyProduct = { title: "", description: "", price: "", regularPrice: "", stock: "", category: "Produce" };
const currentMonth = new Date().toISOString().slice(0, 7);

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin({ email, password });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <a className="admin-back-link" href="/">← Back to the shop</a>
      <section className="admin-login-card">
        <span className="admin-login-icon"><Store size={23} /></span>
        <p className="eyebrow">PRIVATE ADMIN AREA</p>
        <h1>Sign in to manage your shop</h1>
        <p>Manage your goods and see customer orders.</p>
        <form className="admin-login-form" onSubmit={submit}>
          <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem("supertmarket-token"));
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [tab, setTab] = useState("orders");
  const [productForm, setProductForm] = useState(emptyProduct);
  const [regularPriceEdits, setRegularPriceEdits] = useState({});
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailForm, setEmailForm] = useState({ currentPassword: "", newEmail: "" });
  const [emailSaving, setEmailSaving] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const [productData, orderData] = await Promise.all([
        apiRequest("/products/admin", { token }),
        apiRequest("/orders", { token })
      ]);
      setProducts(productData.products);
      setOrders(orderData.orders);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 || requestError.status === 403) {
        localStorage.removeItem("supertmarket-token");
        setToken(null);
        setUser(null);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiRequest("/auth/me", { token })
      .then((data) => {
        if (data.user.role !== "admin") throw new Error("This account does not have admin access.");
        setUser(data.user);
      })
      .catch((requestError) => {
        localStorage.removeItem("supertmarket-token");
        setToken(null);
        setUser(null);
        setError(requestError.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !user) return undefined;
    loadDashboard();
    const interval = window.setInterval(() => loadDashboard(true), 15000);
    return () => window.clearInterval(interval);
  }, [token, user, loadDashboard]);

  useEffect(() => {
    if (!token || !user || tab !== "history") return undefined;
    const timer = window.setTimeout(async () => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({ page: String(historyPagination.page), limit: "25" });
        if (historySearch.trim()) params.set("search", historySearch.trim());
        const data = await apiRequest(`/orders/history?${params}`, { token });
        setHistory(data.orders);
        setHistoryPagination(data.pagination);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setHistoryLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [token, user, tab, historySearch, historyPagination.page]);

  useEffect(() => {
    if (!token || !user || tab !== "report") return undefined;
    let cancelled = false;
    setReportLoading(true);
    apiRequest(`/orders/reports/monthly?month=${encodeURIComponent(reportMonth)}`, { token })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [token, user, tab, reportMonth]);

  async function login(credentials) {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
    if (data.user.role !== "admin") throw new Error("This account does not have admin access.");
    localStorage.setItem("supertmarket-token", data.token);
    setUser(data.user);
    setToken(data.token);
    setError("");
  }

  function logout() {
    localStorage.removeItem("supertmarket-token");
    setToken(null);
    setUser(null);
    setProducts([]);
    setOrders([]);
  }

  async function publishProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const form = new FormData();
    Object.entries(productForm).forEach(([key, value]) => form.append(key, value));
    if (image) form.append("image", image);
    try {
      await apiRequest("/products", { method: "POST", token, body: form });
      setProductForm(emptyProduct);
      setImage(null);
      event.target.reset();
      setMessage("Your product is published in the shop.");
      setTab("products");
      await loadDashboard(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product) {
    setError("");
    try {
      await apiRequest(`/products/${product._id}`, { method: "DELETE", token });
      await loadDashboard(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveRegularPrice(event, product) {
    event.preventDefault();
    setError("");
    setMessage("");
    const regularPrice = regularPriceEdits[product._id] ?? "";
    try {
      const data = await apiRequest(`/products/${product._id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ regularPrice })
      });
      setProducts((current) => current.map((item) => item._id === product._id ? data.product : item));
      setMessage(regularPrice ? `Regular price updated for ${product.title}.` : `Sale price removed for ${product.title}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function updateOrder(order, status) {
    setError("");
    try {
      await apiRequest(`/orders/${order._id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status })
      });
      await loadDashboard(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const data = await apiRequest("/auth/password", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      setMessage(data.message);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function changeEmail(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setEmailSaving(true);
    try {
      const data = await apiRequest("/auth/email", {
        method: "PATCH",
        token,
        body: JSON.stringify(emailForm)
      });
      setUser(data.user);
      setEmailForm({ currentPassword: "", newEmail: "" });
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setEmailSaving(false);
    }
  }

  if (!token || !user) {
    return loading ? <main className="admin-login-page"><p className="loading-state"><span className="spinner"></span>Checking admin access...</p></main> : <Login onLogin={login} />;
  }

  const newOrders = orders.filter((order) => order.status === "new").length;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="admin-brand" href="/"><span className="brand-mark"><ShoppingBasketIcon /></span><span>AllDay<span className="brand-green">Dash</span></span></a>
        <div className="admin-user"><span>{user.name}</span><button className="outline-button" onClick={logout}><LogOut size={15} /> Sign out</button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="eyebrow">SHOP MANAGEMENT</p>
          <button className={tab === "orders" ? "admin-nav active" : "admin-nav"} onClick={() => setTab("orders")}><Bell size={17} /> Orders <span>{newOrders}</span></button>
          <button className={tab === "history" ? "admin-nav active" : "admin-nav"} onClick={() => { setHistoryPagination((current) => ({ ...current, page: 1 })); setTab("history"); }}><History size={17} /> Order history</button>
          <button className={tab === "report" ? "admin-nav active" : "admin-nav"} onClick={() => setTab("report")}><ChartNoAxesColumn size={17} /> Monthly report</button>
          <button className={tab === "products" ? "admin-nav active" : "admin-nav"} onClick={() => setTab("products")}><Package size={17} /> My goods</button>
          <button className={tab === "add" ? "admin-nav active" : "admin-nav"} onClick={() => setTab("add")}><Plus size={17} /> Post a good</button>
          <button className={tab === "email" ? "admin-nav active" : "admin-nav"} onClick={() => setTab("email")}><Mail size={17} /> Change login email</button>
          <button className={tab === "password" ? "admin-nav active" : "admin-nav"} onClick={() => setTab("password")}><KeyRound size={17} /> Change password</button>
          <div className="admin-sidebar-note"><strong>New orders</strong><span>Order inbox refreshes every 15 seconds.</span></div>
        </aside>
        <section className="admin-content">
          <div className="admin-title-row">
            <div><p className="eyebrow">YOUR PRIVATE BACKEND</p><h1>{tab === "orders" ? "Customer orders" : tab === "history" ? "Customer and order history" : tab === "report" ? "Monthly report" : tab === "products" ? "Your goods" : tab === "password" ? "Change admin password" : tab === "email" ? "Change admin login email" : "Post a new good"}</h1><p>Signed in as {user.email}</p></div>
            <button className="outline-button" onClick={() => loadDashboard()}><RefreshCw size={15} /> Refresh</button>
          </div>
          {error && <p className="form-error admin-alert">{error}</p>}
          {message && <p className="form-success admin-alert">{message}</p>}
          {tab === "orders" && (
            loading ? <div className="loading-state"><span className="spinner"></span>Loading orders...</div>
              : orders.length === 0 ? <section className="admin-empty"><Bell size={28} /><h2>No orders yet</h2><p>When a customer confirms an order, it will appear here.</p></section>
                : <div className="order-list">{orders.map((order) => (
                  <article className={`order-card ${order.status === "new" ? "order-new" : ""}`} key={order._id}>
                    <div className="order-heading">
                      <div><span className="order-number">{order.orderNumber}</span><small>{new Date(order.createdAt).toLocaleString()}</small></div>
                      <div className="order-badges"><span className={`order-status ${order.status}`}>{order.status.replace("_", " ")}</span><span className={`payment-status ${order.paymentStatus}`}>{order.paymentStatus === "customer_reported" ? "Customer says paid" : "Awaiting payment"}</span></div>
                    </div>
                    <div className="order-customer"><strong>{order.customerName}</strong><a href={`tel:${order.phone}`}>{order.phone}</a><span>{order.deliveryAddress}</span></div>
                    <div className="order-lines">{order.items.map((item) => <div key={`${order._id}-${item.product}`}><span>{item.quantity} × {item.title}</span><strong>{formatPrice(item.price * item.quantity, "USD", 190)}</strong></div>)}</div>
                    <div className="order-footer"><strong>Total: {formatPrice(order.total, "USD", 190)}</strong>
                      {order.status === "new" && <div className="order-actions"><button className="outline-button" onClick={() => updateOrder(order, "cancelled")}>Cancel</button><button className="primary-button" onClick={() => updateOrder(order, "processing")}>Accept order</button></div>}
                      {order.status === "processing" && <button className="primary-button" onClick={() => updateOrder(order, "completed")}><Check size={15} /> Mark complete</button>}
                    </div>
                  </article>
                ))}</div>
          )}
          {tab === "history" && (
            <>
              <label className="history-search"><Search size={17} /><input value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPagination((current) => ({ ...current, page: 1 })); }} placeholder="Search customer, phone, or order number" /><span className="sr-only">Search order history</span></label>
              {historyLoading ? <div className="loading-state"><span className="spinner"></span>Loading order history...</div>
                : history.length === 0 ? <section className="admin-empty"><History size={28} /><h2>No matching orders</h2><p>Completed and past customer orders will appear here.</p></section>
                  : <div className="order-list">{history.map((order) => (
                    <article className="order-card" key={order._id}>
                      <div className="order-heading">
                        <div><span className="order-number">{order.orderNumber}</span><small>{new Date(order.createdAt).toLocaleString()}</small></div>
                        <div className="order-badges"><span className={`order-status ${order.status}`}>{order.status}</span><span className={`payment-status ${order.paymentStatus}`}>{order.paymentStatus === "customer_reported" ? "Customer says paid" : "Awaiting payment"}</span></div>
                      </div>
                      <div className="order-customer"><strong>{order.customerName}</strong><a href={`tel:${order.phone}`}>{order.phone}</a><span>{order.deliveryAddress}</span></div>
                      <div className="order-lines">{order.items.map((item) => <div key={`${order._id}-${item.product}`}><span>{item.quantity} × {item.title}</span><strong>{formatPrice(item.price * item.quantity, "USD", 190)}</strong></div>)}</div>
                      <div className="order-footer"><strong>Total: {formatPrice(order.total, "USD", 190)}</strong></div>
                    </article>
                  ))}</div>}
              {!historyLoading && historyPagination.pages > 1 && <div className="pagination"><button className="outline-button" disabled={historyPagination.page <= 1} onClick={() => setHistoryPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {historyPagination.page} of {historyPagination.pages} · {historyPagination.total} orders</span><button className="outline-button" disabled={historyPagination.page >= historyPagination.pages} onClick={() => setHistoryPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div>}
            </>
          )}
          {tab === "report" && (
            <section className="monthly-report">
              <label className="report-month">Report month<input type="month" value={reportMonth} max={currentMonth} onChange={(event) => setReportMonth(event.target.value)} /></label>
              {reportLoading ? <div className="loading-state"><span className="spinner"></span>Preparing report...</div>
                : report && <>
                  <div className="report-summary">
                    <article><span>Sales total</span><strong>{formatPrice(report.salesTotal, "USD", 190)}</strong><small>Excludes cancelled orders</small></article>
                    <article><span>Orders received</span><strong>{report.orderCount}</strong><small>{report.completedCount} completed</small></article>
                    <article><span>Payments reported</span><strong>{report.paymentReportedCount}</strong><small>Customer reported mobile money</small></article>
                    <article><span>Cancelled</span><strong>{report.cancelledCount}</strong><small>Orders not counted in sales</small></article>
                  </div>
                  <div className="report-products"><h2>Top goods this month</h2>{report.topProducts.length ? report.topProducts.map((product) => <div key={product.title}><span>{product.title}<small>{product.quantity} sold</small></span><strong>{formatPrice(product.sales, "USD", 190)}</strong></div>) : <p>No sales recorded for this month.</p>}</div>
                </>}
            </section>
          )}
          {tab === "products" && (
            loading ? <div className="loading-state"><span className="spinner"></span>Loading your goods...</div>
              : products.length === 0 ? <section className="admin-empty"><Package size={28} /><h2>No goods posted yet</h2><p>Add your first product with a photo to show it in the shop.</p><button className="primary-button" onClick={() => setTab("add")}>Post a good</button></section>
                : <div className="admin-product-list">{products.map((product) => (
                  <article className={`admin-product-row ${product.isActive ? "" : "inactive"}`} key={product._id}>
                    <div className="admin-product-image">{product.imageUrl ? <img src={productImageSource(product.imageUrl)} alt="" /> : "🥬"}</div>
                    <div className="admin-product-info"><strong>{product.title}</strong><span>{product.category} · {product.regularPrice > product.price && <><del>{formatPrice(product.regularPrice, "USD", 190)}</del> </>}{formatPrice(product.price, "USD", 190)} · {product.stock} in stock</span><small>{product.isActive ? "Visible in shop" : "Archived"}</small></div>
                    <form className="admin-sale-form" onSubmit={(event) => saveRegularPrice(event, product)}>
                      <label>Regular price (USD)<input aria-label={`Regular price for ${product.title}`} type="number" min={product.price + 0.01} step="0.01" value={regularPriceEdits[product._id] ?? product.regularPrice ?? ""} onChange={(event) => setRegularPriceEdits((current) => ({ ...current, [product._id]: event.target.value }))} placeholder="Optional" /></label>
                      <button className="outline-button">Save price</button>
                    </form>
                    {product.isActive && <button className="outline-button" onClick={() => archiveProduct(product)}>Remove from shop</button>}
                  </article>
                ))}</div>
          )}
          {tab === "add" && (
            <form className="admin-product-form" onSubmit={publishProduct}>
              <p>Add the details customers will see in the shop. A clear product photo helps people choose.</p>
              <div className="admin-form-grid">
                <label>Product name<input required maxLength="140" value={productForm.title} onChange={(event) => setProductForm({ ...productForm, title: event.target.value })} /></label>
                <label>Category<select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Price (USD)<input required type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
                <label>Regular price (USD, optional)<input type="number" min={productForm.price ? Number(productForm.price) + 0.01 : "0"} step="0.01" value={productForm.regularPrice} onChange={(event) => setProductForm({ ...productForm, regularPrice: event.target.value })} /><small>Enter a higher price to show a crossed-out sale price.</small></label>
                <label>Quantity in stock<input required type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
                <label className="wide-field">Description<textarea maxLength="2000" rows="4" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                <label className="admin-image-upload wide-field">Product photo <small>JPG, PNG, or WebP · up to 5 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} />{image && <span>{image.name}</span>}</label>
              </div>
              <button className="primary-button" disabled={saving}>{saving ? "Publishing..." : "Publish product"}</button>
            </form>
          )}
          {tab === "password" && (
            <form className="password-form" onSubmit={changePassword}>
              <p>Enter your current password, then choose a new one with at least 12 characters.</p>
              <label>Current password<input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label>
              <label>New password<input required minLength="12" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label>
              <label>Confirm new password<input required minLength="12" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} /></label>
              <button className="primary-button" disabled={passwordSaving}>{passwordSaving ? "Updating..." : "Update password"}</button>
            </form>
          )}
          {tab === "email" && (
            <form className="password-form" onSubmit={changeEmail}>
              <p>Your login email is <strong>{user.email}</strong>. Enter your current password to verify this change.</p>
              <label>New admin email<input required type="email" autoComplete="email" value={emailForm.newEmail} onChange={(event) => setEmailForm({ ...emailForm, newEmail: event.target.value })} /></label>
              <label>Current password<input required type="password" autoComplete="current-password" value={emailForm.currentPassword} onChange={(event) => setEmailForm({ ...emailForm, currentPassword: event.target.value })} /></label>
              <button className="primary-button" disabled={emailSaving}>{emailSaving ? "Updating..." : "Update login email"}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function ShoppingBasketIcon() {
  return <Package size={19} />;
}
