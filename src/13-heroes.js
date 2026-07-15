/* ==================== 13-heroes.js ====================
   Panteón de 24 héroes (Fase 2A): 8 jugables completos + 16 bloqueados
   (solo datos; sus habilidades llegan en fases posteriores, sobre todo
   Campaña II). Sistema de equipamiento: 3 casillas por imperio
   (F[fid].heroes = [activo, consejo1, consejo2]); máx. 1 mítico entre
   las 3. El consejo solo aporta la pasiva "consejo" explícita de cada
   héroe (nunca combate). */

const RAREZA_LABEL = { comun: "Común", raro: "Raro", legendario: "Legendario", mitico: "Mítico" };
const RAREZA_ORDEN = ["comun", "raro", "legendario", "mitico"];

// ---- Los 8 héroes jugables (implementados completos) ----
const HEROES = {
  leonidas: {
    id: "leonidas", name: "Leónidas", region: "Grecia", rarity: "comun",
    tipoAtaque: "melee", locked: false,
    habilidad: { tipo: "pasiva", nombre: "Muro de Escudos", desc: "Melee aliados +10% def mientras vive" },
    frase: "¡Ven a tomarlas!",
    leyenda: "Rey de Esparta, símbolo de resistencia frente a un imperio muchas veces mayor.",
    notaCultural: "Inspirado en la historia de Grecia; representación lúdica y educativa, no documental.",
    armaAlt: {
      id: "lanza_dory", nombre: "Lanza dory", condDesc: "Sobrevive 3 batallas completas",
      efecto: "+30 de alcance melee",
      check: p => (p.battlesSurvived || 0) >= 3
    }
  },
  suntzu: {
    id: "suntzu", name: "Sun Tzu", region: "China", rarity: "comun",
    tipoAtaque: "ranged", locked: false,
    habilidad: { tipo: "pasiva", nombre: "El Arte de la Guerra", desc: "Unidades cuestan −10% mientras está en campo" },
    frase: "Conoce a tu enemigo y conócete a ti mismo.",
    leyenda: "Estratega y autor de El arte de la guerra; su presencia abarata la maquinaria militar.",
    notaCultural: "Inspirado en la historia de China; representación lúdica y educativa, no documental."
  },
  boudica: {
    id: "boudica", name: "Boudica", region: "Britania", rarity: "comun",
    tipoAtaque: "melee", locked: false,
    habilidad: { tipo: "activa", nombre: "Carga Furiosa", desc: "Aliados +20% velocidad 6s", cd: 25 },
    frase: "¡Cada aldea quemada será vengada!",
    leyenda: "Reina guerrera de los icenos; lideró la revuelta contra la ocupación romana en Britania.",
    notaCultural: "Inspirada en la historia de Britania; representación lúdica y educativa, no documental."
  },
  ollantay: {
    id: "ollantay", name: "Ollantay", region: "Andes", rarity: "comun",
    tipoAtaque: "melee", locked: false,
    habilidad: { tipo: "pasiva", nombre: "Corazón Rebelde", desc: "Al morir, tropas +15% daño 8s" },
    frase: "Mi corazón no se rinde ante ningún imperio.",
    leyenda: "Guerrero legendario de los Andes cuya rebeldía frente al Inca inspiró a generaciones.",
    notaCultural: "Inspirado en la tradición andina; representación lúdica y educativa, no documental."
  },
  anibal: {
    id: "anibal", name: "Aníbal", region: "Cartago", rarity: "raro",
    tipoAtaque: "melee", locked: false,
    habilidad: { tipo: "activa", nombre: "Flanqueo", desc: "Invoca 2 melee adelantados", cd: 35 },
    frase: "Encontraremos un camino, o lo abriremos.",
    leyenda: "General cartaginés que cruzó los Alpes para desafiar a Roma en su propio territorio.",
    notaCultural: "Inspirado en la historia de Cartago; representación lúdica y educativa, no documental.",
    armaAlt: {
      id: "jabalinas_punicas", nombre: "Jabalinas púnicas", condDesc: "Gana 3 batallas con Aníbal",
      efecto: "Pasa a ranged, alcance 120",
      check: p => (p.wins || 0) >= 3
    }
  },
  tomoegozen: {
    id: "tomoegozen", name: "Tomoe Gozen", region: "Japón", rarity: "raro",
    tipoAtaque: "melee", locked: false,
    habilidad: { tipo: "pasiva", nombre: "Danza de la Naginata", desc: "Golpes con área pequeña" },
    frase: "Mi naginata no conoce el miedo.",
    leyenda: "Guerrera samurái célebre por su destreza con la naginata durante el periodo Heian.",
    notaCultural: "Inspirada en la historia de Japón; representación lúdica y educativa, no documental.",
    armaAlt: {
      id: "arco_yumi", nombre: "Arco yumi", condDesc: "10 bajas ranged con ella en campo",
      efecto: "Alterna melee/ranged según distancia",
      check: p => (p.rangedKills || 0) >= 10
    }
  },
  pachacutec: {
    id: "pachacutec", name: "Pachacútec", region: "Tahuantinsuyo", rarity: "legendario",
    tipoAtaque: "melee", locked: false,
    habilidad: { tipo: "activa", nombre: "Reorganización Imperial", desc: "Cura 25% PV aliados + 10% def 10s", cd: 40 },
    consejo: { desc: "+1🪙/ronda por territorio sudamericano" },
    frase: "El imperio se construye con orden, no solo con la espada.",
    leyenda: "Noveno Sapa Inca; expandió y reorganizó el Tahuantinsuyo con una administración ejemplar.",
    notaCultural: "Inspirado en la historia del Tahuantinsuyo; representación lúdica y educativa, no documental."
  },
  amaru: {
    id: "amaru", name: "Amaru", region: "Andes (mito)", rarity: "mitico",
    tipoAtaque: "ranged", locked: true,
    habilidad: { tipo: "pasiva", nombre: "Renacer de la Serpiente", desc: "1 vez/batalla: al morir renace con 50% PV + onda que aturde 1.5s" },
    frase: "La serpiente que muere, siempre renace.",
    leyenda: "???",
    notaCultural: "Inspirado en la mitología andina; representación lúdica y educativa, no documental.",
    condDesc: "Fe ≥120 y ganar esa partida"
  }
};

