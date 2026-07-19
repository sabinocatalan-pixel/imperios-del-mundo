/* ==================== 08-turnos.js ====================
   Ciclo de turnos, ofertas diplomáticas y clic en el mapa. */
/* ==================== TURNOS ==================== */
function startPlayerTurn(){startRound();} // alias para compatibilidad
function startRound(){
  turnSummaryLines=[]; // nueva ronda: reinicia lo que verá el Resumen del turno
  autoSaveGame();
  incomePhase();
  resetMonsterAttemptsForRound(monsterState,round);
  applyMonsterRaid(monsterState,round);
  trySpawnMonster(monsterState,round);
  updateCoalition();
  if(checkEnd())return;
  checkScenario();if(phase==="over")return;
  turnIdx=0;beginHumanTurn();
}
function beginHumanTurn(){
  while(turnIdx<humans.length&&!alive().includes(humans[turnIdx]))turnIdx++;
  if(turnIdx>=humans.length){aiTurns(true);return;}
  player=humans[turnIdx];phase="play";selected=null;relicChangeOpen=true;
  const quien=humans.length>1?`Turno de <strong>${fname(player)}</strong> — `:"";
  setStatus(`Ronda <strong>${round}</strong> — ${quien}Territorio tuyo → vecino enemigo para <strong>batalla</strong>. Territorio enemigo = diplomacia.`);
  maybeShowOffer();
  render();
}
function endHumanTurn(){
  if(inBattle||phase!=="play")return;
  relicChangeOpen=false;SFX.click();turnIdx++;
  if(turnIdx<humans.length)beginHumanTurn();else aiTurns(true);
}
function maybeShowOffer(){
  if(!pendingOffer||pendingOffer.to!==player)return;
  const o=pendingOffer,fn=fname(o.from);
  $("dipTitle").textContent=o.type==="nap"?"🕊 Propuesta de paz":"⚠️ Exigencia de tributo";
  $("dipText").innerHTML=o.type==="nap"
    ?`${fn} te propone un <b>pacto de no agresión</b> por 5 rondas.`
    :`${fn} exige un tributo de <b>${o.gold}🪙</b>. Si te niegas, las relaciones caerán gravemente.`;
  $("diploModal").style.display="flex";
}
function resolveOffer(accept){
  const o=pendingOffer;pendingOffer=null;
  relicChangeOpen=false;
  $("diploModal").style.display="none";SFX.click();
  if(!o)return;
  if(o.type==="nap"){
    if(accept){pacts.push({a:o.from,b:o.to,type:"nap",rounds:5});relAdd(o.from,o.to,12);
      log(`Aceptaste el pacto con ${fname(o.from)}.`,"win");}
    else{relAdd(o.from,o.to,-10);log(`Rechazaste la paz de ${fname(o.from)}.`);}
  }else{
    if(accept&&F[o.to].gold>=o.gold){F[o.to].gold-=o.gold;F[o.from].gold+=o.gold;
      relAdd(o.from,o.to,12);log(`Pagaste el tributo a ${fname(o.from)}.`);}
    else{relAdd(o.from,o.to,-25);log(`Te negaste al tributo de ${fname(o.from)}. Se avecina guerra.`,"loss");}
  }
  render();
}
/* ==================== RESUMEN DEL TURNO ====================
   Adelanto de la Fase 2E (pilar 6/7): panel compacto tras la fase IA,
   3-6 líneas causales (turnSummaryLines, ver 04-estado.js), auto-cierra
   a los ~6s o al tocar. El log detallado de abajo sigue igual, sin
   recortes — esto es solo un resumen legible encima. */
