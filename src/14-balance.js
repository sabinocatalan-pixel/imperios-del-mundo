/* ==================== 14-balance.js ====================
   Modo Balance (Fase 2F): telemetría local, solo lectura y sin autoajustes. */
const BALANCE_KEY="IDM_BALANCE_V1";
const BALANCE_SESSION_KEY="IDM_BALANCE_PARTIDA_V1";
let balanceEnabled=false,balanceTitleTaps=0,balanceSession=null;

function emptyBalanceData(){return{
  battles:{count:0,durationTotal:0},units:{},heroes:{},damage:{},wins:{},
  games:{count:0,durationTotal:0},difficulty:{},events:{},duels:{},relics:{},relicEquipment:{},
  matchups:{},structureDamage:{},unableToAttack:{},compositions:{}
};}
function normalizeBalanceData(d){
  const b=d&&typeof d==="object"?d:emptyBalanceData();
  for(const k of["battles","units","heroes","damage","wins","games","difficulty","events","duels","relics","relicEquipment","matchups","structureDamage","unableToAttack","compositions"])
    if(!b[k]||typeof b[k]!=="object")b[k]=emptyBalanceData()[k];
  b.battles.count=b.battles.count|0;b.battles.durationTotal=+b.battles.durationTotal||0;
  b.games.count=b.games.count|0;b.games.durationTotal=+b.games.durationTotal||0;
  return b;
}
function loadBalanceTotal(){try{return normalizeBalanceData(JSON.parse(localStorage.getItem(BALANCE_KEY)||"null"));}catch(e){return emptyBalanceData();}}
function saveBalanceTotal(d){try{localStorage.setItem(BALANCE_KEY,JSON.stringify(d));}catch(e){}}
function saveBalanceSession(){try{localStorage.setItem(BALANCE_SESSION_KEY,JSON.stringify(balanceSession));}catch(e){}}
function resetBalanceSession(){balanceSession=emptyBalanceData();balanceSession.startedAt=Date.now();saveBalanceSession();}
function balancePair(box,key){if(!box[key])box[key]={uses:0,wins:0};return box[key];}
function balanceDamage(box,key){if(!box[key])box[key]={total:0,samples:0};return box[key];}
function balanceRelic(box,key){if(!box[key])box[key]={uses:0,wins:0,losses:0,retreats:0,owners:{jugador:0,IA:0},contexts:{}};return box[key];}
function battleCounterBox(b){
  if(!b.counterTelemetry)b.counterTelemetry={matchups:{},structures:{},unable:{}};
  return b.counterTelemetry;
}
function balanceOwner(fid){return humans.includes(fid)?"jugador":"IA";}
function recordBattleCounterHit(b,att,def,mult,damage,killed=false){
  if(!b||b.mode==="boss"||(att.kind==="champ"&&def.kind==="champ"))return false;
  const attackerKind=normalizedCounterKind(att.kind),defenderKind=normalizedCounterKind(def.kind),key=`${attackerKind}→${defenderKind}`;
  const box=battleCounterBox(b),entry=box.matchups[key]||(box.matchups[key]={attackerKind,defenderKind,multiplier:mult,
    category:mult>1?"favorable":mult<1?"desfavorable":"neutral",attacks:0,damage:0,kills:0,bySide:{}});
  entry.attacks++;entry.damage+=Math.max(0,damage||0);if(killed)entry.kills++;
  const side=String(att.side),S=b.S[side],sideEntry=entry.bySide[side]||(entry.bySide[side]={attackerFac:S.fac,defenderFac:b.S[String(-att.side)].fac,
    relicId:S.relicEquippedId||null,attacks:0,damage:0,kills:0});
  sideEntry.attacks++;sideEntry.damage+=Math.max(0,damage||0);if(killed)sideEntry.kills++;
  return true;
}
function recordBattleStructureHit(b,unit,damage){
  if(!b||b.mode==="boss")return false;const kind=normalizedCounterKind(unit.kind),box=battleCounterBox(b);
  const entry=box.structures[kind]||(box.structures[kind]={attacks:0,damage:0,bySide:{}});entry.attacks++;entry.damage+=Math.max(0,damage||0);
  const side=String(unit.side),S=b.S[side],x=entry.bySide[side]||(entry.bySide[side]={fac:S.fac,relicId:S.relicEquippedId||null,attacks:0,damage:0});
  x.attacks++;x.damage+=Math.max(0,damage||0);return true;
}
function recordUnableToAttack(b,unit,defenderKind){
  if(!b||b.mode==="boss"||unit.kind==="healer")return false;const attackerKind=normalizedCounterKind(unit.kind),target=normalizedCounterKind(defenderKind);
  const box=battleCounterBox(b),key=`${unit.side}:${attackerKind}→${target}`;if(box.unable[key])return false;
  box.unable[key]={attackerKind,defenderKind:target,side:String(unit.side),fac:b.S[String(unit.side)].fac};return true;
}
function markBattleRelicUse(sideState,relicId,contexts=[]){
  if(!sideState||!relicId)return false;
  if(!sideState.relicUses)sideState.relicUses={};
  const use=sideState.relicUses[relicId]||(sideState.relicUses[relicId]={contexts:[]});
  for(const context of contexts)if(!use.contexts.includes(context))use.contexts.push(context);
  return true;
}
function addBattleTelemetry(data,b,win){
  data.battles.count++;data.battles.durationTotal+=Math.max(0,+b.time||0);
  for(const side of["1","-1"]){
    const S=b.S[side],sideWon=(side==="1")===win;
    for(const kind in S.spawnedTypes){const n=S.spawnedTypes[kind]|0;if(!n)continue;
      const x=balancePair(data.units,kind);x.uses+=n;if(sideWon)x.wins+=n;
      const amount=S.damageByType&&S.damageByType[kind]||0,dm=balanceDamage(data.damage,kind);
      dm.total+=amount;dm.samples++;
    }
    if(S.heroSpawned){const id=F[S.fac].heroes[0]||"sin-heroe",x=balancePair(data.heroes,id);x.uses++;if(sideWon)x.wins++;}
    if(S.relicEquippedId){
      if(!data.relicEquipment[S.fac])data.relicEquipment[S.fac]={};
      data.relicEquipment[S.fac][S.relicEquippedId]=(data.relicEquipment[S.fac][S.relicEquippedId]||0)+1;
    }
    if(b.mode!=="boss"){
      const composition=Object.entries(S.spawnedTypes||{}).filter(([,n])=>n>0).map(([k,n])=>`${k}:${n}`).sort().join("+")||"sin-unidades";
      const c=balancePair(data.compositions,composition);c.uses++;if(sideWon)c.wins++;
    }
  }
}
function addCounterTelemetry(data,b,win,retreat=false){
  if(!b||b.mode==="boss"||!b.counterTelemetry)return;
  for(const[key,entry]of Object.entries(b.counterTelemetry.matchups||{})){
    const out=data.matchups[key]||(data.matchups[key]={attackerKind:entry.attackerKind,defenderKind:entry.defenderKind,
      multiplier:entry.multiplier,category:entry.category,attacks:0,damage:0,kills:0,results:{victoria:0,derrota:0,retirada:0},
      attackerOwners:{jugador:0,IA:0},defenderOwners:{jugador:0,IA:0},relics:{}});
    out.attacks+=entry.attacks;out.damage+=entry.damage;out.kills+=entry.kills;
    for(const[side,x]of Object.entries(entry.bySide||{})){
      const sideWon=(side==="1")===win,result=retreat&&side==="1"?"retirada":sideWon?"victoria":"derrota";
      out.results[result]++;out.attackerOwners[balanceOwner(x.attackerFac)]++;out.defenderOwners[balanceOwner(x.defenderFac)]++;
      if(x.relicId)out.relics[x.relicId]=(out.relics[x.relicId]||0)+1;
    }
  }
  for(const[kind,entry]of Object.entries(b.counterTelemetry.structures||{})){
    const out=data.structureDamage[kind]||(data.structureDamage[kind]={attacks:0,damage:0,owners:{jugador:0,IA:0},relics:{}});
    out.attacks+=entry.attacks;out.damage+=entry.damage;
    for(const x of Object.values(entry.bySide||{})){out.owners[balanceOwner(x.fac)]++;if(x.relicId)out.relics[x.relicId]=(out.relics[x.relicId]||0)+1;}
  }
  for(const entry of Object.values(b.counterTelemetry.unable||{})){
    const key=`${entry.attackerKind}→${entry.defenderKind}`,out=data.unableToAttack[key]||(data.unableToAttack[key]={uses:0,owners:{jugador:0,IA:0},results:{victoria:0,derrota:0,retirada:0}});
    const sideWon=(entry.side==="1")===win,result=retreat&&entry.side==="1"?"retirada":sideWon?"victoria":"derrota";
    out.uses++;out.owners[balanceOwner(entry.fac)]++;out.results[result]++;
  }
}
function recordBalanceBattle(b,win,retreat=false){
  if(!b)return;const total=loadBalanceTotal();
  for(const data of[balanceSession,total]){addBattleTelemetry(data,b,win);addCounterTelemetry(data,b,win,retreat);}
  saveBalanceSession();saveBalanceTotal(total);renderBalancePanel();
}
function addRelicBattleTelemetry(data,b,win,retreat){
  for(const side of["1","-1"]){
    const S=b.S[side],sideWon=(side==="1")===win,owner=humans.includes(S.fac)?"jugador":"IA";
    for(const[relicId,use]of Object.entries(S.relicUses||{})){
      const x=balanceRelic(data.relics,relicId),result=retreat&&side==="1"?"retirada":(sideWon?"victoria":"derrota");
      x.uses++;x.owners[owner]++;x[result==="victoria"?"wins":result==="retirada"?"retreats":"losses"]++;
      for(const context of use.contexts||[])x.contexts[context]=(x.contexts[context]||0)+1;
    }
  }
}
function recordBalanceRelicBattle(b,win,retreat=false){
  if(!b)return;const total=loadBalanceTotal();
  addRelicBattleTelemetry(balanceSession,b,win,retreat);addRelicBattleTelemetry(total,b,win,retreat);
  saveBalanceSession();saveBalanceTotal(total);renderBalancePanel();
}
function recordBalanceEvent(type){
  if(!balanceSession)return;balanceSession.events[type]=(balanceSession.events[type]||0)+1;
  const total=loadBalanceTotal();total.events[type]=(total.events[type]||0)+1;saveBalanceSession();saveBalanceTotal(total);
}
function recordBalanceDuel(winner,loser){
  if(!balanceSession)return;const total=loadBalanceTotal();
  for(const data of[balanceSession,total]){
    const w=balancePair(data.duels,winner),l=balancePair(data.duels,loser);
    w.uses++;w.wins++;l.uses++;
  }
  saveBalanceSession();saveBalanceTotal(total);
}
function recordBalanceGame(winner,won){
  if(!balanceSession)return;const effectiveWinner=winner||(won?player:null),seconds=Math.max(0,(Date.now()-balanceSession.startedAt)/1000),key=`${effectiveWinner||"sin-ganador"}|${difficultyName()}`;
  const total=loadBalanceTotal();
  for(const data of[balanceSession,total]){data.games.count++;data.games.durationTotal+=seconds;
    const d=data.difficulty[difficultyName()]||(data.difficulty[difficultyName()]={games:0,playerWins:0});d.games++;if(won)d.playerWins++;
    if(won&&effectiveWinner)data.wins[key]=(data.wins[key]||0)+1;}
  saveBalanceSession();saveBalanceTotal(total);renderBalancePanel();
}
function balanceView(data){
  const rates=box=>Object.fromEntries(Object.entries(box).map(([k,v])=>[k,{uso:v.uses,tasaVictoria:v.uses?+(v.wins/v.uses).toFixed(3):0}]));
  const structureKinds=[...COUNTER_TYPES,"hero"],structureView=Object.fromEntries(structureKinds.map(kind=>{const x=data.structureDamage[kind]||{attacks:0,damage:0,owners:{jugador:0,IA:0},relics:{}};
    return[kind,{ataques:x.attacks,danoTotal:+x.damage.toFixed(2),danoPromedio:x.attacks?+(x.damage/x.attacks).toFixed(2):0,propietarios:x.owners,reliquias:x.relics}];}));
  return{
    duracionMediaBatalla:data.battles.count?+(data.battles.durationTotal/data.battles.count).toFixed(2):0,
    batallas:data.battles.count,unidades:rates(data.units),heroes:rates(data.heroes),
    danoMedioPorTipo:Object.fromEntries(Object.entries(data.damage).map(([k,v])=>[k,v.samples?+(v.total/v.samples).toFixed(2):0])),
    victoriasPorImperioDificultad:data.wins,
    duracionMediaPartida:data.games.count?+(data.games.durationTotal/data.games.count).toFixed(2):0,
    partidas:data.games.count,resultadosPorDificultad:data.difficulty,eventosMasFrecuentes:data.events,duelosPorHeroe:rates(data.duels),
    reliquiasEquipadasPorImperio:data.relicEquipment,
    matchups:Object.fromEntries(Object.entries(data.matchups).map(([key,x])=>[key,{atacante:x.attackerKind,defensor:x.defenderKind,
      multiplicador:x.multiplier,categoria:x.category,ataques:x.attacks,danoTotal:+x.damage.toFixed(2),
      danoPromedio:x.attacks?+(x.damage/x.attacks).toFixed(2):0,bajas:x.kills,resultados:x.results,
      propietariosAtacante:x.attackerOwners,propietariosDefensor:x.defenderOwners,reliquias:x.relics}])),
    danoEstructurasPorTipo:structureView,
    unidadesSinObjetivo:data.unableToAttack,composiciones:rates(data.compositions),
    reliquias:Object.fromEntries(Object.entries(data.relics).map(([id,x])=>[id,{usos:x.uses,
      tasaVictoria:x.uses?+(x.wins/x.uses).toFixed(3):0,resultados:{victorias:x.wins,derrotas:x.losses,retiradas:x.retreats},
      propietarios:x.owners,contextos:x.contexts}]))
  };
}
function balanceBenchmarks(data){
  const reports=[],v=balanceView(data);
  if(v.batallas&& (v.duracionMediaBatalla<60||v.duracionMediaBatalla>180))reports.push("Batalla media fuera de 60–180s");
  for(const[k,x]of Object.entries(v.unidades))if(x.uso&&x.uso/Object.values(v.unidades).reduce((n,u)=>n+u.uso,0)>0.6)reports.push(`${k} supera 60% de uso`);
  for(const[k,x]of Object.entries(v.duelosPorHeroe))if(x.uso&&x.tasaVictoria>0.65)reports.push(`${k} supera 65% de victorias en duelo`);
  const nightmare=v.resultadosPorDificultad.Pesadilla;
  if(nightmare&&nightmare.games&&nightmare.playerWins/nightmare.games>=0.35)reports.push("Pesadilla alcanza o supera 35% de victorias");
  for(const[id,x]of Object.entries(v.reliquias))if(x.usos>=5&&x.tasaVictoria>=0.65)
    reports.push(`${getRelicById(id)?getRelicById(id).name:id} parece dominar (${Math.round(x.tasaVictoria*100)}% en ${x.usos} usos)`);
  const ranged=[v.matchups["ranged→heavy"],v.matchups["ranged→air"]].filter(Boolean),rangedAttacks=ranged.reduce((n,x)=>n+x.ataques,0);
  const rangedWins=ranged.reduce((n,x)=>n+x.resultados.victoria,0),rangedResults=ranged.reduce((n,x)=>n+x.resultados.victoria+x.resultados.derrota+x.resultados.retirada,0);
  if(rangedAttacks>=20&&rangedResults>=5&&rangedWins/rangedResults>=0.65)reports.push("Distancia parece dominar sus matchups favorables");
  const airStructure=v.danoEstructurasPorTipo.air,totalStructure=Object.values(v.danoEstructurasPorTipo).reduce((n,x)=>n+x.danoTotal,0);
  if(airStructure&&airStructure.ataques>=10&&totalStructure&&airStructure.danoTotal/totalStructure>0.45)reports.push("Aérea concentra más de 45% del daño estructural");
  const heavy=v.matchups["heavy→melee"];if(heavy&&heavy.ataques>=20&&(heavy.resultados.victoria+heavy.resultados.derrota+heavy.resultados.retirada)>=5&&
    heavy.resultados.victoria/(heavy.resultados.victoria+heavy.resultados.derrota+heavy.resultados.retirada)>=0.65)reports.push("Pesada parece dominar contra melee");
  const siege=v.danoEstructurasPorTipo.siege;if(siege&&siege.ataques>=10&&siege.danoTotal<=0)reports.push("Asedio no logra daño estructural");
  for(const[key,x]of Object.entries(v.unidadesSinObjetivo))if(x.uses>=5)reports.push(`${key} acumula ${x.uses} usos sin poder atacar ese tipo`);
  return reports;
}
function exportBalanceJSON(){
  const total=loadBalanceTotal();return JSON.stringify({version:1,partida:balanceView(balanceSession||emptyBalanceData()),acumulado:balanceView(total),benchmarks:balanceBenchmarks(total)},null,2);
}
function renderBalancePanel(){
  const body=$("balanceBody");if(!body)return;const parsed=JSON.parse(exportBalanceJSON());
  body.textContent=JSON.stringify(parsed,null,2);$("balanceWarnings").textContent=parsed.benchmarks.length?`⚠ ${parsed.benchmarks.join(" · ")}`:"✅ Sin alertas con los datos disponibles.";
}
function openBalancePanel(){if(!balanceEnabled)return;renderBalancePanel();$("balanceModal").style.display="flex";}
function enableBalanceMode(){
  if(balanceEnabled)return;balanceEnabled=true;$("btnBalance").style.display="block";renderBalancePanel();openBalancePanel();
}
function copyBalanceJSON(){const json=exportBalanceJSON(),out=$("balanceBody");out.textContent=json;
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(json);else{out.select();document.execCommand("copy");}}catch(e){}
  return json;
}
function initBalanceMode(){
  if(!balanceSession)resetBalanceSession();
  $("btnBalance").onclick=openBalancePanel;$("btnCopyBalance").onclick=copyBalanceJSON;
  $("gameTitle").addEventListener("click",()=>{balanceTitleTaps++;if(balanceTitleTaps>=5)enableBalanceMode();});
  try{if(new URLSearchParams(location.search).get("debug")==="1")enableBalanceMode();}catch(e){}
}
