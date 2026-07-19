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
      multiplicadores counterMult 1.5/0.75; finishBattle(true) transfiere territorio y cumple conq1. */
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
    assert.ok(Math.abs(cm2 - 0.75) < 1e-9);

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
    assert.strictEqual(g.win.eval('counterMult({kind:"melee"},{kind:"air"})'), 0, "melee no alcanza aéreos");

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
    g.win.eval('turnSummaryLines=[];for(let i=0;i<8;i++) logCausal("evento de prueba "+i);');
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
    assert.strictEqual(g.win.eval('turnSummaryLines.some(x=>(x.m||x)==="algo")'),false,"el contenido de la ronda anterior se elimina");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Subsistencia")||x.m.includes("Escasez"))'),"la ronda nueva registra su economía causal");
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

/* 25 (Fase 3A). La IA despliega los dos apoyos con spawnUnit y el save vigente
   conserva/migra su veteranía. */
test("IA usa sanador y asedio; save vigente conserva veteranía de apoyo", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");clickTerr("CAN");clickTerr("EUN");Math.random=()=>0;B.S["-1"].gold=999;B.eCool=0;');
    g.win.eval('B.woundedAI=mkUnit(-1,"melee",0,0);B.woundedAI.hp*=0.5;B.units.push(B.woundedAI);enemyAI(0.1);');
    assert.ok(g.win.eval('B.units.some(u=>u.side===-1&&u.kind==="healer")'),"la IA debe desplegar sanador ante aliados heridos");
    g.win.eval('B.units.forEach(u=>{if(u.side===-1)u.hp=u.max;});B.eCool=0;enemyAI(0.1);');
    assert.ok(g.win.eval('B.units.some(u=>u.side===-1&&u.kind==="siege")'),"la IA debe desplegar asedio con las mismas reglas");

    g.win.eval('F.AG.veterancy.healer.xp=30;F.AG.veterancy.siege.xp=80;');
    const code=g.win.eval('saveGame()');
    assert.strictEqual(g.win.eval(`JSON.parse(decodeURIComponent(escape(atob(${JSON.stringify(code)})))).v`),7);
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

/* 27 (Fase 3B-1). Modelo neutral, escalado, recompensa inerte y
   migración retrocompatible sin tocar el motor de batalla normal. */
test("Monstruos 3B-1: datos, estado neutral y migración v5", async () => {
  const g=makeGame();
  try{
    assert.strictEqual(g.win.eval('Object.keys(MONSTERS).length'),4,"deben existir exactamente cuatro monstruos");
    assert.ok(g.win.eval('Object.values(MONSTERS).every(m=>m.patterns.length===2)'),"cada monstruo define exactamente dos patrones");
    assert.strictEqual(g.win.eval('JSON.stringify(monsterState)'),JSON.stringify({active:null,defeated:{},rewards:[]}),"el estado neutral empieza vacío");
    assert.strictEqual(g.win.eval('getAvailableMonsters(monsterState).length'),4);
    assert.strictEqual(g.win.eval('isValidMonsterTerritory("kraken","CAN")'),true,"Kraken usa extremos de rutas marítimas");
    assert.strictEqual(g.win.eval('isValidMonsterTerritory("amaru","PER")'),true);
    assert.strictEqual(g.win.eval('isValidMonsterTerritory("long","CHN")'),true);
    assert.strictEqual(g.win.eval('isValidMonsterTerritory("anubis","AFO")'),true);
    assert.strictEqual(g.win.eval('isValidMonsterTerritory("amaru","CHN")'),false,"las zonas deben excluir territorios ajenos");

    const scaled=g.win.eval('createMonsterState("kraken","CAN",6,2)');
    assert.strictEqual(scaled.maxHp,Math.round(1050*1.24),"PV escala 12% por época mediana");
    assert.ok(Math.abs(scaled.damage-24*1.20)<0.001,"daño escala 10% por época mediana");
    assert.strictEqual(scaled.nextRaidRound,8,"el dato prepara el primer saqueo sin ejecutarlo");
    assert.strictEqual(g.win.eval('monsterState.active'),null,"la función pura no muta el estado global");

    const reward=g.win.eval('getMonsterReward("kraken","AG","CAN",9)');
    assert.deepStrictEqual({id:reward.id,source:reward.sourceMonster,empire:reward.earnedBy,territory:reward.sourceTerritory,round:reward.earnedRound,inert:reward.inert},
      {id:"fragmento_abismo",source:"kraken",empire:"AG",territory:"CAN",round:9,inert:true});

    g.win.eval('startGame(1);clickTerr("CAN");monsterState.active=createMonsterState("kraken","CAN",6,1);');
    const code=g.win.eval('saveGame()');
    g.win.eval('monsterState=emptyMonsterState();loadGame('+JSON.stringify(code)+')');
    assert.strictEqual(g.win.eval('monsterState.active.id'),"kraken","save v5 conserva el estado neutral");
    const previousV5=g.win.eval(`(()=>{const d=JSON.parse(decodeURIComponent(escape(atob(saveGame()))));delete d.monsterState;
      return btoa(unescape(encodeURIComponent(JSON.stringify(d))));})()`);
    assert.strictEqual(g.win.eval(`loadGame(${JSON.stringify(previousV5)})`),true);
    assert.strictEqual(g.win.eval('JSON.stringify(monsterState)'),JSON.stringify({active:null,defeated:{},rewards:[]}),"un save v5 anterior migra a estado vacío");

    g.win.eval('clickTerr("CAN");clickTerr("EUN")');
    assert.strictEqual(g.win.eval('inBattle&&B.mode==="attack"'),true,"la batalla normal permanece intacta");
  }finally{closeGame(g);}
});

/* 28 (Fase 3B-2). Aparición global desde ronda 6 mediante la fórmula
   existente de Aleatoriedad Viva, sin saqueo, combate ni render de mapa. */
test("Monstruos 3B-2: aparición por Aleatoriedad Viva y límite global", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");Math.random=()=>0;');
    assert.strictEqual(g.win.eval('trySpawnMonster(monsterState,5,()=>0)'),null,"no aparecen antes de ronda 6");
    assert.strictEqual(g.win.eval('monsterState.active'),null);

    g.win.eval('round=6;eventHistory=[];monsterState.defeated={kraken:true,amaru:true,long:true};startRound();');
    const spawned=g.win.eval('monsterState.active');
    assert.strictEqual(spawned.id,"anubis","solo puede elegir un tipo no derrotado");
    assert.ok(g.win.eval('isValidMonsterTerritory(monsterState.active.id,monsterState.active.territory)'),"debe elegir un territorio válido");
    assert.strictEqual(spawned.nextRaidRound,8,"prepara el saqueo para dos rondas después");
    assert.ok(g.win.eval('eventHistory.some(e=>e.type==="monstruo:anubis"&&e.negative)'),"registra el evento vivo con su clave");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Anubis")&&x.m.includes("amenaza mítica"))'),"agrega explicación causal al Resumen");
    assert.strictEqual(g.doc.getElementById("worldBanner").style.display,"flex","la aparición muestra banner narrativo cuando está libre");
    const first=JSON.stringify(spawned);
    assert.strictEqual(g.win.eval('trySpawnMonster(monsterState,7,()=>0)'),null,"no admite más de un monstruo activo");
    assert.strictEqual(JSON.stringify(g.win.eval('monsterState.active')),first,"el activo existente no debe reemplazarse");

    const code=g.win.eval('saveGame()');
    g.win.eval('monsterState=emptyMonsterState();loadGame('+JSON.stringify(code)+')');
    const restored=g.win.eval('monsterState.active');
    for(const key of["id","territory","hp","maxHp","nextRaidRound"])
      assert.strictEqual(restored[key],spawned[key],`save debe conservar ${key}`);

    g.win.eval('monsterState=emptyMonsterState();monsterState.defeated={kraken:true,amaru:true,long:true,anubis:true};');
    assert.strictEqual(g.win.eval('trySpawnMonster(monsterState,8,()=>0)'),null,"si todos fueron derrotados no aparece ninguno");

    g.win.eval(`monsterState=emptyMonsterState();monsterState.defeated={kraken:true,amaru:true,long:true};
      delete T.MAG;delete T.AFO;delete T.AFE;delete T.SUD;`);
    assert.doesNotThrow(()=>g.win.eval('trySpawnMonster(monsterState,8,()=>0)'),"sin objetivos válidos no rompe la ronda");
    assert.strictEqual(g.win.eval('monsterState.active'),null);
  }finally{closeGame(g);}
});

/* 29 (Fase 3B-3). El mapa comunica una amenaza activa mediante capas,
   halo, marcador accesible, PV, ruta del Kraken y leyenda plegable. */
test("Monstruos 3B-3: marcador, halo, ruta y selección accesible", async () => {
  const g=makeGame();
  try{
    assert.ok(g.doc.getElementById("mythicRouteLayer"));
    assert.ok(g.doc.getElementById("mythicTerritoryLayer"));
    assert.ok(g.doc.getElementById("mythicMarkerLayer"));
    assert.strictEqual(g.doc.getElementById("mythicMarkerLayer").children.length,0,"sin activo no hay marcador");
    assert.strictEqual(g.doc.getElementById("mythicLegend").hidden,true,"sin activo la leyenda permanece oculta");

    g.win.eval('monsterState.active=createMonsterState("kraken","CAN",6,1);monsterState.active.hp=monsterState.active.maxHp/2;render();');
    const marker=g.doc.getElementById("mythicMonsterMarker");
    assert.ok(marker,"con activo aparece el marcador protagonista");
    assert.ok(g.doc.querySelector("#mythicTerritoryLayer .mythicThreatHalo"),"aparece halo territorial");
    assert.ok(g.doc.querySelector("#mythicRouteLayer .mythicThreatRoute"),"Kraken resalta una ruta marítima válida");
    assert.strictEqual(g.doc.getElementById("mythicLegend").hidden,false,"la leyenda aparece solo con amenaza");
    assert.ok(marker.getAttribute("aria-label").includes("Kraken"),"el marcador tiene nombre accesible");
    assert.ok(marker.querySelector("title").textContent.includes("PV"),"el marcador ofrece detalle textual de PV");
    assert.ok(Math.abs(+marker.querySelector(".mythicHpFill").getAttribute("width")-21)<0.01,"la barra refleja 50% de PV");
    assert.strictEqual(marker.querySelector(".mythicHitbox").getAttribute("r"),"22","hitbox base de 44x44 px");
    marker.dispatchEvent(new g.win.MouseEvent("click",{bubbles:true}));
    assert.strictEqual(g.win.eval('selected'),"CAN","tocar el marcador selecciona el territorio asociado");
    assert.ok(g.doc.getElementById("terrInfo").textContent.includes("Canadá"),"la selección actualiza el panel territorial normal");

    g.win.eval('monsterState.active=null;render();');
    assert.strictEqual(g.doc.getElementById("mythicMarkerLayer").children.length,0);
    assert.strictEqual(g.doc.getElementById("mythicLegend").hidden,true);
    g.win.eval('clickTerr("CAN")');
    assert.strictEqual(g.win.eval('selected'),"CAN","la selección normal del mapa sigue funcionando");
  }finally{closeGame(g);}
});

/* 30 (Fase 3B-4). Saqueo programado cada dos rondas con límites,
   persistencia, explicación causal y propietario dinámico. */
