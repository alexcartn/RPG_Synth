"use strict";
/* ============================================================
   TÉLÉCOMMANDE : piloter Bourdon depuis une table virtuelle (module Foundry VTT) ou un lien
   - Par message (postMessage) : seulement depuis la fenêtre qui a ouvert Bourdon ou la page qui l'intègre,
     et seulement si la télécommande est permise (adresse avec ?telecommande=1, ou case cochée dans Séance).
     Les ordres sont simples et sans danger : jouer, arrêter, ambiance, univers, émotions, tension, geste, volume, sous la voix.
   - Par l'adresse : ?ambiance=Crypta, ?univers=dark, ?emotions=mystérieux,sacré, pour un lien qui ouvre sur une scène.
   ============================================================ */
const TELE={on:false, from:"", n:0};
(()=>{ try{ const q=new URLSearchParams(location.search); TELE.on=q.get("telecommande")==="1"||localStorage.getItem("bourdon.tele")==="1"; }catch(e){} })();
const teleClamp=(v,a,b)=>Math.max(a,Math.min(b,+v||0));
const teleFind=nom=>{ const n=String(nom||"").trim().toLowerCase(); return PRESETS.find(p=>p[0].toLowerCase()===n); };
/* exécute un ordre ; renvoie ce qu'il faut dire à l'expéditeur */
function teleRun(m){
  const c=m&&m.cmd;
  if(c==="jouer"){ if(!live) startLive(); teleSound(); return {ok:true}; }
  if(c==="arreter"){ if(live) stopLive(); return {ok:true}; }
  if(c==="ambiance"){ const p=teleFind(m.nom); if(!p) return {ok:false, erreur:"ambiance inconnue : "+m.nom};
    try{ localStorage.setItem("bourdon.univers",p[3]); }catch(e){} const sel=$("univers"); if(sel){ sel.value=p[3]; if(typeof drawPresetRow==="function") drawPresetRow(); }
    loadScene(p[1],null,m.fondu?teleClamp(m.fondu,0.5,30):undefined,{name:p[0],gloss:p[2],univ:p[3]}); const g=$("presetGloss"); if(g) g.textContent=p[0]+" : "+p[2]+".";
    if(m.jouer&&!live){ startLive(); teleSound(); } return {ok:true}; }
  if(c==="univers"){ if(!UNIVERS.some(u=>u.id===m.id)) return {ok:false, erreur:"univers inconnu : "+m.id}; seekUniverse(m.id); return {ok:true}; }
  if(c==="emotions"){ const l=(Array.isArray(m.liste)?m.liste:String(m.liste||"").split(",")).map(x=>String(x).trim().toLowerCase()).filter(x=>EMOTIONS.indexOf(x)>=0);
    if(m.univers&&UNIVERS.some(u=>u.id===m.univers)){ try{ localStorage.setItem("bourdon.univers",m.univers); }catch(e){} }
    AFF.sel.clear(); l.forEach(e=>AFF.sel.add(e)); chipsSync(); if(m.univers) seekUniverse(m.univers); else affResults(true); return {ok:true, emotions:l}; }
  if(c==="tension"){ S.tension=teleClamp(m.valeur,0,1); if(typeof releaseCurve==="function") releaseCurve(); syncUI(); if(live) live.eng.setLevels(); return {ok:true}; }
  if(c==="geste"){ if(!live) return {ok:false, erreur:"rien ne joue"}; const d=live.eng.gesture(String(m.nom||""),m.ampleur===undefined?1:teleClamp(m.ampleur,0,2)); return {ok:d>0, duree:d}; }
  if(c==="volume"){ S.vol=teleClamp(m.valeur,0,1.5); syncUI(); if(live) live.eng.setLevels(); return {ok:true}; }
  if(c==="sousLaVoix"){ if(typeof voixUnder==="function") voixUnder(m.actif===undefined?undefined:!!m.actif); return {ok:true}; }
  if(c==="etat") return {ok:true};
  return {ok:false, erreur:"ordre inconnu : "+c};
}
const teleState=()=>({joue:!!live, ambiance:(typeof SCENE!=="undefined"&&SCENE.name)||"", univers:(typeof seekUni==="function"?seekUni():""), tension:S.tension, sousLaVoix:!!(typeof VOIX!=="undefined"&&VOIX.under),
  ambiances:PRESETS.map(p=>p[0]), emotions:EMOTIONS.slice(), gestes:["suspense","revelation","apaisement","surprise","danger","poursuite","triomphe"]});
