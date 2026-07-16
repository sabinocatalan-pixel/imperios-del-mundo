"use strict";
/* test/juego.test.js — suite jsdom sobre dist/imperios.html (ver CLAUDE.md sección 7). */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const DIST_FILE = path.join(__dirname, "..", "dist", "imperios.html");
if (!fs.existsSync(DIST_FILE)) {
  console.error("No existe dist/imperios.html. Ejecuta primero: npm run build");
  process.exit(1);
}
const HTML = fs.readFileSync(DIST_FILE, "utf8");

function stubCanvas(window) {
  window.HTMLCanvasElement.prototype.getContext = function () {
    const handler = {
      get(target, prop) {
        if (prop === "createLinearGradient" || prop === "createRadialGradient") {
          return () => ({ addColorStop: () => {} });
        }
        if (typeof target[prop] !== "function") target[prop] = function () {};
        return target[prop];
      },
      set(target, prop, value) { target[prop] = value; return true; }
    };
    return new Proxy({}, handler);
  };
}

function makeGame(opts = {}) {
  const errors = [];
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    url: opts.url || "http://localhost/",
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false });
      stubCanvas(window);
      // Sembrar localStorage ANTES de que corra el <script> del documento,
      // para que tryAutoLoad() (99-main.js) lo encuentre al arrancar.
      if (opts.seedAutosave) window.localStorage.setItem("imperiosAutosave", opts.seedAutosave);
      if (opts.seedLegacy) window.localStorage.setItem("imperiosLegado", opts.seedLegacy);
    }
  });
  dom.window.addEventListener("error", e => errors.push(e.error || e.message || e));
  return { dom, win: dom.window, doc: dom.window.document, errors };
}

function closeGame(game) {
  try { game.win.close(); } catch (e) { /* ignorar */ }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Espera activa por condición en vez de sleeps fijos: el motor de batalla y
// aiTurns() avanzan con setTimeout internos cuyo margen real depende de la
// velocidad del runner (un CI puede ser bastante más lento que una laptop),
// así que sondear hasta que se cumpla la condición (con un timeout generoso
// como red de seguridad) es más robusto que adivinar cuántos ms alcanzan.
async function waitUntil(win, predicateExpr, { timeout = 8000, interval = 50 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (win.eval(predicateExpr)) return true;
    await sleep(interval);
  }
  return false;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* 1. 1P: startGame(1.0) → clickTerr elige facción → phase==="play". */
test("1P: elegir facción entra en fase play", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")');
    assert.strictEqual(g.win.eval("phase"), "play");
    assert.strictEqual(g.win.eval("player"), "AG");
  } finally { closeGame(g); }
});

/* 2. Ataque: seleccionar territorio propio → vecino enemigo → inBattle && B.mode==="attack";
      multiplicadores counterMult 1.5/0.66; finishBattle(true) transfiere territorio y cumple conq1. */
test("Ataque: abre batalla, counterMult correcto, conquista al ganar", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // jugador = AG
    g.win.eval('clickTerr("CAN")'); // selecciona territorio propio
    g.win.eval('clickTerr("EUN")'); // vecino enemigo (CO) -> abre batalla
    assert.strictEqual(g.win.eval("inBattle"), true);
    assert.strictEqual(g.win.eval("B.mode"), "attack");

    const cm1 = g.win.eval('counterMult({kind:"melee"},{kind:"ranged"})');
    const cm2 = g.win.eval('counterMult({kind:"ranged"},{kind:"melee"})');
    assert.strictEqual(cm1, 1.5);
    assert.ok(Math.abs(cm2 - 0.66) < 1e-9);

    g.win.eval('finishBattle(true)');
    const conquered = await waitUntil(g.win, 'T.EUN.owner==="AG"');
    assert.ok(conquered, "finishBattle(true) debe transferir el territorio (timeout esperando)");
    assert.strictEqual(g.win.eval("missions.find(m=>m.id==='conq1').done"), true);
  } finally { closeGame(g); }
});

/* 3. Regresión anti-crash: eliminar todos los territorios de una facción a mitad de aiTurns
      → no lanza excepción y la ronda avanza. */
test("Anti-crash: facción eliminada durante aiTurns no rompe la ronda", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // jugador = AG
    const roundBefore = g.win.eval("round");
    // aiTurns() captura la lista de enemigos vivos (incluye "SB") y agenda el
    // primer paso con setTimeout; eliminamos a SB justo después, en el mismo
    // tick síncrono, para que el guardado ocurra "a mitad" del recorrido real.
    g.win.eval('endHumanTurn()');
    g.win.eval('ownedBy("SB").forEach(id=>{T[id].owner="SO";})');
    assert.strictEqual(g.win.eval('ownedBy("SB").length'), 0);
    const advanced = await waitUntil(g.win, `round > ${roundBefore}`, { timeout: 12000 });
    assert.strictEqual(g.errors.length, 0, "no debe haber excepciones: " + JSON.stringify(g.errors));
    assert.ok(advanced, "la ronda debe avanzar (timeout esperando)");
  } finally { closeGame(g); }
});

/* 4. Guardado: loadGame(saveGame())===true; legado: loadLegacy(legacyCode())===true. */
test("Guardado y legado: round-trip de códigos Base64", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")');
    assert.strictEqual(g.win.eval("loadGame(saveGame())"), true);
    assert.strictEqual(g.win.eval("loadLegacy(legacyCode())"), true);
  } finally { closeGame(g); }
});

/* 5. Escenarios: desbloqueo secuencial; "Cerco del Dragón" arranca solo con CHN;
      objetivo cumplido → "¡Escenario superado!" y LEGACY.scen.s3===true. */
test("Escenarios: desbloqueo secuencial y victoria de escenario", async () => {
  const g = makeGame();
  try {
    // desbloqueo secuencial: s2 (índice 1) empieza bloqueado.
    let locked1 = g.doc.querySelectorAll("#scenList .scen")[1].classList.contains("locked");
    assert.strictEqual(locked1, true);
    g.win.eval('LEGACY.scen.s1=true; renderScenList();');
    let locked1b = g.doc.querySelectorAll("#scenList .scen")[1].classList.contains("locked");
    assert.strictEqual(locked1b, false);

    // "Cerco del Dragón" (índice 2) arranca solo con CHN.
    g.win.eval('startScenario(2)');
    assert.strictEqual(g.win.eval("player"), "DR");
    assert.strictEqual(g.win.eval('JSON.stringify(ownedBy("DR"))'), JSON.stringify(["CHN"]));

    // cumplir objetivo: poseer MOR,RUS,IND,CHN
    g.win.eval('T.MOR.owner="DR";T.RUS.owner="DR";T.IND.owner="DR";');
    g.win.eval('checkScenario()');
    assert.ok(g.doc.getElementById("ovTitle").textContent.includes("¡Escenario superado!"));
    assert.strictEqual(g.win.eval("LEGACY.scen.s3"), true);
  } finally { closeGame(g); }
});

/* 6. 2P: setPickMode(2) → dos clickTerr → humans.length===2; endHumanTurn() rota al segundo humano;
      ataque humano→humano abre B.pvp===true con 8+ btnRefs; spawnUnit/useSpecial funcionan para ambos. */
