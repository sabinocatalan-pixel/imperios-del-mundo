/* ==================== 09-batalla.js ====================
   Motor de batalla (estilo Age of War) y su dibujo en canvas. */
/* =========================================================
   ESCENA DE BATALLA — estilo Age of War mejorado
   ========================================================= */
const bcv=$("bcv"),bx=bcv.getContext("2d");
const W=960;
let GROUND=272,LH=340,bScale=1,B=null;
function fitBattleCanvas(){
  const wrap=$("bcvwrap");
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const cw=wrap.clientWidth||960,ch=wrap.clientHeight||340;
  bcv.width=Math.max(320,cw*dpr);bcv.height=Math.max(200,ch*dpr);
  bScale=bcv.width/W;
  LH=bcv.height/bScale;
  GROUND=LH*0.78;
}
addEventListener("resize",()=>{if(inBattle)fitBattleCanvas();});
const SKY=[["#7EC4E8","#CFE9F7"],["#E8C87E","#F7E9CF"],["#9AA7B0","#D8DEE3"],["#7E88C4","#E0CFF7"]];
function drawBG(){
  const era=F[B.pFacId]?F[B.pFacId].era:0;
  const g=bx.createLinearGradient(0,0,0,GROUND);
  g.addColorStop(0,SKY[era][0]);g.addColorStop(1,SKY[era][1]);
  bx.fillStyle=g;bx.fillRect(0,0,W,GROUND);
  bx.fillStyle="rgba(255,233,168,.9)";
  bx.beginPath();bx.arc(840,LH*0.14,26,0,7);bx.fill();
  // nubes en movimiento
  bx.fillStyle="rgba(255,255,255,.5)";
  const cx=((B?B.time:0)*10)%(W+240)-120;
  for(const off of[0,340,660]){
    const x=(cx+off)%(W+240)-120;
    bx.beginPath();bx.arc(x,LH*0.2,20,0,7);bx.arc(x+26,LH*0.19,26,0,7);bx.arc(x+54,LH*0.21,18,0,7);bx.fill();
  }
  // montañas lejanas
  bx.fillStyle="rgba(60,90,70,.55)";
  bx.beginPath();bx.moveTo(0,GROUND);
  for(const[mx,mh]of[[80,70],[220,110],[380,80],[540,120],[700,90],[860,110],[960,70]])
    bx.lineTo(mx,GROUND-mh);
  bx.lineTo(W,GROUND);bx.closePath();bx.fill();
  // árboles
  bx.fillStyle="#4E7A3A";
  bx.beginPath();bx.moveTo(400,GROUND);bx.lineTo(430,GROUND-70);bx.lineTo(460,GROUND);bx.fill();
  bx.beginPath();bx.moveTo(560,GROUND);bx.lineTo(585,GROUND-55);bx.lineTo(610,GROUND);bx.fill();
  // suelo
  const gg=bx.createLinearGradient(0,GROUND,0,LH);
  gg.addColorStop(0,"#8A7B54");gg.addColorStop(1,"#5E5138");
  bx.fillStyle=gg;bx.fillRect(0,GROUND,W,LH-GROUND);
}
const COUNTER={melee:"ranged",ranged:"heavy",heavy:"melee"}; // clave vence a valor
const CARROW={melee:"🗡→🏹",ranged:"🏹→🛡",heavy:"🛡→🗡"};

function unitStats(kind,era,arm,wl){
  const m=Math.pow(1.75,era)*(1+arm*0.15);
  if(kind==="melee") return{hp:70*m, dmg:9*m, spd:40,rng:30, atk:0.75,cost:30, cd:1.5, size:1.25};
  if(kind==="ranged")return{hp:45*m, dmg:8*m, spd:34,rng:185+era*20,atk:1.1,cost:55, cd:3, size:1.25};
  if(kind==="heavy") return{hp:200*m,dmg:16*m,spd:22,rng:era>=3?66:34,atk:1.05,cost:110,cd:8, size:1.7};
  if(kind==="champ")return{hp:340*(1+.45*wl)*Math.pow(1.3,era),dmg:28*(1+.4*wl)*Math.pow(1.3,era),
    spd:36,rng:140,atk:0.65,cost:0,cd:60,size:1.9};
}
function mkUnit(side,kind,era,arm,wl){
  const s=unitStats(kind,era,arm,wl);
  return{side,kind,era,x:side===1?70:W-70,hp:s.hp,max:s.hp,dmg:s.dmg,spd:s.spd,
    rng:s.rng,atk:s.atk,t:0,size:s.size,bob:Math.random()*6.28,flash:0};
}
function counterMult(att,def){
  if(COUNTER[att.kind]===def.kind)return 1.5;
  if(COUNTER[def.kind]===att.kind)return 0.66;
  return 1;
}
// Reducción de daño recibido por pasivas/activas de héroes (Leónidas, Pachacútec).
function dmgTakenMult(tgt){
  const S=B.S[String(tgt.side)],f=F[S.fac],heroId=f.heroes[0];
  let mult=1;
  if(S.defBuffT>0)mult*=0.9; // Pachacútec: Reorganización Imperial (10s)
  if(heroId==="leonidas"&&S.champAlive&&tgt.kind==="melee")mult*=0.9; // Muro de Escudos
  return mult;
}

