import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const _basePath = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
if (_basePath) {
  const _origFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string" && input.startsWith("/") && !input.startsWith(_basePath)) {
      input = `${_basePath}${input}`;
    }
    return _origFetch.call(this, input, init);
  } as typeof fetch;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${_basePath}/sw.js`, { scope: `${_basePath}/` }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
