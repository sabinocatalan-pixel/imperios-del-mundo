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
const AIR_BONUS={ranged:"air",air:"heavy"}; // 🏹→✈️ ×1.5 (antiaéreo) · ✈️→🛡 ×1.5

function unitStats(kind,era,arm,wl){
  const m=Math.pow(1.75,era)*(1+arm*0.15);
  if(kind==="melee") return{hp:70*m, dmg:9*m, spd:40,rng:30, atk:0.75,cost:30, cd:1.5, size:1.25};
  if(kind==="ranged")return{hp:45*m, dmg:8*m, spd:34,rng:185+era*20,atk:1.1,cost:55, cd:3, size:1.25};
  if(kind==="heavy") return{hp:200*m,dmg:16*m,spd:22,rng:era>=3?66:34,atk:1.05,cost:110,cd:8, size:1.7};
  if(kind==="air")   return{hp:55*m, dmg:12*m,spd:52,rng:90, atk:1,   cost:95, cd:10,size:1.35};
  if(kind==="healer")return{hp:40*m, dmg:0,   spd:32,rng:70, atk:0.5, cost:65, cd:7, size:1.15,healRate:0.04};
  if(kind==="siege") return{hp:55*m, dmg:20*m, spd:18,rng:280+era*15,atk:2.4,cost:125,cd:10,size:1.6,minRng:80};
  if(kind==="champ")return{hp:340*(1+.45*wl)*Math.pow(1.3,era),dmg:28*(1+.4*wl)*Math.pow(1.3,era),
    spd:36,rng:140,atk:0.65,cost:0,cd:60,size:1.9};
}
function mkUnit(side,kind,era,arm,wl){
  const s=unitStats(kind,era,arm,wl);
  // Formaciones (Fase 2C): carril de profundidad -12/0/+12px + jitter ±4,
  // para que avancen en un frente de hasta 3 en vez de fila india. Es
  // puramente visual (drawStick) — el combate sigue siendo 1D sobre x.
  const laneY=[-12,0,12][Math.floor(Math.random()*3)]+(Math.random()*8-4);
  return{side,kind,era,x:side===1?70:W-70,hp:s.hp,max:s.hp,dmg:s.dmg,spd:s.spd,
    rng:s.rng,atk:s.atk,t:0,size:s.size,bob:Math.random()*6.28,flash:0,laneY,
    healRate:s.healRate||0,minRng:s.minRng||0};
}
function counterMult(att,def){
  if(def.kind==="siege"&&(att.kind==="melee"||att.kind==="air"))return 1.5;
  if(COUNTER[att.kind]===def.kind)return 1.5;
  if(COUNTER[def.kind]===att.kind)return 0.66;
  if(AIR_BONUS[att.kind]===def.kind)return 1.5; // ranged vs air, air vs heavy
  return 1;
}
// Reducción de daño recibido por pasivas/activas de héroes (Leónidas, Pachacútec)
// y por el rasgo de veteranía Nv3 de los melee (+5% def).
function dmgTakenMult(tgt){
  const S=B.S[String(tgt.side)],f=F[S.fac],heroId=f.heroes[0];
  let mult=1;
  if(S.defBuffT>0)mult*=0.9; // Pachacútec: Reorganización Imperial (10s)
  if(heroId==="leonidas"&&S.champAlive&&tgt.kind==="melee")mult*=0.9; // Muro de Escudos
  if(tgt.vetDefMult)mult*=tgt.vetDefMult;
  return mult;
}

/* ==================== VETERANÍA POR REGIMIENTO (Fase 2D) ====================
   Por imperio × tipo de unidad (melee/ranged/heavy/air — los héroes no
   forman parte de este sistema). Nv2 (30 XP): +8% daño. Nv3 (80 XP): +15%
   daño (reemplaza el +8%, no se suman) + un rasgo menor por tipo. Los
   rasgos visuales (drawStick) son SOLO cosméticos: la ventaja real es
   exactamente esta, nunca más de lo que se ve aquí. */
const VET_DMG_MULT={1:1,2:1.08,3:1.15};
function applyVeterancy(u,kind,lvl){
  u.vetLvl=lvl;
  if(kind==="healer")u.healMult=VET_DMG_MULT[lvl]||1;
  else u.dmg*=VET_DMG_MULT[lvl]||1;
  if(lvl>=3){
    if(kind==="melee")u.vetDefMult=0.95; // +5% def -> -5% daño recibido
    else if(kind==="ranged")u.rng*=1.1; // +10% alcance
    else if(kind==="heavy")u.atk*=0.9; // -10% cd de ataque (ataca más seguido)
    else if(kind==="air")u.spd*=1.1; // +10% velocidad
    else if(kind==="healer")u.rng*=1.1; // +10% radio de curación
    else if(kind==="siege")u.atk*=0.9; // -10% cd de ataque
  }
}
function applyVeterancyGains(){
  const nombres={melee:"cuerpo a cuerpo",ranged:"a distancia",heavy:"pesado",air:"aéreo",healer:"sanador",siege:"asedio"};
  for(const side of["1","-1"]){
    const S=B.S[side],f=F[S.fac];
    const won=(side==="1")===B.result;
    if(!f.veterancy)f.veterancy=nuevaVeterancia();
    for(const kind of["melee","ranged","heavy","air","healer","siege"]){
      const spawned=S.spawnedTypes[kind]||0;
      if(!spawned)continue;
      const kills=S.killsByType[kind]||0;
      const v=f.veterancy[kind];
      const nivelAntes=veteranLevel(v.xp);
      // Participar concede +2 una sola vez al regimiento (no por cada
      // unidad desplegada); victoria y bajas también son XP compartida.
      v.xp=Math.min(80,v.xp+2+kills+(won?4:0));
      // Derrota con muchas bajas (más de la mitad de lo desplegado de ese
      // tipo): -20% de la barra acumulada.
      const vivos=B.units.filter(u=>u.side===(side==="1"?1:-1)&&u.kind===kind&&u.hp>0).length;
      const bajas=spawned-vivos;
      if(!won&&bajas>spawned/2)v.xp=Math.max(0,v.xp-Math.round(v.xp*0.2));
      const nivelDespues=veteranLevel(v.xp);
      if(nivelDespues!==nivelAntes){
        const verbo=nivelDespues>nivelAntes?"alcanzó":"descendió a";
        logCausal(`⭐ El regimiento ${nombres[kind]} de ${fname(S.fac)} ${verbo} Veteranía Nv${nivelDespues} (${v.xp} XP).`,
          nivelDespues>nivelAntes?"win":"loss");
      }
    }
  }
}

