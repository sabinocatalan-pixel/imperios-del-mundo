/* ==================== 05-mapa.js ====================
   Mapa SVG: construcción, zoom/paneo, flechas y destellos. */
/* ==================== MAPA SVG ==================== */
const svg=$("map");
function shade(hex,f){ // aclara (f>0) u oscurece (f<0) un color hex
  const n=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,(n>>16)+f)),g=Math.max(0,Math.min(255,((n>>8)&255)+f)),b=Math.max(0,Math.min(255,(n&255)+f));
  return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
}
function buildMap(){
  let h="<defs>";
  for(const fid in FACTIONS){
    const c=FACTIONS[fid].color;
    h+=`<linearGradient id="grad_${fid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(c,34)}"/>
      <stop offset="0.55" stop-color="${c}"/>
      <stop offset="1" stop-color="${shade(c,-30)}"/></linearGradient>`;
  }
  h+=`<filter id="fshadow" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/></filter></defs>`;
  // decoración del océano: paralelos y olas
  for(let y=90;y<520;y+=110)
    h+=`<path d="M0,${y} Q250,${y-14} 500,${y} T1000,${y}" fill="none" stroke="#1B3947" stroke-width="1" opacity=".5"/>`;
  for(const[wx,wy]of[[120,300],[420,470],[640,420],[880,250],[80,470],[930,480],[380,60]])
    h+=`<path d="M${wx},${wy} q7,-6 14,0 q7,6 14,0" fill="none" stroke="#2E5666" stroke-width="1.6" opacity=".7"/>`;
  for(const[a,b]of SEAROUTES){
    const[c1,c2]=[TERR[a].c,TERR[b].c];
    h+=`<path d="M${c1[0]},${c1[1]} Q${(c1[0]+c2[0])/2},${(c1[1]+c2[1])/2-30} ${c2[0]},${c2[1]}"
      fill="none" stroke="#2A4A57" stroke-width="1.5" stroke-dasharray="4 6" opacity=".65"/>`;
  }
  for(const id in TERR)h+=`<polygon class="terr" id="p${id}" data-id="${id}" points="${TERR[id].p}" filter="url(#fshadow)"/>`;
  for(const id in TERR){
    const t=TERR[id];
    h+=`<text class="tlabel" x="${t.c[0]}" y="${t.c[1]-6}">${t.n}</text>
        <text class="ttroop" id="tt${id}" x="${t.c[0]}" y="${t.c[1]+9}"></text>`;
  }
  svg.innerHTML=h;
  document.querySelectorAll(".terr").forEach(p=>p.addEventListener("click",()=>{
    if(mapDragged)return; // no seleccionar si fue un arrastre
    clickTerr(p.dataset.id);
  }));
}

/* ==================== ZOOM Y PANEO DEL MAPA ==================== */
let vb={x:0,y:0,w:1000,h:520},mapDragged=false;
function applyVB(){svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);}
function zoomMap(f,cx=null,cy=null){ // f>1 acerca
  const nw=Math.max(280,Math.min(1000,vb.w/f));
  const nh=nw*0.52;
  const px=cx===null?vb.x+vb.w/2:cx, py=cy===null?vb.y+vb.h/2:cy;
  vb.x=px-(px-vb.x)*(nw/vb.w);
  vb.y=py-(py-vb.y)*(nh/vb.h);
  vb.w=nw;vb.h=nh;clampVB();applyVB();
}
function clampVB(){
  vb.x=Math.max(-60,Math.min(1060-vb.w,vb.x));
  vb.y=Math.max(-40,Math.min(560-vb.h,vb.y));
}
$("zIn").onclick=()=>{SFX.click();zoomMap(1.35);};
$("zOut").onclick=()=>{SFX.click();zoomMap(1/1.35);};
$("zReset").onclick=()=>{SFX.click();vb={x:0,y:0,w:1000,h:520};applyVB();};
(function mapGestures(){
  const ptrs=new Map();let lastDist=0,lastMid=null,moved=0;
  function svgPt(e){const r=svg.getBoundingClientRect();
    return{x:vb.x+(e.clientX-r.left)/r.width*vb.w, y:vb.y+(e.clientY-r.top)/r.height*vb.h};}
  svg.addEventListener("pointerdown",e=>{
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;mapDragged=false;
    if(ptrs.size===2){const a=[...ptrs.values()];
      lastDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
  });
  svg.addEventListener("pointermove",e=>{
    if(!ptrs.has(e.pointerId))return;
    const prev=ptrs.get(e.pointerId);
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1){
      const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
      moved+=Math.abs(dx)+Math.abs(dy);
      if(moved>10){mapDragged=true;
        const r=svg.getBoundingClientRect();
        vb.x-=dx/r.width*vb.w;vb.y-=dy/r.height*vb.h;clampVB();applyVB();}
    }else if(ptrs.size===2){
      const a=[...ptrs.values()];
      const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(lastDist>0){mapDragged=true;
        const mid=svgPt({clientX:(a[0].x+a[1].x)/2,clientY:(a[0].y+a[1].y)/2});
        zoomMap(d/lastDist,mid.x,mid.y);}
      lastDist=d;
    }
    e.preventDefault();
  },{passive:false});
  const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)lastDist=0;
    setTimeout(()=>{mapDragged=false;},60);};
  svg.addEventListener("pointerup",up);svg.addEventListener("pointercancel",up);
  svg.style.touchAction="none";
})();

/* ==================== FLECHA DE ATAQUE ==================== */
function arrowFX(from,to){
  if(!SET.fx)return;
  const[a,b]=[TERR[from].c,TERR[to].c];
  const ln=document.createElementNS("http://www.w3.org/2000/svg","path");
  ln.setAttribute("d",`M${a[0]},${a[1]} Q${(a[0]+b[0])/2},${(a[1]+b[1])/2-26} ${b[0]},${b[1]}`);
  ln.setAttribute("fill","none");ln.setAttribute("stroke","#FF5540");
  ln.setAttribute("stroke-width","3.5");ln.setAttribute("stroke-linecap","round");
  ln.classList.add("conqFlash");ln.style.opacity="0.95";
  svg.appendChild(ln);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ln.style.opacity="0";}));
  setTimeout(()=>ln.remove(),900);
}

/* ==================== DESTELLO DE CONQUISTA ==================== */
function flashTerr(id){
  if(!SET.fx)return;
  const src=$("p"+id);if(!src)return;
  const c=src.cloneNode(false);
  c.removeAttribute("id");c.classList.remove("sel","target");
  c.classList.add("conqFlash");
  c.setAttribute("fill","#FFFFFF");c.style.opacity="0.95";
  svg.appendChild(c);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.opacity="0";}));
  setTimeout(()=>c.remove(),900);
}