function openBattle(from,to,mode){
  inBattle=true;selected=null;
  const defT=T[to],atkT=T[from];
  const pFacId=mode==="attack"?atkT.owner:defT.owner;   // humano que controla el lado izquierdo
  const eFacId=mode==="attack"?defT.owner:atkT.owner;
  const pvp=humans.includes(pFacId)&&humans.includes(eFacId);
  const pFac=F[pFacId],eFac=F[eFacId];
  B={
    from,to,mode,pvp,over:false,result:null,time:0,shake:0,freeze:0,
    pFacId,eFacId,
    pHP:0,pMax:0,eHP:0,eMax:0,
    units:[],projs:[],dmgs:[],pufs:[],corpses:[],btnRefs:[],
    duel:null,duelDone:false,
    pacing:{tension:false,muerteSubita:false,desgaste:false,resuelto:false},
    stones:Array.from({length:14},(_,i)=>({x:80+((i*137)%800),w:4+((i*53)%9),h:2+((i*31)%4)})),
    last:performance.now(),
    S:{
      "1":{fac:pFacId,gold:80,income:9+pFac.upEco*1.4,
        cool:{melee:0,ranged:0,heavy:0,champ:0,spec:0,heroAbil:0,air:0},champAlive:false,
        spdBuffT:0,defBuffT:0,dmgBuffAllT:0,amaruRevived:false,dmgDealt:0},
      "-1":{fac:eFacId,gold:pvp?80:60,
        income:pvp?(9+eFac.upEco*1.4):(8+eFac.era*1.2)*diffMult,
        cool:{melee:0,ranged:0,heavy:0,champ:pvp?0:20,spec:pvp?0:26,heroAbil:pvp?0:20,air:0},champAlive:false,
        spdBuffT:0,defBuffT:0,dmgBuffAllT:0,amaruRevived:false,dmgDealt:0}
    },
    eCool:0,turretT:0
  };
  // Bases +15% PV (Fase 2C) respecto al balance anterior.
  if(mode==="attack"){
    B.pHP=B.pMax=(330+pFac.upArm*40)*1.15;
    B.eHP=B.eMax=(230+defT.base*110+defT.troops*8)*1.15;
  }else{
    B.pHP=B.pMax=(260+defT.base*110+defT.troops*8)*1.15;
    B.eHP=B.eMax=(300+eFac.upArm*40)*1.15;
    B.S["-1"].income*=1.1;
  }
  arrowFX(from,to);
  $("btitle").textContent=`${TERR[from].n} → ${TERR[to].n}`;
  $("bnameP").textContent=fname(pFacId)+" · "+ERAS[pFac.era];
  $("bnameE").textContent=fname(eFacId)+" · "+ERAS[eFac.era];
  $("bmode").textContent=pvp?"👥 ¡Duelo de jugadores!":(mode==="attack"?"⚔️ Ofensiva":"🛡️ ¡Defiende tu territorio!");
  buildBattleButtons();
  $("battle").style.display="flex";
  requestAnimationFrame(()=>{fitBattleCanvas();B.last=performance.now();requestAnimationFrame(bloop);});
}

function spawnUnit(side,kind){
  const P=B.S[side],f=F[P.fac];
  const st=unitStats(kind,f.era,f.upArm);
  let cost=st.cost;
  if(f.heroes[0]==="suntzu"&&P.champAlive)cost=Math.round(cost*0.9); // Sun Tzu: -10% costo mientras vive
  if(B.over||P.gold<cost||P.cool[kind]>0)return;
  P.gold-=cost;P.cool[kind]=st.cd;SFX.spawn();
  const u=mkUnit(+side,kind,f.era,f.upArm);
  if(B.pacing.desgaste){u.hp*=0.9;u.max*=0.9;} // desgaste (180s): refuerzos con -10% PV máx
  B.units.push(u);
}
function spawnChamp(side){
  const P=B.S[side],f=F[P.fac];
  const heroId=f.heroes[0];
  if(B.over||!heroId||P.champAlive||P.cool.champ>0)return;
  P.cool.champ=60;P.champAlive=true;SFX.evolve();
  const u=mkUnit(+side,"champ",f.era,0,f.heroWeaponLv);
  u.heroId=heroId;
  if(heroArmaAltActiva(P.fac,heroId)){ // arma alternativa desbloqueada (logro por partida)
    if(heroId==="leonidas")u.rng+=30;
    else if(heroId==="anibal")u.rng=120;
    else if(heroId==="tomoegozen")u.rng=100;
  }
  B.units.push(u);
}
function useHeroAbility(side){
  const P=B.S[side],f=F[P.fac],heroId=f.heroes[0],hero=heroId&&HEROES[heroId];
  if(B.over||!hero||!hero.habilidad||hero.habilidad.tipo!=="activa")return;
  if(!P.champAlive||P.cool.heroAbil>0)return;
  P.cool.heroAbil=hero.habilidad.cd;SFX.evolve();
  const allies=B.units.filter(u=>u.side===(+side));
  if(heroId==="boudica"){
    P.spdBuffT=6;
    B.dmgs.push({x:W/2,y:GROUND-140,txt:"⚡ ¡Carga Furiosa!",t:1.2,c:"#FFD866"});
  }else if(heroId==="anibal"){
    const fx=(+side)===1?W*0.35:W*0.65;
    for(let i=0;i<2;i++){
      const u=mkUnit(+side,"melee",f.era,f.upArm);
      u.x=fx+(i-0.5)*24;
      B.units.push(u);
    }
    B.dmgs.push({x:W/2,y:GROUND-140,txt:"🛡 ¡Flanqueo!",t:1.2,c:"#FFD866"});
  }else if(heroId==="pachacutec"){
    for(const u of allies)u.hp=Math.min(u.max,u.hp+u.max*0.25);
    P.defBuffT=10;
    B.dmgs.push({x:W/2,y:GROUND-140,txt:"✨ ¡Reorganización Imperial!",t:1.2,c:"#7ED66E"});
  }
}

/* ==================== DUELO DE CAMPEONES (Fase 2B) ====================
   Máx. 1 por batalla: se dispara cuando los dos héroes activos están a
   ≤60px. Pausa las unidades en 140px de radio (incluidos los propios
   duelistas) mientras se resuelve; el perdedor NUNCA muere (queda al
   30% de su PV) y el duelo no puede tocar bases ni decidir la batalla
   por sí mismo — solo entrega una recompensa moderada temporal. */
