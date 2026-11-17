"use strict";
/* ============================================================
   ÉTAT UI, LECTURE EN DIRECT
   ============================================================ */
const $=id=>document.getElementById(id);
let live=null, timer=null, raf=0, lastFrame=0;

function getP(path){ try{ return path.split(".").reduce((a,k)=>a[k],S); }catch(e){ return undefined; } }
function setP(path,v){const ks=path.split("."); const last=ks.pop(); ks.reduce((a,k)=>a[k],S)[last]=v;}

/* planification : 4 secondes d'avance quand la page est visible (réglages presque immédiats), 10 en arrière-plan */
const lookahead=()=>document.hidden?10:4;
function tickSchedule(){ if(live) live.eng.schedule(live.ctx.currentTime+lookahead()); }
document.addEventListener("visibilitychange",tickSchedule);

/* réglages immédiats : quelles voix replanifier quand un réglage change, sans redémarrer le moteur */
const GAIN_ONLY={"mel.lvl":"mel","canon.lvl":"mel","pad.lvl":"pad","loops.lvl":"loops","pend.lvl":"pend"};
function replanTarget(k,prev,now){
  if(k in GAIN_ONLY) return ((prev>0.001)!==(now>0.001))?GAIN_ONLY[k]:null; /* seulement quand une voix s'allume ou s'éteint */
  if(k.startsWith("mel.")||k.startsWith("canon.")||k.startsWith("car.")||k.startsWith("chance.")||k.startsWith("turing.")) return "mel";
  if(k.startsWith("pad.")) return "pad";
  if(k.startsWith("loops.")) return "loops";
  if(k.startsWith("arp.")) return "arp";
  if(k.startsWith("pend.")) return "pend";
  if(k.startsWith("scales.")||k==="sectionBars"||k.startsWith("mus.")) return "all";
  return null;
}
let replanTimer=0, replanPending=null;
function replanSoon(what,now){
  if(!live) return;
  if(now){ clearTimeout(replanTimer); replanTimer=0; replanPending=null; live.eng.replan(what); return; }
  replanPending=(replanPending&&replanPending!==what)?"all":what;
  if(replanTimer) return;
  replanTimer=setTimeout(()=>{ replanTimer=0; const w=replanPending; replanPending=null; if(live&&w) live.eng.replan(w); },160);
}
/* un réglage qui change : on applique, on replanifie la voix concernée, et on ne redémarre que ce qui l'exige */
function paramChanged(k,prev,now,final,restart){
  if(!live) return;
  if(!restart) live.eng.setLevels();
  const w=replanTarget(k,prev,now);
  if(w&&!restart) replanSoon(w,final);
}

/* qualité audio : économe par défaut sur téléphone et machines modestes, au choix de la personne ensuite */
function defaultQuality(){
  try{ if(matchMedia("(pointer:coarse)").matches||(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4) return "eco"; }catch(e){}
  return "high";
}
function getQuality(){ try{ const q=localStorage.getItem("bourdon.quality"); if(q==="eco"||q==="high") return q; }catch(e){} return defaultQuality(); }
const isEco=()=>getQuality()==="eco";
function engineOpts(){ return {onNote:noteFlash, lite:isEco(), rolling:true}; }

function startLive(opt){
  S.seed=newSeed();
  const AC=window.AudioContext||window.webkitAudioContext;
  /* "playback" : tampons plus grands, moins de réveils du processeur, aucun besoin de latence ici */
  let ctx; try{ ctx=new AC({latencyHint:"playback"}); }catch(e){ ctx=new AC(); }
  const eng=buildEngine(ctx,S,engineOpts());
  live={ctx,eng,t0:ctx.currentTime+0.1,olds:[]};
  /* réverbération vivante et grain : branchés dès que le worklet est chargé (quelques millisecondes) */
  if(typeof fxLoad==="function") fxLoad(ctx).then(ok=>{ if(ok&&live&&live.ctx===ctx) live.eng.fxAttach(); });
  vizClear();
  eng.start(live.t0,(opt&&opt.fade)||5,0);
  eng.schedule(ctx.currentTime+lookahead());
  timer=setInterval(tickSchedule,150);
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
  if(typeof CAP!=="undefined"&&CAP.on) capStop();
  clearInterval(timer);
  const {ctx,eng,olds}=live; live=null;
  olds.forEach(e=>e.stop(ctx.currentTime));
  eng.stop(ctx.currentTime);
  setTimeout(()=>{try{ctx.close();}catch(e){}},1600);
  clearInterval(sleep.timer); sleep.endMs=0; sleepNote("");
  setPlayUI(false); updateRingCap(); vizClear(); vizDraw(null); $("pend").parentNode.hidden=true;
}
/* fondu enchaîné : un nouveau moteur démarre pendant que l'ancien s'éteint, sans coupure */
function crossfade(d){
  const {ctx,eng:old}=live, t=ctx.currentTime+0.05;
  const eng=buildEngine(ctx,S,engineOpts());
  eng.start(t,d,0); eng.schedule(ctx.currentTime+lookahead());
  old.fadeOut(t,d);
  clearInterval(timer); timer=setInterval(tickSchedule,150);
  live.olds.push(old); live.eng=eng; live.lastKey=null; sleepApply(); if(typeof capRewire==="function") capRewire(); if(typeof jeuReset==="function") jeuReset();
  setTimeout(()=>{ if(live) live.olds=live.olds.filter(x=>x!==old); },d*1000+500);
  updateRingCap();
}
function restartIfLive(d){ if(live) crossfade(d||0.6); }
function setPlayUI(on){
  if(window.keepAwake) window.keepAwake(on);
  document.body.classList.toggle("playing",!!on);
  ["play","play2","play3","play4"].forEach(id=>{const b=$(id); if(!b) return; b.textContent=on?"Arrêter":"Jouer"; b.setAttribute("aria-pressed",on?"true":"false");});
  if(typeof jeuState==="function") jeuState(); if(typeof capUI==="function") capUI();
}
$("play").onclick=$("play2").onclick=$("play3").onclick=()=>{live?stopLive():startLive();};

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
  if(!isEco()||ts-lastFrame>=33){ lastFrame=ts; vizDraw(live.ctx.currentTime,live.eng); drawPend(); tableFrame(); jeuFrame(); }
  raf=requestAnimationFrame(frame);
}

