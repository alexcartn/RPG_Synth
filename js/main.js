"use strict";
/* ============================================================
   DÉMARRAGE
   ============================================================ */
buildRing(); buildChapters(); buildPresets(); buildJeu(); buildAtelier(); $("reglBtn").onclick=()=>setMode("reglage"); $("atelierBtn").onclick=()=>setMode("atelier"); syncUI(); restoreMode();
document.querySelector("#presets .lnk").setAttribute("aria-current","true");
/* la partition suit la taille de son cadre et attend que les polices soient chargées */
vizFit();
if(window.ResizeObserver) new ResizeObserver(()=>vizFit()).observe($("scoreCv")); else window.addEventListener("resize",vizFit);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ vizFit(); });