/* ==================== BANNERS NARRATIVOS ====================
   Ajuste de legibilidad (pilar 6): los anuncios importantes de batalla
   (desgaste, habilidades de héroe, duelo) usan esta cola en vez del
   sistema de números de daño flotantes (B.dmgs), que es demasiado
   rápido para leer. Un solo banner visible a la vez, mínimo 3.5s con
   fade-in/fade-out (o sin fade si prefers-reduced-motion — SET.fx ya
   queda en false en ese caso, ver 01-config-audio.js); si llega uno
   nuevo mientras otro está activo, se encola y espera su turno. */
function pushBanner(txt,color="#FFD866",duration=3.5,subtxt=null){
  const item={txt,subtxt,color,duration};
  if(!B.banner)B.banner={...item,elapsed:0};
  else B.bannerQueue.push(item);
}
function advanceBanner(dt){
  if(B.banner){
    B.banner.elapsed+=dt;
    if(B.banner.elapsed>=B.banner.duration){
      B.banner=B.bannerQueue.length?{...B.bannerQueue.shift(),elapsed:0}:null;
    }
  }else if(B.bannerQueue.length){
    B.banner={...B.bannerQueue.shift(),elapsed:0};
  }
}

function openBattle(from,to,mode){
  $("battle").classList.remove("bossBattle");
  recordWar();
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
    banner:null,bannerQueue:[],
    pacing:{tension:false,muerteSubita:false,desgaste:false,resuelto:false},
    stones:Array.from({length:14},(_,i)=>({x:80+((i*137)%800),w:4+((i*53)%9),h:2+((i*31)%4)})),
    last:performance.now(),
    S:{
      "1":{fac:pFacId,gold:80,income:9+pFac.upEco*1.4,
        cool:{melee:0,ranged:0,heavy:0,healer:0,siege:0,champ:0,spec:0,heroAbil:0,air:0},champAlive:false,
        spdBuffT:0,defBuffT:0,dmgBuffAllT:0,amaruRevived:false,dmgDealt:0,
        heroSpawned:false,damageByType:{},spawnedTypes:{melee:0,ranged:0,heavy:0,air:0,healer:0,siege:0},killsByType:{melee:0,ranged:0,heavy:0,air:0,healer:0,siege:0}},
      "-1":{fac:eFacId,gold:pvp?80:60,
        income:pvp?(9+eFac.upEco*1.4):(8+eFac.era*1.2)*diffMult,
        cool:{melee:0,ranged:0,heavy:0,healer:0,siege:0,champ:pvp?0:20,spec:pvp?0:26,heroAbil:pvp?0:20,air:0},champAlive:false,
        spdBuffT:0,defBuffT:0,dmgBuffAllT:0,amaruRevived:false,dmgDealt:0,
        heroSpawned:false,damageByType:{},spawnedTypes:{melee:0,ranged:0,heavy:0,air:0,healer:0,siege:0},killsByType:{melee:0,ranged:0,heavy:0,air:0,healer:0,siege:0}}
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

function bossSideState(facId,gold,income){return{fac:facId,gold,income,
  cool:{melee:0,ranged:0,heavy:0,healer:0,siege:0,champ:0,spec:0,heroAbil:0,air:0},champAlive:false,
  spdBuffT:0,defBuffT:0,dmgBuffAllT:0,amaruRevived:false,dmgDealt:0,
  heroSpawned:false,damageByType:{},spawnedTypes:{melee:0,ranged:0,heavy:0,air:0,healer:0,siege:0},
  killsByType:{melee:0,ranged:0,heavy:0,air:0,healer:0,siege:0}};}
function openBossBattle(empireId,originId){
  const check=canChallengeMonster(monsterState,empireId,round);
  if(inBattle||!check.ok||check.origin.id!==originId||!markMonsterAttempt(monsterState,empireId,round))return false;
  const active=monsterState.active,monster=getMonsterById(active.id),f=F[empireId];
  inBattle=true;selected=null;
  B={from:originId,to:active.territory,mode:"boss",pvp:false,over:false,result:null,time:0,shake:0,freeze:0,
    pFacId:empireId,eFacId:empireId,bossId:active.id,bossTerritory:active.territory,challengeOrigin:originId,
    bossHp:active.hp,bossMaxHp:active.maxHp,bossAttackT:2.5,
    pHP:(330+f.upArm*40)*1.15,pMax:(330+f.upArm*40)*1.15,eHP:active.hp,eMax:active.maxHp,
    units:[],projs:[],dmgs:[],pufs:[],corpses:[],btnRefs:[],duel:null,duelDone:true,
    banner:null,bannerQueue:[],pacing:{tension:false,muerteSubita:false,desgaste:false,resuelto:false},
    stones:Array.from({length:14},(_,i)=>({x:80+((i*137)%800),w:4+((i*53)%9),h:2+((i*31)%4)})),
    last:performance.now(),S:{"1":bossSideState(empireId,80,9+f.upEco*1.4),"-1":bossSideState(empireId,0,0)},
    eCool:0,turretT:0};
  $("battle").classList.add("bossBattle");
  $("btitle").textContent=`BATALLA DE JEFE · ${monster.name}`;
  $("bnameP").textContent=fname(empireId)+" · "+ERAS[f.era];
  $("bnameE").textContent=`${monster.icon} ${monster.name}`;
  $("bmode").textContent="⚠ Jefe mítico · PV persistente · máximo 180s";
  buildBattleButtons();$("battle").style.display="flex";
  pushBanner(`${monster.icon} ${monster.name} acepta el desafío`,"#D99BFF",3.5,"Sin patrones especiales en este bloque");
  requestAnimationFrame(()=>{fitBattleCanvas();B.last=performance.now();requestAnimationFrame(bloop);});
  return true;
}

function spawnUnit(side,kind){
  const P=B.S[side],f=F[P.fac];
  if((kind==="healer"||kind==="siege")&&B.units.filter(u=>u.side===(+side)&&u.kind===kind).length>=2)return;
  if(kind==="air"){
    if(f.era<2)return; // Biplano llega en la Época Industrial
    if(B.units.filter(u=>u.side===(+side)&&u.kind==="air").length>=2)return; // máx. 2 por bando en campo
  }
  const st=unitStats(kind,f.era,f.upArm);
  let cost=st.cost;
  if(f.heroes[0]==="suntzu"&&P.champAlive)cost=Math.round(cost*0.9); // Sun Tzu: -10% costo mientras vive
  if(B.over||P.gold<cost||P.cool[kind]>0)return;
  P.gold-=cost;P.cool[kind]=st.cd;SFX.spawn();
  const u=mkUnit(+side,kind,f.era,f.upArm);
  if(B.pacing.desgaste){u.hp*=0.9;u.max*=0.9;} // desgaste (180s): refuerzos con -10% PV máx
  P.spawnedTypes[kind]=(P.spawnedTypes[kind]||0)+1;
  applyVeterancy(u,kind,veteranLevel((f.veterancy&&f.veterancy[kind]?f.veterancy[kind].xp:0)));
  B.units.push(u);
}
function spawnChamp(side){
  const P=B.S[side],f=F[P.fac];
  const heroId=f.heroes[0];
  if(B.over||!heroId||P.champAlive||P.cool.champ>0)return;
  P.cool.champ=60;P.champAlive=true;P.heroSpawned=true;SFX.evolve();
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
    pushBanner("⚡ ¡Carga Furiosa!");
  }else if(heroId==="anibal"){
    const fx=(+side)===1?W*0.35:W*0.65;
    for(let i=0;i<2;i++){
      const u=mkUnit(+side,"melee",f.era,f.upArm);
      u.x=fx+(i-0.5)*24;
      B.units.push(u);
    }
    pushBanner("🛡 ¡Flanqueo!");
  }else if(heroId==="pachacutec"){
    for(const u of allies)u.hp=Math.min(u.max,u.hp+u.max*0.25);
    P.defBuffT=10;
    pushBanner("✨ ¡Reorganización Imperial!","#7ED66E");
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
  pushBanner(`${n1}: "${f1}"`,"#F4E9C8",3.5,`${n2}: "${f2}"`);
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
  recordBalanceDuel(winner.heroId,loser.heroId);
  log(`⚔ ${nameW} venció a ${nameL} en duelo: ${rewardTxt} (energía de ${nameL} baja).`,"win");
  pushBanner(`⚔ ¡${nameW} gana el duelo!`,"#FFD866",3.5,rewardTxt);
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
  if(side==="-1")pushBanner("⚠️ ¡"+SPECIALS[f.era]+" enemigo!","#FF7A66");
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
    const vetTag=k=>{const lvl=veteranLevel((f.veterancy&&f.veterancy[k]?f.veterancy[k].xp:0));
      return lvl>1?` ${"★".repeat(lvl-1)}`:"";};
    for(const k of["healer","siege"]){
      const st=unitStats(k,f.era,f.upArm),b=document.createElement("button");b.className="ub";
      b.innerHTML=`${k==="healer"?"✚":"💥"} ${UNIT_NAMES[f.era][k]}${vetTag(k)}<small>${st.cost}🪙 · máx. 2</small><div class="cdo"></div>`;
      b.onclick=()=>spawnUnit(side,k);box.appendChild(b);
      B.btnRefs.push({el:b,cd:b.lastElementChild,side,kind:k});
    }
    for(const k of["melee","ranged","heavy"]){
      const st=unitStats(k,f.era,f.upArm);
      const b=document.createElement("button");b.className="ub";
      b.innerHTML=`${icons[k]} ${UNIT_NAMES[f.era][k]}${vetTag(k)}<small>${st.cost}🪙 · <span class="carrow">${CARROW[k]}</span></small><div class="cdo"></div>`;
      b.onclick=()=>spawnUnit(side,k);
      box.appendChild(b);
      B.btnRefs.push({el:b,cd:b.lastElementChild,side,kind:k});
    }
    if(f.era>=2){ // unidades aéreas: Época Industrial en adelante
      const st=unitStats("air",f.era,f.upArm);
      const b=document.createElement("button");b.className="ub";
      b.innerHTML=`✈️ ${UNIT_NAMES[f.era].air}${vetTag("air")}<small>${st.cost}🪙 · máx. 2</small><div class="cdo"></div>`;
      b.onclick=()=>spawnUnit(side,"air");
      box.appendChild(b);
      B.btnRefs.push({el:b,cd:b.lastElementChild,side,kind:"air"});
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
  r.innerHTML=B.pvp?"🏳 Rendición J1":(B.mode==="attack"||B.mode==="boss"?"🏳 Retirada":"🏳 Rendir territorio");
  r.onclick=()=>finishBattle(false,true);
  box.appendChild(r);
}
function enemyAI(dt){
  const P=B.S["-1"],eF=F[P.fac];
  const pesadilla=diffMult===1.5;
  B.eCool-=dt;
  // especial de la IA cuando el jugador acumula ejército
  if(P.cool.spec<=0&&(pesadilla||B.units.filter(u=>u.side===1).length>=3))useSpecial("-1");
  // héroe de la IA si su imperio tiene uno equipado
  if(eF.heroes[0]&&!P.champAlive&&P.cool.champ<=0&&(pesadilla||B.time>12))spawnChamp("-1");
  if(P.champAlive&&P.cool.heroAbil<=0){
    const hero=ALL_HEROES[eF.heroes[0]];
    if(hero&&hero.habilidad&&hero.habilidad.tipo==="activa")useHeroAbility("-1");
  }
  if(B.eCool>0)return;
  const heridos=B.units.some(u=>u.side===-1&&u.kind!=="healer"&&u.hp>0&&u.hp<u.max);
  if(heridos&&Math.random()<0.3){
    const goldAntes=P.gold;spawnUnit("-1","healer");
    if(P.gold<goldAntes){B.eCool=0.7+Math.random()*0.9;return;}
  }
  if(Math.random()<0.25){
    const goldAntes=P.gold;spawnUnit("-1","siege");
    if(P.gold<goldAntes){B.eCool=0.7+Math.random()*0.9;return;}
  }
  if(eF.era>=2&&Math.random()<0.2){ // la IA también usa unidades aéreas, mismas reglas y límites
    const goldAntes=P.gold;
    spawnUnit("-1","air");
    if(P.gold<goldAntes){B.eCool=0.7+Math.random()*0.9;return;}
  }
  const affordable=["melee","ranged","heavy"].filter(k=>P.gold>=unitStats(k,eF.era,eF.upArm).cost);
  if(!affordable.length)return;
  let pick;
  const cpChance=pesadilla?0.65:diffMult>1.15?0.5:0.3;
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
function bossNormalAttack(dt){
  if(B.mode!=="boss"||B.over)return;
  B.bossAttackT-=dt;if(B.bossAttackT>0)return;B.bossAttackT=2.5;
  const active=monsterState.active;if(!active||active.id!==B.bossId)return finishBattle(false);
  const target=B.units.filter(u=>u.side===1&&u.hp>0).sort((a,b)=>b.x-a.x)[0];
  if(target){
    const damage=active.damage*dmgTakenMult(target);target.hp-=damage;target.flash=0.2;
    B.dmgs.push({x:target.x,y:GROUND-55*target.size,txt:Math.round(damage),t:0.7,c:"#D99BFF"});
    B.projs.push({x:W-90,y:GROUND-90,tx:target.x,ty:GROUND-25*target.size,t:0.25,c:"#D99BFF"});
  }else B.pHP-=active.damage*0.35;
  SFX.hit();if(SET.fx)B.shake=Math.max(B.shake,5);
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
      pushBanner("⚠️ Tensión de guerra: +10% ingreso");
      log("⚠️ Tensión de guerra en la batalla: el ingreso de ambos bandos sube 10%.");
    }
    if(!B.pacing.muerteSubita&&B.time>=150){
      B.pacing.muerteSubita=true;
      pushBanner("💀 Muerte súbita: bases +20% daño recibido","#C63D2F");
      log("💀 Muerte súbita: las bases reciben 20% más de daño desde ahora.","loss");
    }
    if(!B.pacing.desgaste&&B.time>=180){
      B.pacing.desgaste=true;
      pushBanner("📉 Desgaste: refuerzos con -10% PV","#9FB3BE");
      log("📉 Las líneas de suministro se agotan: los refuerzos llegan con -10% PV máximo.");
    }
    advanceBanner(dt);
    for(const sd of["1","-1"]){
      const P=B.S[sd];P.gold+=P.income*dt;
      for(const k in P.cool)P.cool[k]=Math.max(0,P.cool[k]-dt);
      P.spdBuffT=Math.max(0,P.spdBuffT-dt);
      P.defBuffT=Math.max(0,P.defBuffT-dt);
      P.dmgBuffAllT=Math.max(0,P.dmgBuffAllT-dt);
    }
    if(B.mode==="boss")bossNormalAttack(dt);
    else if(!B.pvp)enemyAI(dt);
    // torreta de la base defendida (según nivel de base del territorio)
    const tb=B.mode==="boss"?0:T[B.to].base;
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
      // Anti-atoro UNIVERSAL (cualquier tipo de unidad, no solo ranged): si en
      // los últimos ~1.2s no atacó y prácticamente no avanzó, se fuerza un
      // micro-reposicionamiento — empuje hacia adelante + nuevo carril lateral
      // al azar — sin importar la causa exacta del bloqueo (aliado delante,
      // apilado con otro del mismo tipo, o cualquier otra situación no
      // prevista). Objetivo: ninguna unidad viva queda congelada varios
      // segundos mientras la línea de combate sigue adelante.
      u.idleCheckT=(u.idleCheckT||0)+dt;
      if(u.idleCheckT>=1.2){
        const avance=Math.abs(u.x-(u.lastCheckX??u.x));
        if(avance<3&&!u.attackedInWindow){
          u.x+=u.spd*u.side*0.3;
          u.laneY=[-12,0,12][Math.floor(Math.random()*3)]+(Math.random()*8-4); // recarrila para dejar de bloquear/ser bloqueado
        }
        u.lastCheckX=u.x;u.idleCheckT=0;u.attackedInWindow=false;
      }
      if(u.kind==="healer"){
        const allies=B.units.filter(v=>{
          if(v===u||v.side!==u.side||v.kind==="healer"||v.hp<=0||v.hp>=v.max||Math.abs(v.x-u.x)>u.rng)return false;
          const asignado=B.units.filter(h=>h.side===u.side&&h.kind==="healer"&&h.hp>0&&Math.abs(v.x-h.x)<=h.rng)
            .sort((a,b)=>Math.abs(v.x-a.x)-Math.abs(v.x-b.x))[0];
          return asignado===u; // curación no apilable: un solo sanador por aliado
        });
        if(u.t<=0&&allies.length){
          u.t=u.atk;
          for(const v of allies){
            const heroMult=v.kind==="champ"?0.5:1,wearMult=B.pacing.desgaste?0.5:1;
            const amount=Math.min(v.max-v.hp,v.max*u.healRate*u.atk*(u.healMult||1)*heroMult*wearMult);
            if(amount<=0)continue;
            v.hp+=amount;v.flash=0.12;
            B.projs.push({x:u.x,y:GROUND-24*u.size,tx:v.x,ty:GROUND-30*v.size,t:0.18,c:"#7ED66E"});
            B.dmgs.push({x:v.x,y:GROUND-54*v.size,txt:"+"+Math.max(1,Math.round(amount)),t:0.6,c:"#7ED66E"});
          }
        }
        if(allies.length)u.attackedInWindow=true;
        else{
          const delante=B.units.find(v=>v!==u&&v.side===u.side&&v.kind!=="healer"&&v.hp>0&&(v.x-u.x)*u.side>0&&(v.x-u.x)*u.side<48);
          if(!delante)u.x+=u.spd*u.side*dt;
        }
        continue; // soporte puro: nunca busca ni ataca enemigos
      }
      // Melee y heavy no alcanzan aéreos (inmunidad): se filtran de su lista
      // de enemigos válidos, tanto para atacar como para bloquear su avance.
      const foes=B.units.filter(v=>v.side!==u.side&&v.hp>0&&
        !((u.kind==="melee"||u.kind==="heavy")&&v.kind==="air"));
      const siegeSuppressed=u.kind==="siege"&&foes.some(v=>v.kind==="melee"&&Math.abs(v.x-u.x)<u.minRng);
      let tgt=null,dist=Infinity;
      if(u.kind==="melee"){
        // Enfrentamiento en arco (formaciones): hasta 3 melee por objetivo;
        // el 4º busca el siguiente enemigo más cercano en vez de amontonarse.
        const candidatos=foes.filter(v=>(v.x-u.x)*u.side>0).sort((a,b)=>
          (b.kind==="healer")-(a.kind==="healer")||Math.abs(a.x-u.x)-Math.abs(b.x-u.x));
        for(const v of candidatos){
          const enganchados=B.units.filter(w=>w!==u&&w.kind==="melee"&&w.side===u.side&&w.hp>0&&Math.abs(w.x-v.x)<=w.rng+4).length;
          if(enganchados<3){tgt=v;dist=Math.abs(v.x-u.x);break;}
        }
        if(!tgt&&candidatos.length){tgt=candidatos[0];dist=Math.abs(candidatos[0].x-u.x);} // todos con 3+: ataca igual al más cercano
      }else if(u.kind==="air"){
        // Objetivo aéreo: prioriza heavy enemigo; si no hay, ✈️ vs ✈️ también
        // es un enfrentamiento válido (matriz ✈️vs✈️ ×1); si no hay ninguno
        // de los dos, ignora el resto de unidades terrestres y va por la base.
        const candidatos=foes.filter(v=>(v.kind==="heavy"||v.kind==="siege"||v.kind==="air")&&(v.x-u.x)*u.side>0)
          .sort((a,b)=>{const pr={heavy:0,siege:1,air:2};return pr[a.kind]-pr[b.kind]||Math.abs(a.x-u.x)-Math.abs(b.x-u.x);});
        tgt=candidatos[0]||null;
        dist=tgt?Math.abs(tgt.x-u.x):Infinity;
      }else if(u.kind==="siege"){
        if(!siegeSuppressed){
          const enemyBase=u.side===1?W-58:58,bd=(enemyBase-u.x)*u.side;
          if(bd>u.rng+18){
            const candidatos=foes.filter(v=>v.kind!=="air"&&(v.x-u.x)*u.side>=u.minRng)
              .sort((a,b)=>(b.kind==="healer")-(a.kind==="healer")||Math.abs(a.x-u.x)-Math.abs(b.x-u.x));
            tgt=candidatos[0]||null;dist=tgt?Math.abs(tgt.x-u.x):Infinity;
          }
        }
      }else{
        const candidatos=foes.filter(v=>(v.x-u.x)*u.side>0).sort((a,b)=>
          (b.kind==="healer")-(a.kind==="healer")||Math.abs(a.x-u.x)-Math.abs(b.x-u.x));
        tgt=candidatos[0]||null;dist=tgt?Math.abs(tgt.x-u.x):Infinity;
      }
      const baseX=u.side===1?W-58:58;
      const baseD=(baseX-u.x)*u.side;
      const dmgMultOut=(B.S[String(u.side)].dmgBuffAllT>0)?1.15:1; // Ollantay: al morir, +15% daño 8s
      // Dos héroes activos siguen cerrando distancia hasta quedar a ≤60px
      // (zona de duelo) en vez de trabarse en combate normal a rng=140;
      // si no, con ese alcance jamás llegarían a la distancia del duelo.
      // Una vez usado el único duelo de la batalla, vuelven a engancharse
      // como cualquier otro enfrentamiento. Ranged mantiene distancia:
      // se detiene al 80% de su alcance en vez de caminar hasta el borde.
      const champVsChamp=tgt&&u.kind==="champ"&&tgt.kind==="champ"&&!B.duelDone;
      const engageRng=champVsChamp?60:(u.kind==="ranged"?u.rng*0.8:u.rng);
      if(tgt&&dist<=engageRng){
        u.attackedInWindow=true; // atacando: no cuenta para el anti-atoro
        if(u.t<=0){u.t=u.atk;
          const mult=counterMult(u,tgt);
          const dm=u.dmg*mult*dmgMultOut*dmgTakenMult(tgt);
          tgt.hp-=dm;tgt.flash=0.15;SFX.hit();
          B.S[String(u.side)].dmgDealt+=dm;
          B.S[String(u.side)].damageByType[u.kind]=(B.S[String(u.side)].damageByType[u.kind]||0)+dm;
          B.dmgs.push({x:tgt.x,y:GROUND-52*tgt.size,txt:Math.round(dm),t:0.6,
            c:mult>1?"#FFD866":(mult<1?"#9FB3BE":"#F4E9C8")});
          if(u.rng>60)B.projs.push({x:u.x,y:GROUND-22*u.size,tx:tgt.x,ty:GROUND-16,t:0.2});
          if(u.kind==="siege"){
            const nearby=B.units.filter(v=>v!==tgt&&v.side===tgt.side&&v.kind!=="air"&&v.hp>0&&Math.abs(v.x-tgt.x)<32);
            for(const v of nearby){const spl=u.dmg*0.35*dmgMultOut*dmgTakenMult(v);v.hp-=spl;v.flash=0.12;
              B.S[String(u.side)].damageByType[u.kind]=(B.S[String(u.side)].damageByType[u.kind]||0)+spl;
              B.dmgs.push({x:v.x,y:GROUND-50*v.size,txt:Math.round(spl),t:0.6,c:"#D9A441"});}
            const p=B.projs[B.projs.length-1];if(p)p.arc=true;
          }
          if(u.heroId==="tomoegozen"){ // Danza de la Naginata: golpe en área pequeña
            const nearby=B.units.filter(v=>v!==tgt&&v.side===tgt.side&&v.hp>0&&Math.abs(v.x-tgt.x)<28);
            for(const v of nearby){
              const spl=u.dmg*0.5*dmgTakenMult(v);v.hp-=spl;v.flash=0.15;
              B.dmgs.push({x:v.x,y:GROUND-52*v.size,txt:Math.round(spl),t:0.6,c:"#F4E9C8"});
            }
          }
          if(tgt.hp<=0){
            const kb=B.S[String(u.side)].killsByType;
            if(kb&&kb[u.kind]!==undefined)kb[u.kind]++; // veteranía: baja enemiga +1 XP al regimiento que la logró
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
      }else if(!tgt&&!siegeSuppressed&&baseD<=u.rng+18&&baseD>=(u.minRng||0)){
        u.attackedInWindow=true; // atacando la base: no cuenta para el anti-atoro
        if(u.t<=0){u.t=u.atk;
          const baseMult=B.pacing.muerteSubita?1.2:1; // muerte súbita: bases +20% daño recibido
          const dmgToBase=u.dmg*dmgMultOut*baseMult;
          if(u.side===1){B.eHP-=dmgToBase;if(SET.fx)B.shake=Math.max(B.shake,3);}
          else{B.pHP-=dmgToBase;if(SET.fx)B.shake=Math.max(B.shake,3);}
          B.S[String(u.side)].dmgDealt+=dmgToBase;
          B.S[String(u.side)].damageByType[u.kind]=(B.S[String(u.side)].damageByType[u.kind]||0)+dmgToBase;
          SFX.hit();
          if(u.rng>60)B.projs.push({x:u.x,y:GROUND-22*u.size,tx:baseX,ty:GROUND-50,t:0.2,arc:u.kind==="siege"});}
      }else{
        if(u.kind==="siege"&&(siegeSuppressed||baseD<u.minRng))continue; // melee cercano: asedio totalmente anulado
        const spdMult=(B.S[String(u.side)].spdBuffT>0)?1.2:1; // Boudica: Carga Furiosa (6s)
        // El bloqueo por aliado-delante y la separación por apilado solo
        // cuentan entre unidades del MISMO carril (laneY cercano) — así el
        // recarrilado del anti-atoro (arriba) realmente saca a la unidad del
        // bloqueo en vez de quedar atrapada en el mismo grupo para siempre.
        const ally=B.units.find(v=>v!==u&&v.side===u.side&&v.hp>0&&
          (v.x-u.x)*u.side>0&&(v.x-u.x)*u.side<20&&v.rng<=60&&
          Math.abs((v.laneY||0)-(u.laneY||0))<10);
        const sameKindClose=B.units.find(v=>v!==u&&v.side===u.side&&v.kind===u.kind&&v.hp>0&&
          Math.abs(v.x-u.x)<16&&Math.abs((v.laneY||0)-(u.laneY||0))<10);
        const ignoraBloqueo=u.kind==="air"; // vuela sobre el tráfico terrestre
        if((ignoraBloqueo||!ally||u.rng>60&&(ally.x-u.x)*u.side>40)&&!sameKindClose)u.x+=u.spd*spdMult*u.side*dt;
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
    if(B.mode==="boss")B.bossHp=Math.max(0,B.eHP);
    if(B.eHP<=0)finishBattle(true);
    else if(B.pHP<=0)finishBattle(false);
    else if(B.mode==="boss"&&B.time>=180){
      B.pacing.resuelto=true;
      log("⏱ El desafío terminó tras 180s: el monstruo conserva los PV restantes.","loss");
      finishBattle(false);
    }else if(!B.pacing.resuelto&&B.time>=210){
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
      const airLleno=r.kind==="air"&&B.units.filter(u=>u.side===(+r.side)&&u.kind==="air").length>=2;
      const apoyoLleno=(r.kind==="healer"||r.kind==="siege")&&B.units.filter(u=>u.side===(+r.side)&&u.kind===r.kind).length>=2;
      r.el.disabled=B.over||P.gold<st.cost||P.cool[r.kind]>0||airLleno||apoyoLleno;
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
  const flyOff=u.kind==="air"?90:0;               // vuelan a GROUND-90
  const trazo=u.vetLvl>=3?1.1:1;                  // Nv3: trazo cosmético +10%
  bx.save();bx.translate(x,g-flyOff+bobY+(u.laneY||0));bx.scale(u.side,1); // carril de profundidad (formaciones)
  bx.strokeStyle=c;bx.fillStyle=c;bx.lineWidth=2.4*s*trazo;bx.lineCap="round";
  if(u.kind==="air"){ // avión: fuselaje simple + alas
    bx.fillStyle=c;
    bx.beginPath();bx.moveTo(15*s,0);bx.lineTo(-9*s,-5*s);bx.lineTo(-3*s,0);bx.lineTo(-9*s,5*s);bx.closePath();bx.fill();
    bx.strokeStyle=shade(facC,-15);bx.lineWidth=1.6*s*trazo;
    bx.beginPath();bx.moveTo(0,-13*s);bx.lineTo(0,13*s);bx.stroke(); // silueta del ala
    bx.restore();
  }else if(u.kind==="siege"){
    bx.fillStyle="#4A443A";bx.fillRect(-15*s,-12*s,30*s,8*s);
    bx.fillStyle=c;bx.beginPath();bx.arc(-10*s,-3*s,5*s,0,7);bx.arc(10*s,-3*s,5*s,0,7);bx.fill();
    bx.strokeStyle="#D8CBA8";bx.lineWidth=3*s*trazo;bx.beginPath();bx.moveTo(-5*s,-13*s);bx.lineTo(22*s,-29*s);bx.stroke();
    bx.restore();
  }else if(u.kind==="heavy"&&u.era>=3){ // tanque
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
    bx.strokeStyle=shade(facC,-25);bx.lineWidth=2.6*s*trazo;bx.lineCap="round";
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
    bx.strokeStyle=u.flash>0?"#fff":"#D8CBA8";bx.lineWidth=2*s*trazo;
    if(u.kind==="champ"){bx.strokeStyle="#FFD866";bx.lineWidth=3*s*trazo;
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
  bx.fillStyle="rgba(0,0,0,.5)";bx.fillRect(x-12,g-flyOff-46*u.size,24,3);
  bx.fillStyle="#7ED66E";bx.fillRect(x-12,g-flyOff-46*u.size,24*Math.max(0,u.hp/u.max),3);
  if(u.kind==="healer"){
    bx.fillStyle="#7ED66E";bx.fillRect(x-5,g-72*u.size,10,3);bx.fillRect(x-1.5,g-75.5*u.size,3,10);
  }
  // Rasgos visuales de veteranía (Fase 2D) — SOLO cosméticos, la ventaja
  // real ya está aplicada en applyVeterancy(); esto solo comunica estatus.
  if(u.vetLvl>=2&&diffMult>=1){
    const dorado=u.vetLvl>=3,fy=g-flyOff-54*u.size;
    bx.strokeStyle=dorado?"#FFD866":"#D8CBA8";bx.lineWidth=dorado?1.8:1.3;
    bx.beginPath();bx.moveTo(x,fy);bx.lineTo(x,fy-(dorado?14:10)*u.size);bx.stroke();
    bx.fillStyle=dorado?"#FFD866":FACTIONS[u.side===1?B.pFacId:B.eFacId].color;
    bx.beginPath();bx.moveTo(x,fy-(dorado?14:10)*u.size);
    bx.lineTo(x+u.side*(dorado?10:7)*u.size,fy-(dorado?11:7)*u.size);
    bx.lineTo(x,fy-(dorado?8:4)*u.size);bx.closePath();bx.fill();
    if(dorado){bx.beginPath();bx.arc(x,fy-17*u.size,2.4*u.size,0,7);bx.fill();}
  }
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
function drawBoss(){
  const monster=getMonsterById(B.bossId),x=W-72,y=GROUND-62;
  bx.fillStyle="rgba(8,16,22,.86)";bx.strokeStyle="#D99BFF";bx.lineWidth=5;
  bx.beginPath();bx.arc(x,y,48,0,Math.PI*2);bx.fill();bx.stroke();
  bx.font="48px Segoe UI Emoji, sans-serif";bx.textAlign="center";bx.fillStyle="#fff";bx.fillText(monster.icon,x,y+16);
  bx.fillStyle="rgba(0,0,0,.65)";bx.fillRect(x-65,y-70,130,10);
  bx.fillStyle="#B15FE0";bx.fillRect(x-64,y-69,128*Math.max(0,B.eHP/B.eMax),8);
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
  if(B.mode==="boss")drawBoss();else drawBase(W-50,-1,B.eHP,B.eMax,eLvl,FACTIONS[B.eFacId].color);
  for(const u of B.units)drawStick(u);
    bx.strokeStyle="#F4E9C8";bx.lineWidth=2;
    for(const p of B.projs){bx.beginPath();bx.moveTo(p.x,p.y);bx.strokeStyle=p.c||"#F4E9C8";
    if(p.arc)bx.quadraticCurveTo((p.x+p.tx)/2,Math.min(p.y,p.ty)-70,p.tx,p.ty);
    else bx.lineTo(p.x+(p.tx-p.x)*0.35,p.y+(p.ty-p.y)*0.35);bx.stroke();}
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
  if(B.banner){
    // Se dibuja más abajo que el título del duelo para que nunca se
    // superpongan si coinciden; la cola (bannerQueue) ya evita que dos
    // anuncios de esta franja se muestren a la vez.
    const FADE=0.4;
    let alpha=1;
    if(SET.fx){
      if(B.banner.elapsed<FADE)alpha=B.banner.elapsed/FADE;
      else if(B.banner.elapsed>B.banner.duration-FADE)alpha=Math.max(0,(B.banner.duration-B.banner.elapsed)/FADE);
    }
    const by=LH*0.17,bh=B.banner.subtxt?46:32;
    bx.globalAlpha=alpha;
    bx.fillStyle="rgba(8,16,22,.62)";bx.fillRect(0,by,W,bh);
    bx.fillStyle=B.banner.color;bx.font="700 16px Impact, Arial";
    bx.fillText(B.banner.txt,W/2,by+20);
    if(B.banner.subtxt){bx.fillStyle="#F4E9C8";bx.font="12px Segoe UI";bx.fillText(B.banner.subtxt,W/2,by+38);}
    bx.globalAlpha=1;
  }
  if(B.over&&B.result!==null){
    bx.fillStyle="rgba(8,16,22,.72)";bx.fillRect(0,0,W,LH);
    bx.fillStyle=B.result?"#D9A441":"#C63D2F";
    bx.font="700 40px Impact, Arial";
    const resultText=B.mode==="boss"?(B.result?"¡JEFE MÍTICO DERROTADO!":"EL JEFE RESISTE"):
      (B.result?(B.mode==="attack"?"¡TERRITORIO CONQUISTADO!":"¡DEFENSA EXITOSA!")
      :(B.mode==="attack"?"OFENSIVA RECHAZADA":"TERRITORIO PERDIDO"));
    bx.fillText(resultText,W/2,LH*0.44);
    bx.fillStyle="#E8DCC0";bx.font="15px Segoe UI";
    bx.fillText("Volviendo al mapa…",W/2,LH*0.44+38);
  }
  bx.restore();
}

function finishBattle(win,retreat=false){
  if(!B||B.over)return;
  if(B.mode==="boss")return finishBossBattle(win,retreat);
  B.over=true;B.result=win;
  recordBalanceBattle(B,win);
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
  applyVeterancyGains(); // XP de regimiento (Fase 2D), antes de que B.units cambie más
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

function finishBossBattle(win,retreat=false){
  if(!B||B.over||B.mode!=="boss")return;
  B.over=true;B.result=win;recordBalanceBattle(B,win);applyVeterancyGains();
  const snapshot=B,active=monsterState.active,monster=active&&getMonsterById(active.id);
  const ownerBefore=T[snapshot.bossTerritory].owner;
  if(active&&active.id===snapshot.bossId)active.hp=Math.max(0,Math.min(active.maxHp,snapshot.eHP));
  if(win&&active&&monster){
    const reward=getMonsterReward(active.id,snapshot.pFacId,active.territory,round);
    monsterState.defeated[active.id]=true;if(reward)monsterState.rewards.push(reward);monsterState.active=null;
    logCausal(`🏆 ${fname(snapshot.pFacId)} derrotó a ${monster.name}. ${reward?reward.name+" quedó registrada como recompensa inerte.":""}`,"win");
    showWorldBanner("🏆 JEFE MÍTICO DERROTADO",`${monster.name} cayó. Sus saqueos terminaron.`);
    SFX.win();burstScreen([FACTIONS[snapshot.pFacId].color,"#D99BFF","#D9A441"],110);
  }else if(active&&monster){
    const origin=T[snapshot.challengeOrigin],factor=retreat?0.7:0.45;
    if(origin)origin.troops=Math.max(1,Math.floor(origin.troops*factor));
    logCausal(retreat
      ?`🏳 ${fname(snapshot.pFacId)} se retiró ante ${monster.name}; el jefe conserva ${Math.round(active.hp)} PV.`
      :`💀 ${monster.name} rechazó el desafío de ${fname(snapshot.pFacId)} y conserva ${Math.round(active.hp)} PV.`,"loss");
    SFX.lose();
  }
  // El modo jefe nunca altera la propiedad del territorio.
  T[snapshot.bossTerritory].owner=ownerBefore;
  setTimeout(()=>{
    if(B!==snapshot)return;
    $("battle").style.display="none";$("battle").classList.remove("bossBattle");B=null;inBattle=false;selected=snapshot.bossTerritory;render();
  },1500);
}
