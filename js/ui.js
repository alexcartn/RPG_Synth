"use strict";
/* ============================================================
   ÉTAT UI, LECTURE EN DIRECT
   ============================================================ */
const $=id=>document.getElementById(id);
let live=null, timer=null, raf=0, lastFrame=0;

function getP(path){return path.split(".").reduce((a,k)=>a[k],S);}
function setP(path,v){const ks=path.split("."); const last=ks.pop(); ks.reduce((a,k)=>a[k],S)[last]=v;}

/* qualité audio : économe par défaut sur téléphone et machines modestes, au choix de la personne ensuite */
function defaultQuality(){
  try{ if(matchMedia("(pointer:coarse)").matches||(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4) return "eco"; }catch(e){}
  return "high";
}
function getQuality(){ try{ const q=localStorage.getItem("bourdon.quality"); if(q==="eco"||q==="high") return q; }catch(e){} return defaultQuality(); }
const isEco=()=>getQuality()==="eco";
function engineOpts(){ return {onNote:noteFlash, lite:isEco()}; }

function startLive(){
  const AC=window.AudioContext||window.webkitAudioContext;
  /* "playback" : tampons plus grands, moins de réveils du processeur, aucun besoin de latence ici */
  let ctx; try{ ctx=new AC({latencyHint:"playback"}); }catch(e){ ctx=new AC(); }
  const eng=buildEngine(ctx,S,engineOpts());
  live={ctx,eng,t0:ctx.currentTime+0.1,olds:[]};
  vizClear();
  eng.start(live.t0,5,0);
  eng.schedule(ctx.currentTime+8);
  timer=setInterval(()=>eng.schedule(ctx.currentTime+8),400);
  setPlayUI(true); updateRingCap();
  { const m=parseInt($("sleep").value,10)||0; if(m) sleepSet(m); }
  if(!raf) raf=requestAnimationFrame(frame);
}
/* chaque note planifiée alimente la partition, et allume le cercle quand elle sonne */
function noteFlash(t,off,kind,dur,vel,label){
  if(!live) return;
  vizPush(t,off,kind,dur,vel,label);
  if(!PITCHED[kind]||kind==="pad") return;
  const ms=Math.max(0,(t-live.ctx.currentTime)*1000); setTimeout(()=>flashNote(off,kind),ms);
}
function stopLive(){
  if(!live) return;
  clearInterval(timer);
  const {ctx,eng,olds}=live; live=null;
  olds.forEach(e=>e.stop(ctx.currentTime));
  eng.stop(ctx.currentTime);
  setTimeout(()=>{try{ctx.close();}catch(e){}},1600);
  clearInterval(sleep.timer); sleep.endMs=0; sleepNote("");
  setPlayUI(false); updateRingCap(); vizClear(); vizDraw(null); $("pend").parentNode.hidden=true;
  if(camp.running) campStop();
}
/* fondu enchaîné : un nouveau moteur démarre pendant que l'ancien s'éteint, sans coupure */
function crossfade(d){
  const {ctx,eng:old}=live, t=ctx.currentTime+0.05;
  const eng=buildEngine(ctx,S,engineOpts());
  eng.start(t,d,0); eng.schedule(ctx.currentTime+8);
  old.fadeOut(t,d);
  clearInterval(timer); timer=setInterval(()=>eng.schedule(ctx.currentTime+8),400);
  live.olds.push(old); live.eng=eng; live.lastKey=null; sleepApply();
  setTimeout(()=>{ if(live) live.olds=live.olds.filter(x=>x!==old); },d*1000+500);
  updateRingCap();
}
function restartIfLive(d){ if(live) crossfade(d||1.5); }
function setPlayUI(on){
  if(window.keepAwake) window.keepAwake(on);
  evtState();
  ["play","play2"].forEach(id=>{const b=$(id); b.textContent=on?"Arrêter":"Jouer"; b.setAttribute("aria-pressed",on?"true":"false");});
}
$("play").onclick=$("play2").onclick=()=>{live?stopLive():startLive();};

function drawPend(){
  const cv=$("pend"), wrap=cv.parentNode, on=live&&S.pend.lvl>0.001;
  if(wrap.hidden===on) wrap.hidden=!on;
  if(!on) return;
  const c=cv.getContext("2d"), W=cv.width, H=cv.height, N=Math.round(S.pend.count), xs=live.eng.pendX(live.ctx.currentTime);
  const cs=getComputedStyle(document.documentElement), ink=cs.getPropertyValue("--ink").trim()||"#3a2e22", rub=cs.getPropertyValue("--rubric").trim()||"#a3301c";
  c.clearRect(0,0,W,H);
  c.strokeStyle=ink; c.globalAlpha=.25; c.lineWidth=1; c.beginPath(); c.moveTo(0,H/2); c.lineTo(W,H/2); c.stroke(); c.globalAlpha=1;
  const pts=xs.slice(0,N).map((x,i)=>[W*(i+0.5)/N, H/2-x*H*0.38]);
  c.strokeStyle=ink; c.lineWidth=1.2; c.beginPath(); pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.stroke();
  c.fillStyle=rub; pts.forEach(([x,y])=>{c.beginPath(); c.arc(x,y,5,0,Math.PI*2); c.fill();});
}
/* une image : 30 par seconde en mode économe, 60 sinon */
function frame(ts){
  raf=0; if(!live) return;
  if(!isEco()||ts-lastFrame>=33){ lastFrame=ts; vizDraw(live.ctx.currentTime,live.eng); drawPend(); tableFrame(); }
  raf=requestAnimationFrame(frame);
}

/* ---------- cercle des hauteurs ---------- */
const ringSvg=$("ring"), NS="http://www.w3.org/2000/svg";
const ringEls=[];
function buildRing(){
  ringSvg.innerHTML="";
  const guide=document.createElementNS(NS,"circle"); guide.setAttribute("cx",100); guide.setAttribute("cy",100); guide.setAttribute("r",70);
  guide.setAttribute("fill","none"); guide.setAttribute("stroke","currentColor"); guide.setAttribute("stroke-opacity",".25"); guide.setAttribute("stroke-width","0.8");
  ringSvg.appendChild(guide);
  for(let pc=0;pc<12;pc++){
    const a=pc/12*Math.PI*2-Math.PI/2, x=100+Math.cos(a)*70, y=100+Math.sin(a)*70;
    const g=document.createElementNS(NS,"g"); g.setAttribute("class","note-g"); g.setAttribute("tabindex","0"); g.setAttribute("role","button");
    const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",x); c.setAttribute("cy",y); c.setAttribute("r",pc===0?10:8); c.setAttribute("class","note-c");
    const tx=100+Math.cos(a)*91, ty=100+Math.sin(a)*91+3;
    const t=document.createElementNS(NS,"text"); t.setAttribute("x",tx); t.setAttribute("y",ty); t.setAttribute("class","note-t");
    g.appendChild(c); g.appendChild(t); ringSvg.appendChild(g);
    g.addEventListener("click",()=>toggleNote(pc));
    g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault(); toggleNote(pc);}});
    ringEls.push({g,c,t});
  }
}
function curScaleKey(){
  if(live){const s=live.eng.secAt(live.ctx.currentTime); return s.key;}
  return S.scales[0]||"mixolydien";
}
function drawRing(){
  const key=curScaleKey(), iv=ivOf(S,key);
  ringEls.forEach((r,pc)=>{
    const on=iv.indexOf(pc)>=0;
    r.c.setAttribute("class","note-c"+(on?" on":"")+(pc===0?" root":""));
    r.t.textContent=NOTES[(S.root+pc)%12];
    r.g.setAttribute("aria-label",NOTES[(S.root+pc)%12]+(on?", dans la gamme":", hors gamme")+(pc===0?", tonique":""));
    r.g.setAttribute("aria-pressed",on?"true":"false");
  });
}
function updateRingCap(){
  const key=curScaleKey(), iv=ivOf(S,key), nm=(SC[key]||SC.mixolydien).n;
  $("ringcap").innerHTML="<strong>"+NOTES[S.root]+" "+nm.toLowerCase()+"</strong><br>"+iv.map(i=>NOTES[(S.root+i)%12]).join(" ");
  drawRing();
}
function flashNote(off,kind){
  const pc=((off%12)+12)%12, r=ringEls[pc]; if(!r) return;
  r.c.classList.add("hit"); setTimeout(()=>r.c.classList.remove("hit"),kind==="canon"?260:380);
}
function toggleNote(pc){
  if(pc===0) return;
  if(S.scales[0]!=="libre"){ const base=ivOf(S,S.scales[0]); S.custom=Array.from({length:12},(_,i)=>base.indexOf(i)>=0?1:0); S.scales[0]="libre"; }
  S.custom[pc]=S.custom[pc]?0:1;
  syncUI();
}
setInterval(()=>{ if(live){ const k=curScaleKey(); if(k!==live.lastKey){live.lastKey=k; updateRingCap();} } },500);

