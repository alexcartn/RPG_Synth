"use strict";
/* ============================================================
   DONNÉES MUSICALES
   ============================================================ */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const NOTES = ["Do","Do#","Ré","Ré#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"];

const SCALE_GROUPS = [
  ["Modes diatoniques", [
    ["ionien","Ionien (majeur)",[0,2,4,5,7,9,11]],
    ["dorien","Dorien",[0,2,3,5,7,9,10]],
    ["phrygien","Phrygien",[0,1,3,5,7,8,10]],
    ["lydien","Lydien",[0,2,4,6,7,9,11]],
    ["mixolydien","Mixolydien",[0,2,4,5,7,9,10]],
    ["eolien","Éolien (mineur naturel)",[0,2,3,5,7,8,10]],
    ["locrien","Locrien",[0,1,3,5,6,8,10]]]],
  ["Couleurs et exotiques", [
    ["harm","Mineur harmonique",[0,2,3,5,7,8,11]],
    ["melo","Mineur mélodique",[0,2,3,5,7,9,11]],
    ["dorien4","Dorien #4 (roumain)",[0,2,3,6,7,9,10]],
    ["phrygdom","Phrygien dominant",[0,1,4,5,7,8,10]],
    ["lydidom","Lydien dominant",[0,2,4,6,7,9,10]],
    ["dblharm","Double harmonique (byzantin)",[0,1,4,5,7,8,11]],
    ["tzigane","Mineur tzigane",[0,2,3,6,7,8,11]]]],
  ["Pentatoniques", [
    ["pentmaj","Pentatonique majeure",[0,2,4,7,9]],
    ["pentmin","Pentatonique mineure",[0,3,5,7,10]],
    ["hirajoshi","Hirajoshi",[0,2,3,7,8]],
    ["insen","In sen",[0,1,5,7,10]]]],
  ["Médiéval", [
    ["hexacorde","Hexacorde de Guido",[0,2,4,5,7,9]],
    ["organum","Organum (quartes et quintes)",[0,2,5,7]]]],
  ["Symétriques", [
    ["tons","Tons entiers",[0,2,4,6,8,10]],
    ["octa","Octatonique (ton, demi-ton)",[0,2,3,5,6,8,9,11]]]],
  ["Quarts de ton (24 par octave)", [
    ["rast","Maqam Rast (tierce et septième neutres)",[0,2,3.5,5,7,9,10.5]],
    ["bayati","Maqam Bayati",[0,1.5,3,5,7,8,10]],
    ["saba","Maqam Saba",[0,1.5,3,4,7,8,10]],
    ["enharm","Enharmonique grec ancien",[0,0.5,1,5,7,7.5,8]],
    ["chromgr","Chromatique grec ancien",[0,1,2,5,7,8,9]]]],
  ["Personnel", [
    ["libre","Libre (dessinée sur le cercle)",null],
    ["scala","Gamme Scala importée",null]]]
];
const SC = {};
SCALE_GROUPS.forEach(([,l])=>l.forEach(([k,n,iv])=>{SC[k]={n,iv};}));
function ivOf(S,key){
  if(key==="scala"){ return (S.scala&&S.scala.slots&&S.scala.slots.length)?S.scala.slots:[0,2,4,5,7,9,11]; }
  if(key==="libre"){const a=[], q=S.custom.length>=24; S.custom.forEach((v,i)=>{if(v||i===0)a.push(q?i/2:i);});return a;}
  return (SC[key]||SC.mixolydien).iv;
}
function poolOf(iv,lo,hi){const a=[];for(let o=lo;o<=hi;o+=0.5){if(iv.indexOf(((o%12)+12)%12)>=0)a.push(o);}return a;}
function degOff(iv,k){const n=iv.length;return iv[((k%n)+n)%n]+12*Math.floor(k/n);}
function stableOf(iv){
  const s=[0]; if(iv.indexOf(7)>=0)s.push(7);
  if(iv.indexOf(4)>=0)s.push(4); else if(iv.indexOf(3)>=0)s.push(3);
  if(s.length<2){iv.forEach(x=>{if(s.indexOf(x)<0)s.push(x);});}
  return s;
}

const RAT = {
  egal: Array.from({length:12},(_,i)=>Math.pow(2,i/12)),
  juste:[1,16/15,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,9/5,15/8],
  pyth:[1,256/243,9/8,32/27,81/64,4/3,729/512,3/2,128/81,27/16,16/9,243/128],
  /* juste adaptatif : la gamme juste depuis la tonique (sous-tonique 16/9, quarte de la quarte, celle des progressions modales) ; le moteur réaccorde chaque accord sur sa fondamentale */
  adapt:[1,16/15,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,16/9,15/8],
  meso:[1,1.04490,1.11803,1.19628,1.25,1.33748,1.39754,1.49535,1.5625,1.67185,1.78885,1.86920]
};
/* tempéraments de clavier : écarts en cents depuis do ; comme sur un orgue accordé ainsi, chaque tonalité a sa couleur */
const WELL={
  werck:[0,90.225,192.18,294.135,390.225,498.045,588.27,696.09,792.18,888.27,996.09,1092.18],
  kirn:[0,90.225,193.157,294.135,386.314,498.045,590.224,696.578,792.18,889.735,996.09,1088.269]
};
/* accord turc d'Arel, Ezgi et Uzdilek : l'octave en 53 commas de Holder (22,64 cents) ; chaque hauteur de la grille à 24 quarts de ton
   prend sa place dans ce système (seconde du Bayati/Uşşak à 8 commas, tierce et septième du Rast à 17 et 48 commas…).
   Les mesures de la pratique arabe, elles, restent proches des 24 quarts de ton égaux (tierce du Rast vers 351 cents) : le tempérament égal les rend bien. */
const AEU={0:0,0.5:2,1:4,1.5:8,2:9,2.5:13,3:13,3.5:17,4:18,4.5:20,5:22,5.5:26,6:26,6.5:29,7:31,7.5:33,8:35,8.5:39,9:40,9.5:44,10:44,10.5:48,11:49,11.5:51};
/* gamme Scala : chaque degré a sa place symbolique sur la grille à 24 (pour la logique musicale) et sa vraie hauteur en cents (pour le son) */
function parseScala(text){
  const lines=String(text).split(/\r?\n/).filter(l=>!/^\s*!/.test(l)), desc=(lines[0]||"").trim(), n=parseInt(lines[1],10);
  if(!(n>0)) throw new Error("fichier Scala illisible : le nombre de notes manque");
  const vals=lines.slice(2).map(l=>l.trim().split(/\s+/)[0]).filter(Boolean).slice(0,n).map(v=>{
    if(v.indexOf(".")>=0) return parseFloat(v);
    const [a,b]=v.split("/"), q=parseFloat(a)/(b?parseFloat(b):1); if(!(q>0)) throw new Error("valeur illisible : "+v); return 1200*Math.log2(q); });
  if(vals.length<n||vals.some(x=>!isFinite(x))) throw new Error("fichier Scala incomplet");
  const per=vals[n-1], cents=[0].concat(vals.slice(0,n-1)).map(c=>((c%per)+per)%per).sort((a,b)=>a-b).filter((c,i,a)=>i===0||c-a[i-1]>0.5);
  /* places symboliques : la plus proche case libre de la grille à 24 */
  const used=new Set(), slots=[], map={};
  cents.forEach(c=>{ let q=Math.round(c/50)/2; const cand=[q,q+0.5,q-0.5,q+1,q-1].filter(x=>x>=0&&x<12&&!used.has(x)); if(!cand.length) return; const x=c===0?0:cand[0]; used.add(x); slots.push(x); map[x]=c; });
  if(slots.length<cents.length) throw new Error("trop de notes : 24 par octave au plus");
  return {name:desc||"Scala", slots:slots.sort((a,b)=>a-b), cents:map, period:per, n:cents.length, warn:Math.abs(per-1200)>0.5?"période de "+per.toFixed(1)+" cents, traitée comme une octave":""};
}
function mkFreq(S){
  const rootMidi=36+S.root, rootF=S.a4*Math.pow(2,(rootMidi-69)/12), r=RAT[S.temper]||RAT.egal, W=WELL[S.temper];
  /* turc (53 commas) et Scala : une table de cents depuis la tonique, sur la grille à 24 ; les cases absentes restent au tempérament égal */
  if(S.temper==="aeu"||(S.temper==="scala"&&S.scala&&S.scala.cents)){
    const tab=S.temper==="aeu"?Object.fromEntries(Object.entries(AEU).map(([k,v])=>[k,v*1200/53])):S.scala.cents;
    return off=>{ const oct=Math.floor(off/12), pc=Math.round((off-12*oct)*2)/2, c=tab[pc]!==undefined?tab[pc]:pc*100; return rootF*Math.pow(2,oct+c/1200); };
  }
  if(W){ const cents=x=>{ const a=S.root+x, o=Math.floor(a/12), p=a-12*o; return W[p]+1200*o-W[S.root]; };
    return off=>{ const lo=Math.floor(off), fr=off-lo; let c=cents(lo); if(fr>1e-9) c+=(cents(lo+1)-c)*fr; return rootF*Math.pow(2,c/1200); }; }
  return off=>{
    const oct=Math.floor(off/12), pc=off-12*oct, lo=Math.floor(pc), fr=pc-lo; let ratio=r[lo];
    if(fr>1e-9){ const hi=lo===11?2:r[lo+1]; ratio*=Math.pow(hi/ratio,fr); }
    return rootF*Math.pow(2,oct)*ratio;
  };
}

/* mesures : motif sur grille de croches. S frappe forte, s frappe, T tap, t petit tap, h croche libre (shaker) */
const METERS = {
  "4/4":{p:["S","h","T","h","s","h","T","h"], n:4, d:2},
  "6/8":{p:["S","h","t","s","h","t"], n:6, d:3},
  "3/4":{p:["S","h","T","h","T","h"], n:3, d:2},
  "2/4":{p:["S","h","T","h"], n:2, d:2},
  "7/8":{p:["S","h","T","h","s","h","t"], n:7, d:3},
  "5/8":{p:["S","h","T","h","t"], n:5, d:2},
  "12/8":{p:["S","h","h","t","h","h","s","h","h","t","h","h"], n:12, d:3}
};

/* ============================================================
   ÉTAT, PRÉRÉGLAGES
   ============================================================ */