const RAREZA_PTS_DUELO={comun:1,raro:2,legendario:3,mitico:4};
function startDuel(h1,h2){
  if(B.over||B.duelDone||B.duel)return;
  B.duel={h1,h2,t:0,duration:6+Math.random()*4,mid:(h1.x+h2.x)/2,resolved:false};
  const n1=ALL_HEROES[h1.heroId].name,n2=ALL_HEROES[h2.heroId].name;
  const f1=ALL_HEROES[h1.heroId].frase||"",f2=ALL_HEROES[h2.heroId].frase||"";
  B.dmgs.push({x:B.duel.mid,y:GROUND-170,txt:`${n1}: "${f1}"`,t:2.2,c:"#F4E9C8"});
  B.dmgs.push({x:B.duel.mid,y:GROUND-185,txt:`${n2}: "${f2}"`,t:2.2,c:"#F4E9C8"});
  SFX.evolve();
}
function heroDuelPower(u,side){
  const f=F[B.S[side].fac],hero=ALL_HEROES[u.heroId];
  const pvFrac=Math.max(0,u.hp)/u.max;
  return f.heroWeaponLv*2+RAREZA_PTS_DUELO[hero.rarity]+pvFrac*3+(hero.duelBonus||0)+(Math.random()*4-2);
}
function resolveDuel(){
  const d=B.duel,h1=d.h1,h2=d.h2;
  // Ojo: NO poner B.duel=null aquí. El bucle de unidades de este mismo
  // frame todavía tiene que verlo como activo para seguir pausando a los
  // duelistas — si no, pelearían normalmente justo después de resolverse,
  // sumando daño de combate encima del resultado del duelo en el mismo tick.
  d.resolved=true;B.duelDone=true;
  if(!B.units.includes(h1)||!B.units.includes(h2))return; // uno murió por causas ajenas al duelo
  const p1=heroDuelPower(h1,"1"),p2=heroDuelPower(h2,"-1");
  const side1Wins=p1>=p2;
  const winner=side1Wins?h1:h2,loser=side1Wins?h2:h1;
  const winSide=side1Wins?"1":"-1",loseSide=side1Wins?"-1":"1";
  loser.hp=loser.max*0.3;loser.flash=0.3; // no muere, queda al 30% de su PV
  const opciones=["dmg","heal","cd","stun"];
  const reward=opciones[Math.floor(Math.random()*opciones.length)];
  let rewardTxt="";
  if(reward==="dmg"){B.S[winSide].dmgBuffAllT=12;rewardTxt="+15% daño aliado 12s";}
  else if(reward==="heal"){winner.hp=Math.min(winner.max,winner.hp+winner.max*0.2);rewardTxt="+20% PV propio";}
  else if(reward==="cd"){B.S[winSide].cool.spec=Math.max(0,B.S[winSide].cool.spec-8);rewardTxt="-8s cooldown del especial";}
  else{for(const v of B.units)if(v.side===(+loseSide)&&Math.abs(v.x-d.mid)<140)v.stunT=2;rewardTxt="aturde cercanos 2s";}
  const nameW=ALL_HEROES[winner.heroId].name,nameL=ALL_HEROES[loser.heroId].name;
  log(`⚔ ${nameW} venció a ${nameL} en duelo: ${rewardTxt} (energía de ${nameL} baja).`,"win");
  B.dmgs.push({x:d.mid,y:GROUND-165,txt:`⚔ ¡${nameW} gana el duelo!`,t:1.5,c:"#FFD866"});
  SFX.win();
}
function useSpecial(side){
  const P=B.S[side],f=F[P.fac];
  if(B.over||P.cool.spec>0)return;
  P.cool.spec=side==="-1"&&!B.pvp?32:30;
  if(side==="1"&&humans.length===1)completeMission("spec");
  const dmg=55*(f.era+1),foe=-(+side);
  for(const u of B.units)if(u.side===foe){
    const dm=dmg*dmgTakenMult(u);u.hp-=dm;u.flash=0.2;P.dmgDealt+=dm;
    B.dmgs.push({x:u.x,y:GROUND-50,txt:Math.round(dm),t:0.7,c:"#FFD866"});}
  B.shake=SET.fx?14:0;B.freeze=0.08;SFX.boom();
  if(side==="-1")B.dmgs.push({x:W/2,y:GROUND-140,txt:"⚠️ ¡"+SPECIALS[f.era]+" enemigo!",t:1.4,c:"#FF7A66"});
  for(let i=0;i<(SET.fx?26:8);i++)B.pufs.push({x:200+Math.random()*560,y:GROUND-Math.random()*120,
    vx:(Math.random()-.5)*3,vy:-Math.random()*2,t:0.6,c:"#FFB05A",s:4+Math.random()*5});
}
function buildBattleButtons(){
  const box=$("bbtns");box.innerHTML="";B.btnRefs=[];
  const icons={melee:"🗡",ranged:"🏹",heavy:"🛡"};
  function group(side){
    const facId=B.S[side].fac,f=F[facId];
    if(B.pvp){
      const tag=document.createElement("div");
      tag.style.cssText="width:100%;text-align:center;font-size:11px;opacity:.8";
      tag.textContent=(side==="1"?"◀ ":"")+fname(facId)+(side==="-1"?" ▶":"");
      box.appendChild(tag);
    }
    for(const k of["melee","ranged","heavy"]){
      const st=unitStats(k,f.era,f.upArm);
      const b=document.createElement("button");b.className="ub";
      b.innerHTML=`${icons[k]} ${UNIT_NAMES[f.era][k]}<small>${st.cost}🪙 · <span class="carrow">${CARROW[k]}</span></small><div class="cdo"></div>`;
      b.onclick=()=>spawnUnit(side,k);
      box.appendChild(b);
      B.btnRefs.push({el:b,cd:b.lastElementChild,side,kind:k});
    }
    const heroId=f.heroes[0],hero=heroId&&ALL_HEROES[heroId];
    if(hero){
      const b=document.createElement("button");b.className="ub gold";
      b.innerHTML=`⭐ ${hero.name}<small>héroe · 60s</small><div class="cdo"></div>`;
      b.onclick=()=>spawnChamp(side);
      box.appendChild(b);
      B.btnRefs.push({el:b,cd:b.lastElementChild,side,kind:"champ"});
      if(hero.habilidad&&hero.habilidad.tipo==="activa"){
        const ab=document.createElement("button");ab.className="ub gold";
        ab.innerHTML=`${hero.habilidad.nombre}<small>${hero.habilidad.cd}s</small><div class="cdo"></div>`;
        ab.onclick=()=>useHeroAbility(side);
        box.appendChild(ab);
        B.btnRefs.push({el:ab,cd:ab.lastElementChild,side,kind:"heroAbil"});
      }
    }
    const sp=document.createElement("button");sp.className="ub danger";
    sp.innerHTML=`${SPECIALS[f.era]}<small>gratis · 30s</small><div class="cdo"></div>`;
    sp.onclick=()=>useSpecial(side);
    box.appendChild(sp);
    B.btnRefs.push({el:sp,cd:sp.lastElementChild,side,kind:"spec"});
  }
  group("1");
  if(B.pvp)group("-1");
  const r=document.createElement("button");r.className="ub";
  r.innerHTML=B.pvp?"🏳 Rendición J1":(B.mode==="attack"?"🏳 Retirada":"🏳 Rendir territorio");
  r.onclick=()=>finishBattle(false,true);
  box.appendChild(r);
}
function enemyAI(dt){
  const P=B.S["-1"],eF=F[P.fac];
  B.eCool-=dt;
  // especial de la IA cuando el jugador acumula ejército
  if(P.cool.spec<=0&&B.units.filter(u=>u.side===1).length>=3)useSpecial("-1");
  // héroe de la IA si su imperio tiene uno equipado
  if(eF.heroes[0]&&!P.champAlive&&P.cool.champ<=0&&B.time>12)spawnChamp("-1");
  if(P.champAlive&&P.cool.heroAbil<=0){
    const hero=ALL_HEROES[eF.heroes[0]];
    if(hero&&hero.habilidad&&hero.habilidad.tipo==="activa")useHeroAbility("-1");
  }
  if(B.eCool>0)return;
  const affordable=["melee","ranged","heavy"].filter(k=>P.gold>=unitStats(k,eF.era,eF.upArm).cost);
  if(!affordable.length)return;
  let pick;
  const cpChance=diffMult>1.15?0.5:0.3;
  if(Math.random()<cpChance){
    const counts={melee:0,ranged:0,heavy:0};
    B.units.forEach(u=>{if(u.side===1&&counts[u.kind]!==undefined)counts[u.kind]++;});
    const common=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    const counterOf={ranged:"melee",heavy:"ranged",melee:"heavy"};
    pick=counterOf[common];
    if(!affordable.includes(pick))pick=affordable[Math.floor(Math.random()*affordable.length)];
  }else{
    const w=Math.random();pick=w<0.5?"melee":(w<0.85?"ranged":"heavy");
    if(!affordable.includes(pick))pick=affordable[0];
  }
  P.gold-=unitStats(pick,eF.era,eF.upArm).cost;
  B.eCool=0.7+Math.random()*0.9;
  B.units.push(mkUnit(-1,pick,eF.era,eF.upArm));
}
function bloop(now){
  if(!B)return;
  let dt=Math.min(0.05,(now-B.last)/1000);B.last=now;
  dt*=SET.speed;
  if(B.freeze>0){B.freeze-=dt;dt=0;} // hitstop
  if(!B.over&&dt>0){
    B.time+=dt;
    // Desgaste progresivo (Fase 2C): umbrales de una sola vez, con banner
    // narrativo y línea causal en el log.
    if(!B.pacing.tension&&B.time>=120){
      B.pacing.tension=true;B.S["1"].income*=1.1;B.S["-1"].income*=1.1;
      B.dmgs.push({x:W/2,y:GROUND-150,txt:"⚠️ Tensión de guerra: +10% ingreso",t:3,c:"#FFD866"});
      log("⚠️ Tensión de guerra en la batalla: el ingreso de ambos bandos sube 10%.");
    }
    if(!B.pacing.muerteSubita&&B.time>=150){
      B.pacing.muerteSubita=true;
      B.dmgs.push({x:W/2,y:GROUND-150,txt:"💀 Muerte súbita: bases +20% daño recibido",t:3,c:"#C63D2F"});
      log("💀 Muerte súbita: las bases reciben 20% más de daño desde ahora.","loss");
    }
    if(!B.pacing.desgaste&&B.time>=180){
      B.pacing.desgaste=true;
      B.dmgs.push({x:W/2,y:GROUND-150,txt:"📉 Desgaste: refuerzos con -10% PV",t:3,c:"#9FB3BE"});
      log("📉 Las líneas de suministro se agotan: los refuerzos llegan con -10% PV máximo.");
    }
    for(const sd of["1","-1"]){
      const P=B.S[sd];P.gold+=P.income*dt;
      for(const k in P.cool)P.cool[k]=Math.max(0,P.cool[k]-dt);
      P.spdBuffT=Math.max(0,P.spdBuffT-dt);
      P.defBuffT=Math.max(0,P.defBuffT-dt);
      P.dmgBuffAllT=Math.max(0,P.dmgBuffAllT-dt);
    }
    if(!B.pvp)enemyAI(dt);
    // torreta de la base defendida (según nivel de base del territorio)
    const tb=T[B.to].base;
    if(tb>0){B.turretT-=dt;
      if(B.turretT<=0){
        const targetSide=B.mode==="attack"?1:-1; // la torreta pertenece al territorio "to"
        const tgt=B.units.filter(u=>u.side===targetSide).sort((a,b)=>
          targetSide===1?b.x-a.x:a.x-b.x)[0];
        const tx=B.mode==="attack"?W-60:60;
        if(tgt&&Math.abs(tgt.x-tx)<270){B.turretT=1.4;tgt.hp-=(4+tb*4)*dmgTakenMult(tgt);tgt.flash=0.12;
          B.projs.push({x:tx,y:GROUND-92,tx:tgt.x,ty:GROUND-16,t:0.22});}
      }
    }
    // duelo de campeones: disparo (≤60px, máx. 1/batalla) y resolución
    if(!B.duelDone&&!B.duel){
      const h1=B.units.find(u=>u.side===1&&u.kind==="champ"&&u.hp>0);
      const h2=B.units.find(u=>u.side===-1&&u.kind==="champ"&&u.hp>0);
      if(h1&&h2&&Math.abs(h1.x-h2.x)<=60)startDuel(h1,h2);
    }
    if(B.duel&&!B.duel.resolved){
      B.duel.t+=dt;
      if(B.duel.t>=B.duel.duration)resolveDuel();
    }
    // unidades
    for(const u of B.units){
      u.t-=dt;u.bob+=dt*7;u.flash=Math.max(0,u.flash-dt);
      u.stunT=Math.max(0,(u.stunT||0)-dt);
      if(u.stunT>0)continue; // aturdido (onda de Amaru): no ataca ni avanza
      if(B.duel&&(u===B.duel.h1||u===B.duel.h2||Math.abs(u.x-B.duel.mid)<140))continue; // duelo: pausa en 140px (también en el frame que se resuelve)
      const foes=B.units.filter(v=>v.side!==u.side&&v.hp>0);
      let tgt=null,dist=Infinity;
      for(const v of foes){const d=(v.x-u.x)*u.side;if(d>0&&d<dist){dist=d;tgt=v;}}
      const baseX=u.side===1?W-58:58;
      const baseD=(baseX-u.x)*u.side;
      const dmgMultOut=(B.S[String(u.side)].dmgBuffAllT>0)?1.15:1; // Ollantay: al morir, +15% daño 8s
      // Dos héroes activos siguen cerrando distancia hasta quedar a ≤60px
      // (zona de duelo) en vez de trabarse en combate normal a rng=140;
      // si no, con ese alcance jamás llegarían a la distancia del duelo.
      // Una vez usado el único duelo de la batalla, vuelven a engancharse
      // como cualquier otro enfrentamiento.
      const champVsChamp=tgt&&u.kind==="champ"&&tgt.kind==="champ"&&!B.duelDone;
      const engageRng=champVsChamp?60:u.rng;
      if(tgt&&dist<=engageRng){
        if(u.t<=0){u.t=u.atk;
          const mult=counterMult(u,tgt);
          const dm=u.dmg*mult*dmgMultOut*dmgTakenMult(tgt);
          tgt.hp-=dm;tgt.flash=0.15;SFX.hit();
          B.S[String(u.side)].dmgDealt+=dm;
          B.dmgs.push({x:tgt.x,y:GROUND-52*tgt.size,txt:Math.round(dm),t:0.6,
            c:mult>1?"#FFD866":(mult<1?"#9FB3BE":"#F4E9C8")});
          if(u.rng>60)B.projs.push({x:u.x,y:GROUND-22*u.size,tx:tgt.x,ty:GROUND-16,t:0.2});
          if(u.heroId==="tomoegozen"){ // Danza de la Naginata: golpe en área pequeña
            const nearby=B.units.filter(v=>v!==tgt&&v.side===tgt.side&&v.hp>0&&Math.abs(v.x-tgt.x)<28);
            for(const v of nearby){
              const spl=u.dmg*0.5*dmgTakenMult(v);v.hp-=spl;v.flash=0.15;
              B.dmgs.push({x:v.x,y:GROUND-52*v.size,txt:Math.round(spl),t:0.6,c:"#F4E9C8"});
            }
          }
          if(tgt.hp<=0){
            if(tgt.kind==="ranged"&&u.heroId==="tomoegozen")heroProgressBump(B.S[String(u.side)].fac,"tomoegozen","rangedKills");
            if(tgt.kind==="champ"&&tgt.heroId==="amaru"&&!B.S[String(tgt.side)].amaruRevived){
              // Renacer de la Serpiente: 1 vez/batalla, revive con 50% PV y aturde alrededor
              B.S[String(tgt.side)].amaruRevived=true;tgt.hp=tgt.max*0.5;tgt.flash=0.3;
              for(const v of B.units)if(v.side!==tgt.side&&Math.abs(v.x-tgt.x)<160)v.stunT=1.5;
              B.dmgs.push({x:tgt.x,y:GROUND-90,txt:"🐍 ¡Renace!",t:1.2,c:"#B15FE0"});
              SFX.evolve();
            }else{
              SFX.die();
              if(tgt.kind==="champ"&&tgt.heroId==="ollantay")B.S[String(tgt.side)].dmgBuffAllT=8;
              B.corpses.push({x:tgt.x,side:tgt.side,size:tgt.size,t:0.9,
                c:FACTIONS[tgt.side===1?B.pFacId:B.eFacId].color});
              {const rew=Math.round(unitStats(tgt.kind,tgt.era,0,1).cost*0.7);
                B.S[String(u.side)].gold+=rew;
                if(u.side===1||B.pvp){B.dmgs.push({x:tgt.x,y:GROUND-70,txt:"+"+rew+"🪙",t:0.8,c:"#7ED66E"});SFX.coin();}}
              for(let i=0;i<(SET.fx?7:2);i++)B.pufs.push({x:tgt.x,y:GROUND-16,
                vx:(Math.random()-.5)*3,vy:-Math.random()*2.5,t:0.5,
                c:FACTIONS[tgt.side===1?player:B.eFacId].color,s:3+Math.random()*4});
            }
          }
        }
      }else if(!tgt&&baseD<=u.rng+18){
        if(u.t<=0){u.t=u.atk;
          const baseMult=B.pacing.muerteSubita?1.2:1; // muerte súbita: bases +20% daño recibido
          const dmgToBase=u.dmg*dmgMultOut*baseMult;
          if(u.side===1){B.eHP-=dmgToBase;if(SET.fx)B.shake=Math.max(B.shake,3);}
          else{B.pHP-=dmgToBase;if(SET.fx)B.shake=Math.max(B.shake,3);}
          B.S[String(u.side)].dmgDealt+=dmgToBase;
          SFX.hit();
          if(u.rng>60)B.projs.push({x:u.x,y:GROUND-22*u.size,tx:baseX,ty:GROUND-50,t:0.2});}
      }else{
        const spdMult=(B.S[String(u.side)].spdBuffT>0)?1.2:1; // Boudica: Carga Furiosa (6s)
        const ally=B.units.find(v=>v!==u&&v.side===u.side&&v.hp>0&&
          (v.x-u.x)*u.side>0&&(v.x-u.x)*u.side<20&&v.rng<=60);
        if(!ally||u.rng>60&&(ally.x-u.x)*u.side>40)u.x+=u.spd*spdMult*u.side*dt;
      }
    }
    if(B.duel&&B.duel.resolved)B.duel=null; // recién ahora: el bucle de arriba ya respetó la pausa este frame
    B.units=B.units.filter(u=>{
      if(u.hp<=0&&u.kind==="champ")B.S[String(u.side)].champAlive=false;
      return u.hp>0;});
    B.projs=B.projs.filter(p=>(p.t-=dt)>0);
    B.dmgs=B.dmgs.filter(d=>{d.t-=dt;d.y-=28*dt;return d.t>0;});
    B.pufs=B.pufs.filter(p=>{p.t-=dt;p.x+=p.vx;p.y+=p.vy;return p.t>0;});
    B.corpses=B.corpses.filter(c=>(c.t-=dt)>0);
    B.shake=Math.max(0,B.shake-dt*30);
    if(B.eHP<=0)finishBattle(true);
    else if(B.pHP<=0)finishBattle(false);
    else if(!B.pacing.resuelto&&B.time>=210){
      // Resolución forzada (210s): gana quien tenga mayor
      // PVbase%*2 + tropas vivas + dañoCausado/100. Ninguno de los dos
      // términos toca directamente la vida del otro: es un desempate,
      // no un golpe más.
      B.pacing.resuelto=true;
      const score=sd=>{
        const frac=Math.max(0,sd==="1"?B.pHP/B.pMax:B.eHP/B.eMax);
        const tropas=B.units.filter(u=>u.side===(sd==="1"?1:-1)&&u.hp>0).length;
        return frac*100*2+tropas+B.S[sd].dmgDealt/100;
      };
      log(`⏱ Resolución forzada tras 210s de batalla (PV ${Math.round(B.pHP/B.pMax*100)}% vs ${Math.round(B.eHP/B.eMax*100)}%).`);
      finishBattle(score("1")>=score("-1"));
    }
  }
  drawBattle();
  $("bhpP").firstElementChild.style.width=Math.max(0,B.pHP/B.pMax*100)+"%";
  $("bhpE").firstElementChild.style.width=Math.max(0,B.eHP/B.eMax*100)+"%";
  $("bgold").textContent=B.pvp
    ?`🪙 J1 ${Math.floor(B.S["1"].gold)}  ·  J2 ${Math.floor(B.S["-1"].gold)} 🪙`
    :"🪙 "+Math.floor(B.S["1"].gold);
  for(const r of B.btnRefs){
    const P=B.S[r.side],f=F[P.fac];
    if(r.kind==="spec"){r.el.disabled=B.over||P.cool.spec>0;
      r.cd.style.height=(P.cool.spec/30*100)+"%";}
    else if(r.kind==="champ"){r.el.disabled=B.over||P.cool.champ>0||P.champAlive;
      r.cd.style.height=(P.cool.champ/60*100)+"%";}
    else if(r.kind==="heroAbil"){
      const hero=ALL_HEROES[f.heroes[0]],cd=hero&&hero.habilidad?hero.habilidad.cd:1;
      r.el.disabled=B.over||!P.champAlive||P.cool.heroAbil>0;
      r.cd.style.height=(P.cool.heroAbil/cd*100)+"%";
    }
    else{const st=unitStats(r.kind,f.era,f.upArm);
      r.el.disabled=B.over||P.gold<st.cost||P.cool[r.kind]>0;
      r.cd.style.height=(P.cool[r.kind]/st.cd*100)+"%";}
  }
  if(B)requestAnimationFrame(bloop);
}

