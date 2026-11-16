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
  const cv=$(id); if(!cv) return; const g=fit(cv); if(!g) return; const {c,W,H}=g, n=SYN_WAVES.length, sl=atSlices(), P=S.syn[key].wave;
  const cs=getComputedStyle(document.documentElement), bg=cs.getPropertyValue("--parch").trim()||"#efe6d2";
  const dx=Math.min(7,(W*0.22)/(n-1)), dy=(H-30)/(n-1), A=Math.max(9,dy*2.6), x0=8, wd=W-16-dx*(n-1), draw=(arr,j,stroke,lw)=>{
    const yb=H-12-j*dy, xo=x0+j*dx; c.beginPath();
    for(let k=0;k<arr.length;k++){ const x=xo+k/(arr.length-1)*wd, y=yb-arr[k]*A*0.5-A*0.15; k?c.lineTo(x,y):c.moveTo(x,y); }
    c.lineTo(xo+wd,yb+3); c.lineTo(xo,yb+3); c.closePath(); c.fillStyle=bg; c.fill(); c.strokeStyle=stroke; c.lineWidth=lw; c.beginPath();
    for(let k=0;k<arr.length;k++){ const x=xo+k/(arr.length-1)*wd, y=yb-arr[k]*A*0.5-A*0.15; k?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
  };
  for(let j=n-1;j>=0;j--) draw(sl[j],j,"rgba(90,70,45,"+(0.28+0.4*(1-j/(n-1)))+")",1);
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
  c.fillStyle=g.rub; for(let i=0;i<N;i+=4){ const x=i/N*W, y=H/2-d[i]*(H/2-8); c.fillRect(x-1.5,y-1.5,3,3); }
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
  drawWave("atWA","oscA"); drawWave("atWB","oscB"); drawTabula(); drawFilter(); drawEnv("atEA","envA"); drawEnv("atEF","envF"); drawEnv("atE2","env2");
}
function atDirty(){
  const n=$("synPatchName"); if(n&&!n.dataset.dirty){ n.dataset.dirty="1"; n.textContent+=" (modifié)"; }
  if(AT.drawQ) return; AT.drawQ=requestAnimationFrame(()=>{ AT.drawQ=0; atDraw(); });
}

