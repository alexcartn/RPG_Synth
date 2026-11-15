"use strict";
/* ============================================================
   DÉMARRAGE
   ============================================================ */
buildRing(); buildChapters(); buildPresets(); buildTable(); buildJeu(); buildAtelier(); $("atelierBtn").onclick=()=>setMode(MODE==="atelier"?"reglage":"atelier"); syncUI(); restoreMode();
document.querySelector("#presets .lnk").setAttribute("aria-current","true");
/* la partition suit la taille de son cadre et attend que les polices soient chargées */
vizFit();
if(window.ResizeObserver) new ResizeObserver(()=>vizFit()).observe($("scoreCv")); else window.addEventListener("resize",vizFit);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ vizFit(); });
