"use client";

import { useEffect } from "react";

const CACHE_PREFIX = "emberdex-";

export function ServiceWorkerManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      ).catch(() => undefined);

      if ("caches" in window) {
        void window.caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(CACHE_PREFIX))
              .map((key) => window.caches.delete(key))
          )
        ).catch(() => undefined);
      }

      return;
    }

    let hadController = Boolean(navigator.serviceWorker.controller);

    const reloadOnControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }

      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);

    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControllerChange);
    };
  }, []);

  return null;
}