const DEFAULT = {
  seed:1472, root:2, scales:["mixolydien","",""], custom:[1,0,1,0,1,1,0,1,0,1,1,0], sectionBars:16,
  temper:"egal", a4:440,
  tempo:120, meter:"4/4", swing:0.1, tension:0.5, vol:1, norm:0,
  perc:{lvl:0.5, shaker:0.55, ghost:0.35, kit:"cadre", eucl:0},
  drone:{lvl:0.8, timbre:"anche", bright:0.5, width:0.5, drift:0.5, glide:0.5, harm:0},
  mel:{lvl:0.6, inst:"luth", lpg:0, dens:0.85, reg:0, span:2, leap:0.2, orn:0.15, deja:0, loop:2},
  canon:{lvl:0, inst:"harpe", delay:2, shift:"oct+"},
  reso:{struct:0.3, bright:0.5, damp:0.4, pos:0.3},
  tint:{lvl:0, pos:"alt", inst:""},
  pad:{lvl:0.22, timbre:"cordes", len:2, motion:0.5, voices:3, deja:0, loop:2, stag:0.5, bass:0.5, bassOct:12},
  loops:{lvl:0, count:3, inst:"carillon", speed:1},
  arp:{lvl:0, inst:"harpe", pat:"vaetvient", rate:1, reg:1, span:1, mode:"motif", k:5, win:0},
  pend:{lvl:0, count:6, period:24, inst:"carillon"},
  nuee:{lvl:0, dens:0.4, vie:0.5, disp:0.5, grav:0.3, sources:2, haut:0.5, mat:"verre", harm:true},
  arbre:{lvl:0, inst:"verre", prof:4, vent:0.4, pousse:3, harm:true, lecture:"les deux"},
  bille:{lvl:0, count:3, haut:1, rebond:0.72, pause:1, travers:1, inst:"kalimba", mode:"clavier"},
  amb:{lvl:1, murmur:0.35, clink:0.5, feu:0.15, vent:0, gouttes:0, marque:0, marqueSon:"aucun", bruit:0, couleur:"rose"},
  fx:{voix:0, rev:0.4, size:2.6, dark:0.5, room:"gen", algo:"vivante", mod:0.5, shim:0, dly:0, dlyDiv:1.5, fb:0.4, sat:0.15, wow:0.12, veil:0.3, hiss:0},
  form:{shape:"constante", period:4, amount:0.5, breath:0.5},
  wx:{place:null, d:null, t:0},
  mach:true,
  daw:{sel:0, grid:1, rec:-1, arp:{on:false, mode:"up", rate:0.5, oct:2, gate:0.7}, mix:{mute:{}, solo:{}, pan:{}}, tracks:[]},
  syn:clone(SYN_DEFAULT),
  mus:{logic:"modal", model:"physique", form:"libre", color:"off", harm:"idiome", arc:"aucun", crit:0.6, mode:"veillee", tharm:0.6, cine:"off", cineAmt:0.3, expr:0.5},
  rc:0.5, tex:{lvl:1, sub:0, mid:0, air:0}, chant:"kyrie", plain:{lvl:0, reg:1, slow:1.5},
  car:{grav:0.5, aud:0.5, orn:0.5, sil:0.5, rep:0.5},
  chance:{skip:0.08, ratchet:0.07, mutate:0.12, octave:0.05, rest:0.08},
  turing:{lock:0.85, len:2, rate:1},
  drift:[{t:"filtre",t2:"-voile",d:0.3,v:0.3},{t:"densite",t2:"none",d:0.25,v:0.25},{t:"reverb",t2:"grain",d:0.25,v:0.2},{t:"pan",t2:"none",d:0.3,v:0.3}],
  grain:{mix:0, dens:0.45, size:0.5, spread:0.4, pitch:0.3, src:"mel"},
  link:{melPad:0.4},
  adapt:{mode:"off", amount:0.6, span:45},
  play:{lvl:0.8, inst:"", oct:24},
  nature:{pluie:0, mer:0, nuit:0, ruisseau:0, oiseaux:0, grenouilles:0, hibou:0, loup:0, corbeaux:0, chevaux:0, mouettes:0},
  curve:{mode:"off", dur:6, pts:Array.from({length:96},()=>0.5)}
};
const MEDIEVAL = [
  ["Taberna", {rc:0.7, mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.4, aud:0.55, orn:0.4, sil:0.25, rep:0.85}, seed:1213, root:2, scales:["dorien","mixolydien",""], tempo:92, meter:"3/4", swing:0, tension:0.45, sectionBars:16,
    drone:{lvl:0.12, timbre:"anche", bright:0.35}, pad:{lvl:0.35, timbre:"machine", len:2, motion:0.6, voices:3, bass:0.75, stag:0.2}, arp:{lvl:0.45, inst:"luth", pat:"vaetvient", rate:1, reg:1, span:1},
    mel:{lvl:0.55, inst:"flute", dens:0.6, reg:1, span:1, leap:0.15, orn:0.25, deja:0.75, loop:2}, canon:{lvl:0}, perc:{lvl:0.3, shaker:0.25, ghost:0.2},
    amb:{murmur:0.35, clink:0.35, feu:0.4}, fx:{algo:"salle", room:"salle", rev:0.4, size:3, dark:0.45, wow:0.08, hiss:0.04, veil:0.15, sat:0.06}}, "taverne au coin du feu : luth, flûte, foule"],
  ["Chorea", {rc:0.75, car:{grav:0.35, aud:0.65, orn:0.8, sil:0.15, rep:0.7}, mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, seed:218, root:4, scales:["dorien","",""], tempo:138, meter:"6/8", swing:0,
    perc:{lvl:0.5, shaker:0.5, ghost:0.35}, drone:{lvl:0.15}, mel:{inst:"flute", deja:0.4, loop:2, dens:0.9, leap:0.3, orn:0.3, reg:1, span:1},
    canon:{lvl:0}, pad:{lvl:0.3, timbre:"machine", len:2, voices:3, bass:0.75}, arp:{lvl:0.4, inst:"harpe", pat:"vaetvient", rate:1, reg:1, span:1}, amb:{murmur:0.3, clink:0.7, feu:0},
    fx:{rev:0.3, size:2.2, room:"salle", dly:0.18, dlyDiv:1.5, fb:0.35}}, "gigue, danse en rond"],
  ["Crypta", {rc:0.3, car:{grav:0.85, aud:0.2, orn:0.2, sil:0.8, rep:0.7}, mus:{form:"passacaille"}, seed:6660, root:2, scales:["dorien","eolien",""], tempo:52, meter:"4/4", swing:0, sectionBars:8,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"choeur", bright:0.3, width:0.7, drift:0.8, glide:0.7},
    mel:{inst:"carillon", dens:0.25, reg:1, span:2, orn:0.05}, canon:{lvl:0.25, inst:"carillon", delay:3, shift:"oct-"}, chant:"diesirae", plain:{lvl:0.65, reg:1, slow:1.5},
    pad:{lvl:0.4, timbre:"choeur", len:4, motion:0.7, voices:4}, amb:{murmur:0, clink:0, feu:0, vent:0.35, gouttes:0.6},
    fx:{rev:0.85, size:7, dark:0.7, room:"grotte", dly:0.25, dlyDiv:3, fb:0.5, sat:0.35, wow:0.3, veil:0.55, hiss:0.15},
    loops:{lvl:0.3, count:3, inst:"carillon", speed:1.2},
    form:{shape:"arche", period:5, amount:0.6}}, "crypte froide et humide"],
  ["Scriptorium", {rc:0.35, temper:"pyth", car:{grav:0.7, aud:0.25, orn:0.5, sil:0.6, rep:0.55}, mus:{form:"variations", arc:"arche"}, seed:1033, root:9, scales:["eolien","hexacorde",""], tempo:68, meter:"4/4", swing:0,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"orgue"},
    canon:{lvl:0.25, inst:"orgue", delay:2, shift:"q+"}, chant:"alleluia", plain:{lvl:0.5, reg:1, slow:1.5}, pad:{lvl:0.4, timbre:"orgue", len:4, motion:0.4, voices:3},
    amb:{murmur:0, clink:0, feu:0.35, vent:0, gouttes:0}, fx:{rev:0.65, size:4.5, dark:0.55, room:"chapelle", sat:0.2, wow:0.2, veil:0.45, hiss:0.1},
    mel:{inst:"flute", dens:0.4, reg:1, span:1, orn:0.1, deja:0.85, loop:3}, loops:{lvl:0.25, count:4, inst:"orgue", speed:1}}, "salle d'écriture des moines"],
  ["Turris", {rc:0.45, mus:{arc:"arche"}, car:{grav:0.5, aud:0.5, orn:0.5, sil:0.45, rep:0.45}, seed:77, root:1, scales:["dblharm","lydidom",""], tempo:60, meter:"7/8", swing:0, sectionBars:12,
    perc:{lvl:0.25, shaker:0.3, ghost:0.1}, drone:{lvl:0.35, timbre:"choeur", bright:0.45, width:0.6, drift:0.7, glide:0.6},
    mel:{inst:"harpe", dens:0.5, reg:1, span:2, leap:0.4, orn:0.2}, canon:{lvl:0.25, inst:"carillon", delay:2, shift:"q+"}, arp:{lvl:0.35, inst:"harpe", pat:"alberti", rate:1, reg:1, span:1},
    pad:{lvl:0.45, timbre:"machine", len:2, motion:0.8, voices:4}, amb:{murmur:0, clink:0, feu:0.1, vent:0.2, gouttes:0.15},
    fx:{rev:0.7, size:5, dark:0.45, dly:0.3, dlyDiv:1.5, fb:0.45, sat:0.25, wow:0.25, veil:0.4, hiss:0.08},
    pend:{lvl:0.3, count:7, period:20, inst:"harpe"},
    form:{shape:"vagues", period:4, amount:0.6}}, "tour du mage"],
  ["Tripudium", {rc:0.75, car:{grav:0.3, aud:0.7, orn:0.8, sil:0.1, rep:0.65}, mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, seed:905, root:7, scales:["hexacorde","ionien",""], tempo:104, meter:"3/4", swing:0.15,
    perc:{lvl:0.5, shaker:0.45, ghost:0.3}, drone:{lvl:0.15}, mel:{inst:"flute", dens:0.85, leap:0.15, orn:0.2, deja:0.4, loop:2},
    canon:{lvl:0}, pad:{lvl:0.3, timbre:"machine", len:2, voices:3, bass:0.75}, arp:{lvl:0.4, inst:"luth", pat:"alberti", rate:1, reg:1, span:1}, amb:{murmur:0.4, clink:0.6, feu:0.1},
    fx:{rev:0.35, size:2.4, sat:0.12, wow:0.1, veil:0.25}}, "branle, danse à trois temps"],
  /* danses notées du XIIIe et du XIVe siècle : l'estampie (puncta repris, fins ouverte et close) et la saltarelle (même architecture, rythme sautillant),
     jouées comme aujourd'hui : flûte ou vièle sur un bourdon de quinte, tambourin, un luth qui marque les temps */
  ["Estampida", {rc:0.8, car:{grav:0.45, aud:0.5, orn:0.45, sil:0.05, rep:0.9}, mus:{logic:"modal", harm:"idiome", form:"estampie", expr:0.6}, seed:1290, root:2, scales:["dorien","",""], tempo:112, meter:"3/4", swing:0, tension:0.5, sectionBars:16,
    drone:{lvl:0.35, timbre:"vielle", bright:0.4, glide:0.2}, mel:{lvl:0.6, inst:"vielle", dens:0.85, reg:1, span:1, leap:0.2, orn:0.3, deja:0, loop:2}, canon:{lvl:0}, pad:{lvl:0},
    arp:{lvl:0.3, inst:"luth", pat:"vaetvient", rate:1, reg:0, span:1}, perc:{lvl:0.45, kit:"cadre", shaker:0.35, ghost:0.25}, amb:{murmur:0.3, clink:0.3, feu:0.15},
    fx:{algo:"salle", room:"salle", rev:0.32, size:2.6, dark:0.45, wow:0.05, veil:0.25, sat:0.06}}, "estampie à la cour : vielle à roue, bourdons et chien, puncta repris, fin ouverte puis close"],
  ["Saltarellus", {rc:0.85, car:{grav:0.4, aud:0.6, orn:0.35, sil:0.05, rep:0.9}, mus:{logic:"modal", harm:"idiome", form:"saltarelle", expr:0.6}, seed:1390, root:2, scales:["dorien","mixolydien",""], tempo:120, meter:"6/8", swing:0, tension:0.6, sectionBars:16,
    drone:{lvl:0.35, timbre:"anche", bright:0.5, glide:0.15}, mel:{lvl:0.6, inst:"cornemuse", dens:0.9, reg:1, span:1, leap:0.3, orn:0.25, deja:0, loop:2}, canon:{lvl:0}, pad:{lvl:0},
    arp:{lvl:0}, perc:{lvl:0.55, kit:"cadre", shaker:0.5, ghost:0.3}, amb:{murmur:0.35, clink:0.35},
    fx:{algo:"salle", room:"salle", rev:0.3, size:2.4, dark:0.4, wow:0.05, veil:0.2, sat:0.08}}, "saltarelle : la danse sautillante, cornemuse et tambourin sur son bourdon"],
  ["Ars Nova", {rc:0.6, car:{grav:0.5, aud:0.4, orn:0.2, sil:0.2, rep:0.8}, mus:{logic:"modal", harm:"idiome", form:"isorythmie", expr:0.5}, seed:1360, root:2, scales:["dorien","",""], tempo:84, meter:"3/4", swing:0, tension:0.45, sectionBars:16, temper:"pyth",
    drone:{lvl:0.4, timbre:"orgue", bright:0.35, glide:0.2}, mel:{lvl:0.55, inst:"flute", dens:0.7, reg:1, span:1, leap:0.2, orn:0.1, deja:0, loop:2}, canon:{lvl:0.22, inst:"vielle", delay:2, shift:"q-"}, pad:{lvl:0},
    arp:{lvl:0}, perc:{lvl:0}, amb:{murmur:0, clink:0, feu:0},
    fx:{algo:"salle", room:"chapelle", rev:0.5, size:4, dark:0.5, veil:0.3, sat:0.04}}, "ars nova : une suite de hauteurs et une suite de durées qui se décalent, comme dans un motet de Machaut, sur un bourdon d'orgue"]
];

