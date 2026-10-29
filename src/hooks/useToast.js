import { useState } from "react";

// Toast queue. Each toast removes itself after `duration` ms.
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type = "info", duration = 3500) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
      duration,
    );
  };
  return {
    toasts,
    success: (msg) => show(msg, "success"),
    error: (msg) => show(msg, "error", 5000),
    info: (msg) => show(msg),
    warn: (msg) => show(msg, "warn", 5000),
  };
}
