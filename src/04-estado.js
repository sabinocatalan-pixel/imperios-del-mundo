/* ==================== 04-estado.js ====================
   Estado global, reset/startGame/startScenario/escenarios y helpers. */
/* ==================== ESTADO ==================== */
let T,F,player,round,phase,selected,inBattle=false,diffMult=1,
    rel,pacts,missions,aiCont=null,humans=[],turnIdx=0,pickMode=1,pendingOffer=null;

const MISSION_DEFS=[
  {id:"conq1",t:"Conquista tu primer territorio",r:25},
  {id:"base1",t:"Mejora una base",r:15},
  {id:"champ",t:"Equipa un héroe activo",r:20},
  {id:"spec",t:"Usa el poder especial en una batalla",r:20},
  {id:"diplo",t:"Firma un pacto o alianza",r:25},
  {id:"era1",t:"Alcanza la Época Medieval",r:30},
  {id:"cont",t:"Controla un continente completo",r:50}
];

function reset(){
  T={};F={};
  for(const id in TERR)T[id]={owner:TERR[id].f,troops:6,pop:10,base:0,plague:0};
  for(const f in FACTIONS)F[f]={gold:40,food:20,science:0,faith:0,culture:0,era:0,
    upArm:0,upEco:0,upMed:0,heroes:[null,null,null],heroWeaponLv:1,heroProgress:{},ai:true};
  player=null;round=1;phase="pick";selected=null;inBattle=false;aiCont=null;scenario=null;
  humans=[];turnIdx=0;pendingOffer=null;
  rel={};pacts=[];
  for(const a in FACTIONS)for(const b in FACTIONS)if(a!==b)rel[a+b]=0;
  missions=MISSION_DEFS.map(m=>({...m,done:false}));
  closeModals();
  document.getElementById("battle").style.display="none";
  document.getElementById("log").innerHTML="";
  renderLegacy();renderScenList();
  document.getElementById("startModal").style.display="flex";
  render();
}
function renderScenList(){
  const box=$("scenList");if(!box)return;
  box.innerHTML="";
  SCENARIOS.forEach((s,i)=>{
    const locked=i>0&&!LEGACY.scen[SCENARIOS[i-1].id];
    const done=!!LEGACY.scen[s.id];
    const d=document.createElement("div");
    d.className="scen"+(locked?" locked":"");
    d.innerHTML=`<b>${done?"✅ ":""}${i+1}. ${s.n}</b>${locked?" 🔒":""}<small>${s.d}</small>`;
    if(!locked)d.onclick=()=>startScenario(i);
    box.appendChild(d);
  });
}
function applyLegacyBonuses(){
  const f=F[player];
  if(LEGACY.wins>=2)f.gold+=20;
  if(LEGACY.wins>=3)f.heroWeaponLv=2;
  if(LEGACY.wins>=5)f.upEco=Math.max(f.upEco,1);
}
function startGame(mult){
  diffMult=mult;scenario=null;SFX.click();
  closeModals();
  setStatus(pickMode===2
    ?"👤 <strong>Jugador 1</strong>: toca el territorio de tu imperio."
    :"Elige tu imperio: <strong>toca un territorio</strong> y jugarás con esa facción.");
}
function startScenario(i){
  const s=SCENARIOS[i];scenario=s;diffMult=s.diff;pickMode=1;SFX.click();
  closeModals();
  if(s.plagueX)log(`☣ Escenario "${s.n}": las plagas serán ${s.plagueX} veces más frecuentes.`,"loss");
  if(s.fac){
    player=s.fac;humans=[s.fac];F[player].ai=false;
    if(s.only){ // Cerco del Dragón: pierdes todo salvo un territorio
      const redistrib={MOR:"SB",RUS:"CO",IND:"CR"};
      for(const id of ownedBy(player))if(id!==s.only)T[id].owner=redistrib[id]||"AG";
      T[s.only].troops=12;T[s.only].base=2;
    }else{ownedBy(player).forEach(h=>{T[h].troops=8;});T[ownedBy(player)[0]].base=1;}
    applyLegacyBonuses();
    log(`🏆 Escenario: ${s.n} — ${s.d}`,"win");
    burstScreen([FACTIONS[player].color,"#E8DCC0"],90);SFX.win();
    round=1;startPlayerTurn();
  }else{
    setStatus(`🏆 <strong>${s.n}</strong> — elige tu imperio tocando un territorio.`);
  }
}
function checkScenario(){
  if(!scenario||phase==="over")return;
  const s=scenario,own=ownedBy(player).length;
  const g=s.goal;
  if(g.type==="survive"){
    if(own===0)return; // la derrota normal lo captura
    if(round>g.rounds)return scenarioWin();
  }else if(g.type==="own"){
    if(g.ids.every(id=>T[id].owner===player))return scenarioWin();
    if(round>g.by)return scenarioFail("Se acabó el tiempo del escenario.");
  }else if(g.type==="terr"){
    if(round>g.rounds)return own>=g.min?scenarioWin():scenarioFail(`Terminaste con ${own} territorios (necesitabas ${g.min}).`);
  }
  // conquest se maneja con la victoria normal
}
function scenarioWin(){
  LEGACY.scen[scenario.id]=true;LEGACY.wins++;
  endGame(`🏆 ¡Escenario superado!`,`"${scenario.n}" completado. Siguiente escenario desbloqueado.`);
}
function scenarioFail(why){
  endGame("Escenario fallido",why+" Inténtalo de nuevo.",false);
}

/* ==================== HELPERS ==================== */
const $=id=>document.getElementById(id);
function setStatus(h){$("status").innerHTML=h;}
function log(m,c=""){const d=document.createElement("div");d.textContent=`[R${round}] ${m}`;
  d.className=(c?c+" ":"")+"logNew";$("log").prepend(d);}
// Líneas causales de la ronda (ataques, conquistas, diplomacia, plagas,
// desbloqueos) para el Resumen del turno — adelanto de 2E, pilar 6/7.
// turnSummaryLines se reinicia al empezar cada ronda (startRound).
let turnSummaryLines=[];
function logCausal(m,c=""){log(m,c);if(turnSummaryLines.length<20)turnSummaryLines.push({m,c});}
function ownedBy(f){return Object.keys(T).filter(id=>T[id].owner===f);}
function alive(){return[...new Set(Object.values(T).map(t=>t.owner))];}
function pactBetween(a,b){return pacts.find(p=>p.rounds>0&&((p.a===a&&p.b===b)||(p.a===b&&p.b===a)));}
function relGet(a,b){return rel[a+b]||0;}
function relAdd(a,b,v){rel[a+b]=Math.max(-100,Math.min(100,relGet(a,b)+v));rel[b+a]=rel[a+b];}
function completeMission(id){
  const m=missions.find(x=>x.id===id);
  if(m&&!m.done){m.done=true;F[player].gold+=m.r;
    log(`🎯 Misión cumplida: ${m.t} (+${m.r}🪙)`,"win");SFX.coin();
    burstScreen([FACTIONS[player].color,"#D9A441"],50);}
}
