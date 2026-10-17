import { Search, ShoppingBasket } from "lucide-react";

export default function Header({ currency, setCurrency, itemCount, onCart, onSearch, onAccount }) {
  return (
    <div className="customer-header-shell">
      <header className="site-header customer-header">
        <a className="brand" href="/" aria-label="AllDayDash home">
          <span className="brand-mark"><ShoppingBasket size={21} /></span>
          <span>AllDay<span className="brand-green">Dash</span></span>
        </a>
        <div className="header-actions">
          <label className="currency-select">
            <span className="sr-only">Currency</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Currency">
              <option value="USD">USD $</option>
              <option value="LRD">LRD L$</option>
            </select>
          </label>
          <button className="icon-button cart-button" onClick={onCart} aria-label={`Open cart, ${itemCount} items`}>
            <ShoppingBasket size={19} /><span>Basket</span>{itemCount > 0 && <b>{itemCount}</b>}
          </button>
        </div>
        <button className="mobile-search" aria-label="Search products" onClick={onSearch}><Search size={18} /></button>
      </header>
      <nav className="customer-nav" aria-label="Main navigation">
        <a href="#marketplace">Shop</a>
        <a href="#about-us">About Us</a>
        <button type="button" onClick={onAccount}>My Account</button>
        <a href="#faq">FAQ</a>
      </nav>
    </div>
  );
}