/* univers : des ambiances qui ne se limitent pas au Moyen Âge. Chaque entrée : [nom latin, réglages, glose française] */
const CALME = [
  ["Somnus", {car:{grav:0.8, aud:0.15, orn:0.2, sil:0.85, rep:0.8}, mus:{form:"ostinato"}, seed:4040, root:5, scales:["pentmaj","",""], sectionBars:32, tempo:40, temper:"juste", tension:0.3, vol:0.55,
    perc:{lvl:0}, drone:{lvl:0.5, timbre:"bol", bright:0.15, width:0.4, drift:0.6, glide:0.3},
    mel:{lvl:0.2, inst:"verre", dens:0.1, reg:1, span:2, leap:0.05, orn:0, deja:0.5, loop:2}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"vecteur", len:8, motion:0.2, voices:3}, amb:{murmur:0, clink:0, feu:0, vent:0.1, gouttes:0},
    fx:{rev:0.55, size:9, dark:0.8, room:"chapelle", dly:0, sat:0.03, wow:0.06, veil:0.8, hiss:0}, form:{shape:"arche", period:10, amount:0.3},
    loops:{lvl:0.1, count:3, inst:"bol", speed:1.6}, nature:{pluie:0.2}}, "sommeil, très lent et sombre"],
  ["Meditatio", {car:{grav:0.75, aud:0.2, orn:0.3, sil:0.8, rep:0.75}, mus:{form:"ostinato"}, seed:108, root:2, scales:["pentmin","pentmaj",""], sectionBars:24, tempo:50, temper:"juste", tension:0.35, vol:0.65,
    perc:{lvl:0}, drone:{lvl:0.55, timbre:"bol", bright:0.25, width:0.5, drift:0.5, glide:0.4},
    mel:{lvl:0.3, inst:"bol", dens:0.18, reg:1, span:1, leap:0.1, orn:0, deja:0.7, loop:3}, canon:{lvl:0.2, inst:"verre", delay:4, shift:"oct+"},
    pad:{lvl:0.28, timbre:"vecteur", len:6, motion:0.3, voices:3}, amb:{murmur:0, clink:0, feu:0, vent:0.08, gouttes:0},
    fx:{rev:0.5, size:7, dark:0.55, mod:0.6, sat:0.05, wow:0.08, veil:0.55, hiss:0}, grain:{mix:0.25, dens:0.3, size:0.7, spread:0.6, pitch:0.15}, link:{melPad:0.55}, form:{shape:"vagues", period:8, amount:0.4},
    loops:{lvl:0.25, count:4, inst:"bol", speed:1.3}}, "méditation, bols et nappes de verre"],
  ["Labor", {car:{grav:0.55, aud:0.4, orn:0.3, sil:0.5, rep:0.7}, mus:{form:"ostinato"}, seed:2020, root:9, scales:["dorien","",""], sectionBars:32, tempo:68, tension:0.35,
    perc:{lvl:0}, drone:{lvl:0.55, timbre:"orgue", bright:0.3, width:0.3, drift:0.3, glide:0.2},
    mel:{lvl:0.3, inst:"kalimba", lpg:0.6, dens:0.35, reg:1, span:2, leap:0.1, orn:0, deja:0.92, loop:3}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"synthe", len:4, motion:0.3, voices:3, deja:0.8, loop:4}, amb:{murmur:0.18, clink:0, feu:0, vent:0, gouttes:0},
    fx:{rev:0.5, size:3.5, dark:0.5, sat:0.05, wow:0.05, veil:0.4, hiss:0}, form:{shape:"constante"}}, "travail et concentration, motifs répétitifs"],
  ["Lacrimae", {car:{grav:0.8, aud:0.1, orn:0, sil:0.7, rep:0.6}, mus:{form:"libre", expr:0.6}, seed:1976, root:9, scales:["eolien","",""], sectionBars:24, tempo:52, temper:"adapt", tension:0.35,
    perc:{lvl:0}, drone:{lvl:0.3, timbre:"pur", bright:0.2, width:0.3, drift:0.3, glide:0.4},
    mel:{lvl:0.45, inst:"archet", dens:0.3, reg:1, span:1, leap:0.05, orn:0, deja:0.5, loop:3}, tint:{lvl:0.7, pos:"alt", inst:"harpe"}, canon:{lvl:0},
    pad:{lvl:0.12, timbre:"cordes", len:8, motion:0.2, voices:3}, amb:{murmur:0, clink:0, feu:0, vent:0, gouttes:0},
    fx:{rev:0.6, size:8, dark:0.55, room:"chapelle", veil:0.35, hiss:0}}, "tintinnabuli : un archet lent, et la harpe qui ne joue que les notes de l'accord, comme chez Arvo Pärt"]
];
const ESPACE = [
  ["Sidera", {car:{grav:0.6, aud:0.35, orn:0.35, sil:0.7, rep:0.5}, seed:8888, root:0, scales:["lydien","tons",""], sectionBars:24, tempo:44, temper:"juste", tension:0.4, vol:0.6,
    perc:{lvl:0}, drone:{lvl:0.5, timbre:"bol", bright:0.5, width:0.7, drift:0.8, glide:0.6},
    mel:{lvl:0.3, inst:"verre", dens:0.14, reg:2, span:2, leap:0.3, orn:0, deja:0.4, loop:3}, canon:{lvl:0.25, inst:"fmcloche", delay:3, shift:"q+"},
    pad:{lvl:0.38, timbre:"vecteur", len:8, motion:0.6, voices:4}, amb:{vent:0.1},
    fx:{rev:0.6, size:9, dark:0.4, room:"plaque", algo:"plaque", mod:0.7, shim:0.4, dly:0.25, dlyDiv:3, fb:0.6, sat:0.04, wow:0.05, veil:0.3, hiss:0.05}, form:{shape:"arche", period:10, amount:0.5},
    loops:{lvl:0.35, count:5, inst:"verre", speed:1.4}, pend:{lvl:0.25, count:8, period:36, inst:"verre"}}, "étoiles, cloches de verre et échos"],
  ["Nebula", {car:{grav:0.55, aud:0.3, orn:0.4, sil:0.7, rep:0.5}, seed:5150, root:3, scales:["tons","octa",""], sectionBars:16, tempo:50, tension:0.45, vol:0.7,
    perc:{lvl:0}, drone:{lvl:0.6, timbre:"choeur", bright:0.35, width:0.8, drift:0.9, glide:0.8},
    mel:{lvl:0.25, inst:"synthe", dens:0.2, reg:1, span:3, leap:0.35, orn:0, deja:0.3, loop:4}, canon:{lvl:0.2, inst:"voix", delay:4, shift:"oct+"},
    pad:{lvl:0.4, timbre:"essaim", len:6, motion:0.85, voices:4}, amb:{vent:0.25},
    fx:{rev:0.6, size:8, dark:0.6, mod:0.8, shim:0.2, dly:0.3, dlyDiv:2, fb:0.5, sat:0.15, wow:0.2, veil:0.5, hiss:0.1}, grain:{mix:0.45, dens:0.55, size:0.6, spread:0.7, pitch:0.4, src:"tout"}, form:{shape:"vagues", period:6, amount:0.6},
    loops:{lvl:0.2, count:3, inst:"synthe", speed:1.2}}, "nébuleuse, nappes de synthé qui dérivent"],
  ["Abyssus", {car:{grav:0.85, aud:0.2, orn:0.15, sil:0.85, rep:0.7}, mus:{form:"passacaille"}, seed:666, root:7, scales:["locrien","phrygien",""], sectionBars:24, tempo:40, tension:0.55, vol:0.7,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"pur", bright:0.1, width:0.5, drift:0.7, glide:0.5},
    mel:{lvl:0.22, inst:"carillon", dens:0.08, reg:0, span:2, leap:0.2, orn:0, deja:0.2, loop:2}, canon:{lvl:0},
    pad:{lvl:0.35, timbre:"machine", len:8, motion:0.4, voices:4}, amb:{vent:0.45, gouttes:0.25},
    fx:{rev:0.65, size:9, dark:0.88, sat:0.3, wow:0.3, veil:0.85, hiss:0.15}, form:{shape:"constante"},
    loops:{lvl:0.18, count:3, inst:"bol", speed:1.8}}, "gouffre, grave et sombre"]
];
const ORIENT = [
  ["Aegyptus", {car:{grav:0.5, aud:0.45, orn:0.75, sil:0.4, rep:0.6}, mus:{form:"variations", arc:"arche"}, seed:1301, root:2, scales:["phrygdom","dblharm",""], sectionBars:12, tempo:84, temper:"juste",
    perc:{lvl:0.38, shaker:0.5, ghost:0.3}, drone:{lvl:0.75, timbre:"anche", bright:0.5, width:0.6, drift:0.5, glide:0.55},
    mel:{lvl:0.6, inst:"oud", dens:0.55, reg:1, span:2, leap:0.25, orn:0.4, deja:0.5, loop:3}, canon:{lvl:0.3, inst:"ney", delay:2, shift:"oct+"},
    pad:{lvl:0.25, timbre:"cordes", len:4, motion:0.4, voices:3}, amb:{vent:0.1, feu:0.05},
    fx:{rev:0.5, size:3.5, dark:0.5, sat:0.15, wow:0.12, veil:0.3}, form:{shape:"arche", period:5, amount:0.4}}, "Égypte, oud, ney et tambour"],
  ["Eremus", {car:{grav:0.6, aud:0.4, orn:0.6, sil:0.6, rep:0.5}, seed:3300, root:9, scales:["phrygdom","dblharm","phrygien"], sectionBars:12, tempo:56, temper:"juste",
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"anche", bright:0.45, width:0.7, drift:0.7, glide:0.6},
    mel:{lvl:0.5, inst:"ney", dens:0.3, reg:1, span:2, leap:0.3, orn:0.35, deja:0.4, loop:3}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"choeur", len:6, motion:0.4, voices:3}, amb:{vent:0.55},
    fx:{rev:0.65, size:5, dark:0.55, sat:0.2, wow:0.2, veil:0.45, hiss:0.12}, form:{shape:"vagues", period:7, amount:0.5}}, "désert, vent et flûte ney"],
  ["Hortus", {car:{grav:0.5, aud:0.45, orn:0.6, sil:0.5, rep:0.55}, seed:7007, root:7, scales:["hirajoshi","insen",""], sectionBars:16, tempo:56,
    perc:{lvl:0}, drone:{lvl:0.45, timbre:"pur", bright:0.3},
    mel:{lvl:0.55, inst:"harpe", lpg:0.4, dens:0.28, reg:1, span:2, leap:0.3, orn:0.1, deja:0.6, loop:3}, canon:{lvl:0.25, inst:"kalimba", delay:3, shift:"q+"},
    pad:{lvl:0.28, timbre:"verre", len:4, motion:0.4, voices:3}, amb:{gouttes:0.45, vent:0.12},
    fx:{rev:0.6, size:4, dark:0.4, sat:0.05, wow:0.08, veil:0.3}, form:{shape:"constante"},
    loops:{lvl:0.18, count:3, inst:"bol", speed:1.3}}, "jardin zen, gammes japonaises"],
  ["Bayati", {car:{grav:0.55, aud:0.45, orn:0.85, sil:0.4, rep:0.55}, mus:{form:"variations"}, seed:2828, root:2, scales:["bayati","saba",""], sectionBars:12, tempo:68, temper:"egal",
    perc:{lvl:0.3, shaker:0.4, ghost:0.2}, drone:{lvl:0.7, timbre:"anche", bright:0.45, width:0.5, drift:0.5, glide:0.4},
    mel:{lvl:0.6, inst:"oud", dens:0.5, reg:1, span:2, leap:0.2, orn:0.45, deja:0.6, loop:3}, canon:{lvl:0.3, inst:"ney", delay:2, shift:"oct+"},
    pad:{lvl:0.22, timbre:"cordes", len:4, motion:0.3, voices:3}, amb:{vent:0.05},
    fx:{rev:0.5, size:3.5, dark:0.5, sat:0.12, wow:0.1, veil:0.3}, form:{shape:"arche", period:5, amount:0.4}}, "maqam Bayati, avec ses quarts de ton"],
  ["Enharmonia", {car:{grav:0.5, aud:0.45, orn:0.8, sil:0.5, rep:0.5}, seed:4242, root:4, scales:["enharm","",""], sectionBars:16, tempo:60, temper:"juste", vol:0.7,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"orgue", bright:0.3, width:0.4, drift:0.4, glide:0.3},
    mel:{lvl:0.5, inst:"harpe", dens:0.3, reg:1, span:2, leap:0.2, orn:0.1, deja:0.6, loop:3}, canon:{lvl:0.25, inst:"flute", delay:3, shift:"q+"},
    pad:{lvl:0.3, timbre:"orgue", len:6, motion:0.3, voices:3}, amb:{},
    fx:{rev:0.6, size:5, dark:0.5, sat:0.08, wow:0.12, veil:0.4}, form:{shape:"constante"}}, "genre enharmonique grec, quarts de ton"]
];
const NATURE = [
  ["Pluvia", {car:{grav:0.7, aud:0.25, orn:0.35, sil:0.75, rep:0.6}, seed:4711, root:2, scales:["eolien","",""], sectionBars:24, tempo:50, tension:0.35, vol:0.85,
    perc:{lvl:0}, drone:{lvl:0.3, timbre:"bol", bright:0.2, width:0.4, drift:0.5, glide:0.3},
    mel:{lvl:0.18, inst:"fmpiano", dens:0.12, reg:1, span:2, leap:0.1, orn:0, deja:0.6, loop:3}, canon:{lvl:0},
    pad:{lvl:0.22, timbre:"verre", len:8, motion:0.3, voices:3}, amb:{vent:0.1},
    fx:{rev:0.55, size:4, dark:0.5, sat:0.04, wow:0.06, veil:0.45}, form:{shape:"constante"}, nature:{pluie:0.7}}, "pluie, avec un peu de musique"],
  ["Mare", {car:{grav:0.65, aud:0.25, orn:0.3, sil:0.7, rep:0.65}, seed:1313, root:7, scales:["pentmaj","",""], sectionBars:24, tempo:46, tension:0.3, vol:0.85,
    perc:{lvl:0}, drone:{lvl:0.35, timbre:"pur", bright:0.2},
    mel:{lvl:0.15, inst:"harpe", dens:0.1, reg:1, span:2, leap:0.1, orn:0, deja:0.5, loop:3}, canon:{lvl:0},
    pad:{lvl:0.28, timbre:"synthe", len:8, motion:0.3, voices:3}, amb:{vent:0.15},
    fx:{rev:0.5, size:5, dark:0.5, sat:0.03, wow:0.05, veil:0.5}, form:{shape:"arche", period:10, amount:0.3}, nature:{mer:0.75}}, "mer et vagues"],
  ["Silva", {car:{grav:0.5, aud:0.45, orn:0.55, sil:0.55, rep:0.5}, seed:909, root:4, scales:["dorien","",""], sectionBars:24, tempo:56, tension:0.4, vol:0.9,
    perc:{lvl:0}, drone:{lvl:0.3, timbre:"orgue", bright:0.3},
    mel:{lvl:0.25, inst:"flute", dens:0.15, reg:1, span:2, leap:0.2, orn:0.2, deja:0.5, loop:3}, canon:{lvl:0},
    pad:{lvl:0.2, timbre:"choeur", len:6, motion:0.3, voices:3}, amb:{vent:0.2},
    fx:{rev:0.5, size:3.5, dark:0.45, sat:0.04, wow:0.08, veil:0.35}, form:{shape:"constante"}, nature:{oiseaux:0.6, ruisseau:0.45}}, "forêt : oiseaux et ruisseau"],
  ["Nox", {car:{grav:0.75, aud:0.2, orn:0.25, sil:0.8, rep:0.65}, seed:303, root:9, scales:["eolien","",""], sectionBars:24, tempo:44, tension:0.3, vol:0.85,
    perc:{lvl:0}, drone:{lvl:0.4, timbre:"bol", bright:0.2},
    mel:{lvl:0.15, inst:"carillon", dens:0.1, reg:2, span:2, leap:0.2, orn:0, deja:0.4, loop:3}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"choeur", len:8, motion:0.3, voices:3}, amb:{feu:0.25, vent:0.12},
    fx:{rev:0.6, size:6, dark:0.6, sat:0.05, wow:0.1, veil:0.5}, form:{shape:"constante"}, nature:{nuit:0.6}}, "nuit, grillons et feu"]
];
/* patchs de synthé perso propres à certaines ambiances : la voix qui les distingue vraiment des autres (utilisés avec l'instrument « Synthé perso ») */
const SYN_P={
  acide:{oscA:{wave:0.67,uni:3,spread:22,lvl:0.8}, oscB:{wave:1,oct:-1,lvl:0.45,uni:1,det:0}, sub:{lvl:0.3,shape:"square"}, fil:{type:"lowpass",cut:650,res:6.5,key:0.8,env:5600}, envA:{a:0.003,d:0.2,s:0.3,r:0.1}, envF:{a:0.002,d:0.18,s:0.08,r:0.1},
    mod:[{src:"lfo1",dst:"cutoff",amt:0.3},{src:"vel",dst:"cutoff",amt:0.5},{src:"none",dst:"amp",amt:0},{src:"none",dst:"pitch",amt:0}], lfo1:{shape:"triangle",rate:0.22}, fx:{drive:0.5,level:0.7}},
  verre:{oscA:{wave:0,uni:1,spread:0,lvl:0.85}, oscB:{lvl:0}, fm:{amt:0.85,ratio:5}, fil:{type:"lowpass",cut:9500,res:0.4,key:0.2,env:0}, envA:{a:0.002,d:1.5,s:0,r:1.2}, envF:{a:0.01,d:0.5,s:1,r:0.5}, env2:{a:0.002,d:0.5,s:0,r:0.4},
    mod:[{src:"env2",dst:"fm",amt:0.7},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}], fx:{drive:0,level:0.9}},
  souffle:{oscA:{lvl:0,uni:1}, noise:{lvl:1}, fil:{type:"bandpass",cut:720,res:6,key:0.9,env:1400}, fx:{drive:0,level:3.4}, envA:{a:1.3,d:1,s:0.8,r:2}, envF:{a:1.6,d:1.5,s:0.3,r:2},
    mod:[{src:"lfo1",dst:"cutoff",amt:0.45},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}], lfo1:{shape:"sine",rate:0.12}}
};
const AVENTURE = [
  ["Pugna", {car:{grav:0.7, aud:0.8, orn:0.3, sil:0.05, rep:0.8}, mus:{form:"ostinato"}, seed:4401, root:4, scales:["phrygien","phrygdom",""], tempo:150, meter:"4/4", swing:0, tension:0.8,
    perc:{lvl:0.9, shaker:0.3, ghost:0.5}, drone:{lvl:0.8, timbre:"orgue", bright:0.55}, mel:{lvl:0.55, inst:"cuivre", dens:0.9, leap:0.35, orn:0.1},
    canon:{lvl:0.3, inst:"cuivre", delay:2, shift:"q+"}, pad:{lvl:0.3, timbre:"cordes", len:2, motion:0.6}, amb:{}, fx:{rev:0.3, size:2, algo:"salle", sat:0.3, wow:0.08}}, "combat : percussion, cuivres, phrygien"],
  ["Iter", {car:{grav:0.3, aud:0.6, orn:0.4, sil:0.3, rep:0.5}, mus:{form:"variations", arc:"arche"}, seed:512, root:7, scales:["mixolydien","ionien",""], tempo:96, meter:"4/4", swing:0.05,
    perc:{lvl:0.45, shaker:0.5, ghost:0.2}, drone:{lvl:0.6, timbre:"anche"}, mel:{lvl:0.6, inst:"flute", dens:0.65, orn:0.25},
    canon:{lvl:0.25, inst:"harpe", delay:3, shift:"oct+"}, pad:{lvl:0.2, timbre:"cordes"}, amb:{vent:0.15}, fx:{rev:0.4, size:3}}, "voyage : on marche, le pays s'ouvre"],
  ["Triumphus", {temper:"kirn", car:{grav:0.2, aud:0.7, orn:0.5, sil:0.15, rep:0.5}, mus:{form:"rondeau", arc:"arche"}, seed:1900, root:0, scales:["ionien","lydien",""], tempo:112, meter:"4/4", tension:0.35,
    perc:{lvl:0.6, shaker:0.3, ghost:0.2}, drone:{lvl:0.65, timbre:"orgue", bright:0.6}, mel:{lvl:0.65, inst:"cuivre", dens:0.7, leap:0.3},
    canon:{lvl:0.3, inst:"flute", delay:2, shift:"oct+"}, pad:{lvl:0.3, timbre:"orgue", len:2}, amb:{murmur:0.2}, fx:{rev:0.5, size:4, room:"salle", algo:"salle"}}, "victoire : fanfare et orgue"],
  ["Insidiae", {car:{grav:0.6, aud:0.3, orn:0.2, sil:0.7, rep:0.5}, seed:3131, root:6, scales:["dorien4","octa",""], tempo:70, meter:"4/4", tension:0.65,
    perc:{lvl:0.2, shaker:0.1, ghost:0.6}, drone:{lvl:0.7, timbre:"pur", bright:0.3}, mel:{lvl:0.3, inst:"carillon", dens:0.22, leap:0.4, deja:0.3},
    canon:{lvl:0}, pad:{lvl:0.3, timbre:"choeur", motion:0.5}, amb:{vent:0.2, gouttes:0.1}, fx:{rev:0.5, size:4, dark:0.7, veil:0.5}}, "embuscade, infiltration : on retient son souffle"]
];
const PIRATES = [
  ["Portus", {car:{grav:0.3, aud:0.7, orn:0.6, sil:0.15, rep:0.7}, mus:{form:"rondeau", arc:"arche"}, seed:1717, root:2, scales:["mixolydien","dorien",""], tempo:132, meter:"6/8", swing:0,
    perc:{lvl:0.65, shaker:0.6, ghost:0.35}, drone:{lvl:0.1, timbre:"choeur"}, mel:{lvl:0.7, inst:"accordeon", dens:0.95, orn:0.35},
    canon:{lvl:0.3, inst:"archet", delay:2, shift:"oct+"}, pad:{lvl:0.15, timbre:"grattee", len:2}, amb:{murmur:0.55, clink:0.6, feu:0.1}, fx:{rev:0.28, size:2.4, room:"salle", wow:0.18}}, "taverne de port : chant de marins, rhum, chopes"],
  ["Navigium", {rc:0.4, car:{grav:0.45, aud:0.45, orn:0.4, sil:0.45, rep:0.6}, mus:{form:"variations", arc:"arche"}, seed:6006, root:9, scales:["dorien","eolien",""], tempo:66, meter:"12/8", swing:0,
    perc:{lvl:0.3, shaker:0.4, ghost:0.2}, drone:{lvl:0.35, timbre:"choeur", drift:0.7}, mel:{lvl:0.55, inst:"archet", dens:0.5, span:2, orn:0.2},
    canon:{lvl:0.25, inst:"flute", delay:4, shift:"oct+"}, pad:{lvl:0.3, timbre:"choeur", len:4}, amb:{vent:0.25}, fx:{rev:0.5, size:4}, nature:{mer:0.6}}, "en mer : houle, vent dans les voiles, violon"],
  ["Tempestas", {car:{grav:0.75, aud:0.65, orn:0.3, sil:0.1, rep:0.6}, seed:8080, root:4, scales:["phrygien","dorien",""], tempo:118, meter:"6/8", swing:0, tension:0.85,
    perc:{lvl:0.8, shaker:0.2, ghost:0.4, kit:"taiko"}, drone:{lvl:0.7, timbre:"pur", bright:0.5}, mel:{lvl:0.55, inst:"cuivre", dens:0.7, leap:0.4},
    canon:{lvl:0}, pad:{lvl:0.4, timbre:"cordes", len:2, motion:0.8}, amb:{vent:0.5}, fx:{rev:0.5, size:5, sat:0.3, wow:0.2}, nature:{mer:0.8, pluie:0.6}}, "tempête : pluie, mer déchaînée, cuivres"],
  ["Thesaurus", {car:{grav:0.4, aud:0.4, orn:0.5, sil:0.55, rep:0.5}, seed:2323, root:7, scales:["lydien","pentmaj",""], tempo:76, meter:"3/4", tension:0.4,
    perc:{lvl:0}, drone:{lvl:0.45, timbre:"pur", bright:0.4}, mel:{lvl:0.55, inst:"kalimba", lpg:0.4, dens:0.4, orn:0.2},
    canon:{lvl:0.25, inst:"harpe", delay:3, shift:"q+"}, pad:{lvl:0.28, timbre:"verre"}, amb:{vent:0.08}, fx:{rev:0.55, size:4}, nature:{mer:0.35, oiseaux:0.4}}, "île au trésor : plage, mystère, oiseaux"]
];
const NORDIQUE = [
  ["Skalda", {car:{grav:0.6, aud:0.4, orn:0.35, sil:0.5, rep:0.7}, mus:{form:"ostinato"}, seed:7120, root:2, scales:["dorien","pentmin",""], temper:"pyth", tempo:72, meter:"4/4", swing:0,
    perc:{lvl:0.35, shaker:0, ghost:0.15, kit:"cadre"}, drone:{lvl:0.85, timbre:"choeur", bright:0.3}, mel:{lvl:0.5, inst:"archet", dens:0.3, reg:0, orn:0.15},
    canon:{lvl:0.2, inst:"flute", delay:4, shift:"oct+"}, pad:{lvl:0.28, timbre:"machine", len:4}, amb:{feu:0.5, murmur:0.25}, fx:{rev:0.45, size:3.5, room:"salle", dark:0.6}}, "veillée au feu : bourdon de chœur, violon"],
  ["Bellum", {car:{grav:0.85, aud:0.7, orn:0.2, sil:0.1, rep:0.8}, mus:{form:"passacaille"}, seed:9000, root:9, scales:["eolien","phrygien",""], tempo:100, meter:"4/4", swing:0, tension:0.8,
    perc:{lvl:1, shaker:0, ghost:0.2}, drone:{lvl:0.9, timbre:"choeur", bright:0.4}, mel:{lvl:0.5, inst:"cuivre", dens:0.5, leap:0.25},
    canon:{lvl:0.3, inst:"cuivre", delay:2, shift:"q-"}, pad:{lvl:0.4, timbre:"choeur", len:2}, amb:{vent:0.2}, fx:{rev:0.4, size:3, sat:0.3, dark:0.6}}, "bataille : tambours de guerre, chant grave"],
  ["Fjordus", {car:{grav:0.65, aud:0.25, orn:0.25, sil:0.75, rep:0.6}, seed:4900, root:4, scales:["pentmin","eolien",""], tempo:48, meter:"4/4", tension:0.4,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"choeur", bright:0.25, drift:0.7}, mel:{lvl:0.4, inst:"flute", dens:0.15, reg:1, leap:0.3},
    canon:{lvl:0.22, inst:"voix", delay:4, shift:"oct-"}, pad:{lvl:0.35, timbre:"verre", len:8}, amb:{vent:0.5}, fx:{rev:0.65, size:7, dark:0.6, veil:0.5}, nature:{mer:0.3}}, "fjord dans la brume : vent, eau, flûte lointaine"],
  ["Runae", {car:{grav:0.7, aud:0.35, orn:0.2, sil:0.6, rep:0.8}, mus:{form:"ostinato"}, seed:1313, root:7, scales:["organum","pentmin",""], temper:"pyth", tempo:56, meter:"4/4", tension:0.5,
    perc:{lvl:0.3, shaker:0, ghost:0.1, kit:"cadre"}, drone:{lvl:0.65, timbre:"choeur", bright:0.25}, mel:{lvl:0.4, inst:"harpe", dens:0.2, reg:0, deja:0.5},
    canon:{lvl:0}, pad:{lvl:0.3, timbre:"choeur", len:6}, amb:{feu:0.2, vent:0.2}, fx:{rev:0.6, size:5, dark:0.6}, grain:{mix:0.3, dens:0.3, size:0.7, spread:0.6, pitch:0.2}}, "rituel runique : tambour sur cadre, lyre, voix sourdes"]
];
const FEERIE = [
  ["Fata", {car:{grav:0.2, aud:0.45, orn:0.65, sil:0.4, rep:0.4}, seed:3003, root:0, scales:["lydien","pentmaj",""], tempo:84, meter:"3/4", tension:0.35,
    perc:{lvl:0}, drone:{lvl:0.4, timbre:"pur", bright:0.5}, mel:{lvl:0.6, inst:"atelier", dens:0.7, reg:2, orn:0.3}, syn:SYN_P.verre,
    canon:{lvl:0.3, inst:"harpe", delay:3, shift:"oct+"}, pad:{lvl:0.3, timbre:"verre", motion:0.6}, amb:{}, fx:{rev:0.6, size:4.5, shim:0.5, mod:0.7}, nature:{oiseaux:0.5, ruisseau:0.3}}, "clairière des fées : harpe, verre, oiseaux"],
  ["Aula Fatarum", {car:{grav:0.2, aud:0.65, orn:0.7, sil:0.2, rep:0.6}, mus:{form:"rondeau", arc:"arche"}, seed:7700, root:7, scales:["ionien","lydien",""], tempo:96, meter:"3/4", swing:0.1, tension:0.35,
    perc:{lvl:0.25, shaker:0.5, ghost:0.2}, drone:{lvl:0.45, timbre:"orgue"}, mel:{lvl:0.65, inst:"flute", dens:0.85, orn:0.35},
    canon:{lvl:0.3, inst:"harpe", delay:2, shift:"oct+"}, pad:{lvl:0.25, timbre:"cordes"}, amb:{murmur:0.1}, fx:{rev:0.4, size:3}, loops:{lvl:0.2, count:3, inst:"carillon", speed:1.3}}, "bal des fées : valse, flûte et carillons"],
  ["Sylva Magica", {car:{grav:0.4, aud:0.35, orn:0.5, sil:0.6, rep:0.4}, seed:4242, root:4, scales:["lydidom","tons",""], tempo:54, meter:"4/4", tension:0.45,
    perc:{lvl:0}, drone:{lvl:0.5, timbre:"choeur", bright:0.4, drift:0.7}, mel:{lvl:0.4, inst:"carillon", dens:0.2, leap:0.35, reg:1},
    canon:{lvl:0.22, inst:"voix", delay:3, shift:"q+"}, pad:{lvl:0.35, timbre:"choeur", motion:0.7}, amb:{}, fx:{rev:0.6, size:5, shim:0.2, mod:0.6}, grain:{mix:0.3, dens:0.4, size:0.6, spread:0.7, pitch:0.3}, nature:{nuit:0.4, ruisseau:0.3}}, "forêt enchantée : nuit, ruisseau, grains de lumière"],
  ["Lullaby", {car:{grav:0.3, aud:0.2, orn:0.2, sil:0.7, rep:0.8}, mus:{form:"ostinato"}, seed:606, root:5, scales:["pentmaj","ionien",""], tempo:58, meter:"3/4", tension:0.25, vol:0.7,
    perc:{lvl:0}, drone:{lvl:0.35, timbre:"bol", bright:0.2}, mel:{lvl:0.4, inst:"kalimba", lpg:0.5, dens:0.35, deja:0.8, loop:2},
    canon:{lvl:0.28, inst:"voix", delay:2, shift:"uni"}, pad:{lvl:0.3, timbre:"synthe", len:6}, amb:{}, fx:{rev:0.5, size:4, dark:0.6}}, "berceuse : kalimba, voix douce, nappes"]
];
const HORREUR = [
  ["Larva", {car:{grav:0.9, aud:0.15, orn:0.1, sil:0.85, rep:0.3}, seed:1313, root:1, scales:["locrien","phrygien",""], tempo:48, meter:"4/4", tension:0.7,
    perc:{lvl:0}, drone:{lvl:0.8, timbre:"pur", bright:0.15, drift:0.8}, mel:{lvl:0.25, inst:"carillon", dens:0.08, leap:0.5, reg:2, deja:0.1},
    canon:{lvl:0.22, inst:"voix", delay:3, shift:"oct+"}, pad:{lvl:0.45, timbre:"atelier", len:8, motion:0.7}, syn:SYN_P.souffle, amb:{vent:0.3, gouttes:0.35}, fx:{rev:0.7, size:9, dark:0.85, sat:0.3, wow:0.45, veil:0.8, hiss:0.25}, grain:{mix:0.3, dens:0.3, size:0.8, spread:0.7, pitch:0.7}}, "fantôme : un carillon et une voix dans le vide"],
  ["Domus Obscura", {temper:"werck", car:{grav:0.8, aud:0.25, orn:0.3, sil:0.7, rep:0.6}, mus:{form:"passacaille"}, seed:666, root:6, scales:["dorien4","eolien",""], tempo:54, meter:"3/4", tension:0.6,
    perc:{lvl:0}, drone:{lvl:0.75, timbre:"orgue", bright:0.2}, mel:{lvl:0.4, inst:"orgue", dens:0.2, leap:0.25},
    canon:{lvl:0.2, inst:"orgue", delay:3, shift:"t+"}, pad:{lvl:0.3, timbre:"orgue", len:6}, amb:{vent:0.25}, fx:{rev:0.65, size:6, room:"chapelle", dark:0.75, veil:0.6}, nature:{nuit:0.3, pluie:0.3}}, "manoir hanté : orgue lointain, pluie à la fenêtre"],
  ["Sacrificium", {car:{grav:0.85, aud:0.5, orn:0.15, sil:0.5, rep:0.8}, mus:{form:"ostinato"}, seed:2013, root:2, scales:["phrygien","dblharm",""], tempo:64, meter:"4/4", tension:0.7,
    perc:{lvl:0.5, shaker:0, ghost:0.1}, drone:{lvl:0.85, timbre:"choeur", bright:0.3}, mel:{lvl:0.4, inst:"archet", dens:0.3, leap:0.35, orn:0.1},
    canon:{lvl:0.25, inst:"archet", delay:3, shift:"t+"}, chant:"agnus", plain:{lvl:0.5, reg:1, slow:1.5}, pad:{lvl:0.35, timbre:"choeur", len:4}, amb:{feu:0.15}, fx:{rev:0.6, size:6, dark:0.8, sat:0.2, veil:0.6}}, "rituel : tambour lent, archet, chœur sourd"],
  ["Cella", {car:{grav:0.8, aud:0.2, orn:0.15, sil:0.8, rep:0.5}, seed:99, root:4, scales:["phrygien","locrien",""], tempo:40, meter:"4/4", tension:0.55,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"bol", bright:0.15}, mel:{lvl:0.2, inst:"bol", dens:0.06, reg:0, deja:0.2},
    canon:{lvl:0}, pad:{lvl:0.3, timbre:"machine", len:8}, amb:{gouttes:0.6, vent:0.15}, fx:{rev:0.7, size:8, room:"grotte", dark:0.85, veil:0.7, hiss:0.1}}, "cachot humide : gouttes, écho de pierre"]
];
const CYBER = [
  ["Urbs Neon", {car:{grav:0.5, aud:0.6, orn:0.2, sil:0.3, rep:0.9}, mus:{form:"ostinato"}, seed:2077, root:5, scales:["eolien","dorien",""], tempo:100, meter:"4/4", swing:0, tension:0.6,
    turing:{lock:0.95, len:2}, chance:{skip:0.1, ratchet:0.22, mutate:0.05, octave:0.1, rest:0.06},
    perc:{lvl:0.65, shaker:0.8, ghost:0.5}, drone:{lvl:0.8, timbre:"pur", bright:0.7, width:0.9, drift:0.2, glide:0.1},
    mel:{lvl:0.55, inst:"atelier", dens:0.8, leap:0.3, orn:0, deja:0.9, loop:2}, canon:{lvl:0.45, inst:"basse", delay:2, shift:"oct-"},
    pad:{lvl:0.4, timbre:"phase", len:4, motion:0.9, voices:4}, amb:{}, syn:SYN_P.acide,
    fx:{rev:0.4, size:3, room:"plaque", algo:"plaque", shim:0.15, dly:0.35, dlyDiv:1.5, fb:0.55, sat:0.4, wow:0, veil:0.1, hiss:0}, nature:{pluie:0.4}}, "ville sous la pluie : néons, synthés, basse"],
  ["Machina", {car:{grav:0.6, aud:0.9, orn:0.1, sil:0.05, rep:1}, mus:{form:"ostinato"}, seed:404, root:0, scales:["octa","phrygien",""], tempo:126, meter:"4/4", swing:0, tension:0.78,
    turing:{lock:0.97, len:2}, chance:{skip:0.12, ratchet:0.35, mutate:0.04, octave:0.15, rest:0.05},
    perc:{lvl:0.9, shaker:0.9, ghost:0.4}, drone:{lvl:0.95, timbre:"pur", bright:0.75, width:0.6, drift:0.1, glide:0},
    mel:{lvl:0.5, inst:"atelier", dens:1, leap:0.45, orn:0, deja:0.92, loop:2}, canon:{lvl:0},
    pad:{lvl:0.2, timbre:"essaim", len:2, motion:1, voices:3}, amb:{}, syn:SYN_P.acide,
    loops:{lvl:0.4, count:5, inst:"basse", speed:2}, grain:{mix:0.2, dens:0.6, size:0.3, spread:0.5, pitch:0.5, src:"tout"},
    fx:{rev:0.2, size:1.6, room:"plaque", algo:"plaque", dly:0.4, dlyDiv:1.5, fb:0.55, sat:0.55, wow:0, veil:0, hiss:0}}, "usine, intelligence artificielle : boucles mécaniques"],
  ["Datum", {car:{grav:0.5, aud:0.3, orn:0.1, sil:0.55, rep:0.7}, mus:{form:"ostinato"}, seed:1010, root:6, scales:["dorien4","dorien",""], tempo:84, meter:"4/4", swing:0, tension:0.55,
    turing:{lock:0.9, len:2}, chance:{ratchet:0.15, skip:0.2},
    perc:{lvl:0.3, shaker:0.6, ghost:0.7}, drone:{lvl:0.55, timbre:"pur", bright:0.6, drift:0.2}, mel:{lvl:0.5, inst:"atelier", dens:0.45, leap:0.4, deja:0.8, loop:2},
    canon:{lvl:0.3, inst:"atelier", delay:3, shift:"q+"}, pad:{lvl:0.3, timbre:"phase", motion:0.7}, amb:{}, syn:SYN_P.verre,
    fx:{rev:0.45, size:3, room:"plaque", algo:"plaque", dly:0.45, dlyDiv:1.5, fb:0.6, sat:0.1, wow:0, hiss:0}, grain:{mix:0.3, dens:0.5, size:0.3, spread:0.6, pitch:0.4, src:"tout"}}, "infiltration : serveurs, données, tension froide"],
  ["Imber Toxicus", {car:{grav:0.75, aud:0.2, orn:0.1, sil:0.8, rep:0.6}, seed:3030, root:2, scales:["phrygien","locrien",""], tempo:56, meter:"4/4", tension:0.6,
    perc:{lvl:0}, drone:{lvl:0.85, timbre:"pur", bright:0.45, width:1, drift:0.5}, mel:{lvl:0.3, inst:"fmcloche", dens:0.1, reg:1, leap:0.3},
    canon:{lvl:0}, pad:{lvl:0.45, timbre:"roues", len:8, motion:0.8}, amb:{}, syn:SYN_P.souffle,
    fx:{rev:0.65, size:7, dark:0.7, sat:0.35, wow:0.3, veil:0.6, hiss:0.15, mod:0.7}, nature:{pluie:0.65}}, "pluie acide sur la mégalopole : nappes lourdes"]
];
const DUNGEON = [
  ["Montagne", {mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.5, aud:0.45, orn:0.3, sil:0.35, rep:0.85}, seed:2024, root:9, scales:["eolien","dorien",""], tempo:76, meter:"4/4", swing:0, tension:0.4, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.55, timbre:"machine", len:2, motion:0.6, voices:4, bass:0.85, bassOct:0, stag:0.2}, arp:{lvl:0.42, inst:"harpe", pat:"vaetvient", rate:1, reg:1, span:1},
    mel:{lvl:0.55, inst:"flute", dens:0.55, reg:1, span:1, leap:0.15, orn:0.2, deja:0.75, loop:2}, canon:{lvl:0}, perc:{lvl:0.08, shaker:0, ghost:0},
    fx:{algo:"salle", rev:0.45, size:4.5, dark:0.45, wow:0.04, hiss:0.01, veil:0.5, sat:0.08}}, "royaume des montagnes : cordes, harpe, flûte, timbales lointaines"],
  ["Custos", {mus:{logic:"modal", harm:"idiome", form:"passacaille", arc:"arche"}, car:{grav:0.75, aud:0.5, orn:0.2, sil:0.3, rep:0.85}, seed:3141, root:2, scales:["harm","eolien",""], tempo:66, meter:"4/4", swing:0, tension:0.6, sectionBars:16,
    drone:{lvl:0.15, timbre:"choeur", bright:0.3}, pad:{lvl:0.5, timbre:"choeur", len:2, motion:0.5, voices:4, bass:0.9, bassOct:0, stag:0.15}, arp:{lvl:0.38, inst:"harpe", pat:"alberti", rate:1, reg:0, span:1},
    mel:{lvl:0.55, inst:"cuivre", dens:0.35, reg:1, span:1, leap:0.2, orn:0.1, deja:0.7, loop:2}, canon:{lvl:0}, perc:{lvl:0.12, shaker:0, ghost:0.1}, amb:{vent:0.15},
    fx:{algo:"salle", rev:0.5, size:6, dark:0.55, wow:0.04, hiss:0.01, veil:0.55, sat:0.1}}, "le dernier gardien : chœur, cor, harpe grave, timbales"],
  ["Hiems", {mus:{logic:"modal", harm:"idiome", form:"rondeau"}, car:{grav:0.6, aud:0.35, orn:0.25, sil:0.5, rep:0.85}, seed:1902, root:4, scales:["dorien","eolien",""], tempo:62, meter:"3/4", swing:0, tension:0.35, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.5, timbre:"vecteur", len:2, motion:0.5, voices:3, bass:0.8, bassOct:0}, arp:{lvl:0.35, inst:"carillon", lpg:0.3, pat:"montant", rate:1, reg:2, span:1},
    mel:{lvl:0.5, inst:"flute", dens:0.35, reg:1, span:1, leap:0.15, orn:0.15, deja:0.75, loop:2}, canon:{lvl:0}, perc:{lvl:0}, amb:{vent:0.45},
    fx:{algo:"salle", rev:0.55, size:7, dark:0.5, wow:0.04, hiss:0.01, veil:0.5, sat:0.06}}, "hiver sur la forteresse : neige, clochettes, flûte"],
  ["Castellum", {mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.4, aud:0.65, orn:0.3, sil:0.2, rep:0.85}, seed:1415, root:7, scales:["mixolydien","ionien",""], tempo:84, meter:"4/4", swing:0, tension:0.55, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.45, timbre:"orgue", len:2, motion:0.6, voices:4, bass:0.85, bassOct:0}, arp:{lvl:0.38, inst:"harpe", pat:"montant", rate:1, reg:1, span:1},
    mel:{lvl:0.6, inst:"cuivre", dens:0.5, reg:1, span:1, leap:0.3, orn:0.1, deja:0.75, loop:2}, canon:{lvl:0.25, inst:"flute", delay:2, shift:"oct+"}, perc:{lvl:0.15, kit:"caisse", shaker:0.2, ghost:0.2},
    fx:{algo:"salle", rev:0.42, size:5, dark:0.4, wow:0.03, hiss:0.01, veil:0.4, sat:0.08}}, "le château : orgue, cor, harpe, tambour de garde"],
  ["Silva Antiqua", {mus:{logic:"modal", harm:"idiome", form:"rondeau"}, car:{grav:0.4, aud:0.45, orn:0.35, sil:0.35, rep:0.8}, seed:808, root:0, scales:["dorien","mixolydien",""], tempo:72, meter:"3/4", swing:0, tension:0.35, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.45, timbre:"cordes", len:2, motion:0.5, voices:3, bass:0.8, bassOct:0}, arp:{lvl:0.45, inst:"luth", pat:"vaetvient", rate:1, reg:1, span:1},
    mel:{lvl:0.5, inst:"flute", dens:0.55, reg:1, span:1, leap:0.15, orn:0.25, deja:0.75, loop:2}, canon:{lvl:0}, perc:{lvl:0}, amb:{vent:0.15}, nature:{oiseaux:0.25, ruisseau:0.2},
    fx:{algo:"salle", rev:0.5, size:4, dark:0.45, wow:0.04, hiss:0.01, veil:0.45, sat:0.06}}, "vieille forêt : luth, flûte, cordes, oiseaux"],
  /* vieux dungeon synth des claviers des années 90 : son net mais filtré vers 3 kHz, pas de bande, une vraie basse sous le bourdon, mineur, des fondus */
  ["Vigilia", {mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.55, aud:0.4, orn:0.25, sil:0.25, rep:0.85}, seed:1993, root:9, scales:["eolien","dorien",""], tempo:72, meter:"4/4", swing:0, tension:0.45, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.5, timbre:"machine", len:1, motion:0.6, voices:3, bass:0.95, bassOct:0, stag:0.1}, arp:{lvl:0.4, inst:"harpe", lpg:0.4, pat:"vaetvient", rate:2, reg:1, span:1},
    mel:{lvl:0.55, inst:"flute", dens:0.65, reg:1, span:1, leap:0.15, orn:0.2, deja:0.8, loop:2}, canon:{lvl:0}, perc:{lvl:0},
    fx:{algo:"salle", rev:0.3, size:3, dark:0.65, wow:0.02, hiss:0, veil:0.95, sat:0.04}}, "la veille sur le rempart : vieux clavier, flûte, harpe en doubles croches, basse ronde"],
  ["Regnum Umbrae", {mus:{logic:"modal", harm:"idiome", form:"passacaille", arc:"arche"}, car:{grav:0.7, aud:0.45, orn:0.2, sil:0.2, rep:0.85}, seed:1997, root:6, scales:["harm","eolien",""], tempo:80, meter:"4/4", swing:0, tension:0.55, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.5, timbre:"orgue", len:1, motion:0.55, voices:3, bass:1, bassOct:0, stag:0.1}, arp:{lvl:0.38, inst:"harpe", lpg:0.4, pat:"alberti", rate:2, reg:0, span:1},
    mel:{lvl:0.55, inst:"cuivre", dens:0.6, reg:1, span:1, leap:0.2, orn:0.15, deja:0.8, loop:2}, canon:{lvl:0.2, inst:"flute", delay:2, shift:"oct+"}, perc:{lvl:0.05, shaker:0, ghost:0},
    fx:{algo:"salle", rev:0.32, size:3.5, dark:0.7, wow:0.02, hiss:0, veil:0.97, sat:0.05}}, "le royaume des ombres : orgue, cor, mineur harmonique, basse qui marche"],
  ["Iter Montium", {mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.45, aud:0.5, orn:0.3, sil:0.3, rep:0.8}, seed:1996, root:2, scales:["dorien","eolien",""], tempo:68, meter:"3/4", swing:0, tension:0.4, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.5, timbre:"cordes", len:1, motion:0.6, voices:3, bass:0.95, bassOct:0, stag:0.15}, arp:{lvl:0.42, inst:"luth", lpg:0.45, pat:"montant", rate:2, reg:1, span:1},
    mel:{lvl:0.55, inst:"flute", dens:0.6, reg:1, span:1, leap:0.2, orn:0.25, deja:0.8, loop:2}, canon:{lvl:0}, perc:{lvl:0}, amb:{vent:0.08},
    fx:{algo:"salle", rev:0.32, size:3.5, dark:0.65, wow:0.02, hiss:0, veil:0.95, sat:0.04}}, "le col des montagnes : cordes, luth égrené, flûte, à trois temps"],
  /* les écoles du genre (Whiteman, Dark Dungeon Music, 2024 ; Werdna, Newsome) : une ambiance par école plutôt qu'un seul album */
  /* années 90 sombres, nées du black metal norvégien et de la musique cosmique allemande : nappes de chœur tenues, timbales lentes, mineur harmonique, long et immense */
  ["Spiritus Antiquus", {mus:{logic:"modal", harm:"idiome", form:"passacaille", arc:"arche"}, car:{grav:0.7, aud:0.35, orn:0.15, sil:0.3, rep:0.9}, seed:1994, root:4, scales:["harm","eolien",""], tempo:60, meter:"4/4", swing:0, tension:0.55, sectionBars:24,
    drone:{lvl:0.25, timbre:"choeur", bright:0.25, drift:0.6}, pad:{lvl:0.55, timbre:"choeur", len:4, motion:0.4, voices:4, bass:0.9, bassOct:0, stag:0.3}, arp:{lvl:0.25, inst:"orgue", lpg:0, pat:"montant", rate:1, reg:0, span:1},
    mel:{lvl:0.5, inst:"cuivre", dens:0.3, reg:1, span:1, leap:0.15, orn:0.1, deja:0.85, loop:2}, canon:{lvl:0}, perc:{lvl:0.22, kit:"taiko", shaker:0, ghost:0.05}, amb:{vent:0.12},
    fx:{algo:"salle", room:"chapelle", rev:0.6, size:8, dark:0.65, wow:0.05, hiss:0.03, veil:0.85, sat:0.1}}, "l'esprit des années 90 : chœurs tenus, timbales lentes, cor dans la brume"],
  /* la marche épique : un motif court qui revient sans fin, cor et chœurs, caisse claire de marche, comme une armée qui descend d'un col */
  ["Agmen Umbrarum", {mus:{logic:"modal", harm:"idiome", form:"ostinato", arc:"arche"}, car:{grav:0.6, aud:0.45, orn:0.15, sil:0.2, rep:0.95}, seed:1995, root:9, scales:["eolien","dorien",""], tempo:70, meter:"4/4", swing:0, tension:0.6, sectionBars:16,
    drone:{lvl:0.12, timbre:"choeur", bright:0.3}, pad:{lvl:0.5, timbre:"cordes", len:2, motion:0.5, voices:4, bass:0.95, bassOct:0, stag:0.15}, arp:{lvl:0.3, inst:"harpe", lpg:0.35, pat:"alberti", rate:1, reg:0, span:1},
    mel:{lvl:0.55, inst:"cuivre", dens:0.45, reg:1, span:1, leap:0.2, orn:0.1, deja:0.9, loop:2}, canon:{lvl:0.28, inst:"flute", delay:2, shift:"oct+"}, perc:{lvl:0.32, kit:"caisse", shaker:0, ghost:0.15},
    fx:{algo:"salle", rev:0.45, size:6, dark:0.55, wow:0.02, hiss:0.01, veil:0.75, sat:0.08}}, "la marche des ombres : cor, chœurs, caisse de marche, un motif qui revient sans fin"],
  /* la tour caverneuse : presque immobile, un orgue qui tient, une note de temps en temps, la grotte et le souffle de la cassette */
  ["Turris Vetus", {mus:{logic:"modal", harm:"idiome", form:"libre"}, car:{grav:0.8, aud:0.25, orn:0.05, sil:0.8, rep:0.7}, seed:2013, root:2, scales:["eolien","phrygien",""], tempo:44, meter:"4/4", swing:0, tension:0.5, sectionBars:16,
    drone:{lvl:0.5, timbre:"orgue", bright:0.25, drift:0.7}, pad:{lvl:0.45, timbre:"orgue", len:8, motion:0.3, voices:3, bass:0.7, bassOct:0, stag:0.4}, arp:{lvl:0},
    mel:{lvl:0.4, inst:"flute", dens:0.12, reg:0, span:1, leap:0.1, orn:0.05, deja:0.5, loop:2}, canon:{lvl:0}, perc:{lvl:0}, tex:{lvl:1, sub:0.4, mid:0.25, air:0}, amb:{vent:0.2, gouttes:0.15},
    fx:{algo:"vivante", room:"grotte", rev:0.7, size:9, dark:0.7, wow:0.06, hiss:0.05, veil:0.85, sat:0.06}}, "la vieille tour : un orgue qui tient dans la pierre, une flûte de loin en loin, le souffle de la bande"],
  /* le fief chaleureux : modes clairs, luth et flûte qui dansent doucement, le feu, une salle de bois */
  ["Feudum", {mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.45, aud:0.45, orn:0.4, sil:0.25, rep:0.85}, seed:2016, root:7, scales:["ionien","mixolydien",""], tempo:88, meter:"3/4", swing:0, tension:0.35, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.45, timbre:"machine", len:2, motion:0.6, voices:3, bass:0.85, bassOct:0, stag:0.15}, arp:{lvl:0.42, inst:"luth", lpg:0.3, pat:"vaetvient", rate:1, reg:1, span:1},
    mel:{lvl:0.55, inst:"flute", dens:0.6, reg:1, span:1, leap:0.15, orn:0.35, deja:0.8, loop:2}, canon:{lvl:0.2, inst:"harpe", delay:2, shift:"oct+"}, perc:{lvl:0.12, kit:"cadre", shaker:0.1, ghost:0.1}, amb:{feu:0.15}, nature:{oiseaux:0.08},
    fx:{algo:"salle", room:"salle", rev:0.38, size:3, dark:0.35, wow:0.03, hiss:0.02, veil:0.45, sat:0.05}}, "le fief en paix : luth, flûte, le feu dans la grande salle"],
  /* comfy synth : naïf et chaleureux, boîte à musique et clavier jouet, une petite maison sous la colline */
  ["Cuniculus", {mus:{logic:"modal", harm:"idiome", form:"rondeau"}, car:{grav:0.5, aud:0.35, orn:0.25, sil:0.3, rep:0.9}, seed:2019, root:5, scales:["pentmaj","ionien",""], tempo:96, meter:"4/4", swing:0.05, tension:0.2, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.4, timbre:"synthe", len:2, motion:0.5, voices:3, bass:0.7, bassOct:0, stag:0.1}, arp:{lvl:0.35, inst:"kalimba", lpg:0.25, pat:"montant", rate:2, reg:1, span:1},
    mel:{lvl:0.5, inst:"fmcloche", dens:0.55, reg:2, span:1, leap:0.15, orn:0.2, deja:0.85, loop:2}, canon:{lvl:0}, perc:{lvl:0.08, kit:"cadre", shaker:0.2, ghost:0}, nature:{grenouilles:0.08, nuit:0.1},
    fx:{algo:"salle", rev:0.3, size:2.2, dark:0.3, wow:0.07, hiss:0.02, veil:0.4, sat:0.05}}, "le terrier sous la colline : boîte à musique, kalimba, grillons, tout est doux"],
  /* la nostalgie des vieux jeux de rôle et des jeux vidéo des années 80 : synthé doux, cloches FM, nappe vectorielle */
  ["Memoria", {mus:{logic:"modal", harm:"idiome", form:"rondeau", arc:"arche"}, car:{grav:0.5, aud:0.5, orn:0.2, sil:0.3, rep:0.85}, seed:1988, root:2, scales:["dorien","eolien",""], tempo:84, meter:"4/4", swing:0, tension:0.4, sectionBars:16,
    drone:{lvl:0}, pad:{lvl:0.45, timbre:"vecteur", len:2, motion:0.6, voices:3, bass:0.9, bassOct:0, stag:0.1}, arp:{lvl:0.4, inst:"fmpiano", lpg:0.3, pat:"vaetvient", rate:2, reg:1, span:1},
    mel:{lvl:0.55, inst:"synthe", dens:0.55, reg:1, span:1, leap:0.2, orn:0.15, deja:0.8, loop:2}, canon:{lvl:0.18, inst:"fmcloche", delay:2, shift:"oct+"}, perc:{lvl:0.1, kit:"taiko", shaker:0, ghost:0},
    fx:{algo:"salle", rev:0.4, size:3.5, dark:0.45, wow:0.03, hiss:0.01, veil:0.6, sat:0.06}}, "souvenir d'une vieille aventure : synthé doux, piano électrique, cloches FM"],
  /* winter synth : la neige qui scintille, clochettes en cascade, chœur lointain, une immense salle claire */
  ["Nix Aeterna", {mus:{logic:"modal", harm:"idiome", form:"libre"}, car:{grav:0.6, aud:0.3, orn:0.2, sil:0.5, rep:0.75}, seed:2021, root:11, scales:["pentmin","dorien",""], tempo:58, meter:"3/4", swing:0, tension:0.3, sectionBars:16,
    drone:{lvl:0.15, timbre:"pur", bright:0.3}, pad:{lvl:0.45, timbre:"choeur", len:4, motion:0.4, voices:3, bass:0.6, bassOct:0, stag:0.3}, arp:{lvl:0.32, inst:"carillon", lpg:0.2, pat:"montant", rate:2, reg:2, span:1},
    mel:{lvl:0.45, inst:"flute", dens:0.3, reg:1, span:1, leap:0.15, orn:0.15, deja:0.7, loop:2}, canon:{lvl:0}, perc:{lvl:0}, amb:{vent:0.35},
    fx:{algo:"salle", rev:0.6, size:7, dark:0.35, wow:0.02, hiss:0.01, veil:0.45, sat:0.04, shim:0.25}}, "la neige éternelle : clochettes qui scintillent, chœur lointain, le vent"]
];
const ANTIQUE = [
  ["Agora", {car:{grav:0.4, aud:0.5, orn:0.5, sil:0.35, rep:0.6}, seed:4801, root:4, scales:["phrygien","chromgr",""], tempo:84, meter:"4/4", swing:0, tension:0.4,
    drone:{lvl:0.3, timbre:"aulos", bright:0.35}, mel:{lvl:0.6, inst:"lyre", dens:0.55, reg:1, span:2, leap:0.2, orn:0.25}, canon:{lvl:0.25, inst:"syrinx", delay:2, shift:"oct+"},
    pad:{lvl:0}, perc:{lvl:0.25, shaker:0.3, ghost:0.2}, amb:{murmur:0.45, clink:0.15, feu:0}, fx:{rev:0.25, size:2, sat:0.05}}, "l'agora : la lyre, la foule, l'après-midi"],
  ["Delphi", {car:{grav:0.75, aud:0.3, orn:0.4, sil:0.6, rep:0.6}, seed:1290, root:4, scales:["enharm","phrygien",""], tempo:50, meter:"4/4", swing:0, tension:0.55, sectionBars:12,
    drone:{lvl:0.7, timbre:"aulos", bright:0.3, drift:0.6}, mel:{lvl:0.45, inst:"aulos", dens:0.2, reg:0, span:1, leap:0.15, orn:0.35}, canon:{lvl:0}, chant:"paian", plain:{lvl:0.5, reg:1, slow:1.2},
    pad:{lvl:0.35, timbre:"choeur", len:6, motion:0.3}, perc:{lvl:0}, amb:{murmur:0, clink:0, feu:0.3, vent:0.25}, fx:{algo:"salle", rev:0.6, size:6, dark:0.6, veil:0.3, sat:0.05}}, "Delphes : l'oracle, l'aulos, la fumée, un chœur grave"],
  ["Sparta", {mus:{form:"ostinato"}, car:{grav:0.7, aud:0.75, orn:0.25, sil:0.15, rep:0.85}, seed:480, root:2, scales:["phrygien","dorien",""], tempo:120, meter:"5/8", swing:0, tension:0.75,
    drone:{lvl:0.55, timbre:"aulos", bright:0.45}, mel:{lvl:0.6, inst:"aulos", dens:0.8, reg:1, span:1, leap:0.2, orn:0.2, deja:0.7, loop:2}, canon:{lvl:0},
    pad:{lvl:0.25, timbre:"choeur", len:2, voices:3}, perc:{lvl:0.7, shaker:0.3, ghost:0.3}, amb:{vent:0.15}, fx:{rev:0.25, size:2.5, sat:0.12}}, "Sparte : la phalange en marche, l'aulos, le péan à cinq temps"],
  ["Thermopylae", {mus:{arc:"arche"}, car:{grav:0.8, aud:0.35, orn:0.15, sil:0.6, rep:0.6}, seed:4800, root:9, scales:["chromgr","phrygien",""], tempo:56, meter:"4/4", swing:0, tension:0.7,
    drone:{lvl:0.5, timbre:"aulos", bright:0.25, drift:0.6}, mel:{lvl:0.45, inst:"lyre", dens:0.2, reg:0, span:1, leap:0.2}, canon:{lvl:0},
    pad:{lvl:0.2, timbre:"choeur", len:4}, perc:{lvl:0.35, shaker:0, ghost:0.1}, amb:{vent:0.4}, nature:{mer:0.3}, fx:{rev:0.4, size:4, dark:0.55, sat:0.08}}, "les Thermopyles : l'attente avant la bataille"],
  ["Roma Triumphans", {mus:{form:"rondeau", arc:"arche"}, car:{grav:0.45, aud:0.8, orn:0.2, sil:0.15, rep:0.8}, seed:753, root:7, scales:["mixolydien","ionien",""], tempo:96, meter:"4/4", swing:0, tension:0.6,
    drone:{lvl:0.2, timbre:"orgue"}, mel:{lvl:0.6, inst:"cornu", dens:0.6, reg:1, span:1, leap:0.35, deja:0.7, loop:2}, canon:{lvl:0.3, inst:"hydraulis", delay:2, shift:"oct-"},
    pad:{lvl:0.3, timbre:"orgue", len:2, voices:3, bass:0.7}, perc:{lvl:0.6, kit:"caisse", shaker:0.3, ghost:0.3}, amb:{murmur:0.6, clink:0}, fx:{algo:"salle", rev:0.35, size:3.5, sat:0.1}}, "le triomphe à Rome : cornu, hydraulis, tambours, la foule"],
  ["Odyssea", {car:{grav:0.5, aud:0.45, orn:0.35, sil:0.4, rep:0.6}, seed:800, root:2, scales:["phrygien","eolien",""], tempo:66, meter:"2/4", swing:0, tension:0.45,
    drone:{lvl:0.3, timbre:"aulos", bright:0.3, drift:0.6}, mel:{lvl:0.55, inst:"lyre", dens:0.45, reg:1, span:2, leap:0.2, orn:0.2}, canon:{lvl:0.3, inst:"syrinx", delay:2, shift:"oct+"},
    pad:{lvl:0.2, timbre:"choeur", len:4}, perc:{lvl:0.25, shaker:0.2, ghost:0.15}, amb:{vent:0.3}, nature:{mer:0.6}, fx:{rev:0.4, size:4, dark:0.45, sat:0.05}}, "l'Odyssée : la mer, la lyre, la syrinx, le rythme de l'hexamètre"],
  ["Hades", {car:{grav:0.9, aud:0.2, orn:0.2, sil:0.8, rep:0.6}, seed:666, root:1, scales:["enharm","chromgr",""], tempo:44, meter:"4/4", swing:0, tension:0.7, sectionBars:12,
    drone:{lvl:0.8, timbre:"choeur", bright:0.2, drift:0.8}, mel:{lvl:0.35, inst:"voix", dens:0.12, reg:0, span:1, leap:0.2}, canon:{lvl:0.2, inst:"syrinx", delay:3, shift:"oct+"},
    pad:{lvl:0.3, timbre:"machine", len:8, motion:0.3}, loops:{lvl:0.15, count:3, inst:"carillon", speed:1.3}, perc:{lvl:0}, amb:{vent:0.2, gouttes:0.4},
    fx:{rev:0.75, size:9, room:"grotte", dark:0.8, veil:0.6, sat:0.15, wow:0.15, hiss:0.06}}, "les Enfers : le Styx, des voix, un chœur sous la terre"]
];
/* Dark ambient : des textures plutôt que des notes. Trois couches continues (grave, pierre qui chante, air), un bourdon, des chœurs lents,
   une mélodie rare qui passe comme un souvenir, d'immenses réverbérations, aucun tempo audible, aucun bruitage. Mixé pour passer sous la voix. */