/* ---------- oscilloscope et spectre ---------- */
function atScopeDraw(){
  const cv=$("atScope"); if(!cv||MODE!=="atelier") return; const g=fit(cv); if(!g) return; const {c,W,H}=g, ro=$("atScopeRead");
  c.strokeStyle="rgba(120,100,70,0.25)"; c.lineWidth=1; c.setLineDash([2,4]);
  [0.25,0.5,0.75].forEach(q=>{ const y=Math.round(H*q)+0.5; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); });
  for(let q=1;q<8;q++){ const x=Math.round(W*q/8)+0.5; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); } c.setLineDash([]);
  const an=live?live.eng.analyser(AT.scopeSrc):null;
  if(!an){ c.fillStyle=g.ink2; c.font='italic 15px "Alegreya", Georgia, serif'; c.textAlign="center"; c.fillText("Joue une note : le signal apparaît ici.",W/2,H/2+5); c.textAlign="left"; if(ro) ro.textContent=""; return; }
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
function atLoop(){ if(MODE!=="atelier"){ AT.raf=0; return; } atScopeDraw(); AT.raf=requestAnimationFrame(atLoop); }
function atScopeUI(){
  [["atScOsc","osc"],["atScSpec","spec"]].forEach(([id,v])=>{ const b=$(id); if(b) b.setAttribute("aria-pressed",AT.scope===v?"true":"false"); });
  const sp=$("atScSpan"); if(sp) sp.hidden=AT.scope!=="osc";
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

/* ---------- construction ---------- */
function buildAtelier(){
  const host=document.querySelector(".folio"), sec=atEl("section","atelier"); sec.id="atelier"; sec.hidden=true; sec.setAttribute("aria-label","Forger un synthé");
  /* barre du haut */
  const bar=atEl("div","at-bar");
  bar.innerHTML='<div class="at-title"><span class="kicker">atelier</span><span class="nm" id="synPatchName">Pad doux</span></div>'+
    '<button class="btn tgl" id="atMach" type="button" aria-pressed="true">La machine</button>'+
    '<div class="ctl atpatch"><label for="synPatch">Patch</label><select id="synPatch"></select></div>'+
    '<button class="lnk" id="synRandom" type="button">Au sort</button>'+
    '<details class="fin atsave"><summary>Enregistrer ou supprimer</summary><div class="row"><div class="ctl atname"><label for="synName">Nom</label><input type="text" id="synName" maxlength="40" placeholder="Mon patch"></div><button class="lnk" id="synSaveBtn" type="button">Enregistrer sous ce nom</button><button class="lnk" id="synDelBtn" type="button">Supprimer le patch choisi</button></div></details>';
  sec.appendChild(bar);
  sec.appendChild(atEl("p","hint","",)).id="atHint";
  /* face avant : douze colonnes, tout le synthé en un coup d'œil */
  const grid=atEl("div","at-grid");
  const put=(span,m)=>{ m.classList.add("g"+span); grid.appendChild(m); return m; };
  const K=(path,label,min,max,o)=>synKnob(path,label,min,max,o);
  const sel3=[{k:"syn.%.oct",type:"select",label:"Octave",opts:octOpts,num:true},{k:"syn.%.semi",type:"select",label:"Intervalle",opts:semiOpts,num:true},{k:"syn.%.uni",type:"select",label:"Unisson",opts:uniOpts,num:true}];
  /* rang 1 : oscillateurs, filtre, speculum */
  [["oscA","Oscillateur A","atWA"],["oscB","Oscillateur B","atWB"]].forEach(([k,t,cvid])=>{
    const m=atMod(t); m.appendChild(atCanvas(cvid,72));
    m.appendChild(atKnobs([K(k+".wave","Table",0,1,{fmt:v=>SYN_WAVES[Math.min(SYN_WAVES.length-1,Math.round(v*(SYN_WAVES.length-1)))]}),K(k+".lvl","Niveau",0,1,{fmt:fmtP}),K(k+".det","Désaccord",-50,50,{fmt:fmtC,step:1}),K(k+".spread","Écart",0,40,{fmt:v=>Math.round(v)+" ¢",step:1})]));
    m.appendChild(atFields(sel3.map(x=>({...x,k:x.k.replace("%",k)}))));
    put(3,m);
  });
  const mf=atMod("Filtre"); mf.appendChild(atCanvas("atFil",72));
  mf.appendChild(atKnobs([K("fil.cut","Coupure",40,16000,{log:true,fmt:fmtHz}),K("fil.res","Résonance",0.1,14,{log:true,fmt:v=>v.toFixed(1)}),K("fil.key","Clavier",0,1,{fmt:fmtP}),K("fil.env","Envel.",-4800,4800,{fmt:fmtC,step:50})]));
  mf.appendChild(atFields([{k:"syn.fil.type",type:"select",label:"Type",opts:[["lowpass","Passe-bas 12 dB"],["lowpass24","Passe-bas 24 dB"],["highpass","Passe-haut 12 dB"],["highpass24","Passe-haut 24 dB"],["bandpass","Passe-bande"],["notch","Coupe-bande"]]}]));
  put(3,mf);
  const sp=atMod("Oscilloscope"); sp.classList.add("at-scopebox");
  sp.appendChild(atEl("div","at-scbar",'<div class="at-tabs"><button class="lnk" id="atScOsc" type="button" aria-pressed="true">Oscillo</button><button class="lnk" id="atScSpec" type="button" aria-pressed="false">Spectre</button></div><span class="at-read" id="atScopeRead" aria-live="off"></span>'));
  sp.appendChild(atCanvas("atScope",96));
  sp.appendChild(atEl("div","at-scbar",'<label class="at-sel">Source <select id="atScSrc"><option value="syn">Synthé</option><option value="all">Mélange</option></select></label><label class="at-sel" id="atScSpan">Fenêtre <select id="atScSpanSel"><option value="512">Courte</option><option value="1024" selected>Moyenne</option><option value="2048">Large</option></select></label>'));
  put(3,sp);
  /* rang 2 : trois enveloppes et les LFO */
  [["envA","Enveloppe","volume","atEA"],["envF","Enveloppe","filtre","atEF"],["env2","Enveloppe","modulation","atE2"]].forEach(([k,t,fr,id])=>{
    const m=atMod(t,fr); m.appendChild(atCanvas(id,52));
    m.appendChild(atKnobs([K(k+".a","Attaque",0.002,6,{log:true,fmt:fmtS}),K(k+".d","Déclin",0.01,6,{log:true,fmt:fmtS}),K(k+".s","Maintien",0,1,{fmt:fmtP}),K(k+".r","Relâche",0.01,8,{log:true,fmt:fmtS})]));
    put(3,m);
  });
  const ml=atMod("Modulation lente","trois LFO");
  ml.appendChild(atKnobs([K("lfo1.rate","LFO 1",0.03,25,{log:true,fmt:v=>v.toFixed(2)+" Hz"}),K("lfo2.rate","LFO 2",0.03,25,{log:true,fmt:v=>v.toFixed(2)+" Hz"}),K("lfo3.rate","LFO 3",0.03,25,{log:true,fmt:v=>v.toFixed(2)+" Hz"})]));
  ml.appendChild(atFields([{k:"syn.lfo1.shape",type:"select",label:"Forme 1",opts:shapeOpts},{k:"syn.lfo2.shape",type:"select",label:"Forme 2",opts:shapeOpts},{k:"syn.lfo3.shape",type:"select",label:"Forme 3",opts:shapeOpts}]));
  put(3,ml);
  /* rang 3 : voix, table dessinée, rack */
  const m3=atMod("Compléments","sous-osc., bruit, FM, voix");
  m3.appendChild(atKnobs([K("sub.lvl","Sous-osc.",0,1,{fmt:fmtP}),K("noise.lvl","Bruit",0,1,{fmt:fmtP}),K("fm.amt","FM",0,1.5,{fmt:v=>v.toFixed(2)}),K("fm.ratio","Rapport",0.5,8,{step:0.5,fmt:v=>"× "+v.toFixed(1)}),K("mono.glide","Glisse",0.01,1.5,{log:true,fmt:fmtS}),K("fx.drive","Saturat.",0,1,{fmt:fmtP}),K("fx.level","Niveau",0.05,4,{log:true,fmt:v=>"× "+v.toFixed(2)}),K("vel.amt","Vélocité",0,1,{fmt:fmtP})]));
  m3.appendChild(atFields([{k:"syn.sub.shape",type:"select",label:"Sous-osc.",opts:[["sine","Sinus"],["square","Carré"]]},{k:"syn.mono.on",type:"select",label:"Jeu",opts:[[0,"Polyphonique"],[1,"Mono, glissando"]],num:true}]));
  put(3,m3);
  const mt=atMod("Table dessinée","dessine une table");
  mt.appendChild(atCanvas("atDrawCv",64));
  mt.appendChild(atEl("div","at-dr",'<button class="lnk" id="atDrSin" type="button">Sinus</button><button class="lnk" id="atDrSaw" type="button">Dent</button><button class="lnk" id="atDrSq" type="button">Carré</button><button class="lnk" id="atDrSmooth" type="button">Lisser</button><button class="lnk" id="atDrRnd" type="button">Hasard</button>'));
  mt.appendChild(atEl("p","hint","Tire sur la courbe, puis mets la Table d'un oscillateur tout à droite (« Dessinée »)."));
  put(3,mt);
  const mr=atMod("Effets","rack d'effets"); const rk=atEl("div","at-rack");
  const grp=(t,knobs)=>{ const g=atEl("div","at-rg"); g.appendChild(atEl("h4","",t)); g.appendChild(atKnobs(knobs)); rk.appendChild(g); };
  const dB=v=>(v>0?"+":"")+v.toFixed(1)+" dB";
  grp("Chorus",[K("rack.chorus.mix","Mélange",0,1,{fmt:fmtP}),K("rack.chorus.rate","Vitesse",0.1,6,{log:true,fmt:v=>v.toFixed(1)+" Hz"}),K("rack.chorus.depth","Profond.",0,1,{fmt:fmtP})]);
  grp("Écho",[K("rack.delay.mix","Mélange",0,1,{fmt:fmtP}),K("rack.delay.time","Temps",0.05,1.2,{log:true,fmt:v=>Math.round(v*1000)+" ms"}),K("rack.delay.fb","Répét.",0,0.9,{fmt:fmtP})]);
  grp("Salle",[K("rack.rev.mix","Réverb",0,1,{fmt:fmtP})]);
  grp("Égaliseur",[K("rack.eq.lo","Graves",-12,12,{fmt:dB,step:0.5}),K("rack.eq.mid","Médiums",-12,12,{fmt:dB,step:0.5}),K("rack.eq.hi","Aigus",-12,12,{fmt:dB,step:0.5})]);
  grp("Compres.",[K("rack.comp.amt","Force",0,1,{fmt:fmtP})]);
  mr.appendChild(rk); put(6,mr);
  /* rang 4 : matrice de modulation */
  const mm=atMod("Matrice de modulation","huit sources vers huit paramètres"); const slots=atEl("div","at-slots");
  for(let i=0;i<8;i++){
    const row=atEl("div","at-slot"); row.appendChild(atEl("span","n",String(i+1)));
    row.appendChild(atFields([{k:"syn.mod."+i+".src",type:"select",label:"Source",opts:SYN_SRC},{k:"syn.mod."+i+".dst",type:"select",label:"Destination",opts:SYN_DST},{k:"syn.mod."+i+".amt",type:"range",label:"Quantité",min:-1,max:1,step:0.01,fmt:v=>(v>0?"+":"")+Math.round(v*100)+" %"}]));
    slots.appendChild(row);
  }
  mm.appendChild(slots); put(12,mm);
  sec.appendChild(grid);
  /* clavier */
  const kb=atEl("div","at-kb"); kb.id="atKb"; kb.innerHTML='<div class="row at-kbbar"><span class="ctl"><label for="atOct">Octave du clavier</label></span><select id="atOct"></select><button class="btn" id="atScale" type="button" aria-pressed="true" title="Toutes les touches dans la gamme du thème en cours">Dans la gamme</button><button class="btn" id="atHold" type="button" aria-pressed="false">Maintien</button><button class="btn" id="atPanic" type="button">Tout couper</button></div><div class="piano" id="piano" aria-label="Clavier"></div>';
  sec.appendChild(kb);
  /* échanger un patch */
  const ex=atEl("details","fin"); ex.innerHTML='<summary>Échanger un patch (texte)</summary><div class="fields"><div class="ctl"><label for="synOut">Ton patch</label><textarea id="synOut" readonly></textarea><div class="row"><button class="lnk" id="synCopy" type="button">Copier</button></div></div><div class="ctl"><label for="synIn">Coller un patch</label><textarea id="synIn" placeholder="Colle ici un patch reçu"></textarea><div class="row"><button class="lnk" id="synLoadTxt" type="button">Charger ce patch</button></div></div></div>';
  sec.appendChild(ex);
  host.insertBefore(sec,document.querySelector(".cols"));
  /* branchements */
  const oc=$("atOct"); [[-1,"Grave (Do2)"],[0,"Médium (Do3)"],[1,"Aigu (Do4)"],[2,"Très aigu (Do5)"]].forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; oc.appendChild(o); }); oc.value=AT.oct; oc.setAttribute("aria-label","Octave du clavier");
  oc.onchange=()=>{ atReleaseAll(); AT.oct=parseInt(oc.value,10); buildPiano(); };
  try{ AT.scale=localStorage.getItem("bourdon.atscale")!=="0"; }catch(e){}
  buildPiano();
  const pk=$("piano"); const target=e=>e.target.closest&&e.target.closest(".pk");
  pk.addEventListener("pointerdown",e=>{ const k=target(e); if(!k) return; e.preventDefault(); try{ k.setPointerCapture(e.pointerId); }catch(x){} atOn("p"+e.pointerId,parseInt(k.dataset.i,10)); });
  const up=e=>atOff("p"+e.pointerId); pk.addEventListener("pointerup",up); pk.addEventListener("pointercancel",up); pk.addEventListener("lostpointercapture",up);
  document.addEventListener("keydown",e=>atKeys(e,true)); document.addEventListener("keyup",e=>atKeys(e,false));
  $("atHold").onclick=()=>{ AT.hold=!AT.hold; $("atHold").setAttribute("aria-pressed",AT.hold?"true":"false"); if(!AT.hold){ AT.latch.forEach(n=>n.h.release()); AT.latch=[]; document.querySelectorAll("#piano .pk.on").forEach(k=>{ if(![...AT.notes.values()].some(n=>n.i==k.dataset.i)) k.classList.remove("on"); }); } };
  $("atScale").onclick=()=>{ atReleaseAll(); AT.scale=!AT.scale; try{ localStorage.setItem("bourdon.atscale",AT.scale?"1":"0"); }catch(e){} buildPiano(); atState(); };
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
  atWaveDrag("atWA","oscA"); atWaveDrag("atWB","oscB"); tabulaEvents();
  $("atScOsc").onclick=()=>{ AT.scope="osc"; atScopeUI(); }; $("atScSpec").onclick=()=>{ AT.scope="spec"; atScopeUI(); };
  $("atScSrc").onchange=()=>{ AT.scopeSrc=$("atScSrc").value; }; $("atScSpanSel").onchange=()=>{ AT.scopeSpan=parseInt($("atScSpanSel").value,10); };
  atScopeUI();
  AT.built=true; atMachUI();
}
function atelierSync(){
  if(!AT.built) return;
  S.syn=synMerge(SYN_DEFAULT,S.syn);
  document.querySelectorAll("#atelier .knob").forEach(el=>paintKnob(el,el._spec));
  buildPiano(); atMachUI(); atDraw();
}

/* ---------- modes : réglages, jeu, atelier ---------- */
function setMode(m){
  const old=MODE; MODE=m;
  const jeu=m==="jeu", at=m==="atelier", dw=m==="daw";
  JEU.on=jeu; document.body.classList.toggle("jeu",jeu); document.body.classList.toggle("atelier",at); document.body.classList.toggle("daw",dw);
  $("jeu").hidden=!jeu; if($("atelier")) $("atelier").hidden=!at; if($("daw")) $("daw").hidden=!dw;
  const rw=document.querySelector(".ringwrap"); if(rw) (jeu?$("ringSlot"):document.querySelector(".marge")).appendChild(rw);
  /* le choix de l'ambiance suit le mode : en tête du panneau en Conduire, dans la marge en Composer */
  const pb=$("presetBox"), ps=$("presetSlot"); if(pb&&ps) (jeu?ps:document.querySelector(".marge")).appendChild(pb);
  $("reglBtn").setAttribute("aria-pressed",(!jeu&&!at&&!dw)?"true":"false"); $("dawBtn").setAttribute("aria-pressed",dw?"true":"false");
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
  if(m==="jeu"||m==="atelier"||m==="daw"||m==="reglage") MODE=m;
}
