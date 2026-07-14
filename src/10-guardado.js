/* ==================== 10-guardado.js ====================
   Guardado/carga de partida (v4: héroes) y códigos de legado (Base64). */
function legacyCode(){return "LEG1."+btoa(unescape(encodeURIComponent(JSON.stringify(LEGACY))));}
function loadLegacy(code){
  try{const raw=code.trim();if(!raw.startsWith("LEG1."))throw 0;
    const d=JSON.parse(decodeURIComponent(escape(atob(raw.slice(5)))));
    LEGACY.wins=d.wins|0;LEGACY.scen=d.scen||{};LEGACY.heroes=d.heroes||{};
    renderLegacy();return true;
  }catch(e){alert("Código de legado inválido.");return false;}
}

/* ==================== GUARDADO (Base64) ====================
   v4 (Fase 2A): F[fac] guarda heroes/heroWeaponLv/heroProgress en vez de
   champ/champW. migrateFactionToV4 reconstruye ese estado desde un save
   v1-v3 sin romper la partida guardada. */
function migrateFactionToV4(f){
  if(f.heroes)return; // ya es v4
  f.heroes=[null,null,null];
  f.heroWeaponLv=f.champW||1;
  f.heroProgress={};
  if(f.champ){
    const heroId=Object.keys(HEROES).find(id=>HEROES[id].name===f.champ);
    if(heroId)f.heroes[0]=heroId;
  }
  delete f.champ;delete f.champW;
}
function saveGame(){
  if(!player){return "";}
  const data={v:4,T,Fx:F,player,round,diffMult,rel,humans,
    pacts:pacts.map(p=>({a:p.a,b:p.b,type:p.type,rounds:p.rounds})),
    mis:missions.map(m=>m.done),leg:LEGACY,scn:scenario?scenario.id:null};
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function loadGame(code){
  try{
    const d=JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if(![1,2,3,4].includes(d.v))throw 0;
    T=d.T;F=d.Fx;player=d.player;round=d.round;diffMult=d.diffMult;
    for(const fid in F)migrateFactionToV4(F[fid]);
    humans=d.humans||[d.player];turnIdx=0;pendingOffer=null;player=humans[0];
    rel=d.rel;pacts=d.pacts;
    missions=MISSION_DEFS.map((m,i)=>({...m,done:!!d.mis[i]}));
    if(d.leg){LEGACY.wins=d.leg.wins|0;LEGACY.scen=d.leg.scen||{};LEGACY.heroes=d.leg.heroes||{};}
    scenario=d.scn?SCENARIOS.find(x=>x.id===d.scn)||null:null;
    phase="play";selected=null;inBattle=false;aiCont=null;
    closeModals();$("battle").style.display="none";
    log("Partida cargada desde código.","win");
    setStatus(`Partida restaurada — Ronda <strong>${round}</strong>.`);
    render();return true;
  }catch(e){alert("Código inválido. Revisa que esté completo.");return false;}
}
