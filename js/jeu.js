"use strict";
/* ============================================================
   MODE JEU : un panneau de boutons, le cercle et le clavier pour jouer par-dessus la machine
   ============================================================ */
const JEU={on:false, frozen:false, amp:1, seen:{}};

/* chaque bouton agit sur un ou deux réglages existants ; replan = voix à replanifier, zero = voix qui s'allume ou s'éteint */
const DRIFTS=()=>Array.isArray(S.drift)?S.drift:[];
const KNOBS=[
  {id:"vol",label:"Volume",tip:"Volume général de la sortie.",get:()=>S.vol,set:v=>{S.vol=v;},keys:["vol"]},
  /* les six boutons de l'écoute planante */
  {id:"prof",label:"Profondeur",tip:"L'espace autour des sons : de la chambre proche à la cathédrale, au gouffre.",get:()=>S.fx.rev,set:v=>{S.fx.rev=v;},keys:["fx.rev"]},
  {id:"lum",label:"Lumière",tip:"De l'ombre à la clarté : les aigus s'ouvrent, la salle devient plus brillante. À gauche, tout est voilé et sourd.",get:()=>1-S.fx.veil,set:v=>{S.fx.veil=+(1-v).toFixed(3); S.fx.dark=+Math.min(1,1.1-v).toFixed(3);},keys:["fx.veil","fx.dark"],fmt:v=>v<0.25?"nuit":v<0.5?"pénombre":v<0.75?"jour voilé":"clarté"},
  {id:"mouv",label:"Mouvement",tip:"La vitesse et l'ampleur des lentes dérives : le filtre, l'espace, la densité et le stéréo qui se promènent tout seuls. À zéro, tout reste immobile.",get:()=>{ const d=DRIFTS(); return d.length?Math.min(1,d.reduce((a,w)=>a+(w.d||0),0)/d.length/0.7):0; },set:v=>{ DRIFTS().forEach(w=>{ w.d=+(v*0.7).toFixed(3); w.v=+(0.05+v*0.6).toFixed(3); }); },keys:[],fmt:v=>v<0.1?"immobile":v<0.4?"lent":v<0.7?"vivant":"houleux"},
  {id:"dens",label:"Densité",tip:"Nombre de notes : de rares notes qui passent comme des souvenirs à un chant continu.",get:()=>S.mel.dens,set:v=>{S.mel.dens=v;},keys:["mel.dens"],replan:"mel"},
  {id:"tex",label:"Texture",tip:"Des notes vers le souffle : le nuage de grains, la pierre qui chante et l'air prennent le dessus sur les notes.",get:()=>Math.min(1,((S.grain&&S.grain.mix)||0)/0.7),set:v=>{ S.grain.mix=+(v*0.7).toFixed(3); S.tex=Object.assign({lvl:1,sub:0,mid:0,air:0},S.tex||{}); S.tex.mid=+(v*0.6).toFixed(3); S.tex.air=+(v*0.5).toFixed(3); },keys:["grain.mix","tex.mid","tex.air"]},
  {id:"lieu",label:"Lieu",tip:"Les sons du lieu : vent, pluie, feu, nuit, bêtes. Toujours en fond.",get:()=>Math.min(1,S.amb.lvl===undefined?1:S.amb.lvl),set:v=>{S.amb.lvl=v;},keys:["amb.lvl"]},
  /* disponibles dans Composer */
  {id:"tension",label:"Tension",tip:"Monte : plus de nervosité et de dissonance. Descend : tout se détend.",get:()=>S.tension,set:v=>{S.tension=v; releaseCurve();},keys:["tension"],fmt:v=>tensionWord(v),noKnob:true},
  {id:"bourdon",label:"Bourdon",tip:"Le son continu et grave sur la tonique.",get:()=>S.drone.lvl,set:v=>{S.drone.lvl=v;},keys:["drone.lvl"],noKnob:true},
  {id:"nappes",label:"Nappes",tip:"Les accords tenus en arrière-plan.",get:()=>S.pad.lvl,set:v=>{S.pad.lvl=v;},keys:["pad.lvl"],zero:"pad",noKnob:true},
  {id:"chaleur",label:"Chaleur",tip:"Saturation et léger tremblé, comme une vieille bande magnétique.",get:()=>Math.min(1,S.fx.sat/0.6),set:v=>{S.fx.sat=v*0.6; S.fx.wow=0.04+v*0.36;},keys:["fx.sat","fx.wow"],noKnob:true},
  {id:"canon",label:"Canon",tip:"Une seconde voix qui reprend la mélodie en décalé.",get:()=>S.canon.lvl,set:v=>{S.canon.lvl=v;},keys:["canon.lvl"],zero:"mel",noKnob:true},
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
const ICK={vol:"volume",dens:"densite",prof:"brume",lum:"revelation",mouv:"phrase",tex:"nuage",lieu:"nature"};
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
  { const h=$("jeuMixer"); if(h&&!h.contains(document.activeElement)) dawMixerDraw(); }
}
/* appelée à chaque image : le tableau suit les changements venus d'ailleurs (courbe de tension, scènes) */
function jeuFrame(){
  if(!JEU.on) return;
  let dirty=false;
  document.querySelectorAll("#knobs .knob").forEach(el=>{ const v=clamp01(el._spec.get()); if(Math.abs((JEU.seen[el._spec.id]??-1)-v)>0.003){ paintKnob(el,el._spec); dirty=true; } });
  /* le mixeur suit les niveaux venus d'ailleurs (préréglages, scènes) et anime les vumètres */
  if((JEU.n=(JEU.n||0)+1)%3===0){
    const h=$("jeuMixer"); if(h&&!h.contains(document.activeElement)){ const sig=JSON.stringify([MACH.map(m=>m[2]?getP(m[2]):0),S.daw.mix,S.daw.tracks.map(t=>[t.name,t.vol,t.pan,t.mute,t.solo])]); if(sig!==JEU.mixSig){ JEU.mixSig=sig; dawMixerDraw(); } }
    dawMetersTick();
  }
}
/* varier : une variante proche de l'ambiance en cours, comme on lance des dés autour d'un préréglage ; « Revenir » défait la dernière */
const VARY={stack:[]};
const FAMI=[["luth","oud","harpe","lyre","guitare","kalimba"],["flute","ney","syrinx","sifflet"],["archet","voix","chant","cuivre","aulos","harmonica","cornu"],["carillon","verre","bol","fmcloche"],["piano","fmpiano","orgue","roues","hydraulis"]];
const FAMP=[["cordes","machine","choeur","vecteur"],["orgue","roues"],["verre","synthe","essaim","phase"]];
function varyScene(){
  const rnd=Math.random, pick=a=>a[Math.floor(rnd()*a.length)], cl=(v,a,b)=>Math.max(a,Math.min(b,v)), sib=(fams,x)=>{ const f=fams.find(F=>F.indexOf(x)>=0); return f?pick(f):x; };
  VARY.stack.push({s:clone(S),sc:Object.assign({},SCENE)}); if(VARY.stack.length>12) VARY.stack.shift();
  const N=clone(S);
  N.root=((N.root+pick([0,0,2,-2,5,7]))%12+12)%12;
  if(N.scales[1]&&rnd()<0.4) N.scales=[N.scales[1],N.scales[0],N.scales[2]||""];
  N.tempo=Math.round(cl(N.tempo*(0.9+0.2*rnd()),40,180));
  if(rnd()<0.5) N.mel.inst=sib(FAMI,N.mel.inst);
  if(N.canon.lvl>0.01&&rnd()<0.4) N.canon.inst=sib(FAMI,N.canon.inst);
  if(rnd()<0.4) N.pad.timbre=sib(FAMP,N.pad.timbre);
  N.mel.dens=Math.round(cl(N.mel.dens+(rnd()-0.5)*0.3,0.05,1)*100)/100; N.mel.leap=Math.round(cl(N.mel.leap+(rnd()-0.5)*0.2,0,1)*100)/100;
  N.rc=Math.round(cl((N.rc===undefined?0.5:N.rc)+(rnd()-0.5)*0.3,0,1)*100)/100;
  if(N.arp&&N.arp.lvl>0.01&&rnd()<0.4) N.arp.pat=pick(["vaetvient","montant","alberti","turing"]);
  N.perc.shaker=Math.round(cl(N.perc.shaker+(rnd()-0.5)*0.3,0,1)*100)/100;
  loadScene(N,null,undefined,{name:(SCENE.name||"Ambiance").replace(/ \(variante\)$/,"")+" (variante)",gloss:SCENE.gloss,univ:SCENE.univ});
  $("jeuBack").disabled=false;
}
function varyBack(){ const p=VARY.stack.pop(); if(!p) return; loadScene(p.s,null,undefined,p.sc); $("jeuBack").disabled=!VARY.stack.length; }
function setJeu(on){ setMode(on?"jeu":"reglage"); }
function buildJeu(){
  const kn=$("knobs"); KNOBS.filter(k=>!k.noKnob).forEach(k=>kn.appendChild(makeKnob(k)));
  const pc=$("playCtl");
  pc.appendChild(mkCtl({k:"play.inst",type:"select",label:"Instrument de ton jeu",opts:[["","Comme la mélodie"]].concat(INST_OPTS)}));
  pc.appendChild(mkCtl({k:"play.oct",type:"select",label:"Registre",opts:[[12,"Grave"],[24,"Médium"],[36,"Aigu"],[48,"Très aigu"]],num:true}));
  pc.appendChild(mkCtl({k:"play.lvl",type:"range",label:"Niveau de ton jeu",min:0,max:1,step:0.01,fmt:pct}));
  $("jeuBtn").onclick=()=>setMode("jeu");
  $("jeuFreeze").onclick=()=>{ if(!live) return; JEU.frozen=live.eng.freeze(!JEU.frozen); $("jeuFreeze").setAttribute("aria-pressed",JEU.frozen?"true":"false"); syncUI(); };
  $("jeuReroll").onclick=()=>{ if(live) live.eng.reroll(); };
  $("jeuVary").onclick=varyScene; $("jeuBack").onclick=varyBack;
  /* geler le nuage : s'il était absent, on le fait entrer pour que le gel s'entende */
  $("jeuGel").onclick=()=>{
    if(!live) return;
    if(!live.eng.fxOn()){ $("jeuHint").textContent="Le nuage de grains n'est pas disponible dans ce navigateur."; return; }
    const on=!JEU.gel;
    if(on&&S.grain.mix<0.05){ applyKnob(KNOB.tex,0.6,true); jeuSync(); }
    JEU.gel=live.eng.grainFreeze(on); $("jeuGel").setAttribute("aria-pressed",JEU.gel?"true":"false");
  };
  document.querySelectorAll("#jeuAmp .lnk").forEach(b=>{ b.onclick=()=>{ JEU.amp=+b.dataset.amp; jeuAmpUI(); }; }); jeuAmpUI();
  document.querySelectorAll("#jeuGest [data-g]").forEach(b=>{ b.onclick=()=>{ if(!live) return; const d=live.eng.gesture(b.dataset.g,JEU.amp); if(d>0){ b.setAttribute("aria-pressed","true"); clearTimeout(b._t); b._t=setTimeout(()=>b.setAttribute("aria-pressed","false"),d*1000); } }; });
  document.addEventListener("keydown",jeuKeys);
  JEU.mixSig=""; jeuState();
}