test("Monstruos 3B-4: saqueo causal, límites y persistencia", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");monsterState.active=createMonsterState("kraken","CAN",6,0);T.CAN.pop=10;F.AG.gold=40;round=7;');
    assert.strictEqual(g.win.eval('applyMonsterRaid(monsterState,round)'),null,"no saquea antes de nextRaidRound");
    assert.strictEqual(g.win.eval('T.CAN.pop'),10);assert.strictEqual(g.win.eval('F.AG.gold'),40);
    assert.strictEqual(g.win.eval('JSON.stringify(getMonsterRaidEffect("kraken"))'),JSON.stringify({population:2,gold:10}));
    assert.strictEqual(g.win.eval('JSON.stringify(getMonsterRaidEffect("amaru"))'),JSON.stringify({population:2,gold:8}));
    assert.strictEqual(g.win.eval('JSON.stringify(getMonsterRaidEffect("long"))'),JSON.stringify({population:1,gold:12}));
    assert.strictEqual(g.win.eval('JSON.stringify(getMonsterRaidEffect("anubis"))'),JSON.stringify({population:2,gold:10}));

    g.win.eval('round=8;document.getElementById("worldBanner").style.display="none";selected="CAN";');
    const activeBefore=g.win.eval('monsterState.active');
    const raid=g.win.eval('applyMonsterRaid(monsterState,round)');
    assert.deepStrictEqual({population:raid.populationLost,gold:raid.goldLost},{population:2,gold:10});
    assert.strictEqual(g.win.eval('T.CAN.pop'),8);assert.strictEqual(g.win.eval('F.AG.gold'),30);
    assert.strictEqual(g.win.eval('monsterState.active'),activeBefore,"el saqueo no elimina ni duplica el objeto activo");
    assert.strictEqual(g.win.eval('monsterState.active.raidCount'),1);
    assert.strictEqual(g.win.eval('monsterState.active.nextRaidRound'),10);
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Kraken saqueó Canadá"))'),"el Resumen explica el saqueo");
    assert.strictEqual(g.doc.getElementById("worldBanner").style.display,"flex","muestra banner si está libre");
    g.win.eval('render()');
    assert.ok(g.doc.querySelector(".mythicThreatHalo.raided"),"el mapa marca el territorio saqueado");
    assert.ok(g.doc.getElementById("terrInfo").textContent.includes("Próximo saqueo: 2 rondas"),"el panel muestra próxima ronda");
    assert.ok(g.doc.getElementById("terrInfo").textContent.includes("Daño acumulado: −2 población · −10 oro"),"el panel muestra pérdidas reales");
    assert.ok([...g.doc.querySelectorAll("#terrBtns button")].some(b=>b.textContent.includes("Desafiar")),"el panel presenta la acción de desafío");

    g.win.eval('T.CAN.owner="CO";T.CAN.pop=2;F.CO.gold=5;round=10;document.getElementById("worldBanner").style.display="none";');
    const second=g.win.eval('applyMonsterRaid(monsterState,round)');
    assert.strictEqual(second.owner,"CO","cambiar propietario no elimina la amenaza");
    assert.strictEqual(g.win.eval('T.CAN.pop'),2,"población nunca baja de dos");
    assert.strictEqual(g.win.eval('F.CO.gold'),0,"oro nunca baja de cero");
    assert.strictEqual(g.win.eval('monsterState.active.raidCount'),2);
    assert.strictEqual(g.win.eval('monsterState.active.nextRaidRound'),12);
    assert.strictEqual(g.win.eval('monsterState.active.id'),"kraken");

    const code=g.win.eval('saveGame()');
    g.win.eval('monsterState=emptyMonsterState();loadGame('+JSON.stringify(code)+')');
    assert.strictEqual(g.win.eval('monsterState.active.raidCount'),2,"save conserva raidCount");
    assert.strictEqual(g.win.eval('monsterState.active.nextRaidRound'),12,"save conserva nextRaidRound");
    g.win.eval('monsterState.active=null;T.CAN.pop=7;F.CO.gold=7;');
    assert.strictEqual(g.win.eval('applyMonsterRaid(monsterState,20)'),null,"sin activo no ocurre nada");
    assert.strictEqual(g.win.eval('T.CAN.pop'),7);assert.strictEqual(g.win.eval('F.CO.gold'),7);
    g.win.eval('monsterState.active=createMonsterState("kraken","CAN",18,0);T.CAN.owner="INVALIDO";');
    assert.doesNotThrow(()=>g.win.eval('applyMonsterRaid(monsterState,20)'),"un propietario inválido no rompe el turno");
    assert.strictEqual(g.win.eval('monsterState.active.nextRaidRound'),22,"la amenaza inválida se reprograma de forma segura");
  }finally{closeGame(g);}
});

/* 31 (Fase 3B-5). Requisitos explicables, origen sugerido e intento
   único por ronda sin abrir todavía una batalla de jefe. */
test("Monstruos 3B-5: validación y preparación del desafío", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");round=6;selected="CAN";render();');
    assert.ok(![...g.doc.querySelectorAll("#terrBtns button")].some(b=>b.textContent.includes("Desafiar")),"sin activo no hay botón Desafiar");

    g.win.eval('monsterState.active=createMonsterState("kraken","CAN",6,0);T.CAN.troops=8;render();');
    let check=g.win.eval('canChallengeMonster(monsterState,"AG",round)');
    assert.strictEqual(check.ok,true,"el propietario con 8 tropas puede desafiar");
    assert.strictEqual(check.origin.id,"CAN");
    assert.ok(g.doc.getElementById("terrInfo").textContent.includes("Requisitos para desafiar"));
    let challengeBtn=[...g.doc.querySelectorAll("#terrBtns button")].find(b=>b.textContent.includes("Desafiar"));
    assert.ok(challengeBtn&&!challengeBtn.disabled,"el botón se habilita cuando cumple requisitos");

    g.win.eval('T.CAN.owner="CO";T.CAN.troops=4;T.EUN.owner="AG";T.EUN.troops=9;selected="CAN";render();');
    check=g.win.eval('canChallengeMonster(monsterState,"AG",round)');
    assert.strictEqual(check.ok,true,"una conexión marítima con 8 tropas permite desafiar");
    assert.strictEqual(check.origin.id,"EUN");assert.strictEqual(check.origin.connection,"ruta marítima");

    g.win.eval('monsterState.active=createMonsterState("amaru","PER",6,0);T.PER.owner="SO";T.BRA.owner="AG";T.BRA.troops=10;selected="PER";render();');
    check=g.win.eval('canChallengeMonster(monsterState,"AG",round)');
    assert.strictEqual(check.ok,true,"un territorio adyacente puede ser origen");
    assert.strictEqual(check.origin.id,"BRA");assert.strictEqual(check.origin.connection,"adyacencia");

    g.win.eval('T.BRA.troops=7;render();');
    check=g.win.eval('canChallengeMonster(monsterState,"AG",round)');
    assert.strictEqual(check.ok,false);assert.ok(check.reason.includes("8 tropas"));
    challengeBtn=[...g.doc.querySelectorAll("#terrBtns button")].find(b=>b.textContent.includes("Desafiar"));
    assert.ok(challengeBtn.disabled,"con menos de 8 tropas queda bloqueado");

    g.win.eval('T.BRA.troops=10;render();');
    const hpBefore=g.win.eval('monsterState.active.hp'),ownerBefore=g.win.eval('T.PER.owner');
    challengeBtn=[...g.doc.querySelectorAll("#terrBtns button")].find(b=>b.textContent==="⚔ Desafiar");
    challengeBtn.click();
    assert.strictEqual(g.win.eval('inBattle'),true,"el desafío abre la batalla base de jefe");
    assert.strictEqual(g.win.eval('B.mode'),"boss");
    assert.strictEqual(g.win.eval('monsterState.active.hp'),hpBefore,"no cambia PV del jefe");
    assert.strictEqual(g.win.eval('T.PER.owner'),ownerBefore,"no cambia propietario");
    assert.strictEqual(g.win.eval('monsterState.active.attemptsThisRound.AG'),6,"registra el intento de la ronda");
    assert.strictEqual(g.win.eval('canChallengeMonster(monsterState,"AG",6).ok'),false,"no permite dos intentos en la misma ronda");
    g.win.eval('B.over=true;document.getElementById("battle").style.display="none";document.getElementById("battle").classList.remove("bossBattle");B=null;inBattle=false;');

    const code=g.win.eval('saveGame()');
    g.win.eval('monsterState.active.attemptsThisRound={};loadGame('+JSON.stringify(code)+')');
    assert.strictEqual(g.win.eval('monsterState.active.attemptsThisRound.AG'),6,"save conserva intentos");
    g.win.eval('round=7;resetMonsterAttemptsForRound(monsterState,round);');
    assert.strictEqual(g.win.eval('monsterState.active.attemptsThisRound.AG'),undefined,"al cambiar de ronda libera el intento");
    assert.strictEqual(g.win.eval('canChallengeMonster(monsterState,"AG",7).ok'),true);
  }finally{closeGame(g);}
});

/* 32 (Fase 3B-6A). Batalla base aislada: PV persistente, resolución sin
   transferencia territorial y recompensa todavía inerte. */
test("Monstruos 3B-6A: batalla boss y resolución persistente", async () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");round=6;monsterState.active=createMonsterState("kraken","CAN",6,0);T.CAN.troops=12;selected="CAN";render();');
    const owner=g.win.eval('T.CAN.owner'),maxHp=g.win.eval('monsterState.active.maxHp');
    assert.strictEqual(g.win.eval('prepareMonsterChallenge("AG")'),true);
    assert.strictEqual(g.win.eval('inBattle&&B.mode==="boss"'),true);
    assert.strictEqual(g.win.eval('B.bossId'),"kraken");assert.strictEqual(g.win.eval('B.challengeOrigin'),"CAN");
    assert.ok(g.doc.getElementById("btitle").textContent.includes("BATALLA DE JEFE"));
    assert.ok(g.doc.getElementById("battle").classList.contains("bossBattle"),"usa barra grande de jefe");
    assert.ok(g.win.eval('B.banner.subtxt.includes("avisan 1 segundo")'),"el banner explica los patrones activos");
    assert.ok(!g.win.eval('B.banner.subtxt.includes("Sin patrones")'),"no conserva texto obsoleto de 3B-6A");

    g.win.eval('spawnUnit("1","melee");B.testBossTroop=B.units.find(u=>u.side===1);B.testBossTroop.x=W-80;B.testBossTroop.t=0;');
    const bossBefore=g.win.eval('B.eHP');
    g.win.eval('bloop(B.last+50)');
    assert.ok(g.win.eval('B.eHP')<bossBefore,"las tropas pueden dañar directamente la barra del jefe");
    assert.strictEqual(g.win.eval('B.bossHp'),g.win.eval('B.eHP'),"bossHp acompaña la barra viva del jefe");
    const troopBefore=g.win.eval('B.testBossTroop.hp');
    g.win.eval('B.bossAttackT=0;bossNormalAttack(0.1)');
    assert.ok(g.win.eval('B.testBossTroop.hp')<troopBefore,"el jefe ejecuta un ataque normal sin patrones especiales");

    g.win.eval('B.eHP=B.eMax-123;finishBattle(false);');
    await sleep(1700);
    assert.strictEqual(g.win.eval('monsterState.active.hp'),maxHp-123,"derrota conserva el daño causado");
    assert.strictEqual(g.win.eval('monsterState.active.id'),"kraken");
    assert.strictEqual(g.win.eval('T.CAN.owner'),owner,"derrota no transfiere territorio");
    assert.ok(g.win.eval('T.CAN.troops<12'),"derrota aplica pérdidas militares al origen");
    const survived=g.win.eval('saveGame()');
    g.win.eval('monsterState.active.hp=1;loadGame('+JSON.stringify(survived)+')');
    assert.strictEqual(g.win.eval('monsterState.active.hp'),maxHp-123,"save conserva PV del jefe superviviente");

    g.win.eval('round=7;resetMonsterAttemptsForRound(monsterState,round);T.CAN.troops=12;prepareMonsterChallenge("AG");B.eHP=B.eMax-200;finishBattle(false,true);');
    await sleep(1700);
    assert.strictEqual(g.win.eval('monsterState.active.hp'),maxHp-200,"retirada conserva PV restante");
    assert.strictEqual(g.win.eval('T.CAN.owner'),owner);
    assert.strictEqual(g.win.eval('T.CAN.troops'),8,"retirada aplica pérdida reducida del 30%");

    g.win.eval('round=8;resetMonsterAttemptsForRound(monsterState,round);T.CAN.troops=12;prepareMonsterChallenge("AG");B.eHP=0;finishBattle(true);');
    await sleep(1700);
    assert.strictEqual(g.win.eval('monsterState.active'),null,"victoria elimina el monstruo y detiene saqueos");
    assert.strictEqual(g.win.eval('monsterState.defeated.kraken'),true);
    assert.ok(g.win.eval('monsterState.rewards.some(r=>r.sourceMonster==="kraken"&&r.inert)'),"victoria emite recompensa inerte");
    assert.strictEqual(g.win.eval('T.CAN.owner'),owner,"victoria tampoco transfiere territorio");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("derrotó a Kraken"))'));

    g.win.eval('monsterState.active=createMonsterState("amaru","PER",9,0);T.PER.owner="SO";T.BRA.owner="AG";T.BRA.troops=7;round=9;selected="PER";render();');
    assert.strictEqual(g.win.eval('prepareMonsterChallenge("AG")'),false,"no abre boss sin ocho tropas");
    assert.strictEqual(g.win.eval('inBattle'),false);

    g.win.eval('monsterState.active=null;selected=null;T.CAN.owner="AG";T.EUN.owner="CO";T.CAN.troops=8;clickTerr("CAN");clickTerr("EUN")');
    assert.strictEqual(g.win.eval('inBattle&&B.mode==="attack"'),true,"la batalla normal sigue funcionando");
  }finally{closeGame(g);}
});

