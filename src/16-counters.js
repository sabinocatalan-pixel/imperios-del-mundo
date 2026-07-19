/* ==================== 16-counters.js ====================
   Fase 3F: fuente declarativa única consumida por el motor desde 3F-2. */

const COUNTER_TYPES=["melee","ranged","heavy","healer","siege","air"];

const COUNTER_MATRIX={
  melee: {melee:1,ranged:1.5,heavy:0.75,healer:1,siege:1.5,air:0},
  ranged:{melee:0.75,ranged:1,heavy:1.5,healer:1,siege:1,air:1.5},
  heavy: {melee:1.5,ranged:0.75,heavy:1,healer:1,siege:1,air:0},
  healer:{melee:0,ranged:0,heavy:0,healer:0,siege:0,air:0},
  siege: {melee:1,ranged:1,heavy:1,healer:1,siege:1,air:0},
  air:   {melee:1,ranged:1,heavy:1.5,healer:1,siege:1.5,air:1}
};

const STRUCTURE_MULTIPLIERS={melee:1,ranged:1,heavy:1,healer:0,siege:1,air:0.75,hero:1};

const UNIT_COUNTER_CATALOG={
  melee:{label:"Cuerpo a cuerpo",role:"frontline",specialRule:"Alcanza y anula asedio a menos de 80 px."},
  ranged:{label:"Distancia",role:"backline",specialRule:"Antiaéreo natural."},
  heavy:{label:"Pesada",role:"frontline",specialRule:"Pantalla resistente; no alcanza unidades aéreas."},
  healer:{label:"Sanador",role:"support",specialRule:"Soporte puro: cura aliados y no ataca."},
  siege:{label:"Asedio",role:"indirect",minRange:80,suppressedBy:["melee"],specialRule:"Disparo indirecto; melee dentro de 80 px lo anula."},
  air:{label:"Aérea",role:"air",specialRule:"Vuela sobre la línea terrestre; daño a estructuras ×0.75."},
  hero:{label:"Héroe",role:"hero",special:true,specialRule:"Categoría especial, fuera de la matriz 6×6."}
};

const HERO_COUNTER_RULES={hero:{heavy:0.85},ranged:{hero:1}};
const COUNTER_ICONS={melee:"🗡",ranged:"🏹",heavy:"🛡",healer:"✚",siege:"💥",air:"✈️",hero:"⭐"};

function normalizedCounterKind(kind){return kind==="champ"?"hero":kind;}
function getCounterMultiplier(attackerKind,defenderKind,context={}){
  const attacker=normalizedCounterKind(attackerKind),defender=normalizedCounterKind(defenderKind);
  if(context.duel||context.battleType==="boss")return 1;
  if(HERO_COUNTER_RULES[attacker]&&HERO_COUNTER_RULES[attacker][defender]!==undefined)return HERO_COUNTER_RULES[attacker][defender];
  if(COUNTER_MATRIX[attacker]&&COUNTER_MATRIX[attacker][defender]!==undefined)return COUNTER_MATRIX[attacker][defender];
  return 1;
}
function canTargetKind(attackerKind,defenderKind,context={}){return getCounterMultiplier(attackerKind,defenderKind,context)>0;}
function getStrongTargets(kind){
  const attacker=normalizedCounterKind(kind);if(!COUNTER_MATRIX[attacker])return[];
  return COUNTER_TYPES.filter(target=>COUNTER_MATRIX[attacker][target]>1);
}
function getWeakAgainst(kind){
  const target=normalizedCounterKind(kind);if(!COUNTER_TYPES.includes(target))return[];
  return COUNTER_TYPES.filter(attacker=>COUNTER_MATRIX[attacker][target]>1);
}
function getStructureMultiplier(kind,context={}){
  const normalized=normalizedCounterKind(kind);if(context.duel||context.battleType==="boss")return 1;
  return STRUCTURE_MULTIPLIERS[normalized]===undefined?1:STRUCTURE_MULTIPLIERS[normalized];
}
function getCounterDescription(kind){
  const normalized=normalizedCounterKind(kind),meta=UNIT_COUNTER_CATALOG[normalized];if(!meta)return null;
  const unreachable=COUNTER_MATRIX[normalized]?COUNTER_TYPES.filter(target=>COUNTER_MATRIX[normalized][target]===0):[];
  return{kind:normalized,label:meta.label,role:meta.role,venceA:getStrongTargets(normalized),debilContra:getWeakAgainst(normalized),
    noAlcanza:unreachable,reglaEspecial:meta.specialRule,minRange:meta.minRange||0,suppressedBy:[...(meta.suppressedBy||[])]};
}
function counterKindName(kind){const meta=UNIT_COUNTER_CATALOG[normalizedCounterKind(kind)];return meta?meta.label:kind;}
function counterKindList(kinds){return kinds.map(kind=>`${COUNTER_ICONS[kind]||""} ${counterKindName(kind)}`).join(", ");}
function getCounterButtonHelp(kind){
  const d=getCounterDescription(kind);if(!d)return{compact:"",full:""};
  if(d.kind==="healer")return{compact:"Cura aliados · No ataca · máx. 2",full:d.reglaEspecial};
  if(d.kind==="hero")return{compact:"Especial · Pesada resiste su daño",full:d.reglaEspecial+" Pesada recibe ×0.85 de su daño."};
  const lines=[];
  if(d.venceA.length)lines.push(`Vence a: ${counterKindList(d.venceA)}`);
  if(d.debilContra.length)lines.push(`Débil contra: ${counterKindList(d.debilContra)}`);
  if(d.noAlcanza.length)lines.push(`No alcanza: ${counterKindList(d.noAlcanza)}`);
  if(d.kind==="heavy")lines.push("Resiste Héroe: ×0.85");
  if(d.kind==="siege")lines.push("Melee <80 px lo anula");
  if(d.kind==="air")lines.push("Estructuras: ×0.75");
  return{compact:lines.join(" · "),full:[...lines,d.reglaEspecial].filter(Boolean).join(". ")};
}
