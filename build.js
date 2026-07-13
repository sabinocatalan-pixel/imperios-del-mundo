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

  const jsFiles = fs.readdirSync(SRC_DIR)
    .filter(f => f.endsWith(".js"))
    .sort((a, b) => a.localeCompare(b, "en"));
  const js = jsFiles.map(f => fs.readFileSync(path.join(SRC_DIR, f), "utf8")).join("\n");

  const out = template
    .replace("<!--INJECT:css-->", css)
    .replace("<!--INJECT:js-->", js);

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, out);
  console.log(`Construido ${path.relative(__dirname, OUT_FILE)} a partir de ${jsFiles.length} módulos JS.`);
}

build();
