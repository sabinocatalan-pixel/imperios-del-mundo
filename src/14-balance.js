/* ==================== 14-balance.js ====================
   Modo Balance (Fase 2F): telemetría local, solo lectura y sin autoajustes. */
const BALANCE_KEY="IDM_BALANCE_V1";
const BALANCE_SESSION_KEY="IDM_BALANCE_PARTIDA_V1";
let balanceEnabled=false,balanceTitleTaps=0,balanceSession=null;

function emptyBalanceData(){return{
  battles:{count:0,durationTotal:0},units:{},heroes:{},damage:{},wins:{},
  games:{count:0,durationTotal:0},difficulty:{},events:{},duels:{}
};}
function normalizeBalanceData(d){
  const b=d&&typeof d==="object"?d:emptyBalanceData();
  for(const k of["battles","units","heroes","damage","wins","games","difficulty","events","duels"])
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
  }
}
function recordBalanceBattle(b,win){
  if(!b)return;const total=loadBalanceTotal();addBattleTelemetry(balanceSession,b,win);addBattleTelemetry(total,b,win);saveBalanceSession();saveBalanceTotal(total);renderBalancePanel();
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
  return{
    duracionMediaBatalla:data.battles.count?+(data.battles.durationTotal/data.battles.count).toFixed(2):0,
    batallas:data.battles.count,unidades:rates(data.units),heroes:rates(data.heroes),
    danoMedioPorTipo:Object.fromEntries(Object.entries(data.damage).map(([k,v])=>[k,v.samples?+(v.total/v.samples).toFixed(2):0])),
    victoriasPorImperioDificultad:data.wins,
    duracionMediaPartida:data.games.count?+(data.games.durationTotal/data.games.count).toFixed(2):0,
    partidas:data.games.count,resultadosPorDificultad:data.difficulty,eventosMasFrecuentes:data.events,duelosPorHeroe:rates(data.duels)
  };
}
function balanceBenchmarks(data){
  const reports=[],v=balanceView(data);
  if(v.batallas&& (v.duracionMediaBatalla<60||v.duracionMediaBatalla>180))reports.push("Batalla media fuera de 60–180s");
  for(const[k,x]of Object.entries(v.unidades))if(x.uso&&x.uso/Object.values(v.unidades).reduce((n,u)=>n+u.uso,0)>0.6)reports.push(`${k} supera 60% de uso`);
  for(const[k,x]of Object.entries(v.duelosPorHeroe))if(x.uso&&x.tasaVictoria>0.65)reports.push(`${k} supera 65% de victorias en duelo`);
  const nightmare=v.resultadosPorDificultad.Pesadilla;
  if(nightmare&&nightmare.games&&nightmare.playerWins/nightmare.games>=0.35)reports.push("Pesadilla alcanza o supera 35% de victorias");
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
