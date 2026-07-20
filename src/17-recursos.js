/* ==================== 17-recursos.js ====================
   Fase 3D-1: modelo declarativo de capacidad y reclutamiento estratégico.
   Todavía no modifica la economía, los turnos ni los botones reales. */

const STRATEGIC_RECRUITMENT={
  baseAmount:4,
  baseCost:{gold:12,food:5},
  maxPerEmpireTurn:2,
  maxPerTerritoryTurn:1,
  localPopulationBonus:4,
  localBaseBonus:4
};
const POPULATION_GROWTH={subsistencePerTerritory:1,growthFoodCost:4,territoriesPerSlot:3,territoryCap:40};

function recruitmentTerritories(state){return state&&((state.T&&typeof state.T==="object"&&state.T)||state.territories)||{};}
function recruitmentFactions(state){return state&&((state.F&&typeof state.F==="object"&&state.F)||state.factions)||{};}
function recruitmentCounters(state){return state&&(state.recruitmentState||state.recruitment)||{};}
function safeStrategicInteger(value){return Math.max(0,Math.floor(Number.isFinite(+value)?+value:0));}
function emptyRecruitmentState(roundValue=0){return{round:safeStrategicInteger(roundValue),byEmpire:{},byTerritory:{}};}
function normalizeRecruitmentState(value,roundValue=0){
  const targetRound=safeStrategicInteger(roundValue);
  if(!value||safeStrategicInteger(value.round)!==targetRound)return emptyRecruitmentState(targetRound);
  const clean=emptyRecruitmentState(targetRound);
  for(const[id,n]of Object.entries(value.byEmpire||{}))clean.byEmpire[id]=safeStrategicInteger(n);
  for(const[id,n]of Object.entries(value.byTerritory||{}))clean.byTerritory[id]=safeStrategicInteger(n);
  return clean;
}
function currentStrategicRecruitmentState(){return{T,F,recruitmentState};}

function getFoodSubsistenceCost(state,empireId){
  return Object.values(recruitmentTerritories(state)).filter(t=>t&&t.owner===empireId).length*POPULATION_GROWTH.subsistencePerTerritory;
}
function getMaxPopulationGrowthSlots(state,empireId){
  const territories=Object.values(recruitmentTerritories(state)).filter(t=>t&&t.owner===empireId).length;
  return territories?Math.ceil(territories/POPULATION_GROWTH.territoriesPerSlot):0;
}
function getPopulationGrowthPlan(state,empireId){
  const territories=recruitmentTerritories(state),faction=recruitmentFactions(state)[empireId];
  const ownedIds=Object.keys(territories).filter(id=>territories[id]&&territories[id].owner===empireId).sort();
  const subsistenceCost=getFoodSubsistenceCost(state,empireId),foodAvailable=safeStrategicInteger(faction&&faction.food);
  const paidSubsistence=Math.min(foodAvailable,subsistenceCost),scarcity=paidSubsistence<subsistenceCost;
  const blocked=state&&state.growthBlockedTerritories;
  const isBlocked=id=>blocked instanceof Set?blocked.has(id):Array.isArray(blocked)&&blocked.includes(id);
  const eligible=ownedIds.filter(id=>safeStrategicInteger(territories[id].pop)<POPULATION_GROWTH.territoryCap&&!isBlocked(id))
    .sort((a,b)=>safeStrategicInteger(territories[a].pop)-safeStrategicInteger(territories[b].pop)||
      safeStrategicInteger(territories[b].base)-safeStrategicInteger(territories[a].base)||a.localeCompare(b,"es"));
  const maxSlots=getMaxPopulationGrowthSlots(state,empireId);
  const affordable=scarcity?0:Math.floor((foodAvailable-subsistenceCost)/POPULATION_GROWTH.growthFoodCost);
  const growthIds=eligible.slice(0,Math.min(maxSlots,affordable));
  const growthCost=growthIds.length*POPULATION_GROWTH.growthFoodCost;
  return{empireId,ownedIds,subsistenceCost,paidSubsistence,scarcity,maxSlots,growthIds,growth:growthIds.length,
    growthCost,totalFoodCost:paidSubsistence+growthCost,cappedTerritories:ownedIds.filter(id=>safeStrategicInteger(territories[id].pop)>=POPULATION_GROWTH.territoryCap).length};
}
function applyPopulationGrowth(state,empireId){
  const plan=getPopulationGrowthPlan(state,empireId),territories=recruitmentTerritories(state),faction=recruitmentFactions(state)[empireId];
  if(!faction)return plan;
  faction.food=Math.max(0,safeStrategicInteger(faction.food)-plan.totalFoodCost);
  for(const id of plan.growthIds)territories[id].pop=Math.min(POPULATION_GROWTH.territoryCap,safeStrategicInteger(territories[id].pop)+1);
  return plan;
}