test("2P: duelo, rotación de turno, batalla pvp y acciones de ambos bandos", async () => {
  const g = makeGame();
  try {
    g.win.eval('setPickMode(2)');
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // jugador 1 = AG
    g.win.eval('clickTerr("EUN")'); // jugador 2 = CO
    assert.strictEqual(g.win.eval("humans.length"), 2);
    assert.strictEqual(g.win.eval("player"), "AG");

    g.win.eval('endHumanTurn()');
    assert.strictEqual(g.win.eval("player"), "CO");

    g.win.eval('clickTerr("EUO")'); // territorio propio de CO
    g.win.eval('clickTerr("USA")'); // vecino humano (AG) -> pvp
    assert.strictEqual(g.win.eval("B.pvp"), true);
    assert.ok(g.win.eval("B.btnRefs.length") >= 8);

    const unitsBefore = g.win.eval("B.units.length");
    g.win.eval('spawnUnit("1","melee")');
    g.win.eval('spawnUnit("-1","melee")');
    assert.strictEqual(g.win.eval("B.units.length"), unitsBefore + 2);

    g.win.eval('useSpecial("1")');
    g.win.eval('useSpecial("-1")');
    assert.ok(g.win.eval('B.S["1"].cool.spec') > 0);
    assert.ok(g.win.eval('B.S["-1"].cool.spec') > 0);
  } finally { closeGame(g); }
});

/* 7. IA de batalla: con cool.spec=0, cool.champ=0, time>12 y 3 unidades del jugador,
      enemyAI(0.1) lanza especial y despliega campeón. */
test("IA de batalla: usa especial y despliega campeón cuando corresponde", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // AG
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // ataca a CO -> B.eFacId === "CO"
    assert.strictEqual(g.win.eval("inBattle"), true);
    g.win.eval('F[B.eFacId].heroes[0]="anibal"');
    g.win.eval('B.time=13; B.S["-1"].cool.spec=0; B.S["-1"].cool.champ=0;');
    g.win.eval('for(let i=0;i<3;i++)B.units.push(mkUnit(1,"melee",0,0,1));');
    g.win.eval('enemyAI(0.1)');
    assert.strictEqual(g.win.eval('B.S["-1"].champAlive'), true);
    assert.ok(g.win.eval('B.S["-1"].cool.spec') > 0);
  } finally { closeGame(g); }
});

/* 8. Diplomacia: pendingOffer tipo demand → maybeShowOffer() muestra modal;
      resolveOffer(true) transfiere oro y sube relación. */
test("Diplomacia: exigencia de tributo se muestra y se resuelve", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    const goldPlayerBefore = g.win.eval("F[player].gold");
    const goldCoBefore = g.win.eval("F.CO.gold");
    g.win.eval('pendingOffer={from:"CO",to:player,type:"demand",gold:20};');
    g.win.eval('maybeShowOffer()');
    assert.strictEqual(g.doc.getElementById("diploModal").style.display, "flex");

    g.win.eval('resolveOffer(true)');
    assert.strictEqual(g.win.eval("F[player].gold"), goldPlayerBefore - 20);
    assert.strictEqual(g.win.eval("F.CO.gold"), goldCoBefore + 20);
    assert.ok(g.win.eval('relGet("CO",player)') > 0);
  } finally { closeGame(g); }
});

/* 9 (Fase 1). PWA: startRound() autoguarda en localStorage y tryAutoLoad()
   restaura esa partida al arrancar una página nueva. */
test("PWA: autoguardado por ronda y restauración automática al reabrir", async () => {
  const g1 = makeGame();
  let code;
  try {
    g1.win.eval('startGame(1.0)');
    g1.win.eval('clickTerr("CAN")');
    code = g1.win.eval("localStorage.getItem('imperiosAutosave')");
    assert.ok(code, "startRound() debe autoguardar en localStorage");
  } finally { closeGame(g1); }

  const g2 = makeGame({ seedAutosave: code });
  try {
    assert.strictEqual(g2.win.eval("phase"), "play");
    assert.strictEqual(g2.win.eval("player"), "AG");
  } finally { closeGame(g2); }
});

/* 10 (Fase 1). PWA: endGame() autoguarda el código de legado en localStorage. */
test("PWA: autoguardado del legado al terminar la partida", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")');
    g.win.eval('endGame("¡Victoria!","fin de prueba",true,player)');
    const saved = g.win.eval("localStorage.getItem('imperiosLegado')");
    assert.ok(saved);
    assert.strictEqual(saved, g.win.eval("legacyCode()"));
  } finally { closeGame(g); }
});

/* 11 (Fase 2A). Panteón: límites de equipamiento — máx. 1 mítico, máx. 3 equipados. */
test("Panteón: límites de equipamiento (máx. 1 mítico, máx. 3 equipados)", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('LEGACY.heroes.amaru=true; LEGACY.heroes.inkarri=true;'); // desbloqueo de prueba

    assert.strictEqual(g.win.eval('setHeroSlot(player,0,"amaru")'), true);
    // Un segundo mítico (Inkarri) en otro slot debe rechazarse: máx. 1 mítico equipado.
    assert.strictEqual(g.win.eval('setHeroSlot(player,1,"inkarri")'), false);
    assert.strictEqual(g.win.eval('F[player].heroes[1]'), null);

    // Llenar los 3 slots con héroes no míticos.
    assert.strictEqual(g.win.eval('setHeroSlot(player,0,"leonidas")'), true);
    assert.strictEqual(g.win.eval('setHeroSlot(player,1,"suntzu")'), true);
    assert.strictEqual(g.win.eval('setHeroSlot(player,2,"boudica")'), true);
    assert.strictEqual(g.win.eval('heroEquippedIds(F[player]).length'), 3);

    // Solo existen 3 casillas: no hay forma de equipar una 4ta.
    assert.strictEqual(g.win.eval('setHeroSlot(player,3,"ollantay")'), false);
    assert.strictEqual(g.win.eval('heroEquippedIds(F[player]).length'), 3);
  } finally { closeGame(g); }
});

/* 12 (Fase 2A). Sun Tzu: -10% costo de unidades solo mientras está vivo en campo. */
test("Sun Tzu: la reducción de costo solo aplica con él vivo en campo", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // abre batalla, B.S["1"] = AG
    g.win.eval('setHeroSlot(player,0,"suntzu")');

    const costBefore = g.win.eval('unitStats("melee",F[player].era,F[player].upArm).cost');
    const gold1 = g.win.eval('B.S["1"].gold');
    g.win.eval('spawnUnit("1","melee")'); // Sun Tzu aún no está desplegado: sin descuento
    assert.strictEqual(gold1 - g.win.eval('B.S["1"].gold'), costBefore);

    g.win.eval('spawnChamp("1")');
    assert.strictEqual(g.win.eval('B.S["1"].champAlive'), true);
    g.win.eval('B.S["1"].cool.melee=0;');
    const gold2 = g.win.eval('B.S["1"].gold');
    g.win.eval('spawnUnit("1","melee")'); // ahora sí, con Sun Tzu vivo en campo
    assert.strictEqual(gold2 - g.win.eval('B.S["1"].gold'), Math.round(costBefore * 0.9));
  } finally { closeGame(g); }
});

/* 13 (Fase 2A). Amaru se desbloquea en el legado tras Fe≥120 y victoria. */
test("Amaru se desbloquea en el legado tras Fe≥120 y victoria", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    assert.ok(!g.win.eval('LEGACY.heroes.amaru'));
    g.win.eval('F[player].faith=125;');
    g.win.eval('endGame("¡Victoria!","fin de prueba",true,player)');
    assert.strictEqual(g.win.eval('LEGACY.heroes.amaru'), true);
    assert.strictEqual(g.win.eval('isHeroUnlocked("amaru")'), true);
  } finally { closeGame(g); }
});

