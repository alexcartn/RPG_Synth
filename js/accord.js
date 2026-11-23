"use strict";
/* ============================================================
   ACCORD : importer une gamme Scala (.scl), le format de l'archive de Manuel Op de Coul
   Chaque degré garde sa vraie hauteur en cents pour le son, et prend une place sur la grille à 24 quarts de ton
   pour la logique musicale (accords, mélodie, cercle). 24 notes par octave au plus.
   ============================================================ */
function scalaApply(sc){
  S.scala=sc; S.scales=["scala","",""]; S.temper="scala";
  syncUI(); if(typeof updateRingCap==="function") updateRingCap(); if(typeof restartIfLive==="function") restartIfLive(0.8);
}
function scalaNote(t){ const n=$("scalaNote"); if(n) n.textContent=t; }
function scalaLoad(file){
  if(!file) return;
  const rd=new FileReader();
  rd.onload=()=>{ try{ const sc=parseScala(rd.result); scalaApply(sc);
      scalaNote("« "+sc.name+" » : "+sc.n+" notes par octave"+(sc.warn?" ("+sc.warn+")":"")+". Tempérament réglé sur la gamme importée."); }
    catch(e){ scalaNote("Import impossible : "+(e.message||e)+"."); } };
  rd.onerror=()=>scalaNote("Fichier illisible.");
  rd.readAsText(file);
}
function scalaBuild(){
  const tp=$("c_temper"); if(!tp||$("scalaFile")) return;
  const ctl=tp.closest(".ctl")||tp.parentNode, w=document.createElement("div"); w.className="ctl scalabox";
  w.innerHTML='<label for="scalaFile">Gamme Scala (.scl)</label><input type="file" id="scalaFile" accept=".scl,text/plain">'+
    '<p class="hint" id="scalaNote">Un accordage venu d\'ailleurs : l\'archive Scala en compte des milliers (gamelan, maqams mesurés, tempéraments historiques). Les degrés gardent leur hauteur exacte, au son comme en MIDI.</p>';
  ctl.after(w);
  $("scalaFile").onchange=e=>scalaLoad(e.target.files&&e.target.files[0]);
  if(S.scala&&S.scala.name) scalaNote("Gamme en mémoire : « "+S.scala.name+" ».");
}
