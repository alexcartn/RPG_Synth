"use strict";
/* ============================================================
   CAPTURE : garder ce qu'on entend (WAV ou MP3) et, au choix, les notes jouées (MIDI)
   La pièce change à chaque lecture : ce bouton sert à garder une prise qui plaît.
   ============================================================ */
const CAP={on:false, ctx:null, engs:[], node:null, sink:null, chunks:[], t0:0, timer:0};
/* format de la prise : mémorisé d'une fois sur l'autre */
const CAP_FMT=[["wav-mid","WAV + MIDI (zip)"],["wav","WAV seul"],["mp3","MP3 seul"],["both","WAV + MP3 (zip)"]];
function capFmt(){ try{ const v=localStorage.getItem("bourdon.capfmt"); if(CAP_FMT.some(x=>x[0]===v)) return v; }catch(e){} return "wav-mid"; }
function capFmtBuild(){
  const sel=$("capFmt"); if(!sel||sel.options.length) return;
  CAP_FMT.forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; sel.appendChild(o); });
  sel.value=capFmt(); sel.onchange=()=>{ try{ localStorage.setItem("bourdon.capfmt",sel.value); }catch(e){} capUI(); };
}
function capUI(){
  const b=$("capBtn"), n=$("capNote"); if(!b) return;
  b.disabled=!live&&!CAP.on; b.setAttribute("aria-pressed",CAP.on?"true":"false"); b.innerHTML=(CAP.on?ic("arreter"):ic("capturer"))+(CAP.on?"Arrêter et enregistrer":"Capturer la lecture");
  if(n&&!CAP.on) n.textContent=live?"Garde ce que tu entends, dans le format choisi.":"Lance la lecture, puis capture ce qui te plaît.";
}
function capTick(){ const n=$("capNote"); if(!CAP.on||!n||!live) return; const s=Math.round(live.ctx.currentTime-CAP.t0); n.textContent="Capture en cours : "+Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
function capStart(){
  if(!live||CAP.on||!live.ctx.createScriptProcessor) return;
  const ctx=live.ctx, sp=ctx.createScriptProcessor(4096,2,2), z=ctx.createGain(); z.gain.value=0;
  sp.onaudioprocess=e=>{ if(!CAP.on) return; CAP.chunks.push([new Float32Array(e.inputBuffer.getChannelData(0)),new Float32Array(e.inputBuffer.getChannelData(1))]); };
  live.eng.tap().connect(sp); sp.connect(z); z.connect(ctx.destination);
  Object.assign(CAP,{on:true,ctx,node:sp,sink:z,chunks:[],t0:ctx.currentTime,engs:[live.eng],timer:setInterval(capTick,500)});
  capUI(); capTick();
}
/* un fondu enchaîné change de moteur : la capture suit le nouveau */
function capRewire(){ if(!CAP.on||!live) return; try{ live.eng.tap().connect(CAP.node); }catch(e){} if(CAP.engs.indexOf(live.eng)<0) CAP.engs.push(live.eng); }
async function capStop(){
  if(!CAP.on) return; CAP.on=false; clearInterval(CAP.timer);
  const {ctx,node,sink,chunks,t0,engs}=CAP, t1=ctx.currentTime;
  try{ node.disconnect(); sink.disconnect(); }catch(e){}
  CAP.engs=[]; CAP.node=null; CAP.sink=null; CAP.chunks=[];
  const n=chunks.reduce((a,c)=>a+c[0].length,0), nt=$("capNote");
  if(!n){ capUI(); return; }
  const L=new Float32Array(n), R=new Float32Array(n); let o=0; chunks.forEach(([l,r])=>{ L.set(l,o); R.set(r,o); o+=l.length; });
  const base="bourdon_capture_"+Date.now().toString(36).slice(-5), fmt=capFmt(), files=[], gain=0.891/(peakOf(L,R)||1);
  if(fmt!=="mp3") files.push({name:base+".wav",data:wavFromChannels(L,R,ctx.sampleRate,gain)});
  if(fmt==="mp3"||fmt==="both"){
    if(nt) nt.textContent="Encodage MP3...";
    try{ files.push({name:base+".mp3",data:new Blob([await mp3FromChannels(L,R,ctx.sampleRate,gain,320)],{type:"audio/mpeg"})}); }
    catch(e){ if(nt) nt.textContent=String(e.message||e); if(!files.length){ files.push({name:base+".wav",data:wavFromChannels(L,R,ctx.sampleRate,gain)}); } }
  }
  if(fmt==="wav-mid"){ const ev=engs.flatMap(e=>e.events).filter(e=>e.t>=t0&&e.t<t1).map(e=>({...e,t:e.t-t0})); if(ev.length) files.push({name:base+".mid",data:midiFile(ev,S)}); }
  const kind=saveFiles(files,base), what=files.map(f=>f.name.split(".").pop().toUpperCase()).join(" et ");
  capUI(); if(nt&&(!nt.textContent||/^Encodage/.test(nt.textContent)||!/introuvable|inutilisable/.test(nt.textContent))) nt.textContent="Capture enregistrée : "+(kind==="zip"?"un .zip avec ":"")+what+".";
}
