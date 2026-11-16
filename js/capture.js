"use strict";
/* ============================================================
   CAPTURE : garder ce qu'on entend (WAV) et les notes jouées (MIDI)
   La pièce change à chaque lecture : ce bouton sert à garder une prise qui plaît.
   ============================================================ */
const CAP={on:false, ctx:null, engs:[], node:null, sink:null, chunks:[], t0:0, timer:0};
function capUI(){
  const b=$("capBtn"), n=$("capNote"); if(!b) return;
  b.disabled=!live&&!CAP.on; b.setAttribute("aria-pressed",CAP.on?"true":"false"); b.textContent=CAP.on?"Arrêter et enregistrer":"Capturer la lecture";
  if(n&&!CAP.on) n.textContent=live?"Garde ce que tu entends : audio WAV et notes MIDI.":"Lance la lecture, puis capture ce qui te plaît.";
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
function capStop(){
  if(!CAP.on) return; CAP.on=false; clearInterval(CAP.timer);
  const {ctx,node,sink,chunks,t0,engs}=CAP, t1=ctx.currentTime;
  try{ node.disconnect(); sink.disconnect(); }catch(e){}
  CAP.engs=[]; CAP.node=null; CAP.sink=null; CAP.chunks=[];
  const n=chunks.reduce((a,c)=>a+c[0].length,0), nt=$("capNote");
  if(!n){ capUI(); return; }
  const L=new Float32Array(n), R=new Float32Array(n); let o=0; chunks.forEach(([l,r])=>{ L.set(l,o); R.set(r,o); o+=l.length; });
  const base="bourdon_capture_"+Date.now().toString(36).slice(-5), files=[{name:base+".wav",data:wavFromChannels(L,R,ctx.sampleRate,0.891/(peakOf(L,R)||1))}];
  const ev=engs.flatMap(e=>e.events).filter(e=>e.t>=t0&&e.t<t1).map(e=>({...e,t:e.t-t0}));
  if(ev.length) files.push({name:base+".mid",data:midiFile(ev,S)});
  const kind=saveFiles(files,base);
  capUI(); if(nt) nt.textContent=kind==="zip"?"Capture enregistrée : un .zip avec le WAV et le MIDI.":"Capture enregistrée (WAV).";
}