let turnSummaryTimer=null;
function showTurnSummary(){
  if(!turnSummaryLines.length)return; // ronda sin eventos causales: no molestar con un panel vacío
  const lines=turnSummaryLines.slice(0,6);
  $("resumenBody").innerHTML=lines.map(l=>`<div class="resumenLinea ${l.c||""}">${l.m}</div>`).join("");
  $("resumenModal").style.display="flex";
  clearTimeout(turnSummaryTimer);
  turnSummaryTimer=setTimeout(closeTurnSummary,6000);
}
function closeTurnSummary(){
  clearTimeout(turnSummaryTimer);
  $("resumenModal").style.display="none";
}
/* ==================== COALICIÓN ANTI-LÍDER (Fase 2E) ==================== */
function empirePower(fid){
  const ids=ownedBy(fid),f=F[fid];
  return ids.length*3+f.gold/50+f.science/30+
    ids.reduce((n,id)=>n+T[id].troops,0)*0.5+
    ids.reduce((n,id)=>n+T[id].base,0)*2+(f.heroes[0]?2:0);
}
function leaderThreat(){
  const vivos=alive();if(vivos.length<2)return{leader:vivos[0]||null,threat:0,average:0};
  const powers=vivos.map(fid=>({fid,p:empirePower(fid)})).sort((a,b)=>b.p-a.p);
  const leader=powers[0],average=powers.slice(1).reduce((n,x)=>n+x.p,0)/(powers.length-1);
  return{leader:leader.fid,threat:average>0?(leader.p-average)/average:0,average};
}
function coalitionChance(threat){return Math.max(0,Math.min(0.75,(threat-0.25)*0.8));}
function coalitionDuration(){return diffMult===1.5?4:3;}
function isNeighborEmpire(a,b){return ownedBy(a).some(id=>ADJ[id].some(x=>T[x].owner===b));}
function coalitionDesire(fid,leader,threat){
  return threat*0.4+(relGet(fid,leader)<0?0.25:0)+(isNeighborEmpire(fid,leader)?0.15:0)+
    FACTIONS[fid].aggr*0.10-(pactBetween(fid,leader)?0.25:0);
}
function expireCoalition(reason){
  if(!coalition)return;
  coalitionCooldownUntil=round+3;
  logCausal(`🌍 La coalición contra ${fname(coalition.leader)} se disolvió: ${reason}. Cooldown: 2 rondas.`);
  pacts=pacts.filter(p=>!p.coalition);coalition=null;
}
function updateCoalition(){
  if(diffMult<1.3||round<8)return;
  const a=leaderThreat();
  if(coalition){
    if(a.leader!==coalition.leader||a.threat<0.15)return expireCoalition("la amenaza cayó por debajo del 15%");
    coalition.rounds--;
    if(coalition.rounds<=0)return expireCoalition("terminó su duración pactada");
    logCausal(coalition.leader===player
      ?`🌍 Coalición activa: ${coalition.rounds} rondas restantes en tu contra.`
      :`🌍 Coalición activa contra ${fname(coalition.leader)}: ${coalition.rounds} rondas restantes.`);
    return;
  }
  if(coalitionCooldownUntil!==null&&round<coalitionCooldownUntil){
    logCausal(`🌍 Coalición en cooldown: ${coalitionCooldownUntil-round} rondas restantes antes de poder reformarse.`);
    return;
  }
  const reformation=coalitionCooldownUntil!==null;
  if(a.threat<=(reformation?0.35:0.25)||Math.random()>=coalitionChance(a.threat))return;
  const members=alive().filter(fid=>fid!==a.leader&&coalitionDesire(fid,a.leader,a.threat)>0.45);
  if(members.length<2)return;
  const duration=coalitionDuration();
  coalition={leader:a.leader,members,rounds:duration};
  pacts=pacts.filter(p=>!members.some(m=>(p.a===m&&p.b===a.leader)||(p.b===m&&p.a===a.leader)));
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)
    if(!pactBetween(members[i],members[j]))pacts.push({a:members[i],b:members[j],type:"ali",rounds:duration,coalition:true});
  const names=members.map(fname).join(", ");
  const msg=a.leader===player
    ?`Tu imperio domina el mundo. ${names} ${reformation?"reforman":"forman"} una COALICIÓN para contenerte — ${duration} rondas.`
    :`${fname(a.leader)} domina el mundo. ${names} ${reformation?"reforman":"forman"} una COALICIÓN para contenerlo — ${duration} rondas.`;
  showWorldBanner("🌍 COALICIÓN MUNDIAL",msg);logCausal(`🌍 ${msg}`,a.leader===player?"loss":"");
}
function aiTurns(fromTurnFlow){
  if(inBattle)return;
  if(!fromTurnFlow&&phase!=="play")return;
  phase="ai";selected=null;relicChangeOpen=false;aiRelicChangeEmpire=null;
  setStatus("Los imperios rivales maniobran…");render();
  const enemies=alive().filter(x=>!humans.includes(x));let i=0;
  function step(){
    if(inBattle){aiCont=step;return;} // pausa si hay batalla de defensa
    if(i>=enemies.length){round++;showTurnSummary();if(!checkEnd())startRound();return;}
    const fid=enemies[i++],f=F[fid],P=FACTIONS[fid];
    const mineAll=ownedBy(fid);
    if(!mineAll.length){setTimeout(step,80);return;} // facción eliminada durante la ronda
    aiRelicChangeEmpire=fid;
    try{applyAIRelicChoice(currentRelicState(),fid);}finally{aiRelicChangeEmpire=null;}
    // economía según personalidad
    const spend=P.eco>0.6?0.5:0.75;
    if(f.gold>=25&&Math.random()<spend+0.25){
      const t=T[mineAll[Math.floor(Math.random()*mineAll.length)]];
      if(t){f.gold-=14;t.troops=Math.min(99,t.troops+4);}
    }
    if(f.era<3&&f.science>=ERA_COST[f.era+1]){f.science-=ERA_COST[f.era+1];f.era++;
      log(`${P.name} avanzó a la ${ERAS[f.era]}.`);}
    if(f.gold>=60&&f.upArm<3&&Math.random()<0.3){f.gold-=40;f.upArm++;}
    if(P.eco>0.6&&f.gold>=60&&f.upEco<3&&Math.random()<0.4){f.gold-=35;f.upEco++;}
    if(!f.heroes[0]&&Math.random()<0.25){
      const avail=Object.keys(ALL_HEROES).filter(id=>ALL_HEROES[id].tipoAtaque&&isHeroUnlocked(id)&&difficultyAllowsHero(id));
      if(avail.length)setHeroSlot(fid,0,avail[Math.floor(Math.random()*avail.length)]);
    }
    for(const slot of[1,2]){ // consejo: misma regla que el activo (pilar 4: sin ayudas para la IA, tampoco desventajas)
      if(!f.heroes[slot]&&Math.random()<0.25){
        const avail=Object.keys(ALL_HEROES).filter(id=>isHeroUnlocked(id)&&difficultyAllowsHero(id)&&!f.heroes.includes(id));
        if(avail.length)setHeroSlot(fid,slot,avail[Math.floor(Math.random()*avail.length)]);
      }
    }
    if(f.gold>=45&&Math.random()<0.25){const t=T[mineAll[0]];
      if(t&&t.base<3){f.gold-=30+t.base*25;t.base++;}}
    // La caza mítica usa los mismos requisitos, origen e intento por ronda
    // que el jugador; la dificultad no modifica su resolución.
    if(shouldAIChallengeMonster(monsterState,fid))resolveAIMonsterChallenge(monsterState,fid);
    // diplomacia proactiva hacia un humano
    if(!pendingOffer&&Math.random()<0.15){
      const hv=humans.filter(h=>alive().includes(h));
      const tgt=hv[Math.floor(Math.random()*hv.length)];
      if(tgt&&!pactBetween(fid,tgt)){
        const stronger=mineAll.length>ownedBy(tgt).length;
        if(!stronger&&relGet(fid,tgt)>-40){pendingOffer={from:fid,to:tgt,type:"nap"};
          logCausal(`🕊 ${P.name} te propondrá un pacto de no agresión.`);}
        else if(stronger&&P.aggr>0.5){pendingOffer={from:fid,to:tgt,type:"demand",gold:20};
          logCausal(`⚠️ ${P.name} te exigirá tributo.`);}
      }
    }
    // Pesadilla permite hasta dos ataques reales por imperio y ronda. Cada
    // pase vuelve a leer el mapa, porque el primero puede cambiar fronteras.
    const maxAtaques=diffMult===1.5?2:1;
    const thr=P.aggr>0.7?1.1:(P.aggr>0.45?1.3:1.6);
    f.attacksThisRound=0;
    function terminarFaccion(){render();if(!checkEnd())setTimeout(step,380);}
    function paseAtaque(n){
      if(n>=maxAtaques)return terminarFaccion();
      let lanzado=false;
      for(const from of ownedBy(fid)){
        if(lanzado)break;
        let tg=ADJ[from].filter(x=>T[x].owner!==fid&&!pactBetween(fid,T[x].owner));
        const objetivoCoalicion=coalition&&coalition.members.includes(fid)?coalition.leader:null;
        if(objetivoCoalicion)tg.sort((a,b)=>(T[b].owner===objetivoCoalicion)-(T[a].owner===objetivoCoalicion));
        else if(P.pers==="oportunista")tg.sort((a,b)=>T[a].troops-T[b].troops);
        else tg.sort((a,b)=>(T[a].troops+T[a].base*3)-(T[b].troops+T[b].base*3));
        for(const to of tg){
          const hostil=relGet(fid,T[to].owner)<20||humans.includes(T[to].owner);
          if(hostil&&T[from].troops>T[to].troops*thr&&T[from].troops>5&&Math.random()<P.aggr){
            arrowFX(from,to);lanzado=true;f.attacksThisRound++;
            if(humans.includes(T[to].owner)){
              logCausal(`⚔️ ¡${P.name} ataca ${TERR[to].n}! Defiende tu territorio.`,"loss");
              openBattle(from,to,"defense");
              aiCont=()=>paseAtaque(n+1);render();return;
            }
            const atacado=T[to].owner,r=autoBattle(from,to);
            relAdd(fid,atacado,-15);
            if(r.win){flashTerr(to);logCausal(`${FACTIONS[fid].emb} ${P.name} conquistó ${TERR[to].n}.`);}
            else logCausal(`${P.name} fue rechazado en ${TERR[to].n}.`);
            break;
          }
        }
      }
      if(lanzado&&n+1<maxAtaques)setTimeout(()=>paseAtaque(n+1),80);
      else terminarFaccion();
    }
    paseAtaque(0);
  }
  setTimeout(step,380);
}