// ---- Los 16 restantes: solo datos (nombre, región, rareza, condición
// visible). Sus habilidades se implementan cuando llegue su fase de
// desbloqueo (principalmente Campaña II). ----
const HEROES_BLOQUEADOS = {
  elcid: { id: "elcid", name: "El Cid", region: "España", rarity: "comun", locked: true, condDesc: "1 victoria en cualquier dificultad (o gana 3 defensas)" },
  yisunsin: { id: "yisunsin", name: "Yi Sun-sin", region: "Corea", rarity: "comun", locked: true, condDesc: "Usa ruta marítima para conquistar 5 veces" },
  tupacamaru2: { id: "tupacamaru2", name: "Túpac Amaru II", region: "Andes", rarity: "comun", locked: true, condDesc: "Gana una defensa estando bajo coalición" },
  zenobia: { id: "zenobia", name: "Zenobia", region: "Palmira", rarity: "comun", locked: true, condDesc: "Controla Medio Oriente" },
  saladino: { id: "saladino", name: "Saladino", region: "Egipto/Siria", rarity: "raro", locked: true, condDesc: "3 pactos en una partida" },
  shakazulu: { id: "shakazulu", name: "Shaka Zulú", region: "Sudáfrica", rarity: "raro", locked: true, condDesc: "África completa" },
  juanadearco: { id: "juanadearco", name: "Juana de Arco", region: "Francia", rarity: "raro", locked: true, condDesc: 'Gana "Blitz Europeo" en Difícil' },
  cuauhtemoc: { id: "cuauhtemoc", name: "Cuauhtémoc", region: "Mesoamérica", rarity: "raro", locked: true, condDesc: "Defiende Mesoamérica 3 veces" },
  gengiskan: { id: "gengiskan", name: "Gengis Kan", region: "Mongolia", rarity: "raro", locked: true, condDesc: "Conquista 5 territorios en una partida" },
  mansamusa: { id: "mansamusa", name: "Mansa Musa", region: "Malí", rarity: "raro", locked: true, condDesc: "Acumula 300🪙" },
  alejandromagno: { id: "alejandromagno", name: "Alejandro Magno", region: "Grecia/Persia", rarity: "legendario", locked: true, condDesc: "Conquista total en Difícil" },
  cleopatra: { id: "cleopatra", name: "Cleopatra", region: "Egipto", rarity: "legendario", locked: true, condDesc: "Victoria cultural" },
  naylamp: { id: "naylamp", name: "Naylamp", region: "Perú (mito)", rarity: "legendario", locked: true, condDesc: "Victoria controlando Perú + un costero" },
  atahualpa: { id: "atahualpa", name: "Atahualpa", region: "Andes", rarity: "legendario", locked: true, condDesc: '"Resistencia Andina" en Pesadilla' },
  inkarri: { id: "inkarri", name: "Inkarri", region: "Andes (mito)", rarity: "mitico", locked: true, condDesc: "Campaña completa en Pesadilla" },
  quetzalcoatl: { id: "quetzalcoatl", name: "Quetzalcóatl", region: "Mesoamérica (mito)", rarity: "mitico", locked: true, condDesc: "Victoria religiosa en Difícil+" }
};

