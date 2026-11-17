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
    ["enharm","Enharmonique grec ancien",[0,0.5,1,5,7,7.5,8]]]],
  ["Personnel", [
    ["libre","Libre (dessinée sur le cercle)",null]]]
];
const SC = {};
SCALE_GROUPS.forEach(([,l])=>l.forEach(([k,n,iv])=>{SC[k]={n,iv};}));
function ivOf(S,key){
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
  meso:[1,1.04490,1.11803,1.19628,1.25,1.33748,1.39754,1.49535,1.5625,1.67185,1.78885,1.86920]
};
/* tempéraments de clavier : écarts en cents depuis do ; comme sur un orgue accordé ainsi, chaque tonalité a sa couleur */
const WELL={
  werck:[0,90.225,192.18,294.135,390.225,498.045,588.27,696.09,792.18,888.27,996.09,1092.18],
  kirn:[0,90.225,193.157,294.135,386.314,498.045,590.224,696.578,792.18,889.735,996.09,1088.269]
};
function mkFreq(S){
  const rootMidi=36+S.root, rootF=S.a4*Math.pow(2,(rootMidi-69)/12), r=RAT[S.temper]||RAT.egal, W=WELL[S.temper];
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
  drone:{lvl:0.8, timbre:"anche", bright:0.5, width:0.5, drift:0.5, glide:0.5},
  mel:{lvl:0.6, inst:"luth", lpg:0, dens:0.85, reg:0, span:2, leap:0.2, orn:0.15, deja:0, loop:2},
  canon:{lvl:0, inst:"harpe", delay:2, shift:"oct+"},
  pad:{lvl:0.22, timbre:"cordes", len:2, motion:0.5, voices:3, deja:0, loop:2, stag:0.5, bass:0.5},
  loops:{lvl:0, count:3, inst:"carillon", speed:1},
  pend:{lvl:0, count:6, period:24, inst:"carillon"},
  amb:{lvl:1, murmur:0.35, clink:0.5, feu:0.15, vent:0, gouttes:0},
  fx:{rev:0.4, size:2.6, dark:0.5, room:"gen", algo:"vivante", mod:0.5, shim:0, dly:0, dlyDiv:1.5, fb:0.4, sat:0.15, wow:0.12, veil:0.3, hiss:0},
  form:{shape:"constante", period:4, amount:0.5, breath:0.5},
  wx:{place:null, d:null, t:0},
  mach:true,
  daw:{sel:0, grid:1, rec:-1, arp:{on:false, mode:"up", rate:0.5, oct:2, gate:0.7}, mix:{mute:{}, solo:{}, pan:{}}, tracks:[
    {id:1,name:"Piste 1",inst:"atelier",vol:0.8,pan:0,mute:false,solo:false,bars:2,notes:[]},
    {id:2,name:"Piste 2",inst:"luth",vol:0.8,pan:-0.2,mute:false,solo:false,bars:2,notes:[]},
    {id:3,name:"Piste 3",inst:"flute",vol:0.8,pan:0.2,mute:false,solo:false,bars:4,notes:[]}]},
  syn:clone(SYN_DEFAULT),
  mus:{logic:"modal", model:"physique", form:"libre", color:"off", harm:"idiome", arc:"aucun", crit:0.6},
  car:{grav:0.5, aud:0.5, orn:0.5, sil:0.5, rep:0.5},
  chance:{skip:0.08, ratchet:0.07, mutate:0.12, octave:0.05, rest:0.08},
  turing:{lock:0.85, len:2, rate:1},
  drift:[{t:"filtre",t2:"-voile",d:0.3,v:0.3},{t:"densite",t2:"none",d:0.25,v:0.25},{t:"reverb",t2:"grain",d:0.25,v:0.2},{t:"pan",t2:"none",d:0.3,v:0.3}],
  grain:{mix:0, dens:0.45, size:0.5, spread:0.4, pitch:0.3, src:"mel"},
  link:{melPad:0.4},
  adapt:{mode:"off", amount:0.6, span:45},
  play:{lvl:0.8, inst:"", oct:24},
  nature:{pluie:0, mer:0, nuit:0, ruisseau:0, oiseaux:0},
  curve:{mode:"off", dur:6, pts:Array.from({length:96},()=>0.5)}
};
const MEDIEVAL = [
  ["Taberna", {mus:{arc:"arche"}, car:{grav:0.4, aud:0.55, orn:0.7, sil:0.25, rep:0.6}, fx:{room:"salle"}}, "taverne animée"],
  ["Chorea", {car:{grav:0.35, aud:0.65, orn:0.8, sil:0.15, rep:0.7}, mus:{form:"rondeau", arc:"arche"}, seed:218, root:4, scales:["dorien","",""], tempo:138, meter:"6/8", swing:0,
    perc:{lvl:0.55, shaker:0.7, ghost:0.4}, mel:{inst:"flute", dens:0.9, leap:0.3, orn:0.3, reg:1, span:1},
    canon:{lvl:0.35, inst:"harpe", delay:1, shift:"oct+"}, pad:{lvl:0}, amb:{murmur:0.3, clink:0.7, feu:0},
    fx:{rev:0.3, size:2.2, room:"salle", dly:0.18, dlyDiv:1.5, fb:0.35}}, "gigue, danse en rond"],
  ["Crypta", {car:{grav:0.85, aud:0.2, orn:0.2, sil:0.8, rep:0.7}, mus:{form:"passacaille"}, seed:6660, root:2, scales:["phrygien","phrygdom",""], tempo:52, meter:"4/4", swing:0, sectionBars:8,
    perc:{lvl:0}, drone:{lvl:0.95, timbre:"choeur", bright:0.3, width:0.7, drift:0.8, glide:0.7},
    mel:{inst:"carillon", dens:0.25, reg:1, span:2, orn:0.05}, canon:{lvl:0.3, inst:"voix", delay:3, shift:"oct-"},
    pad:{lvl:0.6, timbre:"choeur", len:4, motion:0.7, voices:4}, amb:{murmur:0, clink:0, feu:0, vent:0.35, gouttes:0.6},
    fx:{rev:0.85, size:7, dark:0.7, room:"grotte", dly:0.25, dlyDiv:3, fb:0.5, sat:0.35, wow:0.3, veil:0.55, hiss:0.15},
    loops:{lvl:0.3, count:3, inst:"carillon", speed:1.2},
    form:{shape:"arche", period:5, amount:0.6}}, "crypte froide et humide"],
  ["Scriptorium", {temper:"pyth", car:{grav:0.7, aud:0.25, orn:0.5, sil:0.6, rep:0.55}, mus:{form:"variations", arc:"arche"}, seed:1033, root:9, scales:["eolien","hexacorde",""], tempo:68, meter:"4/4", swing:0,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"orgue"},
    canon:{lvl:0.3, inst:"orgue", delay:2, shift:"q+"}, pad:{lvl:0.4, timbre:"orgue", len:4, motion:0.4, voices:3},
    amb:{murmur:0, clink:0, feu:0.35, vent:0, gouttes:0}, fx:{rev:0.65, size:4.5, dark:0.55, room:"chapelle", sat:0.2, wow:0.2, veil:0.45, hiss:0.1},
    mel:{inst:"flute", dens:0.4, reg:1, span:1, orn:0.1, deja:0.85, loop:3}, loops:{lvl:0.25, count:4, inst:"orgue", speed:1}}, "salle d'écriture des moines"],
  ["Turris", {mus:{arc:"arche"}, car:{grav:0.5, aud:0.5, orn:0.5, sil:0.45, rep:0.45}, seed:77, root:1, scales:["dblharm","lydidom",""], tempo:60, meter:"7/8", swing:0, sectionBars:12,
    perc:{lvl:0.25, shaker:0.3, ghost:0.1}, drone:{lvl:0.85, timbre:"choeur", bright:0.45, width:0.6, drift:0.7, glide:0.6},
    mel:{inst:"harpe", dens:0.5, reg:1, span:2, leap:0.4, orn:0.2}, canon:{lvl:0.35, inst:"carillon", delay:2, shift:"q+"},
    pad:{lvl:0.45, timbre:"machine", len:2, motion:0.8, voices:4}, amb:{murmur:0, clink:0, feu:0.1, vent:0.2, gouttes:0.15},
    fx:{rev:0.7, size:5, dark:0.45, dly:0.3, dlyDiv:1.5, fb:0.45, sat:0.25, wow:0.25, veil:0.4, hiss:0.08},
    pend:{lvl:0.3, count:7, period:20, inst:"harpe"},
    form:{shape:"vagues", period:4, amount:0.6}}, "tour du mage"],
  ["Tripudium", {car:{grav:0.3, aud:0.7, orn:0.8, sil:0.1, rep:0.65}, mus:{form:"rondeau", arc:"arche"}, seed:905, root:7, scales:["hexacorde","ionien",""], tempo:104, meter:"3/4", swing:0.15,
    perc:{lvl:0.6, shaker:0.6, ghost:0.3}, mel:{inst:"luth", dens:0.95, leap:0.15, orn:0.2},
    canon:{lvl:0.3, inst:"flute", delay:2, shift:"t+"}, pad:{lvl:0.15, timbre:"cordes"}, amb:{murmur:0.4, clink:0.6, feu:0.1},
    fx:{rev:0.35, size:2.4, sat:0.12, wow:0.1, veil:0.25}}, "branle, danse à trois temps"]
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
    fx:{rev:0.5, size:3.5, dark:0.5, sat:0.05, wow:0.05, veil:0.4, hiss:0}, form:{shape:"constante"}}, "travail et concentration, motifs répétitifs"]
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
  ["Navigium", {car:{grav:0.45, aud:0.45, orn:0.4, sil:0.45, rep:0.6}, mus:{form:"variations", arc:"arche"}, seed:6006, root:9, scales:["dorien","eolien",""], tempo:66, meter:"12/8", swing:0,
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
    canon:{lvl:0.3, inst:"voix", delay:3, shift:"oct-"}, pad:{lvl:0.35, timbre:"choeur", len:4}, amb:{feu:0.15}, fx:{rev:0.6, size:6, dark:0.8, sat:0.2, veil:0.6}}, "rituel : tambour lent, archet, chœur sourd"],
  ["Cella", {car:{grav:0.8, aud:0.2, orn:0.15, sil:0.8, rep:0.5}, seed:99, root:4, scales:["phrygien","locrien",""], tempo:40, meter:"4/4", tension:0.55,
    perc:{lvl:0}, drone:{lvl:0.7, timbre:"bol", bright:0.15}, mel:{lvl:0.2, inst:"bol", dens:0.06, reg:0, deja:0.2},
    canon:{lvl:0}, pad:{lvl:0.3, timbre:"machine", len:8}, amb:{gouttes:0.6, vent:0.15}, fx:{rev:0.7, size:8, room:"grotte", dark:0.85, veil:0.7, hiss:0.1}}, "cachot humide : gouttes, écho de pierre"]
];
const WESTERN = [
  ["Desertum", {car:{grav:0.5, aud:0.25, orn:0.15, sil:0.85, rep:0.4}, seed:7777, root:4, scales:["dorien","pentmin",""], tempo:70, meter:"4/4", tension:0.4,
    perc:{lvl:0.1, shaker:0, ghost:0.1}, drone:{lvl:0}, mel:{lvl:0.6, inst:"guitare", dens:0.22, reg:1, leap:0.25, orn:0.1, deja:0.3},
    canon:{lvl:0.35, inst:"sifflet", delay:4, shift:"oct+"}, pad:{lvl:0.16, timbre:"grattee", len:4, voices:3}, amb:{vent:0.5},
    fx:{rev:0.45, size:3.2, room:"plaque", algo:"plaque", dly:0.3, dlyDiv:3, fb:0.35, sat:0.2, wow:0.15, veil:0.1}}, "désert de l'Ouest : guitare claire, vent, sifflet"],
  ["Saloon", {car:{grav:0.2, aud:0.85, orn:0.6, sil:0.05, rep:0.5}, mus:{form:"rondeau"}, seed:1881, root:7, scales:["ionien","mixolydien",""], tempo:116, meter:"2/4", swing:0.32,
    perc:{lvl:0.45, shaker:0.5, ghost:0.5}, drone:{lvl:0}, mel:{lvl:0.75, inst:"piano", dens:1, orn:0.35, leap:0.3},
    canon:{lvl:0.25, inst:"harmonica", delay:2, shift:"oct+"}, pad:{lvl:0.12, timbre:"grattee", len:2}, amb:{murmur:0.6, clink:0.7}, fx:{rev:0.2, size:1.6, room:"salle", sat:0.2, wow:0.2}}, "saloon : piano mécanique, harmonica, guitare, chopes, bagarre en vue"],
  ["Duellum", {car:{grav:0.6, aud:0.25, orn:0.1, sil:0.8, rep:0.4}, mus:{arc:"arche"}, seed:1127, root:9, scales:["harm","phrygdom",""], tempo:58, meter:"4/4", tension:0.8,
    perc:{lvl:0.22, shaker:0, ghost:0.1, kit:"taiko"}, drone:{lvl:0.08, timbre:"pur", bright:0.2}, mel:{lvl:0.6, inst:"sifflet", dens:0.14, reg:1, leap:0.35, orn:0.15},
    canon:{lvl:0.3, inst:"guitare", delay:2, shift:"oct-"}, pad:{lvl:0.18, timbre:"cordes", len:6}, amb:{vent:0.25},
    fx:{rev:0.55, size:4.5, room:"plaque", algo:"plaque", dly:0.35, dlyDiv:3, fb:0.4, sat:0.15}}, "duel à midi : un sifflet, une guitare, le battement"],
  ["Equitatus", {car:{grav:0.3, aud:0.75, orn:0.25, sil:0.25, rep:0.7}, mus:{form:"rondeau", arc:"arche"}, seed:4400, root:2, scales:["mixolydien","ionien",""], tempo:116, meter:"6/8", swing:0,
    perc:{lvl:0.55, shaker:0.35, ghost:0.3}, drone:{lvl:0}, mel:{lvl:0.62, inst:"cuivre", dens:0.45, reg:1, leap:0.4, orn:0.1, deja:0.6, loop:2},
    canon:{lvl:0.22, inst:"sifflet", delay:4, shift:"oct+"}, pad:{lvl:0.3, timbre:"grattee", len:2, voices:3, bass:0.7}, amb:{vent:0.2},
    fx:{rev:0.35, size:3.2, room:"plaque", algo:"plaque", dly:0.2, dlyDiv:3, fb:0.25, sat:0.15}}, "chevauchée : galop, guitare battue, trompette, grand ciel"]
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
const UNIVERS = [
  {id:"medieval", name:"Médiéval", tag:"tavernes, cryptes, scriptoriums : le Moyen Âge à la cire et à la bière", items:MEDIEVAL},
  {id:"aventure", name:"Aventure", tag:"combat, voyage, embuscade, victoire : les temps forts d'une partie", items:AVENTURE},
  {id:"pirates", name:"Pirates", tag:"ports, chants de marins, tempêtes et îles au trésor", items:PIRATES},
  {id:"nordique", name:"Nordique", tag:"veillées au feu, tambours de guerre, fjords dans la brume", items:NORDIQUE},
  {id:"feerie", name:"Féerie", tag:"clairières, bals de fées, forêts enchantées, berceuses", items:FEERIE},
  {id:"horreur", name:"Horreur", tag:"fantômes, manoirs hantés, rituels, cachots", items:HORREUR},
  {id:"western", name:"Far West", tag:"déserts, saloons, duels à midi, chevauchées", items:WESTERN},
  {id:"cyber", name:"Cyberpunk", tag:"villes néon, pluie acide, usines, serveurs", items:CYBER},
  {id:"espace", name:"Espace", tag:"étoiles, nébuleuses, gouffres", items:ESPACE},
  {id:"orient", name:"Orient et Égypte", tag:"oud, ney, déserts, quarts de ton", items:ORIENT},
  {id:"nature", name:"Nature", tag:"pluie, mer, forêt, nuit", items:NATURE},
  {id:"calme", name:"Calme", tag:"travail, sommeil, méditation", items:CALME}
];
/* hors du Moyen Âge, un préréglage qui ne cite pas un bruit de lieu n'en veut pas : sans cela, murmure et tintements de taverne s'invitaient dans l'espace ou chez les pirates */
UNIVERS.forEach(u=>{ if(u.id!=="medieval") u.items.forEach(it=>{ it[1].amb=Object.assign({murmur:0,clink:0,feu:0,vent:0,gouttes:0},it[1].amb||{}); }); });
/* sonie : gain (dB) de chaque ambiance, mesuré hors ligne (BS.1770, 24 s, après le limiteur) pour viser -13 LUFS (-15 pour Calme) */
const PRESET_NORM={"Taberna":-3.1,"Chorea":-3.3,"Crypta":-3.6,"Scriptorium":-8.1,"Turris":-3.8,"Tripudium":-2.3,"Pugna":-3.7,"Iter":-3.2,"Triumphus":-3.9,"Insidiae":-0.9,"Portus":0.3,"Navigium":-4.9,"Tempestas":-4.4,"Thesaurus":-5.1,"Skalda":-3.6,"Bellum":-4.2,"Fjordus":-6.0,"Runae":-2.2,"Fata":-5.1,"Aula Fatarum":-5.3,"Sylva Magica":1.3,"Lullaby":2.2,"Larva":-1.9,"Domus Obscura":-6.8,"Sacrificium":-5.3,"Cella":-3.6,"Desertum":2.8,"Saloon":0.6,"Duellum":-6.1,"Equitatus":-2.3,"Urbs Neon":-2.9,"Machina":-0.5,"Datum":-2.1,"Imber Toxicus":-3.5,"Sidera":3.1,"Nebula":-2.0,"Abyssus":-1.6,"Aegyptus":-2.0,"Eremus":-6.0,"Hortus":-5.3,"Bayati":-2.1,"Enharmonia":0.6,"Pluvia":-1.0,"Mare":-0.2,"Silva":-2.2,"Nox":1.6,"Somnus":-1.2,"Meditatio":-1.9,"Labor":-2.9};
/* chaque univers a sa batterie ; un préréglage peut en citer une autre */
const UNIV_KIT={medieval:"cadre", aventure:"caisse", pirates:"cadre", nordique:"taiko", feerie:"cadre", horreur:"taiko", western:"bastringue", cyber:"electro", espace:"electro", orient:"darbouka", nature:"cadre", calme:"cadre"};
const UNIV_EUCL={cyber:0.5, orient:0.35};
UNIVERS.forEach(u=>u.items.forEach(it=>{ const p=it[1]; p.perc=Object.assign({kit:UNIV_KIT[u.id]||"cadre", eucl:UNIV_EUCL[u.id]||0},p.perc||{}); if(p.norm===undefined) p.norm=PRESET_NORM[it[0]]||0; }));
/* liste à plat des préréglages */
const PRESETS = UNIVERS.flatMap(u=>u.items.map(([n,s,g])=>[n,s,g,u.id]));
function clone(o){return JSON.parse(JSON.stringify(o));}
function merge(a,b){for(const k in b){ if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){ a[k]=merge(a[k]||{},b[k]); } else a[k]=b[k]; } return a;}
let S = clone(DEFAULT);

/* d'anciennes scènes n'ont que quatre emplacements de modulation : on complète jusqu'à huit */
function normS(){ if(Array.isArray(S.drift)) S.drift.forEach(w=>{ if(w&&w.t2===undefined) w.t2="none"; }); if(S.syn&&S.syn.mod){ const dm=SYN_DEFAULT.mod; while(S.syn.mod.length<8) S.syn.mod.push({...dm[S.syn.mod.length]}); } return S; }

/* chaque lecture, chaque rendu : une pièce nouvelle (la graine reste interne, pour garder les stems alignés) */
const newSeed=()=>1+Math.floor(Math.random()*4294967000);
