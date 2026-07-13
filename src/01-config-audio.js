/* ==================== 01-config-audio.js ====================
   Ajustes globales (SET), audio procedural y música procedural. */
"use strict";
/* ==================== AJUSTES GLOBALES ==================== */
const SET={sound:true,music:true,vol:0.6,speed:1,fx:true};
const reduced=(typeof matchMedia==="function")?matchMedia("(prefers-reduced-motion: reduce)").matches:false;
if(reduced)SET.fx=false;

/* ==================== AUDIO PROCEDURAL ==================== */
let AC=null,master=null;
function audioInit(){
  if(AC)return;
  try{AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain();master.gain.value=SET.vol;master.connect(AC.destination);}catch(e){}
}
document.addEventListener("pointerdown",()=>{audioInit();if(AC&&AC.state==="suspended")AC.resume();},{once:false});
function tone(freq,dur,type="sine",vol=0.5,slideTo=null){
  if(!SET.sound||!AC)return;
  const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq*(0.95+Math.random()*0.1),t);
  if(slideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.02);
}
function noiseBurst(dur=0.4,vol=0.5){
  if(!SET.sound||!AC)return;
  const n=AC.sampleRate*dur,buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const s=AC.createBufferSource();s.buffer=buf;
  const f=AC.createBiquadFilter();f.type="lowpass";
  f.frequency.setValueAtTime(2200,AC.currentTime);
  f.frequency.exponentialRampToValueAtTime(120,AC.currentTime+dur);
  const g=AC.createGain();g.gain.value=vol;
  s.connect(f);f.connect(g);g.connect(master);s.start();
}
const SFX={
  click:()=>tone(600,0.05,"sine",0.25),
  coin:()=>{tone(660,0.05,"sine",0.3);setTimeout(()=>tone(880,0.06,"sine",0.3),50);},
  spawn:()=>tone(440,0.1,"sine",0.3,880),
  hit:()=>tone(200,0.08,"sawtooth",0.18,50),
  die:()=>tone(160,0.15,"square",0.15,40),
  boom:()=>{noiseBurst(0.5,0.5);tone(120,0.35,"sine",0.5,45);},
  evolve:()=>[660,880,990,1320].forEach((f,i)=>setTimeout(()=>tone(f,0.07,"sine",0.3),i*60)),
  win:()=>[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.14,"sine",0.35),i*110)),
  lose:()=>[400,320,240,180].forEach((f,i)=>setTimeout(()=>tone(f,0.16,"sawtooth",0.22),i*130))
};

/* ==================== MÚSICA PROCEDURAL ==================== */
const PENTA=[0,3,5,7,10,12]; // pentatónica menor
let musStep=0,musTimer=null;
function musicTick(){
  if(!SET.sound||!SET.music||!AC||AC.state!=="running")return;
  const battle=inBattle;
  const root=battle?164.8:220; // Mi grave en batalla, La en mapa
  const vol=battle?0.10:0.085;
  const deg=PENTA[Math.floor(Math.random()*PENTA.length)];
  const freq=root*Math.pow(2,deg/12);
  tone(freq,battle?0.16:0.32,"triangle",vol);
  if(musStep%4===0)tone(root/2,battle?0.28:0.5,"sine",vol*1.5);           // bajo
  if(battle&&musStep%2===0)noiseBurst(0.05,0.05);                          // percusión
  if(!battle&&musStep%8===4)tone(freq*1.5,0.4,"sine",vol*0.6);            // armonía suave
  musStep++;
  clearTimeout(musTimer);
  musTimer=setTimeout(musicTick,battle?260:430);
}
document.addEventListener("pointerdown",()=>{if(!musTimer)musicTick();},{once:true});