/* 14 (Fase 2B). Duelo de Campeones: un solo duelo por batalla, <10s,
   perdedor >=1 PV (nunca muere), recompensa aplicada. Math.random se
   fija a 0.1 dentro de la página para que la resolución sea determinista:
   con ambos héroes "comunes" y arma nv1, el término aleatorio es idéntico
   para los dos bandos -> empate exacto -> gana el bando "1" (Leónidas). */
test("Duelo de Campeones: máx. 1 por batalla, perdedor no muere, recompensa aplicada", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // abre batalla vs CO
    g.win.eval('setHeroSlot(player,0,"leonidas")');
    g.win.eval('F[B.eFacId].heroes[0]="boudica"');
    g.win.eval('B.S["-1"].cool.champ=0;'); // sin retraso de IA para esta prueba
    g.win.eval('spawnChamp("1")');
    g.win.eval('spawnChamp("-1")');
    assert.strictEqual(g.win.eval('B.S["1"].champAlive'), true);
    assert.strictEqual(g.win.eval('B.S["-1"].champAlive'), true);

    g.win.eval(`(function(){
      const h1=B.units.find(u=>u.kind==="champ"&&u.side===1);
      const h2=B.units.find(u=>u.kind==="champ"&&u.side===-1);
      h1.x=W/2-20; h2.x=W/2+20;
      Math.random=()=>0.1;
    })()`);
    g.win.eval('bloop(performance.now())'); // un frame: la cercanía debe disparar el duelo
    assert.strictEqual(g.win.eval('!!B.duel'), true);
    assert.ok(g.win.eval('B.duel.duration') < 10, "el duelo debe durar menos de 10s");

    const pHPBefore = g.win.eval('B.pHP'), eHPBefore = g.win.eval('B.eHP');
    g.win.eval('B.duel.t = B.duel.duration + 1;'); // forzar que este frame ya lo resuelva
    g.win.eval('bloop(performance.now())');

    assert.strictEqual(g.win.eval('B.duelDone'), true);
    assert.strictEqual(g.win.eval('B.duel'), null);
    assert.strictEqual(g.win.eval('B.pHP'), pHPBefore, "el duelo no debe tocar las bases");
    assert.strictEqual(g.win.eval('B.eHP'), eHPBefore, "el duelo no debe tocar las bases");

    const h2Frac = g.win.eval(`(function(){
      const h2=B.units.find(u=>u.kind==="champ"&&u.side===-1);
      return h2.hp/h2.max;
    })()`);
    assert.ok(h2Frac > 0, "el perdedor no debe morir en el duelo");
    assert.ok(Math.abs(h2Frac - 0.3) < 0.01, "el perdedor (Boudica) debe quedar al 30% de su PV");
    assert.ok(g.win.eval('B.S["1"].dmgBuffAllT') > 0, "recompensa del ganador aplicada (+15% daño aliado)");

    g.win.eval('bloop(performance.now())'); // aunque sigan cerca, no debe haber un 2º duelo
    assert.strictEqual(g.win.eval('!!B.duel'), false);
  } finally { closeGame(g); }
});

/* 15 (Fase 2B, regresión). El duelo debe dispararse en PvP dejando que el
   motor mueva a los dos héroes por su cuenta (sin teletransportarlos a
   mano como en la prueba 14) — así se detecta si "champ" se traba en
   combate normal a su rango (140px) antes de llegar a los 60px del duelo. */
test("Duelo de Campeones: se dispara en PvP con movimiento normal (sin héroes teletransportados)", async () => {
  const g = makeGame();
  try {
    g.win.eval('LEGACY.heroes.amaru=true;'); // desbloqueo de prueba para equiparlo en ambos bandos
    g.win.eval('setPickMode(2)');
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // jugador 1 = AG
    g.win.eval('clickTerr("EUN")'); // jugador 2 = CO
    g.win.eval('setHeroSlot("AG",0,"amaru")');
    g.win.eval('setHeroSlot("CO",0,"amaru")');
    g.win.eval('endHumanTurn()'); // pasa el turno a CO
    assert.strictEqual(g.win.eval('player'), 'CO');
    g.win.eval('clickTerr("EUO")'); // territorio propio de CO
    g.win.eval('clickTerr("USA")'); // vecino humano (AG) -> abre batalla pvp
    assert.strictEqual(g.win.eval('B.pvp'), true);
    g.win.eval('spawnChamp("1")');
    g.win.eval('spawnChamp("-1")');
    assert.strictEqual(g.win.eval('B.S["1"].champAlive'), true);
    assert.strictEqual(g.win.eval('B.S["-1"].champAlive'), true);

    let triggered = false;
    for (let i = 0; i < 400 && !triggered; i++) {
      g.win.eval('B.last = performance.now() - 50;'); // fuerza dt≈0.05s por paso, sin depender del reloj real
      g.win.eval('bloop(performance.now())');
      triggered = g.win.eval('!!B.duel || B.duelDone');
    }
    assert.ok(triggered, "el duelo debe dispararse cuando los dos héroes se acercan con movimiento normal");
  } finally { closeGame(g); }
});

/* 16 (Fase 2C). Unidades aéreas: matriz ampliada, inmunidad melee, límite
   de 2 por bando, y resolución forzada a 210s. (El plan la llama "Prueba
   15" de 2C, pero ya usé el 15 para la regresión de duelo en PvP que pidió
   Gabriel tras la verificación manual — sigo la numeración secuencial real
   de la suite en vez de reescribir los comentarios de pruebas anteriores.) */
test("Unidades aéreas: matriz, inmunidad melee, límite de 2, resolución forzada", async () => {
  const g = makeGame();
  try {
    assert.strictEqual(g.win.eval('counterMult({kind:"ranged"},{kind:"air"})'), 1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"air"},{kind:"heavy"})'), 1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"melee"},{kind:"air"})'), 1, "sin matchup definido: multiplicador normal");

    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('F.AG.era=2;F.CO.era=2;'); // Época Industrial: ya hay unidades aéreas
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // abre batalla vs CO (B.S["-1"]=CO)
    g.win.eval('B.S["-1"].gold=500;'); // oro de sobra para no confundir el límite con falta de oro

    // Melee no golpea aéreo: un melee propio pegado a un aéreo enemigo no
    // debe poder dañarlo aunque corran varios frames de combate normal.
    g.win.eval('spawnUnit("1","melee")');
    g.win.eval('spawnUnit("-1","air")');
    g.win.eval(`(function(){
      const m=B.units.find(u=>u.kind==="melee"&&u.side===1);
      const a=B.units.find(u=>u.kind==="air"&&u.side===-1);
      m.x=W/2-5; a.x=W/2+5;
    })()`);
    for (let i = 0; i < 20; i++) {
      g.win.eval('B.last=performance.now()-50;');
      g.win.eval('bloop(performance.now())');
    }
    const airHpFrac = g.win.eval(`(function(){const a=B.units.find(u=>u.kind==="air"&&u.side===-1);return a?a.hp/a.max:null;})()`);
    assert.strictEqual(airHpFrac, 1, "el melee no debe poder dañar a un aéreo");

    // Límite de 2 aéreos por bando: ya hay 1 (arriba); el 2º debe entrar,
    // el 3er intento debe rechazarse.
    g.win.eval('B.S["-1"].cool.air=0;');
    g.win.eval('spawnUnit("-1","air")'); // 2º
    g.win.eval('B.S["-1"].cool.air=0;');
    g.win.eval('spawnUnit("-1","air")'); // intento de 3º
    const airCount = g.win.eval('B.units.filter(u=>u.side===-1&&u.kind==="air").length');
    assert.strictEqual(airCount, 2, "no debe haber más de 2 aéreos por bando en campo");

    // Resolución forzada a 210s.
    assert.strictEqual(g.win.eval('B.over'), false);
    g.win.eval('B.time=210;');
    g.win.eval('bloop(performance.now())');
    assert.strictEqual(g.win.eval('B.pacing.resuelto'), true);
    assert.strictEqual(g.win.eval('B.over'), true);
  } finally { closeGame(g); }
});

