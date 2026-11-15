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
  ["Personnel", [
    ["libre","Libre (dessinée sur le cercle)",null]]]
];
const SC = {};
SCALE_GROUPS.forEach(([,l])=>l.forEach(([k,n,iv])=>{SC[k]={n,iv};}));
function ivOf(S,key){
  if(key==="libre"){const a=[];S.custom.forEach((v,i)=>{if(v||i===0)a.push(i);});return a;}
  return (SC[key]||SC.mixolydien).iv;
}
function poolOf(iv,lo,hi){const a=[];for(let o=lo;o<=hi;o++){if(iv.indexOf(((o%12)+12)%12)>=0)a.push(o);}return a;}
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
  meso:[1,1.04490,1.11803,1.19628,1.25,1.33748,1.39754,1.49535,1.5625,1.67185,1.78885,1.86920]
};
function mkFreq(S){
  const rootMidi=36+S.root, rootF=S.a4*Math.pow(2,(rootMidi-69)/12), r=RAT[S.temper]||RAT.egal;
  return off=>{const oct=Math.floor(off/12), pc=((off%12)+12)%12; return rootF*Math.pow(2,oct)*r[pc];};
}

/* mesures : motif sur grille de croches. S frappe forte, s frappe, T tap, t petit tap, h croche libre (shaker) */
const METERS = {
  "4/4":{p:["S","h","T","h","s","h","T","h"], n:4, d:2},
  "6/8":{p:["S","h","t","s","h","t"], n:6, d:3},
  "3/4":{p:["S","h","T","h","T","h"], n:3, d:2},
  "2/4":{p:["S","h","T","h"], n:2, d:2},
  "7/8":{p:["S","h","T","h","s","h","t"], n:7, d:3},
  "12/8":{p:["S","h","h","t","h","h","s","h","h","t","h","h"], n:12, d:3}
};

/* ============================================================
   ÉTAT, PRÉRÉGLAGES
   ============================================================ */