/* 33 (Fase 3B-6B). Los ocho patrones se programan desde sus datos, avisan
   antes del impacto y nunca intervienen en una batalla territorial normal. */
test("Monstruos 3B-6B: patrones especiales avisados y aislados", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");
      function setupBossPatternTest(id){
        const monster=getMonsterById(id);
        monsterState.active=createMonsterState(id,monster.zone.territories[0],6,0);
        const mk=(kind,x,hp=null)=>{const u=mkUnit(1,kind,0,0,1);u.x=x;if(hp!==null)u.hp=hp;return u;};
        B={mode:"boss",over:false,bossId:id,time:20,shake:0,eHP:monsterState.active.hp,eMax:monsterState.active.maxHp,
          pHP:500,pMax:500,units:[mk("melee",820),mk("heavy",760),mk("air",700)],dmgs:[],projs:[],pufs:[],corpses:[],
          banner:null,bannerQueue:[],bossZones:[],bossPatternLog:[],
          bossPatternState:monster.patterns.map(p=>({id:p.id,cooldown:p.cooldown,remaining:p.cooldown,warning:false,warningT:0,targets:[]})),
          S:{"1":{fac:"AG",defBuffT:0,champAlive:false},"-1":{fac:"AG",defBuffT:0,champAlive:false}},stones:[]};
        return B;
      }
      function fireBossPattern(index){
        const slot=B.bossPatternState[index];slot.remaining=1;updateBossPatterns(.01);
        const warned=slot.warning&&slot.warningT===1&&slot.targets.length>0&&!!B.banner;
        drawBossHazards();updateBossPatterns(1.01);
        return{warned,remaining:slot.remaining,log:B.bossPatternLog[B.bossPatternLog.length-1]};
      }`);

    for(const id of["kraken","amaru","long","anubis"]){
      g.win.eval(`setupBossPatternTest(${JSON.stringify(id)})`);
      assert.strictEqual(g.win.eval('B.bossPatternState.length'),2,`${id} tiene exactamente dos patrones`);
      assert.deepStrictEqual(Array.from(g.win.eval('B.bossPatternState.map(x=>x.id)')),
        Array.from(g.win.eval('getMonsterById(B.bossId).patterns.map(x=>x.id)')));
    }

    g.win.eval('setupBossPatternTest("kraken")');
    let hp=g.win.eval('B.units[0].hp'),base=g.win.eval('B.pHP');
    let fired=g.win.eval('fireBossPattern(0)');
    assert.ok(fired.warned);assert.strictEqual(fired.log.id,"tentacle_strike");
    assert.strictEqual(fired.remaining,7,"respeta cooldown de siete segundos");
    assert.ok(g.win.eval('B.units[0].hp')<hp,"tentáculo daña la primera línea");
    const beforeX=g.win.eval('B.units[0].x');fired=g.win.eval('fireBossPattern(1)');
    assert.strictEqual(fired.log.id,"abyssal_tide");assert.strictEqual(fired.remaining,14);
    assert.ok(g.win.eval('B.units[0].x')<beforeX);assert.ok(g.win.eval('B.units[0].stunT>=1.2'));
    assert.strictEqual(g.win.eval('B.pHP'),base,"los patrones no dañan la base");

    g.win.eval('setupBossPatternTest("amaru")');hp=g.win.eval('B.units[0].hp');
    fired=g.win.eval('fireBossPattern(0)');assert.strictEqual(fired.log.id,"serpent_charge");
    assert.strictEqual(fired.remaining,6);assert.ok(g.win.eval('B.units[0].hp')<hp);
    fired=g.win.eval('fireBossPattern(1)');assert.strictEqual(fired.log.id,"venom_cloud");
    assert.strictEqual(g.win.eval('B.bossZones[0].t'),4,"la nube comienza con cuatro segundos");
    hp=g.win.eval('B.units[0].hp');g.win.eval('updateBossZones(1)');
    assert.ok(g.win.eval('B.units[0].hp')<hp,"la nube aplica daño temporal");
    g.win.eval('updateBossZones(3.01)');assert.strictEqual(g.win.eval('B.bossZones.length'),0);

    g.win.eval('setupBossPatternTest("long")');
    const groundHp=g.win.eval('B.units[0].hp'),airHp=g.win.eval('B.units[2].hp');
    fired=g.win.eval('fireBossPattern(0)');assert.strictEqual(fired.log.id,"celestial_breath");
    assert.strictEqual(fired.remaining,8);assert.ok(g.win.eval('B.units[0].hp')<groundHp);
    assert.ok(g.win.eval('B.units[2].hp')<airHp,"el aliento alcanza unidades aéreas");
    const aliveBefore=Array.from(g.win.eval('B.units.map(u=>u.hp)'));
    fired=g.win.eval('fireBossPattern(1)');assert.strictEqual(fired.log.id,"long_storm");
    const aliveAfter=Array.from(g.win.eval('B.units.map(u=>u.hp)'));
    assert.strictEqual(aliveAfter.filter((v,i)=>v<aliveBefore[i]).length,2,"la tormenta golpea dos unidades separadas");

    g.win.eval('setupBossPatternTest("anubis");B.units[0].hp=40;B.units[1].hp=180;B.units[2].hp=70;');
    fired=g.win.eval('fireBossPattern(0)');assert.strictEqual(fired.log.id,"desert_scythe");
    const hpLow=g.win.eval('B.units[0].hp'),hpHigh=g.win.eval('B.units[1].hp');
    fired=g.win.eval('fireBossPattern(1)');assert.strictEqual(fired.log.id,"anubis_judgment");
    assert.strictEqual(fired.remaining,14);assert.strictEqual(g.win.eval('B.units[0].hp'),hpLow);
    assert.ok(g.win.eval('B.units[1].hp')<hpHigh,"Juicio elige la unidad con mayor PV actual");

    g.win.eval('setupBossPatternTest("kraken");B.units=[];B.bossPatternState[0].remaining=.5;updateBossPatterns(1)');
    assert.strictEqual(g.win.eval('B.bossPatternLog.length'),0,"sin objetivo no ejecuta ni falla");
    assert.strictEqual(g.win.eval('B.bossPatternState[0].warning'),false);
    g.win.eval('setupBossPatternTest("kraken");B.mode="attack";B.bossPatternState[0].remaining=0;updateBossPatterns(2)');
    assert.strictEqual(g.win.eval('B.bossPatternLog.length'),0,"una batalla normal nunca ejecuta patrones");
  }finally{closeGame(g);}
});

/* 34 (Fase 3B-7). La IA evalúa la caza con las reglas compartidas y su
   resolución automática conserva daño, propiedad y recompensa correctos. */
test("Monstruos 3B-7: IA cazadora simétrica y persistente", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");round=8;
      function setupAIHunt(empire="AG",troops=14,raidCount=2,eraMedian=0){
        monsterState=emptyMonsterState();monsterState.active=createMonsterState("amaru","PER",round,eraMedian);
        monsterState.active.raidCount=raidCount;T.PER.owner=empire;T.PER.troops=troops;
        F[empire].era=eraMedian;F[empire].upArm=0;F[empire].veterancy.melee.xp=0;
        turnSummaryLines=[];return monsterState.active;
      }`);

    g.win.eval('monsterState=emptyMonsterState()');
    assert.strictEqual(g.win.eval('shouldAIChallengeMonster(monsterState,"AG")'),false,"sin monstruo no intenta");

    g.win.eval('setupAIHunt("AG",7,0,0)');
    assert.strictEqual(g.win.eval('canChallengeMonster(monsterState,"AG",round).ok'),false);
    assert.strictEqual(g.win.eval('shouldAIChallengeMonster(monsterState,"AG")'),false,"menos de ocho tropas bloquea la IA");

    g.win.eval('setupAIHunt("AG",14,2,0);for(const id in T)if(T[id].owner==="SO")T[id].owner="AG";T.JPN.owner="SO";');
    assert.strictEqual(g.win.eval('getMonsterChallengeOrigins(monsterState,"SO").length'),0);
    assert.strictEqual(g.win.eval('shouldAIChallengeMonster(monsterState,"SO")'),false,"sin conexión no intenta");

    g.win.eval('setupAIHunt("CO",8,0,3);F.CO.era=0');
    let evaluation=g.win.eval('evaluateMonsterHuntDesire(monsterState,"CO")');
    assert.ok(evaluation.desire<0.55);assert.strictEqual(g.win.eval('shouldAIChallengeMonster(monsterState,"CO")'),false,"deseo bajo no intenta");

    g.win.eval('setupAIHunt("AG",14,2,0)');
    evaluation=g.win.eval('evaluateMonsterHuntDesire(monsterState,"AG")');
    assert.deepStrictEqual({...evaluation.components},{territoryOwner:0.35,highAccumulatedRaid:0.2,strongOrigin:0.2,adequateEra:0.15,aggressivePersonality:0.085});
    assert.ok(evaluation.desire>=0.55);assert.strictEqual(g.win.eval('shouldAIChallengeMonster(monsterState,"AG")'),true,"deseo alto permite intentar");
    const ownerBefore=g.win.eval('T.PER.owner'),hpBefore=g.win.eval('monsterState.active.hp');
    let result=g.win.eval('resolveAIMonsterChallenge(monsterState,"AG")');
    assert.strictEqual(result.attempted,true);assert.strictEqual(result.win,false);
    assert.ok(g.win.eval('monsterState.active.hp')<hpBefore,"el intento reduce PV persistentes");
    assert.strictEqual(g.win.eval('T.PER.troops'),6,"la derrota aplica el mismo factor 0.45");
    assert.strictEqual(g.win.eval('T.PER.owner'),ownerBefore,"cazar no transfiere territorio");
    assert.strictEqual(g.win.eval('monsterState.active.attemptsThisRound.AG'),8);
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("intentó cazar")&&x.m.includes("fue rechazado"))'));
    result=g.win.eval('resolveAIMonsterChallenge(monsterState,"AG")');
    assert.strictEqual(result.attempted,false,"no permite dos intentos en la ronda");
    const lossSave=g.win.eval('saveGame()'),savedHp=g.win.eval('monsterState.active.hp');
    g.win.eval('monsterState.active.hp=1;loadGame('+JSON.stringify(lossSave)+')');
    assert.strictEqual(g.win.eval('monsterState.active.hp'),savedHp,"guardar/cargar conserva el resultado fallido");

    g.win.eval('round=9;setupAIHunt("SO",14,2,0);monsterState.active.hp=1;');
    const human=g.win.eval('player'),ownerBeforeWin=g.win.eval('T.PER.owner');
    result=g.win.eval('resolveAIMonsterChallenge(monsterState,"SO")');
    assert.strictEqual(result.win,true);assert.strictEqual(g.win.eval('monsterState.active'),null);
    assert.strictEqual(g.win.eval('monsterState.defeated.amaru'),true);
    assert.strictEqual(g.win.eval('T.PER.owner'),ownerBeforeWin);
    assert.ok(g.win.eval('T.PER.troops<14'),"incluso al rematar consume tropas e intento");
    assert.strictEqual(g.win.eval('monsterState.rewards.length'),1);
    assert.strictEqual(g.win.eval('monsterState.rewards[0].earnedBy'),"SO");
    assert.notStrictEqual(g.win.eval('monsterState.rewards[0].earnedBy'),human,"la recompensa no se atribuye al jugador");
    assert.ok(g.win.eval('monsterState.rewards[0].inert'));
    const winSave=g.win.eval('saveGame()');g.win.eval('monsterState=emptyMonsterState();loadGame('+JSON.stringify(winSave)+')');
    assert.strictEqual(g.win.eval('monsterState.defeated.amaru'),true);
    assert.strictEqual(g.win.eval('monsterState.rewards[0].earnedBy'),"SO","save conserva la recompensa de IA");
  }finally{closeGame(g);}
});

