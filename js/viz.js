"use strict";
/* ============================================================
   PARTITION QUI DÉFILE : ce qui a été joué à gauche, ce qui va venir à droite
   ============================================================ */
const VIZ={ev:[], lo:12, hi:48, cols:null, dpr:1, w:0, h:0, last:0};
const VIZ_PAST=7, VIZ_FUTURE=9;
const PITCHED={mel:1,canon:1,pad:1,loop:1,pend:1};

function vizPush(t,off,kind,dur,vel,label){ VIZ.ev.push({t,off,kind,dur:dur||0,vel:vel||0.2,label}); }
function vizClear(){ VIZ.ev.length=0; }

function vizFit(){
  const cv=$("scoreCv"); if(!cv) return;
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
  VIZ.w=Math.max(10,Math.round(r.width)); VIZ.h=Math.max(10,Math.round(r.height)); VIZ.dpr=dpr;
  cv.width=Math.round(VIZ.w*dpr); cv.height=Math.round(VIZ.h*dpr);
  const cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
  VIZ.cols={ink:v("--ink")||"#3a2e22", ink2:v("--ink-2")||"#6b5a46", rub:v("--rubric")||"#a3301c", gold:"oklch(0.62 0.12 78)", verd:"oklch(0.52 0.09 175)", rule:v("--rule")||"#b8a888", bg:v("--parch-2")||"#e8dcc2"};
  vizDraw(null);
}

