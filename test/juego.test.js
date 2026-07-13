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

function makeGame() {
  const errors = [];
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    url: "http://localhost/",
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false });
      stubCanvas(window);
    }
  });
  dom.window.addEventListener("error", e => errors.push(e.error || e.message || e));
  return { dom, win: dom.window, doc: dom.window.document, errors };
}

function closeGame(game) {
  try { game.win.close(); } catch (e) { /* ignorar */ }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    await sleep(1700);
    assert.strictEqual(g.win.eval('T.EUN.owner'), "AG");
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
    await sleep(4500);
    assert.strictEqual(g.errors.length, 0, "no debe haber excepciones: " + JSON.stringify(g.errors));
    assert.ok(g.win.eval("round") > roundBefore, "la ronda debe avanzar");
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
    g.win.eval('F[B.eFacId].champ="Aníbal"');
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