/* 17 (ajuste de legibilidad, pilar 6). Los banners narrativos de batalla
   (desgaste, duelo, habilidades de héroe...) deben durar como mínimo 3-4s
   y encolarse en vez de superponerse si coinciden. */
test("Banners narrativos: duración mínima 3-4s y se encolan sin superponerse", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // abre batalla (necesita B para pushBanner)

    g.win.eval('pushBanner("prueba uno")');
    assert.ok(g.win.eval('B.banner.duration') >= 3, "el banner debe durar al menos 3s");
    assert.strictEqual(g.win.eval('B.banner.txt'), 'prueba uno');

    // Un segundo banner mientras el primero sigue activo debe encolarse,
    // no reemplazarlo ni mostrarse encima.
    g.win.eval('pushBanner("prueba dos")');
    assert.strictEqual(g.win.eval('B.banner.txt'), 'prueba uno');
    assert.strictEqual(g.win.eval('B.bannerQueue.length'), 1);

    // Al vencer el primero, el segundo debe tomar su lugar automáticamente.
    g.win.eval('B.banner.elapsed = B.banner.duration + 0.1;');
    g.win.eval('advanceBanner(0.016)');
    assert.strictEqual(g.win.eval('B.banner.txt'), 'prueba dos');
    assert.strictEqual(g.win.eval('B.bannerQueue.length'), 0);
  } finally { closeGame(g); }
});

/* 18 (corrección post-verificación de 2C, generalizada tras 2ª verificación).
   El anti-atoro es universal: CUALQUIER unidad que lleve ~1.2s sin atacar y
   sin avanzar de forma apreciable se repone (empuje adelante + nuevo carril
   lateral al azar) — cubre tanto un ranged bloqueado por melee como dos
   melee apilados exactamente en el mismo punto y carril. */
test("Anti-atoro universal: ranged y melee amontonados se reposicionan", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // abre batalla vs CO
    g.win.eval('B.S["-1"].gold=0;'); // que la IA no compre nada y complique la prueba con enemigos
    g.win.eval('B.S["1"].gold=500;'); // suficiente para varias unidades sin que el costo estorbe

    // Caso 1: ranged bloqueado por un melee que no se mueve, mismo carril.
    g.win.eval('spawnUnit("1","melee")');
    g.win.eval('spawnUnit("1","ranged")');
    g.win.eval(`(function(){
      const m=B.units.find(u=>u.kind==="melee"&&u.side===1);
      const r=B.units.find(u=>u.kind==="ranged"&&u.side===1);
      m.spd=0; m.x=90; m.laneY=0;
      r.x=80; r.laneY=0; // mismo carril: bloqueado a propósito
    })()`);
    g.win.eval('B.last=performance.now()-50;');
    g.win.eval('bloop(performance.now())');
    assert.strictEqual(g.win.eval(`B.units.find(u=>u.kind==="ranged"&&u.side===1).x`), 80,
      "recién bloqueado, el ranged no debe avanzar de inmediato");

    // Se fuerza el reloj interno (idleCheckT) por encima del umbral en vez de
    // simular ~24 frames reales: prueba directamente la condición del anti-atoro.
    g.win.eval(`(function(){
      const r=B.units.find(u=>u.kind==="ranged"&&u.side===1);
      r.idleCheckT=1.21; r.lastCheckX=80; r.attackedInWindow=false;
    })()`);
    g.win.eval('B.last=performance.now()-50;');
    g.win.eval('bloop(performance.now())');
    const rTras=g.win.eval(`(function(){const r=B.units.find(u=>u.kind==="ranged"&&u.side===1);return r?r.x:null;})()`);
    assert.ok(rTras!==null,"el ranged no debería morir en esta prueba");
    assert.ok(rTras>80,"tras ~1.2s sin avanzar, el ranged debe empujarse hacia adelante aunque el aliado lo siga bloqueando");

    // Caso 2: dos melee del mismo bando apilados en el mismo punto y carril
    // (la separación debe desapilarlos, no solo congelarlos).
    g.win.eval('B.S["1"].cool.melee=0;'); // el primer spawn dejó el cooldown activo
    g.win.eval('spawnUnit("1","melee")');
    g.win.eval(`(function(){
      const melees=B.units.filter(u=>u.kind==="melee"&&u.side===1);
      melees[0].spd=0; melees[0].x=200; melees[0].laneY=0;
      melees[1].x=200; melees[1].laneY=0; // exactamente apilado, mismo carril
      melees[1].idleCheckT=1.21; melees[1].lastCheckX=200; melees[1].attackedInWindow=false;
    })()`);
    g.win.eval('B.last=performance.now()-50;');
    g.win.eval('bloop(performance.now())');
    const m2x=g.win.eval(`(function(){
      const melees=B.units.filter(u=>u.kind==="melee"&&u.side===1);
      return melees[1]?melees[1].x:null;
    })()`);
    assert.ok(m2x!==null,"el segundo melee no debería morir en esta prueba");
    assert.ok(m2x>200,"el melee apilado debe desapilarse (avanzar), no solo quedar congelado");
  } finally { closeGame(g); }
});

/* 19 (adelanto de Fase 2E, pilar 6/7). Resumen del turno: panel compacto
   con máx. 6 líneas causales, no aparece si no hay eventos, y se reinicia
   al empezar una ronda nueva. */
test("Resumen del turno: se genera con máx. 6 líneas causales", async () => {
  const g = makeGame();
  try {
    g.win.eval('Math.random=()=>0.99;'); // evita que una plaga al azar en incomePhase() contamine el conteo
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG

    // Simula 8 eventos causales en la misma ronda (más del límite de 6).
    g.win.eval('for(let i=0;i<8;i++) logCausal("evento de prueba "+i);');
    assert.strictEqual(g.win.eval('turnSummaryLines.length'), 8, "logCausal debe seguir registrando todos, el recorte es solo al mostrar");

    g.win.eval('showTurnSummary()');
    assert.strictEqual(g.doc.getElementById("resumenModal").style.display, "flex");
    const lineas=g.win.eval('document.querySelectorAll("#resumenBody .resumenLinea").length');
    assert.strictEqual(lineas, 6, "el panel no debe mostrar más de 6 líneas");

    // Sin eventos causales no debe aparecer ningún panel (evita ruido cada ronda).
    g.win.eval('closeTurnSummary(); turnSummaryLines=[];');
    g.win.eval('showTurnSummary()');
    assert.strictEqual(g.doc.getElementById("resumenModal").style.display, "none");

    // Se reinicia al empezar una ronda nueva.
    g.win.eval('Math.random=()=>0.99;'); // evita que una plaga al azar contamine el conteo
    g.win.eval('turnSummaryLines=["algo"]; startRound();');
    assert.strictEqual(g.win.eval('turnSummaryLines.length'), 0);
  } finally { closeGame(g); }
});

/* 20 (Fase 2D). Veteranía por regimiento: la XP sube tras la batalla,
   Nv2 aplica +8% de daño, y una derrota con muchas bajas de ese tipo
   descuenta 20% de la barra acumulada. */