/* now: temps audio courant, eng: moteur en cours (ou null pour la partition vide) */
function vizDraw(now,eng){
  const cv=$("scoreCv"); if(!cv||!VIZ.cols) return;
  const c=cv.getContext("2d"), W=VIZ.w, H=VIZ.h, C=VIZ.cols;
  c.setTransform(VIZ.dpr,0,0,VIZ.dpr,0,0); c.clearRect(0,0,W,H);
  const top=20, bot=26, ph=H-top-bot, x0=W*VIZ_PAST/(VIZ_PAST+VIZ_FUTURE), pps=W/(VIZ_PAST+VIZ_FUTURE);
  const live=now!==null&&eng;
  /* étendue des hauteurs : suit ce qui est visible, avec un lissage */
  if(live){
    let mn=1e9, mx=-1e9;
    for(const e of VIZ.ev){ if(!PITCHED[e.kind]||e.t+e.dur<now-VIZ_PAST||e.t>now+VIZ_FUTURE) continue; if(e.off<mn)mn=e.off; if(e.off>mx)mx=e.off; }
    if(mx>=mn){ mn-=3; mx+=3; if(mx-mn<24){const m=(mx+mn)/2; mn=m-12; mx=m+12;} VIZ.lo+=(mn-VIZ.lo)*0.04; VIZ.hi+=(mx-VIZ.hi)*0.04; }
  }
  const yOf=o=>top+(1-(o-VIZ.lo)/(VIZ.hi-VIZ.lo))*ph;
  /* lignes de tonique (portée) */
  c.lineWidth=1; c.strokeStyle=C.rule; c.globalAlpha=live?0.55:0.8; c.setLineDash([2,4]);
  for(let o=Math.ceil(VIZ.lo/12)*12;o<=VIZ.hi;o+=12){ const y=Math.round(yOf(o))+0.5; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
  c.setLineDash([]); c.globalAlpha=1;
  /* bourdon : double filet en bas */
  c.strokeStyle=C.ink2; c.globalAlpha=0.5; c.beginPath(); c.moveTo(0,H-bot+6.5); c.lineTo(W,H-bot+6.5); c.moveTo(0,H-bot+9.5); c.lineTo(W,H-bot+9.5); c.stroke(); c.globalAlpha=1;
  c.font='italic 11px "Alegreya", Georgia, serif'; c.textBaseline="alphabetic";
  if(!live){
    c.fillStyle=C.ink2; c.textAlign="center"; c.font='italic 15px "Alegreya", Georgia, serif';
    c.fillText("Lance la lecture : la partition défile ici, les notes à venir arrivent par la droite.",W/2,H/2+4); c.textAlign="left";
    return;
  }
  /* mesures et sections */
  const t0=eng.t0f(), bar=eng.bar, secLen=S.sectionBars*bar;
  c.strokeStyle=C.ink; c.globalAlpha=0.08; c.lineWidth=1;
  for(let k=Math.floor((now-VIZ_PAST-t0)/bar);;k++){ const t=t0+k*bar; if(t>now+VIZ_FUTURE) break; if(t<t0) continue; const x=Math.round(x0+(t-now)*pps)+0.5; c.beginPath(); c.moveTo(x,top-4); c.lineTo(x,H-bot+9); c.stroke(); }
  c.globalAlpha=1;
  for(let k=Math.floor((now-VIZ_PAST-t0)/secLen);;k++){
    const t=t0+k*secLen; if(t>now+VIZ_FUTURE) break; if(t<t0-0.01) continue;
    const x=Math.round(x0+(t-now)*pps)+0.5, key=eng.secAt(t+0.01).key;
    c.strokeStyle=C.rub; c.globalAlpha=0.5; c.beginPath(); c.moveTo(x,2); c.lineTo(x,H-bot+9); c.stroke(); c.globalAlpha=1;
    c.fillStyle=C.rub; c.fillText((SC[key]||SC.mixolydien).n.toLowerCase(),x+4,13);
  }
  /* notes */
  const bh=Math.max(4,Math.min(9,ph/(VIZ.hi-VIZ.lo)*1.6));
  VIZ.ev=VIZ.ev.filter(e=>e.t+e.dur>now-VIZ_PAST-1);
  for(const e of VIZ.ev){
    if(e.t>now+VIZ_FUTURE) continue;
    const x=x0+(e.t-now)*pps, w=Math.max(5,e.dur*pps), age=now-e.t, played=age>=0, fade=played?Math.max(0.18,1-age/VIZ_PAST*0.85):1;
    if(e.kind==="evt"){ /* son à la demande : filet doré avec son nom */
      c.globalAlpha=fade*(played?0.9:0.6); c.strokeStyle=C.gold; c.lineWidth=1.5; c.beginPath(); c.moveTo(Math.round(x)+0.5,top-2); c.lineTo(Math.round(x)+0.5,H-bot+9); c.stroke();
      c.fillStyle=C.gold; c.font='italic 12px "Alegreya", Georgia, serif'; c.fillText(e.label||"",x+4,top+12); c.font='italic 11px "Alegreya", Georgia, serif'; continue;
    }
    if(e.kind==="stomp"||e.kind==="tap"||e.kind==="shk"){
      const hh=e.kind==="stomp"?12:e.kind==="tap"?7:3, y=H-bot+(e.kind==="shk"?16:20);
      c.globalAlpha=fade*(played?0.85:0.5); c.fillStyle=C.ink; c.fillRect(Math.round(x)-1,y-hh/2,2,hh); continue;
    }
    const y=yOf(e.off), sounding=played&&age<=Math.max(e.dur,0.25);
    if(e.kind==="pad"){ c.globalAlpha=fade*(played?0.22:0.1); c.fillStyle=C.ink2; c.fillRect(x,y-3,w,6); c.globalAlpha=fade*0.35; c.fillStyle=C.ink2; c.fillRect(x,y-3,w,1); continue; }
    const col=e.kind==="mel"?C.rub:e.kind==="canon"?C.gold:C.verd;
    c.globalAlpha=fade; c.strokeStyle=col; c.fillStyle=col; c.lineWidth=1.2;
    if(e.kind==="pend"){ c.save(); c.translate(x,y); c.rotate(Math.PI/4); if(played) c.fillRect(-3.2,-3.2,6.4,6.4); else c.strokeRect(-3.2,-3.2,6.4,6.4); c.restore(); }
    else{ /* neume : un carré plein suivi d'un filet pour la durée */
      if(played){ c.fillRect(x,y-bh/2,bh,bh); c.globalAlpha=fade*0.55; c.fillRect(x+bh,y-0.75,Math.max(0,w-bh),1.5); }
      else{ c.strokeRect(x+0.5,y-bh/2+0.5,bh-1,bh-1); c.globalAlpha=fade*0.4; c.fillRect(x+bh,y-0.5,Math.max(0,w-bh),1); }
    }
    if(sounding){ c.globalAlpha=0.35*(1-Math.min(1,age/0.6)); c.beginPath(); c.arc(x+bh/2,y,bh+3+age*8,0,Math.PI*2); c.stroke(); }
  }
  c.globalAlpha=1;
  /* tête de lecture */
  c.strokeStyle=C.gold; c.lineWidth=1.5; c.beginPath(); c.moveTo(Math.round(x0)+0.5,top-6); c.lineTo(Math.round(x0)+0.5,H-bot+11); c.stroke();
  c.fillStyle=C.gold; c.beginPath(); c.moveTo(x0-4,top-8); c.lineTo(x0+5,top-8); c.lineTo(x0+0.5,top-2); c.closePath(); c.fill();
}
