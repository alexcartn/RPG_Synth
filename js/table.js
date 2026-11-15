"use strict";
/* ============================================================
   TABLE DE JEU : sons à la demande, campagne de scènes, courbe de tension
   ============================================================ */

/* ---------- sons à la demande ---------- */
const EVTS=[["porte","Porte"],["cloche","Cloche"],["tonnerre","Tonnerre"],["cor","Cor"],["coups","Coups"],["verre","Verre"],["magie","Magie"],["loup","Loup"]];
function fireEvent(name){
  if(!live) return;
  live.eng.fire(name);
  const b=document.querySelector('[data-evt="'+name+'"]');
  if(b){ b.classList.add("hit"); setTimeout(()=>b.classList.remove("hit"),450); }
}
function evtState(){ document.querySelectorAll("#evBtns button").forEach(b=>{ b.disabled=!live; }); const n=$("evNote"); if(n) n.hidden=!!live; }

function buildTable(){
  const host=$("evBtns");
  EVTS.forEach(([k,n],i)=>{
    const b=document.createElement("button"); b.type="button"; b.className="evb"; b.dataset.evt=k;
    b.innerHTML='<kbd>'+(i+1)+'</kbd>'+n; b.onclick=()=>fireEvent(k); host.appendChild(b);
  });
  evtState();
  /* touches 1 à 8 : sons ; N : étape suivante de la campagne */
  document.addEventListener("keydown",e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||document.body.classList.contains("atelier")) return;
    const t=e.target, tg=t&&t.tagName;
    if(tg==="SELECT"||tg==="TEXTAREA"||(tg==="INPUT"&&t.type!=="range"&&t.type!=="checkbox")) return;
    const n=parseInt(e.key,10);
    if(n>=1&&n<=EVTS.length){ fireEvent(EVTS[n-1][0]); e.preventDefault(); }
    else if((e.key==="n"||e.key==="N")&&!(typeof JEU!=="undefined"&&JEU.on)){ campNext(); }
  });
  $("nextStep").onclick=$("nextStep2").onclick=()=>campNext();
}

/* ---------- campagne : une suite de scènes ---------- */
const CAMP_KEY="bourdon.campagne";
const camp={steps:[], loop:true, idx:-1, t0:0, timer:null, running:false};
const CAMP_DURS=[[0,"jusqu'à « suivant »"],[2,"2 min"],[5,"5 min"],[10,"10 min"],[15,"15 min"],[20,"20 min"],[30,"30 min"],[45,"45 min"],[60,"1 heure"]];
const CAMP_FADES=[[0.5,"sec"],[4,"court"],[10,"moyen"],[25,"long"]];

function campLoad(){
  try{ const j=JSON.parse(localStorage.getItem(CAMP_KEY)); if(j&&Array.isArray(j.steps)){ camp.steps=j.steps; camp.loop=j.loop!==false; return; } }catch(e){}
  camp.steps=[{src:"p0",dur:15,fade:10},{src:"p2",dur:10,fade:10},{src:"p4",dur:0,fade:10}];
}
function campSave(){ try{ localStorage.setItem(CAMP_KEY,JSON.stringify({steps:camp.steps,loop:camp.loop})); }catch(e){} }
function srcList(){ const l=PRESETS.map(([n],i)=>["p"+i,n]); getScenes().forEach(sc=>l.push(["s"+sc.n,sc.name])); return l; }
function srcState(id){
  if(id[0]==="p"){ const p=PRESETS[parseInt(id.slice(1),10)]; return p?p[1]:null; }
  const sc=getScenes().find(x=>"s"+x.n===id); return sc?sc.state:null;
}
const srcName=id=>{ const f=srcList().find(x=>x[0]===id); return f?f[1]:"scène effacée"; };

