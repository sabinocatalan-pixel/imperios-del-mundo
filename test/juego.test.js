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
    url: "http://localhost/",
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
