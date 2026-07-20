/* ==================== 14-balance.js ====================
   Modo Balance (Fase 2F): telemetría local, solo lectura y sin autoajustes. */
const BALANCE_KEY="IDM_BALANCE_V1";
const BALANCE_SESSION_KEY="IDM_BALANCE_PARTIDA_V1";
let balanceEnabled=false,balanceTitleTaps=0,balanceSession=null;

function emptyEconomyBalance(){return{
  empires:{},recruitment:{attempts:0,completed:0,partial:0,blocked:{},goldSpent:0,foodSpent:0,owners:{jugador:0,IA:0}},keyRounds:{}
};}
function emptyBalanceData(){return{
  battles:{count:0,durationTotal:0},units:{},heroes:{},damage:{},wins:{},
  games:{count:0,durationTotal:0},difficulty:{},events:{},duels:{},relics:{},relicEquipment:{},
  matchups:{},structureDamage:{},unableToAttack:{},compositions:{},economy:emptyEconomyBalance()
};}
function normalizeEconomyBalance(value){
  const economy=value&&typeof value==="object"?value:emptyEconomyBalance();
  if(!economy.empires||typeof economy.empires!=="object")economy.empires={};
  if(!economy.keyRounds||typeof economy.keyRounds!=="object")economy.keyRounds={};
  if(!economy.recruitment||typeof economy.recruitment!=="object")economy.recruitment=emptyEconomyBalance().recruitment;
  const recruitment=economy.recruitment;
  for(const key of["attempts","completed","partial","goldSpent","foodSpent"])recruitment[key]=+recruitment[key]||0;
  if(!recruitment.blocked||typeof recruitment.blocked!=="object")recruitment.blocked={};
  if(!recruitment.owners||typeof recruitment.owners!=="object")recruitment.owners={jugador:0,IA:0};
  recruitment.owners.jugador=+recruitment.owners.jugador||0;recruitment.owners.IA=+recruitment.owners.IA||0;
  return economy;
}
function normalizeBalanceData(d){
  const b=d&&typeof d==="object"?d:emptyBalanceData();
  for(const k of["battles","units","heroes","damage","wins","games","difficulty","events","duels","relics","relicEquipment","matchups","structureDamage","unableToAttack","compositions"])
    if(!b[k]||typeof b[k]!=="object")b[k]=emptyBalanceData()[k];
  b.battles.count=b.battles.count|0;b.battles.durationTotal=+b.battles.durationTotal||0;
  b.games.count=b.games.count|0;b.games.durationTotal=+b.games.durationTotal||0;
  b.economy=normalizeEconomyBalance(b.economy);
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
function economicEmpireEntry(economy,fid){
  const fields={samples:0,populationTotal:0,troopsTotal:0,availableTotal:0,capacityRatioTotal:0,rounds80:0,rounds100:0,
    roundsOver:0,subsistenceFood:0,growthFood:0,populationGrowth:0,scarcityRounds:0,foodTotal:0,goldTotal:0,
    territoriesTotal:0,currentOverStreak:0,maxOverStreak:0,playerSamples:0,aiSamples:0,firstFullRound:null};
  const entry=economy.empires[fid]||(economy.empires[fid]={});
  for(const[key,value]of Object.entries(fields))if(entry[key]===undefined)entry[key]=value;
  return entry;
}
function economicMetrics(fid){
  const state=currentStrategicRecruitmentState(),capacity=getEmpirePopulationCapacity(state,fid),troops=getEmpireTroopsUsed(state,fid);
  const territories=ownedBy(fid),population=territories.reduce((n,id)=>n+(+T[id].pop||0),0),faction=F[fid]||{};
  return{fid,owner:balanceOwner(fid),population,troops,capacity,available:capacity-troops,ratio:capacity?troops/capacity:0,
    territories:territories.length,gold:+faction.gold||0,food:+faction.food||0};
}
function addEconomicRound(data,metrics,growth,sampleRound){
  const economy=normalizeEconomyBalance(data.economy),entry=economicEmpireEntry(economy,metrics.fid);entry.samples++;
  entry.populationTotal+=metrics.population;entry.troopsTotal+=metrics.troops;entry.availableTotal+=metrics.available;
  entry.capacityRatioTotal+=metrics.ratio;entry.territoriesTotal+=metrics.territories;entry.goldTotal+=metrics.gold;entry.foodTotal+=metrics.food;
  if(metrics.ratio>=.8)entry.rounds80++;if(metrics.ratio>=1)entry.rounds100++;if(metrics.ratio>1)entry.roundsOver++;
  entry.currentOverStreak=metrics.ratio>1?entry.currentOverStreak+1:0;entry.maxOverStreak=Math.max(entry.maxOverStreak,entry.currentOverStreak);
  entry[metrics.owner==="jugador"?"playerSamples":"aiSamples"]++;
  if(metrics.ratio>=1&&entry.firstFullRound===null)entry.firstFullRound=sampleRound;
  entry.subsistenceFood+=+growth.paidSubsistence||0;entry.growthFood+=+growth.growthCost||0;
  entry.populationGrowth+=+growth.growth||0;if(growth.scarcity)entry.scarcityRounds++;
}
function averageEconomicSide(metrics){
  if(!metrics.length)return{capacity:0,troops:0,gold:0,food:0,territories:0};
  return Object.fromEntries(["capacity","troops","gold","food","territories"].map(key=>[key,metrics.reduce((n,x)=>n+x[key],0)/metrics.length]));
}
function addEconomicKeyRound(data,sampleRound,metrics){
  if(![1,3,6,10].includes(sampleRound))return;
  const key=String(sampleRound),entry=data.economy.keyRounds[key]||(data.economy.keyRounds[key]={samples:0,player:{},ai:{}});
  const playerSide=averageEconomicSide(metrics.filter(x=>x.owner==="jugador")),aiSide=averageEconomicSide(metrics.filter(x=>x.owner==="IA"));
  entry.samples++;for(const side of["player","ai"]){const source=side==="player"?playerSide:aiSide;
    for(const field of["capacity","troops","gold","food","territories"])entry[side][field]=(entry[side][field]||0)+source[field];}
}
function recordBalanceEconomicCycle(reports,sampleRound=round){
  if(!balanceSession)return;const metrics=(reports||[]).map(report=>economicMetrics(report.fid)),total=loadBalanceTotal();
  for(const data of[balanceSession,total]){for(const report of reports||[]){const metric=metrics.find(x=>x.fid===report.fid);if(metric)addEconomicRound(data,metric,report.growth||{},sampleRound);}
    addEconomicKeyRound(data,sampleRound,metrics);}
  saveBalanceSession();saveBalanceTotal(total);
}
function recruitmentBlockKey(reason=""){
  const value=reason.toLowerCase();if(value.includes("sobre")&&value.includes("capacidad"))return"sobre_capacidad";
  if(value.includes("poblacional imperial"))return"capacidad_imperial";if(value.includes("militar local"))return"capacidad_local";
  if(value.includes("ya reclut"))return"territorio_usado";if(value.includes("mite de 2"))return"limite_imperial";
  if(value.includes("oro"))return"falta_oro";if(value.includes("comida"))return"falta_comida";return"otro";
}
function addRecruitmentTelemetry(data,fid,evaluation){
  const entry=normalizeEconomyBalance(data.economy).recruitment;entry.attempts++;entry.owners[balanceOwner(fid)]++;
  if(evaluation.ok){entry.completed++;if(evaluation.actualAmount<evaluation.requestedAmount)entry.partial++;
    entry.goldSpent+=+evaluation.cost.gold||0;entry.foodSpent+=+evaluation.cost.food||0;}
  else{const cause=recruitmentBlockKey(evaluation.reason);entry.blocked[cause]=(entry.blocked[cause]||0)+1;}
}
function recordBalanceStrategicRecruitment(fid,evaluation){
  if(!balanceSession)return;const total=loadBalanceTotal();addRecruitmentTelemetry(balanceSession,fid,evaluation);addRecruitmentTelemetry(total,fid,evaluation);
  saveBalanceSession();saveBalanceTotal(total);
}
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
  const economy=normalizeEconomyBalance(data.economy),economicEmpires=Object.fromEntries(Object.entries(economy.empires).map(([fid,x])=>[fid,{
    muestras:x.samples,poblacionTotal:x.populationTotal,tropasUsadas:x.troopsTotal,capacidadDisponible:x.availableTotal,
    porcentajeCapacidadMedio:x.samples?+(x.capacityRatioTotal/x.samples).toFixed(3):0,rondas80:x.rounds80,rondas100:x.rounds100,
    rondasSobreCapacidad:x.roundsOver,rachaMaximaSobreCapacidad:x.maxOverStreak,subsistencia:x.subsistenceFood,
    comidaCrecimiento:x.growthFood,crecimiento:x.populationGrowth,rondasEscasez:x.scarcityRounds,
    comidaMedia:x.samples?+(x.foodTotal/x.samples).toFixed(2):0,oroMedio:x.samples?+(x.goldTotal/x.samples).toFixed(2):0,
    territoriosMedios:x.samples?+(x.territoriesTotal/x.samples).toFixed(2):0,primeraRondaLlena:x.firstFullRound,
    muestrasJugador:x.playerSamples,muestrasIA:x.aiSamples}]));
  const keyRounds=Object.fromEntries(Object.entries(economy.keyRounds).map(([key,x])=>[key,{muestras:x.samples,
    jugador:Object.fromEntries(Object.entries(x.player||{}).map(([k,v])=>[k,x.samples?+(v/x.samples).toFixed(2):0])),
    mediaIA:Object.fromEntries(Object.entries(x.ai||{}).map(([k,v])=>[k,x.samples?+(v/x.samples).toFixed(2):0]))}]));
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
    economia3D:{porImperio:economicEmpires,reclutamiento:{...economy.recruitment,
      tasaBloqueo:economy.recruitment.attempts?+(Object.values(economy.recruitment.blocked).reduce((n,v)=>n+v,0)/economy.recruitment.attempts).toFixed(3):0},rondasClave:keyRounds},
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
  const economy=v.economia3D,recruitment=economy.reclutamiento,round6=economy.rondasClave["6"];
  if(round6&&round6.muestras>=1&&round6.mediaIA.capacity>0&&round6.jugador.capacity>round6.mediaIA.capacity*1.4)reports.push("Jugador supera 40% la capacidad media IA en ronda 6");
  if(round6&&round6.muestras>=1&&round6.mediaIA.troops>0&&round6.jugador.troops>round6.mediaIA.troops*1.4)reports.push("Jugador supera 40% las tropas medias IA en ronda 6");
  if(recruitment.attempts>=20&&recruitment.tasaBloqueo>.25)reports.push("Mas de 25% de intentos de reclutamiento quedan bloqueados");
  for(const[fid,x]of Object.entries(economy.porImperio)){
    if(x.muestras>=6&&x.comidaMedia>=100&&x.comidaCrecimiento/x.muestras<2)reports.push(`${fid} acumula comida con poco crecimiento`);
    if(x.muestras>=6&&x.rondasEscasez/x.muestras>=.4)reports.push(`${fid} sufre escasez frecuente`);
    if(x.muestrasIA&&x.rachaMaximaSobreCapacidad>=3)reports.push(`${fid} IA permanece sobre capacidad durante 3 rondas`);
    if(x.muestrasJugador&&x.primeraRondaLlena!==null&&x.primeraRondaLlena<=3)reports.push(`${fid} jugador alcanza capacidad completa demasiado temprano`);
  }
  if(v.partidas>=5&&v.duracionMediaPartida>690)reports.push("Duracion media de partida supera 15% el objetivo de 10 minutos");
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
