"use strict";
/* ============================================================
   VEILLÉE : la machine à regarder en fond, dans le noir (plein écran possible).
   Une rosace au centre : chaque note s'allume à sa place dans la gamme (l'angle),
   plus loin du centre quand elle est plus aiguë ; la mélodie trace sa constellation,
   le canon et les boucles s'y mêlent, les nappes font des arcs, les frappes des ondes,
   le bourdon respire au milieu et la forme d'onde court sur le pourtour.
   Couleurs de l'univers qui joue. En bas, la partition en ruban.
   ============================================================ */
const VEIL={on:false, raf:0, idle:0, last:0, n:0, univ:"", lev:0, sbuf:null, sGain:1, txt:{},
  view:{id:"veilCv", el:"veil", lo:12, hi:48, cols:null, dpr:1, w:0, h:0, k:1}};

const veilDpr=()=>Math.min(2,window.devicePixelRatio||1);
function veilSize(cv){ const r=cv.getBoundingClientRect(), d=veilDpr(), w=Math.max(10,Math.round(r.width)), h=Math.max(10,Math.round(r.height)); if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){ cv.width=Math.round(w*d); cv.height=Math.round(h*d); } return {w,h,d}; }
const veilC=()=>VEIL.view.cols||{ink:"#eee",ink2:"#aaa",rub:"#e55",gold:"#ec5",verd:"#5c9",rule:"#444",bg:"#222"};
function veilFit(){ if(!VEIL.on) return; vizFit(VEIL.view); const cv=$("veilRose"); if(cv) veilSize(cv); }
/* angle d'une hauteur (la tonique en haut), rayon d'un registre (le grave au centre) */
const vAng=o=>((o%12+12)%12)/12*Math.PI*2-Math.PI/2;
const vHash=x=>{ const s=Math.sin(x*127.1+311.7)*43758.5453; return s-Math.floor(s); };
function vRad(o,R){ const V=VEIL.view, span=Math.max(12,V.hi-V.lo), u=Math.max(0,Math.min(1,(o-V.lo)/span)); return R*(0.3+0.62*u); }