/* ---------- cercle des hauteurs ---------- */
const ringSvg=$("ring"), NS="http://www.w3.org/2000/svg";
const ringEls=[];
/* cercle de 24 positions : les grands points sont les douze demi-tons, les petits entre eux sont les quarts de ton */
const noteName=i=>Number.isInteger(i)?NOTES[(S.root+i)%12]:NOTES[(S.root+Math.ceil(i))%12]+"↓";
function buildRing(){
  ringSvg.innerHTML="";
  const guide=document.createElementNS(NS,"circle"); guide.setAttribute("cx",100); guide.setAttribute("cy",100); guide.setAttribute("r",70);
  guide.setAttribute("fill","none"); guide.setAttribute("stroke","currentColor"); guide.setAttribute("stroke-opacity",".25"); guide.setAttribute("stroke-width","0.8");
  ringSvg.appendChild(guide);
  for(let p=0;p<24;p++){
    const q=p%2===1, a=p/24*Math.PI*2-Math.PI/2, x=100+Math.cos(a)*70, y=100+Math.sin(a)*70;
    const g=document.createElementNS(NS,"g"); g.setAttribute("class","note-g"+(q?" q":"")); g.setAttribute("tabindex","0"); g.setAttribute("role","button");
    if(q){ const hit=document.createElementNS(NS,"circle"); hit.setAttribute("cx",x); hit.setAttribute("cy",y); hit.setAttribute("r",7); hit.setAttribute("fill","transparent"); g.appendChild(hit); }
    const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",x); c.setAttribute("cy",y); c.setAttribute("r",q?3.2:(p===0?10:8)); c.setAttribute("class","note-c");
    g.appendChild(c);
    let t=null;
    if(!q){
      const tx=100+Math.cos(a)*91, ty=100+Math.sin(a)*91+3;
      t=document.createElementNS(NS,"text"); t.setAttribute("x",tx); t.setAttribute("y",ty); t.setAttribute("class","note-t"); g.appendChild(t);
    }
    ringSvg.appendChild(g);
    g.addEventListener("click",()=>toggleNote(p));
    g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault(); toggleNote(p);}});
    ringEls.push({g,c,t});
  }
}
function curScaleKey(){
  if(live){const s=live.eng.secAt(live.ctx.currentTime); return s.key;}
  return S.scales[0]||"mixolydien";
}
function drawRing(){
  const key=curScaleKey(), iv=ivOf(S,key);
  ringEls.forEach((r,p)=>{
    const deg=p/2, on=iv.indexOf(deg)>=0;
    r.c.setAttribute("class","note-c"+(on?" on":"")+(p===0?" root":""));
    if(r.t) r.t.textContent=NOTES[(S.root+deg)%12];
    r.g.setAttribute("aria-label",noteName(deg)+(p%2?" (quart de ton)":"")+(on?", dans la gamme":", hors gamme")+(p===0?", tonique":""));
    r.g.setAttribute("aria-pressed",on?"true":"false");
  });
}
function updateRingCap(){
  const key=curScaleKey(), iv=ivOf(S,key), nm=(SC[key]||SC.mixolydien).n;
  $("ringcap").innerHTML="<strong>"+NOTES[S.root]+" "+nm.toLowerCase()+"</strong><br>"+iv.map(noteName).join(" ")+(typeof affOf==="function"?"<br><em class=\"aff-cap\">"+affOf(key,S.root).scText+"</em>":"");
  drawRing(); if(typeof affUpdate==="function") affUpdate();
}
function flashNote(off,kind){
  const p=Math.round((((off%12)+12)%12)*2)%24, r=ringEls[p]; if(!r) return;
  r.c.classList.add("hit"); setTimeout(()=>r.c.classList.remove("hit"),kind==="canon"?260:380);
}
function toggleNote(p){
  if(typeof JEU!=="undefined"&&JEU.on){ jeuPlayRing(p); return; }
  if(p===0) return;
  if(S.scales[0]!=="libre"){ const base=ivOf(S,S.scales[0]); S.custom=Array.from({length:24},(_,i)=>base.indexOf(i/2)>=0?1:0); S.scales[0]="libre"; }
  else if(S.custom.length<24 && p%2===1){ S.custom=Array.from({length:24},(_,i)=>i%2?0:S.custom[i/2]); }
  if(S.custom.length>=24) S.custom[p]=S.custom[p]?0:1; else S.custom[p/2]=S.custom[p/2]?0:1;
  syncUI(); if(live) replanSoon("all",true);
}
setInterval(()=>{ if(typeof atScaleSync==="function") atScaleSync(); if(live){ const k=curScaleKey(); if(k!==live.lastKey){live.lastKey=k; updateRingCap();} } },500);

