"use strict";
/* ============================================================
   ATELIER : l'interface du synthétiseur perso (aperçus, boutons, matrice, clavier, patches)
   ============================================================ */
let MODE="reglage";
const AT={built:false, oct:0, hold:false, latch:[], notes:new Map(), drawQ:0, dirty:false, userKey:"bourdon.synpatches"};

const synGet=p=>p.split(".").reduce((a,k)=>a[k],S.syn);
function synSet(p,v){ const ks=p.split("."), l=ks.pop(); ks.reduce((a,k)=>a[k],S.syn)[l]=v; }

/* un bouton relié à un paramètre du synthé, avec sa plage réelle (linéaire ou logarithmique) */
function synKnob(path,label,min,max,o){
  o=o||{};
  const real=n=>{ let v=o.log?min*Math.pow(max/min,n):min+(max-min)*n; if(o.step) v=Math.round(v/o.step)*o.step; return v; };
  const norm=v=>o.log?Math.log(Math.max(min,v)/min)/Math.log(max/min):(v-min)/(max-min);
  return {id:"syn."+path, label, keys:[], get:()=>Math.max(0,Math.min(1,norm(synGet(path)))), set:n=>{ synSet(path,real(n)); atDirty(); }, fmt:n=>(o.fmt||(v=>v.toFixed(2)))(real(n))};
}
const fmtHz=v=>v>=1000?(v/1000).toFixed(1)+" kHz":Math.round(v)+" Hz";
const fmtS=v=>v<1?Math.round(v*1000)+" ms":v.toFixed(1)+" s";
const fmtC=v=>(v>0?"+":"")+Math.round(v)+" ¢";
const fmtP=v=>Math.round(v*100)+" %";
const octOpts=[-2,-1,0,1,2].map(v=>[v,(v>0?"+":"")+v+(Math.abs(v)>1?" octaves":" octave")]);
const semiOpts=[-24,-12,-7,-5,0,5,7,12,19,24].map(v=>[v,(v>0?"+":"")+v+" demi-tons"]);
const uniOpts=[1,2,3,4,5,7].map(v=>[v,v===1?"1 voix":v+" voix"]);
const shapeOpts=[["sine","Sinus"],["triangle","Triangle"],["sawtooth","Dent de scie"],["square","Carré"]];

function atEl(tag,cls,html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }
function atMod(title,fr){ const m=atEl("section","at-mod"); m.appendChild(atEl("h3","",title+(fr?'<span class="fr">'+fr+'</span>':""))); return m; }
function atKnobs(list){ const row=atEl("div","at-knobs"); list.forEach(sp=>row.appendChild(makeKnob(sp))); return row; }
function atFields(items){ const f=atEl("div","fields"); items.forEach(it=>f.appendChild(mkCtl(it))); return f; }
const AT_LABELS={atWA:"Forme d'onde de l'oscillateur A",atWB:"Forme d'onde de l'oscillateur B",atFil:"Courbe de réponse du filtre",atEA:"Enveloppe de volume",atEF:"Enveloppe du filtre",atE2:"Enveloppe 2"};
function atCanvas(id,h){ const c=atEl("canvas","at-cv"); c.id=id; c.style.height=(h||64)+"px"; c.setAttribute("role","img"); c.setAttribute("aria-label",AT_LABELS[id]||"Aperçu"); return c; }

