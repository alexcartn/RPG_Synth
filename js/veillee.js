"use strict";
/* ============================================================
   VEILLÉE : la machine en grand, à regarder en fond (plein écran possible).
   Un panneau d'instrument sur parchemin : afficheur à cristaux (ton, tempo, mesure, section, affects),
   quatre modules numérotés (partition, oscilloscope, cadran des notes, spectre à segments).
   Les touches et le pied de page s'effacent quand on ne touche plus à rien.
   ============================================================ */
const VEIL={on:false, raf:0, idle:0, last:0, n:0, view:{id:"veilCv", el:"veil", lo:12, hi:48, cols:null, dpr:1, w:0, h:0, k:1.4},
  sbuf:null, fbuf:null, sGain:1, bars:[], peak:[], txt:{}};

const veilDpr=()=>Math.min(2,window.devicePixelRatio||1);
function veilSize(cv){ const r=cv.getBoundingClientRect(), d=veilDpr(), w=Math.max(10,Math.round(r.width)), h=Math.max(10,Math.round(r.height)); if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){ cv.width=Math.round(w*d); cv.height=Math.round(h*d); } return {w,h,d}; }
const veilC=()=>VEIL.view.cols||{ink:"#3a2e22",ink2:"#6b5a46",rub:"#a3301c",gold:"#a8812a",verd:"#2f7a66",rule:"#b8a888",bg:"#e8dcc2"};
function veilFit(){
  if(!VEIL.on) return;
  VEIL.view.k=window.innerWidth>1100?1.4:1.1;
  vizFit(VEIL.view);
  ["veilScope","veilRing","veilSpec"].forEach(id=>{ const cv=$(id); if(cv) veilSize(cv); });
}
/* graticule : filets pointillés, comme sur un écran d'oscilloscope */
function veilGrid(c,W,H,nx,ny,C){
  c.strokeStyle=C.rule; c.lineWidth=1; c.setLineDash([2,4]); c.globalAlpha=0.9;
  for(let i=1;i<nx;i++){ const x=Math.round(W*i/nx)+0.5; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); }
  for(let j=1;j<ny;j++){ const y=Math.round(H*j/ny)+0.5; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
  c.setLineDash([]); c.globalAlpha=1;
}
function veilScope(an){
  const cv=$("veilScope"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=veilC();
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H); veilGrid(c,W,H,8,4,C);
  c.strokeStyle=C.ink2; c.globalAlpha=0.7; c.beginPath(); c.moveTo(0,Math.round(H/2)+0.5); c.lineTo(W,Math.round(H/2)+0.5); c.stroke(); c.globalAlpha=1;
  let db="";
  if(an){
    const N=an.fftSize, buf=VEIL.sbuf&&VEIL.sbuf.length===N?VEIL.sbuf:(VEIL.sbuf=new Float32Array(N)); an.getFloatTimeDomainData(buf);
    const span=Math.min(1400,N-2); let t=0; for(let i=1;i<N-span;i++){ if(buf[i-1]<=0&&buf[i]>0){ t=i; break; } }
    let pk=0; for(let i=0;i<N;i++){ const a=Math.abs(buf[i]); if(a>pk) pk=a; }
    const target=pk>0.004?Math.min(30,0.62/pk):1; VEIL.sGain=Math.min(VEIL.sGain,target*1.3); VEIL.sGain+=(target-VEIL.sGain)*0.1;
    c.strokeStyle=C.ink; c.lineWidth=1.7; c.lineJoin="round"; c.beginPath();
    for(let i=0;i<span;i++){ const x=i/(span-1)*W, y=H/2-buf[t+i]*VEIL.sGain*(H/2-8); i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
    db=pk>0.0005?"crête "+(20*Math.log10(pk)).toFixed(0)+" dB":"silence";
  }
  veilText("vlPk",db);
}
/* spectre à segments, comme un vumètre de table de mixage : cases pleines sous le niveau, la crête garde une case rouge */
function veilSpec(an){
  const cv=$("veilSpec"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=veilC();
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H);
  const NB=Math.max(14,Math.min(32,Math.round(W/22))), cell=6, gap=4, rows=Math.max(6,Math.floor((H-6)/(cell+gap)));
  if(an){
    const n=an.frequencyBinCount, fb=VEIL.fbuf&&VEIL.fbuf.length===n?VEIL.fbuf:(VEIL.fbuf=new Float32Array(n)); an.getFloatFrequencyData(fb);
    const sr=live.ctx.sampleRate, f0=40, f1=Math.min(14000,sr/2);
    for(let i=0;i<NB;i++){
      const fa=f0*Math.pow(f1/f0,i/NB), fz=f0*Math.pow(f1/f0,(i+1)/NB), ka=Math.max(1,Math.floor(fa/(sr/2)*n)), kz=Math.max(ka+1,Math.ceil(fz/(sr/2)*n));
      let m=-200; for(let k=ka;k<kz&&k<n;k++) if(fb[k]>m) m=fb[k];
      const v=Math.max(0,Math.min(1,(m+100)/85)); VEIL.bars[i]=Math.max(v,(VEIL.bars[i]||0)*0.88); VEIL.peak[i]=Math.max(VEIL.bars[i],(VEIL.peak[i]||0)-0.012);
    }
  }else for(let i=0;i<NB;i++){ VEIL.bars[i]=(VEIL.bars[i]||0)*0.88; VEIL.peak[i]=(VEIL.peak[i]||0)*0.9; }
  const bw=W/NB, x0=(bw-Math.min(bw-6,14))/2, cw=Math.min(bw-6,14), y0=H-4;
  for(let i=0;i<NB;i++){
    const lit=Math.round((VEIL.bars[i]||0)*rows), pk=Math.min(rows-1,Math.round((VEIL.peak[i]||0)*rows));
    for(let r=0;r<rows;r++){
      const x=i*bw+x0, y=y0-(r+1)*(cell+gap)+gap;
      if(r<lit){ c.fillStyle=r>=rows*0.8?C.rub:C.ink2; c.fillRect(x,y,cw,cell); }
      else if(r===pk&&lit>0){ c.fillStyle=C.rub; c.fillRect(x,y,cw,cell); }
      else{ c.strokeStyle=C.rule; c.globalAlpha=0.7; c.lineWidth=1; c.strokeRect(x+0.5,y+0.5,cw-1,cell-1); c.globalAlpha=1; }
    }
  }
}
/* cadran : graduation en 24 crans (quarts de ton compris), noms des notes, notes de la gamme pleines, notes jouées allumées */
function veilRing(now){
  const cv=$("veilRing"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=veilC();
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H);
  const cx=W/2, cy=H/2, R=Math.max(20,Math.min(W,H)/2-26), iv=ivOf(S,typeof curScaleKey==="function"?curScaleKey():S.scales[0]);
  const ang=o=>((o%12+12)%12)/12*Math.PI*2-Math.PI/2, pt=(o,r)=>[cx+r*Math.cos(ang(o)), cy+r*Math.sin(ang(o))];
  c.strokeStyle=C.ink; c.lineWidth=1; c.beginPath(); c.arc(cx,cy,R,0,Math.PI*2); c.stroke();
  c.strokeStyle=C.rule; c.beginPath(); c.arc(cx,cy,R*0.62,0,Math.PI*2); c.stroke();
  for(let q=0;q<24;q++){ const o=q/2, major=q%2===0, [x0,y0]=pt(o,R), [x1,y1]=pt(o,R+(major?-8:-4)); c.strokeStyle=C.ink; c.lineWidth=major?1.3:0.8; c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke(); }
  c.font='400 11px "IM Fell English SC", Georgia, serif'; c.textAlign="center"; c.textBaseline="middle";
  for(let o=0;o<12;o++){ const [x,y]=pt(o,R+14), inScale=iv.indexOf(o)>=0; c.fillStyle=inScale?C.ink:C.ink2; c.globalAlpha=inScale?1:0.55; c.fillText(NOTES[(S.root+o)%12],x,y); }
  c.globalAlpha=1;
  /* rayons vers les notes de la gamme, puces pleines au bout */
  iv.forEach(o=>{ const [x0,y0]=pt(o,R*0.62), [x1,y1]=pt(o,R-12); c.strokeStyle=C.ink2; c.globalAlpha=0.5; c.lineWidth=1; c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke(); c.globalAlpha=1; c.fillStyle=o===0?C.rub:C.ink; c.fillRect(x1-3,y1-3,6,6); });
  if(now===null) return;
  const col={mel:C.rub,canon:C.gold,play:C.ink,loop:C.verd,pend:C.verd,pad:C.ink2};
  for(const e of VIZ.ev){
    if(!PITCHED[e.kind]||e.t>now) continue; const age=now-e.t, life=e.kind==="pad"?1.6:Math.max(e.dur,0.3)+0.5; if(age>life) continue;
    const a=1-age/life, [x,y]=pt(e.off,R-12), [xi,yi]=pt(e.off,R*0.62);
    c.strokeStyle=col[e.kind]||C.ink; c.globalAlpha=a*(e.kind==="pad"?0.4:1); c.lineWidth=e.kind==="pad"?1:2; c.beginPath(); c.moveTo(xi,yi); c.lineTo(x,y); c.stroke();
    if(e.kind!=="pad"){ c.fillStyle=col[e.kind]||C.ink; c.beginPath(); c.arc(x,y,4+5*a,0,Math.PI*2); c.fill(); }
  }
  c.globalAlpha=1;
}
function veilText(id,t){ if(VEIL.txt[id]===t) return; VEIL.txt[id]=t; const e=$(id); if(e) e.textContent=t; }
/* afficheur : ton, tempo, mesure en cours, section, affects */
function veilInfo(now,eng){
  const key=(typeof curScaleKey==="function"?curScaleKey():S.scales[0])||"mixolydien", sc=(SC[key]||SC.mixolydien);
  veilText("vlKey",NOTES[S.root]+" "+sc.n.replace(/\s*\(.*\)/,"").toLowerCase());
  veilText("vlTempo",live?S.tempo+" bpm":S.tempo+" bpm");
  veilText("vlAff",affTop(key,S.root,3).join(" · "));
  if(live&&eng&&now!==null){
    const bar=eng.bar, t0=eng.t0f(), b=Math.max(0,Math.floor((now-t0)/bar)), n=parseInt(S.meter,10)||4, beat=1+Math.floor((((now-t0)%bar)/bar)*n);
    veilText("vlBar",String(b+1).padStart(3,"0")+" · "+beat);
    const sec=eng.secAt(now), sn=Math.floor(Math.max(0,now-t0)/(S.sectionBars*bar))+1;
    veilText("vlSec",sn+" · "+(sec.role||"thème"));
  }else{ veilText("vlBar","-"); veilText("vlSec","-"); }
}
function veilFrame(ts){
  VEIL.raf=0; if(!VEIL.on) return;
  VEIL.raf=requestAnimationFrame(veilFrame);
  if(((typeof isEco==="function"&&isEco())||(window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches))&&ts-VEIL.last<66) return; VEIL.last=ts;
  const now=live?live.ctx.currentTime:null, eng=live?live.eng:null, an=eng?eng.analyser("all"):null;
  vizDraw(now,eng,VEIL.view); veilScope(an); veilSpec(an); veilRing(now);
  if((++VEIL.n)%6===0){ veilInfo(now,eng); const b=$("veilPlay"); if(b){ const sp=b.querySelector("span"), t=live?"Arrêter":"Jouer"; if(sp&&sp.textContent!==t) sp.textContent=t; b.classList.toggle("on",!!live); const ip=b.querySelector(".ip"), is=b.querySelector(".is"); if(ip) ip.style.display=live?"none":""; if(is) is.style.display=live?"":"none"; } }
}
function veilWake(){
  const v=$("veil"); if(!v) return; v.classList.remove("idle"); clearTimeout(VEIL.idle);
  VEIL.idle=setTimeout(()=>{ if(VEIL.on) v.classList.add("idle"); },4000);
}
/* palette de nuit : mémorisée */
function veilNight(on){
  const v=$("veil"), b=$("veilNight"); if(!v) return;
  v.classList.toggle("night",!!on); if(b) b.setAttribute("aria-pressed",on?"true":"false");
  try{ localStorage.setItem("bourdon.veilnight",on?"1":"0"); }catch(e){}
  if(VEIL.on) veilFit();
}
/* tant que la veillée est ouverte, le reste de la page n'est ni atteignable au clavier ni lu par les lecteurs d'écran */
function veilInert(on){ document.querySelectorAll("body>.folio,body>.dock").forEach(e=>{ if(on) e.setAttribute("inert",""); else e.removeAttribute("inert"); }); }
function veilOpen(){
  const v=$("veil"); if(!v||VEIL.on) return;
  VEIL.on=true; v.hidden=false; document.body.classList.add("veiling"); veilInert(true);
  veilFit(); veilInfo(null,null); veilWake();
  VEIL.raf=requestAnimationFrame(veilFrame);
  const c=$("veilClose"); if(c) c.focus({preventScroll:true});
}
function veilClose(){
  const v=$("veil"); if(!v||!VEIL.on) return;
  VEIL.on=false; cancelAnimationFrame(VEIL.raf); clearTimeout(VEIL.idle); v.hidden=true; document.body.classList.remove("veiling"); veilInert(false);
  try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(e){}
  const b=$("veilBtn"); if(b) b.focus({preventScroll:true});
}
function veilFs(){
  const v=$("veil"); if(!v) return;
  try{ if(document.fullscreenElement) document.exitFullscreen(); else if(v.requestFullscreen) v.requestFullscreen(); }catch(e){}
}
function veilBuild(){
  const open=$("veilBtn"); if(open) open.onclick=veilOpen;
  $("veilClose").onclick=veilClose; $("veilFs").onclick=veilFs; $("veilNight").onclick=()=>veilNight(!$("veil").classList.contains("night"));
  { let n=false; try{ n=localStorage.getItem("bourdon.veilnight")==="1"; }catch(e){} veilNight(n); }
  $("veilPlay").onclick=()=>{ live?stopLive():startLive(); };
  if(!document.documentElement.requestFullscreen) $("veilFs").hidden=true;
  document.addEventListener("fullscreenchange",()=>{ const sp=$("veilFs")&&$("veilFs").querySelector("span"); if(sp) sp.textContent=document.fullscreenElement?"Quitter":"Plein écran"; if(VEIL.on) setTimeout(veilFit,80); });
  const v=$("veil"); ["mousemove","pointerdown","touchstart","keydown"].forEach(ev=>v.addEventListener(ev,veilWake,{passive:true}));
  document.addEventListener("keydown",e=>{
    if(!VEIL.on) return;
    if(e.key==="Escape"){ veilClose(); e.preventDefault(); }
    else if((e.key==="f"||e.key==="F")&&!e.ctrlKey&&!e.metaKey){ veilFs(); e.preventDefault(); }
    else if((e.key==="n"||e.key==="N")&&!e.ctrlKey&&!e.metaKey){ veilNight(!$("veil").classList.contains("night")); e.preventDefault(); }
    else if((e.key===" "||e.code==="Space")&&!(e.target&&e.target.closest&&e.target.closest("button"))){ live?stopLive():startLive(); e.preventDefault(); }
  });
  if(window.ResizeObserver) new ResizeObserver(()=>veilFit()).observe(v); else window.addEventListener("resize",veilFit);
}