/* 35 (Fase 3B-9). Ayuda rápida opcional, persistente y ajena a batalla. */
test("Ayuda rápida: abre, cierra y recuerda la preferencia", () => {
  const g=makeGame();
  try{
    const helpBtn=g.doc.getElementById("btnHelp"),panel=g.doc.getElementById("quickHelp");
    assert.ok(helpBtn,"el botón Ayuda aparece en el encabezado");
    assert.strictEqual(panel.hidden,false,"la guía inicial se ofrece al jugador nuevo");
    g.doc.getElementById("closeQuickHelp").click();
    assert.strictEqual(panel.hidden,true,"la ayuda puede cerrarse");
    helpBtn.click();assert.strictEqual(panel.hidden,false,"el botón vuelve a abrirla");

    const hide=g.doc.getElementById("hideQuickHelp");hide.checked=true;
    hide.dispatchEvent(new g.win.Event("change",{bubbles:true}));
    assert.strictEqual(g.win.localStorage.getItem("imperiosOcultarAyuda"),"1","guarda No volver a mostrar");
    g.win.eval('closeQuickHelp()');
    assert.strictEqual(g.win.eval('openQuickHelp(true)'),false,"la preferencia evita la apertura automática");
    assert.strictEqual(panel.hidden,true);
    assert.strictEqual(g.win.eval('openQuickHelp(false)'),true,"la apertura manual siempre sigue disponible");

    const text=panel.textContent;
    assert.ok(text.includes("garantiza su reliquia base")&&text.includes("slot único"),"explica recompensa y equipamiento vigentes");
    assert.ok(text.includes("Counters")&&text.includes("torres/base"),"counters ya se explican y torres/base siguen como mejora futura");
    assert.ok(!panel.classList.contains("modal"),"usa un cajón ligero y no un modal bloqueante");
    assert.ok(g.doc.querySelector("style").textContent.includes("max-height:72dvh"),"en móvil deja parte del mapa visible");

    g.win.eval('closeQuickHelp();inBattle=true');
    assert.strictEqual(g.win.eval('openQuickHelp(false)'),false,"no abre durante una batalla activa");
    assert.strictEqual(panel.hidden,true);
    g.win.eval('inBattle=false;openQuickHelp(false);T.CAN.owner="AG";T.EUN.owner="CO";openBattle("CAN","EUN","attack")');
    assert.strictEqual(panel.hidden,true,"una batalla cierra la ayuda que ya estaba abierta");
  }finally{closeGame(g);}
});

/* 36 (Fase 3C-1). Catálogo, propiedad derivada y migración v5 a v6,
   sin activar todavía efectos de reliquias. */
test("Reliquias 3C-1: datos, propiedad y migración v6", () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN")');
    assert.strictEqual(g.win.eval('Object.keys(RELICS).length'),4,"existen exactamente cuatro reliquias");
    assert.deepStrictEqual(Array.from(g.win.eval('Object.values(RELICS).map(r=>r.sourceMonster).sort()')),
      ["amaru","anubis","kraken","long"]);
    assert.ok(g.win.eval('Object.values(RELICS).every(r=>r.id&&r.name&&r.rewardId&&r.description&&r.effect&&r.restriction&&r.inertUntilEquipped&&r.help)'));
    assert.ok(g.win.eval('Object.keys(MONSTERS).every(id=>getRelicByMonster(id))'));
    assert.ok(g.win.eval('Object.keys(F).every(id=>F[id].equippedRelic===null)'),"el slot inicia vacío");

    g.win.eval(`monsterState.rewards=[
      getMonsterReward("kraken","AG","CAN",8),
      getMonsterReward("amaru","SO","PER",9),
      {...getMonsterReward("kraken","AG","CAN",8),relicId:undefined}
    ]`);
    assert.strictEqual(g.win.eval('getRelicByReward(monsterState.rewards[0]).id'),"perla_abismo");
    assert.deepStrictEqual(Array.from(g.win.eval('getEmpireRelics(monsterState,"AG").map(r=>r.id)')),["perla_abismo"]);
    assert.strictEqual(g.win.eval('ownsRelic(monsterState,"AG","perla_abismo")'),true);
    assert.strictEqual(g.win.eval('ownsRelic(monsterState,"SO","perla_abismo")'),false);
    assert.strictEqual(g.win.eval('validateEquippedRelic({monsterState,factions:{SO:{equippedRelic:"escama_amaru"}}},"SO")'),"escama_amaru");

    const oldCode=g.win.eval(`(()=>{const d=JSON.parse(decodeURIComponent(escape(atob(saveGame()))));
      d.v=5;delete d.Fx.SO.equippedRelic;d.Fx.AG.equippedRelic="escama_amaru";
      d.monsterState.rewards.forEach(r=>delete r.relicId);
      return btoa(unescape(encodeURIComponent(JSON.stringify(d))));})()`);
    g.win.eval('monsterState=emptyMonsterState();F.AG.equippedRelic="perla_abismo"');
    assert.strictEqual(g.win.eval('loadGame('+JSON.stringify(oldCode)+')'),true,"save v5 migra");
    assert.strictEqual(g.win.eval('monsterState.rewards.length'),2,"deduplica el inventario efectivo");
    assert.strictEqual(g.win.eval('monsterState.rewards[0].relicId'),"perla_abismo");
    assert.ok(g.win.eval('monsterState.rewards.every(r=>r.inert)'),"las recompensas siguen inertes");
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),null,"limpia una reliquia ajena");
    assert.strictEqual(g.win.eval('validateEquippedRelic({monsterState,factions:F},"AG")'),null);
    assert.strictEqual(g.win.eval('monsterState.rewards.some(r=>r.sourceMonster==="amaru"&&r.earnedBy==="SO")'),true,"conserva 3B");

    const currentVersion=g.win.eval('JSON.parse(decodeURIComponent(escape(atob(saveGame())))).v');
    assert.strictEqual(currentVersion,7,"los guardados nuevos son v7");
    assert.strictEqual(g.win.eval('inBattle'),false,"la migración no abre ni altera batalla");
  }finally{closeGame(g);}
});

/* 37 (Fase 3C-2). Un solo slot, propiedad, ventana de inicio de turno y
   persistencia sin activar efectos. */
test("Reliquias 3C-2: equipar, cambiar y retirar al inicio del turno", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");monsterState.rewards=[
      getMonsterReward("kraken","AG","CAN",8),
      getMonsterReward("long","AG","CHN",9),
      getMonsterReward("amaru","SO","PER",9)
    ]`);
    assert.strictEqual(g.win.eval('relicChangeOpen'),true,"la ventana abre al iniciar el turno");
    assert.strictEqual(g.win.eval('canChangeRelic(currentRelicState(),"AG")'),true);
    assert.strictEqual(g.win.eval('equipRelic(currentRelicState(),"AG","no_existe")'),false,"rechaza id inexistente");
    assert.strictEqual(g.win.eval('equipRelic(currentRelicState(),"AG","escama_amaru")'),false,"rechaza reliquia ajena");

    const before=g.win.eval('JSON.stringify({gold:F.AG.gold,troops:T.CAN.troops,base:T.CAN.base})');
    assert.strictEqual(g.win.eval('equipRelic(currentRelicState(),"AG","perla_abismo")'),true);
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),"perla_abismo");
    assert.strictEqual(g.win.eval('getEquippedRelic(currentRelicState(),"AG").id'),"perla_abismo");
    assert.strictEqual(g.win.eval('equipRelic(currentRelicState(),"AG","aliento_long")'),true,"la segunda reemplaza a la primera");
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),"aliento_long","solo existe un slot");
    assert.strictEqual(g.win.eval('JSON.stringify({gold:F.AG.gold,troops:T.CAN.troops,base:T.CAN.base})'),before,"equipar no activa efectos ni cambia estadísticas");

    const code=g.win.eval('saveGame()');
    g.win.eval('F.AG.equippedRelic=null;loadGame('+JSON.stringify(code)+')');
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),"aliento_long","save v6 conserva el slot válido");
    assert.strictEqual(g.win.eval('relicChangeOpen'),false,"cargar no reabre la ventana de cambio");
    assert.strictEqual(g.win.eval('equipRelic(currentRelicState(),"AG","perla_abismo")'),false,"fuera del inicio no cambia");

    g.win.eval('relicChangeOpen=true');
    assert.strictEqual(g.win.eval('unequipRelic(currentRelicState(),"AG")'),true);
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),null,"se puede retirar");
    assert.strictEqual(g.win.eval('unequipRelic(currentRelicState(),"AG")'),false,"no retira dos veces");

    g.win.eval('F.AG.equippedRelic="escama_amaru";const m=migrateRelicState({monsterState,factions:F});F=m.factions;');
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),null,"la validación limpia selección ajena");
    assert.ok(g.win.eval('Object.values(RELICS).every(r=>r.inertUntilEquipped)'),"los cuatro efectos siguen declarados como inertes");
  }finally{closeGame(g);}
});

/* 38 (Fase 3C-3A). Claridad descriptiva de héroes y UI mínima del slot
   de reliquia, todavía sin efectos funcionales. */
test("Claridad UI: habilidades de héroes y reliquias propias", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");monsterState.rewards=[
      getMonsterReward("kraken","AG","CAN",8),
      getMonsterReward("long","AG","CHN",9),
      getMonsterReward("amaru","SO","PER",9)
    ];render();openPanteon("equipar","AG")`);

    const panteon=g.doc.getElementById("panteonBody").textContent;
    assert.ok(panteon.includes("Defensor")&&panteon.includes("Muro de Escudos"),"muestra rol y habilidad");
    assert.ok(panteon.includes("Pasiva")&&panteon.includes("Activa"),"distingue tipos de habilidad");
    assert.ok(panteon.includes("Cuándo:")&&panteon.includes("CD 25s"),"explica disparador y cooldown");
    assert.ok(g.win.eval('Object.values(HEROES).every(h=>h.rol&&h.habilidad.cuando&&h.habilidad.limitacion)'),"los ocho héroes tienen metadata descriptiva");
    g.win.eval('fichaHeroId="boudica";renderPanteon()');
    const ficha=g.doc.getElementById("panteonBody").textContent;
    assert.ok(ficha.includes("Impulsora · Habilidad activa")&&ficha.includes("Tócala cuando Boudica esté viva"));
    assert.ok(ficha.includes("Límite:")&&ficha.includes("Cooldown 25s"));

    g.win.eval('document.getElementById("panteonModal").style.display="none";render()');
    const panel=g.doc.getElementById("relicPanel");
    assert.ok(panel&&panel.textContent.includes("slot único"));
    assert.ok(panel.textContent.includes("Perla del Abismo")&&panel.textContent.includes("Aliento del Long"));
    assert.ok(!panel.textContent.includes("Escama de Amaru"),"no lista reliquias ajenas");
    assert.ok(panel.textContent.includes("Efecto activo al equipar"));

    const statsBefore=g.win.eval('JSON.stringify({gold:F.AG.gold,troops:T.CAN.troops,upArm:F.AG.upArm})');
    let button=[...g.doc.querySelectorAll("#empBtns button")].find(b=>b.textContent.includes("Equipar ◆ Perla"));
    assert.ok(button&&!button.disabled,"permite equipar al inicio");button.click();
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),"perla_abismo");
    assert.ok(g.doc.getElementById("relicPanel").textContent.includes("Perla del Abismo · Equipada"));

    button=[...g.doc.querySelectorAll("#empBtns button")].find(b=>b.textContent.includes("Cambiar a ◆ Aliento"));
    assert.ok(button&&!button.disabled);button.click();
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),"aliento_long");
    button=[...g.doc.querySelectorAll("#empBtns button")].find(b=>b.textContent.includes("Retirar ◆ Aliento"));
    assert.ok(button&&!button.disabled);button.click();
    assert.strictEqual(g.win.eval('F.AG.equippedRelic'),null,"retira desde UI");
    assert.strictEqual(g.win.eval('JSON.stringify({gold:F.AG.gold,troops:T.CAN.troops,upArm:F.AG.upArm})'),statsBefore,"la UI no activa efectos");

    g.win.eval('relicChangeOpen=false;render()');
    const locked=[...g.doc.querySelectorAll("#empBtns button")].filter(b=>b.textContent.includes("◆"));
    assert.ok(locked.length&&locked.every(b=>b.disabled),"fuera del inicio los controles están bloqueados");
    assert.ok(g.doc.getElementById("empBtns").textContent.includes("solo pueden cambiarse al inicio"));

    g.win.eval('monsterState.rewards=[];render()');
    assert.ok(g.doc.getElementById("relicPanel").textContent.includes("Aún no posees reliquias"));
  }finally{closeGame(g);}
});

