"use strict";
/* ============================================================
   ICÔNES : registre sobre, une grille de 24, trait de 1,6 aux bouts carrés et angles vifs,
   un seul carré cinabre par icône (comme la diode d'une touche). Un sprite SVG est injecté dans la page ;
   ic("nom") rend une icône, qui hérite de la couleur du texte autour.
   ============================================================ */
const ICONS={
  conduire:'<circle cx="12" cy="12" r="4.5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><rect class="a" x="10.6" y="10.6" width="2.8" height="2.8"/>',
  composer:'<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/><rect class="a" x="3" y="18" width="3" height="3"/>',
  forger:'<path d="M3 8h15c0 2.2-1.4 3.6-4.5 4v3H17v3H8v-3h3.5v-3C7.5 11.6 4.2 10.2 3 8z"/><rect class="a" x="19" y="4" width="3" height="3"/>',
  arranger:'<rect x="3" y="4" width="10" height="4"/><rect x="8" y="10" width="13" height="4"/><rect x="5" y="16" width="9" height="4"/><rect class="a" x="8" y="10" width="4" height="4"/>',
  suspense:'<path d="M6 3h12M6 21h12M7 3c0 5.5 5 6 5 9s-5 3.5-5 9M17 3c0 5.5-5 6-5 9s5 3.5 5 9"/><rect class="a" x="10.7" y="10.7" width="2.6" height="2.6"/>',
  revelation:'<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 4v3M4.8 8.8l2.1 2.1M19.2 8.8l-2.1 2.1"/><rect class="a" x="10.6" y="12" width="2.8" height="2.8"/>',
  danger:'<path d="M12 3L22 20H2z"/><path d="M12 9v5"/><rect class="a" x="10.8" y="16" width="2.4" height="2.4"/>',
  poursuite:'<path d="M3 6l6 6-6 6M10 6l6 6-6 6"/><rect class="a" x="18" y="10.5" width="3" height="3"/>',
  triomphe:'<path d="M3 19h18M4 19L3 8l5 4 4-7 4 7 5-4-1 11"/><rect class="a" x="10.8" y="2" width="2.4" height="2.4"/>',
  apaisement:'<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/><rect class="a" x="10.8" y="19" width="2.4" height="2.4"/>',
  jouer:'<path d="M7 4l13 8-13 8z"/><rect class="a" x="3" y="10.5" width="2.5" height="3"/>',
  arreter:'<rect x="5" y="5" width="14" height="14"/><rect class="a" x="9" y="9" width="6" height="6"/>',
  figer:'<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><rect class="a" x="10.5" y="10.5" width="3" height="3"/>',
  phrase:'<rect x="4" y="4" width="16" height="16"/><circle class="f" cx="9" cy="9" r="1.4"/><circle class="f" cx="15" cy="15" r="1.4"/><rect class="a" x="10.8" y="10.8" width="2.4" height="2.4"/>',
  hasard:'<path d="M3 7h4l10 10h4M3 17h4l2.5-2.5M14.5 9.5L17 7h4M18 4l3 3-3 3M18 14l3 3-3 3"/><rect class="a" x="10.8" y="10.8" width="2.4" height="2.4"/>',
  capturer:'<circle cx="12" cy="12" r="8"/><circle class="a" cx="12" cy="12" r="3.6"/>',
  exporter:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/><rect class="a" x="10.8" y="16.8" width="2.4" height="2.4"/>',
  mixeur:'<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="8" width="4" height="3"/><rect class="a" x="10" y="14" width="4" height="3"/><rect x="16" y="6" width="4" height="3"/>',
  veillee:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle class="a" cx="12" cy="12" r="3"/>',
  ecran:'<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><rect class="a" x="10.5" y="10.5" width="3" height="3"/>',
  nuit:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/><rect class="a" x="16" y="4" width="2.6" height="2.6"/>',
  aide:'<circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.8"/><rect class="a" x="10.8" y="15.8" width="2.4" height="2.4"/>',
  volume:'<path d="M3 9.5h4l5-4v13l-5-4H3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><rect class="a" x="4.2" y="10.8" width="2" height="2.4"/>',
  tension:'<path d="M2 12h5l2.5-7 3.5 14 2.5-7H22"/><rect class="a" x="10.8" y="2.4" width="2.4" height="2.4"/>',
  densite:'<rect x="4" y="4" width="4" height="4"/><rect x="10" y="4" width="4" height="4"/><rect x="16" y="4" width="4" height="4"/><rect x="4" y="10" width="4" height="4"/><rect class="a" x="10" y="10" width="4" height="4"/><rect x="16" y="10" width="4" height="4"/><rect x="4" y="16" width="4" height="4"/><rect x="10" y="16" width="4" height="4"/><rect x="16" y="16" width="4" height="4"/>',
  bourdon:'<path d="M3 12h18M3 8v8M21 8v8M7 9.5v5M17 9.5v5"/><rect class="a" x="10.8" y="9" width="2.4" height="6"/>',
  nappes:'<path d="M12 4l9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/><rect class="a" x="10.8" y="6.8" width="2.4" height="2.4"/>',
  brume:'<path d="M10 7a7 7 0 0 1 0 10M14.5 4a11 11 0 0 1 0 16M19 1.5a15 15 0 0 1 0 21"/><rect class="a" x="3" y="10.5" width="3" height="3"/>',
  nuage:'<rect x="3" y="12" width="3" height="3"/><rect x="8" y="9" width="3" height="3"/><rect x="13" y="12" width="3" height="3"/><rect x="18" y="8" width="3" height="3"/><rect x="6" y="16" width="3" height="3"/><rect x="16" y="16" width="3" height="3"/><rect class="a" x="10.5" y="14" width="3" height="3"/>',
  chaleur:'<path d="M12 3c1 4.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.3 1.2-3.8 2.5-4.8 0 2 1 3.3 2.2 3.3C11.2 8.5 11 6 12 3z"/><rect class="a" x="10.8" y="14" width="2.4" height="3"/>',
  dungeon:'<path d="M2 20l7-11 3.5 5 3-4L22 20z"/><path d="M7.5 20v-3h3v3"/><rect class="a" x="17" y="3.5" width="2.6" height="2.6"/>',
  medieval:'<path d="M5 21V10a7 7 0 0 1 14 0v11z"/><path d="M12 21V8M8.5 14h7"/><rect class="a" x="10.8" y="2.6" width="2.4" height="2.4"/>',
  aventure:'<path d="M4 4l14 14M20 4L6 18M14 20l6-6M4 14l6 6"/><rect class="a" x="10.7" y="10.7" width="2.6" height="2.6"/>',
  pirates:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14c0 4 3 7 7 7s7-3 7-7M3 14h4M17 14h4"/><rect class="a" x="10.8" y="15.5" width="2.4" height="2.4"/>',
  nordique:'<path d="M8 3v18M8 8l9 4-9 4"/><rect class="a" x="18" y="10.8" width="2.4" height="2.4"/>',
  feerie:'<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/><rect class="a" x="10.8" y="10.8" width="2.4" height="2.4"/>',
  horreur:'<path d="M5 11a7 7 0 0 1 14 0v3.5l-2 1V20H7v-4.5l-2-1z"/><path d="M10 20v-3M12 20v-3M14 20v-3"/><rect class="a" x="8" y="10" width="2.6" height="3"/><rect class="a" x="13.4" y="10" width="2.6" height="3"/>',
  western:'<path d="M12 3l2.6 5.4 5.9.9-4.3 4.1 1 5.9L12 16.5l-5.2 2.8 1-5.9L3.5 9.3l5.9-.9z"/><rect class="a" x="10.8" y="9.8" width="2.4" height="2.4"/>',
  cyber:'<rect x="6" y="6" width="12" height="12"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/><rect class="a" x="10" y="10" width="4" height="4"/>',
  espace:'<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-20 12 12)"/><rect class="a" x="18.5" y="3.5" width="2.6" height="2.6"/>',
  orient:'<path d="M16 4a8 8 0 1 0 0 16 6.5 6.5 0 0 1 0-16z"/><rect class="a" x="17.5" y="9" width="3" height="3"/>',
  nature:'<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19l8-8"/><rect class="a" x="16" y="7" width="2.4" height="2.4"/>',
  calme:'<path d="M12 3a9 9 0 1 0 8 5"/><rect class="a" x="18.4" y="5.8" width="3" height="3"/>'
};
const ic=(name,cls)=>ICONS[name]?'<svg class="ic'+(cls?" "+cls:"")+'" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-'+name+'"/></svg>':"";
(function icInit(){
  if(document.getElementById("icSprite")) return;
  const s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.id="icSprite"; s.setAttribute("width","0"); s.setAttribute("height","0"); s.setAttribute("aria-hidden","true"); s.style.cssText="position:absolute;width:0;height:0;overflow:hidden";
  s.innerHTML="<defs>"+Object.keys(ICONS).map(k=>'<symbol id="i-'+k+'" viewBox="0 0 24 24">'+ICONS[k]+"</symbol>").join("")+"</defs>";
  document.body.insertBefore(s,document.body.firstChild);
})();
