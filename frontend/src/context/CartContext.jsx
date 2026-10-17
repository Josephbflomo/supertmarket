import { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("supertmarket-cart") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  function update(nextItems) {
    setItems(nextItems);
    localStorage.setItem("supertmarket-cart", JSON.stringify(nextItems));
  }

  function addItem(product) {
    const existing = items.find((item) => item._id === product._id);
    if (existing && existing.quantity >= product.stock) return false;
    update(existing
      ? items.map((item) => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...items, { ...product, quantity: 1 }]);
    return true;
  }

  function setQuantity(id, quantity) {
    if (quantity <= 0) {
      update(items.filter((item) => item._id !== id));
      return;
    }
    update(items.map((item) => item._id === id
      ? { ...item, quantity: Math.min(quantity, item.stock) }
      : item));
  }

  const value = useMemo(() => ({
    items,
    addItem,
    setQuantity,
    clear: () => update([])
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