/* 39 (Fase 3C-3B). Perla y Escama aplican únicamente sus contextos aprobados. */
test("Reliquias 3C-3B: Perla defensiva y Escama del héroe", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");
      function closeRelicBattle(){if(B)B.over=true;B=null;inBattle=false;document.getElementById("battle").style.display="none";}
      monsterState.rewards=[getMonsterReward("kraken","AG","CAN",8)];F.AG.equippedRelic="perla_abismo";`);

    g.win.eval('T.CAN.owner="AG";T.EUN.owner="CO";openBattle("EUN","CAN","defense")');
    assert.strictEqual(g.win.eval('B.S["1"].relicDamageTakenMult'),0.9,"Perla protege al defensor costero");
    assert.ok(g.win.eval('B.S["1"].relicUses.perla_abismo.contexts.includes("costa")'),"marca el uso costero para telemetría");
    assert.ok(g.win.eval('B.banner&&B.banner.txt.includes("Perla del Abismo")'),"muestra feedback causal");
    assert.strictEqual(g.win.eval('dmgTakenMult(mkUnit(1,"melee",0,0))'),0.9,"reduce exactamente 10%");
    g.win.eval('B.duel={resolved:false}');
    assert.strictEqual(g.win.eval('dmgTakenMult(mkUnit(1,"melee",0,0))'),1,"no interviene durante duelo");
    g.win.eval('closeRelicBattle();openBattle("CAN","EUN","attack")');
    assert.strictEqual(g.win.eval('B.S["1"].relicDamageTakenMult'),1,"no protege al atacar");

    g.win.eval('closeRelicBattle();T.PER.owner="AG";T.BRA.owner="CO";openBattle("BRA","PER","defense")');
    assert.strictEqual(g.win.eval('isCoastalTerritory("PER")'),false);
    assert.strictEqual(g.win.eval('B.S["1"].relicDamageTakenMult'),1,"no protege territorio interior");
    assert.strictEqual(g.win.eval('getActiveRelicEffect(currentRelicState(),"AG",{battleType:"boss",role:"defender",territoryId:"CAN"})'),null,"no funciona en boss");

    g.win.eval(`closeRelicBattle();monsterState.rewards=[getMonsterReward("kraken","SO","CAN",8)];
      F.AG.equippedRelic="perla_abismo";T.CAN.owner="AG";T.EUN.owner="CO";openBattle("EUN","CAN","defense")`);
    assert.strictEqual(g.win.eval('B.S["1"].relicDamageTakenMult'),1,"una reliquia ajena no aplica");

    g.win.eval(`closeRelicBattle();monsterState.rewards=[getMonsterReward("amaru","AG","PER",8)];
      F.AG.equippedRelic="escama_amaru";F.AG.heroes[0]="leonidas";T.CAN.owner="AG";T.EUN.owner="CO";
      openBattle("CAN","EUN","attack");spawnChamp("1")`);
    const heroMax=g.win.eval('B.units.find(u=>u.heroId==="leonidas").max');
    const baseMax=g.win.eval('unitStats("champ",F.AG.era,0,F.AG.heroWeaponLv).hp');
    assert.ok(Math.abs(heroMax/baseMax-1.1)<1e-9,"Escama otorga +10% PV máximos");
    assert.ok(g.win.eval('B.S["1"].relicUses.escama_amaru.contexts.includes("héroe")'),"marca el uso del héroe");
    assert.ok(g.win.eval('(B.banner&&B.banner.txt.includes("Escama de Amaru"))||B.bannerQueue.some(x=>x.txt.includes("Escama de Amaru"))'));
    assert.strictEqual(g.win.eval(`(()=>{Math.random=()=>0.5;const boosted=B.units.find(u=>u.heroId==="leonidas"),plain=mkUnit(1,"champ",F.AG.era,0,F.AG.heroWeaponLv);plain.heroId="leonidas";return heroDuelPower(boosted,"1")===heroDuelPower(plain,"1")})()`),true,"no altera PoderDuelo");
    assert.strictEqual(g.win.eval('F.AG.heroHp'),undefined,"no crea heridas ni PV persistentes");

    g.win.eval(`closeRelicBattle();monsterState.active=createMonsterState("kraken","CAN",6,0);round=6;T.CAN.owner="AG";T.CAN.troops=12;
      openBossBattle("AG","CAN");spawnChamp("1")`);
    assert.ok(Math.abs(g.win.eval('B.units.find(u=>u.heroId==="leonidas").max')-baseMax)<1e-9,"Escama no funciona en boss");

    g.win.eval('closeRelicBattle();monsterState.active=null');
    assert.strictEqual(g.win.eval('RELICS.perla_abismo.effectReady&&RELICS.escama_amaru.effectReady'),true);
  }finally{closeGame(g);}
});

/* 40 (Fase 3C-3C). Aliento limita su primera oleada y Ankh recupera
   defensores una vez por ronda con persistencia v6. */
test("Reliquias 3C-3C: Aliento ofensivo y Ankh tras defensa", async () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");
      function closeRelicBattle2(){if(B)B.over=true;B=null;inBattle=false;document.getElementById("battle").style.display="none";}
      F.AG.era=2;monsterState.rewards=[getMonsterReward("long","AG","CHN",8)];F.AG.equippedRelic="aliento_long";
      T.CAN.owner="AG";T.EUN.owner="CO";openBattle("CAN","EUN","attack");B.S["1"].gold=999;`);
    assert.strictEqual(g.win.eval('B.S["1"].relicOffensiveUnitsRemaining'),3);
    g.win.eval('spawnUnit("1","healer")');
    assert.strictEqual(g.win.eval('B.S["1"].relicOffensiveUnitsRemaining'),3,"sanador no consume la oleada");
    assert.strictEqual(g.win.eval('B.units.find(u=>u.kind==="healer").relicDamageBonus'),undefined);
    g.win.eval('spawnUnit("1","melee");spawnUnit("1","ranged");spawnUnit("1","air");spawnUnit("1","heavy")');
    const boosted=Array.from(g.win.eval('B.units.filter(u=>u.relicDamageBonus).map(u=>u.kind)'));
    assert.deepStrictEqual(boosted,["melee","ranged","air"],"afecta exactamente las primeras tres elegibles");
    assert.ok(g.win.eval('B.S["1"].relicUses.aliento_long.contexts.includes("ataque")'),"marca el uso ofensivo");
    assert.strictEqual(g.win.eval('B.S["1"].relicOffensiveUnitsRemaining'),0);
    assert.strictEqual(g.win.eval('B.units.find(u=>u.kind==="heavy").relicDamageBonus'),undefined,"la cuarta queda normal");
    assert.ok(Math.abs(g.win.eval('B.units.find(u=>u.kind==="air").dmg/unitStats("air",2,0).dmg')-1.1)<1e-9,"aéreas reciben el mismo 10%, no uno especial");
    assert.ok(g.win.eval('(B.banner&&B.banner.txt.includes("Aliento del Long"))||B.bannerQueue.some(x=>x.txt.includes("Aliento del Long"))'));

    g.win.eval('closeRelicBattle2();openBattle("EUN","CAN","defense");B.S["1"].gold=999;spawnUnit("1","melee")');
    assert.strictEqual(g.win.eval('B.units[0].relicDamageBonus'),undefined,"no funciona al defender");
    g.win.eval('closeRelicBattle2();openBattle("CAN","EUN","attack");B.S["1"].gold=999;B.duel={resolved:false};spawnUnit("1","melee")');
    assert.strictEqual(g.win.eval('B.units[0].relicDamageBonus'),undefined,"no funciona durante duelo");
    assert.strictEqual(g.win.eval('B.S["1"].relicOffensiveUnitsRemaining'),3,"duelo no consume cargas");
    assert.strictEqual(g.win.eval('getActiveRelicEffect(currentRelicState(),"AG",{battleType:"boss",role:"attacker"})'),null,"no funciona en boss");

    g.win.eval(`closeRelicBattle2();monsterState.rewards=[getMonsterReward("long","SO","CHN",8)];
      F.AG.equippedRelic="aliento_long";openBattle("CAN","EUN","attack")`);
    assert.strictEqual(g.win.eval('B.S["1"].relicOffensiveUnitsRemaining'),0,"reliquia ajena no aplica");
    g.win.eval('closeRelicBattle2();F.AG.equippedRelic=null;openBattle("CAN","EUN","attack");B.S["1"].gold=999;spawnUnit("1","melee")');
    assert.strictEqual(g.win.eval('B.units[0].relicDamageBonus'),undefined,"sin reliquia mantiene daño anterior");

    g.win.eval(`closeRelicBattle2();monsterState.rewards=[getMonsterReward("anubis","AG","MAG",9)];
      F.AG.equippedRelic="ankh_anubis";F.AG.ankhUsedRound=null;round=10;`);
    assert.strictEqual(g.win.eval('applyAnkhRecovery(currentRelicState(),"AG",{battleType:"normal",role:"attacker",won:true,round:10,troopsBefore:24,troopsAfter:4})'),0,"no funciona al atacar");
    assert.strictEqual(g.win.eval('applyAnkhRecovery(currentRelicState(),"AG",{battleType:"normal",role:"defender",won:false,round:10,troopsBefore:24,troopsAfter:4})'),0,"no funciona al perder");
    assert.strictEqual(g.win.eval('applyAnkhRecovery(currentRelicState(),"AG",{battleType:"normal",role:"defender",won:true,duel:true,round:10,troopsBefore:24,troopsAfter:4})'),0,"no funciona en duelo");
    assert.strictEqual(g.win.eval('applyAnkhRecovery(currentRelicState(),"AG",{battleType:"boss",role:"defender",won:true,round:10,troopsBefore:24,troopsAfter:4})'),0,"no funciona en boss");

    g.win.eval('T.CAN.troops=24;T.CAN.owner="AG";T.EUN.owner="CO";openBattle("EUN","CAN","defense");B.units=[mkUnit(1,"melee",0,0),mkUnit(1,"ranged",0,0)];finishBattle(true)');
    await sleep(1700);
    assert.strictEqual(g.win.eval('T.CAN.troops'),7,"recupera 3 sobre 20 pérdidas y respeta el máximo");
    assert.strictEqual(g.win.eval('F.AG.ankhUsedRound'),10);
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Ankh de Anubis recuperó 3"))'),"feedback causal");
    assert.strictEqual(g.win.eval('balanceSession.relics.ankh_anubis.uses'),1,"registra el uso real del Ankh");

    const saved=g.win.eval('saveGame()');
    g.win.eval('F.AG.ankhUsedRound=null;loadGame('+JSON.stringify(saved)+')');
    assert.strictEqual(g.win.eval('F.AG.ankhUsedRound'),10,"save v6 conserva la ronda de uso");
    assert.strictEqual(g.win.eval('applyAnkhRecovery(currentRelicState(),"AG",{battleType:"normal",role:"defender",won:true,round:10,troopsBefore:20,troopsAfter:0})'),0,"no activa dos veces en la misma ronda");
    g.win.eval('round=11');
    assert.strictEqual(g.win.eval('applyAnkhRecovery(currentRelicState(),"AG",{battleType:"normal",role:"defender",won:true,round:11,troopsBefore:11,troopsAfter:4})'),1,"15% redondeado recupera una tropa");

    assert.ok(g.win.eval('Object.values(RELICS).every(r=>r.effectReady)'),"las cuatro reliquias tienen efecto activo");
  }finally{closeGame(g);}
});

/* 41 (Fase 3C-4). La IA elige solo reliquias propias durante su ventana
   de inicio, conserva un único slot y usa los mismos efectos. */