/* --- dibujo batalla --- */
function drawStick(u){
  const facC=FACTIONS[u.side===1?B.pFacId:B.eFacId].color;
  const c=u.flash>0?"#FFFFFF":facC;
  const s=u.size,g=GROUND;
  const lunge=(u.t>u.atk-0.12&&u.t>0)?4*s:0;      // embestida al golpear
  const x=u.x+lunge*u.side;
  const bobY=Math.sin(u.bob)*1.5;
  const walk=Math.sin(u.bob*1.6)*4*s;             // balanceo de piernas
  bx.save();bx.translate(x,g+bobY);bx.scale(u.side,1);
  bx.strokeStyle=c;bx.fillStyle=c;bx.lineWidth=2.4*s;bx.lineCap="round";
  if(u.kind==="heavy"&&u.era>=3){ // tanque
    // orugas
    bx.fillStyle="#2E2A22";
    bx.beginPath();bx.moveTo(-18*s,-2*s);bx.lineTo(18*s,-2*s);
    bx.arc(18*s,-6*s,4*s,1.57,-1.57,true);bx.lineTo(-18*s,-10*s);
    bx.arc(-18*s,-6*s,4*s,-1.57,1.57,true);bx.closePath();bx.fill();
    bx.fillStyle="#4A443A";
    for(let i=-2;i<=2;i++){bx.beginPath();bx.arc(i*7*s,-6*s,2.6*s,0,7);bx.fill();}
    // casco
    bx.fillStyle=c;
    bx.beginPath();bx.moveTo(-16*s,-10*s);bx.lineTo(16*s,-10*s);
    bx.lineTo(12*s,-17*s);bx.lineTo(-13*s,-17*s);bx.closePath();bx.fill();
    // torreta y cañón
    bx.fillStyle=shade(facC,20);
    bx.beginPath();bx.arc(0,-18*s,6*s,Math.PI,0);bx.fill();
    bx.strokeStyle=shade(facC,-25);bx.lineWidth=2.6*s;bx.lineCap="round";
    bx.beginPath();bx.moveTo(4*s,-20*s);bx.lineTo(26*s,-22*s);bx.stroke();
    if(lunge>0){bx.fillStyle="#FFE28A";
      bx.beginPath();bx.arc(29*s,-22*s,4.5*s,0,7);bx.fill();}
    bx.restore();
  }else{
    // piernas caminando
    bx.beginPath();bx.moveTo(0,-14*s);bx.lineTo(-4*s-walk*0.5,0);
    bx.moveTo(0,-14*s);bx.lineTo(4*s+walk*0.5,0);bx.stroke();
    // torso
    bx.beginPath();bx.moveTo(0,-14*s);bx.lineTo(0,-28*s);bx.stroke();
    // cabeza + casco de facción
    bx.beginPath();bx.arc(0,-33*s,5*s,0,7);bx.fill();
    bx.fillStyle=shade(facC,45);
    bx.beginPath();bx.arc(0,-34.5*s,5*s,Math.PI,0);bx.fill();
    bx.fillStyle=c;
    // brazo
    bx.beginPath();bx.moveTo(0,-25*s);bx.lineTo(9*s,-22*s);bx.stroke();
    bx.strokeStyle=u.flash>0?"#fff":"#D8CBA8";bx.lineWidth=2*s;
    if(u.kind==="champ"){bx.strokeStyle="#FFD866";bx.lineWidth=3*s;
      bx.beginPath();bx.moveTo(9*s,-22*s);bx.lineTo(22*s,-34*s);bx.stroke();
      bx.fillStyle="#FFD866";bx.beginPath();bx.arc(0,-40*s,2.5*s,0,7);bx.fill();
    }else if(u.era===0){bx.beginPath();bx.moveTo(9*s,-22*s);bx.lineTo(17*s,-30*s);bx.stroke();}
    else if(u.era===1){
      if(u.kind==="ranged"){bx.beginPath();bx.arc(10*s,-24*s,7*s,-1.2,1.2);bx.stroke();}
      else{bx.beginPath();bx.moveTo(9*s,-22*s);bx.lineTo(19*s,-32*s);bx.stroke();}
    }else{
      bx.beginPath();bx.moveTo(6*s,-23*s);bx.lineTo(20*s,-23*s);bx.stroke();
      if(lunge>0&&u.rng>60){ // fogonazo de disparo
        bx.fillStyle="#FFE28A";
        bx.beginPath();bx.arc(22*s,-23*s,3.5*s,0,7);bx.fill();
      }
    }
    bx.restore();
  }
  bx.fillStyle="rgba(0,0,0,.5)";bx.fillRect(x-12,g-46*u.size,24,3);
  bx.fillStyle="#7ED66E";bx.fillRect(x-12,g-46*u.size,24*Math.max(0,u.hp/u.max),3);
}
function drawCorpse(cp){
  bx.save();bx.globalAlpha=Math.min(0.8,cp.t);
  bx.strokeStyle=cp.c;bx.lineWidth=2.2*cp.size;bx.lineCap="round";
  bx.beginPath();bx.moveTo(cp.x-10*cp.size,GROUND-3);bx.lineTo(cp.x+10*cp.size,GROUND-3);bx.stroke();
  bx.beginPath();bx.arc(cp.x+13*cp.size*cp.side,GROUND-4,4*cp.size,0,7);
  bx.fillStyle=cp.c;bx.fill();
  bx.restore();
}
function drawBase(x,side,hp,max,lvl,color){
  // muro con textura
  bx.fillStyle="#5A4B33";bx.fillRect(x-34,GROUND-78,68,78);
  bx.strokeStyle="rgba(0,0,0,.18)";bx.lineWidth=1;
  for(let yy=GROUND-66;yy<GROUND;yy+=13){bx.beginPath();bx.moveTo(x-34,yy);bx.lineTo(x+34,yy);bx.stroke();}
  // puerta
  bx.fillStyle="#3A3023";
  bx.beginPath();bx.moveTo(x-11,GROUND);bx.lineTo(x-11,GROUND-26);
  bx.arc(x,GROUND-26,11,Math.PI,0);bx.lineTo(x+11,GROUND);bx.closePath();bx.fill();
  // corona de color de facción y almenas
  bx.fillStyle=color;bx.fillRect(x-34,GROUND-78,68,10);
  bx.fillStyle="#3E3323";
  for(let i=0;i<4;i++)bx.fillRect(x-30+i*16,GROUND-92,10,14);
  // torreta si hay nivel
  if(lvl>0){bx.fillStyle="#2b2b2b";bx.fillRect(x-8,GROUND-104,16,14);
    bx.fillRect(x+(x<W/2?6:-20),GROUND-100,14,4);}
  // bandera ondeante
  const t=B?B.time:0,fx=x+(side===1?26:-26);
  bx.strokeStyle="#D8CBA8";bx.lineWidth=2;
  bx.beginPath();bx.moveTo(fx,GROUND-92);bx.lineTo(fx,GROUND-118);bx.stroke();
  bx.fillStyle=color;
  bx.beginPath();bx.moveTo(fx,GROUND-118);
  bx.quadraticCurveTo(fx+18*side,GROUND-118+Math.sin(t*5)*3,fx+22*side,GROUND-112+Math.sin(t*5+1)*3);
  bx.lineTo(fx,GROUND-106);bx.closePath();bx.fill();
  // barra de vida
  bx.fillStyle="rgba(0,0,0,.5)";bx.fillRect(x-32,GROUND-128,64,5);
  bx.fillStyle=side===1?"#D9A441":"#C63D2F";
  bx.fillRect(x-32,GROUND-128,64*Math.max(0,hp/max),5);
}
function drawBattle(){
  bx.setTransform(bScale,0,0,bScale,0,0);
  bx.clearRect(-2,-2,W+4,LH+4);
  bx.save();
  if(B.shake>0)bx.translate((Math.random()-.5)*B.shake,(Math.random()-.5)*B.shake);
  drawBG();
  bx.fillStyle="rgba(0,0,0,.22)";
  for(const st of B.stones)bx.fillRect(st.x,GROUND+8+st.h,st.w,st.h);
  for(const cp of B.corpses)drawCorpse(cp);
  const pLvl=B.mode==="defense"?T[B.to].base:0;
  const eLvl=B.mode==="attack"?T[B.to].base:0;
  drawBase(50,1,B.pHP,B.pMax,pLvl,FACTIONS[B.pFacId].color);
  drawBase(W-50,-1,B.eHP,B.eMax,eLvl,FACTIONS[B.eFacId].color);
  for(const u of B.units)drawStick(u);
  bx.strokeStyle="#F4E9C8";bx.lineWidth=2;
  for(const p of B.projs){bx.beginPath();bx.moveTo(p.x,p.y);
    bx.lineTo(p.x+(p.tx-p.x)*0.35,p.y+(p.ty-p.y)*0.35);bx.stroke();}
  for(const p of B.pufs){bx.globalAlpha=Math.min(1,p.t*2);bx.fillStyle=p.c;
    bx.fillRect(p.x,p.y,p.s,p.s);bx.globalAlpha=1;}
  bx.textAlign="center";bx.font="700 13px Segoe UI";
  for(const d of B.dmgs){bx.globalAlpha=Math.min(1,d.t*2);bx.fillStyle=d.c;
    bx.fillText(d.txt,d.x,d.y);bx.globalAlpha=1;}
  if(B.duel&&!B.duel.resolved){
    const n1=ALL_HEROES[B.duel.h1.heroId].name,n2=ALL_HEROES[B.duel.h2.heroId].name;
    bx.fillStyle="rgba(8,16,22,.6)";bx.fillRect(0,LH*0.05,W,50);
    bx.fillStyle="#FFD866";bx.font="700 19px Impact, Arial";
    bx.fillText("⚔ DUELO DE CAMPEONES",W/2,LH*0.05+23);
    bx.fillStyle="#F4E9C8";bx.font="12px Segoe UI";
    bx.fillText(`${n1}  vs  ${n2}`,W/2,LH*0.05+42);
  }
  if(B.over&&B.result!==null){
    bx.fillStyle="rgba(8,16,22,.72)";bx.fillRect(0,0,W,LH);
    bx.fillStyle=B.result?"#D9A441":"#C63D2F";
    bx.font="700 40px Impact, Arial";
    bx.fillText(B.result?(B.mode==="attack"?"¡TERRITORIO CONQUISTADO!":"¡DEFENSA EXITOSA!")
      :(B.mode==="attack"?"OFENSIVA RECHAZADA":"TERRITORIO PERDIDO"),W/2,LH*0.44);
    bx.fillStyle="#E8DCC0";bx.font="15px Segoe UI";
    bx.fillText("Volviendo al mapa…",W/2,LH*0.44+38);
  }
  bx.restore();
}

