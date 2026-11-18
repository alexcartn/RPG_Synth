"use strict";
/* ============================================================
   ATELIER : l'interface du synthétiseur perso (aperçus, boutons, matrice, clavier, patches)
   ============================================================ */
let MODE="reglage";
const AT={scope:"osc", scopeSrc:"syn", scopeSpan:1024, sGain:1, raf:0, slices:null, lastOff:undefined, built:false, scale:true, keys:[], sig:"", oct:0, hold:false, latch:[], notes:new Map(), drawQ:0, dirty:false, userKey:"bourdon.synpatches"};

const synGet=p=>p.split(".").reduce((a,k)=>a[k],S.syn);
function synSet(p,v){ const ks=p.split("."), l=ks.pop(); ks.reduce((a,k)=>a[k],S.syn)[l]=v; }

/* un bouton relié à un paramètre du synthé, avec sa plage réelle (linéaire ou logarithmique) */
function synKnob(path,label,min,max,o){
  o=o||{};
  const real=n=>{ let v=o.log?min*Math.pow(max/min,n):min+(max-min)*n; if(o.step) v=Math.round(v/o.step)*o.step; return v; };
  const norm=v=>o.log?Math.log(Math.max(min,v)/min)/Math.log(max/min):(v-min)/(max-min);
  /* path peut être une fonction : le bouton suit alors l'onglet choisi (enveloppe, LFO) */
  const pp=()=>typeof path==="function"?path():path;
  return {id:"syn."+(typeof path==="function"?label:path), label, keys:[], dst:o.dst, norm, real, raw:()=>synGet(pp()), get:()=>Math.max(0,Math.min(1,norm(synGet(pp())))), set:n=>{ synSet(pp(),real(n)); atDirty(); }, fmt:n=>(o.fmt||(v=>v.toFixed(2)))(real(n))};
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
const AT_LABELS={atScope:"Oscilloscope ou spectre du son",atDrawCv:"Forme d'onde dessinée à la main",atWA:"Tables d'ondes de l'oscillateur A en tranches : tire pour changer de table",atWB:"Tables d'ondes de l'oscillateur B en tranches : tire pour changer de table",atFil:"Courbe de réponse du filtre",atEA:"Enveloppe de volume",atEF:"Enveloppe du filtre",atE2:"Enveloppe 2"};
function atCanvas(id,h){ const c=atEl("canvas","at-cv"); c.id=id; c.style.height=(h||64)+"px"; c.setAttribute("role","img"); c.setAttribute("aria-label",AT_LABELS[id]||"Aperçu"); return c; }

/* ---------- aperçus ---------- */
function fit(cv){
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1), W=Math.round(r.width), H=Math.round(r.height); if(!W||!H) return null;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
  const cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
  return {c,W,H,ink:v("--ink")||"#3a2e22",ink2:v("--ink-2")||"#6b5a46",rub:v("--rubric")||"#a3301c",rule:v("--rule")||"#b8a888"};
}
function waveShape(p,N,P){
  const B=synBases(P||S.syn), x=Math.max(0,Math.min(1,p))*(B.length-1), i=Math.min(B.length-2,Math.floor(x)), f=x-i, out=new Float32Array(N); let mx=0;
  for(let n=0;n<N;n++){
    const th=n/N*2*Math.PI; let y=0;
    for(let h=1;h<=SYN_N;h++){ const a=B[i][1][h]*(1-f)+B[i+1][1][h]*f, c=B[i][0][h]*(1-f)+B[i+1][0][h]*f; if(a||c) y+=a*Math.sin(h*th)+c*Math.cos(h*th); }
    out[n]=y; if(Math.abs(y)>mx) mx=Math.abs(y);
  }
  for(let n=0;n<N;n++) out[n]/=(mx||1); return out;
}
/* les treize tables en tranches, de l'avant (Sinus) vers l'arrière (Dessinée) ; la tranche en cours, entre deux tables, est en rouge */
function atSlices(){
  const v=(S.syn.drawV||0)+":"+(S.syn.draw||[]).length;
  if(!AT.slices||AT.slices.v!==v){ const n=SYN_WAVES.length; AT.slices={v,list:Array.from({length:n},(_,j)=>waveShape(j/(n-1),72))}; }
  return AT.slices.list;
}
function drawWave(id,key){
  const cv=$(id); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, n=SYN_WAVES.length, sl=atSlices(), P0=S.syn[key].wave, mv=synLiveMod(key==="oscA"?"wave":"waveb"), P=Math.max(0,Math.min(1,P0+0.5*mv));
  const cs=getComputedStyle(document.documentElement), bg=cs.getPropertyValue("--parch").trim()||"#efe6d2";
  const dx=Math.min(7,(W*0.22)/(n-1)), dy=(H-30)/(n-1), A=Math.max(9,dy*2.6), x0=8, wd=W-16-dx*(n-1), draw=(arr,j,stroke,lw)=>{
    const yb=H-12-j*dy, xo=x0+j*dx; c.beginPath();
    for(let k=0;k<arr.length;k++){ const x=xo+k/(arr.length-1)*wd, y=yb-arr[k]*A*0.5-A*0.15; k?c.lineTo(x,y):c.moveTo(x,y); }
    c.lineTo(xo+wd,yb+3); c.lineTo(xo,yb+3); c.closePath(); c.fillStyle=bg; c.fill(); c.strokeStyle=stroke; c.lineWidth=lw; c.beginPath();
    for(let k=0;k<arr.length;k++){ const x=xo+k/(arr.length-1)*wd, y=yb-arr[k]*A*0.5-A*0.15; k?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
  };
  for(let j=n-1;j>=0;j--) draw(sl[j],j,"rgba(90,70,45,"+(0.28+0.4*(1-j/(n-1)))+")",1);
  if(Math.abs(mv)>0.002) draw(waveShape(P0,72),P0*(n-1),"rgba(163,48,28,0.4)",1.2);
  const pos=P*(n-1); draw(waveShape(P,72),pos,g.rub,2);
  c.fillStyle=g.ink2; c.font='italic 12px "Alegreya", Georgia, serif'; c.fillText(SYN_WAVES[Math.round(pos)],8,13);
}
/* tirer sur la vue 3D change la table */
function atWaveDrag(id,key){
  const cv=$(id); let drag=false;
  const set=e=>{ const r=cv.getBoundingClientRect(); S.syn[key].wave=Math.max(0,Math.min(1,(e.clientX-r.left-8)/(r.width-16))); atelierSync(); atDirty(); if(live) live.eng.setLevels(); };
  cv.addEventListener("pointerdown",e=>{ drag=true; try{ cv.setPointerCapture(e.pointerId); }catch(x){} set(e); e.preventDefault(); });
  cv.addEventListener("pointermove",e=>{ if(drag) set(e); });
  const end=()=>{ drag=false; }; cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
}
/* table dessinée : une période de 64 points */
function drawTabula(){
  const cv=$("atDrawCv"); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, d=S.syn.draw, N=d.length;
  c.strokeStyle=g.rule; c.lineWidth=1; c.beginPath(); c.moveTo(0,H/2+0.5); c.lineTo(W,H/2+0.5); c.stroke();
  c.strokeStyle="rgba(120,100,70,0.22)"; for(let q=1;q<4;q++){ c.beginPath(); c.moveTo(Math.round(W*q/4)+0.5,0); c.lineTo(Math.round(W*q/4)+0.5,H); c.stroke(); }
  c.strokeStyle=g.rub; c.lineWidth=2; c.beginPath(); for(let i=0;i<=N;i++){ const x=i/N*W, y=H/2-d[i%N]*(H/2-8); i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
  c.fillStyle=g.rub; const st=Math.max(4,Math.round(N/64)); for(let i=0;i<N;i+=st){ const x=i/N*W, y=H/2-d[i]*(H/2-8); c.fillRect(x-1.5,y-1.5,3,3); }
}
function atDrawEdit(fn){ fn(S.syn.draw); S.syn.drawV=(S.syn.drawV||0)+1; AT.slices=null; drawTabula(); atDraw(); atDirty(); }
function tabulaEvents(){
  const cv=$("atDrawCv"); let drag=false, last=-1;
  const at=e=>{ const r=cv.getBoundingClientRect(), N=S.syn.draw.length, i=Math.max(0,Math.min(N-1,Math.floor((e.clientX-r.left)/r.width*N))), v=Math.max(-1,Math.min(1,1-2*(e.clientY-r.top)/r.height)); return {i,v}; };
  const put=e=>{ const {i,v}=at(e); atDrawEdit(d=>{ if(last>=0&&Math.abs(i-last)>1){ const a=Math.min(i,last), b=Math.max(i,last), va=d[last], vb=v; for(let k=a;k<=b;k++) d[k]=va+(vb-va)*(k-last)/(i-last); } d[i]=v; }); last=i; };
  cv.addEventListener("pointerdown",e=>{ drag=true; last=-1; try{ cv.setPointerCapture(e.pointerId); }catch(x){} put(e); e.preventDefault(); });
  cv.addEventListener("pointermove",e=>{ if(drag) put(e); });
  const end=()=>{ drag=false; last=-1; }; cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
  const shapes={"atDrSin":th=>Math.sin(th),"atDrSaw":th=>(th/Math.PI)%2-1<-1?0:((th/(2*Math.PI))%1)*2-1,"atDrSq":th=>Math.sin(th)>=0?0.85:-0.85,"atDrRnd":null};
  $("atDrSin").onclick=()=>atDrawEdit(d=>{ for(let i=0;i<d.length;i++) d[i]=Math.sin(i/d.length*2*Math.PI); });
  $("atDrSaw").onclick=()=>atDrawEdit(d=>{ for(let i=0;i<d.length;i++) d[i]=((i/d.length)*2-1)*0.9; });
  $("atDrSq").onclick=()=>atDrawEdit(d=>{ for(let i=0;i<d.length;i++) d[i]=i<d.length/2?0.85:-0.85; });
  $("atDrSmooth").onclick=()=>atDrawEdit(d=>{ const c=d.slice(); for(let i=0;i<d.length;i++) d[i]=(c[(i+d.length-1)%d.length]+2*c[i]+c[(i+1)%d.length])/4; });
  $("atDrRnd").onclick=()=>atDrawEdit(d=>{ const k=[0,1,2,3,4,5,6].map(()=>Math.random()*2-1); for(let i=0;i<d.length;i++){ const th=i/d.length*2*Math.PI; d[i]=k.reduce((a,x,h)=>a+x*Math.sin((h+1)*th+h)/(h+1),0); } });
}
let atOfflineCtx=null;
function drawFilter(){
  const cv=$("atFil"); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, F=S.syn.fil;
  try{
    if(!atOfflineCtx) atOfflineCtx=new OfflineAudioContext(1,1,44100);
    const f24=F.type==="lowpass24"||F.type==="highpass24", bq=atOfflineCtx.createBiquadFilter(); bq.type=f24?F.type.slice(0,-2):F.type; bq.frequency.value=Math.min(20000,F.cut); bq.Q.value=f24?F.res*0.7:F.res;
    const N=140, fr=new Float32Array(N), mag=new Float32Array(N), ph=new Float32Array(N);
    for(let i=0;i<N;i++) fr[i]=20*Math.pow(1000,i/(N-1)); bq.getFrequencyResponse(fr,mag,ph);
    if(f24){ const b2=atOfflineCtx.createBiquadFilter(); b2.type=bq.type; b2.frequency.value=bq.frequency.value; b2.Q.value=0.7; const m2=new Float32Array(N); b2.getFrequencyResponse(fr,m2,new Float32Array(N)); for(let i=0;i<N;i++) mag[i]*=m2[i]; }
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
  if(AT.pane==="fx"){ drawTabula(); return; }
  drawWave("atWA","oscA"); drawWave("atWB","oscB"); drawFilter(); drawEnv("atEnv",AT.env); drawLfo();
}
function atDirty(){
  const n=$("synPatchName"); if(n&&!n.dataset.dirty){ n.dataset.dirty="1"; n.textContent="modifié"; }
  if(AT.drawQ) return; AT.drawQ=requestAnimationFrame(()=>{ AT.drawQ=0; atDraw(); });
}

/* ---------- oscilloscope et spectre ---------- */
function atScopeDraw(){
  const cv=$("atScope"); if(!cv||MODE!=="atelier") return; const g=fit(cv); if(!g) return; const {c,W,H}=g, ro=$("atScopeRead");
  c.strokeStyle="rgba(120,100,70,0.25)"; c.lineWidth=1; c.setLineDash([2,4]);
  [0.25,0.5,0.75].forEach(q=>{ const y=Math.round(H*q)+0.5; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); });
  for(let q=1;q<8;q++){ const x=Math.round(W*q/8)+0.5; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); } c.setLineDash([]);
  const an=live?live.eng.analyser(AT.scopeSrc):null;
  if(!an){ if(ro) ro.textContent=""; return; }
  if(AT.scope==="osc"){
    const N=an.fftSize, buf=AT.sbuf&&AT.sbuf.length===N?AT.sbuf:(AT.sbuf=new Float32Array(N)); an.getFloatTimeDomainData(buf);
    const span=Math.min(AT.scopeSpan,N-2); let t=0; for(let i=1;i<N-span;i++){ if(buf[i-1]<=0&&buf[i]>0){ t=i; break; } }
    let pk=0, all=0; for(let i=0;i<span;i++){ const a=Math.abs(buf[t+i]); if(a>pk) pk=a; } for(let i=0;i<N;i++){ const a=Math.abs(buf[i]); if(a>all) all=a; }
    const target=pk>0.004?Math.min(40,0.85/pk):1; AT.sGain+=(target-AT.sGain)*0.12;
    c.strokeStyle=g.rub; c.lineWidth=1.7; c.lineJoin="round"; c.beginPath();
    for(let i=0;i<span;i++){ const x=i/(span-1)*W, y=H/2-buf[t+i]*AT.sGain*(H/2-10); i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
    if(ro) ro.textContent=all>0.0005?"crête "+(20*Math.log10(all)).toFixed(0)+" dB":"silence";
  }else{
    const n=an.frequencyBinCount, fb=AT.fbuf&&AT.fbuf.length===n?AT.fbuf:(AT.fbuf=new Float32Array(n)); an.getFloatFrequencyData(fb);
    const sr=live.ctx.sampleRate, f0=30, f1=Math.min(18000,sr/2), pts=[];
    for(let x=0;x<=W;x+=2){ const f=f0*Math.pow(f1/f0,x/W), k=Math.max(1,Math.min(n-1,f/(sr/2)*n)), db=fb[Math.floor(k)]; pts.push([x,H-Math.max(0,Math.min(1,(db+95)/80))*(H-14)]); }
    c.beginPath(); c.moveTo(0,H); pts.forEach(([x,y])=>c.lineTo(x,y)); c.lineTo(W,H); c.closePath(); c.fillStyle="rgba(163,48,28,0.14)"; c.fill();
    c.strokeStyle=g.rub; c.lineWidth=1.6; c.beginPath(); pts.forEach(([x,y],i)=>{ i?c.lineTo(x,y):c.moveTo(x,y); }); c.stroke();
    c.fillStyle=g.ink2; c.font='italic 11px "Alegreya", Georgia, serif'; [100,1000,10000].forEach(f=>{ const x=Math.log(f/f0)/Math.log(f1/f0)*W; c.fillText(f>=1000?(f/1000)+" kHz":f+" Hz",x+3,H-4); c.fillRect(Math.round(x),H-10,1,6); });
    let mx=-200; for(let i=1;i<n;i++) if(fb[i]>mx) mx=fb[i]; if(ro) ro.textContent=mx>-150?"pic "+Math.round(mx)+" dB":"silence";
  }
}
function atLoop(){ if(MODE!=="atelier"){ AT.raf=0; return; } atScopeDraw(); atAnim(); AT.raf=requestAnimationFrame(atLoop); }
function atScopeUI(){
  [["atScOsc","osc"],["atScSpec","spec"]].forEach(([id,v])=>{ const b=$(id); if(b) b.setAttribute("aria-pressed",AT.scope===v?"true":"false"); });
  const sp=$("atScSpan"); if(sp) sp.hidden=AT.scope!=="osc";
}

/* ---------- patches ---------- */
function userPatches(){ try{ const a=JSON.parse(localStorage.getItem(AT.userKey)||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function putUserPatches(a){ try{ localStorage.setItem(AT.userKey,JSON.stringify(a)); }catch(e){} }
function setPatchName(n){ const e=$("synPatchName"); if(e){ e.textContent=(n&&$("synPatch")&&[...$("synPatch").options].some(o=>o.selected&&o.textContent===n))?"":n; delete e.dataset.dirty; } }
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
const SC_BOT=["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"], SC_TOP=["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP"], SC_KEYS=22;
const pianoBase=()=>48+12*AT.oct;
/* les touches : soit chromatiques (37), soit toutes dans la gamme du moment (22, une touche par degré) */
function atKeyList(){
  const ks=[];
  if(AT.scale){
    const iv=ivOf(S,curScaleKey()), n=iv.length, base=12+12*AT.oct;
    for(let i=0;i<SC_KEYS;i++){ const off=base+degOff(iv,i), tonic=i%n===0; ks.push({off,black:false,tonic,label:tonic?noteName(iv[0]):""}); }
  }else{
    const base=pianoBase();
    for(let i=0;i<PIANO_KEYS;i++){ const midi=base+i, pc=((midi%12)+12)%12; ks.push({off:midi-36-S.root,black:BLACK.indexOf(pc)>=0,tonic:false,label:pc===0?NOTE_NAMES[0]+(Math.floor(midi/12)-1):"",name:NOTE_NAMES[pc]+(Math.floor(midi/12)-1)}); }
  }
  return ks;
}
function atSig(){ const k=curScaleKey(); return AT.scale?k+"|"+S.root+"|"+ivOf(S,k).join(","):"chrom"; }
function buildPiano(){
  const host=$("piano"); host.innerHTML=""; AT.keys=atKeyList(); AT.sig=atSig(); let whites=0;
  host.classList.toggle("scalemode",!!AT.scale);
  AT.keys.forEach((K,i)=>{
    const k=document.createElement("div");
    k.className="pk "+(K.black?"b":"w")+(K.tonic?" tonic":""); k.dataset.i=i; k.setAttribute("role","button");
    k.setAttribute("aria-label",K.name||(noteName(K.off-12*Math.floor(K.off/12))+(K.tonic?", tonique":"")));
    if(!K.black){ whites++; if(K.label) k.innerHTML='<span>'+K.label+'</span>'; }
    else k.style.left=((whites)*(100/22))+"%";
    host.appendChild(k);
  });
  AT.notes.forEach(n=>{ const k=pkEl(n.i); if(k) k.classList.add("on"); });
}
function pkEl(i){ return document.querySelector('#piano .pk[data-i="'+i+'"]'); }
function atOn(id,i){
  if(AT.notes.has(id)||!AT.keys[i]) return;
  if(!live){ if(MODE==="daw") startLive({fade:0.25}); else atelierStartLive(); }
  if(!live) return;
  AT.lastOnMs=performance.now();
  const off=AT.keys[i].off, mono=S.syn.mono&&S.syn.mono.on, op=mono&&AT.lastOff!==undefined?{fromOff:AT.lastOff,glide:S.syn.mono.glide}:null;
  if(mono){ AT.notes.forEach((n,k)=>{ n.h.release(); const e=pkEl(n.i); if(e) e.classList.remove("on"); }); AT.notes.clear(); }
  const h=MODE==="daw"?dawHand(off,op):live.eng.synOn(off,0.7,op); AT.lastOff=off;
  AT.notes.set(id,{h,i}); const k=pkEl(i); if(k) k.classList.add("on");
  if(MODE==="daw") dawRecOn(id,off);
}
function atOff(id){
  const n=AT.notes.get(id); if(!n) return; AT.notes.delete(id);
  if(MODE==="daw") dawRecOff(id);
  const k=pkEl(n.i); if(k) k.classList.remove("on");
  if(AT.hold) AT.latch.push(n); else n.h.release();
}
function atReleaseAll(){
  AT.notes.forEach(n=>n.h.release()); AT.notes.clear();
  AT.latch.forEach(n=>n.h.release()); AT.latch=[]; document.querySelectorAll("#piano .pk.on").forEach(k=>k.classList.remove("on"));
}
/* la gamme du thème change au fil des sections : le clavier la suit */
function atScaleSync(){ if(AT.built&&(MODE==="atelier"||MODE==="daw")&&AT.sig!==atSig()){ buildPiano(); atState(); } }
function atScaleUI(){ const b=$("atScale"); if(b) b.setAttribute("aria-pressed",AT.scale?"true":"false"); }
function atelierStartLive(){ if(live) return; S.mach=false; atMachUI(); startLive({fade:0.25}); }
function atKeys(e,down){
  if((MODE!=="atelier"&&MODE!=="daw")||e.ctrlKey||e.metaKey||e.altKey) return;
  const t=e.target, tg=t&&t.tagName; if(tg==="SELECT"||tg==="TEXTAREA"||(tg==="INPUT"&&t.type!=="range"&&t.type!=="checkbox")) return;
  let idx;
  if(AT.scale){ const n=ivOf(S,curScaleKey()).length, b=SC_BOT.indexOf(e.code), u=SC_TOP.indexOf(e.code); idx=b>=0?b:u>=0?n+u:undefined; }
  else idx=KEYMAP[e.code];
  if(idx===undefined||idx>=AT.keys.length) return;
  e.preventDefault(); if(down&&e.repeat) return;
  const id="k"+e.code; if(down) atOn(id,idx); else atOff(id);
}

/* ---------- machine ---------- */
function atMachUI(){ if(typeof dawMachUI==="function") dawMachUI(); const b=$("atMach"); if(!b) return; b.setAttribute("aria-pressed",S.mach!==false?"true":"false"); b.textContent="La machine"; b.title=S.mach!==false?"La machine joue : clique pour la mettre en sourdine":"La machine est en sourdine : clique pour la rallumer"; }
function setMach(on){
  S.mach=on; atMachUI();
  if(live){ live.eng.setLevels(); live.eng.replan("all"); }
}
function atState(){
  const h=$("atHint"); if(h){
    const go=live?"":"Touche une note ou une touche : le synthé démarre, machine en sourdine. ";
    if(AT.scale){ const k=curScaleKey(); h.textContent=go+"Toutes les touches sont dans la gamme du thème ("+NOTES[S.root]+" "+(SC[k]||SC.mixolydien).n.toLowerCase()+"), le clavier la suit quand elle change. Ordinateur : Z X C V B N M , . / puis Q W E R T Y U I O P, les marques sont les toniques."; }
    else h.textContent=go+"Clavier chromatique. Ordinateur : Z, S, X, D, C… et Q, 2, W, 3, E…";
  }
  atMachUI(); atScaleUI();
}

/* ---------- petits contrôles compacts ---------- */
/* une valeur à crans (octave, intervalle, unisson, forme) : on la tire, on la fait rouler ou on la règle aux flèches */
function synNum(path0,label,opts){
  const path=null, pp=()=>typeof path0==="function"?path0():path0;
  const el=atEl("div","fg-num",'<span class="l">'+label+'</span><b></b>'); el.tabIndex=0; el.setAttribute("role","spinbutton"); el.setAttribute("aria-label",label);
  const ix=()=>{ const v=synGet(pp()); let b=opts.findIndex(o=>o[0]===v); if(b<0&&typeof v==="number"){ let bd=1e9; opts.forEach((o,i)=>{ const d=Math.abs(o[0]-v); if(d<bd){ bd=d; b=i; } }); } return Math.max(0,b); };
  const paint=()=>{ const o=opts[ix()]; el.querySelector("b").textContent=o[1]; el.setAttribute("aria-valuetext",o[1]); };
  const step=d=>{ const i=Math.max(0,Math.min(opts.length-1,ix()+d)); if(i===ix()) return; synSet(pp(),opts[i][0]); paint(); atDirty(); if(live) live.eng.setLevels(); };
  let y0=null, acc=0;
  el.addEventListener("pointerdown",e=>{ y0=e.clientY; acc=0; try{ el.setPointerCapture(e.pointerId); }catch(x){} el.focus({preventScroll:true}); e.preventDefault(); });
  el.addEventListener("pointermove",e=>{ if(y0===null) return; const d=Math.trunc((y0-e.clientY)/10)-acc; if(d){ acc+=d; step(d); } });
  const end=()=>{ y0=null; }; el.addEventListener("pointerup",end); el.addEventListener("pointercancel",end);
  el.addEventListener("wheel",e=>{ e.preventDefault(); step(e.deltaY<0?1:-1); },{passive:false});
  el.addEventListener("keydown",e=>{ const d={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[e.key]; if(d){ step(d); e.preventDefault(); } });
  el._paint=paint; paint(); return el;
}
function atNums(list){ const r=atEl("div","fg-nums"); list.forEach(x=>r.appendChild(x)); return r; }
const LFO_ICON={draw:"M1 11 L5 4 L8 12 L12 3 L16 10 L21 5",sine:"M1 7 C4 -1 8 -1 11 7 S18 15 21 7",triangle:"M1 7 L6 1 L16 13 L21 7",sawtooth:"M1 12 L11 2 L11 12 L21 2",square:"M1 12 L1 2 L11 2 L11 12 L21 12 L21 2"};
/* forme du LFO choisi, sur deux périodes */
function drawLfo(){
  const cv=$("atLfo"); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, Lf=S.syn[AT.lfo], dr=Lf.shape==="draw", per=dr?1:2, hz=synLfoHz(Lf);
  c.strokeStyle=g.rule; c.lineWidth=1; c.beginPath(); c.moveTo(0,Math.round(H/2)+0.5); c.lineTo(W,Math.round(H/2)+0.5); c.stroke();
  if(dr){ c.strokeStyle="rgba(120,100,70,0.22)"; for(let q=1;q<4;q++){ c.beginPath(); c.moveTo(Math.round(W*q/4)+0.5,0); c.lineTo(Math.round(W*q/4)+0.5,H); c.stroke(); } }
  c.strokeStyle=g.rub; c.lineWidth=1.8; c.beginPath(); for(let x=0;x<=W;x++){ const y=H/2-synLfoVal(Lf,x/W*per)*(H/2-7); x?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
  if(AT.animOn||AT.notes.size){ const x=((atPhase(hz)%per)/per)*W; c.strokeStyle=g.ink2; c.lineWidth=1; c.setLineDash([2,3]); c.beginPath(); c.moveTo(Math.round(x)+0.5,0); c.lineTo(Math.round(x)+0.5,H); c.stroke(); c.setLineDash([]); }
  c.fillStyle=g.ink2; c.font='italic 11px "Alegreya", Georgia, serif';
  c.fillText((Lf.sync?SYN_DIV[Math.max(0,Math.min(SYN_DIV.length-1,Math.round(Lf.div)))][0]+" · ":"")+(hz>=1?hz.toFixed(1)+" Hz":"une période en "+(1/hz).toFixed(1)+" s")+(dr?" · tire pour dessiner":""),6,12);
}
/* tirer sur l'enveloppe : à l'horizontale la durée du segment touché, à la verticale le maintien */
function atEnvDrag(){
  const cv=$("atEnv"); let d=null;
  cv.addEventListener("pointerdown",e=>{ const r=cv.getBoundingClientRect(), E=S.syn[AT.env], tot=E.a+E.d+0.35+E.r, x=(e.clientX-r.left-4)/(r.width-8)*tot;
    d={k:x<E.a?"a":x<E.a+E.d+0.35?"d":"r",x:e.clientX,y:e.clientY,v:{...E}}; try{ cv.setPointerCapture(e.pointerId); }catch(z){} e.preventDefault(); });
  cv.addEventListener("pointermove",e=>{ if(!d) return; const E=S.syn[AT.env], lim={a:[0.002,6],d:[0.01,6],r:[0.01,8]}[d.k];
    E[d.k]=Math.max(lim[0],Math.min(lim[1],d.v[d.k]*Math.exp((e.clientX-d.x)/70)));
    if(d.k!=="a") E.s=Math.max(0,Math.min(1,d.v.s+(d.y-e.clientY)/Math.max(30,cv.getBoundingClientRect().height-12)));
    atPaintKnobs(); atDirty(); if(live) live.eng.setLevels(); });
  const end=()=>{ d=null; }; cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
}
function atPaintKnobs(){ document.querySelectorAll("#atelier .knob").forEach(el=>paintKnob(el,el._spec)); document.querySelectorAll("#atelier .fg-num").forEach(el=>el._paint()); }
/* onglets d'enveloppe et de LFO : un seul graphe et un seul jeu de boutons, qui suivent l'onglet */
function atTabsUI(){
  [["envA","fgEA"],["envF","fgEF"],["env2","fgE2"]].forEach(([k,id])=>{ const b=$(id); if(b) b.setAttribute("aria-pressed",AT.env===k?"true":"false"); });
  ["lfo1","lfo2","lfo3"].forEach(k=>{ const b=$("fg_"+k); if(b) b.setAttribute("aria-pressed",AT.lfo===k?"true":"false"); });
  Object.keys(LFO_ICON).forEach(sh=>{ const b=$("fgSh_"+sh); if(b) b.setAttribute("aria-pressed",S.syn[AT.lfo].shape===sh?"true":"false"); });
  { const L=S.syn[AT.lfo], sb=$("fgLfoSync"); if(sb) sb.setAttribute("aria-pressed",L.sync?"true":"false"); if(AT.lfoKnob) AT.lfoKnob.hidden=!!L.sync; if(AT.lfoDiv) AT.lfoDiv.hidden=!L.sync; const lc=$("atLfo"); if(lc) lc.classList.toggle("drawable",L.shape==="draw"); }
  [["syn","fgP_syn","fgT_syn"],["fx","fgP_fx","fgT_fx"]].forEach(([k,p,t])=>{ if($(p)) $(p).hidden=AT.pane!==k; if($(t)) $(t).setAttribute("aria-pressed",AT.pane===k?"true":"false"); });
}
/* liaisons de modulation : seules celles qui servent sont affichées */
function atModRows(){
  let n=0; document.querySelectorAll("#atelier .fg-link").forEach((row,i)=>{ const on=S.syn.mod[i]&&S.syn.mod[i].src!=="none"; row.hidden=!on; if(on) n++; });
  const add=$("fgAddMod"); if(add) add.disabled=n>=8; const none=$("fgNoMod"); if(none) none.hidden=n>0;
}

/* ---------- modulation par glisser-déposer : sources, anneaux de profondeur, aperçu animé ----------
   Une source (LFO, enveloppe, vélocité…) se tire sur un bouton ; elle crée une liaison dans la matrice et un anneau de profondeur
   apparaît sur le bouton. Tirer l'anneau règle la profondeur, un double-clic le retire. */
const SYN_CHIPS=[["lfo1","LFO 1"],["lfo2","LFO 2"],["lfo3","LFO 3"],["env1","Env. volume"],["env2","Env. 2"],["vel","Vélocité"],["key","Clavier"],["rand","Hasard"],["mac1","Macro 1"],["mac2","Macro 2"],["mac3","Macro 3"],["mac4","Macro 4"]];
const SYN_BIPOLAR={lfo1:1,lfo2:1,lfo3:1,key:1,rand:1};
const SYN_DEFAMT={cutoff:0.25,reso:0.3,wave:0.4,waveb:0.4,fm:0.3,detuneb:0.3,lvlb:0.4,amp:0.2,warp:0.3};
/* valeur réelle du réglage -> valeur modulée pour une quantité a, avec les mêmes échelles que le moteur */
const SYN_APPLY={cutoff:(r,a)=>r*Math.pow(2,4*a),reso:(r,a)=>r+12*a,wave:(r,a)=>r+0.5*a,waveb:(r,a)=>r+0.5*a,fm:(r,a)=>r+a,detuneb:(r,a)=>r+100*a,lvlb:(r,a)=>r+0.5*a,amp:(r,a)=>r*(1+0.9*a),warp:(r,a)=>r+a};
const SYN_COL=["#a3301c","#2f6f5e","#b07d1f","#5b4a8a","#8a3f6a","#3d6b9c","#6b6b2a","#9c5a3d"];
const srcName=k=>(SYN_SRC.find(x=>x[0]===k)||[0,k])[1], dstName=k=>(SYN_DST.find(x=>x[0]===k)||[0,k])[1];
const SVGNS="http://www.w3.org/2000/svg";
/* phase d'un LFO : depuis le début de la note tenue (comme le moteur), sinon en roue libre pour l'aperçu */
const atPhase=hz=>((AT.notes.size&&AT.lastOnMs)?(performance.now()-AT.lastOnMs)/1000:performance.now()/1000)*hz;
function synSrcLive(k){
  if(k==="lfo1"||k==="lfo2"||k==="lfo3"){ const L=S.syn[k]; return synLfoVal(L,atPhase(synLfoHz(L))); }
  if(k==="vel") return 0.7;
  if(k.slice(0,3)==="mac") return (S.syn.mac&&S.syn.mac["m"+k.slice(3)])||0;
  return 0;
}
const synLiveMod=dst=>S.syn.mod.reduce((a,m)=>a+(m.dst===dst&&m.src!=="none"?m.amt*synSrcLive(m.src):0),0);
function synRings(el,spec,live){
  const svg=el.querySelector("svg"); if(!svg||!SYN_APPLY[spec.dst]) return;
  let g=svg.querySelector(".rings"); if(!g){ g=document.createElementNS(SVGNS,"g"); g.setAttribute("class","rings"); svg.appendChild(g); }
  const mods=[]; S.syn.mod.forEach((m,i)=>{ if(m.dst===spec.dst&&m.src!=="none"&&Math.abs(m.amt)>0.001) mods.push({m,i}); });
  el.classList.toggle("modded",mods.length>0);
  const ap=SYN_APPLY[spec.dst], r=spec.raw(), n0=spec.get(), cl=v=>Math.max(0,Math.min(1,v)), ang=n=>A0+(A1-A0)*n;
  const key=JSON.stringify(mods.map(x=>[x.i,x.m.src,x.m.amt]))+"|"+r;
  if(g.dataset.k!==key){
    g.dataset.k=key; g.textContent="";
    mods.forEach((x,j)=>{
      const a=x.m.amt, nA=cl(spec.norm(ap(r,a))), nB=SYN_BIPOLAR[x.m.src]?cl(spec.norm(ap(r,-a))):n0, lo=Math.min(nA,nB), hi=Math.max(nA,nB), rad=[35.6,38.6,32.8][j%3];
      const pa=document.createElementNS(SVGNS,"path"); pa.setAttribute("class","dr"); pa.setAttribute("d",arcPath(rad,ang(lo),ang(Math.max(hi,lo+0.012)))); pa.setAttribute("stroke",SYN_COL[x.i%SYN_COL.length]); pa.dataset.i=x.i;
      const t=document.createElementNS(SVGNS,"title"); t.textContent=srcName(x.m.src)+" → "+dstName(spec.dst)+" : "+(a>0?"+":"")+Math.round(a*100)+" %. Tire pour régler, double-clic pour retirer."; pa.appendChild(t); g.appendChild(pa);
    });
  }
  /* point vivant : où la modulation emmène le réglage à cet instant (LFO, macros, vélocité) */
  let dot=svg.querySelector(".md");
  if(live&&mods.some(x=>/^lfo/.test(x.m.src))){
    if(!dot){ dot=document.createElementNS(SVGNS,"circle"); dot.setAttribute("class","md"); dot.setAttribute("r","2"); svg.appendChild(dot); }
    const lv=cl(spec.norm(ap(r,mods.reduce((a,x)=>a+x.m.amt*synSrcLive(x.m.src),0)))), [x,y]=pol(30,ang(lv)); dot.setAttribute("cx",x.toFixed(2)); dot.setAttribute("cy",y.toFixed(2));
  }else if(dot) dot.remove();
}
const atModNote=t=>{ const n=$("fgModNote"); if(n) n.textContent=t; };
function synAddMod(src,dst){
  const mods=S.syn.mod; let i=mods.findIndex(m=>m.src===src&&m.dst===dst);
  if(i<0){
    i=mods.findIndex(m=>m.src==="none");
    if(i<0){ let b=1e9; mods.forEach((m,j)=>{ if(Math.abs(m.amt)<b){ b=Math.abs(m.amt); i=j; } }); }
    mods[i]={src,dst,amt:src==="env1"||src==="env2"?0.5:(SYN_DEFAMT[dst]||0.3)};
  }else if(Math.abs(mods[i].amt)<0.001) mods[i].amt=SYN_DEFAMT[dst]||0.3;
  syncUI(); atModRows(); atPaintKnobs(); atDirty(); if(live) live.eng.setLevels();
  return i;
}
function atDropMod(src,dst){
  const i=synAddMod(src,dst), a=S.syn.mod[i].amt;
  atModNote(srcName(src)+" → "+dstName(dst)+" ("+(a>0?"+":"")+Math.round(a*100)+" %). Tire l'anneau du bouton pour régler la profondeur, double-clic pour le retirer.");
}
function synRingStart(el,spec,e){ const p=e.target.closest(".dr"), i=p?+p.dataset.i:-1, m=S.syn.mod[i]; return m?{el,spec,i,y0:e.clientY,a0:m.amt}:null; }
function synRingMove(r,e){
  const m=S.syn.mod[r.i]; if(!m) return;
  m.amt=Math.max(-1,Math.min(1,Math.round((r.a0+(r.y0-e.clientY)/(e.shiftKey?500:140))*100)/100));
  refreshKeys(["syn.mod."+r.i+".amt"]); synRings(r.el,r.spec); atDirty(); if(live) live.eng.setLevels();
  atModNote(srcName(m.src)+" → "+dstName(m.dst)+" : "+(m.amt>0?"+":"")+Math.round(m.amt*100)+" %");
}
function synRingRemove(el,spec,e){
  const p=e.target.closest(".dr"), i=p?+p.dataset.i:-1, m=S.syn.mod[i]; if(!m) return;
  atModNote(srcName(m.src)+" → "+dstName(m.dst)+" retiré.");
  m.src="none"; m.amt=0; syncUI(); atModRows(); atPaintKnobs(); atDirty(); if(live) live.eng.setLevels();
}
function atArm(src){
  AT.armed=AT.armed===src?null:src;
  document.querySelectorAll("#atelier .fg-chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.src===AT.armed?"true":"false"));
  document.body.classList.toggle("armed",!!AT.armed);
  atModNote(AT.armed?srcName(AT.armed)+" prête : clique un bouton marqué d'un point pour la relier.":"");
}
const atKnobAt=e=>{ const el=document.elementFromPoint(e.clientX,e.clientY); return el&&el.closest?el.closest(".knob[data-dst]"):null; };
function atSrcTray(){
  const tray=atEl("div","fg-src"); tray.appendChild(atEl("span","fg-srcl","Sources"));
  SYN_CHIPS.forEach(([k,l])=>{ const b=atEl("button","fg-chip",l); b.type="button"; b.dataset.src=k; b.setAttribute("aria-pressed","false"); b.title="Tire-la sur un bouton marqué d'un point, ou clique-la puis clique un bouton"; tray.appendChild(b); });
  const note=atEl("span","fg-srcn"); note.id="fgModNote"; note.setAttribute("aria-live","polite"); tray.appendChild(note);
  let d=null;
  tray.addEventListener("pointerdown",e=>{ const b=e.target.closest(".fg-chip"); if(!b) return; d={src:b.dataset.src,b,x:e.clientX,y:e.clientY,on:false,ghost:null}; try{ b.setPointerCapture(e.pointerId); }catch(z){} e.preventDefault(); });
  tray.addEventListener("pointermove",e=>{
    if(!d) return;
    if(!d.on&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>6){ d.on=true; d.ghost=atEl("div","fg-ghost",d.b.textContent); document.body.appendChild(d.ghost); document.body.classList.add("dragmod"); }
    if(d.on){ d.ghost.style.transform="translate("+(e.clientX+12)+"px,"+(e.clientY+12)+"px)"; const k=atKnobAt(e); document.querySelectorAll(".knob.hot").forEach(x=>x.classList.remove("hot")); if(k) k.classList.add("hot"); }
  });
  const end=e=>{
    if(!d) return; const k=d.on?atKnobAt(e):null, src=d.src, on=d.on;
    if(d.ghost) d.ghost.remove(); document.body.classList.remove("dragmod"); document.querySelectorAll(".knob.hot").forEach(x=>x.classList.remove("hot")); d=null;
    if(on){ if(k) atDropMod(src,k.dataset.dst); else atModNote("Lâche la source sur un bouton marqué d'un point."); } else atArm(src);
  };
  tray.addEventListener("pointerup",end); tray.addEventListener("pointercancel",end);
  tray.addEventListener("click",e=>{ const b=e.target.closest(".fg-chip"); if(b&&e.detail===0) atArm(b.dataset.src); }); /* au clavier */
  return tray;
}
/* aperçu animé : la table et les anneaux suivent les LFO */
function atAnim(){
  if(AT.pane!=="syn") return;
  const lf=S.syn.mod.some(m=>m.src!=="none"&&Math.abs(m.amt)>0.001&&/^lfo/.test(m.src));
  if(!lf){ if(AT.animOn){ AT.animOn=false; atDraw(); document.querySelectorAll("#atelier .knob[data-dst]").forEach(el=>synRings(el,el._spec)); } return; }
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  AT.fr=(AT.fr||0)+1; if(AT.fr%2) return; AT.animOn=true;
  drawWave("atWA","oscA"); drawWave("atWB","oscB"); drawLfo();
  document.querySelectorAll("#atelier .knob.modded").forEach(el=>synRings(el,el._spec,true));
}
/* ---------- LFO dessiné ---------- */
function atLfoEvents(){
  const cv=$("atLfo"); let drag=false, last=-1;
  const at=e=>{ const r=cv.getBoundingClientRect(), N=S.syn[AT.lfo].draw.length; return {i:Math.max(0,Math.min(N-1,Math.floor((e.clientX-r.left)/r.width*N))), v:Math.max(-1,Math.min(1,1-2*(e.clientY-r.top)/r.height))}; };
  const put=e=>{
    const d=S.syn[AT.lfo].draw, {i,v}=at(e);
    if(last>=0&&Math.abs(i-last)>1){ const a=Math.min(i,last), b=Math.max(i,last); for(let k=a;k<=b;k++) d[k]=d[last]+(v-d[last])*(k-last)/(i-last); }
    d[i]=v; last=i; drawLfo(); atDirty(); if(live) live.eng.setLevels();
  };
  cv.addEventListener("pointerdown",e=>{ if(S.syn[AT.lfo].shape!=="draw") return; drag=true; last=-1; try{ cv.setPointerCapture(e.pointerId); }catch(x){} put(e); e.preventDefault(); });
  cv.addEventListener("pointermove",e=>{ if(drag) put(e); });
  const end=()=>{ drag=false; last=-1; }; cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
}
/* ---------- table importée depuis un fichier audio ---------- */
function atTableFromSamples(x,sr,name){
  const r=synTableFromAudio(x,sr,256), n=$("atImpNote");
  if(!r){ if(n) n.textContent="Ce son est trop court ou silencieux pour en tirer une table."; return null; }
  S.syn.draw=r.table; S.syn.drawV=(S.syn.drawV||0)+1+Math.floor(Math.random()*1e6); S.syn.oscA.wave=1; AT.slices=null;
  atelierSync(); atDirty(); if(live) live.eng.setLevels();
  if(n) n.textContent="Table importée de « "+name+" » : un cycle de 256 points, "+(r.periodic?"hauteur trouvée "+Math.round(r.hz)+" Hz":"son sans hauteur nette, donc table de timbre")+". L'oscillateur A la joue.";
  return r;
}
async function atImportFile(file){
  const n=$("atImpNote"); if(n) n.textContent="Lecture de « "+file.name+" »…";
  try{
    const buf=await file.arrayBuffer(), OC=window.OfflineAudioContext||window.webkitOfflineAudioContext, ab=await new OC(1,1,44100).decodeAudioData(buf);
    const x=new Float32Array(ab.length); for(let c=0;c<ab.numberOfChannels;c++){ const ch=ab.getChannelData(c); for(let i=0;i<x.length;i++) x[i]+=ch[i]/ab.numberOfChannels; }
    atTableFromSamples(x,ab.sampleRate,file.name);
  }catch(e){ if(n) n.textContent="Ce fichier ne peut pas être lu comme un son (formats courants : wav, mp3, ogg, m4a)."; }
}

/* ---------- construction : bandeau, deux rangées, liaisons, clavier ---------- */
function buildAtelier(){
  const host=document.querySelector(".folio"), sec=atEl("section","atelier"); sec.id="atelier"; sec.hidden=true; sec.setAttribute("aria-label","Forger un synthé");
  AT.env="envA"; AT.lfo="lfo1"; AT.pane="syn";
  const bar=atEl("div","fg-bar");
  bar.innerHTML='<div class="fg-patch"><button class="lnk" id="synPrev" type="button" aria-label="Patch précédent">‹</button><select id="synPatch" aria-label="Patch"></select><button class="lnk" id="synNext" type="button" aria-label="Patch suivant">›</button><span class="fg-nm" id="synPatchName"></span></div>'+
    '<button class="lnk" id="synRandom" type="button">Au sort</button>'+
    '<details class="fg-pop atsave"><summary>Enregistrer</summary><div class="fg-popin"><div class="ctl atname"><label for="synName">Nom</label><input type="text" id="synName" maxlength="40" placeholder="Mon patch"></div><button class="lnk" id="synSaveBtn" type="button">Enregistrer sous ce nom</button><button class="lnk" id="synDelBtn" type="button">Supprimer le patch choisi</button></div></details>'+
    '<div class="fg-tabs" role="group" aria-label="Page du synthé"><button class="lnk" id="fgT_syn" type="button" aria-pressed="true">Synthé</button><button class="lnk" id="fgT_fx" type="button" aria-pressed="false">Effets et table</button></div>'+
    '<div class="fg-scope" title="Clique pour passer de l\'oscilloscope au spectre"><canvas class="at-cv" id="atScope" role="img" aria-label="Oscilloscope ou spectre du son"></canvas><span class="at-read" id="atScopeRead" aria-live="off"></span></div>'+
    '<button class="btn tgl" id="atMach" type="button" aria-pressed="true">La machine</button>'+
    '<details class="fg-pop fg-help"><summary aria-label="Aide">?</summary><div class="fg-popin"><p class="hint" id="atHint"></p><p class="hint">Boutons : tire vers le haut ou le bas, Maj pour affiner. Valeurs encadrées : tire ou fais rouler la molette. Enveloppe : tire sur le graphe. Tables : tire sur la vue pour changer de position.</p></div></details>';
  sec.appendChild(bar);
  const K=(path,label,min,max,o)=>synKnob(path,label,min,max,o);
  const knobs=(list)=>{ const r=atKnobs(list); r.style.setProperty("--kn",list.length); return r; };
  const grid=atEl("div","fg-grid"); grid.id="fgP_syn";
  const put=(span,m)=>{ m.classList.add("g"+span); grid.appendChild(m); return m; };
  put(12,atSrcTray());
  /* rangée 1 : les sources et le filtre */
  [["oscA","Oscillateur A","atWA"],["oscB","Oscillateur B","atWB"]].forEach(([k,t,cvid])=>{
    const m=atMod(t); m.appendChild(atCanvas(cvid,84));
    m.appendChild(knobs([K(k+".wave","Table",0,1,{fmt:v=>SYN_WAVES[Math.min(SYN_WAVES.length-1,Math.round(v*(SYN_WAVES.length-1)))],dst:k==="oscA"?"wave":"waveb"}),K(k+".lvl","Niveau",0,1,{fmt:fmtP,dst:k==="oscB"?"lvlb":undefined}),K(k+".det","Désaccord",-50,50,{fmt:fmtC,step:1,dst:k==="oscB"?"detuneb":undefined}),K(k+".spread","Écart",0,40,{fmt:v=>Math.round(v)+" ¢",step:1}),K(k+".warp","Torsion",-0.95,0.95,{fmt:v=>(v>0?"+":"")+Math.round(v*100)+" %",dst:k==="oscA"?"warp":undefined})]));
    m.appendChild(atNums([synNum(k+".oct","Octave",[-2,-1,0,1,2].map(v=>[v,(v>0?"+":"")+v])),synNum(k+".semi","Demi-tons",[-24,-12,-7,-5,0,5,7,12,19,24].map(v=>[v,(v>0?"+":"")+v])),synNum(k+".uni","Unisson",[1,2,3,4,5,7].map(v=>[v,v+" v."]))]));
    put(3,m);
  });
  const ms=atMod("Compléments");
  ms.appendChild(knobs([K("sub.lvl","Sous-osc.",0,1,{fmt:fmtP}),K("noise.lvl","Bruit",0,1,{fmt:fmtP})]));
  ms.appendChild(knobs([K("fm.amt","FM",0,1.5,{fmt:v=>v.toFixed(2),dst:"fm"}),K("fm.ratio","Rapport",0.5,8,{step:0.5,fmt:v=>"× "+v.toFixed(1)})]));
  ms.appendChild(atNums([synNum("sub.shape","Sous-osc.",[["sine","sinus"],["square","carré"]])]));
  put(2,ms);
  const mf=atMod("Filtre"); mf.appendChild(atCanvas("atFil",84));
  mf.appendChild(knobs([K("fil.cut","Coupure",40,16000,{log:true,fmt:fmtHz,dst:"cutoff"}),K("fil.res","Résonance",0.1,14,{log:true,fmt:v=>v.toFixed(1),dst:"reso"}),K("fil.key","Clavier",0,1,{fmt:fmtP}),K("fil.env","Envel.",-4800,4800,{fmt:fmtC,step:50}),K("fx.drive","Saturat.",0,1,{fmt:fmtP})]));
  mf.appendChild(atNums([synNum("fil.type","Type",[["lowpass","passe-bas 12"],["lowpass24","passe-bas 24"],["highpass","passe-haut 12"],["highpass24","passe-haut 24"],["bandpass","passe-bande"],["notch","coupe-bande"]])]));
  put(4,mf);
  /* rangée 2 : ce qui bouge */
  const me=atMod("Enveloppes"); me.querySelector("h3").insertAdjacentHTML("beforeend",'<span class="fg-seg"><button class="lnk" id="fgEA" type="button">volume</button><button class="lnk" id="fgEF" type="button">filtre</button><button class="lnk" id="fgE2" type="button">modulation</button></span>');
  const ec=atCanvas("atEnv",72); ec.setAttribute("aria-label","Enveloppe choisie : tire pour la modifier"); me.appendChild(ec);
  const EP=k=>()=>AT.env+"."+k;
  me.appendChild(knobs([K(EP("a"),"Attaque",0.002,6,{log:true,fmt:fmtS}),K(EP("d"),"Déclin",0.01,6,{log:true,fmt:fmtS}),K(EP("s"),"Maintien",0,1,{fmt:fmtP}),K(EP("r"),"Relâche",0.01,8,{log:true,fmt:fmtS})]));
  put(4,me);
  const ml=atMod("LFO"); ml.querySelector("h3").insertAdjacentHTML("beforeend",'<span class="fg-seg"><button class="lnk" id="fg_lfo1" type="button">1</button><button class="lnk" id="fg_lfo2" type="button">2</button><button class="lnk" id="fg_lfo3" type="button">3</button></span>');
  const lc=atCanvas("atLfo",72); lc.setAttribute("aria-label","Forme du LFO choisi"); ml.appendChild(lc);
  const lrow=atEl("div","fg-lfo"); AT.lfoKnob=makeKnob(K(()=>AT.lfo+".rate","Vitesse",0.03,25,{log:true,fmt:v=>v.toFixed(2)+" Hz"})); lrow.appendChild(AT.lfoKnob);
  const shp=atEl("div","fg-shapes"); shp.setAttribute("role","group"); shp.setAttribute("aria-label","Forme du LFO");
  shapeOpts.concat([["draw","Dessiné : tire sur le graphe"]]).forEach(([v,l])=>{ const b=atEl("button","lnk",'<svg viewBox="0 0 22 14" aria-hidden="true"><path d="'+LFO_ICON[v]+'"/></svg>'); b.type="button"; b.id="fgSh_"+v; b.title=l; b.setAttribute("aria-label",l); b.onclick=()=>{ S.syn[AT.lfo].shape=v; atTabsUI(); atDirty(); if(live) live.eng.setLevels(); }; shp.appendChild(b); });
  lrow.appendChild(shp); ml.appendChild(lrow);
  { const lsy=atEl("div","fg-lsync"), sb=atEl("button","btn tgl","Tempo"); sb.type="button"; sb.id="fgLfoSync"; sb.setAttribute("aria-pressed","false"); sb.title="Cale la vitesse du LFO sur le tempo du morceau";
    sb.onclick=()=>{ const L=S.syn[AT.lfo]; L.sync=L.sync?0:1; atTabsUI(); atDirty(); if(live) live.eng.setLevels(); };
    AT.lfoDiv=synNum(()=>AT.lfo+".div","Division",SYN_DIV.map((d,i)=>[i,d[0]])); AT.lfoDiv.id="fgLfoDiv"; lsy.appendChild(sb); lsy.appendChild(AT.lfoDiv); ml.appendChild(lsy); }
  put(3,ml);
  const mc=atMod("Macros","sources de liaison");
  mc.appendChild(knobs([K("mac.m1","Macro 1",0,1,{fmt:fmtP}),K("mac.m2","Macro 2",0,1,{fmt:fmtP})])); mc.appendChild(knobs([K("mac.m3","Macro 3",0,1,{fmt:fmtP}),K("mac.m4","Macro 4",0,1,{fmt:fmtP})]));
  put(2,mc);
  const mo=atMod("Sortie et jeu");
  mo.appendChild(knobs([K("fx.level","Niveau",0.05,4,{log:true,fmt:v=>"× "+v.toFixed(2),dst:"amp"}),K("vel.amt","Vélocité",0,1,{fmt:fmtP}),K("mono.glide","Glisse",0.01,1.5,{log:true,fmt:fmtS})]));
  mo.appendChild(atNums([synNum("mono.on","Jeu",[[0,"polyphonique"],[1,"mono, glissé"]])]));
  put(3,mo);
  /* rangée 3 : les liaisons de modulation */
  const mm=atMod("Liaisons","une source fait bouger un réglage"); mm.querySelector("h3").insertAdjacentHTML("beforeend",'<button class="lnk fg-add" id="fgAddMod" type="button">+ liaison</button>');
  const links=atEl("div","fg-links");
  for(let i=0;i<8;i++){
    const row=atEl("div","fg-link");
    row.appendChild(atFields([{k:"syn.mod."+i+".src",type:"select",label:"Source "+(i+1),opts:SYN_SRC.slice(1)},{k:"syn.mod."+i+".dst",type:"select",label:"Destination "+(i+1),opts:SYN_DST},{k:"syn.mod."+i+".amt",type:"range",label:"Quantité "+(i+1),min:-1,max:1,step:0.01,fmt:v=>(v>0?"+":"")+Math.round(v*100)+" %"}]));
    const x=atEl("button","lnk fg-x","×"); x.type="button"; x.setAttribute("aria-label","Retirer la liaison "+(i+1)); x.onclick=()=>{ S.syn.mod[i].src="none"; S.syn.mod[i].amt=0; atModRows(); atDirty(); if(live) live.eng.setLevels(); }; row.appendChild(x);
    links.appendChild(row);
  }
  mm.appendChild(links); mm.appendChild(atEl("p","hint","",)).id="fgNoMod"; put(12,mm);
  sec.appendChild(grid);
  /* seconde page : effets, table dessinée, échange de patch */
  const g2=atEl("div","fg-grid"); g2.id="fgP_fx"; g2.hidden=true;
  const mr=atMod("Effets"); mr.classList.add("g8"); const rk=atEl("div","at-rack");
  const grp=(t,list)=>{ const g=atEl("div","at-rg"); g.appendChild(atEl("h4","",t)); g.appendChild(knobs(list)); rk.appendChild(g); };
  const dB=v=>(v>0?"+":"")+v.toFixed(1)+" dB";
  grp("Chorus",[K("rack.chorus.mix","Mélange",0,1,{fmt:fmtP}),K("rack.chorus.rate","Vitesse",0.1,6,{log:true,fmt:v=>v.toFixed(1)+" Hz"}),K("rack.chorus.depth","Profond.",0,1,{fmt:fmtP})]);
  grp("Écho",[K("rack.delay.mix","Mélange",0,1,{fmt:fmtP}),K("rack.delay.time","Temps",0.05,1.2,{log:true,fmt:v=>Math.round(v*1000)+" ms"}),K("rack.delay.fb","Répét.",0,0.9,{fmt:fmtP})]);
  grp("Salle",[K("rack.rev.mix","Réverb",0,1,{fmt:fmtP})]);
  grp("Égaliseur",[K("rack.eq.lo","Graves",-12,12,{fmt:dB,step:0.5}),K("rack.eq.mid","Médiums",-12,12,{fmt:dB,step:0.5}),K("rack.eq.hi","Aigus",-12,12,{fmt:dB,step:0.5})]);
  grp("Compresseur",[K("rack.comp.amt","Force",0,1,{fmt:fmtP})]);
  mr.appendChild(rk); g2.appendChild(mr);
  const mt=atMod("Table dessinée"); mt.classList.add("g4");
  mt.appendChild(atCanvas("atDrawCv",96));
  mt.appendChild(atEl("div","at-dr",'<button class="lnk" id="atDrSin" type="button">Sinus</button><button class="lnk" id="atDrSaw" type="button">Dent</button><button class="lnk" id="atDrSq" type="button">Carré</button><button class="lnk" id="atDrSmooth" type="button">Lisser</button><button class="lnk" id="atDrRnd" type="button">Hasard</button>'));
  mt.appendChild(atEl("div","at-dr",'<button class="lnk" id="atImpBtn" type="button">Importer un son…</button><input type="file" id="atImpFile" accept="audio/*" hidden>'));
  mt.appendChild(atEl("p","hint","Tire sur la courbe : c'est la dernière table, tout à droite du bouton Table. « Importer un son » en tire un cycle (fichier audio, ou glisse-le sur la courbe).")).id="atImpNote";
  g2.appendChild(mt);
  const ex=atMod("Échanger un patch","texte à copier ou à coller"); ex.classList.add("g12");
  ex.appendChild(atEl("div","fields",'<div class="ctl"><label for="synOut">Ton patch</label><textarea id="synOut" readonly></textarea><div class="row"><button class="lnk" id="synCopy" type="button">Copier</button></div></div><div class="ctl"><label for="synIn">Coller un patch</label><textarea id="synIn" placeholder="Colle ici un patch reçu"></textarea><div class="row"><button class="lnk" id="synLoadTxt" type="button">Charger ce patch</button></div></div>'));
  g2.appendChild(ex);
  sec.appendChild(g2);
  /* clavier */
  const kb=atEl("div","at-kb"); kb.id="atKb"; kb.innerHTML='<div class="row at-kbbar"><button class="lnk" id="atKbFold" type="button" aria-expanded="true">Clavier</button><select id="atOct"></select><button class="btn" id="atScale" type="button" aria-pressed="true" title="Toutes les touches dans la gamme du thème en cours">Dans la gamme</button><button class="btn" id="atHold" type="button" aria-pressed="false">Maintien</button><button class="btn" id="atPanic" type="button">Tout couper</button></div><div class="piano" id="piano" aria-label="Clavier"></div>';
  sec.appendChild(kb);
  host.insertBefore(sec,document.querySelector(".cols"));
  /* branchements */
  const oc=$("atOct"); [[-1,"Grave (Do2)"],[0,"Médium (Do3)"],[1,"Aigu (Do4)"],[2,"Très aigu (Do5)"]].forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; oc.appendChild(o); }); oc.value=AT.oct; oc.setAttribute("aria-label","Octave du clavier");
  oc.onchange=()=>{ atReleaseAll(); AT.oct=parseInt(oc.value,10); buildPiano(); };
  try{ AT.scale=localStorage.getItem("bourdon.atscale")!=="0"; AT.kbFold=localStorage.getItem("bourdon.kbfold")==="1"; }catch(e){}
  const foldUI=()=>{ kb.classList.toggle("folded",!!AT.kbFold); $("atKbFold").setAttribute("aria-expanded",AT.kbFold?"false":"true"); };
  $("atKbFold").onclick=()=>{ AT.kbFold=!AT.kbFold; try{ localStorage.setItem("bourdon.kbfold",AT.kbFold?"1":"0"); }catch(e){} foldUI(); }; foldUI();
  buildPiano();
  const pk=$("piano"); const target=e=>e.target.closest&&e.target.closest(".pk");
  pk.addEventListener("pointerdown",e=>{ const k=target(e); if(!k) return; e.preventDefault(); try{ k.setPointerCapture(e.pointerId); }catch(x){} atOn("p"+e.pointerId,parseInt(k.dataset.i,10)); });
  const up=e=>atOff("p"+e.pointerId); pk.addEventListener("pointerup",up); pk.addEventListener("pointercancel",up); pk.addEventListener("lostpointercapture",up);
  document.addEventListener("keydown",e=>atKeys(e,true)); document.addEventListener("keyup",e=>atKeys(e,false));
  $("atHold").onclick=()=>{ AT.hold=!AT.hold; $("atHold").setAttribute("aria-pressed",AT.hold?"true":"false"); if(!AT.hold){ AT.latch.forEach(n=>n.h.release()); AT.latch=[]; document.querySelectorAll("#piano .pk.on").forEach(k=>{ if(![...AT.notes.values()].some(n=>n.i==k.dataset.i)) k.classList.remove("on"); }); } };
  $("atScale").onclick=()=>{ atReleaseAll(); AT.scale=!AT.scale; try{ localStorage.setItem("bourdon.atscale",AT.scale?"1":"0"); }catch(e){} buildPiano(); atState(); };
  $("atPanic").onclick=()=>{ atReleaseAll(); if(live&&typeof synPanic==="function") synPanic(live.ctx); };
  $("atMach").onclick=()=>setMach(S.mach===false);
  fillPatchSelect("f0");
  const pick=()=>{ const v=$("synPatch").value; $("synDelBtn").disabled=v[0]!=="u"; if(v[0]==="f") loadSynPatch(SYN_PATCHES[+v.slice(1)][1],SYN_PATCHES[+v.slice(1)][0]); else{ const p=userPatches()[+v.slice(1)]; if(p) loadSynPatch(p.syn,p.name); } };
  $("synPatch").onchange=pick;
  const hop=d=>{ const sl=$("synPatch"), n=sl.options.length; sl.selectedIndex=((sl.selectedIndex<0?0:sl.selectedIndex)+d+n)%n; pick(); };
  $("synPrev").onclick=()=>hop(-1); $("synNext").onclick=()=>hop(1);
  $("synRandom").onclick=()=>{ S.syn=synRandom(Math.random); setPatchName("tiré au sort"); syncUI(); atelierSync(); if(live) live.eng.setLevels(); };
  $("synSaveBtn").onclick=()=>{ const nm=($("synName").value||"").trim()||"Patch "+(userPatches().length+1), a=userPatches(); a.push({name:nm,syn:clone(S.syn)}); putUserPatches(a); fillPatchSelect("u"+(a.length-1)); setPatchName(""); $("synName").value=""; };
  $("synDelBtn").onclick=()=>{ const v=$("synPatch").value; if(v[0]!=="u") return; const a=userPatches(); a.splice(+v.slice(1),1); putUserPatches(a); fillPatchSelect("f0"); };
  $("synCopy").onclick=async()=>{ $("synOut").value=JSON.stringify(S.syn); try{ await navigator.clipboard.writeText($("synOut").value); }catch(e){ $("synOut").select(); } };
  $("synLoadTxt").onclick=()=>{ try{ const j=JSON.parse($("synIn").value); loadSynPatch(j,"importé"); }catch(e){ $("synIn").value=""; $("synIn").placeholder="Patch illisible"; } };
  $("fgT_syn").onclick=()=>{ AT.pane="syn"; atTabsUI(); atDraw(); }; $("fgT_fx").onclick=()=>{ AT.pane="fx"; $("synOut").value=JSON.stringify(S.syn); atTabsUI(); atDraw(); };
  [["envA","fgEA"],["envF","fgEF"],["env2","fgE2"]].forEach(([k,id])=>{ $(id).onclick=()=>{ AT.env=k; atTabsUI(); atPaintKnobs(); atDraw(); }; });
  ["lfo1","lfo2","lfo3"].forEach(k=>{ $("fg_"+k).onclick=()=>{ AT.lfo=k; atTabsUI(); atPaintKnobs(); atDraw(); }; });
  $("fgAddMod").onclick=()=>{ const i=S.syn.mod.findIndex(m=>m.src==="none"); if(i<0) return; S.syn.mod[i]={src:"lfo1",dst:"cutoff",amt:0.25}; syncUI(); atModRows(); atDirty(); if(live) live.eng.setLevels(); };
  $("fgNoMod").textContent="Aucune liaison : « + liaison » relie un LFO, une enveloppe, la vélocité ou une macro à un réglage.";
  sec.addEventListener("input",atDirty); sec.addEventListener("change",()=>{ atDirty(); atModRows(); });
  if(window.ResizeObserver) new ResizeObserver(()=>atDraw()).observe(sec);
  atWaveDrag("atWA","oscA"); atWaveDrag("atWB","oscB"); tabulaEvents(); atEnvDrag(); atLfoEvents();
  $("atImpBtn").onclick=()=>$("atImpFile").click();
  $("atImpFile").onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(f) atImportFile(f); e.target.value=""; };
  { const dc=$("atDrawCv"); dc.addEventListener("dragover",e=>{ e.preventDefault(); }); dc.addEventListener("drop",e=>{ e.preventDefault(); const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) atImportFile(f); }); }
  sec.addEventListener("click",e=>{ if(!AT.armed) return; const k=e.target.closest&&e.target.closest(".knob[data-dst]"); if(k){ const src=AT.armed; atArm(src); atDropMod(src,k.dataset.dst); e.preventDefault(); } });
  sec.addEventListener("input",e=>{ if(e.target.closest&&e.target.closest(".fg-link")) atPaintKnobs(); });
  document.querySelector(".fg-scope").onclick=()=>{ AT.scope=AT.scope==="osc"?"spec":"osc"; };
  AT.built=true; atMachUI(); atTabsUI(); atModRows();
}
function atelierSync(){
  if(!AT.built) return;
  S.syn=synMerge(SYN_DEFAULT,S.syn);
  atPaintKnobs(); atTabsUI(); atModRows();
  buildPiano(); atMachUI(); atDraw();
}

/* ---------- modes : réglages, jeu, atelier ---------- */
function setMode(m){
  if(m==="daw") m="jeu"; /* le mode Arranger a été retiré : le Studio le remplace */
  const old=MODE; MODE=m;
  const jeu=m==="jeu", at=m==="atelier", dw=m==="daw";
  JEU.on=jeu; document.body.classList.toggle("jeu",jeu); document.body.classList.toggle("atelier",at); document.body.classList.toggle("daw",dw);
  $("jeu").hidden=!jeu; if($("atelier")) $("atelier").hidden=!at; if($("daw")) $("daw").hidden=!dw;
  const rw=document.querySelector(".ringwrap"); if(rw) (jeu?$("ringSlot"):document.querySelector(".marge")).appendChild(rw);
  $("reglBtn").setAttribute("aria-pressed",(!jeu&&!at&&!dw)?"true":"false"); if($("dawBtn")) $("dawBtn").setAttribute("aria-pressed",dw?"true":"false");
  if(!jeu&&!at&&!dw&&typeof PP_ROWS!=="undefined") PP_ROWS.forEach(f=>f());
  $("jeuBtn").setAttribute("aria-pressed",jeu?"true":"false");
  $("atelierBtn").setAttribute("aria-pressed",at?"true":"false");
  const mh=$("modeHint"); if(mh) mh.textContent=jeu?"Conduire : la machine joue, tu la pilotes en direct avec des boutons, un pad, le cercle des hauteurs et des gestes musicaux.":dw?"Arranger : des pistes qui bouclent par-dessus la machine, écrites au piano roll ou enregistrées au clavier, avec un mixeur pour tout équilibrer.":at?"Forger : tu construis ton synthé et tu le joues au clavier, dans la gamme du thème, avec ou sans la machine.":"Composer : tout ce qui fait la pièce, chapitre par chapitre. Ouvre un chapitre pour le régler.";
  try{ localStorage.setItem("bourdon.mode2",m); }catch(e){}
  if((old==="atelier"&&!at)||(old==="daw"&&!dw)) atReleaseAll();
  if(old==="daw"&&!dw) dawLeave();
  if(jeu){ JEU.mixSig=""; jeuSync(); jeuState(); }
  if(at){ atelierSync(); atState(); if(!AT.raf) AT.raf=requestAnimationFrame(atLoop); }
  if(dw) dawEnter();
  if(old!==m) window.scrollTo({top:0,behavior:"instant"});
}
function restoreMode(){
  /* première visite : on arrive sur Conduire (une ambiance, Jouer, quelques boutons) */
  let m="jeu"; try{ m=localStorage.getItem("bourdon.mode2")||"jeu"; }catch(e){}
  if(m==="jeu"||m==="atelier"||m==="reglage") MODE=m;
}