test("Veteranía por regimiento: XP sube, Nv2 aplica +8%, derrota fuerte descuenta 20%", async () => {
  const g = makeGame();
  try {
    g.win.eval('startGame(1.0)');
    g.win.eval('clickTerr("CAN")'); // player = AG
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("EUN")'); // abre batalla vs CO (CAN ataca)
    assert.strictEqual(g.win.eval('F.AG.veterancy.melee.xp'), 0);

    g.win.eval('spawnUnit("1","melee"); B.S["1"].cool.melee=0; spawnUnit("1","melee")');
    g.win.eval('B.S["1"].killsByType.melee=1'); // una baja lograda por ese regimiento
    g.win.eval('finishBattle(true)'); // side "1" (AG) gana
    await sleep(1700); // finishBattle resuelve tras 1500ms
    assert.strictEqual(g.win.eval('F.AG.veterancy.melee.xp'), 7,
      "participar suma +2 una sola vez, victoria +4 y cada baja del regimiento +1");

    // Nv2 (30 XP): +8% de daño sobre una unidad recién creada.
    g.win.eval('F.AG.veterancy.melee.xp=30;');
    const dmgBase=g.win.eval('unitStats("melee",F.AG.era,F.AG.upArm).dmg');
    g.win.eval('T.CAN.troops=8;'); // el ataque anterior dejó pocas tropas para atacar de nuevo
    g.win.eval('clickTerr("CAN")');
    g.win.eval('clickTerr("RUS")'); // otro vecino de CAN (DR), EUN ya es de AG tras la conquista
    g.win.eval('spawnUnit("1","melee")');
    const dmgNv2=g.win.eval('B.units.find(u=>u.kind==="melee"&&u.side===1).dmg');
    assert.ok(Math.abs(dmgNv2-dmgBase*1.08)<0.01, "Nv2 debe multiplicar el daño base por 1.08");

    // Nv3: +15% daño y el rasgo menor exacto de cada tipo.
    const nv3=g.win.eval(`(()=>{
      const r={};
      for(const k of ["melee","ranged","heavy","air"]){
        const u=mkUnit(1,k,3,0),base={dmg:u.dmg,rng:u.rng,atk:u.atk,spd:u.spd};
        applyVeterancy(u,k,3);r[k]={base,u};
      }
      return r;
    })()`);
    for(const k of ["melee","ranged","heavy","air"])
      assert.ok(Math.abs(nv3[k].u.dmg/nv3[k].base.dmg-1.15)<1e-9, `Nv3 ${k} debe aplicar +15% daño`);
    assert.strictEqual(nv3.melee.u.vetDefMult,0.95,"Nv3 melee debe recibir 5% menos daño");
    assert.ok(Math.abs(nv3.ranged.u.rng/nv3.ranged.base.rng-1.1)<1e-9,"Nv3 ranged debe tener +10% alcance");
    assert.ok(Math.abs(nv3.heavy.u.atk/nv3.heavy.base.atk-0.9)<1e-9,"Nv3 heavy debe tener -10% cd de ataque");
    assert.ok(Math.abs(nv3.air.u.spd/nv3.air.base.spd-1.1)<1e-9,"Nv3 aéreo debe tener +10% velocidad");

    // Derrota con más de la mitad de bajas de ese tipo: -20% de la barra.
    g.win.eval('F.AG.veterancy.melee.xp=50;');
    g.win.eval('F.AG.veterancy.ranged.xp=28; B.S["1"].gold=999; spawnUnit("1","ranged")');
    g.win.eval('F.AG.veterancy.heavy.xp=30; B.S["1"].cool.heavy=0; spawnUnit("1","heavy"); B.units.find(u=>u.kind==="heavy"&&u.side===1).hp=0;');
    g.win.eval('B.units.find(u=>u.kind==="melee"&&u.side===1).hp=0;'); // simula la baja
    g.win.eval('finishBattle(false)'); // side "1" (AG) pierde
    await sleep(1700);
    // La ganancia por participar (+2, sin victoria ni bajas enemigas) se
    // suma primero (50->52) y luego la derrota con >50% de bajas de ese
    // tipo descuenta 20% de esa barra (52-10=42).
    assert.strictEqual(g.win.eval('F.AG.veterancy.melee.xp'), 42,
      "derrota con >50% de bajas de ese tipo debe descontar 20% tras sumar la participación");
    assert.strictEqual(g.win.eval('F.AG.veterancy.ranged.xp'),30,
      "un regimiento que participa y sobrevive a la derrota conserva el +2 de participación");
    assert.strictEqual(g.win.eval('F.AG.veterancy.heavy.xp'),26,
      "la penalización debe poder cruzar el umbral y bajar el regimiento de Nv2 a Nv1");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Veteranía Nv2"))'),
      "un cambio de nivel de veteranía debe generar una línea causal en el Resumen");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("descendió a Veteranía Nv1"))'),
      "un descenso de nivel también debe explicar su causa en el Resumen");

    // La veteranía viaja en save v4 y un save anterior sin ella migra a cero.
    const guardado=g.win.eval('saveGame()');
    g.win.eval('F.AG.veterancy.melee.xp=0');
    assert.strictEqual(g.win.eval(`loadGame(${JSON.stringify(guardado)})`),true);
    assert.strictEqual(g.win.eval('F.AG.veterancy.melee.xp'),42,"save v4 debe restaurar la XP de veteranía");
    const antiguo=g.win.eval(`(()=>{
      const d=JSON.parse(decodeURIComponent(escape(atob(saveGame()))));
      d.v=3;for(const f of Object.values(d.Fx))delete f.veterancy;
      return btoa(unescape(encodeURIComponent(JSON.stringify(d))));
    })()`);
    assert.strictEqual(g.win.eval(`loadGame(${JSON.stringify(antiguo)})`),true);
    assert.strictEqual(g.win.eval('F.AG.veterancy.melee.xp'),0,"un save anterior debe migrar veteranía a cero");
  } finally { closeGame(g); }
});

/* 21 (Fase 2E). La coalición usa la fórmula de amenaza, crea alianzas
   visibles entre miembros, expira y respeta cooldown y reformación. */