const DARK = [
  ["Carcer", {rc:0.05, seed:6601, root:1, scales:["phrygien","locrien",""], tempo:40, meter:"4/4", tension:0.6, sectionBars:16,
    drone:{lvl:0.5, timbre:"choeur", bright:0.2, drift:0.8}, pad:{lvl:0.25, timbre:"machine", len:8, motion:0.3}, mel:{lvl:0.3, inst:"voix", dens:0.06, reg:0, span:1, leap:0.15},
    canon:{lvl:0}, perc:{lvl:0}, tex:{sub:0.7, mid:0.5, air:0.25}, amb:{vent:0.15, gouttes:0.15}, grain:{mix:0.25, dens:0.3, size:0.8, spread:0.7, pitch:0.3},
    fx:{voix:0.4, rev:0.8, size:9, room:"grotte", dark:0.8, veil:0.5, hiss:0.04, wow:0.1}}, "la prison sous la ville : pierre, chœur lointain, grondement"],
  ["Vacuum", {rc:0.05, seed:9090, root:6, scales:["lydien","tons",""], tempo:40, meter:"4/4", tension:0.45, sectionBars:16,
    drone:{lvl:0.4, timbre:"pur", bright:0.3, drift:0.7}, pad:{lvl:0.3, timbre:"vecteur", len:8, motion:0.4}, mel:{lvl:0.25, inst:"fmcloche", dens:0.05, reg:2, span:1},
    canon:{lvl:0}, perc:{lvl:0}, tex:{sub:0.5, mid:0.3, air:0.6}, grain:{mix:0.4, dens:0.4, size:0.8, spread:0.8, pitch:0.5},
    fx:{voix:0.4, rev:0.75, size:9, dark:0.5, shim:0.4, mod:0.8, veil:0.3}}, "le vide entre les étoiles : souffle, cloches perdues, grondement"],
  ["Ruinae", {rc:0.05, seed:3131, root:4, scales:["eolien","phrygien",""], tempo:40, meter:"4/4", tension:0.5, sectionBars:16,
    drone:{lvl:0.25, timbre:"anche", bright:0.2, drift:0.7}, pad:{lvl:0.2, timbre:"choeur", len:8, motion:0.3}, mel:{lvl:0.3, inst:"archet", dens:0.06, reg:0, span:1},
    canon:{lvl:0}, perc:{lvl:0}, tex:{sub:0.4, mid:0.6, air:0.4}, amb:{vent:0.5},
    fx:{voix:0.4, rev:0.7, size:8, dark:0.65, veil:0.4, hiss:0.03}}, "les ruines : le vent dans la pierre, un archet très loin"],
  ["Sanctum", {rc:0.1, seed:7171, root:2, scales:["dorien","eolien",""], tempo:40, meter:"4/4", tension:0.5, sectionBars:16,
    drone:{lvl:0.6, timbre:"choeur", bright:0.25, drift:0.7}, pad:{lvl:0.45, timbre:"choeur", len:8, motion:0.3}, mel:{lvl:0}, canon:{lvl:0},
    perc:{lvl:0.08, kit:"taiko", shaker:0, ghost:0}, tex:{sub:0.6, mid:0.3, air:0.2}, amb:{feu:0.15},
    fx:{voix:0.4, rev:0.75, size:8, room:"chapelle", dark:0.6, veil:0.4}}, "le sanctuaire souterrain : chœurs qui montent et s'effacent, un tambour très lent"],
  ["Glacies", {rc:0.05, seed:2020, root:9, scales:["dorien","pentmin",""], tempo:40, meter:"4/4", tension:0.4, sectionBars:16,
    drone:{lvl:0.3, timbre:"choeur", bright:0.3, drift:0.6}, pad:{lvl:0.2, timbre:"machine", len:8, motion:0.3}, mel:{lvl:0.28, inst:"archet", dens:0.05, reg:1, span:1},
    canon:{lvl:0}, perc:{lvl:0}, tex:{sub:0.3, mid:0.4, air:0.6}, amb:{vent:0.5},
    fx:{voix:0.4, rev:0.75, size:9, dark:0.45, veil:0.25, shim:0.2}}, "le glacier : le vent, la glace qui chante, un archet perdu"],
  ["Harmonia", {rc:0.05, seed:1969, root:2, scales:["eolien","",""], tempo:40, meter:"4/4", tension:0.4, sectionBars:16, temper:"adapt",
    drone:{lvl:0.55, timbre:"pur", bright:0.25, drift:0.4, harm:0.9}, pad:{lvl:0.12, timbre:"choeur", len:8, motion:0.2}, mel:{lvl:0},
    canon:{lvl:0}, perc:{lvl:0}, tex:{sub:0.3, mid:0.15, air:0.2},
    fx:{voix:0.4, rev:0.7, size:8, dark:0.5, veil:0.3}}, "la série harmonique : les partiels du bourdon entrent et sortent très lentement, comme chez Éliane Radigue"]
];
const UNIVERS = [
  {id:"dungeon", name:"Dungeon synth", tag:"accords, arpèges, flûtes et cordes de vieux claviers : la musique des donjons et des montagnes", items:DUNGEON},
  {id:"dark", name:"Dark ambient", tag:"textures plutôt que notes : pierre, vent, chœurs lointains, grondements, pour passer sous la voix du meneur", items:DARK},
  {id:"antique", name:"Antiquité", tag:"Grèce, Sparte, Rome : aulos, lyre, cornu, et les gammes anciennes", items:ANTIQUE},
  {id:"medieval", name:"Médiéval", tag:"tavernes, cryptes, scriptoriums : le Moyen Âge à la cire et à la bière", items:MEDIEVAL},
  {id:"aventure", name:"Aventure", tag:"combat, voyage, embuscade, victoire : les temps forts d'une partie", items:AVENTURE},
  {id:"pirates", name:"Pirates", tag:"ports, chants de marins, tempêtes et îles au trésor", items:PIRATES},
  {id:"nordique", name:"Nordique", tag:"veillées au feu, tambours de guerre, fjords dans la brume", items:NORDIQUE},
  {id:"feerie", name:"Féerie", tag:"clairières, bals de fées, forêts enchantées, berceuses", items:FEERIE},
  {id:"horreur", name:"Horreur", tag:"fantômes, manoirs hantés, rituels, cachots", items:HORREUR},
  {id:"cyber", name:"Cyberpunk", tag:"villes néon, pluie acide, usines, serveurs", items:CYBER},
  {id:"espace", name:"Espace", tag:"étoiles, nébuleuses, gouffres", items:ESPACE},
  {id:"orient", name:"Orient et Égypte", tag:"oud, ney, déserts, quarts de ton", items:ORIENT},
  {id:"nature", name:"Nature", tag:"pluie, mer, forêt, nuit", items:NATURE},
  {id:"calme", name:"Calme", tag:"travail, sommeil, méditation", items:CALME}
];
/* hors du Moyen Âge, un préréglage qui ne cite pas un bruit de lieu n'en veut pas : sans cela, murmure et tintements de taverne s'invitaient dans l'espace ou chez les pirates */
UNIVERS.forEach(u=>{ if(u.id!=="medieval") u.items.forEach(it=>{ it[1].amb=Object.assign({murmur:0,clink:0,feu:0,vent:0,gouttes:0},it[1].amb||{}); }); });
/* sonie : gain (dB) de chaque ambiance, mesuré hors ligne (BS.1770, 24 s, après le limiteur) pour viser -13 LUFS (-15 pour Calme) */
const PRESET_NORM={"Ars Nova":-4.6,"Lacrimae":-5.6,"Harmonia":0.9,"Estampida":-4.1,"Saltarellus":-4.4,"Spiritus Antiquus":-5.4,"Agmen Umbrarum":-4.5,"Turris Vetus":-7.2,"Feudum":-5.9,"Cuniculus":-2.7,"Memoria":-4.7,"Nix Aeterna":-5.4,"Taberna":-0.1,"Chorea":-5.0,"Crypta":-3.6,"Scriptorium":-6.9,"Turris":-4.0,"Tripudium":1.2,"Pugna":-4.8,"Iter":-5.4,"Triumphus":-5.0,"Insidiae":-0.5,"Portus":0.5,"Navigium":-4.9,"Tempestas":-5.2,"Thesaurus":-5.1,"Skalda":-3.7,"Bellum":-5.8,"Fjordus":-5.7,"Runae":-2.3,"Fata":-5.1,"Aula Fatarum":-6.1,"Sylva Magica":1.3,"Lullaby":2.2,"Larva":-2.7,"Domus Obscura":-5.7,"Sacrificium":-5.2,"Cella":-4.4,"Desertum":2.7,"Saloon":2.0,"Duellum":-6.1,"Equitatus":-5.9,"Urbs Neon":-2.8,"Machina":0.1,"Datum":-2.0,"Imber Toxicus":-3.6,"Sidera":2.8,"Nebula":-1.5,"Abyssus":-1.5,"Aegyptus":-2.4,"Eremus":-6.0,"Hortus":-5.3,"Bayati":-2.2,"Enharmonia":0.5,"Pluvia":-1.7,"Mare":-0.2,"Silva":-1.9,"Nox":-0.2,"Somnus":0.4,"Meditatio":-1.5,"Labor":-3.6,"Montagne":-5.7,"Hiems":-5.2,"Silva Antiqua":-5.7,"Agora":2.9,"Thermopylae":-1.9,"Odyssea":-0.9,"Hades":-3.3,"Custos":-5.5,"Castellum":-4.8,"Delphi":-2.0,"Sparta":-4.0,"Roma Triumphans":-1.7,"Carcer":-3.8,"Vacuum":-4.1,"Ruinae":-2.4,"Sanctum":-1.6,"Glacies":-3.1,"Vigilia":-4.5,"Regnum Umbrae":-5.5,"Iter Montium":-4.5};
/* chaque univers a sa batterie ; un préréglage peut en citer une autre */
const UNIV_KIT={dark:"taiko", antique:"antique", dungeon:"taiko", medieval:"cadre", aventure:"caisse", pirates:"cadre", nordique:"taiko", feerie:"cadre", horreur:"taiko", cyber:"electro", espace:"electro", orient:"darbouka", nature:"cadre", calme:"cadre"};
/* réglage fin, ambiance par ambiance : où elle se place entre rituel et chanson, ce qu'elle emprunte aux voix (arpège, plain-chant, voix), le tempérament de son époque, ses bêtes */
const PRESET_TUNE={
  /* Dungeon synth : chansons, sauf l'hiver qui tient du rituel ; arpège génératif pour l'hiver, chevaux à l'écurie du château, orgue en Werckmeister */
  Hiems:{rc:0.6, arp:{pat:"auto"}}, Castellum:{temper:"werck", nature:{chevaux:0.08}},
  /* Antiquité : accord pythagoricien grec ; Sparte et Rome marchent, Rome est une fanfare */
  Agora:{rc:0.3, temper:"pyth"}, Delphi:{temper:"pyth", loops:{lvl:0.12, count:2, inst:"bol", speed:1.6}}, Sparta:{rc:0.35, temper:"pyth"}, Thermopylae:{temper:"pyth"}, Odyssea:{rc:0.3, temper:"pyth"},
  "Roma Triumphans":{rc:0.6},
  /* Médiéval : chant sur bourdon en pythagoricien, danses à accords en mésotonique ; la tour du mage a un arpège qui mute ; un hibou autour de la tour */
  Taberna:{temper:"meso"}, Chorea:{temper:"meso", fx:{algo:"salle"}}, Tripudium:{temper:"meso", fx:{algo:"salle"}}, Turris:{arp:{pat:"auto"}, nature:{hibou:0.15}},
  /* Aventure : le voyage a son luth en arpège, l'embuscade retient son souffle */
  Iter:{arp:{lvl:0.3, inst:"luth", pat:"vaetvient", rate:1, reg:1, span:1}}, Triumphus:{rc:0.65}, Insidiae:{rc:0.35},
  /* Pirates */
  Tempestas:{rc:0.6}, Thesaurus:{rc:0.55},
  /* Nordique : la veillée a une lyre qui improvise, les corbeaux d'Odin tournent sur le rituel */
  Skalda:{arp:{lvl:0.25, inst:"lyre", pat:"auto", rate:1, reg:1, span:1}}, Bellum:{rc:0.5}, Runae:{rc:0.25, nature:{corbeaux:0.12}},
  /* Féerie : le bal est une valse avec sa harpe, en mésotonique ; la berceuse a sa harpe et des grillons */
  "Aula Fatarum":{rc:0.75, temper:"meso", arp:{lvl:0.3, inst:"harpe", pat:"vaetvient", rate:1, reg:1, span:1}}, "Sylva Magica":{rc:0.3, nature:{hibou:0.15}},
  Lullaby:{rc:0.55, arp:{lvl:0.25, inst:"harpe", pat:"vaetvient", rate:1, reg:1, span:1}, nature:{nuit:0.2}},
  /* Horreur : le sacrifice est un rite */
  Sacrificium:{rc:0.2, scales:["eolien","phrygien",""]},
  /* Cyberpunk */
  "Urbs Neon":{rc:0.6}, Datum:{rc:0.45}, "Imber Toxicus":{rc:0.3},
  /* Orient : un étang de grenouilles au jardin zen */
  Aegyptus:{rc:0.5}, Eremus:{rc:0.25}, Hortus:{rc:0.3, nature:{grenouilles:0.12}}, Bayati:{rc:0.45}, Enharmonia:{rc:0.25},
  /* Calme : le travail est un ostinato un peu plus présent */
  Labor:{rc:0.3},
  /* textures dark ambient dans les ambiances de rituel et de ténèbres */
  Crypta:{temper:"pyth", tex:{sub:0.5, mid:0.3}}, Scriptorium:{mus:{logic:"corpus"}}, Cella:{tex:{sub:0.5, mid:0.5}}, Hades:{temper:"pyth", tex:{sub:0.6, mid:0.4, air:0.2}}, Abyssus:{tex:{sub:0.7, air:0.3}},
  Larva:{tex:{mid:0.4, air:0.3}}, Nebula:{tex:{sub:0.3, air:0.5}}, Sidera:{tex:{air:0.4}}, "Domus Obscura":{tex:{sub:0.3}}, Fjordus:{rc:0.3, tex:{air:0.3}}
};
/* versions ambiance : les scènes chargées (fête, danse, bataille, fanfare) deviennent leur moment calme, juste avant ou juste après.
   Recette commune, celle des ambiances épurées : tempo lent, une voix soliste clairsemée, un fond doux, pas ou peu de percussion (lointaine), le lieu et ses bêtes portent la scène. */