function finishBattle(win,retreat=false){
  if(!B||B.over)return;
  B.over=true;B.result=win;
  const me=B.pFacId,foe=B.eFacId;
  // progreso de armas alternativas (por partida): Aníbal cuenta victorias con él activo,
  // Leónidas cuenta batallas completas sobreviviendo (gane o pierda el bando).
  for(const side of["1","-1"]){
    const S=B.S[side],fid=S.fac,heroId=F[fid].heroes[0];
    if(!heroId)continue;
    const wonThisSide=(side==="1")===win;
    if(heroId==="anibal"&&wonThisSide)heroProgressBump(fid,"anibal","wins");
    if(heroId==="leonidas"&&S.champAlive)heroProgressBump(fid,"leonidas","battlesSurvived");
  }
  if(win){SFX.win();burstScreen([FACTIONS[me].color,"#D9A441","#E8DCC0"],110);}
  else{SFX.lose();if(B.pvp)burstScreen([FACTIONS[foe].color,"#E8DCC0"],90);}
  const{from,to,mode}=B;
  setTimeout(()=>{
    const surv1=Math.max(2,B.units.filter(u=>u.side===1).length+2);
    const surv2=Math.max(2,B.units.filter(u=>u.side===-1).length+2);
    const soloMe=humans.length===1&&me===humans[0];
    if(mode==="attack"){
      if(win){
        T[to].owner=me;T[to].troops=surv1;
        T[from].troops=Math.max(1,Math.floor(T[from].troops*0.5));
        T[to].pop=Math.max(2,Math.floor(T[to].pop*0.8));
        T[to].base=Math.max(0,T[to].base-1);
        F[me].gold+=12+T[to].base*5;
        relAdd(me,foe,-20);
        if(soloMe){completeMission("conq1");checkContinentMission();}
        flashTerr(to);
        log(`${fname(me)} conquistó ${TERR[to].n} en batalla.`,"win");
      }else{
        T[from].troops=Math.max(1,Math.floor(T[from].troops*(retreat?0.7:0.45)));
        if(B.pvp&&!retreat)T[to].troops=Math.max(2,surv2);
        log(retreat?`${fname(me)} se retiró de ${TERR[to].n}.`:`La ofensiva de ${fname(me)} sobre ${TERR[to].n} fracasó.`,"loss");
      }
    }else{ // defensa (humano defiende su territorio "to")
      if(win){
        T[to].troops=Math.max(2,surv1);
        T[from].troops=Math.max(1,Math.floor(T[from].troops*0.4));
        F[me].gold+=10;
        log(`${fname(me)} defendió ${TERR[to].n}. El invasor se retira.`,"win");
      }else{
        T[to].owner=foe;flashTerr(to);
        T[to].troops=Math.max(2,Math.floor(T[from].troops*0.4));
        T[from].troops=Math.max(1,Math.floor(T[from].troops*0.4));
        log(`${fname(me)} perdió ${TERR[to].n} ante ${fname(foe)}.`,"loss");
      }
    }
    $("battle").style.display="none";
    B=null;inBattle=false;
    render();
    if(!checkEnd()&&aiCont){const c=aiCont;aiCont=null;setTimeout(c,350);}
  },1500);
}
