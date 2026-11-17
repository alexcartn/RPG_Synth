"use strict";
/* ============================================================
   MODE JEU : un panneau de boutons, un pad XY, le cercle et le clavier pour jouer par-dessus la machine
   ============================================================ */
const JEU={on:false, frozen:false, amp:1, xy:{x:"dens",y:"brume"}, seen:{}};

/* chaque bouton agit sur un ou deux réglages existants ; replan = voix à replanifier, zero = voix qui s'allume ou s'éteint */
const KNOBS=[
  {id:"vol",label:"Volume",tip:"Volume général de la sortie.",get:()=>S.vol,set:v=>{S.vol=v;},keys:["vol"]},
  {id:"tension",label:"Tension",tip:"Monte : plus de nervosité, de dissonance et de percussion. Descend : tout se détend.",get:()=>S.tension,set:v=>{S.tension=v; releaseCurve();},keys:["tension"],fmt:v=>tensionWord(v)},
  {id:"dens",label:"Densité",tip:"Nombre de notes de la mélodie : peu pour un chant épars, beaucoup pour une danse.",get:()=>S.mel.dens,set:v=>{S.mel.dens=v;},keys:["mel.dens"],replan:"mel"},
  {id:"bourdon",label:"Bourdon",tip:"Le son continu et grave sur la tonique, qui tient toute la pièce.",get:()=>S.drone.lvl,set:v=>{S.drone.lvl=v;},keys:["drone.lvl"]},
  {id:"nappes",label:"Nappes",tip:"Les accords tenus en arrière-plan.",get:()=>S.pad.lvl,set:v=>{S.pad.lvl=v;},keys:["pad.lvl"],zero:"pad"},
  {id:"brume",label:"Brume",tip:"Réverbération : l'espace autour des sons, de la chambre à la cathédrale.",get:()=>S.fx.rev,set:v=>{S.fx.rev=v;},keys:["fx.rev"]},
  {id:"nuage",label:"Nuage",tip:"Nuage de grains : la mélodie hachée en poussières de son qui flottent.",get:()=>(S.grain&&S.grain.mix)||0,set:v=>{S.grain.mix=v;},keys:["grain.mix"]},
  {id:"canon",label:"Canon",tip:"Une seconde voix qui reprend la mélodie en décalé.",get:()=>S.canon.lvl,set:v=>{S.canon.lvl=v;},keys:["canon.lvl"],zero:"mel",noKnob:true},
  {id:"chaleur",label:"Chaleur",tip:"Saturation et léger tremblé, comme une vieille bande magnétique.",get:()=>Math.min(1,S.fx.sat/0.6),set:v=>{S.fx.sat=v*0.6; S.fx.wow=0.04+v*0.36;},keys:["fx.sat","fx.wow"]},
  {id:"echo",label:"Écho",tip:"Répétitions qui s'éteignent.",get:()=>S.fx.dly,set:v=>{S.fx.dly=v;},keys:["fx.dly"],noKnob:true}
];
const KNOB=Object.fromEntries(KNOBS.map(k=>[k.id,k]));
const knobText=(k,v)=>k.fmt?k.fmt(v):Math.round(v*100)+" %";
const clamp01=v=>Math.max(0,Math.min(1,v));

/* un réglage vient de bouger : on met à jour les curseurs des chapitres, puis le moteur */
function refreshKeys(keys){
  keys.forEach(key=>{ const e=CTL.find(c=>c.it.k===key); if(e){ e.el.value=String(getP(key)); e.upd(); if(e.sync2) e.sync2(); } });
}
function applyKnob(spec,v,final){
  const prev=spec.get(); spec.set(clamp01(v)); refreshKeys(spec.keys);
  if(live){
    live.eng.setLevels();
    if(spec.replan) replanSoon(spec.replan,final);
    if(spec.zero&&((prev>0.001)!==(spec.get()>0.001))) replanSoon(spec.zero,true);
  }
}