const Z={canon:{lvl:0}, arp:{lvl:0}, loops:{lvl:0}, pend:{lvl:0}};
const AMBIANCE={
  Taberna:{g:"taverne la nuit, après la fête : le feu, quelques voix, un luth seul", o:{rc:0.3, tempo:56, meter:"3/4", mus:{form:"libre"}, mel:{lvl:0.5, inst:"luth", dens:0.2, reg:1, span:1, leap:0.15, deja:0.4}, drone:{lvl:0.15, timbre:"anche", bright:0.3}, pad:{lvl:0.18, timbre:"machine", len:4, bass:0.4}, perc:{lvl:0}, amb:{murmur:0.15, clink:0.1, feu:0.55}, fx:{algo:"salle", rev:0.4, size:3, dark:0.55, wow:0.06}}},
  Portus:{g:"le port la nuit : les vagues contre le quai, un accordéon au loin", o:{rc:0.3, tempo:60, meter:"6/8", mus:{form:"libre"}, mel:{lvl:0.45, inst:"accordeon", dens:0.2, reg:1, span:1, leap:0.15}, drone:{lvl:0.2, timbre:"choeur"}, pad:{lvl:0.15, timbre:"choeur", len:4}, perc:{lvl:0}, nature:{mer:0.5, mouettes:0.1}, amb:{murmur:0.1, clink:0.1, feu:0.1, vent:0.2}, fx:{algo:"vivante", rev:0.5, size:4, dark:0.5}}},
  Chorea:{g:"le bal est fini : la salle vide, une flûte qui se souvient de la danse", o:{rc:0.3, tempo:60, meter:"6/8", mus:{form:"libre"}, mel:{lvl:0.5, inst:"flute", dens:0.2, reg:1, span:1, leap:0.15}, drone:{lvl:0.2, timbre:"anche", bright:0.3}, pad:{lvl:0.2, timbre:"machine", len:4}, perc:{lvl:0}, amb:{murmur:0.05, clink:0, feu:0.3}, fx:{algo:"salle", rev:0.5, size:4, dark:0.5}}},
  Tripudium:{g:"la place du village au crépuscule : un luth, les cloches au loin", o:{rc:0.3, tempo:58, meter:"3/4", mus:{form:"libre"}, mel:{lvl:0.5, inst:"luth", dens:0.2, reg:1, span:1, leap:0.15}, drone:{lvl:0.15, timbre:"anche"}, pad:{lvl:0.2, timbre:"machine", len:4}, loops:{lvl:0.15, count:3, inst:"carillon", speed:1.6}, perc:{lvl:0}, amb:{murmur:0.1, clink:0, feu:0, vent:0.2}, nature:{oiseaux:0.15}, fx:{algo:"salle", rev:0.45, size:4}}},
  Pugna:{g:"après la bataille : le champ silencieux, un cor lointain, les corbeaux", o:{rc:0.2, tempo:50, scales:["phrygien","eolien",""], tension:0.6, mus:{form:"libre"}, mel:{lvl:0.45, inst:"cuivre", dens:0.12, reg:0, span:1, leap:0.15}, drone:{lvl:0.5, timbre:"choeur", bright:0.25}, pad:{lvl:0.3, timbre:"cordes", len:6}, perc:{lvl:0.12, kit:"taiko", shaker:0, ghost:0}, nature:{corbeaux:0.25, chevaux:0.1}, amb:{vent:0.4}, fx:{algo:"salle", rev:0.6, size:6, dark:0.6, sat:0.05}}},
  Triumphus:{g:"la cathédrale après le sacre : l'orgue qui résonne dans la nef vide", o:{rc:0.25, tempo:52, mus:{form:"libre"}, mel:{lvl:0.4, inst:"cuivre", dens:0.12, reg:1, span:1, leap:0.15}, drone:{lvl:0.5, timbre:"orgue"}, pad:{lvl:0.35, timbre:"orgue", len:6}, perc:{lvl:0}, amb:{murmur:0.05}, fx:{algo:"salle", rev:0.65, size:7, dark:0.45}}},
  Iter:{g:"la route au soir : le vent, une flûte, les chevaux qui marchent", o:{rc:0.35, tempo:60, mus:{form:"libre"}, mel:{lvl:0.45, inst:"flute", dens:0.25, reg:1, span:1, leap:0.15}, arp:{lvl:0.2, inst:"luth", pat:"auto"}, drone:{lvl:0.3, timbre:"anche", bright:0.3}, pad:{lvl:0.15, timbre:"cordes", len:4}, perc:{lvl:0.12, kit:"cadre", shaker:0, ghost:0}, nature:{chevaux:0.15, oiseaux:0.1}, amb:{vent:0.35}, fx:{rev:0.45, size:4}}},
  Tempestas:{g:"après la tempête : la houle qui retombe, le bateau qui grince", o:{rc:0.25, tempo:50, mus:{form:"libre"}, mel:{lvl:0.45, inst:"archet", dens:0.15, reg:0, span:1, leap:0.15}, drone:{lvl:0.45, timbre:"pur", bright:0.3}, pad:{lvl:0.3, timbre:"cordes", len:6}, perc:{lvl:0}, nature:{mer:0.7, pluie:0.25, mouettes:0.05}, amb:{vent:0.45}, fx:{rev:0.55, size:6, dark:0.6}}},
  Bellum:{g:"la veille de la bataille : les feux de camp, des tambours au loin, un chant grave", o:{rc:0.25, tempo:56, mus:{form:"libre"}, mel:{lvl:0.4, inst:"cuivre", dens:0.12, reg:0, span:1, leap:0.15}, drone:{lvl:0.6, timbre:"choeur"}, pad:{lvl:0.35, timbre:"choeur", len:4}, perc:{lvl:0.25, kit:"taiko", shaker:0, ghost:0}, amb:{feu:0.4, murmur:0.1, vent:0.25}, nature:{chevaux:0.12, loup:0.05}, fx:{rev:0.55, size:5, dark:0.6}}},
  "Aula Fatarum":{g:"le bal des fées s'éteint : des carillons, une flûte, la rosée", o:{rc:0.3, tempo:60, mus:{form:"libre"}, mel:{lvl:0.45, inst:"flute", dens:0.2, reg:1, span:1, leap:0.15}, arp:{lvl:0.2, inst:"harpe", pat:"auto"}, loops:{lvl:0.15, count:3, inst:"carillon", speed:1.6}, drone:{lvl:0.2, timbre:"orgue"}, pad:{lvl:0.25, timbre:"vecteur", len:4}, perc:{lvl:0}, amb:{murmur:0}, nature:{nuit:0.2, ruisseau:0.15}, fx:{rev:0.55, size:5, shim:0.25}}},
  Sparta:{g:"Sparte la nuit : le camp, un aulos solitaire, les braises", o:{rc:0.2, tempo:54, meter:"4/4", mus:{form:"libre"}, mel:{lvl:0.45, inst:"aulos", dens:0.18, reg:1, span:1, leap:0.15}, drone:{lvl:0.45, timbre:"aulos"}, pad:{lvl:0.2, timbre:"choeur", len:4}, perc:{lvl:0.15, shaker:0, ghost:0}, amb:{feu:0.35, vent:0.25}, fx:{rev:0.45, size:4, dark:0.5}}},
  "Roma Triumphans":{g:"Rome la nuit : le forum désert, une fontaine, l'hydraulis au loin", o:{rc:0.25, tempo:54, mus:{form:"libre"}, mel:{lvl:0.4, inst:"hydraulis", dens:0.15, reg:1, span:1, leap:0.15}, drone:{lvl:0.25, timbre:"orgue"}, pad:{lvl:0.25, timbre:"orgue", len:6}, perc:{lvl:0}, amb:{murmur:0.08}, nature:{ruisseau:0.25}, fx:{algo:"salle", rev:0.55, size:5}}},
  Agora:{g:"l'agora au crépuscule : une lyre, la ville qui se tait", o:{rc:0.25, tempo:60, mus:{form:"libre"}, mel:{lvl:0.5, inst:"lyre", dens:0.25, reg:1, span:1, leap:0.15}, canon:{lvl:0.15, inst:"syrinx", delay:3, shift:"oct+"}, perc:{lvl:0.1, shaker:0, ghost:0}, amb:{murmur:0.2, clink:0}, fx:{rev:0.4, size:3.5}}},
  "Urbs Neon":{g:"la ville sous la pluie, à trois heures du matin : néons, synthés, basse", o:{rc:0.4, tempo:80, mel:{lvl:0.45, dens:0.3}, perc:{lvl:0.3, shaker:0.3, ghost:0.2}, fx:{rev:0.5, size:4}}},
  Machina:{g:"l'usine la nuit : les machines qui tournent seules", o:{rc:0.4, tempo:92, mel:{lvl:0.4, dens:0.4}, perc:{lvl:0.45, shaker:0.4, ghost:0.2}, loops:{lvl:0.3}, fx:{rev:0.35, size:2.5}}},
  Castellum:{g:"le château la nuit : l'orgue, une harpe, la garde qui veille", o:{rc:0.5, tempo:72, perc:{lvl:0.15, shaker:0, ghost:0}, mel:{dens:0.35}}}
};
/* harmonie de cinéma : le merveilleux dans la féerie et les montagnes, la menace dans l'horreur et les royaumes d'ombre */
const PRESET_CINE={"Sylva Magica":"merveilleux","Fata":"merveilleux","Aula Fatarum":"merveilleux","Nix Aeterna":"merveilleux","Montagne":"merveilleux","Memoria":"merveilleux",
  "Domus Obscura":"menace","Larva":"menace","Sacrificium":"menace","Regnum Umbrae":"menace","Spiritus Antiquus":"menace","Custos":"tension","Agmen Umbrarum":"tension"};
