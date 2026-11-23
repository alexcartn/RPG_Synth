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
/* ---------- les émotions sur deux axes, et les indices qui les portent ----------
   Chaque émotion est placée sur le cercle de Russell (1980) : valence (de -1, déplaisant, à 1, plaisant) et éveil (de 0, calme, à 1, agité).
   Les émotions perçues en musique se ramènent bien à ces deux axes (Eerola et Vuoskoski, 2011).
   Ses indices viennent du tableau de Gabrielsson et Lindström (Handbook of Music and Emotion, 2010) et des poids mesurés par
   Eerola, Friberg et Bresin (2013) : le mode et le tempo d'abord, puis le registre, la nuance, l'articulation et le timbre.
   Chaque indice va de 0 à 1 : tempo (lent à vif), registre (grave à aigu), densité (rare à continu), lumière (sombre à clair),
   legato (détaché à lié), tension (consonant à dissonant et nerveux), espace (proche à immense : convention du genre, pas de la recherche). */
const AFF_VA={
  mystérieux:{v:-0.05,a:0.4,  c:{tempo:.35,reg:.45,dens:.35,lum:.35,leg:.75,tens:.5, esp:.8}},
  fataliste: {v:-0.6, a:0.5,  c:{tempo:.4, reg:.25,dens:.5, lum:.25,leg:.6, tens:.6, esp:.6}},
  héroïque:  {v:0.6,  a:0.75, c:{tempo:.7, reg:.55,dens:.65,lum:.7, leg:.4, tens:.45,esp:.6}},
  mélancolique:{v:-0.55,a:0.25,c:{tempo:.25,reg:.4, dens:.35,lum:.3, leg:.85,tens:.3, esp:.55}},
  joyeux:    {v:0.85, a:0.7,  c:{tempo:.8, reg:.7, dens:.7, lum:.85,leg:.3, tens:.2, esp:.35}},
  féerique:  {v:0.6,  a:0.45, c:{tempo:.5, reg:.85,dens:.5, lum:.85,leg:.55,tens:.25,esp:.75}},
  inquiétant:{v:-0.65,a:0.7,  c:{tempo:.45,reg:.3, dens:.4, lum:.2, leg:.45,tens:.85,esp:.65}},
  majestueux:{v:0.45, a:0.55, c:{tempo:.4, reg:.35,dens:.55,lum:.6, leg:.75,tens:.35,esp:.85}},
  nostalgique:{v:-0.1,a:0.25, c:{tempo:.3, reg:.5, dens:.4, lum:.5, leg:.85,tens:.25,esp:.5}},
  serein:    {v:0.6,  a:0.1,  c:{tempo:.15,reg:.55,dens:.2, lum:.6, leg:.9, tens:.1, esp:.6}},
  tragique:  {v:-0.85,a:0.6,  c:{tempo:.35,reg:.3, dens:.5, lum:.2, leg:.7, tens:.75,esp:.7}},
  étrange:   {v:-0.2, a:0.5,  c:{tempo:.45,reg:.6, dens:.4, lum:.45,leg:.5, tens:.7, esp:.8}},
  sauvage:   {v:0.1,  a:0.85, c:{tempo:.85,reg:.4, dens:.8, lum:.55,leg:.2, tens:.65,esp:.4}},
  sacré:     {v:0.3,  a:0.2,  c:{tempo:.2, reg:.4, dens:.3, lum:.45,leg:.95,tens:.2, esp:.95}}
};
const AFF_CUES=[["tempo","lent","vif"],["reg","grave","aigu"],["dens","rare","dense"],["lum","sombre","clair"],["leg","détaché","lié"],["tens","consonant","tendu"],["esp","proche","immense"]];
/* les indices d'un choix d'émotions : la moyenne, et sa traduction en mots pour ce qui s'écarte du milieu */
function affCues(sel){
  const c={}; AFF_CUES.forEach(([k])=>{ c[k]=sel.length?sel.reduce((t,e)=>t+((AFF_VA[e]||{c:{}}).c[k]===undefined?0.5:AFF_VA[e].c[k]),0)/sel.length:0.5; });
  c.v=sel.length?sel.reduce((t,e)=>t+(AFF_VA[e]?AFF_VA[e].v:0),0)/sel.length:0; c.a=sel.length?sel.reduce((t,e)=>t+(AFF_VA[e]?AFF_VA[e].a:0.5),0)/sel.length:0.5;
  return c;
}
const affCueWords=c=>AFF_CUES.filter(([k])=>Math.abs(c[k]-0.5)>=0.15).sort((x,y)=>Math.abs(c[y[0]]-0.5)-Math.abs(c[x[0]]-0.5)).slice(0,4).map(([k,lo,hi])=>c[k]<0.5?lo:hi);
/* clarté d'un mode, de 0 (sombre) à 1 (clair) : l'ordre mesuré par Temperley et Tan (2013) pour les modes diatoniques,
   ailleurs une estimation par la tierce, la sixte et la seconde (tierce majeure claire, seconde mineure sombre) */