/* ==================== CLIC EN MAPA ==================== */
function clickTerr(id){
  if(inBattle||phase==="over")return;
  SFX.click();
  if(phase==="pick"){
    if($("startModal").style.display==="flex")return;
    const fid=T[id].owner;
    if(humans.includes(fid)){setStatus("Ese imperio ya fue elegido: toca otro.");return;}
    humans.push(fid);F[fid].ai=false;
    ownedBy(fid).forEach(h=>{T[h].troops=8;});T[id].base=1;
    burstScreen([FACTIONS[fid].color,"#E8DCC0"],70);SFX.win();
    if(pickMode===2&&humans.length===1){
      log(`👤 Jugador 1: ${fname(fid)}.`,"win");
      setStatus("👤 <strong>Jugador 2</strong>: toca el territorio de tu imperio.");
      render();return;
    }
    player=humans[0];
    if(humans.length===1)applyLegacyBonuses();
    log(humans.length===2
      ?`👥 Duelo: ${fname(humans[0])} vs ${fname(humans[1])} (+4 imperios IA).`
      :`Tomaste el mando del ${fname(fid)} (dificultad ${difficultyName()}).`,"win");
    round=1;startRound();return;
  }
  if(phase!=="play")return;
  relicChangeOpen=false;
  const t=T[id];
  if(t.owner===player){selected=(selected===id)?null:id;render();return;}
  if(selected&&T[selected].owner===player&&ADJ[selected].includes(id)){
    if(pactBetween(player,t.owner)){
      setStatus(`Tienes un pacto con ${FACTIONS[t.owner].name}. Atacar lo rompería — toca de nuevo para romperlo y atacar.`);
      const p=pactBetween(player,t.owner);
      if(p._warned){pacts=pacts.filter(x=>x!==p);relAdd(player,t.owner,-50);
        for(const o in FACTIONS)if(o!==player&&o!==t.owner)relAdd(player,o,-10);
        log(`Rompiste tu pacto con ${FACTIONS[t.owner].name}. Tu reputación cae.`,"loss");}
      else{p._warned=true;return;}
    }
    if(T[selected].troops<=4){setStatus("Necesitas al menos 5 tropas para lanzar una ofensiva.");return;}
    openBattle(selected,id,"attack");
  }else{selected=id;render();}
}