test("Coalición anti-líder: duración, cooldown y reformación según amenaza", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1.3); clickTerr("CAN"); round=8; Math.random=()=>0;');
    g.win.eval('F.AG.gold=10000; F.AG.science=1000; ownedBy("AG").forEach(id=>{T[id].troops=99;T[id].base=3;});');
    assert.strictEqual(g.win.eval('coalitionChance(0.25)'),0);
    assert.strictEqual(g.win.eval('coalitionChance(2)'),0.75,"la probabilidad debe respetar el techo de 75%");
    g.win.eval('for(const f of alive())if(f!=="AG")relAdd(f,"AG",-100);');
    const estadoAntes=g.win.eval(`JSON.stringify({
      fac:Object.fromEntries(Object.entries(F).map(([id,f])=>[id,{gold:f.gold,food:f.food,science:f.science,faith:f.faith,culture:f.culture,upArm:f.upArm,upEco:f.upEco,upMed:f.upMed}])),
      terr:Object.fromEntries(Object.entries(T).map(([id,t])=>[id,{troops:t.troops,base:t.base}]))})`);
    g.win.eval('updateCoalition(); render();');
    assert.ok(g.win.eval('coalition!==null'),"una amenaza extrema debe poder activar la coalición");
    assert.strictEqual(g.win.eval('coalition.leader'),"AG");
    assert.ok(g.win.eval('coalition.members.length>=2'));
    assert.strictEqual(g.doc.getElementById("worldBanner").style.display,"flex","la activación debe mostrar banner narrativo");
    assert.ok(g.win.eval('pacts.some(p=>p.coalition)'),"los miembros deben pactar automáticamente entre sí");
    assert.strictEqual(g.win.eval(`JSON.stringify({
      fac:Object.fromEntries(Object.entries(F).map(([id,f])=>[id,{gold:f.gold,food:f.food,science:f.science,faith:f.faith,culture:f.culture,upArm:f.upArm,upEco:f.upEco,upMed:f.upMed}])),
      terr:Object.fromEntries(Object.entries(T).map(([id,t])=>[id,{troops:t.troops,base:t.base}]))})`),estadoAntes,
      "la coalición no debe inflar recursos, tropas, bases ni mejoras de sus miembros");
    assert.ok(g.win.eval('coalition.members.every(f=>coalitionDesire(f,coalition.leader,leaderThreat().threat)>0.45)'),
      "cada miembro debe superar estrictamente DeseoUnirse > 0.45");
    assert.strictEqual(g.win.eval('coalition.rounds'),3,"Difícil debe crear coaliciones de tres rondas");
    assert.ok(g.win.eval('pacts.filter(p=>p.coalition).every(p=>p.rounds===3)'),"los pactos deben durar lo mismo");
    assert.ok(g.doc.getElementById("empInfo").textContent.includes("Coalición en tu contra: 3 rondas"),
      "el estado de coalición debe permanecer visible en el panel Imperio");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("COALICIÓN"))'),"la coalición debe sumarse al Resumen");
    g.win.eval('coalition.rounds=1; updateCoalition();');
    assert.strictEqual(g.win.eval('coalition'),null,"la coalición debe expirar al completar su duración");
    assert.strictEqual(g.win.eval('coalitionCooldownUntil'),11,"debe bloquear las dos rondas posteriores");
    assert.ok(!g.win.eval('pacts.some(p=>p.coalition)'),"los pactos automáticos deben terminar con la coalición");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Cooldown: 2 rondas"))'),"el Resumen explica expiración y cooldown");
    g.win.eval('round=9;updateCoalition();');
    assert.strictEqual(g.win.eval('coalition'),null,"no puede reformarse durante cooldown");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("2 rondas restantes"))'),"el Resumen muestra cooldown restante");
    g.win.eval('round=11;F.AG.gold=0;F.AG.science=0;ownedBy("AG").forEach(id=>{T[id].troops=6;T[id].base=0;});updateCoalition();');
    assert.strictEqual(g.win.eval('coalition'),null,"tras cooldown no se reforma con amenaza <=35%");
    g.win.eval('F.AG.gold=10000;F.AG.science=1000;ownedBy("AG").forEach(id=>{T[id].troops=99;T[id].base=3;});updateCoalition();');
    assert.ok(g.win.eval('coalition!==null'),"tras cooldown puede reformarse con amenaza >35%");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("reforman"))'),"el Resumen explica la reformación");

    g.win.eval('coalition=null;pacts=pacts.filter(p=>!p.coalition);coalitionCooldownUntil=null;diffMult=1.5;round=8;updateCoalition();');
    assert.strictEqual(g.win.eval('coalition.rounds'),4,"Pesadilla debe crear coaliciones de cuatro rondas");
    assert.ok(g.win.eval('pacts.filter(p=>p.coalition).every(p=>p.rounds===4)'),"los pactos de Pesadilla duran cuatro rondas");

    g.win.eval('coalition=null;coalitionCooldownUntil=14;round=12;');
    const guardado=g.win.eval('saveGame()');
    g.win.eval('coalitionCooldownUntil=null;loadGame('+JSON.stringify(guardado)+')');
    assert.strictEqual(g.win.eval('coalitionCooldownUntil'),14,"el save debe persistir el cooldown");
    const antiguo=g.win.eval(`(()=>{const d=JSON.parse(decodeURIComponent(escape(atob(saveGame()))));delete d.coalitionCooldownUntil;
      return btoa(unescape(encodeURIComponent(JSON.stringify(d))));})()`);
    assert.strictEqual(g.win.eval(`loadGame(${JSON.stringify(antiguo)})`),true);
    assert.strictEqual(g.win.eval('coalitionCooldownUntil'),null,"un save anterior migra sin cooldown activo");
  }finally{closeGame(g);}
});

/* 22 (Fase 2E). Pesadilla requiere una victoria en Difícil, da ingreso
   x1.5 a la IA, permite dos ataques y ProbEvento aplica clamp/antirachas. */
test("Pesadilla y aleatoriedad viva: desbloqueo, doble ataque, clamp y anti-repetición", async () => {
  const g=makeGame();
  try{
    g.win.eval('alert=()=>{}');
    assert.strictEqual(g.win.eval('startGame(1.5)'),false,"Pesadilla debe empezar bloqueada");
    g.win.eval('LEGACY.hardWins=1; startGame(1.5); clickTerr("USA"); Math.random=()=>0;');
    assert.strictEqual(g.win.eval('diffMult'),1.5);

    // Mapa controlado: CO dispone de dos objetivos IA débiles y conserva
    // al humano AG vivo, evitando batallas de defensa durante esta prueba.
    g.win.eval(`for(const id in T){T[id].owner="CO";T[id].troops=20;T[id].base=0;}
      T.USA.owner="AG";T.USA.troops=99;
      T.EUN.owner="SB";T.EUN.troops=1;T.RUS.owner="SB";T.RUS.troops=1;
      T.CAN.owner="CO";T.CAN.troops=99;
      for(const f in F){F[f].gold=0;F[f].science=0;F[f].food=20;}
      phase="play";`);
    const ingresoBase=g.win.eval(`(()=>{let g=0;for(const id of ownedBy("CO")){
      const t=T[id],d=TERR[id];g+=4+Math.floor(t.pop*0.3)+t.base*2;
      if(d.res==="oro")g+=3;}for(const cn in CONTINENTS){const c=CONTINENTS[cn];
      if(c.ids.every(id=>T[id].owner==="CO"))g+=c.bonus;}return g;})()`);
    g.win.eval('incomePhase()');
    assert.strictEqual(g.win.eval('F.CO.gold'),Math.floor(ingresoBase*1.5),
      "la IA de Pesadilla debe recibir exactamente x1.5 de ingreso de oro");
    g.win.eval('aiTurns(true)');
    const doble=await waitUntil(g.win,'F.CO.attacksThisRound===2',{timeout:8000});
    assert.ok(doble,"una IA en Pesadilla debe poder ejecutar dos ataques en la ronda");

    g.win.eval('round=12; eventHistory=[]; warHistory=[];');
    const fresh=g.win.eval('liveEventProbability(0.12,"prueba","SB")');
    assert.ok(fresh>=0.05&&fresh<=0.35,"ProbEvento debe respetar clamp 5%-35%");
    g.win.eval('recordLiveEvent("prueba","CO",false)');
    const repeated=g.win.eval('liveEventProbability(0.12,"prueba","SB")');
    assert.ok(repeated<=fresh,"repetir el mismo evento en <=2 rondas debe reducir su probabilidad");
    g.win.eval('eventHistory=[]; recordLiveEvent("malo1","SB",true); recordLiveEvent("malo2","SB",true);');
    const punished=g.win.eval('liveEventProbability(0.30,"nuevo","SB")');
    g.win.eval('eventHistory=[];');
    const unpunished=g.win.eval('liveEventProbability(0.30,"nuevo","SB")');
    assert.ok(punished<unpunished,"dos eventos negativos recientes deben activar AntiCastigo x0.5");

    // Simetría: AG es ahora el líder. El mismo cálculo debe aplicar ×1.2
    // cuando el objetivo es el jugador, y AntiCastigo tanto a AG como a CO.
    g.win.eval('F.AG.gold=20000; for(const f of alive())if(f!=="AG")F[f].gold=0; eventHistory=[]; warHistory=[];');
    assert.strictEqual(g.win.eval('leaderThreat().leader'),"AG");
    const pLider=g.win.eval('liveEventProbability(0.12,"simetria","AG")');
    const pNoLider=g.win.eval('liveEventProbability(0.12,"simetria","CO")');
    assert.ok(pLider>pNoLider,"el ×1.2 debe golpear al jugador cuando el jugador es líder");
    for(const objetivo of ["AG","CO"]){
      g.win.eval('eventHistory=[]');
      const limpio=g.win.eval(`liveEventProbability(0.30,"sim-${objetivo}","${objetivo}")`);
      g.win.eval(`recordLiveEvent("neg1","${objetivo}",true);recordLiveEvent("neg2","${objetivo}",true);`);
      const protegido=g.win.eval(`liveEventProbability(0.30,"sim-${objetivo}","${objetivo}")`);
      assert.ok(protegido<limpio,`AntiCastigo debe proteger por igual al objetivo ${objetivo}`);
    }
  }finally{closeGame(g);}
});

