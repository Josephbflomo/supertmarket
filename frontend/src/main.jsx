import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminApp from "./components/AdminApp.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import "./styles.css";

const Page = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")
  ? AdminApp
  : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider><Page /></CartProvider>
  </React.StrictMode>
);