function campApply(i){
  camp.idx=i; camp.t0=Date.now();
  const st=camp.steps[i], state=srcState(st.src);
  if(!state){ campNext(); return; }
  if(live) loadScene(state,null,st.fade);
  else{ S=merge(clone(DEFAULT),clone(state)); syncUI(); startLive(); }
  campMark();
}
function campStart(){
  if(!camp.steps.length) return;
  camp.running=true; campApply(0); clearInterval(camp.timer); camp.timer=setInterval(campTick,1000); campUI();
}
function campStop(){ clearInterval(camp.timer); camp.running=false; camp.idx=-1; campUI(); }
function campNext(){
  if(!camp.running) return;
  let i=camp.idx+1;
  if(i>=camp.steps.length){ if(camp.loop) i=0; else{ campStop(); return; } }
  campApply(i);
}
function campTick(){
  if(!camp.running) return;
  const st=camp.steps[camp.idx];
  if(st&&st.dur>0&&(Date.now()-camp.t0)/1000>=st.dur*60) campNext();
  campStatus();
}
function campStatus(){
  const el=$("campStatus"); if(!el) return;
  if(!camp.running){ el.textContent=camp.steps.length?"La campagne n'est pas lancée.":"Ajoute au moins une étape."; return; }
  const st=camp.steps[camp.idx]; if(!st) return;
  let rest="jusqu'à « suivant »";
  if(st.dur>0){ const r=Math.max(0,Math.round(st.dur*60-(Date.now()-camp.t0)/1000)); rest="encore "+Math.floor(r/60)+":"+String(r%60).padStart(2,"0"); }
  el.textContent="Étape "+(camp.idx+1)+" sur "+camp.steps.length+" : "+srcName(st.src)+", "+rest+".";
}
function campMark(){ document.querySelectorAll("#campRows .step").forEach((r,i)=>{ if(i===camp.idx&&camp.running) r.setAttribute("aria-current","true"); else r.removeAttribute("aria-current"); }); campStatus(); }
function campUI(){
  const go=$("campGo"); if(go) go.textContent=camp.running?"Arrêter la campagne":"Lancer la campagne";
  ["campNext","nextStep","nextStep2"].forEach(id=>{ const b=$(id); if(b) b.hidden=!camp.running; });
  campMark();
}
function campRows(){
  const host=$("campRows"); host.innerHTML="";
  const sel=(opts,val,fn,label)=>{ const s=document.createElement("select"); s.setAttribute("aria-label",label); opts.forEach(([v,n])=>{ const o=document.createElement("option"); o.value=v; o.textContent=n; s.appendChild(o); }); s.value=String(val); s.onchange=()=>fn(s.value); return s; };
  camp.steps.forEach((st,i)=>{
    const row=document.createElement("div"); row.className="step";
    const n=document.createElement("span"); n.className="n"; n.textContent=i+1; row.appendChild(n);
    const opts=srcList(); if(!opts.find(x=>x[0]===st.src)) opts.push([st.src,"scène effacée"]);
    row.appendChild(sel(opts,st.src,v=>{ st.src=v; campSave(); campStatus(); },"Scène de l'étape "+(i+1)));
    row.appendChild(sel(CAMP_DURS,st.dur,v=>{ st.dur=parseFloat(v); campSave(); },"Durée de l'étape "+(i+1)));
    row.appendChild(sel(CAMP_FADES,st.fade,v=>{ st.fade=parseFloat(v); campSave(); },"Fondu vers l'étape "+(i+1)));
    const tools=document.createElement("span"); tools.className="tools";
    const btn=(txt,lab,fn,dis)=>{ const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=txt; b.setAttribute("aria-label",lab); b.disabled=!!dis; b.onclick=fn; tools.appendChild(b); };
    btn("↑","Monter l'étape "+(i+1),()=>{ [camp.steps[i-1],camp.steps[i]]=[camp.steps[i],camp.steps[i-1]]; if(camp.idx===i) camp.idx--; else if(camp.idx===i-1) camp.idx++; campSave(); campRows(); campMark(); },i===0);
    btn("↓","Descendre l'étape "+(i+1),()=>{ [camp.steps[i+1],camp.steps[i]]=[camp.steps[i],camp.steps[i+1]]; if(camp.idx===i) camp.idx++; else if(camp.idx===i+1) camp.idx--; campSave(); campRows(); campMark(); },i===camp.steps.length-1);
    btn("×","Retirer l'étape "+(i+1),()=>{ camp.steps.splice(i,1); if(camp.idx>i) camp.idx--; else if(camp.idx===i&&camp.running){ if(!camp.steps.length) campStop(); else camp.idx--; } campSave(); campRows(); campMark(); });
    row.appendChild(tools); host.appendChild(row);
  });
  if(!camp.steps.length){ const p=document.createElement("p"); p.className="hint"; p.textContent="Aucune étape. Ajoute des préréglages ou des scènes mémorisées."; host.appendChild(p); }
}
function buildCampaign(host){
  campLoad();
  const sec=document.createElement("section"); sec.className="chap"; sec.id="ch-IX";
  sec.innerHTML=
    '<header><span class="num">IX</span><div><h2>Itinerarium</h2><p class="sub"><span class="fr">Campagne</span> Une suite de scènes qui s\'enchaînent d\'elles-mêmes, ou à ton signal : touche N, ou le bouton « Suivant ».</p></div></header>'+
    '<div id="campRows" class="steps"></div>'+
    '<div class="row" style="margin-top:16px"><button class="lnk" id="campAdd" type="button">Ajouter une étape</button>'+
    '<label class="chk"><span><input type="checkbox" id="campLoop">Recommencer à la fin</span></label></div>'+
    '<div class="row" style="margin-top:24px"><button class="btn main" id="campGo" type="button">Lancer la campagne</button><button class="btn" id="campNext" type="button" hidden>Étape suivante</button></div>'+
    '<p class="status" id="campStatus" role="status" aria-live="polite"></p>';
  host.appendChild(sec);
  $("campLoop").checked=camp.loop;
  $("campLoop").onchange=()=>{ camp.loop=$("campLoop").checked; campSave(); };
  $("campAdd").onclick=()=>{ camp.steps.push({src:"p0",dur:10,fade:10}); campSave(); campRows(); };
  $("campGo").onclick=()=>{ camp.running?campStop():campStart(); };
  $("campNext").onclick=()=>campNext();
  campRows(); campUI();
}
/* les scènes mémorisées peuvent changer : les menus de la campagne suivent */
function campRefresh(){ if($("campRows")){ campRows(); campMark(); } }

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
