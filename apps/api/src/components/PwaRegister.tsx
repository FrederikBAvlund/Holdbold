"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        registration.update().catch(() => undefined);
      } catch (error) {
        console.error("Kunne ikke registrere service worker", error);
      }
    };

    register();
  }, []);

  return null;
}