/* ---------- aperçus ---------- */
function fit(cv){
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1), W=Math.round(r.width), H=Math.round(r.height); if(!W||!H) return null;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
  const cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
  return {c,W,H,ink:v("--ink")||"#3a2e22",ink2:v("--ink-2")||"#6b5a46",rub:v("--rubric")||"#a3301c",rule:v("--rule")||"#b8a888"};
}
function waveShape(p,N){
  const x=Math.max(0,Math.min(1,p))*(SYN_BASE.length-1), i=Math.min(SYN_BASE.length-2,Math.floor(x)), f=x-i, out=new Float32Array(N); let mx=0;
  for(let n=0;n<N;n++){ const th=n/N*2*Math.PI; let y=0; for(let h=1;h<=SYN_N;h++){ const a=SYN_BASE[i][1][h]*(1-f)+SYN_BASE[i+1][1][h]*f; if(a) y+=a*Math.sin(h*th); } out[n]=y; if(Math.abs(y)>mx) mx=Math.abs(y); }
  for(let n=0;n<N;n++) out[n]/=(mx||1); return out;
}
function drawWave(id,key){
  const cv=$(id); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, sh=waveShape(S.syn[key].wave,160);
  c.strokeStyle=g.rule; c.lineWidth=1; c.beginPath(); c.moveTo(0,H/2+0.5); c.lineTo(W,H/2+0.5); c.stroke();
  c.strokeStyle=g.rub; c.lineWidth=1.8; c.beginPath(); for(let n=0;n<sh.length;n++){ const x=n/(sh.length-1)*W, y=H/2-sh[n]*(H/2-6); n?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
  const p=S.syn[key].wave*(SYN_WAVES.length-1), nm=SYN_WAVES[Math.round(p)];
  c.fillStyle=g.ink2; c.font='italic 11px "Alegreya", Georgia, serif'; c.fillText(nm,6,H-5);
}
let atOfflineCtx=null;
function drawFilter(){
  const cv=$("atFil"); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, F=S.syn.fil;
  try{
    if(!atOfflineCtx) atOfflineCtx=new OfflineAudioContext(1,1,44100);
    const bq=atOfflineCtx.createBiquadFilter(); bq.type=F.type; bq.frequency.value=Math.min(20000,F.cut); bq.Q.value=F.res;
    const N=140, fr=new Float32Array(N), mag=new Float32Array(N), ph=new Float32Array(N);
    for(let i=0;i<N;i++) fr[i]=20*Math.pow(1000,i/(N-1)); bq.getFrequencyResponse(fr,mag,ph);
    c.strokeStyle=g.rule; c.lineWidth=1; [0,-12,12].forEach(db=>{ const y=H-(db+36)/60*H; c.beginPath(); c.moveTo(0,Math.round(y)+0.5); c.lineTo(W,Math.round(y)+0.5); c.stroke(); });
    c.strokeStyle=g.rub; c.lineWidth=1.8; c.beginPath();
    for(let i=0;i<N;i++){ const db=Math.max(-36,Math.min(24,20*Math.log10(mag[i]||1e-6))), x=i/(N-1)*W, y=H-(db+36)/60*H; i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
    const cx=Math.log(F.cut/20)/Math.log(1000)*W; c.strokeStyle=g.ink2; c.setLineDash([2,3]); c.beginPath(); c.moveTo(cx,0); c.lineTo(cx,H); c.stroke(); c.setLineDash([]);
    c.fillStyle=g.ink2; c.font='italic 11px "Alegreya", Georgia, serif'; c.fillText(fmtHz(F.cut),Math.min(W-52,cx+4),12);
  }catch(e){}
}
function drawEnv(id,key){
  const cv=$(id); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, E=S.syn[key], hold=0.35, tot=E.a+E.d+hold+E.r, px=t=>t/tot*(W-8)+4, py=v=>H-6-v*(H-12);
  c.strokeStyle=g.rule; c.lineWidth=1; c.beginPath(); c.moveTo(0,py(0)+0.5); c.lineTo(W,py(0)+0.5); c.stroke();
  const pts=[[0,0],[E.a,1]]; for(let k=1;k<=10;k++){ const t=E.d*k/10; pts.push([E.a+t,E.s+(1-E.s)*Math.exp(-t/(Math.max(0.01,E.d)/3))]); } pts.push([E.a+E.d+hold,E.s]);
  c.strokeStyle=g.rub; c.lineWidth=1.8; c.beginPath(); pts.forEach(([t,v],i)=>{ i?c.lineTo(px(t),py(v)):c.moveTo(px(t),py(v)); });
  for(let k=1;k<=10;k++){ const t=E.r*k/10; c.lineTo(px(E.a+E.d+hold+t),py(E.s*Math.exp(-t/(Math.max(0.01,E.r)/3)))); } c.stroke();
}
function atDraw(){
  if(!AT.built||MODE!=="atelier") return;
  drawWave("atWA","oscA"); drawWave("atWB","oscB"); drawFilter(); drawEnv("atEA","envA"); drawEnv("atEF","envF"); drawEnv("atE2","env2");
}
function atDirty(){
  const n=$("synPatchName"); if(n&&!n.dataset.dirty){ n.dataset.dirty="1"; n.textContent+=" (modifié)"; }
  if(AT.drawQ) return; AT.drawQ=requestAnimationFrame(()=>{ AT.drawQ=0; atDraw(); });
}

/* ---------- patches ---------- */
function userPatches(){ try{ const a=JSON.parse(localStorage.getItem(AT.userKey)||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function putUserPatches(a){ try{ localStorage.setItem(AT.userKey,JSON.stringify(a)); }catch(e){} }
function setPatchName(n){ const e=$("synPatchName"); if(e){ e.textContent=n; delete e.dataset.dirty; } }
function loadSynPatch(patch,name){
  S.syn=synMerge(SYN_DEFAULT,patch); setPatchName(name||"Patch"); syncUI(); atelierSync();
}
function fillPatchSelect(sel){
  const sl=$("synPatch"); sl.innerHTML="";
  const g1=document.createElement("optgroup"); g1.label="Patches de l'atelier"; SYN_PATCHES.forEach(([n],i)=>{ const o=document.createElement("option"); o.value="f"+i; o.textContent=n; g1.appendChild(o); }); sl.appendChild(g1);
  const up=userPatches(); if(up.length){ const g2=document.createElement("optgroup"); g2.label="Mes patches"; up.forEach((p,i)=>{ const o=document.createElement("option"); o.value="u"+i; o.textContent=p.name; g2.appendChild(o); }); sl.appendChild(g2); }
  if(sel) sl.value=sel;
  const del=$("synDelBtn"); if(del) del.disabled=sl.value[0]!=="u";
}

/* ---------- clavier ---------- */
const PIANO_KEYS=37, BLACK=[1,3,6,8,10];
const NOTE_NAMES=["Do","Do#","Ré","Ré#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"];
const KEYMAP={KeyZ:0,KeyS:1,KeyX:2,KeyD:3,KeyC:4,KeyV:5,KeyG:6,KeyB:7,KeyH:8,KeyN:9,KeyJ:10,KeyM:11,Comma:12,KeyL:13,Period:14,Semicolon:15,Slash:16,
  KeyQ:12,Digit2:13,KeyW:14,Digit3:15,KeyE:16,KeyR:17,Digit5:18,KeyT:19,Digit6:20,KeyY:21,Digit7:22,KeyU:23,KeyI:24,Digit9:25,KeyO:26,Digit0:27,KeyP:28};
const pianoBase=()=>48+12*AT.oct;
function buildPiano(){
  const host=$("piano"); host.innerHTML=""; const base=pianoBase(); let whites=0;
  for(let i=0;i<PIANO_KEYS;i++){
    const midi=base+i, pc=((midi%12)+12)%12, black=BLACK.indexOf(pc)>=0, k=document.createElement("div");
    k.className="pk "+(black?"b":"w"); k.dataset.midi=midi; k.setAttribute("role","button"); k.setAttribute("aria-label",NOTE_NAMES[pc]+(Math.floor(midi/12)-1));
    if(!black){ whites++; if(pc===0) k.innerHTML='<span>'+NOTE_NAMES[pc]+(Math.floor(midi/12)-1)+'</span>'; }
    else k.style.left=((whites)*(100/22))+"%";
    host.appendChild(k);
  }
}
function pkEl(midi){ return document.querySelector('#piano .pk[data-midi="'+midi+'"]'); }
function atOn(id,midi){
  if(AT.notes.has(id)) return;
  if(!live){ atelierStartLive(); }
  if(!live) return;
  const off=midi-36-S.root, h=live.eng.synOn(off,0.7);
  AT.notes.set(id,{h,midi}); const k=pkEl(midi); if(k) k.classList.add("on");
}
function atOff(id){
  const n=AT.notes.get(id); if(!n) return; AT.notes.delete(id);
  const k=pkEl(n.midi); if(k) k.classList.remove("on");
  if(AT.hold) AT.latch.push(n); else n.h.release();
}
function atReleaseAll(){
  AT.notes.forEach((n,id)=>{ n.h.release(); const k=pkEl(n.midi); if(k) k.classList.remove("on"); }); AT.notes.clear();
  AT.latch.forEach(n=>n.h.release()); AT.latch=[]; document.querySelectorAll("#piano .pk.on").forEach(k=>k.classList.remove("on"));
}
function atelierStartLive(){ if(live) return; S.mach=false; atMachUI(); startLive({fade:0.25}); }
function atKeys(e,down){
  if(MODE!=="atelier"||e.ctrlKey||e.metaKey||e.altKey) return;
  const t=e.target, tg=t&&t.tagName; if(tg==="SELECT"||tg==="TEXTAREA"||(tg==="INPUT"&&t.type!=="range"&&t.type!=="checkbox")) return;
  const idx=KEYMAP[e.code]; if(idx===undefined) return;
  e.preventDefault(); if(down&&e.repeat) return;
  const id="k"+e.code; if(down) atOn(id,pianoBase()+idx); else atOff(id);
}

/* ---------- machine ---------- */
function atMachUI(){ const b=$("atMach"); if(!b) return; b.setAttribute("aria-pressed",S.mach!==false?"true":"false"); b.textContent=S.mach!==false?"La machine joue":"La machine est en sourdine"; }
function setMach(on){
  S.mach=on; atMachUI();
  if(live){ live.eng.setLevels(); live.eng.replan("all"); }
}
function atState(){ const h=$("atHint"); if(h) h.textContent=live?"Joue au clavier de l'ordinateur (Z, S, X, D, C… et Q, 2, W, 3, E…) ou touche le clavier ci-dessous.":"Touche une note ou une touche du clavier : l'atelier démarre, machine en sourdine."; atMachUI(); }

/* ---------- construction ---------- */
function buildAtelier(){
  const host=document.querySelector(".folio"), sec=atEl("section","atelier"); sec.id="atelier"; sec.hidden=true; sec.setAttribute("aria-label","Atelier de synthèse");
  /* barre du haut */
  const bar=atEl("div","at-bar");
  bar.innerHTML='<div class="at-title"><span class="kicker">atelier</span><span class="nm" id="synPatchName">Pad doux</span></div>'+
    '<button class="btn" id="atMach" type="button" aria-pressed="true">La machine joue</button>'+
    '<div class="ctl atpatch"><label for="synPatch">Patch</label><select id="synPatch"></select></div>'+
    '<button class="lnk" id="synRandom" type="button">Au sort</button>'+
    '<details class="fin atsave"><summary>Enregistrer ou supprimer</summary><div class="row"><div class="ctl atname"><label for="synName">Nom</label><input type="text" id="synName" maxlength="40" placeholder="Mon patch"></div><button class="lnk" id="synSaveBtn" type="button">Enregistrer sous ce nom</button><button class="lnk" id="synDelBtn" type="button">Supprimer le patch choisi</button></div></details>';
  sec.appendChild(bar);
  sec.appendChild(atEl("p","hint","",)).id="atHint";
  const grid=atEl("div","at-grid"), c1=atEl("div","at-col"), c2=atEl("div","at-col"), c3=atEl("div","at-col");
  /* oscillateurs */
  [["oscA","Sonus A","oscillateur A","atWA",true],["oscB","Sonus B","oscillateur B","atWB",false]].forEach(([k,t,fr,cvid,isA])=>{
    const m=atMod(t,fr); m.appendChild(atCanvas(cvid,58));
    m.appendChild(atKnobs([synKnob(k+".wave","Table",0,1,{fmt:v=>SYN_WAVES[Math.min(SYN_WAVES.length-1,Math.round(v*(SYN_WAVES.length-1)))]}),synKnob(k+".det","Désaccord",-50,50,{fmt:fmtC,step:1}),synKnob(k+".lvl","Niveau",0,1,{fmt:fmtP}),synKnob(k+".spread","Écart",0,40,{fmt:v=>Math.round(v)+" ¢",step:1})]));
    m.appendChild(atFields([{k:"syn."+k+".oct",type:"select",label:"Octave",opts:octOpts,num:true},{k:"syn."+k+".semi",type:"select",label:"Intervalle",opts:semiOpts,num:true},{k:"syn."+k+".uni",type:"select",label:"Unisson",opts:uniOpts,num:true}]));
    c1.appendChild(m);
  });
  const m3=atMod("Additamenta","sous-oscillateur, bruit, FM");
  m3.appendChild(atKnobs([synKnob("sub.lvl","Sous-osc.",0,1,{fmt:fmtP}),synKnob("noise.lvl","Bruit",0,1,{fmt:fmtP}),synKnob("fm.amt","FM",0,1.5,{fmt:v=>v.toFixed(2)}),synKnob("fm.ratio","Rapport FM",0.5,8,{step:0.5,fmt:v=>"× "+v.toFixed(1)})]));
  m3.appendChild(atFields([{k:"syn.sub.shape",type:"select",label:"Forme du sous-oscillateur",opts:[["sine","Sinus"],["square","Carré"]]}]));
  c1.appendChild(m3);
  /* filtre et enveloppes */
  const mf=atMod("Filtrum","filtre"); mf.appendChild(atCanvas("atFil",84));
  mf.appendChild(atKnobs([synKnob("fil.cut","Coupure",40,16000,{log:true,fmt:fmtHz}),synKnob("fil.res","Résonance",0.1,14,{log:true,fmt:v=>v.toFixed(1)}),synKnob("fil.key","Clavier",0,1,{fmt:fmtP}),synKnob("fil.env","Enveloppe",-4800,4800,{fmt:fmtC,step:50})]));
  mf.appendChild(atFields([{k:"syn.fil.type",type:"select",label:"Type de filtre",opts:[["lowpass","Passe-bas"],["highpass","Passe-haut"],["bandpass","Passe-bande"],["notch","Coupe-bande"]]}]));
  c2.appendChild(mf);
  [["envA","volume","atEA"],["envF","filtre","atEF"],["env2","modulation","atE2"]].forEach(([k,t,id])=>{
    const m=atMod("Involucrum",(t==="modulation"?"enveloppe 2, pour la modulation":"enveloppe du "+t)); m.appendChild(atCanvas(id,52));
    m.appendChild(atKnobs([synKnob(k+".a","Attaque",0.002,6,{log:true,fmt:fmtS}),synKnob(k+".d","Déclin",0.01,6,{log:true,fmt:fmtS}),synKnob(k+".s","Maintien",0,1,{fmt:fmtP}),synKnob(k+".r","Relâche",0.01,8,{log:true,fmt:fmtS})]));
    c2.appendChild(m);
  });
  /* LFO, matrice, effets */
  const ml=atMod("Oscillatio","deux LFO");
  ml.appendChild(atKnobs([synKnob("lfo1.rate","LFO 1",0.03,25,{log:true,fmt:v=>v.toFixed(2)+" Hz"}),synKnob("lfo2.rate","LFO 2",0.03,25,{log:true,fmt:v=>v.toFixed(2)+" Hz"})]));
  ml.appendChild(atFields([{k:"syn.lfo1.shape",type:"select",label:"Forme du LFO 1",opts:shapeOpts},{k:"syn.lfo2.shape",type:"select",label:"Forme du LFO 2",opts:shapeOpts}]));
  c3.appendChild(ml);
  const mm=atMod("Modulatio","matrice : une source module un paramètre");
  for(let i=0;i<4;i++){
    const row=atEl("div","at-slot"); row.appendChild(atEl("span","n",String(i+1)));
    const f=atFields([{k:"syn.mod."+i+".src",type:"select",label:"Source",opts:SYN_SRC},{k:"syn.mod."+i+".dst",type:"select",label:"Destination",opts:SYN_DST},{k:"syn.mod."+i+".amt",type:"range",label:"Quantité",min:-1,max:1,step:0.01,fmt:v=>(v>0?"+":"")+Math.round(v*100)+" %"}]);
    row.appendChild(f); mm.appendChild(row);
  }
  c3.appendChild(mm);
  const mx=atMod("Effectus","saturation, niveau, vélocité");
  mx.appendChild(atKnobs([synKnob("fx.drive","Saturation",0,1,{fmt:fmtP}),synKnob("fx.level","Niveau",0.05,4,{log:true,fmt:v=>"× "+v.toFixed(2)}),synKnob("vel.amt","Vélocité",0,1,{fmt:fmtP})]));
  c3.appendChild(mx);
  grid.appendChild(c1); grid.appendChild(c2); grid.appendChild(c3); sec.appendChild(grid);
  /* clavier */
  const kb=atEl("div","at-kb"); kb.innerHTML='<div class="row at-kbbar"><span class="ctl"><label for="atOct">Octave du clavier</label></span><select id="atOct"></select><button class="btn" id="atHold" type="button" aria-pressed="false">Maintien</button><button class="btn" id="atPanic" type="button">Tout couper</button></div><div class="piano" id="piano" aria-label="Clavier"></div>';
  sec.appendChild(kb);
  /* échanger un patch */
  const ex=atEl("details","fin"); ex.innerHTML='<summary>Échanger un patch (texte)</summary><div class="fields"><div class="ctl"><label for="synOut">Ton patch</label><textarea id="synOut" readonly></textarea><div class="row"><button class="lnk" id="synCopy" type="button">Copier</button></div></div><div class="ctl"><label for="synIn">Coller un patch</label><textarea id="synIn" placeholder="Colle ici un patch reçu"></textarea><div class="row"><button class="lnk" id="synLoadTxt" type="button">Charger ce patch</button></div></div></div>';
  sec.appendChild(ex);
  host.insertBefore(sec,document.querySelector(".cols"));
  /* branchements */
  const oc=$("atOct"); [[-1,"Grave (Do2)"],[0,"Médium (Do3)"],[1,"Aigu (Do4)"],[2,"Très aigu (Do5)"]].forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; oc.appendChild(o); }); oc.value=AT.oct; oc.setAttribute("aria-label","Octave du clavier");
  oc.onchange=()=>{ atReleaseAll(); AT.oct=parseInt(oc.value,10); buildPiano(); };
  buildPiano();
  const pk=$("piano"); const target=e=>e.target.closest&&e.target.closest(".pk");
  pk.addEventListener("pointerdown",e=>{ const k=target(e); if(!k) return; e.preventDefault(); try{ k.setPointerCapture(e.pointerId); }catch(x){} atOn("p"+e.pointerId,parseInt(k.dataset.midi,10)); });
  const up=e=>atOff("p"+e.pointerId); pk.addEventListener("pointerup",up); pk.addEventListener("pointercancel",up); pk.addEventListener("lostpointercapture",up);
  document.addEventListener("keydown",e=>atKeys(e,true)); document.addEventListener("keyup",e=>atKeys(e,false));
  $("atHold").onclick=()=>{ AT.hold=!AT.hold; $("atHold").setAttribute("aria-pressed",AT.hold?"true":"false"); if(!AT.hold){ AT.latch.forEach(n=>n.h.release()); AT.latch=[]; document.querySelectorAll("#piano .pk.on").forEach(k=>{ if(![...AT.notes.values()].some(n=>n.midi==k.dataset.midi)) k.classList.remove("on"); }); } };
  $("atPanic").onclick=atReleaseAll;
  $("atMach").onclick=()=>setMach(S.mach===false);
  fillPatchSelect("f0");
  $("synPatch").onchange=()=>{ const v=$("synPatch").value; $("synDelBtn").disabled=v[0]!=="u"; if(v[0]==="f") loadSynPatch(SYN_PATCHES[+v.slice(1)][1],SYN_PATCHES[+v.slice(1)][0]); else{ const p=userPatches()[+v.slice(1)]; if(p) loadSynPatch(p.syn,p.name); } };
  $("synRandom").onclick=()=>{ S.syn=synRandom(Math.random); setPatchName("Patch tiré au sort"); syncUI(); atelierSync(); };
  $("synSaveBtn").onclick=()=>{ const nm=($("synName").value||"").trim()||"Patch "+(userPatches().length+1), a=userPatches(); a.push({name:nm,syn:clone(S.syn)}); putUserPatches(a); fillPatchSelect("u"+(a.length-1)); setPatchName(nm); $("synName").value=""; };
  $("synDelBtn").onclick=()=>{ const v=$("synPatch").value; if(v[0]!=="u") return; const a=userPatches(); a.splice(+v.slice(1),1); putUserPatches(a); fillPatchSelect("f0"); };
  ex.addEventListener("toggle",()=>{ $("synOut").value=JSON.stringify(S.syn); });
  $("synCopy").onclick=async()=>{ $("synOut").value=JSON.stringify(S.syn); try{ await navigator.clipboard.writeText($("synOut").value); }catch(e){ $("synOut").select(); } };
  $("synLoadTxt").onclick=()=>{ try{ const j=JSON.parse($("synIn").value); loadSynPatch(j,"Patch importé"); }catch(e){ $("synIn").value=""; $("synIn").placeholder="Patch illisible"; } };
  sec.addEventListener("input",atDirty); sec.addEventListener("change",atDirty);
  if(window.ResizeObserver) new ResizeObserver(()=>atDraw()).observe(sec);
  AT.built=true; atMachUI();
}
function atelierSync(){
  if(!AT.built) return;
  document.querySelectorAll("#atelier .knob").forEach(el=>paintKnob(el,el._spec));
  atMachUI(); atDraw();
}

/* ---------- modes : réglages, jeu, atelier ---------- */
function setMode(m){
  const old=MODE; MODE=m;
  const jeu=m==="jeu", at=m==="atelier";
  JEU.on=jeu; document.body.classList.toggle("jeu",jeu); document.body.classList.toggle("atelier",at);
  $("jeu").hidden=!jeu; if($("atelier")) $("atelier").hidden=!at;
  const rw=document.querySelector(".ringwrap"); if(rw) (jeu?$("ringSlot"):document.querySelector(".marge")).appendChild(rw);
  $("reglBtn").setAttribute("aria-pressed",(!jeu&&!at)?"true":"false");
  $("jeuBtn").setAttribute("aria-pressed",jeu?"true":"false");
  $("atelierBtn").setAttribute("aria-pressed",at?"true":"false");
  try{ localStorage.setItem("bourdon.mode",m); }catch(e){}
  if(old==="atelier"&&!at) atReleaseAll();
  if(jeu){ jeuSync(); jeuState(); }
  if(at){ atelierSync(); atState(); }
  if(old!==m) window.scrollTo({top:0,behavior:"instant"});
}
function restoreMode(){
  let m="reglage"; try{ m=localStorage.getItem("bourdon.mode")||"reglage"; }catch(e){}
  if(m==="jeu"||m==="atelier") setMode(m);
}
