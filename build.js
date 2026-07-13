"use strict";
/* build.js — concatena src/ en dist/imperios.html (un solo archivo HTML).
   Node puro, sin dependencias. Uso: node build.js */
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const DIST_DIR = path.join(__dirname, "dist");
const OUT_FILE = path.join(DIST_DIR, "imperios.html");

function build() {
  const template = fs.readFileSync(path.join(SRC_DIR, "index.template.html"), "utf8");
  const css = fs.readFileSync(path.join(SRC_DIR, "styles.css"), "utf8");

  // Solo los módulos numerados (01-... .. 99-...) forman el bundle de la
  // página; sw.js es un archivo aparte que el navegador debe poder pedir
  // por su cuenta, no algo que inyectar dentro de <script>.
  const jsFiles = fs.readdirSync(SRC_DIR)
    .filter(f => /^\d+-.*\.js$/.test(f))
    .sort((a, b) => a.localeCompare(b, "en"));
  const js = jsFiles.map(f => fs.readFileSync(path.join(SRC_DIR, f), "utf8")).join("\n");

  const out = template
    .replace("<!--INJECT:css-->", css)
    .replace("<!--INJECT:js-->", js);

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, out);
  console.log(`Construido ${path.relative(__dirname, OUT_FILE)} a partir de ${jsFiles.length} módulos JS.`);

  copyPwaAssets();
}

function copyPwaAssets() {
  fs.copyFileSync(path.join(SRC_DIR, "manifest.webmanifest"), path.join(DIST_DIR, "manifest.webmanifest"));
  fs.copyFileSync(path.join(SRC_DIR, "sw.js"), path.join(DIST_DIR, "sw.js"));
  const iconsOut = path.join(DIST_DIR, "icons");
  fs.mkdirSync(iconsOut, { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC_DIR, "icons"))) {
    fs.copyFileSync(path.join(SRC_DIR, "icons", f), path.join(iconsOut, f));
  }
  console.log("Copiados assets PWA: manifest.webmanifest, sw.js, icons/.");
}

build();