test("Reliquias 3C-4: elección IA simétrica, causal y persistente", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");phase="ai";relicChangeOpen=false;
      aiRelicChangeEmpire="SO";turnSummaryLines=[];monsterState.rewards=[];`);
    assert.strictEqual(g.win.eval('chooseAIRelic(currentRelicState(),"SO")'),null,"sin reliquias no elige");
    assert.strictEqual(g.win.eval('applyAIRelicChoice(currentRelicState(),"SO")'),false);

    g.win.eval('monsterState.rewards=[getMonsterReward("amaru","AG","PER",8)];F.SO.heroes[0]="anibal"');
    assert.strictEqual(g.win.eval('applyAIRelicChoice(currentRelicState(),"SO")'),false,"no equipa recompensa ajena");
    assert.strictEqual(g.win.eval('F.SO.equippedRelic'),null);

    g.win.eval('monsterState.rewards.push(getMonsterReward("amaru","SO","PER",8))');
    assert.strictEqual(g.win.eval('applyAIRelicChoice(currentRelicState(),"SO")'),true,"equipa una reliquia propia");
    assert.strictEqual(g.win.eval('F.SO.equippedRelic'),"escama_amaru");
    assert.strictEqual(g.win.eval('turnSummaryLines.filter(x=>x.m.includes("Escama de Amaru")).length'),1,"registra un cambio real");
    assert.strictEqual(g.win.eval('applyAIRelicChoice(currentRelicState(),"SO")'),false,"no reequipa lo mismo");
    assert.strictEqual(g.win.eval('turnSummaryLines.filter(x=>x.m.includes("Escama de Amaru")).length'),1,"no duplica la línea causal");

    g.win.eval(`monsterState.rewards.push(getMonsterReward("long","SO","CHN",8));
      (()=>{const from=ownedBy("SO").find(id=>ADJ[id].some(x=>T[x].owner!=="SO"));
        const to=ADJ[from].find(x=>T[x].owner!=="SO");T[from].troops=30;T[to].troops=2;})();`);
    assert.strictEqual(g.win.eval('chooseAIRelic(currentRelicState(),"SO")'),"aliento_long","el contexto ofensivo justifica el cambio");
    assert.strictEqual(g.win.eval('applyAIRelicChoice(currentRelicState(),"SO")'),false,"no cambia dos veces en la misma ronda");
    g.win.eval('round++');
    assert.strictEqual(g.win.eval('applyAIRelicChoice(currentRelicState(),"SO")'),true);
    assert.strictEqual(g.win.eval('F.SO.equippedRelic'),"aliento_long","el slot reemplaza la anterior");
    assert.strictEqual(g.win.eval('typeof F.SO.equippedRelic'),"string","mantiene un solo slot");
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Aliento del Long")&&x.m.includes("ofensivas"))'));

    g.win.eval('aiRelicChangeEmpire=null');
    assert.strictEqual(g.win.eval('canChangeRelic(currentRelicState(),"SO")'),false,"fuera de la ventana no puede cambiar");
    assert.strictEqual(g.win.eval('equipRelic(currentRelicState(),"SO","escama_amaru")'),false);

    const saved=g.win.eval('saveGame()');
    g.win.eval('F.SO.equippedRelic=null;loadGame('+JSON.stringify(saved)+')');
    assert.strictEqual(g.win.eval('F.SO.equippedRelic'),"aliento_long","guardar/cargar conserva la elección IA");

    g.win.eval(`monsterState.rewards.push(getMonsterReward("long","AG","CHN",8));
      F.AG.equippedRelic="aliento_long";phase="play";player="AG";relicChangeOpen=true;`);
    assert.strictEqual(g.win.eval(`JSON.stringify(getActiveRelicEffect(currentRelicState(),"SO",{battleType:"normal",role:"attacker",duel:false}))`),
      g.win.eval(`JSON.stringify(getActiveRelicEffect(currentRelicState(),"AG",{battleType:"normal",role:"attacker",duel:false}))`),
      "IA y jugador reciben exactamente el mismo efecto");
  }finally{closeGame(g);}
});

/* 42 (Fase 3C-5). Modo Balance mide equipamiento, activación, contexto,
   resultado y propietario sin ajustar reglas; la ayuda explica 3C. */
test("Reliquias 3C-5: telemetría pasiva y tutorial completo", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");resetBalanceSession();
      function relicTelemetryBattle(fac,id,contexts,win=true,retreat=false){
        const blank={fac:"CO",spawnedTypes:{},damageByType:{},heroSpawned:false,relicUses:{}};
        const own={fac,relicEquippedId:id,spawnedTypes:{},damageByType:{},heroSpawned:false,relicUses:{}};
        markBattleRelicUse(own,id,contexts);const b={time:80,S:{"1":own,"-1":blank}};
        recordBalanceBattle(b,win);recordBalanceRelicBattle(b,win,retreat);
      }
      relicTelemetryBattle("AG","perla_abismo",["defensa","costa"],true,false);
      relicTelemetryBattle("CO","escama_amaru",["ataque","héroe"],false,false);
      relicTelemetryBattle("AG","aliento_long",["ataque"],false,true);
      relicTelemetryBattle("CO","ankh_anubis",["defensa","defensa ganada"],true,false);`);
    const data=JSON.parse(g.win.eval('exportBalanceJSON()')).partida;
    assert.strictEqual(data.reliquiasEquipadasPorImperio.AG.perla_abismo,1,"registra reliquia equipada por imperio");
    assert.strictEqual(data.reliquias.perla_abismo.usos,1);
    assert.strictEqual(data.reliquias.escama_amaru.contextos["héroe"],1);
    assert.strictEqual(data.reliquias.aliento_long.resultados.retiradas,1);
    assert.strictEqual(data.reliquias.ankh_anubis.contextos["defensa ganada"],1);
    assert.strictEqual(data.reliquias.perla_abismo.propietarios.jugador,1,"distingue jugador");
    assert.strictEqual(data.reliquias.escama_amaru.propietarios.IA,1,"distingue IA");
    assert.ok(g.win.eval(`(()=>{const d=emptyBalanceData();d.relics.perla_abismo={uses:5,wins:4,losses:1,retreats:0,owners:{jugador:5,IA:0},contexts:{costa:5}};return balanceBenchmarks(d).some(x=>x.includes("parece dominar"))})()`),"solo advierte, no autoajusta");

    const before=g.win.eval('JSON.stringify({relics:RELICS,F:F,T:T})');
    g.win.eval('renderBalancePanel()');
    assert.strictEqual(g.win.eval('JSON.stringify({relics:RELICS,F:F,T:T})'),before,"medir y renderizar no cambia balance ni estado");
    assert.ok(g.doc.getElementById("balanceBody").textContent.includes("reliquiasEquipadasPorImperio"));

    const help=g.doc.getElementById("quickHelp").textContent;
    for(const text of["slot único","garantiza su reliquia base","efectos no se acumulan","Perla del Abismo","Escama de Amaru","Aliento del Long","Ankh de Anubis"])
      assert.ok(help.includes(text),`la ayuda debe mencionar: ${text}`);
    assert.ok(help.includes("Rarezas, combos")&&help.includes("segundo slot no existen actualmente"));
  }finally{closeGame(g);}
});

/* 43 (QA 3C-6). La ruta rápida de reclutamiento básico de la IA
   conserva el mismo Aliento del Long que spawnUnit(). */
test("QA 3C-6: Aliento también potencia unidades básicas de IA", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");monsterState.rewards=[getMonsterReward("long","CO","CHN",8)];
      F.CO.equippedRelic="aliento_long";T.CAN.owner="AG";T.EUN.owner="CO";openBattle("EUN","CAN","defense");
      B.S["-1"].gold=999;B.S["-1"].cool.spec=99;B.S["-1"].cool.champ=99;B.S["-1"].cool.siege=99;B.eCool=0;
      Math.random=()=>0;enemyAI(0.1);`);
    const unit=g.win.eval('B.units.find(u=>u.side===-1&&["melee","ranged","heavy"].includes(u.kind))');
    assert.ok(unit,"la IA recluta una unidad básica");
    assert.strictEqual(unit.relicDamageBonus,0.10,"recibe el mismo +10% del jugador");
    assert.strictEqual(g.win.eval('B.S["-1"].relicOffensiveUnitsRemaining'),2,"consume una de las tres cargas");
    assert.ok(g.win.eval('B.S["-1"].relicUses.aliento_long.contexts.includes("ataque")'),"registra la activación IA");
  }finally{closeGame(g);}
});

/* 44 (Fase 3F-1). Matriz aprobada disponible como datos y helpers;
   counterMult() conserva el balance efectivo anterior hasta 3F-2. */
test("Counters 3F-1: matriz declarativa completa sin alterar combate", () => {
  const g=makeGame();
  try{
    const types=JSON.parse(g.win.eval("JSON.stringify(COUNTER_TYPES)"));
    assert.deepStrictEqual(types,["melee","ranged","heavy","healer","siege","air"]);
    const expected={
      melee: {melee:1,ranged:1.5,heavy:0.75,healer:1,siege:1.5,air:0},
      ranged:{melee:0.75,ranged:1,heavy:1.5,healer:1,siege:1,air:1.5},
      heavy: {melee:1.5,ranged:0.75,heavy:1,healer:1,siege:1,air:0},
      healer:{melee:0,ranged:0,heavy:0,healer:0,siege:0,air:0},
      siege: {melee:1,ranged:1,heavy:1,healer:1,siege:1,air:0},
      air:   {melee:1,ranged:1,heavy:1.5,healer:1,siege:1.5,air:1}
    };
    assert.deepStrictEqual(JSON.parse(g.win.eval("JSON.stringify(COUNTER_MATRIX)")),expected,"contiene exactamente los 36 cruces aprobados");
    for(const attacker of types)for(const defender of types)
      assert.strictEqual(g.win.eval(`getCounterMultiplier("${attacker}","${defender}")`),expected[attacker][defender]);
    assert.strictEqual(g.win.eval('canTargetKind("melee","air")'),false);
    assert.strictEqual(g.win.eval('canTargetKind("heavy","air")'),false);
    assert.strictEqual(g.win.eval('canTargetKind("siege","air")'),false);
    assert.strictEqual(g.win.eval('canTargetKind("healer","melee")'),false,"sanador no ataca");
    assert.strictEqual(g.win.eval('getStructureMultiplier("air")'),0.75);
    assert.strictEqual(g.win.eval('getStructureMultiplier("siege")'),1);
    assert.strictEqual(g.win.eval('getCounterMultiplier("hero","heavy")'),0.85);
    assert.strictEqual(g.win.eval('getCounterMultiplier("ranged","hero")'),1);
    assert.deepStrictEqual(JSON.parse(g.win.eval('JSON.stringify(getStrongTargets("ranged"))')),["heavy","air"]);
    assert.deepStrictEqual(JSON.parse(g.win.eval('JSON.stringify(getWeakAgainst("siege"))')),["melee","air"]);
    const siege=JSON.parse(g.win.eval('JSON.stringify(getCounterDescription("siege"))'));
    assert.strictEqual(siege.role,"indirect");assert.strictEqual(siege.minRange,80);
    assert.deepStrictEqual(siege.suppressedBy,["melee"]);
    assert.strictEqual(g.win.eval('counterMult({kind:"melee"},{kind:"ranged"})'),1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"ranged"},{kind:"melee"})'),0.75,"el combate usa la matriz 3F");
  }finally{closeGame(g);}
});

/* 45 (Fase 3F-2). El motor consume una sola vez la matriz y mantiene fuera
   duelo, boss y salpicadura secundaria. */
test("Counters 3F-2: aplicación centralizada y exclusiones", () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");T.EUN.owner="CO";openBattle("CAN","EUN","attack")');
    assert.strictEqual(g.win.eval('counterMult({kind:"ranged"},{kind:"melee"})'),0.75);
    assert.strictEqual(g.win.eval('counterMult({kind:"ranged"},{kind:"air"})'),1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"air"},{kind:"heavy"})'),1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"air"},{kind:"siege"})'),1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"melee"},{kind:"siege"})'),1.5);
    assert.strictEqual(g.win.eval('counterMult({kind:"champ"},{kind:"heavy"})'),0.85);
    assert.strictEqual(g.win.eval('counterMult({kind:"ranged"},{kind:"champ"})'),1);
    for(const kind of["melee","heavy","siege"])
      assert.strictEqual(g.win.eval(`canTargetKind("${kind}","air")`),false);

    // Daño a estructura: misma unidad base y sin otros modificadores.
    g.win.eval(`B.units=[];B.pacing.muerteSubita=false;B.S["1"].dmgBuffAllT=0;
      B.airBase=mkUnit(1,"air",0,0);B.airBase.x=W-70;B.airBase.t=0;B.units=[B.airBase];
      B.eHP=1000;B.last=100;`);
    const airBefore=g.win.eval('B.eHP'),airDmg=g.win.eval('B.airBase.dmg');
    g.win.eval('bloop(150)');
    {const dealt=airBefore-g.win.eval('B.eHP');assert.ok(Math.abs(dealt-airDmg*0.75)<0.01,
      `aérea aplica ×0.75 a base (observado ${dealt}, esperado ${airDmg*0.75})`);}

    g.win.eval(`B.units=[];B.siegeBase=mkUnit(1,"siege",0,0);B.siegeBase.x=W-158;
      B.siegeBase.t=0;B.units=[B.siegeBase];B.eHP=1000;B.last=100;`);
    const siegeBefore=g.win.eval('B.eHP'),siegeDmg=g.win.eval('B.siegeBase.dmg');
    g.win.eval('bloop(150)');
    assert.ok(Math.abs((siegeBefore-g.win.eval('B.eHP'))-siegeDmg)<0.01,"asedio conserva ×1 contra base");

    // Salpicadura queda neutral: no consulta counterMult para el secundario.
    const source=fs.readFileSync(path.join(__dirname,"..","src","09-batalla.js"),"utf8");
    const splash=source.match(/const nearby=B\.units\.filter\(v=>v!==tgt[\s\S]*?if\(u\.heroId===/)[0];
    assert.ok(!splash.includes("counterMult("),"salpicadura no duplica el counter");
    assert.strictEqual(g.win.eval('getCounterMultiplier("champ","heavy",{duel:true})'),1,"duelo excluido");
    assert.strictEqual(g.win.eval('getCounterMultiplier("air","heavy",{battleType:"boss"})'),1,"boss excluido");
    assert.strictEqual(g.win.eval('getStructureMultiplier("air",{battleType:"boss"})'),1,"boss conserva daño estructural");
  }finally{closeGame(g);}
});

/* 46 (Fase 3F-3). La metadata alimenta botones y ayuda; los avisos de
   ventaja/desventaja aparecen una sola vez y quedan fuera de duelo/boss. */
test("Counters 3F-3: claridad compacta y avisos causales", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");F.AG.era=2;F.AG.heroes[0]="anibal";
      T.EUN.owner="CO";openBattle("CAN","EUN","attack")`);
    const buttonText=kind=>g.win.eval(`B.btnRefs.find(r=>r.side==="1"&&r.kind==="${kind}").el.textContent`);
    const melee=buttonText("melee"),ranged=buttonText("ranged"),heavy=buttonText("heavy");
    assert.ok(melee.includes("Vence a")&&melee.includes("Débil contra")&&melee.includes("No alcanza"));
    assert.ok(ranged.includes("Vence a")&&ranged.includes("Débil contra"));
    assert.ok(heavy.includes("No alcanza")&&heavy.includes("Resiste Héroe"));
    assert.ok(buttonText("healer").includes("No ataca"));
    assert.ok(buttonText("siege").includes("Melee <80 px lo anula"));
    assert.ok(buttonText("air").includes("Estructuras: ×0.75"));
    assert.ok(buttonText("champ").includes("Especial")&&buttonText("champ").includes("Pesada resiste"));
    assert.ok(g.win.eval('B.btnRefs.filter(r=>r.side==="1"&&["melee","ranged","heavy","healer","siege","air","champ"].includes(r.kind)).every(r=>r.el.title&&r.el.getAttribute("aria-label"))'));

    const help=g.doc.getElementById("quickHelp").textContent;
    for(const text of["Counters","Distancia es su counter natural","Melee dentro de 80 px","Pesada recibe solo ×0.85","Aérea ×0.75"])
      assert.ok(help.includes(text),`la ayuda debe explicar: ${text}`);

    g.win.eval(`B.units=[];B.banner=null;B.bannerQueue=[];B.counterNotices={};B.eCool=999;
      B.good=mkUnit(1,"melee",0,0);B.good.x=200;B.good.t=0;
      B.bad=mkUnit(-1,"ranged",0,0);B.bad.x=220;B.bad.t=0;
      B.units=[B.good,B.bad];B.last=100;bloop(150);`);
    assert.ok(g.win.eval('B.dmgs.some(d=>String(d.txt).startsWith("▲"))'),"golpe favorable muestra ▲");
    assert.ok(g.win.eval('B.dmgs.some(d=>String(d.txt).startsWith("▼"))'),"golpe desfavorable muestra ▼");
    assert.strictEqual(g.win.eval('Object.keys(B.counterNotices).length'),2);
    const noticesBefore=g.win.eval('(B.banner?1:0)+B.bannerQueue.length');
    g.win.eval('B.good.t=0;B.bad.t=0;B.last=200;bloop(250)');
    assert.strictEqual(g.win.eval('(B.banner?1:0)+B.bannerQueue.length'),noticesBefore,"no repite el mismo matchup");

    assert.strictEqual(g.win.eval('announceCounterOnce({kind:"champ"},{kind:"champ"},1.5)'),false,"duelo no anuncia counters");
    g.win.eval('B.mode="boss"');
    assert.strictEqual(g.win.eval('announceCounterOnce({kind:"air"},{kind:"heavy"},1.5)'),false,"boss no anuncia counters");
  }finally{closeGame(g);}
});

