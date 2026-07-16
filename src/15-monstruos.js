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
