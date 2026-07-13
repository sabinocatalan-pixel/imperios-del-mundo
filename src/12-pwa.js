/* ==================== 12-pwa.js ====================
   Registro del service worker (Fase 1: PWA instalable). */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