/* ---------- boutons rotatifs ---------- */
const A0=-135, A1=135;
const pol=(r,a)=>[40+r*Math.sin(a*Math.PI/180), 40-r*Math.cos(a*Math.PI/180)];
function arcPath(r,a0,a1){ const [x0,y0]=pol(r,a0), [x1,y1]=pol(r,a1); return "M"+x0.toFixed(2)+" "+y0.toFixed(2)+" A"+r+" "+r+" 0 "+((a1-a0)>180?1:0)+" 1 "+x1.toFixed(2)+" "+y1.toFixed(2); }
function paintKnob(el,spec){
  const v=clamp01(spec.get()), a=A0+(A1-A0)*v;
  el.querySelector(".val").setAttribute("d",v<0.004?"":arcPath(30,A0,a));
  el.querySelector(".ndl").setAttribute("transform","rotate("+a.toFixed(1)+" 40 40)");
  el.querySelector(".kv").textContent=knobText(spec,v);
  el.setAttribute("aria-valuenow",Math.round(v*100)); el.setAttribute("aria-valuetext",knobText(spec,v));
  JEU.seen[spec.id]=v;
  if(spec.dst&&typeof synRings==="function") synRings(el,spec);
}
const ICK={vol:"volume",dens:"densite"};
function makeKnob(spec){
  const el=document.createElement("div"); el.className="knob"; el.setAttribute("role","slider"); el.tabIndex=0;
  el.setAttribute("aria-label",spec.label); if(spec.tip) el.dataset.tip=spec.tip+" Glisse vers le haut ou le bas, molette ou flèches du clavier."; el.setAttribute("aria-valuemin","0"); el.setAttribute("aria-valuemax","100");
  let ticks=""; for(let i=0;i<=10;i++){ const a=A0+(A1-A0)*i/10, [x0,y0]=pol(34,a), [x1,y1]=pol(i%5===0?39:37,a); ticks+='<line x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+x1.toFixed(1)+'" y2="'+y1.toFixed(1)+'"/>'; }
  el.innerHTML='<svg viewBox="0 0 80 80" aria-hidden="true"><g class="tk">'+ticks+'</g><path class="trk" d="'+arcPath(30,A0,A1)+'"/><path class="val" d=""/><circle class="cap" cx="40" cy="40" r="20"/><line class="ndl" x1="40" y1="40" x2="40" y2="24"/></svg><span class="kl">'+ic(ICK[spec.id]||spec.id)+spec.label+'</span><output class="kv"></output>';
  let dragging=false, y0=0, v0=0, ring=null;
  if(spec.dst) el.dataset.dst=spec.dst;
  el.addEventListener("pointerdown",e=>{ if(spec.dst&&e.target.closest&&e.target.closest(".dr")){ ring=synRingStart(el,spec,e); if(ring){ el.setPointerCapture(e.pointerId); e.preventDefault(); return; } }
    el.setPointerCapture(e.pointerId); dragging=true; y0=e.clientY; v0=spec.get(); el.focus({preventScroll:true}); e.preventDefault(); });
  el.addEventListener("pointermove",e=>{ if(ring){ synRingMove(ring,e); return; } if(!dragging) return; const v=clamp01(v0+(y0-e.clientY)/(e.shiftKey?700:170)); applyKnob(spec,v,false); paintKnob(el,spec); });
  const end=e=>{ if(ring){ ring=null; return; } if(!dragging) return; dragging=false; applyKnob(spec,spec.get(),true); paintKnob(el,spec); };
  if(spec.dst) el.addEventListener("dblclick",e=>{ const h=document.elementFromPoint(e.clientX,e.clientY); if(h&&h.closest&&h.closest(".dr")) synRingRemove(el,spec,{target:h}); });
  el.addEventListener("pointerup",end); el.addEventListener("pointercancel",end);
  el.addEventListener("wheel",e=>{ e.preventDefault(); applyKnob(spec,spec.get()+(e.deltaY<0?0.03:-0.03),true); paintKnob(el,spec); },{passive:false});
  el.addEventListener("keydown",e=>{
    const st={ArrowUp:0.02,ArrowRight:0.02,ArrowDown:-0.02,ArrowLeft:-0.02,PageUp:0.1,PageDown:-0.1}[e.key];
    if(st!==undefined){ applyKnob(spec,spec.get()+st,true); paintKnob(el,spec); e.preventDefault(); }
    else if(e.key==="Home"){ applyKnob(spec,0,true); paintKnob(el,spec); e.preventDefault(); }
    else if(e.key==="End"){ applyKnob(spec,1,true); paintKnob(el,spec); e.preventDefault(); }
  });
  paintKnob(el,spec); el._spec=spec; return el;
}

/* ---------- pad XY ---------- */
function xyDraw(){
  const cv=$("xy"); if(!cv||!JEU.on) return;
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1), W=Math.round(r.width), H=Math.round(r.height); if(!W||!H) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=cv.getContext("2d"), cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
  const rub=v("--rubric")||"#a3301c", ink=v("--ink")||"#3a2e22", ink2=v("--ink-2")||"#6b5a46", rule=v("--rule")||"#b8a888", gold="oklch(0.62 0.12 78)";
  const X=KNOB[JEU.xy.x], Y=KNOB[JEU.xy.y], x=clamp01(X.get())*W, y=(1-clamp01(Y.get()))*H;
  c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
  c.strokeStyle=rule; c.lineWidth=1; c.setLineDash([2,4]);
  [0.25,0.5,0.75].forEach(g=>{ c.beginPath(); c.moveTo(Math.round(g*W)+0.5,0); c.lineTo(Math.round(g*W)+0.5,H); c.moveTo(0,Math.round(g*H)+0.5); c.lineTo(W,Math.round(g*H)+0.5); c.stroke(); });
  c.setLineDash([]); c.strokeStyle=ink2; c.globalAlpha=0.7; c.beginPath(); c.moveTo(Math.round(x)+0.5,0); c.lineTo(Math.round(x)+0.5,H); c.moveTo(0,Math.round(y)+0.5); c.lineTo(W,Math.round(y)+0.5); c.stroke(); c.globalAlpha=1;
  c.fillStyle=rub; c.beginPath(); c.arc(x,y,9,0,Math.PI*2); c.fill(); c.strokeStyle=gold; c.lineWidth=2; c.beginPath(); c.arc(x,y,12.5,0,Math.PI*2); c.stroke();
  c.fillStyle=ink2; c.font='italic 12px "Alegreya", Georgia, serif'; c.textBaseline="alphabetic"; c.textAlign="right"; c.fillText(X.label+" →",W-6,H-6); c.textAlign="left"; c.fillText("↑ "+Y.label,6,15);
}
function xyWire(){
  const cv=$("xy"); let drag=false;
  const set=(e,final)=>{ const r=cv.getBoundingClientRect(); applyKnob(KNOB[JEU.xy.x],(e.clientX-r.left)/r.width,final); applyKnob(KNOB[JEU.xy.y],1-(e.clientY-r.top)/r.height,final); jeuSync(); };
  cv.addEventListener("pointerdown",e=>{ cv.setPointerCapture(e.pointerId); drag=true; set(e,false); e.preventDefault(); });
  cv.addEventListener("pointermove",e=>{ if(drag) set(e,false); });
  const end=e=>{ if(!drag) return; drag=false; set(e,true); };
  cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
  cv.addEventListener("keydown",e=>{ const dx={ArrowRight:0.03,ArrowLeft:-0.03}[e.key]||0, dy={ArrowUp:0.03,ArrowDown:-0.03}[e.key]||0; if(dx||dy){ applyKnob(KNOB[JEU.xy.x],KNOB[JEU.xy.x].get()+dx,true); applyKnob(KNOB[JEU.xy.y],KNOB[JEU.xy.y].get()+dy,true); jeuSync(); e.preventDefault(); } });
  if(window.ResizeObserver) new ResizeObserver(()=>xyDraw()).observe(cv);
}