function veilRose(now,an){
  const cv=$("veilRose"); if(!cv) return; const {w:W,h:H,d}=veilSize(cv), c=cv.getContext("2d"), C=veilC();
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H);
  const narrow=W<700, cx=W/2, cy=narrow?H*0.56:H/2, lab=Math.max(11,Math.min(15,Math.min(W,H)/40))*2.8, R=Math.max(40,Math.min(W/2-lab,H*(narrow?0.36:0.42)));
  const iv=ivOf(S,typeof curScaleKey==="function"?curScaleKey():S.scales[0]);
  /* niveau d'ensemble, lissé : fait respirer le bourdon */
  let wave=null;
  if(an){
    const N=an.fftSize, buf=VEIL.sbuf&&VEIL.sbuf.length===N?VEIL.sbuf:(VEIL.sbuf=new Float32Array(N)); an.getFloatTimeDomainData(buf);
    let ss=0, pk=0; for(let i=0;i<N;i++){ const v=buf[i]; ss+=v*v; const a=v<0?-v:v; if(a>pk) pk=a; }
    VEIL.lev+=(Math.min(1,Math.sqrt(ss/N)*4)-VEIL.lev)*0.08;
    const target=pk>0.004?Math.min(30,0.6/pk):1; VEIL.sGain+=(target-VEIL.sGain)*0.08;
    let t=0; const span=Math.min(1024,N-2); for(let i=1;i<N-span;i++){ if(buf[i-1]<=0&&buf[i]>0){ t=i; break; } }
    wave={buf,t,span};
  }else VEIL.lev*=0.95;
  /* repères : trois cercles de registre, rayons des notes de la gamme, noms des notes */
  c.lineWidth=1; c.strokeStyle=C.rule;
  [0.3,0.61,0.92].forEach((k,i)=>{ c.globalAlpha=i===2?0.55:0.3; c.setLineDash(i===2?[]:[2,5]); c.beginPath(); c.arc(cx,cy,R*k,0,Math.PI*2); c.stroke(); });
  c.setLineDash([]);
  iv.forEach(o=>{ const a=vAng(o); c.globalAlpha=o===0?0.45:0.18; c.strokeStyle=o===0?C.rub:C.rule; c.beginPath(); c.moveTo(cx+R*0.3*Math.cos(a),cy+R*0.3*Math.sin(a)); c.lineTo(cx+R*0.92*Math.cos(a),cy+R*0.92*Math.sin(a)); c.stroke(); });
  const fs=Math.round(Math.max(11,Math.min(15,R/22)));
  c.font='400 '+fs+'px "IM Fell English SC", Georgia, serif'; c.textAlign="center"; c.textBaseline="middle";
  for(let o=0;o<12;o++){ const a=vAng(o), inS=iv.some(x=>Math.abs(((x%12)+12)%12-o)<0.01); c.fillStyle=o===0?C.rub:C.ink; c.globalAlpha=inS?(o===0?0.95:0.7):0.2; c.fillText(NOTES[(S.root+o)%12],cx+(R+fs*1.4)*Math.cos(a),cy+(R+fs*1.4)*Math.sin(a)); }
  /* forme d'onde sur le pourtour */
  if(wave){
    const {buf,t,span}=wave, n=360; c.strokeStyle=C.ink; c.globalAlpha=0.22; c.lineWidth=1; c.beginPath();
    for(let i=0;i<=n;i++){ const j=i%n, s=buf[t+Math.floor(j/n*span)], fade=Math.min(1,Math.min(j,n-j)/24), a=j/n*Math.PI*2-Math.PI/2, r=R*0.92+s*VEIL.sGain*R*0.035*fade;
      const x=cx+r*Math.cos(a), y=cy+r*Math.sin(a); i?c.lineTo(x,y):c.moveTo(x,y); }
    c.stroke();
  }
  /* le bourdon : un foyer qui respire au centre */
  { const r0=R*(0.12+0.1*VEIL.lev), g=c.createRadialGradient(cx,cy,0,cx,cy,r0*2.2);
    if(g){ g.addColorStop(0,C.rub); g.addColorStop(1,"rgba(0,0,0,0)"); } c.globalCompositeOperation="lighter"; c.globalAlpha=0.18+0.45*VEIL.lev; c.fillStyle=g||C.rub; c.beginPath(); c.arc(cx,cy,r0*2.2,0,Math.PI*2); c.fill(); c.globalCompositeOperation="source-over";
    c.globalAlpha=0.9; c.fillStyle=C.ink; c.font='400 '+Math.round(fs*1.5)+'px "IM Fell English SC", Georgia, serif'; c.fillText(NOTES[S.root],cx,cy+1); }
  if(now===null){ c.globalAlpha=1; return; }
  const ev=VIZ.ev, mel=[];
  for(const e of ev){
    if(e.t>now) continue; const age=now-e.t;
    /* frappes : ondes depuis le centre, étincelles au bord */
    if(e.kind==="stomp"){ if(age<1.6){ const k=age/1.6; c.globalAlpha=(1-k)*0.4*Math.min(1,e.vel+0.3); c.strokeStyle=C.ink2; c.lineWidth=2*(1-k)+0.5; c.beginPath(); c.arc(cx,cy,R*(0.14+0.85*Math.sqrt(k)),0,Math.PI*2); c.stroke(); } continue; }
    if(e.kind==="tap"){ if(age<0.7){ const k=age/0.7; c.globalAlpha=(1-k)*0.3*Math.min(1,e.vel+0.3); c.strokeStyle=C.gold; c.lineWidth=1; c.beginPath(); c.arc(cx,cy,R*(0.3+0.35*k),0,Math.PI*2); c.stroke(); } continue; }
    if(e.kind==="shk"){ if(age<0.35){ const a=vHash(e.t)*Math.PI*2, r=R*(0.95+0.06*vHash(e.t+1)); c.globalAlpha=(1-age/0.35)*0.7; c.fillStyle=C.ink; c.fillRect(cx+r*Math.cos(a)-1,cy+r*Math.sin(a)-1,2,2); } continue; }
    if(!PITCHED[e.kind]) continue;
    const a=vAng(e.off), r=vRad(e.off,R);
    if(e.kind==="pad"){ const life=e.dur+2; if(age>life) continue; const f=Math.min(1,age/0.8)*(1-age/life); c.globalAlpha=0.16*f; c.strokeStyle=C.ink2; c.lineWidth=Math.max(4,R*0.03); c.lineCap="round"; c.beginPath(); c.arc(cx,cy,r,a-0.22,a+0.22); c.stroke(); c.lineCap="butt"; continue; }
    if(e.kind==="mel"){ if(age<9) mel.push(e); continue; }
    /* canon, boucles, pendules, jeu : des points qui s'éteignent */
    const life=Math.max(e.dur,0.4)+1.6; if(age>life) continue; const f=1-age/life;
    const col=e.kind==="canon"?C.gold:e.kind==="play"?C.ink:C.verd, rr=(e.kind==="canon"?3:2.2)+3*f*Math.min(1,e.vel*4);
    c.globalAlpha=0.85*f; c.fillStyle=col; c.beginPath(); c.arc(cx+r*Math.cos(a),cy+r*Math.sin(a),rr,0,Math.PI*2); c.fill();
  }
  /* mélodie : la constellation des neuf dernières secondes, la note qui sonne a un halo */
  mel.sort((p,q)=>p.t-q.t);
  const pts=mel.map(e=>{ const a=vAng(e.off), r=vRad(e.off,R); return {x:cx+r*Math.cos(a), y:cy+r*Math.sin(a), age:now-e.t, e}; });
  c.strokeStyle=C.rub; c.lineWidth=1.2;
  for(let i=1;i<pts.length;i++){ const p=pts[i-1], q=pts[i]; c.globalAlpha=0.45*Math.max(0,1-q.age/9); c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(q.x,q.y); c.stroke(); }
  for(const p of pts){
    const f=Math.max(0,1-p.age/9), sounding=p.age<=Math.max(p.e.dur,0.25)+0.15, v=Math.min(1,p.e.vel*4);
    if(sounding){ const hr=R*0.05*(1+v)*(1+0.4*Math.max(0,1-p.age*3)), g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,hr); if(g){ g.addColorStop(0,C.rub); g.addColorStop(1,"rgba(0,0,0,0)"); } c.globalCompositeOperation="lighter"; c.globalAlpha=0.65; c.fillStyle=g||C.rub; c.beginPath(); c.arc(p.x,p.y,hr,0,Math.PI*2); c.fill(); c.globalCompositeOperation="source-over"; }
    c.globalAlpha=0.25+0.75*f; c.fillStyle=sounding?C.ink:C.rub; c.beginPath(); c.arc(p.x,p.y,1.8+2.4*f*(0.5+v),0,Math.PI*2); c.fill();
  }
  c.globalAlpha=1;
}
function veilText(id,t){ if(VEIL.txt[id]===t) return; VEIL.txt[id]=t; const e=$(id); if(e) e.textContent=t; }
/* titre (ambiance, phrase, univers), puis la ligne du bas : ton, tempo, section, affects */
function veilInfo(now,eng){
  const sc=(typeof SCENE!=="undefined"&&SCENE)||{}, uid=sc.univ||(typeof currentUnivers==="function"?currentUnivers():"medieval"), u=UNIVERS.find(x=>x.id===uid);
  if(uid!==VEIL.univ){ VEIL.univ=uid; const v=$("veil"); if(v){ v.dataset.u=uid; veilFit(); } }
  veilText("vlUniv",u?u.name:""); veilText("vlName",sc.name||"Bourdon");
  veilText("vlGloss",sc.gloss?sc.gloss.charAt(0).toUpperCase()+sc.gloss.slice(1):"");
  const key=(typeof curScaleKey==="function"?curScaleKey():S.scales[0])||"mixolydien", m=(SC[key]||SC.mixolydien);
  veilText("vlKey",NOTES[S.root]+" "+m.n.replace(/\s*\(.*\)/,"").toLowerCase());
  veilText("vlTempo",S.tempo+" bpm · "+S.meter);
  veilText("vlAff",affTop(key,S.root,3).join(" · "));
  if(live&&eng&&now!==null){
    const bar=eng.bar, t0=eng.t0f(), b=Math.max(0,Math.floor((now-t0)/bar)), sec=eng.secAt(now), sn=Math.floor(Math.max(0,now-t0)/(S.sectionBars*bar))+1;
    veilText("vlSec","section "+sn+" · "+(sec.role||"thème")+" · mesure "+(b+1));
  }else veilText("vlSec","en attente");
}
/* mixeur : le même que dans Conduire et Arranger, rangé dans un tiroir au-dessus de la partition */
function veilMixFoot(){ const f=document.querySelector("#veil .vl-foot"), v=$("veil"); if(f&&v) v.style.setProperty("--vl-foot-h",f.offsetHeight+"px"); }
function veilMix(on){
  const t=$("vlMix"), b=$("veilMixBtn"); if(!t) return;
  t.hidden=!on; if(b){ b.setAttribute("aria-pressed",on?"true":"false"); b.setAttribute("aria-expanded",on?"true":"false"); }
  if(on){ veilMixFoot(); VEIL.mixSig=""; dawMixerDraw(); dawMetersTick(); }
  try{ localStorage.setItem("bourdon.veilmix",on?"1":"0"); }catch(e){}
}
const veilMixOpen=()=>{ const t=$("vlMix"); return !!t&&!t.hidden; };
/* le mixeur suit les niveaux modifiés ailleurs (scènes, préréglages) et anime les vumètres */
function veilMixFrame(){
  if(!veilMixOpen()) return;
  dawMetersTick();
  if(VEIL.n%12===0){ const h=$("veilMixer"); if(h&&!h.contains(document.activeElement)){ const sig=JSON.stringify([MACH.map(m=>m[2]?getP(m[2]):0),S.daw.mix,S.daw.tracks.map(t=>[t.name,t.vol,t.pan,t.mute,t.solo])]); if(sig!==VEIL.mixSig){ VEIL.mixSig=sig; dawMixerDraw(); } } }
}
function veilFrame(ts){
  VEIL.raf=0; if(!VEIL.on) return;
  VEIL.raf=requestAnimationFrame(veilFrame);
  if(((typeof isEco==="function"&&isEco())||(window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches))&&ts-VEIL.last<66) return; VEIL.last=ts;
  const now=live?live.ctx.currentTime:null, eng=live?live.eng:null, an=eng?eng.analyser("all"):null;
  vizDraw(now,eng,VEIL.view); veilRose(now,an); veilMixFrame();
  if((++VEIL.n)%6===0){ veilInfo(now,eng); veilSyncControls(); const b=$("veilPlay"); if(b){ const sp=b.querySelector("span"), t=live?"Arrêter":"Jouer"; if(sp&&sp.textContent!==t) sp.textContent=t; b.classList.toggle("on",!!live); const ip=b.querySelector(".ip"), is=b.querySelector(".is"); if(ip) ip.style.display=live?"none":""; if(is) is.style.display=live?"":"none"; } }
}
function veilWake(){
  const v=$("veil"); if(!v) return; v.classList.remove("idle"); clearTimeout(VEIL.idle);
  VEIL.idle=setTimeout(()=>{ if(VEIL.on) v.classList.add("idle"); },4000);
}
/* tant que la veillée est ouverte, le reste de la page n'est ni atteignable au clavier ni lu par les lecteurs d'écran */
function veilInert(on){ document.querySelectorAll("body>.folio,body>.dock").forEach(e=>{ if(on) e.setAttribute("inert",""); else e.removeAttribute("inert"); }); }
function veilOpen(){
  const v=$("veil"); if(!v||VEIL.on) return;
  VEIL.on=true; v.hidden=false; document.body.classList.add("veiling"); veilInert(true);
  VEIL.univ=""; veilInfo(null,null); veilFit(); veilWake();
  VEIL.raf=requestAnimationFrame(veilFrame);
  const c=$("veilClose"); if(c) c.focus({preventScroll:true});
  { let m=false; try{ m=localStorage.getItem("bourdon.veilmix")==="1"; }catch(e){} veilMix(m); }
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
/* volume général, ton jeu (instrument, registre, niveau), capture : les mêmes réglages que dans Conduire */
function veilBuildControls(){
  const vol=$("vlVol"); if(vol){ vol.value=S.vol; vol.oninput=()=>{ applyKnob(KNOB.vol,+vol.value,false); }; vol.onchange=()=>{ applyKnob(KNOB.vol,+vol.value,true); }; }
  const pc=$("vlPlayCtl");
  if(pc){
    const row=(label,el)=>{ const l=document.createElement("label"); l.className="vl-f"; const t=document.createElement("span"); t.textContent=label; l.appendChild(t); l.appendChild(el); return l; };
    const inst=dawSel([["","Comme la mélodie"]].concat(INST_OPTS),S.play.inst||"","Instrument de ton jeu",v=>dawParam("play.inst",v)); inst.id="vlPlayInst";
    const oct=dawSel([[12,"Grave"],[24,"Médium"],[36,"Aigu"],[48,"Très aigu"]],S.play.oct,"Registre",v=>dawParam("play.oct",parseInt(v,10))); oct.id="vlPlayOct";
    const lvl=dawRange(S.play.lvl,0,1,0.01,"Niveau de ton jeu",v=>dawParam("play.lvl",v)); lvl.id="vlPlayLvl";
    pc.appendChild(row("Instrument",inst)); pc.appendChild(row("Registre",oct)); pc.appendChild(row("Niveau",lvl));
  }
  const cc=$("vlCapCtl");
  if(cc){
    const sel=document.createElement("select"); sel.id="vlCapFmt"; sel.setAttribute("aria-label","Format de la capture");
    CAP_FMT.forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; sel.appendChild(o); }); sel.value=capFmt();
    sel.onchange=()=>{ try{ localStorage.setItem("bourdon.capfmt",sel.value); }catch(e){} const m=$("capFmt"); if(m) m.value=sel.value; };
    const l=document.createElement("label"); l.className="vl-f"; const t=document.createElement("span"); t.textContent="Format"; l.appendChild(t); l.appendChild(sel); cc.appendChild(l);
  }
  const cap=$("veilCap"); if(cap) cap.onclick=()=>{ if(CAP.on) capStop(); else if(live) capStart(); };
}
/* ce qui change tout seul pendant la veillée : volume, ton jeu, état de la capture */
function veilSyncControls(){
  const ae=document.activeElement, free=id=>{ const e=$(id); return e&&e!==ae?e:null; };
  let e;
  if((e=free("vlVol"))&&+e.value!==S.vol) e.value=S.vol;
  if((e=free("vlPlayInst"))&&e.value!==String(S.play.inst||"")) e.value=S.play.inst||"";
  if((e=free("vlPlayOct"))&&e.value!==String(S.play.oct)) e.value=String(S.play.oct);
  if((e=free("vlPlayLvl"))&&+e.value!==S.play.lvl) e.value=S.play.lvl;
  const b=$("veilCap"); if(b){
    const sp=b.querySelector("span"), on=!!CAP.on, secs=on&&live?Math.max(0,Math.round(live.ctx.currentTime-CAP.t0)):0;
    const t=on?"Arrêter "+Math.floor(secs/60)+":"+String(secs%60).padStart(2,"0"):"Capturer";
    if(sp&&sp.textContent!==t) sp.textContent=t; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on?"true":"false"); b.disabled=!live&&!on;
  }
  const n=$("capNote"), m=$("vlCapMsg"); if(m&&n){ const t=n.textContent, show=/Capture|Encodage|encodeur/.test(t)?t:""; if(m.textContent!==show) m.textContent=show; }
}
function veilBuild(){
  const open=$("veilBtn"); if(open) open.onclick=veilOpen;
  $("veilClose").onclick=veilClose; $("veilMixBtn").onclick=()=>veilMix(!veilMixOpen()); $("veilFs").onclick=veilFs;
  $("veilPlay").onclick=()=>{ live?stopLive():startLive(); };
  if(!document.documentElement.requestFullscreen) $("veilFs").hidden=true;
  veilBuildControls();
  document.addEventListener("fullscreenchange",()=>{ const sp=$("veilFs")&&$("veilFs").querySelector("span"); if(sp) sp.textContent=document.fullscreenElement?"Quitter":"Plein écran"; if(VEIL.on) setTimeout(veilFit,80); });
  const v=$("veil"); ["mousemove","pointerdown","touchstart","keydown"].forEach(ev=>v.addEventListener(ev,veilWake,{passive:true}));
  document.addEventListener("keydown",e=>{
    if(!VEIL.on) return;
    if(e.key==="Escape"){ veilClose(); e.preventDefault(); }
    else if((e.key===" "||e.code==="Space")&&!(e.target&&e.target.closest&&e.target.closest("button"))){ live?stopLive():startLive(); e.preventDefault(); }
  });
  if(window.ResizeObserver) new ResizeObserver(()=>veilFit()).observe(v); else window.addEventListener("resize",veilFit);
}