/* 47 (Fase 3F-4). El Modo Balance consolida matchups y estructuras sin
   intervenir en reglas, y mantiene compatibilidad con datos anteriores. */
test("Counters 3F-4: telemetría de matchups y estructuras", () => {
  const g=makeGame();
  try{
    g.win.eval(`startGame(1);clickTerr("CAN");resetBalanceSession();T.EUN.owner="CO";
      openBattle("CAN","EUN","attack");B.S["1"].relicEquippedId="aliento_long";
      B.r=mkUnit(1,"ranged",2,0);B.a=mkUnit(-1,"air",2,0);B.m=mkUnit(1,"melee",2,0);B.er=mkUnit(-1,"ranged",2,0);
      recordBattleCounterHit(B,B.r,B.a,1.5,30,true);
      recordBattleCounterHit(B,B.er,B.m,0.75,12,false);
      recordBattleCounterHit(B,B.a,B.a,1,8,false);
      recordBattleStructureHit(B,B.a,18);
      recordBattleStructureHit(B,mkUnit(1,"siege",2,0),25);
      recordUnableToAttack(B,B.m,"air");recordUnableToAttack(B,mkUnit(1,"heavy",2,0),"air");
      recordBalanceBattle(B,true,false);`);
    const view=JSON.parse(g.win.eval('exportBalanceJSON()')).partida;
    assert.strictEqual(view.matchups["ranged→air"].categoria,"favorable");
    assert.strictEqual(view.matchups["ranged→air"].multiplicador,1.5);
    assert.strictEqual(view.matchups["ranged→air"].danoTotal,30);
    assert.strictEqual(view.matchups["ranged→air"].danoPromedio,30);
    assert.strictEqual(view.matchups["ranged→air"].bajas,1);
    assert.strictEqual(view.matchups["ranged→air"].propietariosAtacante.jugador,1);
    assert.strictEqual(view.matchups["ranged→air"].propietariosDefensor.IA,1);
    assert.strictEqual(view.matchups["ranged→air"].reliquias.aliento_long,1);
    assert.strictEqual(view.matchups["ranged→melee"].categoria,"desfavorable");
    assert.strictEqual(view.matchups["air→air"].categoria,"neutral");
    assert.strictEqual(view.danoEstructurasPorTipo.air.danoTotal,18);
    assert.strictEqual(view.danoEstructurasPorTipo.siege.danoTotal,25);
    assert.strictEqual(view.danoEstructurasPorTipo.healer.danoTotal,0,"sanador figura siempre con cero");
    assert.strictEqual(view.unidadesSinObjetivo["melee→air"].uses,1);
    assert.strictEqual(view.unidadesSinObjetivo["heavy→air"].uses,1);
    assert.ok(view.composiciones&&typeof view.composiciones==="object");

    const exported=JSON.parse(g.win.eval('exportBalanceJSON()'));
    assert.ok(exported.partida.matchups&&exported.partida.danoEstructurasPorTipo,"JSON exporta 3F-4");
    g.win.localStorage.setItem("IDM_BALANCE_V1",JSON.stringify({battles:{count:1,durationTotal:80},games:{count:0,durationTotal:0}}));
    assert.doesNotThrow(()=>g.win.eval('balanceView(loadBalanceTotal())'),"datos antiguos se normalizan");

    assert.strictEqual(g.win.eval('recordBattleCounterHit({...B,mode:"boss"},B.r,B.a,1.5,20,true)'),false,"boss excluido");
    assert.strictEqual(g.win.eval('recordBattleCounterHit(B,{...B.r,kind:"champ"},{...B.a,kind:"champ"},1.5,20,true)'),false,"duelo excluido");
    const before=g.win.eval('JSON.stringify(COUNTER_MATRIX)');g.win.eval('balanceBenchmarks(loadBalanceTotal())');
    assert.strictEqual(g.win.eval('JSON.stringify(COUNTER_MATRIX)'),before,"telemetría no autoajusta la matriz");
  }finally{closeGame(g);}
});

/* 48 (Fase 3D-1). Capacidad poblacional y validación de reclutamiento
   disponibles como modelo puro, todavía sin alterar el botón real. */
test("Recursos 3D-1: capacidad y reclutamiento estratégico declarativos", () => {
  const g=makeGame();
  try{
    const cfg=JSON.parse(g.win.eval("JSON.stringify(STRATEGIC_RECRUITMENT)"));
    assert.deepStrictEqual(cfg,{baseAmount:4,baseCost:{gold:12,food:5},maxPerEmpireTurn:2,
      maxPerTerritoryTurn:1,localPopulationBonus:4,localBaseBonus:4});
    g.win.eval(`T={
      A:{owner:"AG",pop:10,troops:8,base:0},B:{owner:"AG",pop:12,troops:7,base:1},
      C:{owner:"CO",pop:20,troops:6,base:3}};
      F={AG:{gold:40,food:20},CO:{gold:40,food:20}};`);
    assert.strictEqual(g.win.eval('getEmpirePopulationCapacity({T,F},"AG")'),22,"suma solo población propia");
    assert.strictEqual(g.win.eval('getEmpireTroopsUsed({T,F},"AG")'),15,"suma solo tropas propias");
    assert.strictEqual(g.win.eval('getEmpireAvailableCapacity({T,F},"AG")'),7);
    assert.strictEqual(g.win.eval('getTerritoryTroopCapacity(T.A)'),14,"sin base: población + 4");
    assert.strictEqual(g.win.eval('getTerritoryTroopCapacity(T.B)'),20,"base 1: población + 4 + 4");
    assert.strictEqual(g.win.eval('getTerritoryTroopCapacity(T.C)'),36,"base 3: población + 4 + 12");
    assert.strictEqual(g.win.eval('getTerritoryAvailableCapacity(T.A)'),6);
    assert.strictEqual(g.win.eval('canRecruitStrategicTroops({T,F},"AG","A",4)'),true,"bajo capacidad puede reclutar");

    const partial=JSON.parse(g.win.eval('JSON.stringify((()=>{T.A.troops=12;return recruitmentEvaluation({T,F},"AG","A",4)})())'));
    assert.strictEqual(partial.actualAmount,2,"recluta solo los espacios locales disponibles");
    assert.deepStrictEqual(partial.cost,{amount:2,gold:6,food:3},"coste parcial proporcional redondeado hacia arriba");
    assert.deepStrictEqual(JSON.parse(g.win.eval('JSON.stringify(getRecruitmentCostForAmount(3))')),{amount:3,gold:9,food:4});

    g.win.eval('T.A.troops=14');
    assert.strictEqual(g.win.eval('canRecruitStrategicTroops({T,F},"AG","A",4)'),false);
    assert.ok(g.win.eval('getRecruitmentBlockReason({T,F},"AG","A",4).includes("local")'));
    g.win.eval('T.A.troops=8;T.B.troops=14');
    assert.strictEqual(g.win.eval('getEmpireAvailableCapacity({T,F},"AG")'),0,"capacidad completa queda en cero");
    assert.ok(g.win.eval('getRecruitmentBlockReason({T,F},"AG","A",4).includes("completa")'));
    g.win.eval('T.B.troops=16');
    assert.strictEqual(g.win.eval('getEmpireAvailableCapacity({T,F},"AG")'),0,"sobre capacidad no produce disponibilidad negativa");
    assert.strictEqual(g.win.eval('getEmpireTroopsUsed({T,F},"AG")'),24,"no borra tropas existentes");
    assert.ok(g.win.eval('getRecruitmentBlockReason({T,F},"AG","A",4).includes("sobre")'));

    g.win.eval('T.B.troops=7');
    const empireLimit=g.win.eval('getRecruitmentLimitState({T,F,recruitment:{byEmpire:{AG:2},byTerritory:{}}},"AG","A")');
    assert.strictEqual(empireLimit.empireRecruitments,2);assert.strictEqual(empireLimit.maxRecruitable,0);
    assert.ok(g.win.eval('getRecruitmentBlockReason({T,F,recruitment:{byEmpire:{AG:2},byTerritory:{}}},"AG","A",4).includes("2 reclutamientos")'));
    const territoryLimit=g.win.eval('getRecruitmentLimitState({T,F,recruitmentState:{byEmpire:{AG:1},byTerritory:{A:1}}},"AG","A")');
    assert.strictEqual(territoryLimit.territoryRecruitments,1);assert.strictEqual(territoryLimit.maxRecruitable,0);
    assert.ok(g.win.eval('getRecruitmentBlockReason({T,F,recruitmentState:{byEmpire:{AG:1},byTerritory:{A:1}}},"AG","A",4).includes("ya reclutó")'));

    assert.strictEqual(g.win.eval('typeof applyStrategicRecruitment'),"function","el modelo expone una ejecución común para 3D-2");
  }finally{closeGame(g);}
});