const DEFAULT = {
  seed:1472, root:2, scales:["mixolydien","",""], custom:[1,0,1,0,1,1,0,1,0,1,1,0], sectionBars:16,
  temper:"egal", a4:440,
  tempo:120, meter:"4/4", swing:0.1, tension:0.5, vol:1,
  perc:{lvl:0.5, shaker:0.55, ghost:0.35},
  drone:{lvl:0.8, timbre:"anche", bright:0.5, width:0.5, drift:0.5, glide:0.5},
  mel:{lvl:0.6, inst:"luth", dens:0.85, reg:0, span:2, leap:0.2, orn:0.15, deja:0, loop:2},
  canon:{lvl:0, inst:"harpe", delay:2, shift:"oct+"},
  pad:{lvl:0.22, timbre:"cordes", len:2, motion:0.5, voices:3, deja:0, loop:2},
  loops:{lvl:0, count:3, inst:"carillon", speed:1},
  pend:{lvl:0, count:6, period:24, inst:"carillon"},
  amb:{murmur:0.35, clink:0.5, feu:0.15, vent:0, gouttes:0},
  fx:{rev:0.4, size:2.6, dark:0.5, dly:0, dlyDiv:1.5, fb:0.4, sat:0.15, wow:0.12, veil:0.3, hiss:0},
  form:{shape:"constante", period:4, amount:0.5},
  evt:{lvl:0.7},
  curve:{mode:"off", dur:6, pts:Array.from({length:96},()=>0.5)}
};
const MEDIEVAL = [
  ["Taberna", {}, "taverne animée"],
  ["Chorea", {seed:218, root:4, scales:["dorien","",""], tempo:138, meter:"6/8", swing:0,
    perc:{lvl:0.55, shaker:0.7, ghost:0.4}, mel:{inst:"flute", dens:0.9, leap:0.3, orn:0.3, reg:1, span:1},
    canon:{lvl:0.35, inst:"harpe", delay:1, shift:"oct+"}, pad:{lvl:0}, amb:{murmur:0.3, clink:0.7, feu:0},
    fx:{rev:0.3, size:2.2, dly:0.18, dlyDiv:1.5, fb:0.35}}, "gigue, danse en rond"],
  ["Crypta", {seed:6660, root:2, scales:["phrygien","phrygdom",""], tempo:52, meter:"4/4", swing:0, sectionBars:8,
    perc:{lvl:0}, drone:{lvl:0.95, timbre:"choeur", bright:0.3, width:0.7, drift:0.8, glide:0.7},
    mel:{inst:"carillon", dens:0.25, reg:1, span:2, orn:0.05}, canon:{lvl:0.3, inst:"carillon", delay:3, shift:"oct-"},
    pad:{lvl:0.6, timbre:"choeur", len:4, motion:0.7, voices:4}, amb:{murmur:0, clink:0, feu:0, vent:0.35, gouttes:0.6},
    fx:{rev:0.85, size:7, dark:0.7, dly:0.25, dlyDiv:3, fb:0.5, sat:0.35, wow:0.3, veil:0.55, hiss:0.15},
    loops:{lvl:0.3, count:3, inst:"carillon", speed:1.2},
    form:{shape:"arche", period:5, amount:0.6}}, "crypte froide et humide"],
  ["Scriptorium", {seed:1033, root:9, scales:["eolien","hexacorde",""], tempo:68, meter:"4/4", swing:0,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"orgue"},
    canon:{lvl:0.3, inst:"orgue", delay:2, shift:"q+"}, pad:{lvl:0.4, timbre:"orgue", len:4, motion:0.4, voices:3},
    amb:{murmur:0, clink:0, feu:0.35, vent:0, gouttes:0}, fx:{rev:0.65, size:4.5, dark:0.55, sat:0.2, wow:0.2, veil:0.45, hiss:0.1},
    mel:{inst:"flute", dens:0.4, reg:1, span:1, orn:0.1, deja:0.85, loop:3}, loops:{lvl:0.25, count:4, inst:"orgue", speed:1}}, "salle d'écriture des moines"],
  ["Turris", {seed:77, root:1, scales:["dblharm","lydidom",""], tempo:60, meter:"7/8", swing:0, sectionBars:12,
    perc:{lvl:0.25, shaker:0.3, ghost:0.1}, drone:{lvl:0.85, timbre:"choeur", bright:0.45, width:0.6, drift:0.7, glide:0.6},
    mel:{inst:"harpe", dens:0.5, reg:1, span:2, leap:0.4, orn:0.2}, canon:{lvl:0.35, inst:"carillon", delay:2, shift:"q+"},
    pad:{lvl:0.45, timbre:"cordes", len:2, motion:0.8, voices:4}, amb:{murmur:0, clink:0, feu:0.1, vent:0.2, gouttes:0.15},
    fx:{rev:0.7, size:5, dark:0.45, dly:0.3, dlyDiv:1.5, fb:0.45, sat:0.25, wow:0.25, veil:0.4, hiss:0.08},
    pend:{lvl:0.3, count:7, period:20, inst:"harpe"},
    form:{shape:"vagues", period:4, amount:0.6}}, "tour du mage"],
  ["Tripudium", {seed:905, root:7, scales:["hexacorde","ionien",""], tempo:104, meter:"3/4", swing:0.15,
    perc:{lvl:0.6, shaker:0.6, ghost:0.3}, mel:{inst:"luth", dens:0.95, leap:0.15, orn:0.2},
    canon:{lvl:0.3, inst:"flute", delay:2, shift:"t+"}, pad:{lvl:0.15, timbre:"cordes"}, amb:{murmur:0.4, clink:0.6, feu:0.1},
    fx:{rev:0.35, size:2.4, sat:0.12, wow:0.1, veil:0.25}}, "branle, danse à trois temps"]
];