/* ---------- jouer des notes ---------- */
const KEYROWS=[["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"],["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon"],["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP"]];
function jeuPlayOff(off){
  if(!live){ jeuState(); return; }
  live.eng.play(off,0.22);
}
/* un point du cercle : joue la note si elle est dans la gamme, sinon rien (pour que ça sonne toujours juste) */
function jeuPlayRing(p){
  const iv=ivOf(S,curScaleKey()), deg=p/2;
  if(iv.indexOf(deg)<0) return;
  jeuPlayOff(S.play.oct+deg);
}
function jeuKeys(e){
  if(!(JEU.on||(typeof VEIL!=="undefined"&&VEIL.on))||e.repeat||e.ctrlKey||e.metaKey||e.altKey) return;
  const t=e.target, tg=t&&t.tagName;
  if(tg==="SELECT"||tg==="TEXTAREA"||(tg==="INPUT"&&t.type!=="range"&&t.type!=="checkbox")) return;
  for(let r=0;r<3;r++){
    const i=KEYROWS[r].indexOf(e.code);
    if(i>=0){ e.preventDefault(); const iv=ivOf(S,curScaleKey()); jeuPlayOff(S.play.oct+degOff(iv,i+r*iv.length)); return; }
  }
}

/* ---------- panneau ---------- */
function jeuState(){
  const h=$("jeuHint"); if(!h) return;
  h.textContent=live?"Touches Z, A et Q : trois rangées de la gamme, du grave à l'aigu. Ou touche le cercle. Le canon reprend ce que tu joues.":"Choisis un univers et ce que tu cherches, lance la lecture, puis tourne les boutons. Tous les réglages sont dans Composer.";
  { const g=$("jeuGel"); if(g){ g.disabled=!live; if(!live){ JEU.gel=false; g.setAttribute("aria-pressed","false"); } } }
  const f=$("jeuFreeze"), rr=$("jeuReroll"); if(f) f.disabled=!live; if(rr) rr.disabled=!live; document.querySelectorAll("#jeuGest [data-g]").forEach(b=>{ b.disabled=!live; if(!live) b.setAttribute("aria-pressed","false"); });
  if(!live){ JEU.frozen=false; if(f) f.setAttribute("aria-pressed","false"); }
}
/* ampleur des gestes : discret, plein, immense */
function jeuAmpUI(){ document.querySelectorAll("#jeuAmp .lnk").forEach(b=>{ if(+b.dataset.amp===JEU.amp) b.setAttribute("aria-current","true"); else b.removeAttribute("aria-current"); }); }
function jeuReset(){ JEU.frozen=false; const f=$("jeuFreeze"); if(f) f.setAttribute("aria-pressed","false"); JEU.gel=false; const g=$("jeuGel"); if(g) g.setAttribute("aria-pressed","false"); }
function jeuSync(){
  if(!JEU.on) return;
  document.querySelectorAll("#knobs .knob").forEach(el=>paintKnob(el,el._spec));
  xyDraw();
  { const h=$("jeuMixer"); if(h&&!h.contains(document.activeElement)) dawMixerDraw(); }
}
/* appelée à chaque image : le tableau suit les changements venus d'ailleurs (courbe de tension, scènes) */
function jeuFrame(){
  if(!JEU.on) return;
  let dirty=false;
  document.querySelectorAll("#knobs .knob").forEach(el=>{ const v=clamp01(el._spec.get()); if(Math.abs((JEU.seen[el._spec.id]??-1)-v)>0.003){ paintKnob(el,el._spec); dirty=true; } });
  if(dirty) xyDraw();
  /* le mixeur suit les niveaux venus d'ailleurs (préréglages, scènes) et anime les vumètres */
  if((JEU.n=(JEU.n||0)+1)%3===0){
    const h=$("jeuMixer"); if(h&&!h.contains(document.activeElement)){ const sig=JSON.stringify([MACH.map(m=>m[2]?getP(m[2]):0),S.daw.mix,S.daw.tracks.map(t=>[t.name,t.vol,t.pan,t.mute,t.solo])]); if(sig!==JEU.mixSig){ JEU.mixSig=sig; dawMixerDraw(); } }
    dawMetersTick();
  }
}
function setJeu(on){ setMode(on?"jeu":"reglage"); }
function buildJeu(){
  const kn=$("knobs"); KNOBS.filter(k=>!k.noKnob).forEach(k=>kn.appendChild(makeKnob(k)));
  const opts=KNOBS.map(k=>'<option value="'+k.id+'">'+k.label+'</option>').join("");
  $("xSel").innerHTML=opts; $("ySel").innerHTML=opts; $("xSel").value=JEU.xy.x; $("ySel").value=JEU.xy.y;
  $("xSel").onchange=()=>{ JEU.xy.x=$("xSel").value; xyDraw(); }; $("ySel").onchange=()=>{ JEU.xy.y=$("ySel").value; xyDraw(); };
  xyWire();
  const pc=$("playCtl");
  pc.appendChild(mkCtl({k:"play.inst",type:"select",label:"Instrument de ton jeu",opts:[["","Comme la mélodie"]].concat(INST_OPTS)}));
  pc.appendChild(mkCtl({k:"play.oct",type:"select",label:"Registre",opts:[[12,"Grave"],[24,"Médium"],[36,"Aigu"],[48,"Très aigu"]],num:true}));
  pc.appendChild(mkCtl({k:"play.lvl",type:"range",label:"Niveau de ton jeu",min:0,max:1,step:0.01,fmt:pct}));
  $("jeuBtn").onclick=()=>setMode("jeu");
  $("jeuFreeze").onclick=()=>{ if(!live) return; JEU.frozen=live.eng.freeze(!JEU.frozen); $("jeuFreeze").setAttribute("aria-pressed",JEU.frozen?"true":"false"); syncUI(); };
  $("jeuReroll").onclick=()=>{ if(live) live.eng.reroll(); };
  /* geler le nuage : s'il était absent, on le fait entrer pour que le gel s'entende */
  $("jeuGel").onclick=()=>{
    if(!live) return;
    if(!live.eng.fxOn()){ $("jeuHint").textContent="Le nuage de grains n'est pas disponible dans ce navigateur."; return; }
    const on=!JEU.gel;
    if(on&&S.grain.mix<0.05){ applyKnob(KNOB.nuage,0.5,true); jeuSync(); }
    JEU.gel=live.eng.grainFreeze(on); $("jeuGel").setAttribute("aria-pressed",JEU.gel?"true":"false");
  };
  document.querySelectorAll("#jeuAmp .lnk").forEach(b=>{ b.onclick=()=>{ JEU.amp=+b.dataset.amp; jeuAmpUI(); }; }); jeuAmpUI();
  document.querySelectorAll("#jeuGest [data-g]").forEach(b=>{ b.onclick=()=>{ if(!live) return; const d=live.eng.gesture(b.dataset.g,JEU.amp); if(d>0){ b.setAttribute("aria-pressed","true"); clearTimeout(b._t); b._t=setTimeout(()=>b.setAttribute("aria-pressed","false"),d*1000); } }; });
  document.addEventListener("keydown",jeuKeys);
  JEU.mixSig=""; jeuState();
}
