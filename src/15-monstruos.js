/* ==================== 15-monstruos.js ====================
   Fase 3B-1: datos y estado neutral de monstruos míticos.
   Los patrones son solo datos; su ejecución llegará en un bloque posterior. */
const MONSTERS={
  kraken:{
    id:"kraken",name:"Kraken",zone:{type:"seaRoute",territories:[...new Set(SEAROUTES.flat())]},icon:"🐙",
    baseHp:1050,baseDamage:24,reward:{id:"fragmento_abismo",name:"Fragmento del Abismo"},
    description:"Criatura legendaria de las profundidades que amenaza las rutas marítimas y sus costas.",
    patterns:[
      {id:"tentacle_strike",name:"Golpe de tentáculo",cooldown:7,type:"area_front"},
      {id:"abyssal_tide",name:"Marea abisal",cooldown:14,type:"push_stun"}
    ]
  },
  amaru:{
    id:"amaru",name:"Amaru salvaje",zone:{type:"territory",territories:["PER","SUR"]},icon:"🐍",
    baseHp:1150,baseDamage:22,reward:{id:"escama_amaru",name:"Escama de Amaru"},
    description:"Serpiente mítica andina vinculada en la tradición a las fuerzas de la tierra y el agua.",
    patterns:[
      {id:"serpent_charge",name:"Embate serpentino",cooldown:6,type:"single_front"},
      {id:"venom_cloud",name:"Nube venenosa",cooldown:14,type:"area_over_time"}
    ]
  },
  long:{
    id:"long",name:"Long, dragón celeste",zone:{type:"territory",territories:["IND","CHN","JPN"]},icon:"🐉",
    baseHp:950,baseDamage:28,reward:{id:"perla_long",name:"Perla del Long"},
    description:"Dragón de la tradición china, representado como una fuerza celeste de gran poder.",
    patterns:[
      {id:"celestial_breath",name:"Aliento celeste",cooldown:8,type:"cone"},
      {id:"long_storm",name:"Tormenta del Long",cooldown:15,type:"two_targets"}
    ]
  },
  anubis:{
    id:"anubis",name:"Anubis",zone:{type:"territory",territories:["MAG","AFO","AFE","SUD"]},icon:"𓃥",
    baseHp:1000,baseDamage:25,reward:{id:"sello_anubis",name:"Sello de Anubis"},
    description:"Figura divina de la mitología egipcia, presentada con respeto como guardián y juez legendario.",
    patterns:[
      {id:"desert_scythe",name:"Guadaña del desierto",cooldown:7,type:"area_front"},
      {id:"anubis_judgment",name:"Juicio de Anubis",cooldown:14,type:"highest_hp"}
    ]
  }
};

function emptyMonsterState(){return{active:null,defeated:{},rewards:[]};}
function getMonsterById(id){return MONSTERS[id]||null;}
function getAvailableMonsters(state){
  const s=state||emptyMonsterState();
  if(s.active)return[];
  return Object.values(MONSTERS).filter(m=>!(s.defeated&&s.defeated[m.id]));
}
function getValidMonsterTargets(monsterId,state){
  const s=state||emptyMonsterState();
  if(s.active||s.defeated&&s.defeated[monsterId])return[];
  const monster=getMonsterById(monsterId);if(!monster)return[];
  return monster.zone.territories.filter(id=>T[id]&&isValidMonsterTerritory(monsterId,id));
}
function pickMonsterCandidate(state,rng=Math.random){
  const available=getAvailableMonsters(state).map(monster=>({monster,targets:getValidMonsterTargets(monster.id,state)}))
    .filter(x=>x.targets.length);
  if(!available.length)return null;
  const roll=Math.max(0,Math.min(0.999999,+rng()||0)),scaled=roll*available.length;
  const entry=available[Math.floor(scaled)],fraction=scaled-Math.floor(scaled);
  return{monster:entry.monster,territory:entry.targets[Math.floor(fraction*entry.targets.length)]};
}
function medianAliveEra(){
  const eras=alive().map(fid=>F[fid].era||0).sort((a,b)=>a-b);if(!eras.length)return 0;
  const mid=Math.floor(eras.length/2);return eras.length%2?eras[mid]:(eras[mid-1]+eras[mid])/2;
}
function trySpawnMonster(state,currentRound,rng=Math.random){
  if(!state||state.active||currentRound<6)return null;
  const candidate=pickMonsterCandidate(state,rng);if(!candidate)return null;
  const {monster,territory}=candidate,owner=T[territory].owner,eventKey=`monstruo:${monster.id}`;
  if(rng()>=liveEventProbability(0.07,eventKey,owner))return null;
  const active=createMonsterState(monster.id,territory,currentRound,medianAliveEra());
  if(!active)return null;
  state.active=active;recordLiveEvent(eventKey,owner,true);
  const message=`${monster.icon} ${monster.name} apareció en ${TERR[territory].n}: las condiciones cambiantes del mundo atrajeron una amenaza mítica.`;
  logCausal(message,"loss");
  const banner=$("worldBanner");
  if(!banner||banner.style.display!=="flex")showWorldBanner("⚠ AMENAZA MÍTICA",message);
  return active;
}
function isValidMonsterTerritory(monsterId,territoryId){
  const monster=getMonsterById(monsterId);
  return !!(monster&&TERR[territoryId]&&monster.zone.territories.includes(territoryId));
}
function createMonsterState(monsterId,territoryId,spawnRound,eraMedian){
  const monster=getMonsterById(monsterId);
  if(!monster||!isValidMonsterTerritory(monsterId,territoryId))return null;
  const era=Math.max(0,Math.min(3,Number.isFinite(eraMedian)?eraMedian:0));
  const maxHp=Math.round(monster.baseHp*(1+era*0.12));
  return{id:monster.id,territory:territoryId,hp:maxHp,maxHp,
    damage:+(monster.baseDamage*(1+era*0.10)).toFixed(2),eraMedian:era,
    spawnedRound:spawnRound,nextRaidRound:spawnRound+2,raidCount:0,attemptsThisRound:{}};
}
function getMonsterReward(monsterId,empireId,territoryId,earnedRound){
  const monster=getMonsterById(monsterId);
  if(!monster||!FACTIONS[empireId]||!TERR[territoryId])return null;
  return{id:monster.reward.id,name:monster.reward.name,sourceMonster:monster.id,
    earnedBy:empireId,earnedRound,sourceTerritory:territoryId,claimed:true,inert:true};
}
function migrateMonsterState(saved){
  if(!saved||typeof saved!=="object")return emptyMonsterState();
  return{
    active:saved.active&&getMonsterById(saved.active.id)?{...saved.active}:null,
    defeated:saved.defeated&&typeof saved.defeated==="object"?{...saved.defeated}:{},
    rewards:Array.isArray(saved.rewards)?saved.rewards.map(r=>({...r,inert:true})):[]
  };
}

