/* ==================== 10-guardado.js ====================
   Guardado/carga de partida (v4: héroes) y códigos de legado (Base64). */
function legacyCode(){return "LEG1."+btoa(unescape(encodeURIComponent(JSON.stringify(LEGACY))));}
function loadLegacy(code){
  try{const raw=code.trim();if(!raw.startsWith("LEG1."))throw 0;
    const d=JSON.parse(decodeURIComponent(escape(atob(raw.slice(5)))));
    LEGACY.wins=d.wins|0;LEGACY.hardWins=d.hardWins|0;LEGACY.scen=d.scen||{};LEGACY.heroes=d.heroes||{};
    renderLegacy();return true;
  }catch(e){alert("Código de legado inválido.");return false;}
}

/* ==================== GUARDADO (Base64) ====================
   v6 (Fase 3C): añade el slot de reliquia y normaliza las recompensas de
   monstruos. Conserva las migraciones previas y acepta saves v1-v5. */
function migrateFactionToV5(f){
  if(!f.heroes){
    f.heroes=[null,null,null];
    f.heroWeaponLv=f.champW||1;
    f.heroProgress={};
    if(f.champ){
      const heroId=Object.keys(HEROES).find(id=>HEROES[id].name===f.champ);
      if(heroId)f.heroes[0]=heroId;
    }
    delete f.champ;delete f.champW;
  }
  if(!f.veterancy)f.veterancy=nuevaVeterancia();
  const base=nuevaVeterancia();
  for(const kind in base)if(!f.veterancy[kind])f.veterancy[kind]={xp:0};
}
function saveGame(){
  if(!player){return "";}
  const data={v:6,T,Fx:F,player,round,diffMult,rel,humans,
    pacts:pacts.map(p=>({a:p.a,b:p.b,type:p.type,rounds:p.rounds,coalition:!!p.coalition})),
    mis:missions.map(m=>m.done),leg:LEGACY,scn:scenario?scenario.id:null,
    coalition,coalitionCooldownUntil,eventHistory,warHistory,monsterState};
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function loadGame(code){
  try{
    const d=JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if(![1,2,3,4,5,6].includes(d.v))throw 0;
    T=d.T;F=d.Fx;player=d.player;round=d.round;diffMult=d.diffMult;
    for(const fid in F)migrateFactionToV5(F[fid]);
    humans=d.humans||[d.player];turnIdx=0;pendingOffer=null;player=humans[0];
    rel=d.rel;pacts=d.pacts||[];coalition=d.coalition||null;
    coalitionCooldownUntil=Number.isFinite(d.coalitionCooldownUntil)?d.coalitionCooldownUntil:null;
    if(coalition){
      coalition.rounds=Math.min(coalition.rounds||coalitionDuration(),coalitionDuration());
      pacts.forEach(p=>{if(p.coalition)p.rounds=Math.min(p.rounds,coalition.rounds);});
    }
    eventHistory=d.eventHistory||[];warHistory=d.warHistory||[];
    const relicState=migrateRelicState({monsterState:migrateMonsterState(d.monsterState),factions:F});
    monsterState=relicState.monsterState;F=relicState.factions;
    missions=MISSION_DEFS.map((m,i)=>({...m,done:!!d.mis[i]}));
    if(d.leg){LEGACY.wins=d.leg.wins|0;LEGACY.hardWins=d.leg.hardWins|0;LEGACY.scen=d.leg.scen||{};LEGACY.heroes=d.leg.heroes||{};}
    scenario=d.scn?SCENARIOS.find(x=>x.id===d.scn)||null:null;
    phase="play";selected=null;inBattle=false;aiCont=null;
    closeModals();$("battle").style.display="none";
    log("Partida cargada desde código.","win");
    setStatus(`Partida restaurada — Ronda <strong>${round}</strong>.`);
    render();return true;
  }catch(e){alert("Código inválido. Revisa que esté completo.");return false;}
}