const MODE_CLAIR={ionien:1, mixolydien:.8, lydien:.78, dorien:.55, eolien:.35, phrygien:.2, locrien:.05};
function modeClair(key){
  if(MODE_CLAIR[key]!==undefined) return MODE_CLAIR[key];
  const iv=ivOf(S,key), has=x=>iv.some(y=>Math.abs(y-x)<0.3);
  return Math.max(0,Math.min(1,0.45+(has(4)?0.25:0)-(has(3)&&!has(4)?0.1:0)+(has(9)?0.1:0)-(has(8)&&!has(9)?0.05:0)-(has(1)?0.15:0)-(has(6)?0.05:0)));
}
/* ce que dégage une couleur, et le poids de chaque affect :
   70 % la gamme (son caractère dans la tradition modale), 10 % la clarté du mode face à la valence de l'émotion,
   10 % le registre que donne la tonique face au registre de l'émotion, 10 % seulement le caractère traditionnel de la tonalité.
   La recherche ne retrouve presque pas ce dernier en tempérament égal (Powell et Dibben, 2005) : il reste une couleur, plus une règle. */
function affOf(key,root){
  const sc=AFF_SC[key]||["",{}], iv=ivOf(S,key), q=affQuality(iv), r=((root%12)+12)%12, ka=AFF_KEY[r][q], cl=modeClair(key), hi=r/11;
  return {scText:sc[0], keyText:ka[0], q, clair:cl, w:e=>{ const va=AFF_VA[e]; if(!va) return 0.7*(sc[1][e]||0)+0.1*(ka[1][e]||0);
    return 0.7*(sc[1][e]||0)+0.1*(1-Math.abs(cl-(va.v+1)/2))+0.1*(1-Math.abs(hi-va.c.reg))+0.1*(ka[1][e]||0); }};
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
  now.innerHTML="<strong>"+NOTES[S.root]+" "+nm+"</strong> : "+a.scText+". <span class=\"aff-k\">Tonalité de "+NOTES[S.root]+" ("+(a.q==="maj"?"plutôt majeure":"plutôt mineure")+") : "+a.keyText+".</span> <em>"+affTop(key,S.root,3).join(" · ")+"</em>"+
    (AFF.sel.size?' <span class="aff-k">Ce que demandent '+(AFF.sel.size>1?"ces émotions":"cette émotion")+" : "+(affCueWords(affCues([...AFF.sel])).join(", ")||"rien d'extrême")+".</span>":"");
}
function affApply(key,root){
  S.root=root; S.scales[0]=key; syncUI(); updateRingCap(); if(live) restartIfLive(0.8);
}
/* ---------- première page : un univers et ce qu'on cherche ----------
   L'univers donne l'instrumentation, l'espace et le rythme (un de ses préréglages sert de base) ; les affects choisissent la gamme et la tonalité,
   et règlent la tension. La meilleure proposition s'applique tout de suite, les autres sont à un clic. */
const AFF_MAQAM=["rast","bayati","saba","enharm"];
/* agitation de chaque affect (0 = calme, 1 = tendu) : l'éveil du cercle de Russell */
const AFF_AROUSAL=Object.fromEntries(Object.keys(AFF_VA).map(e=>[e,AFF_VA[e].a]));
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
    if(!best) best={it:items[0],s:0}; used.add(best.it[0]);
    /* la tonalité ne pèse plus guère : quand la tonique de l'ambiance de base fait presque aussi bien, on la garde (ses instruments sont réglés pour elle) */
    const br=baseOf(best.it).r, sr=score(sg.key,br), root=sr>=sg.score-0.03?br:sg.root;
    out.push({preset:best.it,key:sg.key,root,score:root===sg.root?sg.score:sr});
  });
  return out;
}
/* partir d'une proposition : la gamme et la tonalité choisies, puis les indices des émotions appliqués à l'ambiance de base.
   Chaque indice déplace le réglage de l'ambiance sans l'écraser, pour qu'elle garde son caractère (son instrumentation, sa mesure). */
