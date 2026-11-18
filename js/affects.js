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
  chromgr:["antique, plaintif, tendu",{tragique:1,mélancolique:.8,étrange:.6,sacré:.5}],
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
/* ce que chaque émotion veut dire à la table : sert d'infobulle */
const EMO_TIP={mystérieux:"Ce qu'on ne comprend pas encore : une porte entrouverte, un secret.",fataliste:"Rien ne sera évité : le destin est en marche.",héroïque:"On se redresse et on avance : audace, bannières, courage.",mélancolique:"Une tristesse douce, qu'on garde près de soi.",joyeux:"Fête, rires, chopes levées.",féerique:"Émerveillement, magie légère, un monde qui scintille.",inquiétant:"Quelque chose cloche, sans qu'on sache quoi.",majestueux:"Grandeur, solennité, une salle de trône.",nostalgique:"Le souvenir d'un temps ou d'un lieu perdu.",serein:"Calme, paix, rien ne presse.",tragique:"Le deuil, la perte, le drame qui éclate.",étrange:"Hors des repères : onirique, déroutant, non humain.",sauvage:"Instinct, danse brute, nature sans maître.",sacré:"Chant d'église, rite, recueillement."};
const AFF={sel:new Set(), open:false};
const affQuality=iv=>iv.indexOf(4)>=0?"maj":"min";
/* ce que dégage une couleur : phrase de la gamme, phrase de la tonalité, et le poids de chaque affect (65 % gamme, 35 % tonalité) */
function affOf(key,root){
  const sc=AFF_SC[key]||["",{}], iv=ivOf(S,key), q=affQuality(iv), ka=AFF_KEY[((root%12)+12)%12][q];
  return {scText:sc[0], keyText:ka[0], q, w:e=>0.65*(sc[1][e]||0)+0.35*(ka[1][e]||0)};
}
const affTop=(key,root,n)=>{ const a=affOf(key,root); return EMOTIONS.map(e=>[e,a.w(e)]).filter(x=>x[1]>0.08).sort((x,y)=>y[1]-x[1]).slice(0,n).map(x=>x[0]); };
/* la meilleure tonalité de chaque gamme pour les affects choisis, puis les six meilleures gammes */
function affSuggest(sel,allow,n){
  if(!sel.length) return [];
  const out=[];
  Object.keys(AFF_SC).filter(k=>k!=="libre"&&SC[k]&&(!allow||allow(k))).forEach(k=>{
    let best=null; for(let r=0;r<12;r++){ const a=affOf(k,r), sc=sel.reduce((s,e)=>s+a.w(e),0)/sel.length; if(!best||sc>best.score) best={key:k,root:r,score:sc}; }
    out.push(best);
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,n||6);
}
function affUpdate(){
  const now=$("affNow"); if(!now) return;
  const key=(typeof curScaleKey==="function"?curScaleKey():S.scales[0])||"mixolydien", a=affOf(key,S.root), nm=(SC[key]||SC.mixolydien).n.toLowerCase();
  now.innerHTML="<strong>"+NOTES[S.root]+" "+nm+"</strong> : "+a.scText+". <span class=\"aff-k\">Tonalité de "+NOTES[S.root]+" ("+(a.q==="maj"?"plutôt majeure":"plutôt mineure")+") : "+a.keyText+".</span> <em>"+affTop(key,S.root,3).join(" · ")+"</em>";
}
function affApply(key,root){
  S.root=root; S.scales[0]=key; syncUI(); updateRingCap(); if(live) restartIfLive(0.8);
}
/* ---------- première page : un univers et ce qu'on cherche ----------
   L'univers donne l'instrumentation, l'espace et le rythme (un de ses préréglages sert de base) ; les affects choisissent la gamme et la tonalité,
   et règlent la tension. La meilleure proposition s'applique tout de suite, les autres sont à un clic. */
const AFF_MAQAM=["rast","bayati","saba","enharm"];
/* agitation de chaque affect (0 = calme, 1 = tendu) : règle la tension de départ */
const AFF_AROUSAL={mystérieux:.5,fataliste:.6,héroïque:.65,mélancolique:.35,joyeux:.55,féerique:.4,inquiétant:.8,majestueux:.6,nostalgique:.3,serein:.2,tragique:.75,étrange:.6,sauvage:.75,sacré:.3};
const seekUni=()=>{ try{ const v=localStorage.getItem("bourdon.univers"); if(UNIVERS.some(x=>x.id===v)) return v; }catch(e){} return "medieval"; };
/* propositions : les meilleures gammes pour les affects choisis, chacune sur le préréglage de l'univers qui lui ressemble le plus */
/* agitation d'un préréglage (0 calme, 1 tendu), d'après sa tension, sa percussion et son tempo */
const presetArousal=o=>{ const t=o.tension===undefined?0.5:o.tension, pl=(o.perc&&o.perc.lvl!==undefined)?o.perc.lvl:DEFAULT.perc.lvl, tp=((o.tempo||DEFAULT.tempo)-40)/110; return Math.max(0,Math.min(1,0.45*t+0.3*pl+0.25*tp)); };
const selArousal=sel=>sel.reduce((t,e)=>t+(AFF_AROUSAL[e]===undefined?0.5:AFF_AROUSAL[e]),0)/sel.length;
function affPropose(uid,sel){
  const u=UNIVERS.find(x=>x.id===uid)||UNIVERS[0], items=u.items, allow=k=>uid==="orient"||AFF_MAQAM.indexOf(k)<0;
  const baseOf=it=>{ const o=it[1]; return {k:(o.scales&&o.scales[0])||DEFAULT.scales[0], r:o.root!==undefined?o.root:DEFAULT.root}; };
  const score=(k,r)=>{ const a=affOf(k,r); return sel.reduce((t,e)=>t+a.w(e),0)/sel.length; };
  const used=new Set(), out=[];
  affSuggest(sel,allow,5).forEach(sg=>{
    let best=null; items.forEach(it=>{ if(used.has(it[0])) return; const b=baseOf(it), s=(b.k===sg.key?2:0)+score(b.k,b.r)+2.5*(1-Math.abs(presetArousal(it[1])-selArousal(sel))); if(!best||s>best.s) best={it,s}; });
    if(!best) best={it:items[0],s:0}; used.add(best.it[0]); out.push({preset:best.it,key:sg.key,root:sg.root,score:sg.score});
  });
  return out;
}
function affStart(pr){
  const over=clone(pr.preset[1]); over.scales=[pr.key,"",""]; over.root=pr.root;
  const sel=[...AFF.sel];
  /* l'ambiance prise comme base est ramenée vers l'agitation voulue : percussion et densité suivent, sans toucher au tempo ni à la mesure */
  if(sel.length){ const a=selArousal(sel), k=0.5+a, cl=v=>Math.round(Math.min(1,v)*100)/100;
    if(over.perc&&over.perc.lvl>0) over.perc.lvl=cl(over.perc.lvl*Math.min(1.3,k));
    if(over.mel&&over.mel.dens!==undefined) over.mel.dens=cl(over.mel.dens*(0.7+0.6*a)); }
  if(sel.length) over.tension=Math.round(Math.max(0.1,Math.min(0.9,sel.reduce((t,e)=>t+(AFF_AROUSAL[e]===undefined?0.5:AFF_AROUSAL[e]),0)/sel.length))*100)/100;
  loadScene(over,null,undefined,{name:pr.preset[0],gloss:pr.preset[2],univ:seekUni()});
  const g=$("presetGloss"); if(g) g.textContent="";
  document.querySelectorAll("#presets .lnk").forEach(x=>x.removeAttribute("aria-current"));
}
function affResults(auto){
  const host=$("affRes"); if(!host) return; host.innerHTML="";
  const sel=[...AFF.sel];
  if(!sel.length){ host.appendChild(Object.assign(document.createElement("p"),{className:"hint",textContent:"Facultatif : une ou plusieurs émotions règlent la gamme, la tonalité et la tension. Sans choix, on part de la première ambiance de l'univers."})); return; }
  const res=affPropose(seekUni(),sel); AFF.props=res;
  res.forEach((r,i)=>{
    const b=document.createElement("button"); b.type="button"; b.className="aff-opt";
    const nm=SC[r.key].n.replace(/\s*\(.*\)/,""), top=affTop(r.key,r.root,3);
    b.innerHTML='<span class="n">'+nm+" en "+NOTES[r.root]+'</span><span class="t">'+top.join(" · ")+'</span><span class="b">sur l\'ambiance '+r.preset[0]+'</span><span class="s" aria-hidden="true"><i style="width:'+Math.round(Math.min(1,r.score)*100)+'%"></i></span>';
    b.setAttribute("aria-label","Partir de "+nm+" en "+NOTES[r.root]+", ambiance "+r.preset[0]); b.title="Jouer "+nm+" en "+NOTES[r.root]+" sur l'ambiance "+r.preset[0]+" : "+r.preset[2]+"."; if(i===0) b.setAttribute("aria-current","true");
    b.onclick=()=>{ host.querySelectorAll(".aff-opt").forEach(x=>x.removeAttribute("aria-current")); b.setAttribute("aria-current","true"); affStart(r); };
    host.appendChild(b);
  });
  if(auto&&res.length) affStart(res[0]);
}
function chipsSync(){ document.querySelectorAll("#affChips .aff-chip").forEach(b=>b.setAttribute("aria-pressed",AFF.sel.has(b.textContent)?"true":"false")); }
function seekToggle(e){
  if(AFF.sel.has(e)) AFF.sel.delete(e); else AFF.sel.add(e);
  chipsSync(); affResults(true);
}
function seekTag(){ const u=UNIVERS.find(x=>x.id===seekUni())||UNIVERS[0], t=$("seekTag"); if(t) t.textContent=u.tag||""; }
function seekUniverse(id){
  if(!UNIVERS.some(x=>x.id===id)) return;
  try{ localStorage.setItem("bourdon.univers",id); }catch(e){}
  const sel=$("univers"); if(sel){ sel.value=id; } if(typeof drawPresetRow==="function") drawPresetRow();
  document.querySelectorAll("#seekUni .lnk").forEach(b=>{ if(b.dataset.id===id) b.setAttribute("aria-current","true"); else b.removeAttribute("aria-current"); });
  seekNamed(); seekTag();
  if(AFF.sel.size) affResults(true); else{ affResults(false); const u=UNIVERS.find(x=>x.id===id); if(u&&u.items.length) loadScene(u.items[0][1],null); }
}
/* au hasard : un univers et une ou deux émotions, pour se laisser surprendre */
function seekRandom(){
  const pick=a=>a[Math.floor(Math.random()*a.length)], u=pick(UNIVERS);
  AFF.sel.clear(); const n=1+(Math.random()<0.5?1:0); while(AFF.sel.size<n) AFF.sel.add(pick(EMOTIONS));
  chipsSync(); seekUniverse(u.id);
}
/* les ambiances nommées de l'univers choisi, pour qui sait ce qu'il veut */
function seekNamed(){
  const host=$("seekPresets"); if(!host) return; host.innerHTML="";
  const u=UNIVERS.find(x=>x.id===seekUni())||UNIVERS[0];
  u.items.forEach(([name,over,gloss])=>{ const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=name; b.title=gloss; b.onclick=()=>{ loadScene(over,null); host.querySelectorAll(".lnk").forEach(x=>x.removeAttribute("aria-current")); b.setAttribute("aria-current","true"); const g=$("seekGloss"); if(g) g.textContent=name+" : "+gloss+"."; }; host.appendChild(b); });
}
function seekBuild(){
  const host=$("seekBox"); if(!host) return;
  host.innerHTML='<div class="seek-row"><span class="seek-l"><i>1</i>Choisis un univers</span><div class="seek-c"><div class="seek-uni" id="seekUni" role="group" aria-label="Univers"></div><p class="seek-tag" id="seekTag"></p></div></div>'+
    '<div class="seek-row"><span class="seek-l"><i>2</i>Une émotion ?<small>facultatif</small></span><div class="seek-c"><div class="aff-chips" id="affChips" role="group" aria-label="Émotions"></div></div></div>'+
    '<div class="seek-row"><span class="seek-l"><i>3</i>Un seul départ<small>clique l\'un d\'eux</small></span><div class="seek-c"><div class="aff-res" id="affRes"></div><p class="aff-now" id="affNow" aria-live="polite"></p></div></div>'+
    '<div class="seek-more"><details class="fin"><summary>Ambiances nommées de l\'univers</summary><div class="seek-named"><div class="row" id="seekPresets"></div><p class="hint" id="seekGloss"></p></div></details>'+
    '<details class="fin"><summary>La table des affects en entier</summary><div class="aff-tables">'+affTable()+'</div></details></div>';
  const uni=host.querySelector("#seekUni"), cur=seekUni();
  UNIVERS.forEach(u=>{ const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.dataset.id=u.id; b.innerHTML=ic(u.id)+"<span>"+u.name+"</span>"; b.title=u.tag; if(u.id===cur) b.setAttribute("aria-current","true"); b.onclick=()=>seekUniverse(u.id); uni.appendChild(b); });
  { const r=document.createElement("button"); r.type="button"; r.className="lnk seek-rnd"; r.id="seekRnd"; r.innerHTML=ic("hasard")+"<span>Au hasard</span>"; r.title="Un univers et une ou deux émotions tirés au sort : pour se laisser surprendre"; r.onclick=seekRandom; uni.appendChild(r); }
  const chips=host.querySelector("#affChips");
  const scName=k=>SC[k].n.replace(/\s*\(.*\)/,"").toLowerCase();
  EMOTIONS.forEach(e=>{ const b=document.createElement("button"); b.type="button"; b.className="aff-chip"; b.textContent=e; b.setAttribute("aria-pressed","false");
    const best=Object.keys(AFF_SC).filter(k=>k!=="libre"&&SC[k]).sort((x,y)=>(AFF_SC[y][1][e]||0)-(AFF_SC[x][1][e]||0)).slice(0,3).map(scName).join(", ");
    b.title=EMO_TIP[e]+" Gammes qui le portent le mieux : "+best+"."; b.onclick=()=>seekToggle(e); chips.appendChild(b); });
  seekNamed(); seekTag(); affResults(false); affUpdate();
}
function affTable(){
  let h='<table class="aff-table"><caption>Gammes</caption><thead><tr><th>Gamme</th><th>Ce qu\'elle dégage</th><th>Affects dominants</th></tr></thead><tbody>';
  SCALE_GROUPS.forEach(([g,l])=>l.forEach(([k,n])=>{ if(k==="libre") return; const w=AFF_SC[k][1], top=Object.keys(w).sort((a,b)=>w[b]-w[a]).slice(0,3); h+="<tr><th scope=\"row\">"+n+"</th><td>"+AFF_SC[k][0]+"</td><td><em>"+top.join(" · ")+"</em></td></tr>"; }));
  h+='</tbody></table><table class="aff-table"><caption>Tonalités</caption><thead><tr><th>Note</th><th>Plutôt majeure</th><th>Plutôt mineure</th></tr></thead><tbody>';
  AFF_KEY.forEach((k,i)=>{ h+="<tr><th scope=\"row\">"+NOTES[i]+"</th><td>"+k.maj[0]+"</td><td>"+k.min[0]+"</td></tr>"; });
  return h+"</tbody></table>";
}