const ALL_HEROES = Object.assign({}, HEROES, HEROES_BLOQUEADOS);

/* ==================== DESBLOQUEO ==================== */
function isHeroUnlocked(id) {
  const h = ALL_HEROES[id];
  if (!h) return false;
  return !h.locked || !!(LEGACY.heroes && LEGACY.heroes[id]);
}

/* ==================== EQUIPAMIENTO ====================
   f.heroes = [activoId|null, consejo1Id|null, consejo2Id|null] */
function heroEquippedIds(f) { return f.heroes.filter(Boolean); }
function heroMythicCount(f, excludeSlot = -1) {
  return f.heroes.filter((id, i) => i !== excludeSlot && id && ALL_HEROES[id].rarity === "mitico").length;
}
function setHeroSlot(fid, slot, heroId) {
  const f = F[fid];
  if (slot < 0 || slot > 2) return false;
  if (heroId === null) { f.heroes[slot] = null; return true; }
  const h = ALL_HEROES[heroId];
  if (!h || !isHeroUnlocked(heroId)) return false;
  if (f.heroes.some((id, i) => i !== slot && id === heroId)) return false; // ya equipado en otro slot
  if (h.rarity === "mitico" && heroMythicCount(f, slot) >= 1) return false; // máx. 1 mítico
  f.heroes[slot] = heroId;
  return true;
}

/* ==================== ARMAS ALTERNATIVAS ==================== */
function heroArmaAltActiva(fid, heroId) {
  const h = HEROES[heroId];
  if (!h || !h.armaAlt) return false;
  const p = (F[fid].heroProgress && F[fid].heroProgress[heroId]) || {};
  return !!h.armaAlt.check(p);
}
function heroProgressBump(fid, heroId, key, delta = 1) {
  const f = F[fid]; if (!f || !heroId) return;
  if (!f.heroProgress) f.heroProgress = {};
  if (!f.heroProgress[heroId]) f.heroProgress[heroId] = {};
  f.heroProgress[heroId][key] = (f.heroProgress[heroId][key] || 0) + delta;
}

/* ==================== DESBLOQUEOS DE LEGADO ====================
   Se llama desde endGame() tras actualizar LEGACY.wins. El Cid: 1
   victoria (LEGACY.wins≥1, cualquier dificultad) — así el legado de
   quien ya ganaba partidas antes de 2A no se queda sin beneficio;
   sigue pendiente su vía alternativa "gana 3 defensas" para cuando
   se implemente esa mecánica. Amaru: Fe≥120 y ganar esa partida. */
function checkHeroLegacyUnlocks(fid, won) {
  if (!LEGACY.heroes) LEGACY.heroes = {};
  if (LEGACY.wins >= 1 && !LEGACY.heroes.elcid) {
    LEGACY.heroes.elcid = true;
    log("⭐ Desbloqueaste a El Cid: 1 victoria en cualquier dificultad.", "win");
  }
  if (!won) return;
  const f = F[fid];
  if (f && f.faith >= 120) {
    if (!LEGACY.heroes.amaru) {
      LEGACY.heroes.amaru = true;
      log("⭐ Desbloqueaste a Amaru: Fe ≥120 y victoria.", "win");
    }
  }
}

/* ==================== UI: PANTEÓN / FICHA / CÓDICE ==================== */
let panteonMode = "ver"; // "ver" | "equipar"
let panteonFac = null;
let fichaHeroId = null;