/* 23 (Fase 3A). El sanador cura, no ataca, no apila curación, limita dos
   unidades y reduce la cura de héroes durante Desgaste. */
test("Sanador: cura visible sin atacar, no apila y respeta límite y penalizaciones", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");clickTerr("CAN");clickTerr("EUN");B.pvp=true;B.S["1"].gold=999;');
    g.win.eval('spawnUnit("1","healer");B.S["1"].cool.healer=0;spawnUnit("1","healer");B.S["1"].cool.healer=0;spawnUnit("1","healer");');
    assert.strictEqual(g.win.eval('B.units.filter(u=>u.side===1&&u.kind==="healer").length'),2,"máximo dos sanadores por bando");
    g.win.eval(`(()=>{const a=mkUnit(1,"melee",0,0);a.x=90;a.hp=a.max*0.5;B.units.push(a);
      const e=mkUnit(-1,"melee",0,0);e.x=40;e.hp=e.max;B.units.push(e);
      B.units.filter(u=>u.kind==="healer").forEach(h=>{h.x=70;h.t=0;});B.testAlly=a;B.testEnemy=e;})()`);
    const hpAntes=g.win.eval('B.testAlly.hp'),enemigoAntes=g.win.eval('B.testEnemy.hp');
    g.win.eval('bloop(B.last+50)');
    const cura=g.win.eval('B.testAlly.hp')-hpAntes;
    assert.ok(Math.abs(cura-g.win.eval('B.testAlly.max*0.04*0.5'))<0.01,"dos sanadores no deben apilar: solo un pulso de 4%/s");
    assert.strictEqual(g.win.eval('B.testEnemy.hp'),enemigoAntes,"el sanador nunca debe atacar");
    assert.ok(g.win.eval('B.dmgs.some(d=>String(d.txt).startsWith("+")&&d.c==="#7ED66E")'),"la cura debe mostrar número verde");
    assert.ok(g.win.eval('B.projs.some(p=>p.c==="#7ED66E")'),"la cura debe mostrar línea/destello verde");

    g.win.eval(`(()=>{const c=mkUnit(1,"champ",0,0,1);c.x=75;c.hp=c.max*0.5;B.units.push(c);B.testChamp=c;
      B.pacing.desgaste=true;B.units.filter(u=>u.kind==="healer").forEach(h=>h.t=0);})()`);
    const champAntes=g.win.eval('B.testChamp.hp');
    g.win.eval('bloop(B.last+50)');
    const curaChamp=g.win.eval('B.testChamp.hp')-champAntes;
    assert.ok(Math.abs(curaChamp-g.win.eval('B.testChamp.max*0.04*0.5*0.5*0.5'))<0.01,
      "héroe recibe 50% y Desgaste reduce otra mitad");
    assert.ok(g.win.eval('B.units.filter(u=>u.kind==="healer").every(h=>h.hp===h.max)'),"los sanadores no se curan entre ellos");

    g.win.eval(`(()=>{const h=B.units.find(u=>u.kind==="healer");h.x=100;h.hp=h.max;
      const m=mkUnit(1,"melee",0,0);m.x=170;const r=mkUnit(-1,"ranged",0,0);r.x=248;r.t=0;
      B.units=[h,m,r];B.priorityHealer=h;B.priorityMelee=m;})()`);
    const healerAntes=g.win.eval('B.priorityHealer.hp'),meleeAntes=g.win.eval('B.priorityMelee.hp');
    g.win.eval('bloop(B.last+50)');
    assert.ok(g.win.eval('B.priorityHealer.hp')<healerAntes,"la IA enemiga debe priorizar al sanador detectado");
    assert.strictEqual(g.win.eval('B.priorityMelee.hp'),meleeAntes,"prioriza sanador aunque haya melee más cercano");
  }finally{closeGame(g);}
});

/* 24 (Fase 3A). Asedio: arco por encima de aliados, mínimo 80px,
   salpicadura terrestre, prioridad de base e inmunidad de objetivos aéreos. */