function affStart(pr){
  const over=clone(pr.preset[1]); over.scales=[pr.key,"",""]; over.root=pr.root;
  const sel=[...AFF.sel];
  if(sel.length){ const c=affCues(sel), d=k=>c[k]-0.5, r2=v=>Math.round(v*100)/100, cl=(v,a,b)=>Math.max(a,Math.min(b,v));
    const base=x=>x===undefined?null:x, D=DEFAULT;
    /* tempo : l'indice le plus fort avec le mode ; de 20 % plus lent à 20 % plus vif */
    over.tempo=Math.round(cl((over.tempo||D.tempo)*(1+0.4*d("tempo")),40,180));
    over.mel=over.mel||{}; over.car=over.car||{}; over.fx=over.fx||{}; over.perc=over.perc||{};
    /* registre de la mélodie : grave, médium ou aigu */
    { const rg=base(over.mel.reg)===null?D.mel.reg:over.mel.reg; over.mel.reg=cl(Math.round(rg+2*d("reg")),0,2); }
    /* densité des notes et de la percussion : l'éveil */
    { const dn=base(over.mel.dens)===null?D.mel.dens:over.mel.dens; over.mel.dens=r2(cl(dn*(0.6+0.8*c.dens),0.05,1)); }
    if((over.perc.lvl===undefined?D.perc.lvl:over.perc.lvl)>0) over.perc.lvl=r2(cl((over.perc.lvl===undefined?D.perc.lvl:over.perc.lvl)*(0.5+c.a),0,1));
    /* lumière : le voile des aigus et l'ombre de la salle ; ±0,25 pour ne pas effacer le son d'une ambiance (les vieux claviers restent voilés) */
    { const vl=base(over.fx.veil)===null?D.fx.veil:over.fx.veil, dk=base(over.fx.dark)===null?D.fx.dark:over.fx.dark;
      over.fx.veil=r2(cl(vl-0.5*d("lum"),0,1)); over.fx.dark=r2(cl(dk-0.5*d("lum"),0,1)); }
    /* articulation : le lié resserre les souffles entre les notes, le détaché les ouvre */
    { const sl=base(over.car.sil)===null?D.car.sil:over.car.sil; over.car.sil=r2(cl(sl-0.5*d("leg"),0,1)); }
    /* espace : la réverbération */
    { const rv=base(over.fx.rev)===null?D.fx.rev:over.fx.rev; over.fx.rev=r2(cl(rv+0.3*d("esp"),0,1)); }
    /* tension : nervosité et dissonance, d'après l'indice de tension et l'éveil */
    over.tension=r2(cl(0.6*c.tens+0.4*c.a,0.1,0.9));
  }
  loadScene(over,null,undefined,{name:pr.preset[0],gloss:pr.preset[2],univ:seekUni()});
  const g=$("presetGloss"); if(g) g.textContent="";
  document.querySelectorAll("#presets .lnk").forEach(x=>x.removeAttribute("aria-current"));
  affUpdate();
}
function affResults(auto){
  const host=$("affRes"); if(!host) return; host.innerHTML="";
  const sel=[...AFF.sel];
  if(!sel.length){ host.appendChild(Object.assign(document.createElement("p"),{className:"hint",textContent:"Facultatif : une ou plusieurs émotions règlent la gamme, la tonalité et la tension. Sans choix, on part de la première ambiance de l'univers."})); return; }
  const res=affPropose(seekUni(),sel); AFF.props=res; const cw=affCueWords(affCues(sel));
  res.forEach((r,i)=>{
    const b=document.createElement("button"); b.type="button"; b.className="aff-opt";
    const nm=SC[r.key].n.replace(/\s*\(.*\)/,""), top=affTop(r.key,r.root,3);
    b.innerHTML='<span class="n">'+nm+" en "+NOTES[r.root]+'</span><span class="t">'+top.join(" · ")+'</span><span class="b">sur l\'ambiance '+r.preset[0]+(cw.length?" · "+cw.join(", "):"")+'</span><span class="s" aria-hidden="true"><i style="width:'+Math.round(Math.min(1,r.score)*100)+'%"></i></span>';
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
  h+='</tbody></table><table class="aff-table"><caption>Émotions : valence, éveil et indices (Gabrielsson et Lindström)</caption><thead><tr><th>Émotion</th><th>Valence · éveil</th><th>Ce qu\'elle demande</th></tr></thead><tbody>';
  EMOTIONS.forEach(e=>{ const va=AFF_VA[e]; if(!va) return; const c=Object.assign({},va.c); h+="<tr><th scope=\"row\">"+e+"</th><td>"+(va.v>=0?"+":"")+va.v.toFixed(2).replace(".",",")+" · "+va.a.toFixed(2).replace(".",",")+"</td><td>"+affCueWords(c).join(", ")+"</td></tr>"; });
  return h+"</tbody></table>";
}
