"use strict";
/* ============================================================
   INFOBULLES : survol, focus clavier ou appui long sur écran tactile.
   Tout élément portant title ou data-tip en reçoit une ; le title natif est retiré
   (il est lent, absent au tactile) et recopié dans aria-description.
   ============================================================ */
const TIP={el:null, on:null, timer:0, hide:0};
function tipEl(){
  if(!TIP.el){ const d=document.createElement("div"); d.className="tip"; d.id="tip"; d.setAttribute("role","tooltip"); document.body.appendChild(d); TIP.el=d; }
  return TIP.el;
}
/* title devient data-tip, sauf sur les éléments qui n'ont pas de sens ici (head, iframe) */
function tipScan(root){
  (root||document).querySelectorAll("[title]").forEach(e=>{
    if(!e.closest("body")||e.tagName==="IFRAME") return;
    const t=e.getAttribute("title"); e.removeAttribute("title"); if(!t) return;
    if(!e.dataset.tip) e.dataset.tip=t;
    if(!e.getAttribute("aria-description")&&!e.getAttribute("aria-describedby")) e.setAttribute("aria-description",t);
  });
}
function tipHide(){
  clearTimeout(TIP.timer); clearTimeout(TIP.hide);
  if(TIP.on){ TIP.on.removeAttribute("aria-describedby"); TIP.on=null; }
  if(TIP.el) TIP.el.classList.remove("on");
}
function tipShow(target){
  const text=target.dataset.tip; if(!text) return;
  const t=tipEl(); t.textContent=text; TIP.on=target; target.setAttribute("aria-describedby","tip");
  t.style.left="0px"; t.style.top="0px"; t.classList.remove("on");
  const r=target.getBoundingClientRect(), w=t.offsetWidth, h=t.offsetHeight, vw=window.innerWidth, vh=window.innerHeight;
  let x=r.left+r.width/2-w/2; x=Math.max(8,Math.min(vw-w-8,x));
  let y=r.bottom+8; if(y+h>vh-8) y=Math.max(8,r.top-h-8);
  t.style.left=Math.round(x)+"px"; t.style.top=Math.round(y)+"px";
  requestAnimationFrame(()=>{ if(TIP.on===target) t.classList.add("on"); });
}
function tipArm(target,delay){
  if(TIP.on===target) return; tipHide();
  TIP.timer=setTimeout(()=>tipShow(target),delay);
}
function tipInit(){
  tipScan();
  const find=e=>{ const n=e.target&&e.target.closest?e.target.closest("[data-tip]"):null; return n; };
  document.addEventListener("mouseover",e=>{ const n=find(e); if(n) tipArm(n,380); else tipHide(); });
  document.addEventListener("mouseout",e=>{ const n=find(e); if(n&&!n.contains(e.relatedTarget)) tipHide(); });
  document.addEventListener("focusin",e=>{ const n=find(e); if(n&&e.target.matches&&e.target.matches(":focus-visible")) tipArm(n,150); });
  document.addEventListener("focusout",tipHide);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") tipHide(); },true);
  document.addEventListener("pointerdown",e=>{ if(e.pointerType!=="touch") tipHide(); },true);
  window.addEventListener("scroll",tipHide,true);
  /* tactile : un appui long montre l'infobulle quelques secondes */
  document.addEventListener("touchstart",e=>{ const n=find(e); if(!n) return; clearTimeout(TIP.timer); TIP.timer=setTimeout(()=>{ tipShow(n); TIP.hide=setTimeout(tipHide,3200); },520); },{passive:true});
  document.addEventListener("touchend",()=>clearTimeout(TIP.timer),{passive:true});
  document.addEventListener("touchmove",()=>clearTimeout(TIP.timer),{passive:true});
  /* les contrôles construits plus tard (ambiances, mixeur, pistes) reçoivent leur infobulle eux aussi */
  if(window.MutationObserver){ let q=0; new MutationObserver(()=>{ if(q) return; q=setTimeout(()=>{ q=0; tipScan(); },60); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["title"]}); }
}