function getEmpirePopulationCapacity(state,empireId){
  return Object.values(recruitmentTerritories(state)).reduce((total,t)=>
    total+(t&&t.owner===empireId?safeStrategicInteger(t.pop):0),0);
}
function getEmpireTroopsUsed(state,empireId){
  return Object.values(recruitmentTerritories(state)).reduce((total,t)=>
    total+(t&&t.owner===empireId?safeStrategicInteger(t.troops):0),0);
}
function getEmpireAvailableCapacity(state,empireId){
  return Math.max(0,getEmpirePopulationCapacity(state,empireId)-getEmpireTroopsUsed(state,empireId));
}
function getTerritoryTroopCapacity(territory,baseLevel){
  if(!territory)return 0;
  const base=baseLevel===undefined?territory.base:baseLevel;
  return safeStrategicInteger(territory.pop)+STRATEGIC_RECRUITMENT.localPopulationBonus+
    safeStrategicInteger(base)*STRATEGIC_RECRUITMENT.localBaseBonus;
}
function getTerritoryAvailableCapacity(territory,baseLevel){
  return Math.max(0,getTerritoryTroopCapacity(territory,baseLevel)-safeStrategicInteger(territory&&territory.troops));
}
function getRecruitmentCostForAmount(amount){
  const n=Math.max(0,Math.min(STRATEGIC_RECRUITMENT.baseAmount,safeStrategicInteger(amount)));
  if(!n)return{amount:0,gold:0,food:0};
  return{amount:n,
    gold:Math.ceil(STRATEGIC_RECRUITMENT.baseCost.gold*n/STRATEGIC_RECRUITMENT.baseAmount),
    food:Math.ceil(STRATEGIC_RECRUITMENT.baseCost.food*n/STRATEGIC_RECRUITMENT.baseAmount)};
}
function getRecruitmentLimitState(state,empireId,territoryId){
  const territories=recruitmentTerritories(state),factions=recruitmentFactions(state),territory=territories[territoryId]||null;
  const counters=recruitmentCounters(state),byEmpire=counters.byEmpire||{},byTerritory=counters.byTerritory||{};
  const empireRecruitments=safeStrategicInteger(byEmpire[empireId]);
  const territoryRecruitments=safeStrategicInteger(byTerritory[territoryId]);
  const populationCapacity=getEmpirePopulationCapacity(state,empireId),troopsUsed=getEmpireTroopsUsed(state,empireId);
  const empireAvailable=Math.max(0,populationCapacity-troopsUsed);
  const territoryCapacity=territory?getTerritoryTroopCapacity(territory):0;
  const territoryAvailable=territory?getTerritoryAvailableCapacity(territory):0;
  const maxRecruitable=territory&&territory.owner===empireId&&empireRecruitments<STRATEGIC_RECRUITMENT.maxPerEmpireTurn&&
    territoryRecruitments<STRATEGIC_RECRUITMENT.maxPerTerritoryTurn
    ?Math.min(STRATEGIC_RECRUITMENT.baseAmount,empireAvailable,territoryAvailable):0;
  return{empireId,territoryId,territoryExists:!!territory,ownsTerritory:!!territory&&territory.owner===empireId,
    factionExists:!!factions[empireId],populationCapacity,troopsUsed,empireAvailable,
    territoryCapacity,territoryAvailable,empireRecruitments,territoryRecruitments,maxRecruitable};
}
function recruitmentEvaluation(state,empireId,territoryId,amount=STRATEGIC_RECRUITMENT.baseAmount){
  const limit=getRecruitmentLimitState(state,empireId,territoryId),faction=recruitmentFactions(state)[empireId];
  const requested=Math.max(1,Math.min(STRATEGIC_RECRUITMENT.baseAmount,safeStrategicInteger(amount)||STRATEGIC_RECRUITMENT.baseAmount));
  const actualAmount=Math.min(requested,limit.maxRecruitable),cost=getRecruitmentCostForAmount(actualAmount);
  let reason="";
  if(!limit.factionExists)reason="Imperio no válido.";
  else if(!limit.territoryExists)reason="Territorio no válido.";
  else if(!limit.ownsTerritory)reason="Solo puedes reclutar en un territorio propio.";
  else if(limit.empireRecruitments>=STRATEGIC_RECRUITMENT.maxPerEmpireTurn)reason="Límite de 2 reclutamientos del imperio alcanzado este turno.";
  else if(limit.territoryRecruitments>=STRATEGIC_RECRUITMENT.maxPerTerritoryTurn)reason="Este territorio ya reclutó durante el turno.";
  else if(limit.empireAvailable<=0)reason=limit.troopsUsed>limit.populationCapacity
    ?"El imperio está sobre su capacidad poblacional.":"Capacidad poblacional imperial completa.";
  else if(limit.territoryAvailable<=0)reason="Capacidad militar local completa.";
  else if(safeStrategicInteger(faction.gold)<cost.gold)reason=`Falta oro: necesitas ${cost.gold}.`;
  else if(safeStrategicInteger(faction.food)<cost.food)reason=`Falta comida: necesitas ${cost.food}.`;
  return{...limit,requestedAmount:requested,actualAmount,cost,ok:!reason&&actualAmount>0,reason};
}
function canRecruitStrategicTroops(state,empireId,territoryId,amount=STRATEGIC_RECRUITMENT.baseAmount){
  return recruitmentEvaluation(state,empireId,territoryId,amount).ok;
}
function getRecruitmentBlockReason(state,empireId,territoryId,amount=STRATEGIC_RECRUITMENT.baseAmount){
  return recruitmentEvaluation(state,empireId,territoryId,amount).reason;
}
function applyStrategicRecruitment(state,empireId,territoryId,amount=STRATEGIC_RECRUITMENT.baseAmount){
  const evaluation=recruitmentEvaluation(state,empireId,territoryId,amount);
  recordBalanceStrategicRecruitment(empireId,evaluation);
  if(!evaluation.ok)return{...evaluation,amount:0,partial:false};
  const territories=recruitmentTerritories(state),factions=recruitmentFactions(state),counters=recruitmentCounters(state);
  if(!counters.byEmpire)counters.byEmpire={};if(!counters.byTerritory)counters.byTerritory={};
  factions[empireId].gold-=evaluation.cost.gold;factions[empireId].food-=evaluation.cost.food;
  territories[territoryId].troops+=evaluation.actualAmount;
  counters.byEmpire[empireId]=safeStrategicInteger(counters.byEmpire[empireId])+1;
  counters.byTerritory[territoryId]=safeStrategicInteger(counters.byTerritory[territoryId])+1;
  return{...evaluation,amount:evaluation.actualAmount,partial:evaluation.actualAmount<evaluation.requestedAmount};
}