/* ---------- construction des contrôles ---------- */
const pct=v=>Math.round(v*100)+" %";
const INST_OPTS=[["luth","Luth"],["harpe","Harpe"],["flute","Flûte"],["carillon","Carillon"],["orgue","Orgue positif"],["roues","Orgue à roues"],["oud","Oud (corde pincée)"],["ney","Ney (flûte soufflée)"],["kalimba","Kalimba"],["bol","Bol chantant"],["verre","Cloches de verre"],["synthe","Synthé doux"],["archet","Archet (violon, viole)"],["cuivre","Cuivre doux"],["guitare","Guitare (acier)"],["piano","Piano de bastringue"],["fmpiano","Piano électrique (FM)"],["fmcloche","Cloches FM"],["accordeon","Accordéon musette"],["voix","Voix (vocalise)"],["sifflet","Sifflet"],["harmonica","Harmonica"],["basse","Basse synthé (grave)"],["atelier","Synthé perso (Atelier)"]];
const DRIFT_OPTS=[["none","Rien"],["filtre","Éclat du bourdon"],["reverb","Réverbération"],["densite","Densité de la mélodie"],["pan","Place de la mélodie (pan)"],["tension","Tension"],["voile","Voile (aigus)"],["grain","Nuage de grains"]];
/* seconde cible d'une dérive : la même liste, dans le même sens puis à l'envers */
const DRIFT2_OPTS=DRIFT_OPTS.concat(DRIFT_OPTS.slice(1).map(([k,l])=>["-"+k,l+", à l'envers"]));
const SCALE_OPTS=SCALE_GROUPS.map(([g,l])=>[g,l.map(([k,n])=>[k,n])]);
const UI=[
 {num:"I", title:"Gamme et accord", fr:"", sub:"Tonique, gamme principale, et jusqu'à deux colorations qui se succèdent par sections.", groups:[
  {items:[
   {k:"root",type:"select",label:"Tonalité",opts:NOTES.map((n,i)=>[i,n]),num:true,restart:true},
   {k:"scales.0",type:"select",label:"Gamme principale",groups:SCALE_OPTS,restart:false,ring:true},
   {k:"scales.1",type:"select",label:"Puis (facultatif)",groups:SCALE_OPTS,blank:"Aucune",ring:true},
   {k:"scales.2",type:"select",label:"Puis encore (facultatif)",groups:SCALE_OPTS,blank:"Aucune",ring:true},
   {k:"sectionBars",type:"range",label:"Durée d'une section",min:4,max:64,step:4,fmt:v=>v+" mesures"}]},
  {fin:"Accord et tempérament", items:[
   {k:"temper",type:"select",label:"Tempérament",opts:[["egal","Égal"],["juste","Juste (intonation pure)"],["pyth","Pythagoricien"],["meso","Mésotonique (quart de comma)"],["werck","Werckmeister III"],["kirn","Kirnberger III"]],restart:true},
   {k:"a4",type:"range",label:"Diapason (La)",min:410,max:450,step:1,fmt:v=>v+" Hz",restart:true}]}]},
 {num:"II", title:"Rythme", fr:"", sub:"Une grille de croches commune à la mélodie, aux nappes et aux frappes.", groups:[
  {items:[
   {k:"tempo",type:"range",label:"Tempo",min:40,max:180,step:1,fmt:v=>v+" bpm",restart:true},
   {k:"meter",type:"select",label:"Mesure",opts:Object.keys(METERS).map(k=>[k,k]),restart:true},
   {k:"swing",type:"range",label:"Swing",min:0,max:1,step:0.01,fmt:pct},
   {k:"perc.lvl",type:"range",label:"Percussion",min:0,max:1,step:0.01,fmt:pct},
   {k:"perc.kit",type:"select",label:"Batterie",opts:[["cadre","Tambour sur cadre"],["caisse","Grosse caisse et caisse claire"],["taiko","Grand tambour, bâton, claquoir"],["darbouka","Darbouka et riqq"],["bastringue","Balais, botte et tambourin"],["electro","Boîte à rythmes"]]}]},
  {fin:"Réglages de la percussion", items:[
   {k:"perc.shaker",type:"range",label:"Densité du shaker",min:0,max:1,step:0.01,fmt:pct},
   {k:"perc.ghost",type:"range",label:"Frappes fantômes",min:0,max:1,step:0.01,fmt:pct},
   {k:"perc.eucl",type:"range",label:"Rythme euclidien",min:0,max:1,step:0.01,fmt:pct,hint:"Une couche de frappes légères réparties au plus juste sur les doubles croches (rythme euclidien). Leur nombre et leur décalage changent à chaque section."}]}]},
 {num:"III", title:"Bourdon", fr:"", sub:"Sous-grave, tonique, quinte, octaves. La quinte glisse vers un degré voisin de la gamme.", groups:[
  {items:[
   {k:"drone.lvl",type:"range",label:"Niveau",min:0,max:1,step:0.01,fmt:pct},
   {k:"drone.timbre",type:"select",label:"Timbre",opts:[["anche","Anche (cornemuse)"],["orgue","Orgue de chambre"],["choeur","Chœur (voyelles)"],["bol","Bol chantant"],["machine","Machine à cordes"],["pur","Sinus pur"]],restart:true},
   {k:"drone.bright",type:"range",label:"Éclat",min:0,max:1,step:0.01,fmt:pct,restart:true},
   {k:"drone.glide",type:"range",label:"Quinte mobile",min:0,max:1,step:0.01,fmt:pct}]},
  {fin:"Réglages du bourdon", items:[
   {k:"drone.width",type:"range",label:"Largeur (désaccord)",min:0,max:1,step:0.01,fmt:pct,restart:true},
   {k:"drone.drift",type:"range",label:"Dérive",min:0,max:1,step:0.01,fmt:pct,restart:true}]}]},
 {num:"IV", title:"Voix", fr:"", sub:"Mélodie, canon décalé et nappes d'accords construits sur la gamme de la section.", groups:[
  {h:"Logique musicale", hf:"logique musicale et timbres", items:[
   {k:"mus.logic",type:"select",label:"Logique musicale",opts:[["modal","Modale : la mélodie suit les accords"],["hasard","Hasard (ancienne version)"]]},
   {k:"mus.form",type:"select",label:"Forme de la pièce",opts:[["libre","Libre : phrases et déjà-vu"],["passacaille","Passacaille : une basse qui revient, des variations dessus"],["ostinato","Ostinato : un motif qui tourne"],["rondeau","Rondeau : refrain et couplets"],["variations","Thème et variations"],["turing","Machine de Turing : un registre qui boucle et mute"]]},
   {k:"mus.color",type:"select",label:"Couleur du mode",opts:[["off","Fixe : les gammes choisies"],["tension","Suit la tension (du lydien au locrien)"],["meteo","Suit la météo du lieu"],["les deux","Tension et météo"]]},
   {k:"mus.harm",type:"select",label:"Harmonie",opts:[["idiome","Idiomatique : les progressions typiques de chaque mode"],["libre","Libre : accords pondérés par le mode"]]},
   {k:"mus.arc",type:"select",label:"Plan de la pièce",opts:[["aucun","Aucun : des sections égales"],["arche","Arche : intro, thème, développement, apogée, retombée, coda"]]},
   {k:"mus.crit",type:"range",label:"Exigence : la machine tire plusieurs phrases et garde la meilleure",min:0,max:1,step:0.01,fmt:pct},
   {k:"mus.model",type:"select",label:"Cordes et timbres",opts:[["physique","Cordes pincées par modèle physique"],["classique","Synthèse classique"]]}]},
  {h:"Caractère de la mélodie", hf:"", items:[
   {k:"car.grav",type:"range",label:"Gravité : retour vers la tonique",min:0,max:1,step:0.01,fmt:pct},
   {k:"car.aud",type:"range",label:"Audace : taille des sauts",min:0,max:1,step:0.01,fmt:pct},
   {k:"car.orn",type:"range",label:"Ornements : appoggiatures et trilles",min:0,max:1,step:0.01,fmt:pct},
   {k:"car.sil",type:"range",label:"Silences : souffles entre les notes et les phrases",min:0,max:1,step:0.01,fmt:pct},
   {k:"car.rep",type:"range",label:"Répétition : retour des phrases déjà jouées",min:0,max:1,step:0.01,fmt:pct}]},
  {h:"Chance", hf:"", items:[
   {k:"chance.skip",type:"range",label:"Notes manquantes",min:0,max:1,step:0.01,fmt:pct},
   {k:"chance.ratchet",type:"range",label:"Roulements : une note répétée vite",min:0,max:1,step:0.01,fmt:pct},
   {k:"chance.mutate",type:"range",label:"Mutations : une note change de degré",min:0,max:1,step:0.01,fmt:pct},
   {k:"chance.octave",type:"range",label:"Sauts d'octave imprévus",min:0,max:1,step:0.01,fmt:pct},
   {k:"chance.rest",type:"range",label:"Silences imprévus entre les phrases",min:0,max:1,step:0.01,fmt:pct},
   {k:"turing.lock",type:"range",label:"Verrou du registre (forme Turing) : 100 % boucle, 0 % tout change",min:0,max:1,step:0.01,fmt:pct},
   {k:"turing.len",type:"select",label:"Longueur du registre",opts:[[1,"1 mesure"],[2,"2 mesures"],[4,"4 mesures"]],num:true},
   {k:"turing.rate",type:"select",label:"Pas du registre",opts:[[1,"Croche"],[2,"Noire"]],num:true}]},
  {h:"Mélodie", hf:"", items:[
   {k:"mel.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"mel.lpg",type:"range",label:"Porte passe-bas",min:0,max:1,step:0.01,fmt:pct,hint:"Sur les sons pincés et frappés (luth, harpe, oud, guitare, kalimba, carillon, verre, bol, piano) : le filtre se referme avec le son, qui devient boisé et rond. Vaut pour la mélodie, le canon, les boucles et les pendules."},
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
   {k:"canon.shift",type:"select",label:"Transposition",opts:[["uni","Unisson"],["oct+","Octave au-dessus"],["oct-","Octave en dessous"],["q+","Quinte au-dessus"],["q-","Quinte en dessous"],["t+","Tierce au-dessus"],["contre","Contrepoint : tierces et sixtes en mouvement contraire"]]}]},
  {h:"Nappes", hf:"", items:[
   {k:"pad.lvl",type:"range",label:"Niveau",min:0,max:1,step:0.01,fmt:pct},
   {k:"pad.timbre",type:"select",label:"Timbre",opts:[["choeur","Chœur"],["cordes","Cordes"],["orgue","Orgue"],["synthe","Synthé doux"],["verre","Verre"],["grattee","Guitare grattée"],["machine","Machine à cordes"],["roues","Orgue à roues"],["vecteur","Vectorielle (timbres qui tournent)"],["essaim","Essaim de scies"],["phase","Distorsion de phase"],["atelier","Synthé perso (Atelier)"]]},
   {k:"pad.len",type:"range",label:"Durée d'un accord",min:1,max:8,step:1,fmt:v=>v+(v>1?" mesures":" mesure")},
   {k:"pad.motion",type:"range",label:"Mouvement harmonique",min:0,max:1,step:0.01,fmt:pct},
   {k:"pad.voices",type:"range",label:"Voix par accord",min:2,max:4,step:1,fmt:v=>v+" voix"},
   {k:"pad.stag",type:"range",label:"Entrées décalées",min:0,max:1,step:0.01,fmt:pct},
   {k:"pad.bass",type:"range",label:"Basse",min:0,max:1,step:0.01,fmt:pct}]},
  {fin:"Arpège", items:[
   {k:"arp.lvl",type:"range",label:"Arpège",min:0,max:1,step:0.01,fmt:pct,hint:"L'accord en cours, égrené note à note : l'accompagnement typique du dungeon synth et des musiques de jeu."},
   {k:"arp.inst",type:"select",label:"Instrument de l'arpège",opts:INST_OPTS},
   {k:"arp.pat",type:"select",label:"Motif",opts:[["vaetvient","Va-et-vient"],["montant","Montant"],["alberti","Alberti (grave, aigu, milieu, aigu)"]]},
   {k:"arp.rate",type:"select",num:true,label:"Vitesse",opts:[["0.5","Noires"],["1","Croches"],["2","Doubles croches"]]},
   {k:"arp.reg",type:"range",label:"Registre de l'arpège",min:0,max:2,step:1,fmt:v=>["grave","médium","aigu"][v]},
   {k:"arp.span",type:"range",label:"Étendue de l'arpège",min:1,max:2,step:1,fmt:v=>v+" octave"+(v>1?"s":"")}]},
  {fin:"Mémoire : déjà-vu de la mélodie et des nappes", items:[
   {k:"mel.deja",type:"range",label:"Mélodie : retour du passé",min:0,max:1,step:0.01,fmt:v=>v<0.01?"jamais":pct(v)},
   {k:"mel.loop",type:"range",label:"Mélodie : longueur de la boucle",min:1,max:8,step:1,fmt:v=>v+(v>1?" phrases":" phrase")},
   {k:"pad.deja",type:"range",label:"Nappes : retour du passé",min:0,max:1,step:0.01,fmt:v=>v<0.01?"jamais":pct(v)},
   {k:"pad.loop",type:"range",label:"Nappes : longueur de la boucle",min:1,max:8,step:1,fmt:v=>v+(v>1?" accords":" accord")}]}]},
 {num:"V", title:"Lieu", fr:"", sub:"La salle autour de la musique : de la taverne bruyante à la crypte qui goutte.", groups:[
  {items:[
   {k:"amb.murmur",type:"range",label:"Murmure de salle",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.clink",type:"range",label:"Tintements de verres",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.feu",type:"range",label:"Feu de cheminée",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.vent",type:"range",label:"Vent",min:0,max:1,step:0.01,fmt:pct},
   {k:"amb.gouttes",type:"range",label:"Gouttes (crypte)",min:0,max:1,step:0.01,fmt:pct}]},
  {h:"Nature", hf:"sons de nature", items:[
   {k:"nature.pluie",type:"range",label:"Pluie",min:0,max:1,step:0.01,fmt:pct},
   {k:"nature.mer",type:"range",label:"Vagues (mer)",min:0,max:1,step:0.01,fmt:pct},
   {k:"nature.nuit",type:"range",label:"Nuit (grillons)",min:0,max:1,step:0.01,fmt:pct},
   {k:"nature.ruisseau",type:"range",label:"Ruisseau",min:0,max:1,step:0.01,fmt:pct},
   {k:"nature.oiseaux",type:"range",label:"Oiseaux",min:0,max:1,step:0.01,fmt:pct}]}]},
 {num:"VI", title:"Espace et patine", fr:"", sub:"Réverbération, écho et le grain d'une vieille bande.", groups:[
  {h:"Espace", hf:"", items:[
   {k:"vol",type:"range",label:"Volume général (l'export est toujours normalisé)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.rev",type:"range",label:"Réverb",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.size",type:"range",label:"Taille de la salle",min:0.5,max:9,step:0.1,fmt:v=>v.toFixed(1)+" s",reverb:true},
   {k:"fx.dark",type:"range",label:"Ombre (réverb sourde)",min:0,max:1,step:0.01,fmt:pct,reverb:true},
   {k:"fx.room",type:"select",label:"Acoustique du lieu",opts:[["gen","Générique"],["chapelle","Chapelle de pierre"],["salle","Salle de bois"],["grotte","Grotte"],["plaque","Plaque métallique"]],reverb:true},
   {k:"fx.algo",type:"select",label:"Type de réverbération",opts:[["vivante","Vivante : la queue bouge et peut scintiller"],["lieu","Lieu : acoustique figée, avec ses premières réflexions"],["plaque","Plaque : la plaque de studio (Dattorro), dense et brillante"],["salle","Salle : la même cuve en plus grand, plus ample"]]},
   {k:"fx.mod",type:"range",label:"Mouvement de la queue (réverb vivante)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.shim",type:"range",label:"Scintillement : la queue remonte d'une octave",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.dly",type:"range",label:"Écho",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.dlyDiv",type:"select",label:"Valeur de l'écho",opts:[[1.5,"Croche pointée"],[2,"Noire"],[3,"Noire pointée"]],num:true},
   {k:"fx.fb",type:"range",label:"Répétitions de l'écho",min:0,max:0.9,step:0.01,fmt:pct}]},
  {h:"Grain", hf:"nuage de grains et gel", items:[
   {k:"grain.mix",type:"range",label:"Nuage (0 = absent)",min:0,max:1,step:0.01,fmt:pct},
   {k:"grain.src",type:"select",label:"Ce qui est mis en grains",opts:[["mel","Mélodie et canon"],["pad","Nappes"],["cycles","Boucles et pendules"],["tout","Tout cela"]]},
   {k:"grain.dens",type:"range",label:"Densité des grains",min:0,max:1,step:0.01,fmt:pct},
   {k:"grain.size",type:"range",label:"Taille des grains",min:0,max:1,step:0.01,fmt:v=>Math.round(40+560*v*v)+" ms"},
   {k:"grain.spread",type:"range",label:"Mémoire : jusqu'où les grains remontent dans le passé",min:0,max:1,step:0.01,fmt:v=>(0.03+6.2*v*v).toFixed(1)+" s"},
   {k:"grain.pitch",type:"range",label:"Grains à l'octave ou à la quinte",min:0,max:1,step:0.01,fmt:pct}]},
  {h:"Patine", hf:"patine de bande", items:[
   {k:"fx.sat",type:"range",label:"Saturation",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.wow",type:"range",label:"Ondulation (wow et flutter)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.veil",type:"range",label:"Voile (aigus assourdis)",min:0,max:1,step:0.01,fmt:pct},
   {k:"fx.hiss",type:"range",label:"Souffle",min:0,max:1,step:0.01,fmt:pct}]}]},
 {num:"VII", title:"Évolution", fr:"", sub:"La pièce respire : l'intensité module la percussion, les nappes, l'éclat du bourdon et la densité.", groups:[
  {items:[
   {k:"form.shape",type:"select",label:"Forme",opts:[["constante","Constante"],["arche","Arche"],["vagues","Vagues"],["escalier","Escalier"]]},
   {k:"form.period",type:"range",label:"Période",min:1,max:10,step:0.5,fmt:v=>v+" min"},
   {k:"form.amount",type:"range",label:"Amplitude",min:0,max:1,step:0.01,fmt:pct},
   {k:"form.breath",type:"range",label:"Respirations",min:0,max:1,step:0.01,fmt:pct,hint:"Part des sections où une voix (nappes, percussion, boucles ou pendules) se retire puis revient à mi-section, pour que l'ambiance ne paraisse jamais plate."}]},
  {h:"Tension", hf:"courbe de tension", items:[
   {k:"curve.mode",type:"select",label:"Courbe",opts:[["off","Désactivée"],["loop","Répétée"],["once","Une fois, puis elle tient"]]},
   {k:"curve.dur",type:"range",label:"Durée de la courbe",min:1,max:20,step:1,fmt:v=>v+(v>1?" minutes":" minute")}], node:()=>curveEditor()},
  {h:"Adaptation", hf:"selon l'heure ou la durée d'écoute", items:[
   {k:"adapt.mode",type:"select",label:"Adaptation",opts:[["off","Aucune"],["heure","Selon l'heure de la journée"],["meteo","Selon l'heure et la météo du lieu"],["apaiser","S'apaiser avec la durée d'écoute"]]},
   {k:"adapt.amount",type:"range",label:"Force de l'adaptation",min:0,max:1,step:0.01,fmt:pct},
   {k:"adapt.span",type:"range",label:"Durée de l'apaisement",min:10,max:120,step:5,fmt:v=>v+" minutes"}], node:()=>{ const w=document.createElement("div"); w.appendChild(adaptNote()); w.appendChild(wxPanel()); return w; }},
  {h:"Liens", hf:"les voix agissent les unes sur les autres", items:[
   {k:"link.melPad",type:"range",label:"La mélodie ouvre le filtre des nappes",min:0,max:1,step:0.01,fmt:v=>v<0.01?"aucun":pct(v)}]},
  {h:"Dérives", hf:"marches aléatoires, sans graine", items:[
   {k:"drift.0.t",type:"select",label:"Dérive 1 : ce qu'elle promène",opts:DRIFT_OPTS},
   {k:"drift.0.t2",type:"select",label:"Dérive 1 : et aussi",opts:DRIFT2_OPTS},
   {k:"drift.0.d",type:"range",label:"Dérive 1 : profondeur",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.0.v",type:"range",label:"Dérive 1 : vitesse",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.1.t",type:"select",label:"Dérive 2 : ce qu'elle promène",opts:DRIFT_OPTS},
   {k:"drift.1.t2",type:"select",label:"Dérive 2 : et aussi",opts:DRIFT2_OPTS},
   {k:"drift.1.d",type:"range",label:"Dérive 2 : profondeur",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.1.v",type:"range",label:"Dérive 2 : vitesse",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.2.t",type:"select",label:"Dérive 3 : ce qu'elle promène",opts:DRIFT_OPTS},
   {k:"drift.2.t2",type:"select",label:"Dérive 3 : et aussi",opts:DRIFT2_OPTS},
   {k:"drift.2.d",type:"range",label:"Dérive 3 : profondeur",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.2.v",type:"range",label:"Dérive 3 : vitesse",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.3.t",type:"select",label:"Dérive 4 : ce qu'elle promène",opts:DRIFT_OPTS},
   {k:"drift.3.t2",type:"select",label:"Dérive 4 : et aussi",opts:DRIFT2_OPTS},
   {k:"drift.3.d",type:"range",label:"Dérive 4 : profondeur",min:0,max:1,step:0.01,fmt:pct},
   {k:"drift.3.v",type:"range",label:"Dérive 4 : vitesse",min:0,max:1,step:0.01,fmt:pct}]}]},
 {num:"VIII", title:"Boucles et pendules", fr:"", sub:"Deux machines à hasard réglé : des boucles de bande de longueurs premières entre elles, et des pendules qui se désynchronisent puis se retrouvent.", groups:[
  {h:"Boucles de bande", hf:"", items:[
   {k:"loops.lvl",type:"range",label:"Niveau (0 = absentes)",min:0,max:1,step:0.01,fmt:pct},
   {k:"loops.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"loops.count",type:"range",label:"Nombre de boucles",min:1,max:5,step:1,fmt:v=>v+(v>1?" boucles":" boucle")},
   {k:"loops.speed",type:"range",label:"Durée des boucles",min:0.6,max:2,step:0.05,fmt:v=>"× "+v.toFixed(2)}]},
  {h:"Pendules", hf:"", items:[
   {k:"pend.lvl",type:"range",label:"Niveau (0 = absents)",min:0,max:1,step:0.01,fmt:pct},
   {k:"pend.inst",type:"select",label:"Instrument",opts:INST_OPTS},
   {k:"pend.count",type:"range",label:"Nombre de pendules",min:3,max:10,step:1,fmt:v=>v+" pendules"},
   {k:"pend.period",type:"range",label:"Période de resynchronisation",min:8,max:48,step:2,fmt:v=>v+" mesures"}]}]}
];

const CTL=[];
function mkCtl(it){
  const wrap=document.createElement("div"); wrap.className="ctl";
  const id="c_"+it.k.replace(/\./g,"_");
  const row=document.createElement("div"); row.className="l";
  /* un libellé long se coupe : le nom reste court, l'explication passe dans une aide qu'on déplie avec « ? » */
  let name=it.label, help=it.hint||"";
  if(!help){ const m=name.match(/^(.{4,44}?) : (.+)$/)||(name.length>40&&name.match(/^(.{4,44}?) \((.+)\)$/)); if(m&&!/^(Mélodie|Nappes|Dérive \d)$/.test(m[1])){ name=m[1]; help=m[2].charAt(0).toUpperCase()+m[2].slice(1)+"."; } }
  const lab=document.createElement("label"); lab.htmlFor=id; lab.textContent=name; row.appendChild(lab);
  let hp=null;
  if(help){ hp=document.createElement("p"); hp.className="hint"; hp.id=id+"_h"; hp.hidden=true; hp.textContent=help;
    const hb=document.createElement("button"); hb.type="button"; hb.className="help"; hb.textContent="?"; hb.title="Explication"; hb.setAttribute("aria-label","Explication : "+name); hb.setAttribute("aria-expanded","false"); hb.setAttribute("aria-controls",hp.id);
    hb.onclick=()=>{ hp.hidden=!hp.hidden; hb.setAttribute("aria-expanded",hp.hidden?"false":"true"); }; lab.after(hb); }
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
  el.id=id; wrap.appendChild(row); wrap.appendChild(el); if(hp) wrap.appendChild(hp);
  const entry={it,el,out};
  const upd=()=>{ if(out) out.textContent=it.fmt(parseFloat(el.value)); };
  if(it.type==="range"){
    el.addEventListener("input",()=>{ const prev=getP(it.k), v=parseFloat(el.value); setP(it.k,v); upd(); if(it.k==="tension") releaseCurve(); paramChanged(it.k,prev,v,false,it.restart); if(it.k==="tempo"||it.k==="meter") updateTempo(); });
    el.addEventListener("change",()=>{ if(it.reverb&&live) live.eng.setReverb(); if(it.restart) restartIfLive(); else if(live){ const w=replanTarget(it.k,-1,parseFloat(el.value)); if(w&&!(it.k in GAIN_ONLY)) replanSoon(w,true); } });
  }else{
    el.addEventListener("change",()=>{ const prev=getP(it.k), v=it.num?parseFloat(el.value):el.value; setP(it.k,v); paramChanged(it.k,prev,v,true,it.restart); if(it.reverb&&live) live.eng.setReverb(); if(it.restart) restartIfLive(); if(it.ring||it.k==="root") updateRingCap(); if(it.k==="tempo"||it.k==="meter") updateTempo(); });
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
/* chapitres repliables : on les ouvre ou on les ferme, le choix est mémorisé */
const FOLD_KEY="bourdon.chapitres";
function foldChapters(){
  const host=$("chapters"); let open=[]; try{ const j=JSON.parse(localStorage.getItem(FOLD_KEY)); if(Array.isArray(j)) open=j; }catch(e){}
  const save=()=>{ try{ localStorage.setItem(FOLD_KEY,JSON.stringify([...host.querySelectorAll(".chap[open]")].map(d=>d.id))); }catch(e){} };
  [...host.querySelectorAll(":scope > section.chap")].forEach(sec=>{
    const d=document.createElement("details"); d.className="chap"; d.id=sec.id; d.open=open.indexOf(sec.id)>=0;
    const sm=document.createElement("summary"), hd=sec.querySelector(":scope > header"); sm.appendChild(hd); d.appendChild(sm);
    while(sec.firstChild) d.appendChild(sec.firstChild);
    d.addEventListener("toggle",save); host.replaceChild(d,sec);
  });
}
/* table des matières collée en haut : numéros romains et titres latins */
function buildToc(){
  const nav=$("toc"), secs=[...document.querySelectorAll("#chapters .chap")], links=new Map();
  secs.forEach(sec=>{
    const a=document.createElement("a"); a.href="#"+sec.id; a.innerHTML='<span class="n">'+sec.querySelector(".num").textContent+'</span>'+sec.querySelector("h2").textContent;
    a.onclick=e=>{ e.preventDefault(); sec.open=true; sec.scrollIntoView(); }; nav.appendChild(a); links.set(sec,a);
  });
  const mark=sec=>{ links.forEach((a,s)=>{ if(s===sec){ a.setAttribute("aria-current","true"); const l=a.offsetLeft-nav.clientWidth/2+a.clientWidth/2; if(nav.scrollWidth>nav.clientWidth) nav.scrollTo({left:l}); } else a.removeAttribute("aria-current"); }); };
  if("IntersectionObserver" in window){
    
    const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting) mark(e.target); }); },{rootMargin:"-15% 0px -75% 0px"});
    secs.forEach(s=>io.observe(s));
  }
}
function buildChapters(){
  const host=$("chapters");
  $("tensionHost").appendChild(mkCtl({k:"tension",type:"range",label:"Tension",min:0,max:1,step:0.01,fmt:tensionWord}));
  wireDockTension();
  UI.forEach(ch=>{
    const sec=document.createElement("section"); sec.className="chap";
    const hd=document.createElement("header");
    hd.innerHTML='<span class="num">'+ch.num+'</span><div><h2>'+ch.title+'</h2><p class="sub">'+(ch.fr?'<span class="fr">'+ch.fr+'</span> ':'')+ch.sub+'</p></div>'; sec.id="ch-"+ch.num;
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
  buildExport(host);
  foldChapters();
  buildToc();
}
function syncUI(){
  CTL.forEach(({it,el,upd,sync2})=>{ el.value=String(getP(it.k)); if(el.tagName==="SELECT"&&el.value!==String(getP(it.k))){ el.value=""; } upd(); if(sync2) sync2(); });
  updateTempo(); updateRingCap(); if(typeof curveDraw==="function") curveDraw(); if(typeof jeuSync==="function") jeuSync(); if(typeof atelierSync==="function") atelierSync();
}
function updateTempo(){ $("tempoNum").textContent=S.tempo; $("tempoCap").textContent="noires par minute · "+S.meter; }

/* préréglages et scènes : chaque changement se fait par fondu enchaîné quand la lecture tourne */
const fadeSec=()=>parseFloat($("fade").value)||4;
/* ce qui joue : nom de l'ambiance, sa phrase, son univers (pour la veillée) */
let SCENE={name:"",gloss:"",univ:""};
function sceneOf(state){ const p=PRESETS.find(x=>x[1]===state); return p?{name:p[0],gloss:p[2],univ:p[3]}:null; }
function loadScene(state,btn,fade,info){
  S=merge(clone(DEFAULT),clone(state)); normS(); S.seed=newSeed();
  SCENE=info||sceneOf(state)||{name:"",gloss:"",univ:""};
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
  a.push({n,name:"Scaena "+n+" · "+NOTES[S.root],state:clone(S)}); putScenes(a); drawScenes();
};
$("clearScenes").onclick=()=>{ putScenes([]); drawScenes(); };
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
