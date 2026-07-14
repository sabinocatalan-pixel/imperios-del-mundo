/* ==================== 08-turnos.js ====================
   Ciclo de turnos, ofertas diplomáticas y clic en el mapa. */
/* ==================== TURNOS ==================== */
function startPlayerTurn(){startRound();} // alias para compatibilidad
function startRound(){
  autoSaveGame();
  incomePhase();
  if(checkEnd())return;
  checkScenario();if(phase==="over")return;
  turnIdx=0;beginHumanTurn();
}
function beginHumanTurn(){
  while(turnIdx<humans.length&&!alive().includes(humans[turnIdx]))turnIdx++;
  if(turnIdx>=humans.length){aiTurns(true);return;}
  player=humans[turnIdx];phase="play";selected=null;
  const quien=humans.length>1?`Turno de <strong>${fname(player)}</strong> — `:"";
  setStatus(`Ronda <strong>${round}</strong> — ${quien}Territorio tuyo → vecino enemigo para <strong>batalla</strong>. Territorio enemigo = diplomacia.`);
  maybeShowOffer();
  render();
}
function endHumanTurn(){
  if(inBattle||phase!=="play")return;
  SFX.click();turnIdx++;
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
function aiTurns(fromTurnFlow){
  if(inBattle)return;
  if(!fromTurnFlow&&phase!=="play")return;
  phase="ai";selected=null;
  setStatus("Los imperios rivales maniobran…");render();
  const enemies=alive().filter(x=>!humans.includes(x));let i=0;
  function step(){
    if(inBattle){aiCont=step;return;} // pausa si hay batalla de defensa
    if(i>=enemies.length){round++;if(!checkEnd())startRound();return;}
    const fid=enemies[i++],f=F[fid],P=FACTIONS[fid];
    const mineAll=ownedBy(fid);
    if(!mineAll.length){setTimeout(step,80);return;} // facción eliminada durante la ronda
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
      const avail=Object.keys(ALL_HEROES).filter(id=>ALL_HEROES[id].tipoAtaque&&isHeroUnlocked(id));
      if(avail.length)setHeroSlot(fid,0,avail[Math.floor(Math.random()*avail.length)]);
    }
    if(f.gold>=45&&Math.random()<0.25){const t=T[mineAll[0]];
      if(t&&t.base<3){f.gold-=30+t.base*25;t.base++;}}
    // diplomacia proactiva hacia un humano
    if(!pendingOffer&&Math.random()<0.15){
      const hv=humans.filter(h=>alive().includes(h));
      const tgt=hv[Math.floor(Math.random()*hv.length)];
      if(tgt&&!pactBetween(fid,tgt)){
        const stronger=mineAll.length>ownedBy(tgt).length;
        if(!stronger&&relGet(fid,tgt)>-40)pendingOffer={from:fid,to:tgt,type:"nap"};
        else if(stronger&&P.aggr>0.5)pendingOffer={from:fid,to:tgt,type:"demand",gold:20};
      }
    }
    // decidir ataque (personalidad + pactos + relación)
    const thr=P.aggr>0.7?1.1:(P.aggr>0.45?1.3:1.6);
    let done=false;
    for(const from of ownedBy(fid)){
      if(done)break;
      let tg=ADJ[from].filter(x=>T[x].owner!==fid&&!pactBetween(fid,T[x].owner));
      if(P.pers==="oportunista")tg.sort((a,b)=>T[a].troops-T[b].troops);
      else tg.sort((a,b)=>(T[a].troops+T[a].base*3)-(T[b].troops+T[b].base*3));
      for(const to of tg){
        const hostil=relGet(fid,T[to].owner)<20||humans.includes(T[to].owner);
        if(hostil&&T[from].troops>T[to].troops*thr&&T[from].troops>5&&Math.random()<P.aggr){
          arrowFX(from,to);
          if(humans.includes(T[to].owner)){
            // ¡defensa en vivo del humano dueño!
            log(`⚔️ ¡${P.name} ataca ${TERR[to].n}! Defiende tu territorio.`,"loss");
            openBattle(from,to,"defense");
            done=true;aiCont=step;render();return;
          }
          const r=autoBattle(from,to);
          relAdd(fid,T[to].owner,-15);
          if(r.win){flashTerr(to);log(`${FACTIONS[fid].emb} ${P.name} conquistó ${TERR[to].n}.`);}
          else log(`${P.name} fue rechazado en ${TERR[to].n}.`);
          done=true;break;
        }
      }
    }
    render();
    if(checkEnd())return;
    setTimeout(step,380);
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
      :`Tomaste el mando del ${fname(fid)} (dificultad ${diffMult<1?"Fácil":diffMult>1?"Difícil":"Normal"}).`,"win");
    round=1;startRound();return;
  }
  if(phase!=="play")return;
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
