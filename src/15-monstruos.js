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
    spawnedRound:spawnRound,nextRaidRound:spawnRound+2,raidCount:0,
    raidPopulationLost:0,raidGoldLost:0,attemptsThisRound:{}};
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

const MONSTER_RAID_EFFECTS={
  kraken:{population:2,gold:10},amaru:{population:2,gold:8},
  long:{population:1,gold:12},anubis:{population:2,gold:10}
};
function getMonsterRaidEffect(monsterId){
  const effect=MONSTER_RAID_EFFECTS[monsterId];return effect?{...effect}:null;
}
function shouldRaidMonster(activeMonster,currentRound){
  return !!(activeMonster&&Number.isFinite(activeMonster.nextRaidRound)&&currentRound>=activeMonster.nextRaidRound);
}
function applyMonsterRaid(state,currentRound){
  const active=state&&state.active;if(!shouldRaidMonster(active,currentRound))return null;
  const effect=getMonsterRaidEffect(active.id),territory=T[active.territory];
  if(!effect||!territory||!F[territory.owner]){
    active.nextRaidRound=currentRound+2;return null;
  }
  const owner=territory.owner,popBefore=territory.pop,goldBefore=F[owner].gold;
  territory.pop=Math.max(2,territory.pop-effect.population);
  F[owner].gold=Math.max(0,F[owner].gold-effect.gold);
  const populationLost=popBefore-territory.pop,goldLost=goldBefore-F[owner].gold;
  active.raidCount=(active.raidCount||0)+1;
  active.raidPopulationLost=(active.raidPopulationLost||0)+populationLost;
  active.raidGoldLost=(active.raidGoldLost||0)+goldLost;
  active.nextRaidRound=currentRound+2;
  const monster=getMonsterById(active.id);
  const message=`${monster.icon} ${monster.name} saqueó ${TERR[active.territory].n}: −${populationLost} población y −${goldLost} oro para ${fname(owner)}.`;
  logCausal(message,"loss");
  const banner=$("worldBanner");
  if(!banner||banner.style.display!=="flex")showWorldBanner("▾ SAQUEO MÍTICO",message);
  return{monsterId:active.id,territory:active.territory,owner,populationLost,goldLost};
}

function getMonsterTerritoryPanelHtml(territoryId){
  const active=monsterState&&monsterState.active;
  if(!active||active.territory!==territoryId)return"";
  const monster=getMonsterById(active.id),remaining=Math.max(0,active.nextRaidRound-round);
  const challenge=player?canChallengeMonster(monsterState,player,round):{ok:false,origins:[],reason:"Elige un imperio."};
  const best=challenge.origin;
  return`<div class="mythicTerritoryInfo">
    <div class="row"><b>${monster.icon} ${monster.name} · Amenaza mítica</b></div>
    <div class="row"><span>PV: ${Math.round(active.hp)}/${Math.round(active.maxHp)}</span><span>Próximo saqueo: ${remaining} ${remaining===1?"ronda":"rondas"}</span></div>
    ${active.raidCount?`<div class="row"><span>▾ Saqueos: ${active.raidCount}</span><span>Daño acumulado: −${active.raidPopulationLost||0} población · −${active.raidGoldLost||0} oro</span></div>`:""}
    <div class="row mythicCause">Permanece aquí porque las condiciones cambiantes del mundo atrajeron esta amenaza.</div>
    <div class="mythicRequirements"><b>Requisitos para desafiar</b>
      <span>${challenge.origins.length?"✅":"⬜"} Territorio propio conectado</span>
      <span>${best&&best.troops>=8?"✅":"⬜"} Origen con al menos 8 tropas</span>
      <span>${challenge.attempted?"⬜ Ya intentaste esta ronda":"✅ Sin intento esta ronda"}</span>
      ${best?`<span>Origen sugerido: ${TERR[best.id].n} · ${best.troops} tropas · ${best.connection}</span>`:`<span>${challenge.reason}</span>`}
    </div>
  </div>`;
}

function getMonsterChallengeOrigins(state,empireId){
  const active=state&&state.active;if(!active||!F[empireId]||!T[active.territory])return[];
  const target=active.territory;
  return ownedBy(empireId).map(id=>{
    let connection=null;
    if(id===target)connection="territorio afectado";
    else if(SEAROUTES.some(route=>route.includes(id)&&route.includes(target)))connection="ruta marítima";
    else if(ADJ[id]&&ADJ[id].includes(target))connection="adyacencia";
    return connection?{id,troops:T[id].troops,connection}:null;
  }).filter(Boolean).sort((a,b)=>b.troops-a.troops||a.id.localeCompare(b.id));
}
function canChallengeMonster(state,empireId,currentRound=round){
  const active=state&&state.active,origins=getMonsterChallengeOrigins(state,empireId);
  if(!active)return{ok:false,origins,origin:null,attempted:false,reason:"No hay amenaza mítica activa."};
  const attempted=!!(active.attemptsThisRound&&active.attemptsThisRound[empireId]===currentRound);
  const origin=origins.find(o=>o.troops>=8)||origins[0]||null;
  let reason="";
  if(!origins.length)reason="No controlas un territorio conectado.";
  else if(!origins.some(o=>o.troops>=8))reason="Necesitas al menos 8 tropas en un origen conectado.";
  else if(attempted)reason="Ya intentaste cazar este monstruo durante esta ronda.";
  return{ok:!reason,origins,origin,attempted,reason};
}
function markMonsterAttempt(state,empireId,currentRound){
  const check=canChallengeMonster(state,empireId,currentRound);if(!check.ok)return false;
  const active=state.active;if(!active.attemptsThisRound)active.attemptsThisRound={};
  active.attemptsThisRound[empireId]=currentRound;return true;
}
function resetMonsterAttemptsForRound(state,currentRound){
  const attempts=state&&state.active&&state.active.attemptsThisRound;if(!attempts)return;
  for(const empireId in attempts)if(attempts[empireId]!==currentRound)delete attempts[empireId];
}
function prepareMonsterChallenge(empireId){
  const check=canChallengeMonster(monsterState,empireId,round);if(!check.ok)return false;
  return openBossBattle(empireId,check.origin.id);
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
  const raided=active.raidCount>0;
  territoryLayer.innerHTML=`<polygon class="mythicThreatHalo${raided?" raided":""}" points="${points}"/>
    ${raided?`<text class="mythicRaidMarks" x="${TERR[active.territory].c[0]}" y="${TERR[active.territory].c[1]+30}">▾▾</text>`:""}`;
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
