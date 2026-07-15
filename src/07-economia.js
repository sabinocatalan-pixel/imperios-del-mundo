/* ==================== 07-economia.js ====================
   Economía/eventos (incomePhase, plagas) y combate auto IA vs IA. */
/* ==================== ECONOMÍA / EVENTOS ==================== */
function clampEvent(x){return Math.max(0.05,Math.min(0.35,x));}
function recordWar(){warHistory.push(round);warHistory=warHistory.filter(r=>round-r<=3);}
function recordLiveEvent(type,target,negative=false){
  eventHistory.push({type,target,negative,round});
  eventHistory=eventHistory.filter(e=>round-e.round<=3);
}
function liveEventProbability(base,type,target=null){
  const vivos=alive(),n=Math.max(1,vivos.length);
  const tension=Math.min(1,warHistory.filter(r=>round-r<=3).length/n);
  const scarcity=vivos.filter(fid=>F[fid].food<5).length/n;
  const lead=leaderThreat(),leaderAdvantage=Math.max(0,Math.min(1,lead.threat));
  const repetition=eventHistory.some(e=>e.type===type&&round-e.round<=2)?1:0;
  const saturation=Math.min(1,eventHistory.filter(e=>round-e.round<=3).length/3);
  let p=base+tension*0.12+scarcity*0.10+leaderAdvantage*0.08-repetition*0.15-saturation*0.10;
  if(target&&eventHistory.filter(e=>e.target===target&&e.negative&&round-e.round<=3).length>=2)p*=0.5;
  if(target&&target===lead.leader)p*=1.2;
  return clampEvent(p);
}
function incomePhase(){
  for(const fid of alive()){
    const f=F[fid];let g=0,fo=0,sc=0,fa=0,cu=0;
    for(const id of ownedBy(fid)){
      const t=T[id],d=TERR[id];
      g+=4+Math.floor(t.pop*0.3)+t.base*2;fo+=2;sc+=1+f.era;fa+=1;cu+=1+t.base;
      if(d.res==="oro")g+=3;if(d.res==="comida")fo+=3;
      if(d.res==="ciencia")sc+=2;if(d.res==="fe")fa+=2;
    }
    for(const cn in CONTINENTS){const c=CONTINENTS[cn];
      if(c.ids.every(id=>T[id].owner===fid))g+=c.bonus;}
    const mult=(fid===player?1:diffMult);
    f.gold+=Math.floor(g*(1+f.upEco*0.2)*mult);
    f.food+=fo;f.science+=sc;f.faith+=fa;f.culture+=cu;
    if(f.heroes[1]==="pachacutec"||f.heroes[2]==="pachacutec"){ // consejo: +1🪙/ronda por territorio sudamericano
      f.gold+=ownedBy(fid).filter(id=>CONTINENTS["Sudamérica"].ids.includes(id)).length;
    }
  }
  for(const id in T){
    const t=T[id],f=F[t.owner];
    if(t.plague>0){
      t.pop=Math.max(2,Math.floor(t.pop*0.85));t.troops=Math.max(1,Math.floor(t.troops*0.8));
      t.plague=Math.max(0,t.plague-1-(f?f.upMed:0));
      if(t.plague===0)log(`La plaga terminó en ${TERR[id].n}.`);
    }else if(f&&f.food>0){t.pop=Math.min(80,t.pop+1);f.food--;}
  }
  const plagueBase=0.07*(scenario&&scenario.plagueX?scenario.plagueX:1);
  if(Math.random()<liveEventProbability(plagueBase,"plaga")){
    const ids=Object.keys(T),v=ids[Math.floor(Math.random()*ids.length)];
    if(T[v].plague===0){T[v].plague=2;recordLiveEvent("plaga",T[v].owner,true);
      logCausal(`☣ Brote de peste en ${TERR[v].n}: la tensión y la escasez elevaron el riesgo.`,"loss");}
  }
  const pf=F[player];
  if(pf&&pf.faith>=100&&Math.random()<0.15){
    const en=Object.keys(T).filter(id=>T[id].owner!==player);
    const v=en[Math.floor(Math.random()*en.length)];
    if(v){T[v].troops=Math.max(1,T[v].troops-2);
      log(`✨ Misioneros de ${FACTIONS[player].rel} debilitan ${TERR[v].n} (-2 tropas).`);}
  }
  pacts.forEach(p=>p.rounds--);
  pacts=pacts.filter(p=>{if(p.rounds<=0&&(p.a===player||p.b===player))
    logCausal(`El ${p.type==="ali"?"tratado de alianza":"pacto"} con ${FACTIONS[p.a===player?p.b:p.a].name} expiró.`);
    return p.rounds>0;});
  checkContinentMission();
}
function checkContinentMission(){
  if(!player)return;
  for(const cn in CONTINENTS)
    if(CONTINENTS[cn].ids.every(id=>T[id].owner===player)){completeMission("cont");break;}
}

/* ==================== AUTO-COMBATE (IA vs IA) ==================== */
function autoBattle(from,to){
  recordWar();
  const A=T[from],D=T[to],fa=F[A.owner],fd=F[D.owner];
  const ap=A.troops*(0.85+Math.random()*0.4)*(1+0.15*(fa.era+fa.upArm));
  const dp=D.troops*(0.95+Math.random()*0.4)*(1+0.15*(fd.era+fd.upArm))*(1+D.base*0.2);
  if(ap>dp){
    const prev=D.owner;
    D.owner=A.owner;D.troops=Math.max(1,Math.floor(A.troops*0.4));
    A.troops=Math.max(1,Math.floor(A.troops*0.4));D.pop=Math.max(2,Math.floor(D.pop*0.8));
    return{win:true,prev};
  }
  A.troops=Math.max(1,Math.floor(A.troops*0.5));D.troops=Math.max(1,Math.floor(D.troops*0.75));
  return{win:false};
}
function checkEnd(){
  const a=alive();
  const hAlive=humans.filter(h=>a.includes(h));
  if(a.length===1&&humans.includes(a[0]))
    return endGame("¡Victoria por conquista!",`${fname(a[0])} domina los 21 territorios.`,true,a[0]);
  if(hAlive.length===0)
    return endGame("Derrota",humans.length>1?"Ambos imperios humanos cayeron.":"Tu imperio fue borrado del mapa.",false);
  for(const h of hAlive){
    const f=F[h];
    if(f.culture>=CULT_WIN)return endGame("¡Victoria cultural!",`La civilización de ${fname(h)} ilumina el mundo.`,true,h);
    if(f.faith>=FAITH_WIN)return endGame("¡Victoria religiosa!",`${FACTIONS[h].rel} conquistó todos los corazones.`,true,h);
  }
  return false;
}
function endGame(title,text,won=true,winner=null){
  phase="over";
  if(won&&!scenario&&humans.length===1)LEGACY.wins++;
  if(won&&!scenario&&humans.length===1&&diffMult===1.3)LEGACY.hardWins=(LEGACY.hardWins|0)+1;
  if(won&&player)checkHeroLegacyUnlocks(player,won);
  autoSaveLegacy();
  $("ovTitle").textContent=title;$("ovText").textContent=text;
  $("ovLeg").value=legacyCode();
  $("overlay").style.display="flex";
  if(won){rainAll();SFX.win();}else SFX.lose();
  return true;
}