/* univers : des ambiances qui ne se limitent pas au Moyen Âge. Chaque entrée : [nom latin, réglages, glose française] */
const CALME = [
  ["Somnus", {seed:4040, root:5, scales:["pentmaj","",""], sectionBars:32, tempo:40, temper:"juste", tension:0.3, vol:0.55,
    perc:{lvl:0}, drone:{lvl:0.5, timbre:"bol", bright:0.15, width:0.4, drift:0.6, glide:0.3},
    mel:{lvl:0.2, inst:"verre", dens:0.1, reg:1, span:2, leap:0.05, orn:0, deja:0.5, loop:2}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"synthe", len:8, motion:0.2, voices:3}, amb:{murmur:0, clink:0, feu:0, vent:0.1, gouttes:0},
    fx:{rev:0.55, size:9, dark:0.8, dly:0, sat:0.03, wow:0.06, veil:0.8, hiss:0}, form:{shape:"arche", period:10, amount:0.3},
    loops:{lvl:0.1, count:3, inst:"bol", speed:1.6}}, "sommeil, très lent et sombre"],
  ["Meditatio", {seed:108, root:2, scales:["pentmin","pentmaj",""], sectionBars:24, tempo:50, temper:"juste", tension:0.35, vol:0.65,
    perc:{lvl:0}, drone:{lvl:0.55, timbre:"bol", bright:0.25, width:0.5, drift:0.5, glide:0.4},
    mel:{lvl:0.3, inst:"bol", dens:0.18, reg:1, span:1, leap:0.1, orn:0, deja:0.7, loop:3}, canon:{lvl:0.2, inst:"verre", delay:4, shift:"oct+"},
    pad:{lvl:0.28, timbre:"verre", len:6, motion:0.3, voices:3}, amb:{murmur:0, clink:0, feu:0, vent:0.08, gouttes:0},
    fx:{rev:0.5, size:7, dark:0.55, sat:0.05, wow:0.08, veil:0.55, hiss:0}, form:{shape:"vagues", period:8, amount:0.4},
    loops:{lvl:0.25, count:4, inst:"bol", speed:1.3}}, "méditation, bols et nappes de verre"],
  ["Labor", {seed:2020, root:9, scales:["dorien","",""], sectionBars:32, tempo:68, tension:0.35,
    perc:{lvl:0}, drone:{lvl:0.55, timbre:"orgue", bright:0.3, width:0.3, drift:0.3, glide:0.2},
    mel:{lvl:0.3, inst:"kalimba", dens:0.35, reg:1, span:2, leap:0.1, orn:0, deja:0.92, loop:3}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"synthe", len:4, motion:0.3, voices:3, deja:0.8, loop:4}, amb:{murmur:0.18, clink:0, feu:0, vent:0, gouttes:0},
    fx:{rev:0.5, size:3.5, dark:0.5, sat:0.05, wow:0.05, veil:0.4, hiss:0}, form:{shape:"constante"}}, "travail et concentration, motifs répétitifs"]
];
const ESPACE = [
  ["Sidera", {seed:8888, root:0, scales:["lydien","tons",""], sectionBars:24, tempo:44, temper:"juste", tension:0.4, vol:0.6,
    perc:{lvl:0}, drone:{lvl:0.5, timbre:"bol", bright:0.5, width:0.7, drift:0.8, glide:0.6},
    mel:{lvl:0.3, inst:"verre", dens:0.14, reg:2, span:2, leap:0.3, orn:0, deja:0.4, loop:3}, canon:{lvl:0.25, inst:"verre", delay:3, shift:"q+"},
    pad:{lvl:0.38, timbre:"verre", len:8, motion:0.6, voices:4}, amb:{vent:0.1},
    fx:{rev:0.6, size:9, dark:0.4, dly:0.25, dlyDiv:3, fb:0.6, sat:0.04, wow:0.05, veil:0.3, hiss:0.05}, form:{shape:"arche", period:10, amount:0.5},
    loops:{lvl:0.35, count:5, inst:"verre", speed:1.4}, pend:{lvl:0.25, count:8, period:36, inst:"verre"}}, "étoiles, cloches de verre et échos"],
  ["Nebula", {seed:5150, root:3, scales:["tons","octa",""], sectionBars:16, tempo:50, tension:0.45, vol:0.7,
    perc:{lvl:0}, drone:{lvl:0.6, timbre:"choeur", bright:0.35, width:0.8, drift:0.9, glide:0.8},
    mel:{lvl:0.25, inst:"synthe", dens:0.2, reg:1, span:3, leap:0.35, orn:0, deja:0.3, loop:4}, canon:{lvl:0},
    pad:{lvl:0.4, timbre:"synthe", len:6, motion:0.85, voices:4}, amb:{vent:0.25},
    fx:{rev:0.6, size:8, dark:0.6, dly:0.3, dlyDiv:2, fb:0.5, sat:0.15, wow:0.2, veil:0.5, hiss:0.1}, form:{shape:"vagues", period:6, amount:0.6},
    loops:{lvl:0.2, count:3, inst:"synthe", speed:1.2}}, "nébuleuse, nappes de synthé qui dérivent"],
  ["Abyssus", {seed:666, root:7, scales:["locrien","phrygien",""], sectionBars:24, tempo:40, tension:0.55, vol:0.7,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"pur", bright:0.1, width:0.5, drift:0.7, glide:0.5},
    mel:{lvl:0.22, inst:"carillon", dens:0.08, reg:0, span:2, leap:0.2, orn:0, deja:0.2, loop:2}, canon:{lvl:0},
    pad:{lvl:0.35, timbre:"choeur", len:8, motion:0.4, voices:4}, amb:{vent:0.45, gouttes:0.25},
    fx:{rev:0.65, size:9, dark:0.88, sat:0.3, wow:0.3, veil:0.85, hiss:0.15}, form:{shape:"constante"},
    loops:{lvl:0.18, count:3, inst:"bol", speed:1.8}}, "gouffre, grave et sombre"]
];
const ORIENT = [
  ["Aegyptus", {seed:1301, root:2, scales:["phrygdom","dblharm",""], sectionBars:12, tempo:84, temper:"juste",
    perc:{lvl:0.38, shaker:0.5, ghost:0.3}, drone:{lvl:0.75, timbre:"anche", bright:0.5, width:0.6, drift:0.5, glide:0.55},
    mel:{lvl:0.6, inst:"oud", dens:0.55, reg:1, span:2, leap:0.25, orn:0.4, deja:0.5, loop:3}, canon:{lvl:0.3, inst:"ney", delay:2, shift:"oct+"},
    pad:{lvl:0.25, timbre:"cordes", len:4, motion:0.4, voices:3}, amb:{vent:0.1, feu:0.05},
    fx:{rev:0.5, size:3.5, dark:0.5, sat:0.15, wow:0.12, veil:0.3}, form:{shape:"arche", period:5, amount:0.4}}, "Égypte, oud, ney et tambour"],
  ["Eremus", {seed:3300, root:9, scales:["phrygdom","dblharm","phrygien"], sectionBars:12, tempo:56, temper:"juste",
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"anche", bright:0.45, width:0.7, drift:0.7, glide:0.6},
    mel:{lvl:0.5, inst:"ney", dens:0.3, reg:1, span:2, leap:0.3, orn:0.35, deja:0.4, loop:3}, canon:{lvl:0},
    pad:{lvl:0.3, timbre:"choeur", len:6, motion:0.4, voices:3}, amb:{vent:0.55},
    fx:{rev:0.65, size:5, dark:0.55, sat:0.2, wow:0.2, veil:0.45, hiss:0.12}, form:{shape:"vagues", period:7, amount:0.5}}, "désert, vent et flûte ney"],
  ["Hortus", {seed:7007, root:7, scales:["hirajoshi","insen",""], sectionBars:16, tempo:56,
    perc:{lvl:0}, drone:{lvl:0.45, timbre:"pur", bright:0.3},
    mel:{lvl:0.55, inst:"harpe", dens:0.28, reg:1, span:2, leap:0.3, orn:0.1, deja:0.6, loop:3}, canon:{lvl:0.25, inst:"kalimba", delay:3, shift:"q+"},
    pad:{lvl:0.28, timbre:"verre", len:4, motion:0.4, voices:3}, amb:{gouttes:0.45, vent:0.12},
    fx:{rev:0.6, size:4, dark:0.4, sat:0.05, wow:0.08, veil:0.3}, form:{shape:"constante"},
    loops:{lvl:0.18, count:3, inst:"bol", speed:1.3}}, "jardin zen, gammes japonaises"]
];
const UNIVERS = [
  {id:"medieval", name:"Médiéval", items:MEDIEVAL},
  {id:"calme", name:"Calme : travail, sommeil, méditation", items:CALME},
  {id:"espace", name:"Espace", items:ESPACE},
  {id:"orient", name:"Orient et Égypte", items:ORIENT}
];
/* liste à plat : les six premiers gardent leurs numéros (la campagne les référence par position) */
const PRESETS = UNIVERS.flatMap(u=>u.items.map(([n,s,g])=>[n,s,g,u.id]));
function clone(o){return JSON.parse(JSON.stringify(o));}
function merge(a,b){for(const k in b){ if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){ a[k]=merge(a[k]||{},b[k]); } else a[k]=b[k]; } return a;}
let S = clone(DEFAULT);
