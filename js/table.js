"use strict";
/* ============================================================
   TABLE DE JEU : courbe de tension
   ============================================================ */

/* ---------- courbe de tension ---------- */
const CURVE_SHAPES=[
  ["Plat",x=>0.5],
  ["Montée",x=>0.1+0.8*x],
  ["Combat",x=>x<0.6?0.2+0.65*(x/0.6):x<0.75?0.85:0.85-(x-0.75)/0.25*0.65],
  ["Vagues",x=>0.5+0.35*Math.sin(2*Math.PI*2*x)],
  ["Descente",x=>0.9-0.8*x]
];
let curveSeen=false;
function setCurveMode(m){
  S.curve.mode=m;
  const e=CTL.find(c=>c.it.k==="curve.mode"); if(e) e.el.value=m;
  if(live) live.eng.setLevels();
}
/* le curseur reprend la main : la courbe s'arrête là où elle en est */
function releaseCurve(){
  if(S.curve.mode==="off") return;
  S.curve.mode="off";
  const e=CTL.find(c=>c.it.k==="curve.mode"); if(e) e.el.value="off";
  curveDraw();
}
function curveEditor(){
  const wrap=document.createElement("div"); wrap.className="curve";
  const cv=document.createElement("canvas"); cv.id="curveCv"; cv.setAttribute("role","img"); cv.setAttribute("aria-label","Courbe de tension dans le temps : à dessiner au doigt ou à la souris");
  wrap.appendChild(cv);
  const tools=document.createElement("div"); tools.className="row curvetools";
  CURVE_SHAPES.forEach(([n,fn])=>{
    const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=n;
    b.onclick=()=>{ const N=S.curve.pts.length; for(let i=0;i<N;i++) S.curve.pts[i]=Math.max(0,Math.min(1,fn(i/(N-1)))); if(S.curve.mode==="off") setCurveMode("loop"); curveDraw(); };
    tools.appendChild(b);
  });
  wrap.appendChild(tools);
  const hint=document.createElement("p"); hint.className="hint"; hint.textContent="Trace la tension au fil du temps : en bas, la salle est calme ; en haut, la percussion monte et les nappes reculent. Le tracé active la courbe. Elle est aussi rendue dans l'export.";
  wrap.appendChild(hint);
  let drawing=false, last=-1;
  const paint=e=>{
    const r=cv.getBoundingClientRect(), N=S.curve.pts.length;
    const i=Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*(N-1)), v=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));
    if(last>=0&&last!==i){ const a=Math.min(last,i), b=Math.max(last,i), va=S.curve.pts[last]; for(let k=a;k<=b;k++){ const f=(k-last)/(i-last); S.curve.pts[k]=va+(v-va)*f; } }
    else S.curve.pts[i]=v;
    last=i; curveDraw();
  };
  cv.addEventListener("pointerdown",e=>{ cv.setPointerCapture(e.pointerId); drawing=true; last=-1; paint(e); });
  cv.addEventListener("pointermove",e=>{ if(drawing) paint(e); });
  const end=()=>{ if(!drawing) return; drawing=false; last=-1; if(S.curve.mode==="off") setCurveMode("loop"); };
  cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
  if("IntersectionObserver" in window) new IntersectionObserver(es=>{ curveSeen=es[0].isIntersecting; if(curveSeen) curveDraw(); }).observe(cv); else curveSeen=true;
  if(window.ResizeObserver) new ResizeObserver(()=>curveDraw()).observe(cv);
  return wrap;
}
function curveDraw(){
  const cv=$("curveCv"); if(!cv) return;
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1), W=Math.round(r.width), H=Math.round(r.height);
  if(!W||!H) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=cv.getContext("2d"), cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
  const ink=v("--ink")||"#3a2e22", ink2=v("--ink-2")||"#6b5a46", rub=v("--rubric")||"#a3301c", gold="oklch(0.62 0.12 78)", rule=v("--rule")||"#b8a888";
  c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
  const p=S.curve.pts, N=p.length, on=S.curve.mode!=="off", X=i=>i/(N-1)*W, Y=val=>(1-val)*(H-12)+6;
  c.strokeStyle=rule; c.lineWidth=1; c.setLineDash([2,4]);
  [0.25,0.5,0.75].forEach(g=>{ const y=Math.round(Y(g))+0.5; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); });
  c.setLineDash([]);
  c.globalAlpha=on?1:0.45;
  c.beginPath(); c.moveTo(0,H); for(let i=0;i<N;i++) c.lineTo(X(i),Y(p[i])); c.lineTo(W,H); c.closePath(); c.fillStyle=rub; c.globalAlpha=on?0.16:0.07; c.fill();
  c.globalAlpha=on?1:0.5; c.strokeStyle=rub; c.lineWidth=2; c.beginPath(); for(let i=0;i<N;i++) i?c.lineTo(X(i),Y(p[i])):c.moveTo(X(i),Y(p[i])); c.stroke(); c.globalAlpha=1;
  c.fillStyle=ink2; c.font='italic 12px "Alegreya", Georgia, serif'; c.textBaseline="alphabetic";
  c.fillText("tendue",6,16); c.fillText("calme",6,H-6);
  const m=Math.max(1,S.curve.dur); c.textAlign="right"; c.fillText(m+" min"+(S.curve.mode==="loop"?", répétée":S.curve.mode==="once"?", une fois":""),W-6,H-6); c.textAlign="left";
  if(!on){ c.textAlign="center"; c.fillStyle=ink2; c.font='italic 15px "Alegreya", Georgia, serif'; c.fillText("Trace une courbe pour l'activer",W/2,H/2); c.textAlign="left"; }
  if(live&&on){
    const pos=live.eng.tensPos();
    if(pos>=0){ const x=Math.round(pos*W)+0.5, val=live.eng.tensNow(); c.strokeStyle=gold; c.lineWidth=1.5; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); c.fillStyle=gold; c.beginPath(); c.arc(x,Y(val),4,0,Math.PI*2); c.fill(); }
  }
}
/* adaptation : une ligne qui dit où en est la musique */
function adaptNote(){ const p=document.createElement("p"); p.className="hint"; p.id="adaptNote"; p.setAttribute("aria-live","off"); return p; }
let adaptShown="", adaptT=0;
function adaptUpdate(){
  const el=$("adaptNote"); if(!el) return;
  const now=Date.now(); if(now-adaptT<1000) return; adaptT=now;
  let txt="";
  if(S.adapt.mode==="heure"){ const d=new Date(), h=d.getHours(), e=live?live.eng.adaptNow():null, part=h<6?"nuit":h<10?"matin":h<14?"midi":h<18?"après-midi":h<22?"soirée":"nuit"; txt="Il est "+d.getHours()+" h "+String(d.getMinutes()).padStart(2,"0")+" ("+part+")"+(e!==null?" : énergie "+Math.round(e*100)+" %, ":", ")+"la musique devient plus calme et plus sombre le soir et la nuit, plus claire et plus dense en journée."; }
  else if(S.adapt.mode==="apaiser"){ const e=live?live.eng.adaptNow():null; txt="La musique s'apaise peu à peu sur "+S.adapt.span+" minutes"+(e!==null?" : énergie "+Math.round(e*100)+" %.":"."); }
  else txt="Désactivée : la musique ne dépend ni de l'heure ni de la durée d'écoute.";
  if(txt!==adaptShown){ adaptShown=txt; el.textContent=txt; }
}
/* appelée à chaque image pendant la lecture : le curseur suit la courbe, le trait avance */
function tableFrame(){
  adaptUpdate();
  if(!live||S.curve.mode==="off") return;
  const val=live.eng.tensNow(), T=CTL.find(c=>c.it.k==="tension");
  if(T&&Math.abs(parseFloat(T.el.value)-val)>0.004){ T.el.value=val; T.upd(); if(T.sync2) T.sync2(); }
  if(curveSeen) curveDraw();
}