/* les bêtes de chaque ambiance */
const PRESET_BEASTS={Nox:{grenouilles:0.4, hibou:0.35}, Pluvia:{grenouilles:0.3}, Silva:{corbeaux:0.12}, Mare:{mouettes:0.3}, "Domus Obscura":{corbeaux:0.2, loup:0.12}, Crypta:{corbeaux:0.1},
  Larva:{hibou:0.2}, Fjordus:{loup:0.2}, Skalda:{loup:0.12}, Bellum:{chevaux:0.2}, Hiems:{loup:0.2}, "Silva Antiqua":{hibou:0.15}, Iter:{chevaux:0.15}, Insidiae:{corbeaux:0.15, hibou:0.15},
  Portus:{mouettes:0.4}, Navigium:{mouettes:0.2}, Thesaurus:{mouettes:0.3},
  Thermopylae:{chevaux:0.12}, Odyssea:{mouettes:0.3}, Montagne:{loup:0.08}, Custos:{corbeaux:0.1}};
const UNIV_EUCL={cyber:0.5, orient:0.35};
/* point de départ sur l'axe rituel ↔ chanson : les musiques de bourdon d'un côté, les chansons de l'autre */
const UNIV_RC={dark:0.05, antique:0.15, calme:0.15, espace:0.2, horreur:0.25, nature:0.25, orient:0.4, nordique:0.45, medieval:0.5, feerie:0.5, cyber:0.55, aventure:0.6, pirates:0.7, dungeon:0.8};
UNIVERS.forEach(u=>u.items.forEach(it=>{ const p=it[1]; p.perc=Object.assign({kit:UNIV_KIT[u.id]||"cadre", eucl:UNIV_EUCL[u.id]||0},p.perc||{}); if(p.norm===undefined) p.norm=PRESET_NORM[it[0]]||0; if(p.rc===undefined) p.rc=UNIV_RC[u.id]===undefined?0.5:UNIV_RC[u.id]; if(PRESET_BEASTS[it[0]]) p.nature=Object.assign({},p.nature||{},PRESET_BEASTS[it[0]]); if(PRESET_TUNE[it[0]]) merge(p,clone(PRESET_TUNE[it[0]]));
  const AV=AMBIANCE[it[0]]; if(AV){ if(!AV.o.canon&&!(it[0]==="Urbs Neon"||it[0]==="Machina"||it[0]==="Castellum")) merge(p,clone(Z)); merge(p,clone(AV.o)); it[2]=AV.g; } }));