function openPanteon(mode, fid) {
  panteonMode = mode || "ver";
  panteonFac = fid || player;
  fichaHeroId = null;
  $("panteonBody").dataset.tab = "panteon";
  renderPanteon();
  $("panteonModal").style.display = "flex";
}
function panteonSwitchTab(tab) {
  fichaHeroId = null;
  $("panteonBody").dataset.tab = tab;
  renderPanteon();
}
function renderPanteon() {
  const tab = $("panteonBody").dataset.tab || "panteon";
  if (fichaHeroId) { renderFicha(fichaHeroId); return; }
  const box = $("panteonBody");
  if (tab === "codice") {
    const done = Object.keys(ALL_HEROES).filter(id => isHeroUnlocked(id));
    box.innerHTML = `<div class="row" style="opacity:.75;margin-bottom:6px">Enciclopedia de héroes desbloqueados.</div>` +
      done.map(id => {
        const h = ALL_HEROES[id];
        return `<div class="mission"><b>${h.name}</b> — ${h.region} (${RAREZA_LABEL[h.rarity]})<br>
          <span style="opacity:.85">${h.leyenda || ""}</span></div>`;
      }).join("");
    return;
  }
  let h = "";
  if (panteonMode === "equipar") {
    const f = F[panteonFac];
    h += `<div class="row" style="opacity:.8;margin-bottom:6px">Toca un héroe para equiparlo/desequiparlo. Activo = combate; Consejo = solo pasiva.</div>`;
    h += `<div class="row"><b>Activo:</b> ${f.heroes[0] ? ALL_HEROES[f.heroes[0]].name : "— vacío —"}</div>`;
    h += `<div class="row"><b>Consejo:</b> ${[f.heroes[1], f.heroes[2]].filter(Boolean).map(id => ALL_HEROES[id].name).join(", ") || "— vacío —"}</div>`;
  }
  h += `<div class="heroGrid">`;
  for (const id of Object.keys(ALL_HEROES)) {
    const hero = ALL_HEROES[id];
    const unlocked = isHeroUnlocked(id);
    const f = panteonFac ? F[panteonFac] : null;
    const slot = f ? f.heroes.indexOf(id) : -1;
    h += `<div class="heroCard rar-${hero.rarity} ${unlocked ? "" : "locked"} ${slot >= 0 ? "equipped" : ""}"
      onclick="${unlocked ? `panteonCardClick('${id}')` : ""}">
      <div class="heroName">${unlocked ? hero.name : (hero.rarity === "mitico" ? "???" : hero.name)}</div>
      <div class="heroMeta">${hero.region} · ${RAREZA_LABEL[hero.rarity]}</div>
      ${unlocked ? "" : `<div class="heroLock">🔒 ${hero.condDesc || ""}</div>`}
      ${slot === 0 ? `<div class="heroSlotTag">⭐ activo</div>` : slot > 0 ? `<div class="heroSlotTag">consejo</div>` : ""}
    </div>`;
  }
  h += `</div>`;
  box.innerHTML = h;
}
function panteonCardClick(id) {
  if (panteonMode === "equipar") {
    const f = F[panteonFac];
    const slot = f.heroes.indexOf(id);
    if (slot >= 0) { setHeroSlot(panteonFac, slot, null); SFX.click(); renderPanteon(); render(); return; }
    if (!f.heroes[0]) {
      setHeroSlot(panteonFac, 0, id); SFX.win();
      if (panteonFac === player) { completeMission("champ"); log(`⭐ ${ALL_HEROES[id].name} se une a tu imperio como héroe activo.`, "win"); }
      renderPanteon(); render(); return;
    }
    const freeSlot = f.heroes.indexOf(null, 1) >= 1 ? f.heroes.indexOf(null, 1) : (f.heroes[1] ? (f.heroes[2] ? -1 : 2) : 1);
    if (freeSlot >= 1) { setHeroSlot(panteonFac, freeSlot, id); SFX.win(); renderPanteon(); render(); }
    else setStatus("Ya tienes 3 héroes equipados: quita uno antes de añadir otro.");
    return;
  }
  fichaHeroId = id;
  renderFicha(id);
}
function renderFicha(id) {
  const hero = ALL_HEROES[id];
  const unlocked = isHeroUnlocked(id);
  const box = $("panteonBody");
  box.innerHTML = `
    <div class="btns" style="margin-bottom:8px"><button class="act" onclick="fichaHeroId=null;renderPanteon();">← Volver</button></div>
    <div class="heroCard rar-${hero.rarity}" style="cursor:default">
      <div class="heroName">${unlocked ? hero.name : "???"}</div>
      <div class="heroMeta">${hero.region} · ${RAREZA_LABEL[hero.rarity]}${hero.tipoAtaque ? " · " + (hero.tipoAtaque === "melee" ? "🗡 melee" : "🏹 ranged") : ""}</div>
    </div>
    ${unlocked && hero.habilidad ? `<div class="row" style="margin-top:8px"><b>${hero.habilidad.nombre}</b> (${hero.habilidad.tipo}${hero.habilidad.cd ? ", cd " + hero.habilidad.cd + "s" : ""})<br>${hero.habilidad.desc}</div>` : ""}
    ${unlocked && hero.consejo ? `<div class="row" style="opacity:.85">Consejo: ${hero.consejo.desc}</div>` : ""}
    ${unlocked ? `<p style="margin-top:8px">${hero.leyenda}</p>` : `<div class="heroLock">🔒 ${hero.condDesc || ""}</div>`}
    ${unlocked ? `<p style="font-size:11px;opacity:.7">${hero.notaCultural}</p>` : ""}
    ${unlocked && hero.armaAlt ? `<div class="row" style="opacity:.85">⚔️ Arma alternativa "${hero.armaAlt.nombre}": ${hero.armaAlt.condDesc} → ${hero.armaAlt.efecto}</div>` : ""}
  `;
}

$("btnPanteon").onclick = () => { SFX.click(); openPanteon("ver", player); };
