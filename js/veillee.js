"use strict";
/* ============================================================
   VEILLÉE : la machine en grand, à regarder en fond (plein écran possible).
   La partition qui défile, l'oscilloscope, le cercle des notes qui s'allument, le spectre.
   Palette de nuit à la chandelle ; les commandes s'effacent quand on ne touche plus à rien.
   ============================================================ */
const VEIL={on:false, raf:0, idle:0, last:0, n:0, view:{id:"veilCv", ev:null, lo:12, hi:48, cols:null, dpr:1, w:0, h:0, k:1.5, night:true},
  sbuf:null, fbuf:null, sGain:1, bars:[], peak:[], glow:0};

function veilDpr(){ return Math.min(2,window.devicePixelRatio||1); }
function veilSize(cv){ const r=cv.getBoundingClientRect(), d=veilDpr(), w=Math.max(10,Math.round(r.width)), h=Math.max(10,Math.round(r.height)); if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){ cv.width=Math.round(w*d); cv.height=Math.round(h*d); } return {w,h,d}; }
function veilFit(){
  if(!VEIL.on) return;
  const big=window.innerWidth>1100; VEIL.view.k=big?1.5:1.15;
  vizFit(VEIL.view);
  ["veilScope","veilRing","veilSpec"].forEach(id=>{ const cv=$(id); if(cv) veilSize(cv); });
}
/* phosphore : on efface à moitié pour laisser une traînée */
function veilFade(c,W,H,a){ c.globalCompositeOperation="destination-out"; c.fillStyle="rgba(0,0,0,"+a+")"; c.fillRect(0,0,W,H); c.globalCompositeOperation="source-over"; }
function veilScope(an){
  const cv=$("veilScope"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=VIZ_NIGHT;
  c.setTransform(d,0,0,d,0,0); veilFade(c,W,H,0.3);
  c.strokeStyle=C.rule; c.globalAlpha=0.5; c.lineWidth=1; c.beginPath(); c.moveTo(0,Math.round(H/2)+0.5); c.lineTo(W,Math.round(H/2)+0.5); c.stroke(); c.globalAlpha=1;
  if(!an) return;
  const N=an.fftSize, buf=VEIL.sbuf&&VEIL.sbuf.length===N?VEIL.sbuf:(VEIL.sbuf=new Float32Array(N)); an.getFloatTimeDomainData(buf);
  const span=Math.min(1400,N-2); let t=0; for(let i=1;i<N-span;i++){ if(buf[i-1]<=0&&buf[i]>0){ t=i; break; } }
  let pk=0; for(let i=0;i<N;i++){ const a=Math.abs(buf[i]); if(a>pk) pk=a; }
  const target=pk>0.004?Math.min(30,0.55/pk):1; VEIL.sGain=Math.min(VEIL.sGain,target*1.4); VEIL.sGain+=(target-VEIL.sGain)*0.1;
  c.strokeStyle=C.gold; c.lineWidth=2; c.lineJoin="round"; c.shadowColor=C.gold; c.shadowBlur=10; c.beginPath();
  for(let i=0;i<span;i++){ const x=i/(span-1)*W, y=H/2-buf[t+i]*VEIL.sGain*(H/2-8); i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke(); c.shadowBlur=0;
  VEIL.glow+=(Math.min(1,pk*3)-VEIL.glow)*0.08;
}
function veilSpec(an){
  const cv=$("veilSpec"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=VIZ_NIGHT;
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H);
  const NB=Math.max(24,Math.min(72,Math.round(W/9)));
  if(an){
    const n=an.frequencyBinCount, fb=VEIL.fbuf&&VEIL.fbuf.length===n?VEIL.fbuf:(VEIL.fbuf=new Float32Array(n)); an.getFloatFrequencyData(fb);
    const sr=live.ctx.sampleRate, f0=40, f1=Math.min(14000,sr/2);
    for(let i=0;i<NB;i++){
      const fa=f0*Math.pow(f1/f0,i/NB), fz=f0*Math.pow(f1/f0,(i+1)/NB), ka=Math.max(1,Math.floor(fa/(sr/2)*n)), kz=Math.max(ka+1,Math.ceil(fz/(sr/2)*n));
      let m=-200; for(let k=ka;k<kz&&k<n;k++) if(fb[k]>m) m=fb[k];
      const v=Math.max(0,Math.min(1,(m+100)/85)); VEIL.bars[i]=Math.max(v,(VEIL.bars[i]||0)*0.9); VEIL.peak[i]=Math.max(VEIL.bars[i],(VEIL.peak[i]||0)-0.006);
    }
  }else{ for(let i=0;i<NB;i++){ VEIL.bars[i]=(VEIL.bars[i]||0)*0.9; VEIL.peak[i]=(VEIL.peak[i]||0)*0.95; } }
  const bw=W/NB, g=c.createLinearGradient(0,H,0,0); g.addColorStop(0,C.rub); g.addColorStop(1,C.gold);
  for(let i=0;i<NB;i++){
    const h=VEIL.bars[i]*(H-6), x=i*bw+bw*0.15;
    c.globalAlpha=0.85; c.fillStyle=g; c.fillRect(x,H-h,bw*0.7,h);
    c.globalAlpha=0.9; c.fillStyle=C.ink; c.fillRect(x,H-VEIL.peak[i]*(H-6)-2,bw*0.7,1.5);
  }
  c.globalAlpha=1;
}
/* le cercle : les notes de la gamme en petits points, chacune s'allume quand une voix la joue */
function veilRing(now){
  const cv=$("veilRing"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=VIZ_NIGHT;
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H);
  const cx=W/2, cy=H/2, R=Math.min(W,H)/2-14, iv=ivOf(S,typeof curScaleKey==="function"?curScaleKey():S.scales[0]);
  c.strokeStyle=C.rule; c.globalAlpha=0.6; c.lineWidth=1; c.beginPath(); c.arc(cx,cy,R,0,Math.PI*2); c.stroke(); c.globalAlpha=1;
  const pos=o=>{ const a=((o%12+12)%12)/12*Math.PI*2-Math.PI/2; return [cx+R*Math.cos(a), cy+R*Math.sin(a)]; };
  iv.forEach(o=>{ const [x,y]=pos(o); c.fillStyle=C.ink2; c.globalAlpha=o===0?0.9:0.5; c.beginPath(); c.arc(x,y,o===0?4.5:3,0,Math.PI*2); c.fill(); });
  c.globalAlpha=1;
  if(now===null) return;
  const col={mel:C.rub,canon:C.gold,play:C.ink,loop:C.verd,pend:C.verd,pad:C.ink2};
  for(const e of VIZ.ev){
    if(!PITCHED[e.kind]||e.t>now) continue; const age=now-e.t, life=e.kind==="pad"?1.6:Math.max(e.dur,0.3)+0.5; if(age>life) continue;
    const a=1-age/life, [x,y]=pos(e.off);
    c.globalAlpha=a*(e.kind==="pad"?0.35:0.95); c.fillStyle=col[e.kind]||C.ink; c.shadowColor=col[e.kind]||C.ink; c.shadowBlur=e.kind==="pad"?0:16*a;
    c.beginPath(); c.arc(x,y,(e.kind==="pad"?5:6.5)*(0.6+0.6*a),0,Math.PI*2); c.fill();
  }
  c.shadowBlur=0; c.globalAlpha=1;
}
function veilInfo(){
  const k=$("veilKey"), a=$("veilAff"); if(!k||!a) return;
  const key=(typeof curScaleKey==="function"?curScaleKey():S.scales[0])||"mixolydien", nm=NOTES[S.root]+" "+(SC[key]||SC.mixolydien).n.replace(/\s*\(.*\)/,"").toLowerCase();
  const t=nm, u=affTop(key,S.root,3).join(" · ")+(live?"  ·  "+S.tempo+" noires/min":"");
  if(k.textContent!==t) k.textContent=t; if(a.textContent!==u) a.textContent=u;
}
function veilFrame(ts){
  VEIL.raf=0; if(!VEIL.on) return;
  VEIL.raf=requestAnimationFrame(veilFrame);
  if(typeof isEco==="function"&&isEco()&&ts-VEIL.last<33) return; VEIL.last=ts;
  const now=live?live.ctx.currentTime:null, eng=live?live.eng:null, an=eng?eng.analyser("all"):null;
  vizDraw(now,eng,VEIL.view); veilScope(an); veilSpec(an); veilRing(now);
  const v=$("veil"); if(v) v.style.setProperty("--glow",(0.25+0.5*VEIL.glow).toFixed(3));
  if((++VEIL.n)%20===0) veilInfo();
  const b=$("veilPlay"); if(b){ const t=live?"Arrêter":"Jouer"; if(b.textContent!==t) b.textContent=t; }
}
function veilWake(){
  const v=$("veil"); if(!v) return; v.classList.remove("idle"); clearTimeout(VEIL.idle);
  VEIL.idle=setTimeout(()=>{ if(VEIL.on&&!v.contains(document.activeElement&&document.activeElement.matches("button")&&document.activeElement.matches(":focus-visible")?document.activeElement:null)) v.classList.add("idle"); },3500);
}
function veilOpen(){
  const v=$("veil"); if(!v||VEIL.on) return;
  VEIL.on=true; v.hidden=false; document.body.classList.add("veiling"); VEIL.view.ev=VIZ.ev;
  veilFit(); veilInfo(); veilWake();
  VEIL.raf=requestAnimationFrame(veilFrame);
  const c=$("veilClose"); if(c) c.focus({preventScroll:true});
}
function veilClose(){
  const v=$("veil"); if(!v||!VEIL.on) return;
  VEIL.on=false; cancelAnimationFrame(VEIL.raf); clearTimeout(VEIL.idle); v.hidden=true; document.body.classList.remove("veiling");
  try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(e){}
  const b=$("veilBtn"); if(b) b.focus({preventScroll:true});
}
function veilFs(){
  const v=$("veil"); if(!v) return;
  try{ if(document.fullscreenElement) document.exitFullscreen(); else if(v.requestFullscreen) v.requestFullscreen(); }catch(e){}
}
function veilBuild(){
  const open=$("veilBtn"); if(open) open.onclick=veilOpen;
  $("veilClose").onclick=veilClose; $("veilFs").onclick=veilFs;
  $("veilPlay").onclick=()=>{ live?stopLive():startLive(); };
  if(!document.documentElement.requestFullscreen) $("veilFs").hidden=true;
  document.addEventListener("fullscreenchange",()=>{ const b=$("veilFs"); if(b) b.textContent=document.fullscreenElement?"Quitter le plein écran":"Plein écran"; if(VEIL.on) setTimeout(veilFit,80); });
  const v=$("veil"); ["mousemove","pointerdown","touchstart","keydown"].forEach(ev=>v.addEventListener(ev,veilWake,{passive:true}));
  document.addEventListener("keydown",e=>{
    if(!VEIL.on) return;
    if(e.key==="Escape"){ veilClose(); e.preventDefault(); }
    else if((e.key===" "||e.code==="Space")&&!(e.target&&e.target.closest&&e.target.closest("button"))){ live?stopLive():startLive(); e.preventDefault(); }
  });
  if(window.ResizeObserver) new ResizeObserver(()=>veilFit()).observe(v); else window.addEventListener("resize",veilFit);
}
