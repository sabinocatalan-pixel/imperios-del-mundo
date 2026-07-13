/* ==================== 12-pwa.js ====================
   Registro del service worker y autoguardado en localStorage
   (Fase 1: PWA instalable). */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ==================== AUTOGUARDADO (localStorage) ====================
   Los códigos manuales (sección de Ajustes) siguen siendo el respaldo/
   exportación; esto solo añade una restauración automática al reabrir. */
const AUTOSAVE_KEY = "imperiosAutosave";
const AUTOSAVE_LEG_KEY = "imperiosLegado";

function autoSaveGame() {
  try {
    const code = saveGame();
    if (code) localStorage.setItem(AUTOSAVE_KEY, code);
  } catch (e) { /* localStorage no disponible o lleno: se ignora */ }
}
function autoSaveLegacy() {
  try { localStorage.setItem(AUTOSAVE_LEG_KEY, legacyCode()); }
  catch (e) { /* localStorage no disponible o lleno: se ignora */ }
}
function tryAutoLoad() {
  try {
    const legCode = localStorage.getItem(AUTOSAVE_LEG_KEY);
    if (legCode) loadLegacy(legCode);
  } catch (e) { /* ignorar */ }
  try {
    const saveCode = localStorage.getItem(AUTOSAVE_KEY);
    if (saveCode) return loadGame(saveCode);
  } catch (e) { /* ignorar */ }
  return false;
}