/* équilibre mesuré (sonie pondérée, rendu hors ligne) : le lieu ramené à 14 dB sous la musique, le bourdon baissé de 3 dB là où il étouffait la mélodie ; norm compense la sonie */
const PRESET_MIX={"Desertum":{amb:0.43,norm:0.8},"Nox":{amb:0.51,drone:0.71,norm:1.8},"Mare":{amb:0.52,drone:0.71,norm:2.1},"Fjordus":{amb:0.57},"Odyssea":{amb:0.61},"Saloon":{amb:0.62,norm:0.3},"Silva":{amb:0.65},"Hiems":{amb:0.67},"Pluvia":{amb:0.68},"Sylva Magica":{amb:0.69},"Skalda":{amb:0.71},"Domus Obscura":{amb:0.72},"Larva":{amb:0.74,drone:0.71,norm:0.4},"Portus":{amb:0.76},"Equitatus":{amb:0.83},"Crypta":{amb:0.84},"Glacies":{amb:0.86},"Abyssus":{drone:0.71},"Sidera":{drone:0.71,norm:0.6},"Cella":{drone:0.71,norm:0.5}};
UNIVERS.forEach(u=>u.items.forEach(it=>{ const m=PRESET_MIX[it[0]], p=it[1]; if(!m) return; if(m.amb){ p.amb=p.amb||{}; p.amb.lvl=+((p.amb.lvl===undefined?1:p.amb.lvl)*m.amb).toFixed(3); } if(m.drone&&p.drone) p.drone.lvl=+((p.drone.lvl===undefined?DEFAULT.drone.lvl:p.drone.lvl)*m.drone).toFixed(3); if(m.norm) p.norm=+((p.norm||0)+m.norm).toFixed(1); }));
/* billes dans quelques ambiances planantes : des notes qui tombent et rebondissent au loin */
/* l'arbre dans les forêts : une ramure qui pousse et que le vent fait tinter */
const PRESET_ARBRE={"Silva":{lvl:0.4,inst:"kalimba",prof:5,vent:0.5,pousse:2}, "Silva Antiqua":{lvl:0.35,inst:"verre",prof:5,vent:0.35,pousse:4}, "Hortus":{lvl:0.3,inst:"verre",prof:4,vent:0.3,pousse:3}, "Nox":{lvl:0.25,inst:"carillon",prof:4,vent:0.25,pousse:5}};
UNIVERS.forEach(u=>u.items.forEach(it=>{ const a=PRESET_ARBRE[it[0]]; if(a) it[1].arbre=Object.assign({},DEFAULT.arbre,a); }));
/* nuée de grains autour des nappes, dans les ambiances les plus flottantes */
const PRESET_NUEE={"Vacuum":{lvl:0.35,mat:"souffle",dens:0.3,vie:0.7,grav:0.15,haut:0.6}, "Abyssus":{lvl:0.3,mat:"voix",dens:0.35,vie:0.8,grav:0.25,haut:0.35}, "Sanctum":{lvl:0.28,mat:"voix",dens:0.25,vie:0.9,grav:0.1,haut:0.55}, "Glacies":{lvl:0.25,mat:"verre",dens:0.45,vie:0.35,grav:0.4,haut:0.8}};
UNIVERS.forEach(u=>u.items.forEach(it=>{ const n=PRESET_NUEE[it[0]]; if(n) it[1].nuee=Object.assign({},DEFAULT.nuee,n); }));
const PRESET_BILLE={"Glacies":{lvl:0.32,inst:"verre",count:2,haut:2,rebond:0.82,pause:1.5}, "Sylva Magica":{lvl:0.3,inst:"kalimba",count:4,haut:1,rebond:0.74}, "Nebula":{lvl:0.28,inst:"fmcloche",count:3,haut:1.5,rebond:0.8,pause:2}, "Meditatio":{lvl:0.25,inst:"kalimba",count:2,haut:2.5,rebond:0.85,pause:2,mode:"descend"}};
UNIVERS.forEach(u=>u.items.forEach(it=>{ const b=PRESET_BILLE[it[0]]; if(b) it[1].bille=Object.assign({},DEFAULT.bille,b); }));
UNIVERS.forEach(u=>u.items.forEach(it=>{ const c=PRESET_CINE[it[0]]; if(c){ it[1].mus=Object.assign({},it[1].mus||{},{cine:c}); } }));
/* marqueur du lieu par univers (Schafer) : la cloche du village ou du monastère, la cloche de bord, le cor dans la vallée, le gong, la cloche fêlée */
const UNIV_MARQUE={medieval:"cloche", dungeon:"cloche", pirates:"bord", nordique:"cor", orient:"gong", horreur:"felee"};
UNIVERS.forEach(u=>{ const m=UNIV_MARQUE[u.id]; if(m) u.items.forEach(it=>{ const a=it[1].amb=it[1].amb||{}; if(a.marqueSon===undefined){ a.marqueSon=m; a.marque=0.4; } }); });
/* liste à plat des préréglages */
const PRESETS = UNIVERS.flatMap(u=>u.items.map(([n,s,g])=>[n,s,g,u.id]));
function clone(o){return JSON.parse(JSON.stringify(o));}
function merge(a,b){for(const k in b){ if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){ a[k]=merge(a[k]||{},b[k]); } else a[k]=b[k]; } return a;}
let S = clone(DEFAULT);

/* d'anciennes scènes n'ont que quatre emplacements de modulation : on complète jusqu'à huit */
function normS(){ if(S.daw) S.daw.tracks=[]; /* plus de pistes d'Arranger : le Studio les remplace */ if(Array.isArray(S.drift)) S.drift.forEach(w=>{ if(w&&w.t2===undefined) w.t2="none"; }); if(S.syn&&S.syn.mod){ const dm=SYN_DEFAULT.mod; while(S.syn.mod.length<8) S.syn.mod.push({...dm[S.syn.mod.length]}); } return S; }

/* chaque lecture, chaque rendu : une pièce nouvelle (la graine reste interne, pour garder les stems alignés) */
const newSeed=()=>1+Math.floor(Math.random()*4294967000);
