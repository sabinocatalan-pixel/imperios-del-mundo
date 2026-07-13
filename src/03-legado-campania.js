/* ==================== 03-legado-campania.js ====================
   LEGACY (progresión permanente) y SCENARIOS (campaña).
   legacyCode/loadLegacy viven en 10-guardado.js. */
const LEGACY={wins:0,scen:{},champsX:false};
const EXTRA_CHAMPS=["Alejandro Magno","Túpac Amaru II","Napoleón","Trajano","Tomoe Gozen","Shaka Zulú"];
function legacyDesc(){
  const b=[];
  if(LEGACY.wins>=1)b.push("⭐ Campeones legendarios desbloqueados");
  if(LEGACY.wins>=2)b.push("🪙 +20 de oro inicial");
  if(LEGACY.wins>=3)b.push("⚔️ Campeón inicia con arma nv2");
  if(LEGACY.wins>=5)b.push("💰 Economía nv1 inicial");
  return b;
}
function renderLegacy(){
  const el=$("legacySummary");if(!el)return;
  const done=Object.keys(LEGACY.scen).filter(k=>LEGACY.scen[k]).length;
  const b=legacyDesc();
  el.innerHTML=`🏆 Victorias: <b style="color:var(--gold)">${LEGACY.wins}</b> · Escenarios: <b style="color:var(--gold)">${done}/5</b>`+
    (b.length?"<br><span style='font-size:12px'>"+b.join(" · ")+"</span>":"<br><span style='font-size:12px;opacity:.7'>Gana partidas para desbloquear mejoras permanentes.</span>");
}

const SCENARIOS=[
  {id:"s1",n:"Resistencia Andina",fac:"SO",diff:1.15,
   d:"Juega con el Imperio del Sol ☀️. Sobrevive 12 rondas con tu imperio en pie.",
   goal:{type:"survive",rounds:12}},
  {id:"s2",n:"Blitz Europeo",fac:"CO",diff:1.0,
   d:"Con Corona 👑: controla toda Europa y el Magreb antes de terminar la ronda 10.",
   goal:{type:"own",ids:["EUO","EUN","EUE","MAG"],by:10}},
  {id:"s3",n:"Cerco del Dragón",fac:"DR",diff:1.0,only:"CHN",
   d:"El Imperio Dragón 🐉 cayó: solo conservas China. Reconquista Asia en 15 rondas.",
   goal:{type:"own",ids:["MOR","RUS","IND","CHN"],by:15}},
  {id:"s4",n:"La Gran Peste",fac:null,diff:1.0,plagueX:3,
   d:"☣ Las plagas azotan el mundo sin descanso. Termina la ronda 15 con 5+ territorios.",
   goal:{type:"terr",min:5,rounds:15}},
  {id:"s5",n:"Rey del Mundo",fac:null,diff:1.3,
   d:"👑 La prueba final: conquista total de los 21 territorios en dificultad Difícil.",
   goal:{type:"conquest"}}
];
let scenario=null;
