"use strict";
/* ============================================================
   AFFECTUS : table de correspondance entre gammes, tonalités et émotions
   Chaque gamme et chaque tonalité (majeure ou mineure) porte des affects pondérés ;
   on lit ce que dégage une couleur, ou on cherche la couleur qui dégage une émotion.
   ============================================================ */
const EMOTIONS=["mystérieux","fataliste","héroïque","mélancolique","joyeux","féerique","inquiétant","majestueux","nostalgique","serein","tragique","étrange","sauvage","sacré"];

/* gammes : une phrase de caractère, puis le poids de chaque affect (0 à 1) */
const AFF_SC={
  ionien:["lumineux, stable, pastoral",{joyeux:1,serein:.8,majestueux:.5,héroïque:.5}],
  dorien:["noble, chaleureux, médiéval",{nostalgique:.8,mélancolique:.7,majestueux:.5,sacré:.4,sauvage:.2}],
  phrygien:["sombre, fataliste, menaçant",{fataliste:1,inquiétant:.8,tragique:.7,sauvage:.5,sacré:.3}],
  lydien:["féerique, rêveur, émerveillé",{féerique:1,serein:.6,joyeux:.6,mystérieux:.4}],
  mixolydien:["rustique, épique, ouvert",{héroïque:.8,joyeux:.6,sauvage:.6,nostalgique:.4}],
  eolien:["grave, triste, dramatique",{mélancolique:1,tragique:.6,nostalgique:.6,majestueux:.3}],
  locrien:["instable, angoissé, abyssal",{inquiétant:1,étrange:.7,tragique:.6,mystérieux:.6,fataliste:.4}],
  harm:["dramatique, tragique, oriental",{tragique:1,fataliste:.7,majestueux:.6,mystérieux:.4}],
  melo:["hésitant, élégiaque, tendre",{nostalgique:.8,mélancolique:.7,mystérieux:.4,serein:.3}],
  dorien4:["mystérieux, étrange, tzigane",{mystérieux:1,étrange:.8,sauvage:.5,inquiétant:.4}],
  phrygdom:["ardent, fataliste, ibérique",{fataliste:.9,sauvage:.8,tragique:.6,héroïque:.5,mystérieux:.4}],
  lydidom:["malicieux, féerique, tendu",{féerique:.8,étrange:.7,joyeux:.5,mystérieux:.5}],
  dblharm:["exotique, ensorcelant, byzantin",{mystérieux:.9,fataliste:.7,étrange:.7,sacré:.6,majestueux:.5}],
  tzigane:["passionné, sombre, nomade",{sauvage:.9,tragique:.7,fataliste:.6,mélancolique:.6}],
  pentmaj:["ouvert, naïf, serein",{serein:1,joyeux:.7,nostalgique:.4,féerique:.4}],
  pentmin:["nocturne, simple, ancestral",{mélancolique:.7,sauvage:.6,fataliste:.5,mystérieux:.5,nostalgique:.5}],
  hirajoshi:["contemplatif, tendu, zen",{mystérieux:.8,sacré:.7,mélancolique:.6,serein:.5,étrange:.5}],
  insen:["austère, suspendu, ancien",{mystérieux:.8,sacré:.7,fataliste:.5,serein:.4}],
  hexacorde:["clair, chaste, grégorien",{sacré:.9,serein:.8,nostalgique:.5,majestueux:.4}],
  organum:["nu, solennel, archaïque",{sacré:1,majestueux:.7,fataliste:.5,mystérieux:.4}],
  tons:["flottant, onirique, irréel",{étrange:1,féerique:.8,mystérieux:.8,serein:.4}],
  octa:["tendu, magique, inquiétant",{mystérieux:.9,inquiétant:.8,étrange:.7,féerique:.4}],
  rast:["fier, noble, majestueux",{majestueux:1,héroïque:.7,joyeux:.5,serein:.5,sacré:.3}],
  bayati:["intime, nostalgique, tendre",{nostalgique:1,mélancolique:.8,sacré:.4}],
  saba:["poignant, deuil, douleur",{tragique:1,mélancolique:.8,fataliste:.6,nostalgique:.5}],
  enharm:["archaïque, étrange, antique",{étrange:1,mystérieux:.8,sacré:.6,fataliste:.4}],
  libre:["à toi de le dire",{}]
};
/* tonalités : du caractère traditionnel des tons, repris librement (inspiration baroque, pas une règle) */
const AFF_KEY=[
  {maj:["gai, franc, guerrier",{joyeux:.8,héroïque:.7}], min:["obscur, triste, grave",{mélancolique:.8,tragique:.5}]},
  {maj:["feutré, secret, intime",{mystérieux:.7,serein:.5}], min:["sourd, souterrain, inquiet",{inquiétant:.7,fataliste:.6}]},
  {maj:["joyeux, triomphant",{joyeux:.9,héroïque:.8}], min:["grave, dévot, solennel",{sacré:.8,mélancolique:.7,majestueux:.4}]},
  {maj:["noble, dur, solennel",{majestueux:.8,héroïque:.4}], min:["âpre, funèbre, horrible",{tragique:.8,fataliste:.6}]},
  {maj:["brillant, vif, criard",{joyeux:.7,sauvage:.5}], min:["plaintif, amoureux, tendre",{nostalgique:.8,mélancolique:.6}]},
  {maj:["pastoral, emporté, tempétueux",{sauvage:.8,héroïque:.5}], min:["obscur, plaintif",{mélancolique:.7,mystérieux:.5}]},
  {maj:["éclatant, tendu, lumineux",{féerique:.6,joyeux:.5}], min:["ténébreux, fatal",{fataliste:.8,inquiétant:.6}]},
  {maj:["doux, joyeux, rustique",{serein:.8,joyeux:.7}], min:["sérieux, magnifique",{majestueux:.7,tragique:.5}]},
  {maj:["tendre, rêveur",{féerique:.7,serein:.6,nostalgique:.5}], min:["fantomatique, glacial",{mystérieux:.8,inquiétant:.6}]},
  {maj:["champêtre, franc, joyeux",{joyeux:.8,serein:.6}], min:["tendre, plaintif, humain",{nostalgique:.8,mélancolique:.7}]},
  {maj:["magnifique, chaleureux",{majestueux:.8,héroïque:.6}], min:["obscur, terrible",{tragique:.8,inquiétant:.7}]},
  {maj:["dur, éclatant, étrange",{étrange:.6,joyeux:.5}], min:["solitaire, mélancolique",{mélancolique:.9,nostalgique:.5}]}
];
const AFF={sel:new Set(), open:false};
const affQuality=iv=>iv.indexOf(4)>=0?"maj":"min";
/* ce que dégage une couleur : phrase de la gamme, phrase de la tonalité, et le poids de chaque affect (65 % gamme, 35 % tonalité) */
function affOf(key,root){
  const sc=AFF_SC[key]||["",{}], iv=ivOf(S,key), q=affQuality(iv), ka=AFF_KEY[((root%12)+12)%12][q];
  return {scText:sc[0], keyText:ka[0], q, w:e=>0.65*(sc[1][e]||0)+0.35*(ka[1][e]||0)};
}
const affTop=(key,root,n)=>{ const a=affOf(key,root); return EMOTIONS.map(e=>[e,a.w(e)]).filter(x=>x[1]>0.08).sort((x,y)=>y[1]-x[1]).slice(0,n).map(x=>x[0]); };
/* la meilleure tonalité de chaque gamme pour les affects choisis, puis les six meilleures gammes */
function affSuggest(sel){
  if(!sel.length) return [];
  const out=[];
  Object.keys(AFF_SC).filter(k=>k!=="libre"&&SC[k]).forEach(k=>{
    let best=null; for(let r=0;r<12;r++){ const a=affOf(k,r), sc=sel.reduce((s,e)=>s+a.w(e),0)/sel.length; if(!best||sc>best.score) best={key:k,root:r,score:sc}; }
    out.push(best);
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,6);
}
function affUpdate(){
  const now=$("affNow"); if(!now) return;
  const key=(typeof curScaleKey==="function"?curScaleKey():S.scales[0])||"mixolydien", a=affOf(key,S.root), nm=(SC[key]||SC.mixolydien).n.toLowerCase();
  now.innerHTML="<strong>"+NOTES[S.root]+" "+nm+"</strong> : "+a.scText+". <span class=\"aff-k\">Tonalité de "+NOTES[S.root]+" ("+(a.q==="maj"?"plutôt majeure":"plutôt mineure")+") : "+a.keyText+".</span> <em>"+affTop(key,S.root,3).join(" · ")+"</em>";
}
function affApply(key,root){
  S.root=root; S.scales[0]=key; syncUI(); updateRingCap(); if(live) restartIfLive(0.8);
}
function affResults(){
  const host=$("affRes"); if(!host) return; host.innerHTML="";
  const sel=[...AFF.sel], res=affSuggest(sel);
  if(!res.length){ host.appendChild(Object.assign(document.createElement("p"),{className:"hint",textContent:"Choisis une ou plusieurs émotions : la table propose les couleurs qui les dégagent le mieux."})); return; }
  res.forEach(r=>{
    const b=document.createElement("button"); b.type="button"; b.className="aff-opt";
    const nm=SC[r.key].n.replace(/\s*\(.*\)/,""), top=affTop(r.key,r.root,3);
    b.innerHTML='<span class="n">'+nm+" en "+NOTES[r.root]+'</span><span class="t">'+top.join(" · ")+'</span><span class="s" aria-hidden="true"><i style="width:'+Math.round(Math.min(1,r.score)*100)+'%"></i></span>';
    b.setAttribute("aria-label","Appliquer "+nm+" en "+NOTES[r.root]); b.onclick=()=>affApply(r.key,r.root); host.appendChild(b);
  });
}
function affTable(){
  let h='<table class="aff-table"><caption>Gammes</caption><thead><tr><th>Gamme</th><th>Ce qu\'elle dégage</th><th>Affects dominants</th></tr></thead><tbody>';
  SCALE_GROUPS.forEach(([g,l])=>l.forEach(([k,n])=>{ if(k==="libre") return; const w=AFF_SC[k][1], top=Object.keys(w).sort((a,b)=>w[b]-w[a]).slice(0,3); h+="<tr><th scope=\"row\">"+n+"</th><td>"+AFF_SC[k][0]+"</td><td><em>"+top.join(" · ")+"</em></td></tr>"; }));
  h+='</tbody></table><table class="aff-table"><caption>Tonalités</caption><thead><tr><th>Note</th><th>Plutôt majeure</th><th>Plutôt mineure</th></tr></thead><tbody>';
  AFF_KEY.forEach((k,i)=>{ h+="<tr><th scope=\"row\">"+NOTES[i]+"</th><td>"+k.maj[0]+"</td><td>"+k.min[0]+"</td></tr>"; });
  return h+"</tbody></table>";
}
function affPanel(){
  const w=document.createElement("div"); w.className="aff";
  w.innerHTML='<p class="aff-now" id="affNow" aria-live="polite"></p><p class="aff-lab">Je cherche une ambiance :</p><div class="aff-chips" id="affChips" role="group" aria-label="Émotions"></div><div class="aff-res" id="affRes"></div><details class="fin"><summary>La table des affects en entier</summary><div class="aff-tables">'+affTable()+'</div></details>';
  const chips=w.querySelector("#affChips");
  EMOTIONS.forEach(e=>{ const b=document.createElement("button"); b.type="button"; b.className="aff-chip"; b.textContent=e; b.setAttribute("aria-pressed","false"); b.onclick=()=>{ if(AFF.sel.has(e)) AFF.sel.delete(e); else AFF.sel.add(e); b.setAttribute("aria-pressed",AFF.sel.has(e)?"true":"false"); affResults(); }; chips.appendChild(b); });
  return w;
}
