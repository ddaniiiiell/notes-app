"use client";

import { useEffect } from "react";

// Registers the offline service worker (see public/sw.js). Production only —
// in dev the worker's caching would fight Next.js hot reloading.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures (e.g. unsupported browser) are non-fatal —
        // the app still works online, just without offline caching.
      });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
