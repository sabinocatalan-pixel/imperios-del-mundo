/* ==================== 10-guardado.js ====================
   Guardado/carga de partida (v3) y códigos de legado (Base64). */
function legacyCode(){return "LEG1."+btoa(unescape(encodeURIComponent(JSON.stringify(LEGACY))));}
function loadLegacy(code){
  try{const raw=code.trim();if(!raw.startsWith("LEG1."))throw 0;
    const d=JSON.parse(decodeURIComponent(escape(atob(raw.slice(5)))));
    LEGACY.wins=d.wins|0;LEGACY.scen=d.scen||{};LEGACY.champsX=!!d.champsX;
    renderLegacy();return true;
  }catch(e){alert("Código de legado inválido.");return false;}
}

/* ==================== GUARDADO (Base64) ==================== */
function saveGame(){
  if(!player){return "";}
  const data={v:3,T,Fx:F,player,round,diffMult,rel,humans,
    pacts:pacts.map(p=>({a:p.a,b:p.b,type:p.type,rounds:p.rounds})),
    mis:missions.map(m=>m.done),leg:LEGACY,scn:scenario?scenario.id:null};
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function loadGame(code){
  try{
    const d=JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if(![1,2,3].includes(d.v))throw 0;
    T=d.T;F=d.Fx;player=d.player;round=d.round;diffMult=d.diffMult;
    humans=d.humans||[d.player];turnIdx=0;pendingOffer=null;player=humans[0];
    rel=d.rel;pacts=d.pacts;
    missions=MISSION_DEFS.map((m,i)=>({...m,done:!!d.mis[i]}));
    if(d.leg){LEGACY.wins=d.leg.wins|0;LEGACY.scen=d.leg.scen||{};}
    scenario=d.scn?SCENARIOS.find(x=>x.id===d.scn)||null:null;
    phase="play";selected=null;inBattle=false;aiCont=null;
    closeModals();$("battle").style.display="none";
    log("Partida cargada desde código.","win");
    setStatus(`Partida restaurada — Ronda <strong>${round}</strong>.`);
    render();return true;
  }catch(e){alert("Código inválido. Revisa que esté completo.");return false;}
}
