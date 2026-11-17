"use strict";
/* ============================================================
   ACCUEIL ET VISITE GUIDÉE : au premier lancement, un écran qui dit ce qu'est Bourdon,
   puis, si on le veut, six bulles posées sur la vraie interface. Mémorisé dans le navigateur ;
   le lien « Aide » les rouvre à tout moment.
   ============================================================ */
const ACC={key:"bourdon.accueil", on:false, tour:false, step:0, card:null};
const ACC_STEPS=[
  {sel:"#seekUni", t:"Univers", x:"Choisis le décor de la scène : taverne, crypte, combat, pirates, cyberpunk. « Au hasard » en tire un pour toi."},
  {sel:"#affChips", t:"Je cherche", x:"Une ou plusieurs émotions règlent la gamme, la tonalité et la tension. C'est facultatif : sans choix, on part de la première ambiance de l'univers."},
  {sel:"#play3", t:"Jouer", x:"Lance la lecture. Chaque fois, la pièce est nouvelle : rien n'est enregistré, tout est composé sur le moment."},
  {sel:"#knobs", t:"Les boutons", x:"Tourne-les en direct : tension, densité, bourdon, brume. Glisse vers le haut ou le bas, ou utilise la molette et les flèches du clavier."},
  {sel:"#jeuGest", t:"Les gestes", x:"Suspense, Révélation, Danger, Poursuite, Triomphe, Apaisement : un geste musical pour souligner un moment de la partie. L'ampleur règle sa force."},
  {sel:"#modes", t:"Aller plus loin", x:"Composer : tous les réglages, et Capturer pour garder une prise en WAV, MP3 ou MIDI. Forger : ton propre synthé. Arranger : des pistes par-dessus la machine. Veillée : la machine en grand, à regarder en fond."}
];
const accSeen=()=>{ try{ return localStorage.getItem(ACC.key)==="1"; }catch(e){ return false; } };
const accMark=()=>{ try{ localStorage.setItem(ACC.key,"1"); }catch(e){} };
const accInert=on=>document.querySelectorAll("body>.folio,body>.dock").forEach(e=>{ if(on) e.setAttribute("inert",""); else e.removeAttribute("inert"); });

function accOpen(){
  const w=$("welcome"); if(!w||ACC.on) return;
  if(ACC.tour) tourEnd(true);
  if(typeof VEIL!=="undefined"&&VEIL.on) veilClose();
  ACC.on=true; w.hidden=false; document.body.classList.add("veiling"); accInert(true);
  const k=$("wlTour"); if(k) k.focus({preventScroll:true});
}
function accClose(){
  const w=$("welcome"); if(!w||!ACC.on) return;
  ACC.on=false; w.hidden=true; document.body.classList.remove("veiling"); accInert(false); accMark();
}
/* un univers au hasard et la lecture, pour entendre tout de suite */
function accListen(){ accClose(); if(typeof seekRandom==="function") seekRandom(); if(!live) startLive(); }

