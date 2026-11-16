"use strict";
/* à chaque ouverture, une réplique au hasard remplace l'accroche */
const CITES=["Le bourdon doit couler.","Un bourdon pour les gouverner tous.","Dans les ténèbres de la crypte, il n'y a que le bourdon.","Tu ne moduleras point.","Ce ne sont pas les fausses notes que vous cherchez.","Il est dangereux d'y aller seul : prends ce bourdon.","Hé, toi, tu es enfin accordé.","L'hiver vient, et la réverb avec.","Jet de sauvegarde contre le silence.","Le Dieu-Empereur protège la tonique.","Vous qui entrez ici, abandonnez tout silence.","Dans une crypte vivait un bourdon.","Mon précieux bourdon.","C'est pas faux : c'est un quart de ton.","Jette une pièce à ton barde.","Louez le bourdon !","Là où nous allons, nous n'avons pas besoin de samples.","Que la quinte soit avec toi."];
{ const l=document.querySelector(".lede"); if(l) l.textContent=CITES[Math.floor(Math.random()*CITES.length)]; }
/* ============================================================
   DÉMARRAGE
   ============================================================ */
buildRing(); buildChapters(); buildPresets(); buildJeu(); buildAtelier(); buildDaw(); $("dawBtn").onclick=()=>setMode("daw"); $("reglBtn").onclick=()=>setMode("reglage"); $("atelierBtn").onclick=()=>setMode("atelier"); syncUI(); wxInit(); restoreMode(); setMode(MODE);
document.querySelector("#presets .lnk").setAttribute("aria-current","true");
/* la partition suit la taille de son cadre et attend que les polices soient chargées */
vizFit();
if(window.ResizeObserver) new ResizeObserver(()=>vizFit()).observe($("scoreCv")); else window.addEventListener("resize",vizFit);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ vizFit(); });