test("Asedio: arco, rango mínimo, prioridad de base y vulnerabilidad coherente", async () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");clickTerr("CAN");clickTerr("EUN");B.pvp=true;B.S["1"].gold=999;
      spawnUnit("1","siege");B.S["1"].cool.siege=0;spawnUnit("1","siege");B.S["1"].cool.siege=0;spawnUnit("1","siege");`);
    assert.strictEqual(g.win.eval('B.units.filter(u=>u.side===1&&u.kind==="siege").length'),2,"máximo dos asedios por bando");
    g.win.eval('B.units=B.units.filter((u,i)=>u.kind!=="siege"||i===B.units.findIndex(v=>v.kind==="siege"));');
    g.win.eval(`(()=>{const s=B.units.find(u=>u.kind==="siege");s.x=70;s.t=0;
      const aliado=mkUnit(1,"melee",0,0);aliado.x=105;aliado.laneY=s.laneY;B.units.push(aliado);
      const e1=mkUnit(-1,"melee",0,0);e1.x=220;const e2=mkUnit(-1,"ranged",0,0);e2.x=240;
      const air=mkUnit(-1,"air",2,0);air.x=200;B.units.push(e1,e2,air);B.siege=s;B.e1=e1;B.e2=e2;B.air3a=air;})()`);
    const e1Antes=g.win.eval('B.e1.hp'),e2Antes=g.win.eval('B.e2.hp'),airAntes=g.win.eval('B.air3a.hp');
    g.win.eval('bloop(B.last+50)');
    assert.ok(g.win.eval('B.e1.hp')<e1Antes,"asedio debe golpear al objetivo terrestre");
    assert.ok(g.win.eval('B.e2.hp')<e2Antes,"asedio debe aplicar salpicadura pequeña");
    assert.strictEqual(g.win.eval('B.air3a.hp'),airAntes,"asedio no alcanza aéreos");
    assert.ok(g.win.eval('B.projs.some(p=>p.arc)'),"el proyectil debe marcarse y dibujarse en arco");
    assert.ok(g.win.eval('B.siege.attackedInWindow'),"dispara por encima del aliado sin quedar atorado por la formación");
    assert.strictEqual(g.win.eval('counterMult({kind:"melee"},{kind:"siege"})'),1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"air"},{kind:"siege"})'),1.5);

    g.win.eval(`B.units=[B.siege];B.siege.x=200;B.siege.t=0;
      B.closeMelee=mkUnit(-1,"melee",0,0);B.closeMelee.x=250;B.units.push(B.closeMelee);`);
    const cercaAntes=g.win.eval('B.closeMelee.hp');
    g.win.eval('bloop(B.last+50)');
    assert.strictEqual(g.win.eval('B.closeMelee.hp'),cercaAntes,"asedio no dispara dentro de su rango mínimo de 80px");

    g.win.eval(`B.units=[B.siege];B.siege.x=650;B.siege.t=0;B.eHP=B.eMax;
      B.baseDecoy=mkUnit(-1,"melee",0,0);B.baseDecoy.x=760;B.units.push(B.baseDecoy);`);
    const baseAntes=g.win.eval('B.eHP'),decoyAntes=g.win.eval('B.baseDecoy.hp');
    g.win.eval('bloop(B.last+50)');
    assert.ok(g.win.eval('B.eHP')<baseAntes,"asedio debe priorizar base/torreta al entrar en alcance");
    assert.strictEqual(g.win.eval('B.baseDecoy.hp'),decoyAntes,"la prioridad de base debe superar al objetivo terrestre");

    g.win.eval('B.eHP=B.eMax;B.siege.t=0;B.baseDecoy.kind="melee";B.baseDecoy.x=B.siege.x+50;');
    const baseSuprimida=g.win.eval('B.eHP');
    g.win.eval('bloop(B.last+50)');
    assert.strictEqual(g.win.eval('B.eHP'),baseSuprimida,"un melee a <80px anula incluso el disparo prioritario contra la base");
  }finally{closeGame(g);}
});

/* 25 (Fase 3A). La IA despliega los dos apoyos con spawnUnit y el save v5
   conserva/migra su veteranía. */
test("IA usa sanador y asedio; save v5 migra veteranía de apoyo", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");clickTerr("CAN");clickTerr("EUN");Math.random=()=>0;B.S["-1"].gold=999;B.eCool=0;');
    g.win.eval('B.woundedAI=mkUnit(-1,"melee",0,0);B.woundedAI.hp*=0.5;B.units.push(B.woundedAI);enemyAI(0.1);');
    assert.ok(g.win.eval('B.units.some(u=>u.side===-1&&u.kind==="healer")'),"la IA debe desplegar sanador ante aliados heridos");
    g.win.eval('B.units.forEach(u=>{if(u.side===-1)u.hp=u.max;});B.eCool=0;enemyAI(0.1);');
    assert.ok(g.win.eval('B.units.some(u=>u.side===-1&&u.kind==="siege")'),"la IA debe desplegar asedio con las mismas reglas");

    g.win.eval('F.AG.veterancy.healer.xp=30;F.AG.veterancy.siege.xp=80;');
    const code=g.win.eval('saveGame()');
    assert.strictEqual(g.win.eval(`JSON.parse(decodeURIComponent(escape(atob(${JSON.stringify(code)})))).v`),5);
    g.win.eval('F.AG.veterancy.healer.xp=0;loadGame('+JSON.stringify(code)+')');
    assert.strictEqual(g.win.eval('F.AG.veterancy.healer.xp'),30);
    assert.strictEqual(g.win.eval('F.AG.veterancy.siege.xp'),80);
    const veteranos=g.win.eval(`(()=>{const h=mkUnit(1,"healer",0,0),s=mkUnit(1,"siege",0,0),base={hr:h.rng,sd:s.dmg,sa:s.atk};
      applyVeterancy(h,"healer",2);applyVeterancy(s,"siege",3);return{h,s,base};})()`);
    assert.ok(Math.abs(veteranos.h.healMult-1.08)<1e-9,"Nv2 sanador aplica +8% curación");
    assert.ok(Math.abs(veteranos.s.dmg/veteranos.base.sd-1.15)<1e-9,"Nv3 asedio aplica +15% daño");
    assert.ok(Math.abs(veteranos.s.atk/veteranos.base.sa-0.9)<1e-9,"Nv3 asedio aplica -10% cd de ataque");
    const v4=g.win.eval(`(()=>{const d=JSON.parse(decodeURIComponent(escape(atob(saveGame()))));d.v=4;
      for(const f of Object.values(d.Fx)){delete f.veterancy.healer;delete f.veterancy.siege;}
      return btoa(unescape(encodeURIComponent(JSON.stringify(d))));})()`);
    assert.strictEqual(g.win.eval(`loadGame(${JSON.stringify(v4)})`),true);
    assert.strictEqual(g.win.eval('F.AG.veterancy.healer.xp'),0,"v4 migra sanador a 0 XP");
    assert.strictEqual(g.win.eval('F.AG.veterancy.siege.xp'),0,"v4 migra asedio a 0 XP");
  }finally{closeGame(g);}
});

/* Prueba 19 (Fase 2F). La telemetría registra una batalla local y su
   exportación separa partida/acumulado en JSON válido. */
test("Modo Balance: registra batalla y exporta JSON válido", async () => {
  const g=makeGame();
  try{
    assert.strictEqual(g.doc.getElementById("btnBalance").style.display,"none","el panel empieza oculto");
    g.win.eval('for(let i=0;i<5;i++)document.getElementById("gameTitle").click()');
    assert.strictEqual(g.win.eval('balanceEnabled'),true,"cinco toques al título activan Modo Balance");
    assert.strictEqual(g.doc.getElementById("balanceModal").style.display,"flex","la activación abre el panel");
    g.win.eval('closeModals();startGame(1);clickTerr("CAN");clickTerr("CAN");clickTerr("EUN");B.pvp=true;B.S["1"].gold=999;spawnUnit("1","melee");B.S["1"].damageByType.melee=42;B.time=75;finishBattle(true);');
    const exported=g.win.eval('exportBalanceJSON()'),data=JSON.parse(exported);
    assert.strictEqual(data.version,1);
    assert.strictEqual(data.partida.batallas,1,"debe registrar una batalla por partida");
    assert.strictEqual(data.partida.duracionMediaBatalla,75);
    assert.strictEqual(data.partida.unidades.melee.uso,1,"debe registrar uso por tipo");
    assert.strictEqual(data.partida.unidades.melee.tasaVictoria,1,"debe registrar tasa de victoria");
    assert.strictEqual(data.partida.danoMedioPorTipo.melee,42,"debe registrar daño medio por tipo");
    assert.ok(data.acumulado.batallas>=1,"debe persistir acumulado en localStorage");
    assert.ok(g.win.localStorage.getItem("IDM_BALANCE_PARTIDA_V1"),"la telemetría por partida debe persistirse localmente");
    assert.doesNotThrow(()=>JSON.parse(g.win.eval('copyBalanceJSON()')),"copiar debe exportar JSON válido");
    const debug=makeGame({url:"http://localhost/?debug=1"});
    try{assert.strictEqual(debug.win.eval('balanceEnabled'),true,"?debug=1 activa Modo Balance");}finally{closeGame(debug);}
  }finally{closeGame(g);}
});

async function main() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ ${t.name}`);
      pass++;
    } catch (e) {
      console.log(`❌ ${t.name}`);
      console.log("   " + (e && e.stack ? e.stack : e));
      fail++;
    }
  }
  console.log(`\n${pass} pasaron, ${fail} fallaron (de ${tests.length}).`);
  process.exit(fail ? 1 : 0);
}

main();