/* 49 (Fase 3D-2). Jugador e IA consumen la misma ejecución, los límites se
   reinician por ronda y save v7 evita eludirlos mediante recarga. */
test("Recursos 3D-2: reclutamiento limitado, simétrico y persistente", () => {
  const g=makeGame();
  try{
    g.win.eval('startGame(1);clickTerr("CAN");F.AG.gold=100;F.AG.food=100;selected="CAN";render()');
    const before=g.win.eval('T.CAN.troops');
    let button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button&&!button.disabled,"el jugador puede reclutar con capacidad");button.click();
    assert.strictEqual(g.win.eval('T.CAN.troops'),before+4);assert.strictEqual(g.win.eval('F.AG.gold'),88);assert.strictEqual(g.win.eval('F.AG.food'),95);
    assert.strictEqual(g.win.eval('recruitmentState.byEmpire.AG'),1);assert.strictEqual(g.win.eval('recruitmentState.byTerritory.CAN'),1);
    button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.disabled&&button.textContent.includes("ya reclutó"),"no permite repetir territorio");

    g.win.eval('selected="USA";render()');button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button&&!button.disabled);button.click();assert.strictEqual(g.win.eval('recruitmentState.byEmpire.AG'),2);
    g.win.eval('selected="MEX";render()');button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.disabled&&button.textContent.includes("2 reclutamientos"),"límite imperial visible");

    g.win.eval('recruitmentState=emptyRecruitmentState(round);ownedBy("AG").forEach(id=>T[id].troops=1);T.CAN.troops=getTerritoryTroopCapacity(T.CAN);selected="CAN";render()');
    button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.disabled&&button.textContent.includes("local completa"),"territorio lleno queda bloqueado");
    g.win.eval('T.CAN.troops=8;ownedBy("AG").forEach(id=>T[id].troops=T[id].pop);selected="CAN";render()');
    button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.disabled&&button.textContent.includes("imperial completa"),"capacidad imperial queda bloqueada");
    g.win.eval('T.CAN.troops++');const troopsBefore=g.win.eval('T.CAN.troops');g.win.eval('render()');
    assert.strictEqual(g.win.eval('T.CAN.troops'),troopsBefore,"estar sobre capacidad no borra tropas");

    g.win.eval('ownedBy("AG").forEach(id=>T[id].troops=1);T.CAN.troops=getTerritoryTroopCapacity(T.CAN)-2;F.AG.gold=20;F.AG.food=20;recruitmentState=emptyRecruitmentState(round);selected="CAN";render()');
    button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.textContent.includes("parcial")&&button.textContent.includes("+2"));button.click();
    assert.strictEqual(g.win.eval('F.AG.gold'),14);assert.strictEqual(g.win.eval('F.AG.food'),17,"cobra 6 oro y 3 comida");
    assert.ok(g.win.eval('document.getElementById("log").textContent.includes("Reclutamiento parcial: +2")'));

    g.win.eval('recruitmentState=emptyRecruitmentState(round);T.CAN.troops=1;F.AG.gold=0;F.AG.food=20;selected="CAN";render()');
    button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.disabled&&button.textContent.includes("Falta oro"));
    g.win.eval('F.AG.gold=20;F.AG.food=0;render()');button=Array.from(g.doc.querySelectorAll("#terrBtns button")).find(b=>b.textContent.includes("Reclutar"));
    assert.ok(button.disabled&&button.textContent.includes("Falta comida"));

    // La IA usa applyStrategicRecruitment y busca otro territorio si uno está lleno.
    g.win.eval(`recruitmentState=emptyRecruitmentState(round);F.CO.gold=100;F.CO.food=100;
      const co=ownedBy("CO");co.forEach(id=>T[id].troops=1);T[co[0]].troops=getTerritoryTroopCapacity(T[co[0]]);
      applyStrategicRecruitment(currentStrategicRecruitmentState(),"CO",co[1]);`);
    assert.strictEqual(g.win.eval('recruitmentState.byEmpire.CO'),1,"IA usa el helper común");
    assert.strictEqual(g.win.eval('canRecruitStrategicTroops(currentStrategicRecruitmentState(),"CO",ownedBy("CO")[0])'),false,"IA tampoco puede usar territorio lleno");
    g.win.eval('applyStrategicRecruitment(currentStrategicRecruitmentState(),"CO",ownedBy("CO")[2])');
    const aiTroops=g.win.eval('getEmpireTroopsUsed(currentStrategicRecruitmentState(),"CO")');
    assert.strictEqual(g.win.eval('applyStrategicRecruitment(currentStrategicRecruitmentState(),"CO",ownedBy("CO")[0]).ok'),false);
    assert.strictEqual(g.win.eval('getEmpireTroopsUsed(currentStrategicRecruitmentState(),"CO")'),aiTroops,"IA no supera dos reclutamientos");

    g.win.eval('recruitmentState.byEmpire.AG=1;recruitmentState.byTerritory.CAN=1');
    const saved=g.win.eval('saveGame()');
    assert.strictEqual(g.win.eval('JSON.parse(decodeURIComponent(escape(atob('+JSON.stringify(saved)+')))).v'),7);
    g.win.eval('recruitmentState=emptyRecruitmentState(round);loadGame('+JSON.stringify(saved)+')');
    assert.strictEqual(g.win.eval('recruitmentState.byEmpire.AG'),1,"save conserva contador humano");
    assert.strictEqual(g.win.eval('recruitmentState.byEmpire.CO'),2,"save conserva contador IA");
    const v6=g.win.eval(`(()=>{const d=JSON.parse(decodeURIComponent(escape(atob(${JSON.stringify(saved)}))));d.v=6;delete d.recruitmentState;
      return btoa(unescape(encodeURIComponent(JSON.stringify(d))))})()`);
    assert.strictEqual(g.win.eval('loadGame('+JSON.stringify(v6)+')'),true,"save v6 migra");
    assert.strictEqual(g.win.eval('recruitmentState.round'),g.win.eval('round'));assert.deepStrictEqual(Object.keys(g.win.eval('recruitmentState.byEmpire')),[]);

    g.win.eval('recruitmentState.byEmpire.AG=2;recruitmentState.byTerritory.CAN=1;round++;startRound()');
    assert.strictEqual(g.win.eval('recruitmentState.round'),g.win.eval('round'));assert.deepStrictEqual(Object.keys(g.win.eval('recruitmentState.byEmpire')),[],"nueva ronda reinicia límites");
  }finally{closeGame(g);}
});

/* 50 (Fase 3D-3). Subsistencia y crecimiento automático limitado aplican
   las mismas reglas a cualquier imperio sin hambre ni mantenimiento. */
test("Recursos 3D-3: subsistencia y crecimiento poblacional limitado", () => {
  const g=makeGame();
  try{
    assert.deepStrictEqual(JSON.parse(g.win.eval('JSON.stringify(POPULATION_GROWTH)')),
      {subsistencePerTerritory:1,growthFoodCost:4,territoriesPerSlot:3,territoryCap:40});
    g.win.eval(`function growthFixture(count,food=100,owner="AG"){
      const territories={};for(let i=0;i<count;i++)territories[String.fromCharCode(65+i)]={owner,pop:10,troops:1,base:0,plague:0};
      return{T:territories,F:{[owner]:{food}}};
    }`);
    assert.strictEqual(g.win.eval('getFoodSubsistenceCost(growthFixture(3),"AG")'),3);
    assert.strictEqual(g.win.eval('getMaxPopulationGrowthSlots(growthFixture(1),"AG")'),1);
    assert.strictEqual(g.win.eval('getMaxPopulationGrowthSlots(growthFixture(3),"AG")'),1);
    assert.strictEqual(g.win.eval('getMaxPopulationGrowthSlots(growthFixture(4),"AG")'),2);
    assert.strictEqual(g.win.eval('getMaxPopulationGrowthSlots(growthFixture(6),"AG")'),2);
    assert.strictEqual(g.win.eval('getMaxPopulationGrowthSlots(growthFixture(7),"AG")'),3);
    assert.strictEqual(g.win.eval('getMaxPopulationGrowthSlots(growthFixture(9),"AG")'),3);

    const scarce=JSON.parse(g.win.eval(`JSON.stringify((()=>{const s=growthFixture(3,2),before=Object.values(s.T).map(t=>t.pop);
      const result=applyPopulationGrowth(s,"AG");return{result,food:s.F.AG.food,before,after:Object.values(s.T).map(t=>t.pop)}})())`));
    assert.strictEqual(scarce.result.scarcity,true);assert.strictEqual(scarce.result.paidSubsistence,2);
    assert.strictEqual(scarce.food,0);assert.deepStrictEqual(scarce.after,scarce.before,"escasez no quita población");
    assert.strictEqual(scarce.result.growth,0,"escasez detiene crecimiento");

    const enough=JSON.parse(g.win.eval(`JSON.stringify((()=>{const s=growthFixture(3,7);s.T.A.pop=9;s.T.B.pop=11;s.T.C.pop=12;
      const result=applyPopulationGrowth(s,"AG");return{result,food:s.F.AG.food,pops:Object.fromEntries(Object.entries(s.T).map(([id,t])=>[id,t.pop]))}})())`));
    assert.strictEqual(enough.result.growth,1);assert.strictEqual(enough.food,0,"cobra 3 de subsistencia y 4 de crecimiento");
    assert.deepStrictEqual(enough.pops,{A:10,B:11,C:12},"crece primero la menor población");

    const baseTie=JSON.parse(g.win.eval(`JSON.stringify((()=>{const s=growthFixture(3,7);s.T.A.base=0;s.T.B.base=1;
      const result=applyPopulationGrowth(s,"AG");return{ids:result.growthIds,pops:Object.fromEntries(Object.entries(s.T).map(([id,t])=>[id,t.pop]))}})())`));
    assert.deepStrictEqual(baseTie.ids,["B"],"en empate prioriza base");assert.strictEqual(baseTie.pops.B,11);
    assert.deepStrictEqual(JSON.parse(g.win.eval(`JSON.stringify((()=>{const s=growthFixture(3,7);return getPopulationGrowthPlan(s,"AG").growthIds})())`)),["A"],"empate final usa id estable");

    const slots=JSON.parse(g.win.eval(`JSON.stringify((()=>{const out={};for(const n of[3,6,9]){const s=growthFixture(n,100),r=applyPopulationGrowth(s,"AG");out[n]=r.growth;}return out})())`));
    assert.deepStrictEqual(slots,{3:1,6:2,9:3},"respeta máximo por bloques de tres territorios");

    const capped=JSON.parse(g.win.eval(`JSON.stringify((()=>{const s=growthFixture(3,20);s.T.A.pop=40;s.T.B.pop=39;s.T.C.pop=41;
      const result=applyPopulationGrowth(s,"AG");return{result,pops:Object.fromEntries(Object.entries(s.T).map(([id,t])=>[id,t.pop]))}})())`));
    assert.strictEqual(capped.pops.A,40);assert.strictEqual(capped.pops.B,40);assert.strictEqual(capped.pops.C,41,"save antiguo sobre 40 no se recorta");
    assert.strictEqual(capped.result.cappedTerritories,2);

    const ai=JSON.parse(g.win.eval(`JSON.stringify((()=>{const s=growthFixture(4,20,"CO"),r=applyPopulationGrowth(s,"CO");return{r,food:s.F.CO.food,pops:Object.values(s.T).map(t=>t.pop)}})())`));
    assert.strictEqual(ai.r.growth,2,"IA usa exactamente la misma función");assert.strictEqual(ai.food,8);

    g.win.eval(`turnSummaryLines=[];const s=growthFixture(2,1);const r=applyPopulationGrowth(s,"AG");
      if(r.scarcity)logCausal("⚠ Escasez: crecimiento detenido","loss")`);
    assert.ok(g.win.eval('turnSummaryLines.some(x=>x.m.includes("Escasez")&&x.m.includes("detenido"))'));

    // Compatibilidad: reclutamiento 3D-2 y save v7 permanecen vigentes.
    g.win.eval('reset();startGame(1);clickTerr("CAN");F.AG.gold=100;F.AG.food=100');
    assert.strictEqual(g.win.eval('applyStrategicRecruitment(currentStrategicRecruitmentState(),"AG","CAN").ok'),true);
    const saved=g.win.eval('saveGame()');assert.strictEqual(g.win.eval('JSON.parse(decodeURIComponent(escape(atob('+JSON.stringify(saved)+')))).v'),7);
    assert.strictEqual(g.win.eval('loadGame('+JSON.stringify(saved)+')'),true);
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