/* ---------- visite guidée ---------- */
function tourBuild(){
  if(ACC.card) return;
  const t=document.createElement("div"); t.className="tour"; t.id="tour"; t.hidden=true; t.setAttribute("role","dialog"); t.setAttribute("aria-label","Visite guidée");
  t.innerHTML='<div class="tour-hole" aria-hidden="true"></div><div class="tour-card" aria-live="polite"><div class="tour-h"><i id="tourN"></i><b id="tourT"></b></div><p id="tourX"></p><div class="tour-k"><button class="lnk" id="tourSkip" type="button">Passer</button><span><button class="vl-key" id="tourPrev" type="button">Précédent</button><button class="vl-key tour-next" id="tourNext" type="button">Suivant</button></span></div></div>';
  document.body.appendChild(t); ACC.card=t;
  $("tourSkip").onclick=()=>tourEnd(); $("tourPrev").onclick=()=>tourShow(ACC.step-1); $("tourNext").onclick=()=>{ if(ACC.step>=ACC_STEPS.length-1) tourEnd(); else tourShow(ACC.step+1); };
  const re=()=>{ if(ACC.tour) tourPlace(); }; window.addEventListener("resize",re); window.addEventListener("scroll",re,true);
}
const accReduced=()=>!!(window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches);
function tourStart(){
  accClose(); if(typeof veilClose==="function"&&VEIL.on) veilClose();
  tourBuild(); if(typeof MODE!=="undefined"&&MODE!=="jeu") setMode("jeu");
  ACC.tour=true; ACC.card.hidden=false; document.body.classList.add("touring"); tourShow(0);
}
function tourShow(i){
  ACC.step=Math.max(0,Math.min(ACC_STEPS.length-1,i)); const s=ACC_STEPS[ACC.step];
  $("tourN").textContent=["I","II","III","IV","V","VI"][ACC.step]+" / VI"; $("tourT").textContent=s.t; $("tourX").textContent=s.x;
  $("tourPrev").disabled=ACC.step===0; $("tourNext").textContent=ACC.step===ACC_STEPS.length-1?"Terminer":"Suivant";
  const el=document.querySelector(s.sel); if(el&&el.scrollIntoView) el.scrollIntoView({block:"center",behavior:accReduced()?"auto":"smooth"});
  tourPlace(); setTimeout(tourPlace,320); $("tourNext").focus({preventScroll:true});
}
function tourPlace(){
  if(!ACC.tour||!ACC.card) return;
  const s=ACC_STEPS[ACC.step], el=document.querySelector(s.sel), hole=ACC.card.querySelector(".tour-hole"), card=ACC.card.querySelector(".tour-card");
  const vw=window.innerWidth, vh=window.innerHeight, r=el?el.getBoundingClientRect():null, ok=r&&r.width>4&&r.height>4;
  if(ok){ const p=6; hole.style.cssText="display:block;left:"+Math.round(r.left-p)+"px;top:"+Math.round(r.top-p)+"px;width:"+Math.round(r.width+2*p)+"px;height:"+Math.round(r.height+2*p)+"px"; }
  else hole.style.cssText="display:none";
  card.style.left=card.style.top=card.style.bottom=card.style.right=""; card.classList.toggle("sheet",vw<640);
  if(vw<640) return;
  const cw=card.offsetWidth, ch=card.offsetHeight;
  if(!ok){ card.style.left=Math.round((vw-cw)/2)+"px"; card.style.top=Math.round((vh-ch)/2)+"px"; return; }
  let top=r.bottom+16; if(top+ch>vh-12) top=r.top-ch-16; if(top<12) top=Math.max(12,vh-ch-16);
  card.style.left=Math.round(Math.max(12,Math.min(vw-cw-12,r.left)))+"px"; card.style.top=Math.round(top)+"px";
}
function tourEnd(silent){
  if(!ACC.tour) return; ACC.tour=false; if(ACC.card) ACC.card.hidden=true; document.body.classList.remove("touring"); accMark();
  if(!silent){ const b=$("helpBtn"); if(b) b.focus({preventScroll:true}); }
}

function accBuild(){
  const w=$("welcome"); if(!w) return;
  $("wlTour").onclick=tourStart; $("wlListen").onclick=accListen; $("wlSkip").onclick=()=>{ accClose(); const b=$("helpBtn"); if(b) b.focus({preventScroll:true}); };
  const h=$("helpBtn"); if(h) h.onclick=accOpen;
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){ if(ACC.tour){ tourEnd(); e.preventDefault(); } else if(ACC.on){ accClose(); e.preventDefault(); } }
    else if(ACC.tour&&(e.key==="ArrowRight"||e.key==="ArrowLeft")){ tourShow(ACC.step+(e.key==="ArrowRight"?1:-1)); e.preventDefault(); }
  });
  /* premier lancement seulement ; l'accueil ne s'ouvre pas dans un test automatisé */
  if(!accSeen()&&!window.__noWelcome) accOpen();
}
