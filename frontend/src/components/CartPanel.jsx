import { useState } from "react";
import { Minus, Plus, ShoppingBasket, X } from "lucide-react";
import { formatPrice, productImageSource } from "./ProductCard.jsx";

export default function CartPanel({
  items,
  currency,
  rate,
  mobileMoneyNumber,
  onQuantity,
  onClose,
  onSubmitOrder,
  onConfirmPayment
}) {
  const [checkout, setCheckout] = useState(false);
  const [details, setDetails] = useState({ customerName: "", phone: "", deliveryAddress: "" });
  const [orderResult, setOrderResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function submitOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await onSubmitOrder(details);
      setOrderResult(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    setConfirmationBusy(true);
    setError("");
    try {
      await onConfirmPayment(orderResult);
      setPaymentConfirmed(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConfirmationBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cart-panel checkout-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="panel-heading">
          <div><p className="eyebrow">{orderResult ? "ORDER RECEIVED" : "YOUR BASKET"}</p><h2 id="cart-title">{orderResult ? "Thank you" : "Shopping basket"}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close basket"><X size={20} /></button>
        </div>
        {orderResult ? (
          <div className="order-success">
            <div className="success-mark">✓</div>
            <h3>Your order is in!</h3>
            <p>Order number <strong>{orderResult.order.orderNumber}</strong></p>
            <div className="payment-instructions">
              <span>Send mobile money payment to</span>
              <strong>{mobileMoneyNumber || "Mobile money number not configured"}</strong>
              <span>Order total</span>
              <strong>{formatPrice(orderResult.order.total, currency, rate)}</strong>
              <span>Approximate Liberian dollar amount</span>
              <strong>{formatPrice(orderResult.order.total, "LRD", rate)}</strong>
              <small>Use the order number as the payment reference. The exchange rate is an estimate; we’ll review your order and confirm it.</small>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            {paymentConfirmed
              ? <p className="form-success">Thanks. Your payment confirmation has been sent for review.</p>
              : <button className="primary-button" onClick={confirmPayment} disabled={confirmationBusy}>{confirmationBusy ? "Sending..." : "I have sent the payment"}</button>}
            <button className="text-button" onClick={onClose}>Continue shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.length === 0 ? (
                <div className="empty-state"><ShoppingBasket size={34} /><h3>Your basket is empty</h3><p>Add goods from the market to get started.</p></div>
              ) : items.map((item) => (
                <div className="cart-item" key={item._id}>
                  <div className="cart-item-image">{item.imageUrl ? <img src={productImageSource(item.imageUrl)} alt="" /> : "🥬"}</div>
                  <div className="cart-item-info"><strong>{item.title}</strong><span>{formatPrice(item.price, currency, rate)}</span>
                    <div className="quantity-control">
                      <button onClick={() => onQuantity(item._id, item.quantity - 1)} aria-label={`Remove one ${item.title}`}><Minus size={13} /></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => onQuantity(item._id, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label={`Add one ${item.title}`}><Plus size={13} /></button>
                    </div>
                  </div>
                  <b>{formatPrice(item.price * item.quantity, currency, rate)}</b>
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div className="cart-summary">
                <div><span>Total</span><strong>{formatPrice(total, currency, rate)}</strong></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                {checkout ? (
                  <form className="checkout-form" onSubmit={submitOrder}>
                    <h3>Delivery details</h3>
                    <p className="checkout-payment-number">Mobile money payment number: <strong>{mobileMoneyNumber || "not configured"}</strong></p>
                    <label>Your name<input required maxLength="100" value={details.customerName} onChange={(event) => setDetails({ ...details, customerName: event.target.value })} /></label>
                    <label>Phone number<input required maxLength="40" type="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} /></label>
                    <label>Delivery address<textarea required maxLength="500" rows="3" value={details.deliveryAddress} onChange={(event) => setDetails({ ...details, deliveryAddress: event.target.value })} /></label>
                    <button className="primary-button" disabled={busy}>{busy ? "Placing order..." : "Confirm order"}</button>
                  </form>
                ) : (
                  <>
                    <p>Pay by mobile money after confirming your order. Number: <strong>{mobileMoneyNumber || "not configured"}</strong></p>
                    <button className="primary-button" onClick={() => { setCheckout(true); setError(""); }}>Continue to checkout</button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
