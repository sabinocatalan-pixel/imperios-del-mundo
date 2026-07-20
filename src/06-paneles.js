/* ==================== 06-paneles.js ====================
   Render de paneles: recursos, territorio e imperio. */
/* ==================== RENDER PANELES ==================== */
function render(){
  for(const id in TERR){
    const t=T[id],poly=$("p"+id);
    poly.setAttribute("fill",`url(#grad_${t.owner})`);
    poly.classList.toggle("sel",selected===id);
    const canT=phase==="play"&&selected&&T[selected]&&T[selected].owner===player&&ADJ[selected].includes(id)&&t.owner!==player;
    poly.classList.toggle("target",!!canT);
    $("tt"+id).textContent=`${FACTIONS[t.owner].emb}⚔${t.troops}${t.base>0?" 🏰"+t.base:""}${t.plague>0?" ☣":""}`;
  }
  renderMythicThreat();
  renderRes();renderTerr();renderEmp();
}
function renderRes(){
  if(!player){$("resbar").innerHTML="";return;}
  const f=F[player],state=currentStrategicRecruitmentState();
  const used=getEmpireTroopsUsed(state,player),capacity=getEmpirePopulationCapacity(state,player);
  const ratio=capacity?used/capacity:1,capacityClass=ratio>=1?"capacityFull":ratio>=0.8?"capacityWarn":"capacityNormal";
  const capacityText=`Tropas usadas ${used} · Capacidad poblacional ${capacity}`;
  $("resbar").innerHTML=
   `<span class="res">🪙 <b>${f.gold}</b></span><span class="res">🌾 <b>${f.food}</b></span>
    <span class="res">🔬 <b>${f.science}</b></span><span class="res">✨ <b>${f.faith}</b>/${FAITH_WIN}</span>
    <span class="res">🎭 <b>${f.culture}</b>/${CULT_WIN}</span>
    <span class="res">🏛 <b>${ERAS[f.era]}</b></span><span class="res capacityIndicator ${capacityClass}" title="${capacityText}" aria-label="${capacityText}">👥 <b>${used}/${capacity}</b></span>
    <span class="res">Ronda <b>${round}</b></span>`;
}
function renderTerr(){
  const info=$("terrInfo"),btns=$("terrBtns"),title=$("terrTitle");btns.innerHTML="";
  if(!selected){title.textContent="Territorio";info.textContent="Selecciona un territorio.";return;}
  const t=T[selected],d=TERR[selected],mine=t.owner===player;
  title.textContent=mine?"Territorio":"Territorio · Diplomacia";
  const localCapacity=getTerritoryTroopCapacity(t);
  let h=`<div class="row"><span><b>${d.n}</b> — ${FACTIONS[t.owner].name}</span></div>
    <div class="row"><span>⚔ Tropas: ${t.troops}/${localCapacity}</span><span>👥 Población: ${t.pop}</span></div>
    <div class="row"><span>🏰 Base nv${t.base}</span><span>Recurso: ${RESICON[d.res]} ${d.res}</span></div>
    <div class="row"><span>☣ ${t.plague>0?"Plaga ("+t.plague+")":"Sin enfermedad"}</span></div>
    ${getMonsterTerritoryPanelHtml(selected)}`;
  if(!mine&&player&&t.owner!==player){
    const fid=t.owner,r=relGet(player,fid),p=pactBetween(player,fid);
    const pct=(r+100)/2;
    h+=`<div class="row" style="margin-top:4px"><span>Relación con ${FACTIONS[fid].name} (${FACTIONS[fid].pers})</span><span>${r>0?"+":""}${r}</span></div>
      <div class="relbar"><i style="width:${pct}%;background:${r>=0?"#7ED66E":"#C63D2F"}"></i></div>
      ${p?`<div class="row"><span>🤝 ${p.type==="ali"?"Alianza":"Pacto de no agresión"} (${p.rounds} rondas)</span></div>`:""}`;
  }
  info.innerHTML=h;
  if(phase!=="play")return;
  const f=F[player];
  if(monsterState.active&&monsterState.active.territory===selected){
    const challenge=canChallengeMonster(monsterState,player,round);
    btns.appendChild(mkBtn(challenge.ok?"⚔ Desafiar":`⚔ Desafiar · ${challenge.reason}`,
      ()=>prepareMonsterChallenge(player),!challenge.ok,"danger"));
  }
  if(mine){
    const recruitment=recruitmentEvaluation(currentStrategicRecruitmentState(),player,selected);
    const partial=recruitment.ok&&recruitment.actualAmount<STRATEGIC_RECRUITMENT.baseAmount;
    const recLabel=recruitment.ok
      ?`Reclutar ${partial?"parcial ":""}+${recruitment.actualAmount} · ${recruitment.cost.gold}🪙 ${recruitment.cost.food}🌾`
      :`Reclutar · ${recruitment.reason}`;
    const rec=mkBtn(recLabel,()=>{
      const result=applyStrategicRecruitment(currentStrategicRecruitmentState(),player,selected);
      if(!result.ok){setStatus(result.reason);render();return;}
      SFX.spawn();log(`${result.partial?"Reclutamiento parcial":"Reclutamiento"}: +${result.amount} tropas en ${d.n} (${result.cost.gold}🪙 ${result.cost.food}🌾).`);
      render();
    },!recruitment.ok);
    rec.title=recLabel;rec.setAttribute("aria-label",recLabel);
    btns.appendChild(rec);
    if(t.base<3){
      const c=30+t.base*25;
      btns.appendChild(mkBtn(`Base → nv${t.base+1} (${c}🪙)`,()=>{f.gold-=c;t.base++;
        completeMission("base1");SFX.coin();
        log(`Base de ${d.n} → nivel ${t.base}: +defensa, +torreta, +producción.`,"win");render();},
        f.gold<c,"gold"));
    }
  }else{
    const fid=t.owner;
    if(!pactBetween(player,fid)){
      btns.appendChild(mkBtn("🕊 Pacto no agresión (30🪙)",()=>{
        f.gold-=30;pacts.push({a:player,b:fid,type:"nap",rounds:5});relAdd(player,fid,15);
        completeMission("diplo");SFX.coin();
        log(`Pacto de no agresión con ${FACTIONS[fid].name} (5 rondas).`,"win");render();},
        f.gold<30||relGet(player,fid)<-30,"gold"));
      btns.appendChild(mkBtn("🤝 Alianza (50🪙)",()=>{
        f.gold-=50;pacts.push({a:player,b:fid,type:"ali",rounds:8});relAdd(player,fid,25);
        completeMission("diplo");SFX.win();
        log(`¡Alianza con ${FACTIONS[fid].name}! (8 rondas, no os atacaréis).`,"win");render();},
        f.gold<50||relGet(player,fid)<20,"gold"));
    }
    btns.appendChild(mkBtn("🎁 Tributo (20🪙 → +15 rel.)",()=>{
      f.gold-=20;F[fid].gold+=20;relAdd(player,fid,15);SFX.coin();
      log(`Enviaste tributo a ${FACTIONS[fid].name}.`);render();},f.gold<20));
  }
}
function mkBtn(txt,fn,dis=false,cls="",preserveRelicWindow=false){
  const b=document.createElement("button");b.className="act "+cls;b.textContent=txt;
  b.disabled=dis;b.onclick=()=>{if(!b.disabled){if(!preserveRelicWindow)relicChangeOpen=false;fn();}};return b;
}
function renderRelicPanel(fid){
  const state=currentRelicState(),owned=getEmpireRelics(state,fid),equipped=getEquippedRelic(state,fid);
  if(!owned.length)return`<section class="relicPanel" id="relicPanel"><b>◆ Reliquia equipada · slot único</b>
    <div class="relicEmpty">Aún no posees reliquias. Vencer una amenaza mítica garantiza su reliquia base.</div></section>`;
  return`<section class="relicPanel" id="relicPanel"><b>◆ Reliquia equipada · slot único</b>
    <div class="relicSlot">${equipped?equipped.name:"— slot vacío —"}</div>
    ${owned.map(relic=>`<article class="relicCard ${equipped&&equipped.id===relic.id?"equipped":""}" data-relic-id="${relic.id}">
      <strong>${relic.name}</strong>${equipped&&equipped.id===relic.id?" · Equipada":""}<br>
      <span>${relic.description}</span><br><small>${relic.restriction}</small><br>
      <small class="relicEffectStatus">${relic.effectReady?"Efecto activo al equipar":"Efecto en preparación"}</small>
    </article>`).join("")}
    <div class="relicChangeNote">Un solo efecto a la vez · cambia al inicio del turno.</div>
  </section>`;
}
function renderEmp(){
  const info=$("empInfo"),btns=$("empBtns");btns.innerHTML="";
  if(!player){info.textContent="";return;}
  const f=F[player],own=ownedBy(player),strategicState=currentStrategicRecruitmentState();
  const troopsUsed=getEmpireTroopsUsed(strategicState,player),populationCapacity=getEmpirePopulationCapacity(strategicState,player);
  const available=getEmpireAvailableCapacity(strategicState,player),recruitsUsed=safeStrategicInteger(recruitmentState.byEmpire[player]);
  const growthPlan=getPopulationGrowthPlan({T,F},player);
  let contHtml="";
  for(const cn in CONTINENTS){
    const c=CONTINENTS[cn];
    if(c.ids.every(id=>T[id].owner===player))contHtml+=`<div class="row" style="color:var(--gold)">🌍 ${cn} completo: +${c.bonus}🪙/ronda</div>`;
  }
  const activeHero=f.heroes[0]?ALL_HEROES[f.heroes[0]]:null;
  const councilNames=[f.heroes[1],f.heroes[2]].filter(Boolean).map(id=>ALL_HEROES[id].name).join(", ");
  info.innerHTML=
   `<div class="row"><span><b>${FACTIONS[player].name}</b></span><span>${FACTIONS[player].rel}</span></div>
    <div class="row"><span>Territorios: ${own.length}/21</span>
      <span>${activeHero?("⭐ "+activeHero.name+" (arma nv"+f.heroWeaponLv+")"):"Sin héroe activo"}</span></div>
    ${councilNames?`<div class="row" style="opacity:.75">Consejo: ${councilNames}</div>`:""}
    <div class="row" style="opacity:.75">⚔️ Armamento nv${f.upArm} · 💰 Economía nv${f.upEco} · 🏥 Medicina nv${f.upMed}</div>
    <section class="populationSummary" aria-label="Resumen de población y reclutamiento">
      <b>👥 Población militar: ${troopsUsed}/${populationCapacity}</b>
      <span>Disponible: ${available} · Reclutamiento: ${recruitsUsed}/${STRATEGIC_RECRUITMENT.maxPerEmpireTurn}</span>
      <span>Subsistencia: ${growthPlan.subsistenceCost}🌾 · Crecimiento posible: +${growthPlan.growth}/${growthPlan.maxSlots}</span>
    </section>
    ${coalition&&coalition.leader===player?`<div class="row" style="color:var(--danger)"><b>🌍 Coalición en tu contra: ${coalition.rounds} rondas</b></div>`:""}
    ${contHtml}
    ${renderRelicPanel(player)}
    <div class="row" style="opacity:.7">Victoria: conquista total · 🎭${CULT_WIN} · ✨${FAITH_WIN}</div>`;
  if(phase!=="play")return;
  const relics=getEmpireRelics(currentRelicState(),player),equippedRelic=getEquippedRelic(currentRelicState(),player);
  const relicChangeAllowed=canChangeRelic(currentRelicState(),player);
  for(const relic of relics){
    if(equippedRelic&&equippedRelic.id===relic.id)continue;
    btns.appendChild(mkBtn(`${equippedRelic?"Cambiar a":"Equipar"} ◆ ${relic.name}`,
      ()=>{equipRelic(currentRelicState(),player,relic.id);render();},!relicChangeAllowed,"",true));
  }
  if(equippedRelic)btns.appendChild(mkBtn(`Retirar ◆ ${equippedRelic.name}`,
    ()=>{unequipRelic(currentRelicState(),player);render();},!relicChangeAllowed,"danger",true));
  if(relics.length&&!relicChangeAllowed){
    const note=document.createElement("div");note.className="relicChangeNote";
    note.textContent="Las reliquias solo pueden cambiarse al inicio del turno.";btns.appendChild(note);
  }
  if(f.era<3){
    btns.appendChild(mkBtn(`Avanzar a ${ERAS[f.era+1]} (${ERA_COST[f.era+1]}🔬)`,()=>{
      f.science-=ERA_COST[f.era+1];f.era++;SFX.evolve();
      if(f.era>=1)completeMission("era1");
      log(`¡Entraste en la ${ERAS[f.era]}! Nuevas unidades y especial: ${SPECIALS[f.era]}.`,"win");
      burstScreen([FACTIONS[player].color,"#D9A441"],70);render();},
      f.science<ERA_COST[f.era+1],"gold"));
  }
  const ups=[["upArm","⚔️ Armamento",40,"+15% daño"],["upEco","💰 Economía",35,"+20% oro y +15% oro en batalla"],["upMed","🏥 Medicina",35,"resiste plagas"]];
  for(const[k,n,base,d]of ups){
    if(f[k]>=3)continue;
    const c=base+f[k]*25;
    btns.appendChild(mkBtn(`${n} nv${f[k]+1} (${c}🪙)`,()=>{f.gold-=c;f[k]++;SFX.coin();
      log(`${n} → nivel ${f[k]} (${d}).`);render();},f.gold<c));
  }
  btns.appendChild(mkBtn("⭐ Equipar héroes",()=>{SFX.click();openPanteon("equipar",player);}));
  if(activeHero&&f.heroWeaponLv<3){
    const c=40+f.heroWeaponLv*20;
    btns.appendChild(mkBtn(`Arma del héroe nv${f.heroWeaponLv+1} (${c}🪙)`,()=>{f.gold-=c;f.heroWeaponLv++;
      SFX.evolve();log(`⭐ ${activeHero.name} recibió armamento nivel ${f.heroWeaponLv}.`);render();},f.gold<c,"gold"));
  }
  btns.appendChild(mkBtn("Terminar turno",endHumanTurn));
}
