/* ==================== 11-modales.js ====================
   Confeti, modales de ajustes/misiones/diplomacia y sus listeners. */
/* ==================== CONFETI ==================== */
const cfc=$("confetti"),cfx=cfc.getContext("2d");let parts=[];
function sizeCf(){cfc.width=innerWidth;cfc.height=innerHeight;}
addEventListener("resize",sizeCf);sizeCf();
function burst(x,y,colors,n=80,sp=9){if(!SET.fx)n=Math.min(20,n);
  for(let i=0;i<n;i++)parts.push({x,y,vx:(Math.random()-.5)*sp*2,vy:-Math.random()*sp-3,g:.25,
    s:4+Math.random()*5,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.3,
    c:colors[Math.floor(Math.random()*colors.length)],life:90+Math.random()*50});}
function burstScreen(colors,n=80){burst(innerWidth/2,innerHeight*0.35,colors,n,11);}
function rainAll(){const cs=Object.values(FACTIONS).map(f=>f.color);
  for(let k=0;k<3;k++)setTimeout(()=>{for(let i=0;i<(SET.fx?200:60);i++)parts.push({
    x:Math.random()*cfc.width,y:-20-Math.random()*300,vx:(Math.random()-.5)*2,vy:2+Math.random()*3,
    g:.03,s:5+Math.random()*6,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.25,
    c:cs[Math.floor(Math.random()*cs.length)],life:260});},k*700);}
(function cfloop(){cfx.clearRect(0,0,cfc.width,cfc.height);
  parts=parts.filter(p=>p.life>0&&p.y<cfc.height+30);
  for(const p of parts){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.life--;
    cfx.save();cfx.translate(p.x,p.y);cfx.rotate(p.r);
    cfx.globalAlpha=Math.min(1,p.life/40);cfx.fillStyle=p.c;
    cfx.fillRect(-p.s/2,-p.s/3,p.s,p.s*0.66);cfx.restore();}
  requestAnimationFrame(cfloop);})();

/* ==================== MODALES / AJUSTES ==================== */
function closeModals(){document.querySelectorAll(".modal").forEach(m=>m.style.display="none");}
$("btnSettings").onclick=()=>{SFX.click();$("setModal").style.display="flex";};
$("btnMissions").onclick=()=>{SFX.click();
  $("misList").innerHTML=missions.map(m=>
    `<div class="mission ${m.done?"done":""}">${m.done?"✅":"⬜"} ${m.t} <b>+${m.r}🪙</b></div>`).join("");
  $("misModal").style.display="flex";};
$("setSnd").onclick=e=>{SET.sound=!SET.sound;e.target.textContent=SET.sound?"Activado":"Silencio";SFX.click();};
$("setMus").onclick=e=>{SET.music=!SET.music;e.target.textContent=SET.music?"Activada":"Apagada";
  if(SET.music){clearTimeout(musTimer);musicTick();}SFX.click();};
$("btnGenLeg").onclick=()=>{$("legCode").value=legacyCode();SFX.click();};
$("btnLoadLeg").onclick=()=>{if($("legCode").value&&loadLegacy($("legCode").value)){
  renderScenList();SFX.coin();alert("Legado cargado: "+LEGACY.wins+" victorias.");}};
$("ovCopy").onclick=()=>{const t=$("ovLeg");t.select();
  try{navigator.clipboard.writeText(t.value);}catch(e){document.execCommand("copy");}SFX.coin();};
$("setVol").oninput=e=>{SET.vol=e.target.value/100;if(master)master.gain.value=SET.vol;};
$("setSpd").onclick=e=>{SET.speed=SET.speed===1?2:1;e.target.textContent="×"+SET.speed;SFX.click();};
$("setFx").onclick=e=>{SET.fx=!SET.fx;e.target.textContent=SET.fx?"Completos":"Reducidos";SFX.click();};
$("btnGenSave").onclick=()=>{$("saveCode").value=saveGame()||"(inicia una partida primero)";SFX.click();};
$("btnCopySave").onclick=()=>{const t=$("saveCode");t.select();
  try{navigator.clipboard.writeText(t.value);}catch(e){document.execCommand("copy");}SFX.coin();};
$("btnLoad").onclick=()=>{if($("loadCode").value)loadGame($("loadCode").value);};

function setPickMode(m){pickMode=m;SFX.click();
  $("mode1").className="act"+(m===1?" gold":"");
  $("mode2").className="act"+(m===2?" gold":"");}