/* Render mínimo 3B-3. No ejecuta saqueo, combate, patrones ni recompensas. */
function monsterRouteFor(active){
  if(!active||active.id!=="kraken")return null;
  return SEAROUTES.find(route=>route.includes(active.territory))||null;
}
function monsterMarkerPosition(active){
  const route=monsterRouteFor(active);
  if(route){
    const a=TERR[route[0]].c,b=TERR[route[1]].c;
    return{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2-15,route};
  }
  const c=TERR[active.territory].c;
  return{x:c[0]+24,y:c[1]-30,route:null};
}
function syncMythicMarkerScale(){
  const marker=$("mythicMonsterMarker");if(!marker||typeof vb==="undefined")return;
  const pxWidth=svg.clientWidth||1000,scale=vb.w/pxWidth;
  marker.setAttribute("transform",`translate(${marker.dataset.x} ${marker.dataset.y}) scale(${scale})`);
}
function selectMonsterTerritory(){
  if(!monsterState.active||!T[monsterState.active.territory])return;
  selected=monsterState.active.territory;SFX.click();render();
}
function renderMythicThreat(){
  const routeLayer=$("mythicRouteLayer"),territoryLayer=$("mythicTerritoryLayer"),markerLayer=$("mythicMarkerLayer");
  const legend=$("mythicLegend");if(!routeLayer||!territoryLayer||!markerLayer||!legend)return;
  routeLayer.innerHTML="";territoryLayer.innerHTML="";markerLayer.innerHTML="";
  const active=monsterState&&monsterState.active;
  legend.hidden=!active;if(!active||!TERR[active.territory])return;
  const monster=getMonsterById(active.id);if(!monster)return;
  const points=TERR[active.territory].p,pos=monsterMarkerPosition(active);
  territoryLayer.innerHTML=`<polygon class="mythicThreatHalo" points="${points}"/>`;
  if(pos.route){
    const a=TERR[pos.route[0]].c,b=TERR[pos.route[1]].c;
    routeLayer.innerHTML=`<path class="mythicThreatRoute" d="M${a[0]},${a[1]} Q${(a[0]+b[0])/2},${(a[1]+b[1])/2-30} ${b[0]},${b[1]}"/>`;
  }
  const hpPct=Math.max(0,Math.min(1,active.maxHp?active.hp/active.maxHp:0)),barWidth=42*hpPct;
  markerLayer.innerHTML=`<g id="mythicMonsterMarker" class="mythicMonsterMarker${SET.fx?" fx":""}"
      data-x="${pos.x}" data-y="${pos.y}" role="button" tabindex="0"
      aria-label="${monster.name}, amenaza mítica en ${TERR[active.territory].n}, ${Math.round(hpPct*100)}% de vida">
      <title>${monster.name} — ${Math.round(active.hp)}/${Math.round(active.maxHp)} PV</title>
      <circle class="mythicHitbox" r="22"/>
      <circle class="mythicPulse" r="21"/>
      <circle class="mythicMedallion" r="18"/>
      <text class="mythicIcon" y="6">${monster.icon}</text>
      <rect class="mythicHpBack" x="-22" y="22" width="44" height="6" rx="3"/>
      <rect class="mythicHpFill" x="-21" y="23" width="${barWidth}" height="4" rx="2"/>
    </g>`;
  const marker=$("mythicMonsterMarker");
  marker.addEventListener("click",e=>{e.stopPropagation();if(!mapDragged)selectMonsterTerritory();});
  marker.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectMonsterTerritory();}});
  syncMythicMarkerScale();
}
function initMythicMapUI(){
  const toggle=$("mythicLegendToggle"),body=$("mythicLegendBody");if(!toggle||!body)return;
  toggle.onclick=()=>{const open=body.hidden;body.hidden=!open;toggle.setAttribute("aria-expanded",String(open));};
}