/* le navigateur refuse le son tant qu'on n'a pas cliqué dans la page : on le dit, avec un bouton */
function teleSound(){
  const n=$("teleNote"); if(!live||!n) return;
  if(live.ctx.state==="suspended"){ n.innerHTML=""; const b=document.createElement("button"); b.type="button"; b.className="btn"; b.textContent="Autoriser le son"; b.onclick=()=>{ live&&live.ctx.resume(); n.textContent=""; }; n.appendChild(b); }
}
window.addEventListener("message",e=>{
  const m=e.data; if(!m||typeof m!=="object"||m.bourdon!==1||!m.cmd) return;
  if(!TELE.on) return;
  /* seulement la fenêtre qui nous a ouverts, la page qui nous intègre, ou une page de notre propre site (l'extension Owlbear Rodeo y est publiée) */
  const sameSite=e.origin===location.origin&&location.origin!=="null"&&e.source!==window;
  if(!e.source||!(sameSite||(window.opener&&e.source===window.opener)||(window.parent!==window&&e.source===window.parent))) return;
  let r; try{ r=teleRun(m); }catch(x){ r={ok:false, erreur:String(x&&x.message||x)}; }
  TELE.from=e.origin; TELE.n++; teleUI();
  try{ e.source.postMessage({bourdon:1, re:m.id===undefined?null:m.id, cmd:m.cmd, ...r, etat:teleState()}, e.origin==="null"?"*":e.origin); }catch(x){}
});
function teleUI(){
  const b=$("teleOn"), n=$("teleFrom"); if(b) b.checked=TELE.on;
  if(n) n.textContent=TELE.on?(TELE.from?"Pilotée depuis "+TELE.from+" ("+TELE.n+" ordre"+(TELE.n>1?"s":"")+")":"En attente d'une table virtuelle"):"";
}
function teleBuild(){
  const host=document.querySelector(".seance"); if(!host||$("teleOn")) return;
  const w=document.createElement("div"); w.className="presets telebox";
  w.innerHTML='<div class="ctl"><label for="teleOn">Télécommande</label><span class="tele-row"><input type="checkbox" id="teleOn"> <span>accepter les ordres d\'une table virtuelle (module Foundry VTT)</span></span>'+
    '<p class="hint" id="teleFrom" aria-live="polite"></p><p class="hint" id="teleNote"></p></div>';
  host.appendChild(w);
  $("teleOn").onchange=()=>{ TELE.on=$("teleOn").checked; try{ localStorage.setItem("bourdon.tele",TELE.on?"1":"0"); }catch(e){} teleUI(); };
  teleUI();
  /* dire à la fenêtre qui nous a ouverts que nous sommes prêts (rien d'autre ne part) */
  if(TELE.on&&window.opener) try{ window.opener.postMessage({bourdon:1, pret:true},"*"); }catch(e){}
}
/* un lien qui ouvre sur une scène : ?ambiance=, ?univers=, ?emotions= (sans lancer le son, que le navigateur refuserait) */
function teleLink(){
  let q; try{ q=new URLSearchParams(location.search); }catch(e){ return; }
  const amb=q.get("ambiance"), uni=q.get("univers"), emo=q.get("emotions");
  if(amb) teleRun({cmd:"ambiance", nom:amb});
  else if(emo) teleRun({cmd:"emotions", liste:emo, univers:uni||undefined});
  else if(uni) teleRun({cmd:"univers", id:uni});
}