/* ---------- construction des contrôles ---------- */
const pct=v=>Math.round(v*100)+" %";
const INST_OPTS=[["luth","Luth"],["harpe","Harpe"],["flute","Flûte"],["carillon","Carillon"],["orgue","Orgue positif"],["oud","Oud (corde pincée)"],["ney","Ney (flûte soufflée)"],["kalimba","Kalimba"],["bol","Bol chantant"],["verre","Cloches de verre"],["synthe","Synthé doux"]];
const SCALE_OPTS=SCALE_GROUPS.map(([g,l])=>[g,l.map(([k,n])=>[k,n])]);
const UI=[
 {num:"I", title:"Modus", fr:"Gamme et accord", sub:"Tonique, gamme principale, et jusqu'à deux colorations qui se succèdent par sections.", groups:[
  {items:[
   {k:"root",type:"select",label:"Tonalité",opts:NOTES.map((n,i)=>[i,n]),num:true,restart:true},
   {k:"scales.0",type:"select",label:"Gamme principale",groups:SCALE_OPTS,restart:false,ring:true},
   {k:"scales.1",type:"select",label:"Puis (facultatif)",groups:SCALE_OPTS,blank:"Aucune",ring:true},
   {k:"scales.2",type:"select",label:"Puis encore (facultatif)",groups:SCALE_OPTS,blank:"Aucune",ring:true},
   {k:"sectionBars",type:"range",label:"Durée d'une section",min:4,max:64,step:4,fmt:v=>v+" mesures",restart:true}]},
  {fin:"Temperatio : accord et tempérament", items:[
   {k:"temper",type:"select",label:"Tempérament",opts:[["egal","Égal"],["juste","Juste (intonation pure)"],["pyth","Pythagoricien"],["meso","Mésotonique (quart de comma)"]],restart:true},
   {k:"a4",type:"range",label:"Diapason (La)",min:410,max:450,step:1,fmt:v=>v+" Hz",restart:true}]}]},
 {num:"II", title:"Tempus", fr:"Rythme", sub:"Une grille de croches commune à la mélodie, aux nappes et aux frappes.", groups:[
  {items:[
   {k:"tempo",type:"range",label:"Tempo",min:40,max:180,step:1,fmt:v=>v+" bpm",restart:true},
   {k:"meter",type:"select",label:"Mesure",opts:Object.keys(METERS).map(k=>[k,k]),restart:true},
   {k:"swing",type:"range",label:"Swing",min:0,max:1,step:0.01,fmt:pct},
   {k:"perc.lvl",type:"range",label:"Percussion",min:0,max:1,step:0.01,fmt:pct}]},
  {fin:"Réglages de la percussion", items:[
   {k:"perc.shaker",type:"range",label:"Densité du shaker",min:0,max:1,step:0.01,fmt:pct},
   {k:"perc.ghost",type:"range",label:"Frappes fantômes",min:0,max:1,step:0.01,fmt:pct}]}]},
 {num:"III", title:"Bordunus", fr:"Bourdon", sub:"Sous-grave, tonique, quinte, octaves. La quinte glisse vers un degré voisin de la gamme.", groups:[
  {items:[
   {k:"drone.lvl",type:"range",label:"Niveau",min:0,max:1,step:0.01,fmt:pct},
   {k:"drone.timbre",type:"select",label:"Timbre",opts:[["anche","Anche (cornemuse)"],["orgue","Orgue de chambre"],["choeur","Chœur (voyelles)"],["bol","Bol chantant"],["pur","Sinus pur"]],restart:true},
   {k:"drone.bright",type:"range",label:"Éclat",min:0,max:1,step:0.01,fmt:pct,restart:true},
   {k:"drone.glide",type:"range",label:"Quinte mobile",min:0,max:1,step:0.01,fmt:pct}]},
  {fin:"Réglages du bourdon", items:[
   {k:"drone.width",type:"range",label:"Largeur (désaccord)",min:0,max:1,step:0.01,fmt:pct,restart:true},
   {k:"drone.drift",type:"range",label:"Dérive",min:0,max:1,step:0.01,fmt:pct,restart:true}]}]},
 {num:"IV", title:"Voces", fr:"Voix", sub:"Mélodie, canon décalé et nappes d'accords construits sur la gamme de la section.", groups:[
  {h:"Cantus", hf:"mélodie", items:[
   {k:"mel.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"mel.lvl",type:"range",label:"Niveau",min:0,max:1,step:0.01,fmt:pct},
   {k:"mel.dens",type:"range",label:"Densité",min:0,max:1,step:0.01,fmt:pct},
   {k:"mel.reg",type:"select",label:"Registre",opts:[[0,"Grave"],[1,"Médium"],[2,"Aigu"]],num:true}]},
  {fin:"Réglages de la mélodie", items:[
   {k:"mel.span",type:"range",label:"Étendue",min:1,max:3,step:1,fmt:v=>v+(v>1?" octaves":" octave")},
   {k:"mel.leap",type:"range",label:"Sauts",min:0,max:1,step:0.01,fmt:pct},
   {k:"mel.orn",type:"range",label:"Ornements (appoggiatures)",min:0,max:1,step:0.01,fmt:pct}]},
  {h:"Canon", hf:"voix décalée", items:[
   {k:"canon.lvl",type:"range",label:"Niveau (0 = absent)",min:0,max:1,step:0.01,fmt:pct},
   {k:"canon.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"canon.delay",type:"range",label:"Retard",min:1,max:8,step:1,fmt:v=>v+(v>1?" mesures":" mesure")},
   {k:"canon.shift",type:"select",label:"Transposition",opts:[["uni","Unisson"],["oct+","Octave au-dessus"],["oct-","Octave en dessous"],["q+","Quinte au-dessus"],["q-","Quinte en dessous"],["t+","Tierce au-dessus"]]}]},
  {h:"Concentus", hf:"nappes", items:[
   {k:"pad.lvl",type:"range",label:"Niveau",min:0,max:1,step:0.01,fmt:pct},
   {k:"pad.timbre",type:"select",label:"Timbre",opts:[["choeur","Chœur"],["cordes","Cordes"],["orgue","Orgue"],["synthe","Synthé doux"],["verre","Verre"]]},
   {k:"pad.len",type:"range",label:"Durée d'un accord",min:1,max:8,step:1,fmt:v=>v+(v>1?" mesures":" mesure")},
   {k:"pad.motion",type:"range",label:"Mouvement harmonique",min:0,max:1,step:0.01,fmt:pct},
   {k:"pad.voices",type:"range",label:"Voix par accord",min:2,max:4,step:1,fmt:v=>v+" voix"}]},
  {fin:"Memoria : déjà-vu de la mélodie et des nappes", items:[
   {k:"mel.deja",type:"range",label:"Mélodie : retour du passé",min:0,max:1,step:0.01,fmt:v=>v<0.01?"jamais":pct(v),restart:true},
   {k:"mel.loop",type:"range",label:"Mélodie : longueur de la boucle",min:1,max:8,step:1,fmt:v=>v+(v>1?" phrases":" phrase"),restart:true},
   {k:"pad.deja",type:"range",label:"Nappes : retour du passé",min:0,max:1,step:0.01,fmt:v=>v<0.01?"jamais":pct(v),restart:true},
   {k:"pad.loop",type:"range",label:"Nappes : longueur de la boucle",min:1,max:8,step:1,fmt:v=>v+(v>1?" accords":" accord"),restart:true}]}]},
 {num:"V", title:"Locus", fr:"Lieu", sub:"La salle autour de la musique : de la taverne bruyante à la crypte qui goutte.", groups:[
  {items:[
   {k:"amb.murmur",type:"range",label:"Murmure de salle",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.clink",type:"range",label:"Tintements de verres",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.feu",type:"range",label:"Feu de cheminée",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.vent",type:"range",label:"Vent",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.gouttes",type:"range",label:"Gouttes (crypte)",min:0,max:1,step:0.01,fmt:pct}]},
  {h:"Eventus", hf:"sons à la demande", items:[
   {k:"evt.lvl",type:"range",label:"Niveau des sons du pad (touches 1 à 8)",min:0,max:1,step:0.01,fmt:pct}]}]},
 {num:"VI", title:"Spatium et Patina", fr:"Espace et patine", sub:"Réverbération, écho et le grain d'une vieille bande.", groups:[
  {h:"Spatium", hf:"espace", items:[
   {k:"vol",type:"range",label:"Volume général (l'export est toujours normalisé)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.rev",type:"range",label:"Réverb",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.size",type:"range",label:"Taille de la salle",min:0.5,max:9,step:0.1,fmt:v=>v.toFixed(1)+" s",reverb:true},
   {k:"fx.dark",type:"range",label:"Ombre (réverb sourde)",min:0,max:1,step:0.01,fmt:pct,reverb:true},
   {k:"fx.dly",type:"range",label:"Écho",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.dlyDiv",type:"select",label:"Valeur de l'écho",opts:[[1.5,"Croche pointée"],[2,"Noire"],[3,"Noire pointée"]],num:true},
   {k:"fx.fb",type:"range",label:"Répétitions de l'écho",min:0,max:0.9,step:0.01,fmt:pct}]},
  {h:"Patina", hf:"patine de bande", items:[
   {k:"fx.sat",type:"range",label:"Saturation",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.wow",type:"range",label:"Ondulation (wow et flutter)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.veil",type:"range",label:"Voile (aigus assourdis)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.hiss",type:"range",label:"Souffle",min:0,max:1,step:0.01,fmt:pct}]}]},
 {num:"VII", title:"Mutatio", fr:"Évolution", sub:"La pièce respire : l'intensité module la percussion, les nappes, l'éclat du bourdon et la densité.", groups:[
  {items:[
   {k:"form.shape",type:"select",label:"Forme",opts:[["constante","Constante"],["arche","Arche"],["vagues","Vagues"],["escalier","Escalier"]]},
   {k:"form.period",type:"range",label:"Période",min:1,max:10,step:0.5,fmt:v=>v+" min"},
   {k:"form.amount",type:"range",label:"Amplitude",min:0,max:1,step:0.01,fmt:pct}]},
  {h:"Tensio", hf:"courbe de tension", items:[
   {k:"curve.mode",type:"select",label:"Courbe",opts:[["off","Désactivée"],["loop","Répétée"],["once","Une fois, puis elle tient"]],restart:true},
   {k:"curve.dur",type:"range",label:"Durée de la courbe",min:1,max:20,step:1,fmt:v=>v+(v>1?" minutes":" minute")}], node:()=>curveEditor()}]},
 {num:"VIII", title:"Rotae et Pendula", fr:"Boucles et pendules", sub:"Deux machines à hasard réglé : des boucles de bande de longueurs premières entre elles, et des pendules qui se désynchronisent puis se retrouvent.", groups:[
  {h:"Rotae", hf:"boucles de bande", items:[
   {k:"loops.lvl",type:"range",label:"Niveau (0 = absentes)",min:0,max:1,step:0.01,fmt:pct},
   {k:"loops.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"loops.count",type:"range",label:"Nombre de boucles",min:1,max:5,step:1,fmt:v=>v+(v>1?" boucles":" boucle"),restart:true},
   {k:"loops.speed",type:"range",label:"Durée des boucles",min:0.6,max:2,step:0.05,fmt:v=>"× "+v.toFixed(2),restart:true}]},
  {h:"Pendula", hf:"pendules", items:[
   {k:"pend.lvl",type:"range",label:"Niveau (0 = absents)",min:0,max:1,step:0.01,fmt:pct},
   {k:"pend.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"pend.count",type:"range",label:"Nombre de pendules",min:3,max:10,step:1,fmt:v=>v+" pendules",restart:true},
   {k:"pend.period",type:"range",label:"Période de resynchronisation",min:8,max:48,step:2,fmt:v=>v+" mesures",restart:true}]}]}
];

const CTL=[];
function mkCtl(it){
  const wrap=document.createElement("div"); wrap.className="ctl";
  const id="c_"+it.k.replace(/\./g,"_");
  const row=document.createElement("div"); row.className="l";
  const lab=document.createElement("label"); lab.htmlFor=id; lab.textContent=it.label; row.appendChild(lab);
  let el,out=null;
  if(it.type==="range"){
    el=document.createElement("input"); el.type="range"; el.min=it.min; el.max=it.max; el.step=it.step;
    out=document.createElement("output"); out.htmlFor=id; row.appendChild(out);
  }else{
    el=document.createElement("select");
    const addOpts=(parent,list)=>list.forEach(([v,l])=>{const op=document.createElement("option"); op.value=v; op.textContent=l; parent.appendChild(op);});
    if(it.blank){const op=document.createElement("option"); op.value=""; op.textContent=it.blank; el.appendChild(op);}
    if(it.groups){it.groups.forEach(([g,l])=>{const og=document.createElement("optgroup"); og.label=g; addOpts(og,l); el.appendChild(og);});}
    else addOpts(el,it.opts);
  }
  el.id=id; wrap.appendChild(row); wrap.appendChild(el);
  const entry={it,el,out};
  const upd=()=>{ if(out) out.textContent=it.fmt(parseFloat(el.value)); };
  if(it.type==="range"){
    el.addEventListener("input",()=>{ setP(it.k,parseFloat(el.value)); upd(); if(it.k==="tension") releaseCurve(); if(live&&!it.restart){live.eng.setLevels();} if(it.k==="tempo"||it.k==="meter") updateTempo(); });
    el.addEventListener("change",()=>{ if(it.reverb&&live) live.eng.setReverb(); if(it.restart) restartIfLive(); });
  }else{
    el.addEventListener("change",()=>{ const v=it.num?parseFloat(el.value):el.value; setP(it.k,v); if(live&&!it.restart) live.eng.setLevels(); if(it.restart) restartIfLive(); if(it.ring||it.k==="root") updateRingCap(); if(it.k==="tempo"||it.k==="meter") updateTempo(); });
  }
  entry.upd=upd; CTL.push(entry);
  return wrap;
}
const tensionWord=v=>v<0.35?"calme":v>0.65?"tendue":"neutre";
/* la tension est aussi dans la barre du bas sur téléphone : les deux curseurs restent liés */
function wireDockTension(){
  const main=$("c_tension"), dock=$("tension2");
  const show=()=>{ dock.value=main.value; $("tension2o").textContent=tensionWord(parseFloat(main.value)); };
  dock.addEventListener("input",()=>{ main.value=dock.value; main.dispatchEvent(new Event("input")); });
  main.addEventListener("input",show); show();
  CTL[CTL.length-1].sync2=show;
}
/* table des matières collée en haut : numéros romains et titres latins */
function buildToc(){
  const nav=$("toc"), secs=[...document.querySelectorAll("#chapters .chap")], links=new Map();
  secs.forEach(sec=>{
    const a=document.createElement("a"); a.href="#"+sec.id; a.innerHTML='<span class="n">'+sec.querySelector(".num").textContent+'</span>'+sec.querySelector("h2").textContent;
    nav.appendChild(a); links.set(sec,a);
  });
  const mark=sec=>{ links.forEach((a,s)=>{ if(s===sec){ a.setAttribute("aria-current","true"); const l=a.offsetLeft-nav.clientWidth/2+a.clientWidth/2; if(nav.scrollWidth>nav.clientWidth) nav.scrollTo({left:l}); } else a.removeAttribute("aria-current"); }); };
  if("IntersectionObserver" in window){
    
    const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting) mark(e.target); }); },{rootMargin:"-15% 0px -75% 0px"});
    secs.forEach(s=>io.observe(s));
  }
}
function buildChapters(){
  const host=$("chapters");
  $("tensionHost").appendChild(mkCtl({k:"tension",type:"range",label:"Tensio",min:0,max:1,step:0.01,fmt:tensionWord}));
  wireDockTension();
  UI.forEach(ch=>{
    const sec=document.createElement("section"); sec.className="chap";
    const hd=document.createElement("header");
    hd.innerHTML='<span class="num">'+ch.num+'</span><div><h2>'+ch.title+'</h2><p class="sub"><span class="fr">'+ch.fr+'</span> '+ch.sub+'</p></div>'; sec.id="ch-"+ch.num;
    sec.appendChild(hd);
    ch.groups.forEach(gr=>{
      let container=sec;
      if(gr.fin){ const d=document.createElement("details"); d.className="fin"; const s=document.createElement("summary"); s.textContent=gr.fin; d.appendChild(s); sec.appendChild(d); container=d; }
      else if(gr.h){ const g=document.createElement("div"); g.className="group"; const h=document.createElement("h3"); h.textContent=gr.h; if(gr.hf){ const f=document.createElement("span"); f.className="fr"; f.textContent=gr.hf; h.appendChild(f); } g.appendChild(h); sec.appendChild(g); container=g; }
      const f=document.createElement("div"); f.className="fields"; gr.items.forEach(it=>f.appendChild(mkCtl(it))); container.appendChild(f);
      if(gr.node) container.appendChild(gr.node());
    });
    host.appendChild(sec);
  });
  buildCampaign(host);
  buildExport(host);
  buildToc();
}
function syncUI(){
  CTL.forEach(({it,el,upd,sync2})=>{ el.value=String(getP(it.k)); if(el.tagName==="SELECT"&&el.value!==String(getP(it.k))){ el.value=""; } upd(); if(sync2) sync2(); });
  $("seed").value=S.seed; updateTempo(); updateRingCap(); if(typeof curveDraw==="function") curveDraw();
}
function updateTempo(){ $("tempoNum").textContent=S.tempo; $("tempoCap").textContent="noires par minute · "+S.meter; }

/* préréglages et scènes : chaque changement se fait par fondu enchaîné quand la lecture tourne */
const fadeSec=()=>parseFloat($("fade").value)||4;
function loadScene(state,btn,fade){
  S=merge(clone(DEFAULT),clone(state));
  document.querySelectorAll("#presets .lnk,#scenes .lnk").forEach(x=>x.removeAttribute("aria-current"));
  if(btn) btn.setAttribute("aria-current","true");
  syncUI(); restartIfLive(fade||fadeSec());
}
function currentUnivers(){ try{ const v=localStorage.getItem("bourdon.univers"); if(UNIVERS.some(x=>x.id===v)) return v; }catch(e){} return "medieval"; }
function drawPresetRow(){
  const row=$("presets"), id=$("univers").value, u=UNIVERS.find(x=>x.id===id)||UNIVERS[0];
  row.innerHTML=""; $("presetGloss").textContent="";
  u.items.forEach(([name,over,gloss])=>{
    const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=name; b.title=gloss;
    b.onclick=()=>{ loadScene(over,b); $("presetGloss").textContent=name+" : "+gloss+"."; };
    row.appendChild(b);
  });
  const first=row.firstElementChild; if(first&&id==="medieval") first.setAttribute("aria-current","true");
}
function buildPresets(){
  const sel=$("univers");
  UNIVERS.forEach(x=>{ const o=document.createElement("option"); o.value=x.id; o.textContent=x.name; sel.appendChild(o); });
  sel.value=currentUnivers();
  sel.onchange=()=>{ try{ localStorage.setItem("bourdon.univers",sel.value); }catch(e){} drawPresetRow(); };
  drawPresetRow(); drawScenes();
}
const SCENE_KEY="bourdon.scenes";
function getScenes(){ try{ const a=JSON.parse(localStorage.getItem(SCENE_KEY)||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function putScenes(a){ try{ localStorage.setItem(SCENE_KEY,JSON.stringify(a)); }catch(e){} }
function drawScenes(){
  const row=$("scenes"); row.innerHTML="";
  getScenes().forEach(sc=>{
    const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=sc.name; b.onclick=()=>loadScene(sc.state,b); row.appendChild(b);
  });
  $("clearScenes").hidden=!row.children.length;
}
$("saveScene").onclick=()=>{
  const a=getScenes(); if(a.length>=8){ a.shift(); }
  const n=(a.reduce((m,x)=>Math.max(m,x.n||0),0))+1;
  a.push({n,name:"Scaena "+n+" · "+NOTES[S.root],state:clone(S)}); putScenes(a); drawScenes(); campRefresh();
};
$("clearScenes").onclick=()=>{ putScenes([]); drawScenes(); campRefresh(); };
/* extinction progressive : le niveau tient puis descend en douceur, la lecture s'arrête au silence */
const sleep={endMs:0,len:0,timer:0,shown:""};
function sleepApply(){ if(!live||!sleep.endMs) return; live.eng.sleepFade(live.ctx.currentTime+(sleep.endMs-Date.now())/1000,sleep.len); }
function sleepNote(txt){ if(txt!==sleep.shown){ sleep.shown=txt; $("sleepNote").textContent=txt; } }
function sleepSet(min){
  clearInterval(sleep.timer); sleep.endMs=0;
  if(!min){ if(live) live.eng.sleepClear(); sleepNote(""); return; }
  sleep.endMs=Date.now()+min*60000; sleep.len=Math.min(300,Math.max(60,min*60*0.2));
  sleepApply(); sleep.timer=setInterval(sleepTick,1000); sleepTick();
}
function sleepTick(){
  const r=sleep.endMs-Date.now();
  if(r<=0){ clearInterval(sleep.timer); sleep.endMs=0; $("sleep").value="0"; sleepNote(""); if(live) stopLive(); return; }
  const m=Math.ceil(r/60000);
  sleepNote(m<=1?"Extinction dans moins d'une minute.":"Extinction dans "+m+" minutes, avec un fondu sur les "+Math.round(sleep.len/60)+" dernières.");
}
$("sleep").onchange=()=>{
  const m=parseInt($("sleep").value,10)||0;
  if(live||!m) sleepSet(m); else sleepNote("Le compte à rebours démarre à la mise en lecture.");
};
$("quality").value=getQuality();
$("quality").onchange=()=>{ try{ localStorage.setItem("bourdon.quality",$("quality").value); }catch(e){} restartIfLive(1.5); };
$("seed").onchange=()=>{ S.seed=Math.max(1,Math.min(999999,parseInt($("seed").value)||1)); $("seed").value=S.seed; restartIfLive(); };
$("dice").onclick=()=>{ S.seed=1+Math.floor(Math.random()*999999); $("seed").value=S.seed; restartIfLive(); };
