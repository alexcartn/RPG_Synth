"use strict";
/* ============================================================
   TABLE DE MONTAGE : la machine ouverte, en pedalboard.
   Le son se lit de gauche à droite : les voix, les pédales posées sur chacune, leurs envois, les salles et échos partagés,
   le master, les sorties ; au-dessus l'intention et l'écriture (ce qui est joué), en dessous les mouvements (ce qui bouge sur des minutes).
   Rien n'est dupliqué : chaque réglage affiché ici pilote la vraie commande de Composer, qui reste la seule source,
   comme le pupitre. La table est exhaustive par construction : montMissing() liste les réglages de Composer qui n'auraient
   pas de place ici, et le test d'interface échoue s'il en reste un.
   ============================================================ */
const MT={built:false, sel:"v:drone", cat:null, catLane:null, mem:{}, ac:null, raf:0, soon:0};
const mtNum=k=>+getP(k)||0;
const mtPct=v=>Math.round(v*100)+" %";
/* poser une valeur par la vraie commande : relance, replanification et réverbération suivent comme dans Composer */
function mtSet(k,v){
  const el=ctlEl(k);
  if(!el){ setP(k,v); if(live) live.eng.setLevels(); return; }
  el.value=String(v);
  if(el.tagName==="SELECT") el.dispatchEvent(new Event("change"));
  else { el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); }
}
/* le libellé court de l'option choisie (« Chœur » plutôt que « Chœur : formants de voyelles… ») */
function mtOpt(k){ const el=ctlEl(k); if(!el||el.tagName!=="SELECT") return ""; const o=el.options[el.selectedIndex]; return o?o.textContent.split(" : ")[0].replace(/\s*\(.*\)$/,""):""; }

/* ---------- 1. les voix ---------- */
const MT_VOIX=[
 {id:"drone",n:"Bourdon",bus:"drone",g:"g-drone",lv:["drone.lvl"],inst:"drone.timbre",keys:["drone.lvl","drone.timbre","drone.bright","drone.glide","drone.width","drone.drift"],plug:{"drone.lvl":0.5},
  d:"La note tenue sous tout le reste : la tonique et sa quinte, qui dérivent lentement. Le grave de la pièce lui appartient.",a:["mystérieux","sacré","fataliste","transcendant"]},
 {id:"tex",n:"Textures",bus:null,g:"g-drone",lv:["tex.sub","tex.mid","tex.air"],keys:["tex.sub","tex.mid","tex.air"],plug:{"tex.sub":0.4,"tex.air":0.2},
  d:"Trois couches continues, une par bande : un grondement sous 90 Hz, la pierre qui chante (des résonateurs étroits accordés sur la tonique), l'air. Le grondement n'entre jamais dans la réverbération.",a:["mystérieux","inquiétant","transcendant"]},
 {id:"mel",n:"Mélodie",bus:"mel",g:"g-mel",lv:["mel.lvl"],inst:"mel.inst",keys:["mel.lvl","mel.inst","mel.dens","mel.reg","mel.span"],plug:{"mel.lvl":0.5},
  d:"La voix qui chante. La machine tire plusieurs phrases et garde la meilleure ; son caractère, sa mémoire et sa part de hasard se règlent dans Écriture.",a:["héroïque","nostalgique","tendre","joyeux"]},
 {id:"plain",n:"Plain-chant",bus:"plain",g:"g-plain",lv:["plain.lvl"],inst:"chant",keys:["plain.lvl","chant","plain.reg"],plug:{"plain.lvl":0.4},
  d:"De vrais airs grégoriens, chantés en latin, posés dans la gamme de la pièce.",a:["sacré","transcendant","fataliste"]},
 {id:"canon",n:"Canon",bus:"mel",g:"g-canon",lv:["canon.lvl"],inst:"canon.inst",keys:["canon.lvl","canon.inst","canon.delay","canon.shift"],plug:{"canon.lvl":0.3},
  d:"La mélodie reprise en retard par un second instrument, transposée. Il partage les envois de la mélodie.",a:["majestueux","mystérieux"]},
 {id:"pad",n:"Nappes",bus:"pad",g:"g-pad",lv:["pad.lvl"],inst:"pad.timbre",keys:["pad.lvl","pad.timbre","pad.len","pad.motion","pad.voices","pad.stag","pad.bass","pad.bassOct"],plug:{"pad.lvl":0.25},
  d:"Les accords tenus, voix décalées, avec une basse si on veut. Chaque note de la mélodie peut ouvrir leur filtre (Mouvements, lien).",a:["serein","majestueux","mélancolique"]},
 {id:"arp",n:"Arpège",bus:"arp",g:"g-arp",lv:["arp.lvl"],inst:"arp.inst",keys:["arp.lvl","arp.inst","arp.pat","arp.rate","arp.reg","arp.span"],plug:{"arp.lvl":0.3},
  d:"L'accord en cours égrené : va-et-vient, montant, Alberti, ou le registre de Turing.",a:["nostalgique","féerique","joyeux"]},
 {id:"perc",n:"Percussion",bus:"perc",g:"g-perc",lv:["perc.lvl"],inst:"perc.kit",keys:["perc.lvl","perc.kit","perc.shaker","perc.ghost","perc.eucl"],plug:{"perc.lvl":0.4},
  d:"Tambours, shaker et frappes fantômes, en rythme euclidien si on veut. Elle a sa petite pièce, claire et courte.",a:["sauvage","héroïque","puissant"]},
 {id:"loops",n:"Boucles",bus:"loops",g:"g-loops",lv:["loops.lvl"],inst:"loops.inst",keys:["loops.lvl","loops.inst","loops.count","loops.speed"],plug:{"loops.lvl":0.3},
  d:"Des motifs de longueurs différentes qui tournent et se décalent, à la manière d'Eno.",a:["serein","mystérieux","nostalgique"]},
 {id:"pend",n:"Pendules",bus:"pend",g:"g-pend",lv:["pend.lvl"],inst:"pend.inst",keys:["pend.lvl","pend.inst","pend.count","pend.period"],plug:{"pend.lvl":0.3},
  d:"Des pendules de longueurs différentes qui se déphasent puis se retrouvent à l'unisson.",a:["mystérieux","transcendant"]},
 {id:"bille",n:"Billes",bus:"bille",g:"g-bille",lv:["bille.lvl"],inst:"bille.inst",keys:["bille.lvl","bille.inst","bille.count","bille.haut","bille.rebond","bille.pause","bille.travers","bille.mode"],plug:{"bille.lvl":0.3},
  d:"Des billes lâchées qui rebondissent : chaque rebond est une note, de plus en plus rapprochée et douce.",a:["féerique","serein","tendre"]},
 {id:"arbre",n:"Arbre",bus:"arbre",g:"g-arbre",lv:["arbre.lvl"],inst:"arbre.inst",keys:["arbre.lvl","arbre.inst","arbre.prof","arbre.vent","arbre.pousse","arbre.lecture","arbre.harm"],plug:{"arbre.lvl":0.3},
  d:"Un arbre qui pousse par grammaire de Lindenmayer ; le vent fait tinter ses feuilles, on peut aussi lire une branche comme une mélodie.",a:["féerique","mystérieux"]},
 {id:"nuee",n:"Nuée",bus:"nuee",g:"g-nuee",lv:["nuee.lvl"],inst:"nuee.mat",keys:["nuee.lvl","nuee.mat","nuee.dens","nuee.vie","nuee.disp","nuee.grav","nuee.sources","nuee.haut","nuee.harm"],plug:{"nuee.lvl":0.3},
  d:"Des particules de son qui jaillissent et retombent, d'après Emit.",a:["étrange","transcendant"]},
 {id:"lieu",n:"Salle",bus:"amb",g:"ch-V",lv:["amb.murmur","amb.clink","amb.feu","amb.vent","amb.gouttes","amb.marque"],keys:["amb.murmur","amb.clink","amb.feu","amb.vent","amb.gouttes","amb.marqueSon","amb.marque"],plug:{"amb.feu":0.3},
  d:"Le lieu autour de la musique : murmure, verres, feu, vent, gouttes, et un marqueur propre à l'univers. Feu, vent et pluie sont fabriqués à chaque échantillon, sans boucle, toujours bien sous la musique.",a:["nostalgique","serein","joyeux"]},
 {id:"nature",n:"Nature",bus:"amb",g:"ch-V",lv:["nature.pluie","nature.mer","nature.nuit","nature.ruisseau","nature.oiseaux","nature.grenouilles","nature.hibou","nature.loup","nature.corbeaux","nature.chevaux","nature.mouettes"],
  keys:["nature.pluie","nature.mer","nature.nuit","nature.ruisseau","nature.oiseaux","nature.grenouilles","nature.hibou","nature.loup","nature.corbeaux","nature.chevaux","nature.mouettes"],plug:{"nature.pluie":0.3},
  d:"Pluie, mer, nuit, ruisseau, et des bêtes qui se placent dans les silences de la mélodie et dans leur bande de fréquences.",a:["serein","inquiétant","mystérieux"]}
];
const mtVoix=id=>MT_VOIX.find(v=>v.id===id);
const mtOn=v=>v.lv.some(k=>mtNum(k)>0.001);
function mtLevel(v){ return v.lv.length===1?mtNum(v.lv[0]):Math.max(...v.lv.map(mtNum)); }
function mtInst(v){
  if(v.inst) return mtOpt(v.inst);
  const on=v.lv.filter(k=>mtNum(k)>0.001).map(k=>{ const c=CTL.find(x=>x.it.k===k); return c?c.it.label.replace(/^Texture : /,"").split(" (")[0].toLowerCase():k; });
  return on.length?on.slice(0,3).join(" · ")+(on.length>3?" …":""):"rien";
}

/* ---------- 2. les pédales, posées sur une voix ---------- */
/* une voix, ou « master » pour tout le mélange : le nom du bus du moteur */
const mtBusOf=l=>l==="master"?"master":((mtVoix(l)||{}).bus||"");
const mtLaneName=l=>l==="master"?"tout le mélange":((mtVoix(l)||{}).n||l);
/* une pédale de genre unique (une de chaque) : posée sur une seule voix à la fois, ou sur tout le mélange */
function mtPedGen(id,n,keys,sub,d,o,a){
  return {id,n,lanes:"bus",keys:[id+".src",id+".mix"].concat(keys),sub,d,o,a,
    has:l=>getP(id+".src")===mtBusOf(l)&&mtNum(id+".mix")>0.001,
    plugP:l=>Object.assign({[id+".src"]:mtBusOf(l)},mtNum(id+".mix")>0.001?{}:{[id+".mix"]:0.6}),
    unplug:()=>mtSet(id+".src","aucune"), where:()=>getP(id+".src")};
}
/* une pédale peut-elle aller sur cette voix ? */
function mtPedLanes(p,l){ if(p.soon) return false; if(p.lanes==="bus"){ if(l==="master") return true; const v=mtVoix(l); return !!(v&&v.bus&&v.bus!=="amb"); } return l!=="master"&&p.lanes.includes(l); }
const MT_PED=[
 {id:"fuzz",n:"Fuzz",lanes:["drone","pad"],keys:["fuzz.mix","fuzz.amt","fuzz.tone","fuzz.src"],
  has:l=>mtNum("fuzz.mix")>0.001&&(getP("fuzz.src")==="les deux"||getP("fuzz.src")===(l==="drone"?"bourdon":"nappes")),
  plugP:l=>mtNum("fuzz.mix")>0.001?{"fuzz.src":"les deux"}:{"fuzz.src":l==="drone"?"bourdon":"nappes","fuzz.mix":0.6},
  unplug:l=>{ if(getP("fuzz.src")==="les deux") mtSet("fuzz.src",l==="drone"?"nappes":"bourdon"); else mtSet("fuzz.mix",0); },
  sub:()=>"gain "+mtPct(mtNum("fuzz.amt"))+" · tonalité "+mtPct(mtNum("fuzz.tone")),
  d:"Plusieurs étages de gain, le filtre de tonalité, un écrêtage dur. Tout en bas, il ne reste que le filtre : la wah bloquée. Le volume est rattrapé tout seul. Un seul réglage pour le bourdon et les nappes.",o:"D'après la Fuzz War de Death By Audio.",a:["sauvage","inquiétant","puissant"]},
 {id:"lpg",n:"Porte passe-bas",lanes:["mel","canon","loops","pend"],keys:["mel.lpg"],has:()=>mtNum("mel.lpg")>0.001,plugP:()=>({"mel.lpg":0.5}),unplugP:()=>({"mel.lpg":0}),
  sub:()=>"fermeture "+mtPct(mtNum("mel.lpg")),
  d:"Sur les sons pincés et frappés, le filtre se referme avec le son, qui devient boisé et rond. Une seule porte pour la mélodie, le canon, les boucles et les pendules.",o:"D'après les portes basse fréquence de Buchla.",a:["nostalgique","tendre"]},
 {id:"ens",n:"Ensemble",lanes:["drone","pad"],keys:[],tk:l=>l==="drone"?"drone.timbre":"pad.timbre",
  has:l=>getP(l==="drone"?"drone.timbre":"pad.timbre")==="machine",
  plugP:l=>{ const k=l==="drone"?"drone.timbre":"pad.timbre"; if(getP(k)!=="machine") MT.mem[k]=getP(k); return {[k]:"machine"}; },
  unplug:l=>{ const k=l==="drone"?"drone.timbre":"pad.timbre", m=MT.mem[k]; mtSet(k,m&&m!=="machine"?m:(l==="drone"?"anche":"cordes")); },
  sub:()=>"timbre « machine »",
  d:"Le chorus des machines à cordes : trois lignes balancées à gauche, au centre, à droite. Il vient avec le timbre « machine » de la voix.",o:"D'après les machines à cordes des années 1970.",a:["nostalgique","majestueux"]},
 mtPedGen("fgun","Fuzz à porte",["fgun.amt","fgun.bias","fgun.dens","fgun.filt","fgun.mode"],()=>mtOpt("fgun.mode").toLowerCase()+" · fuzz "+mtPct(mtNum("fgun.amt")),
  "Une fuzz dont la porte crache sur les fins de note, au biais déréglé, ou qui oscille toute seule. Une seule fuzz à porte : posée ailleurs, elle se déplace.","D'après la Supersonic Fuzz Gun de Death By Audio.",["sauvage","inquiétant","étrange"]),
 mtPedGen("cross","Fuzz à deux bandes",["cross.freq","cross.res","cross.gain","cross.bal"],()=>"gain "+mtPct(mtNum("cross.gain"))+" · résonance "+mtPct(mtNum("cross.res")),
  "Le grave et l'aigu séparés, chacun saturé de son côté, avec une résonance au croisement.","D'après la Crossover Fuzz de Death By Audio.",["sauvage","puissant"]),
 mtPedGen("bits","8 bits",["bits.rate","bits.bits"],()=>"puce "+mtPct(mtNum("bits.rate"))+" · finesse "+mtPct(mtNum("bits.bits")),
  "Moins d'échantillons, moins de bits : le repliement des vieilles puces, des marches dans le son.","D'après la Robot de Death By Audio.",["étrange","nostalgique"]),
 mtPedGen("filt","Filtre résonant",["filt.freq","filt.res","filt.mode","filt.drive","filt.sweep"],()=>mtOpt("filt.mode").toLowerCase()+(mtNum("filt.sweep")>0.01?" · balayé":""),
  "Passe-bas, passe-bande ou passe-haut, résonance jusqu'au sifflement, un drive avant, et un balayage lent qui le fait respirer.","D'après l'Evil Filter de Death By Audio.",["étrange","inquiétant","mystérieux"])
];
const mtPed=id=>MT_PED.find(p=>p.id===id);

/* ---------- 4. salles et échos partagés ---------- */
const MT_SP=[
 {id:"rev",n:"Réverbération",keys:["fx.rev","fx.room","fx.size","fx.dark","fx.algo","fx.rmode","fx.rfr","fx.rdp","fx.mod","fx.shim"],has:()=>mtNum("fx.rev")>0.001,plugP:()=>({"fx.rev":0.4}),unplugP:()=>({"fx.rev":0}),
  sub:()=>{ const a=getP("fx.algo"); return mtOpt("fx.algo")+(a==="chambres"?", "+mtOpt("fx.rmode").toLowerCase():"")+" · "+(+getP("fx.size")).toFixed(1).replace(".",",")+" s"; },
  d:"La grande salle. Cinq types : vivante (la queue bouge et peut scintiller), lieu (acoustique figée), plaque, salle, et chambres, six modes façon pédale (pièce, écho, crête, porte et gel, onde, gong).",o:"Chambres : d'après la Rooms de Death By Audio. Plaque et salle : Dattorro.",a:["mystérieux","majestueux","transcendant","sacré"]},
 {id:"echo",n:"Écho",keys:["fx.dly","fx.dlyDiv","fx.fb"],has:()=>mtNum("fx.dly")>0.001,plugP:()=>({"fx.dly":0.25}),unplugP:()=>({"fx.dly":0}),
  sub:()=>mtOpt("fx.dlyDiv").toLowerCase()+" · "+mtPct(mtNum("fx.fb"))+" de répétitions",
  d:"Un écho de gauche à droite, calé sur le tempo, qui s'assombrit à chaque répétition.",o:"",a:["nostalgique","mystérieux","féerique"]},
 {id:"grains",n:"Nuage de grains",keys:["grain.mix","grain.src","grain.dens","grain.size","grain.spread","grain.pitch"],has:()=>mtNum("grain.mix")>0.001,plugP:()=>({"grain.mix":0.3}),unplugP:()=>({"grain.mix":0}),
  sub:()=>"mélange "+mtPct(mtNum("grain.mix"))+" · "+mtOpt("grain.src").toLowerCase(),acts:[["Geler le nuage","jeuGel"]],
  d:"Le son récent relu en petits grains, parfois à l'octave ou à la quinte. Gelé, il garde ce qu'il vient d'entendre et le fait tourner.",o:"",a:["étrange","mélancolique","transcendant"]},
 {id:"zr",n:"Écho zone rouge",keys:["zr.mix","zr.div","zr.fb","zr.mdep","zr.mspd","zr.shape","zr.fuzz"],has:()=>mtNum("zr.mix")>0.001,plugP:()=>({"zr.mix":0.3}),unplug:()=>mtSet("zr.mix",0),
  sub:()=>mtOpt("zr.div").toLowerCase()+" · "+mtPct(mtNum("zr.fb"))+" de répétitions",
  d:"Un écho qui reçoit les mêmes envois que l'écho. Plus il est long, plus la puce est poussée : grain, repliement, souffle ; ses répétitions peuvent s'emballer jusqu'à l'oscillation, et passer dans une fuzz.",o:"D'après l'Echo Dream 2 et la Micro Dream de Death By Audio.",a:["nostalgique","mystérieux","étrange"]},
 {id:"ressort",n:"Ressort saturé",keys:["spr.mix","spr.alt","spr.tone","spr.decay"],has:()=>mtNum("spr.mix")>0.001,plugP:()=>({"spr.mix":0.3}),unplug:()=>mtSet("spr.mix",0),
  sub:()=>"altitude "+mtPct(mtNum("spr.alt"))+" · "+mtOpt("spr.tone").toLowerCase(),
  d:"Trois ressorts d'ampli, poussés dans le rouge, sombres ou clairs. Il reçoit les mêmes envois que la grande salle et s'y ajoute.",o:"D'après la Reverberation Machine de Death By Audio.",a:["inquiétant","sauvage","nostalgique"]}
];
/* ---------- 5. master et 6. sorties : toujours là ---------- */
const MT_MS=[
 {id:"patine",n:"Patine de bande",keys:["fx.sat","fx.wow","fx.veil","fx.hiss"],sub:()=>"saturation "+mtPct(mtNum("fx.sat"))+" · voile "+mtPct(mtNum("fx.veil")),
  d:"Saturation douce, pleurage et scintillement de bande, voile des aigus, souffle. La couleur de la vieille cassette.",o:""},
 {id:"voix",n:"Place pour la voix",keys:["fx.voix"],sub:()=>mtNum("fx.voix")>0.001?"creux de "+(6*mtNum("fx.voix")).toFixed(1).replace(".",",")+" dB":"aucun creux",
  d:"Creuse doucement le médium vers 1,9 kHz pour que la musique passe sous la voix du meneur sans la couvrir.",o:""},
 {id:"vol",n:"Volume et qualité",keys:["vol"],dom:[["quality","Qualité audio"]],sub:()=>mtPct(mtNum("vol"))+" · "+(($("quality")||{}).value==="eco"?"économe":"haute qualité"),
  d:"Le volume général et la qualité du calcul. Économe : toutes les réverbérations sur le réseau le plus léger, conseillé sur téléphone. L'export reste toujours en haute qualité.",o:""},
 {id:"dyn",n:"Compresseur et limiteur",keys:[],sub:()=>"sonie "+((S.norm||0)>=0?"+":"")+(+(S.norm||0)).toFixed(1).replace(".",",")+" dB",
  d:"Un compresseur doux tient l'ensemble, puis le gain de sonie ramène chaque ambiance vers -13 LUFS, et le limiteur rattrape les crêtes. Réglés une fois pour toutes, mesurés hors ligne pour chaque ambiance.",o:"Sonie mesurée en BS.1770."}
];
const MT_OUT=[
 {id:"ecoute",n:"Écoute",keys:[],dom:[["sleep","Extinction"]],acts:[["Jouer ou arrêter","play"],["Veillée","veilBtn"]],sub:()=>live?"en lecture":"à l'arrêt",
  d:"Le son dans le navigateur, même écran éteint sur téléphone. La Veillée montre la machine en grand ; l'extinction baisse doucement jusqu'au silence.",o:""},
 {id:"table",n:"À la table",keys:[],dom:[["voixDepth","Effacement"],["voixSens","Sensibilité du micro"]],acts:[["Sous la voix","voixUnder"],["Micro : s'effacer quand je parle","voixMicBtn"]],sub:()=>"sous la voix, micro",
  d:"Pour jouer en partie : la musique recule d'environ 9 dB sous la voix du meneur, au bouton ou au micro. Rien n'est enregistré ni envoyé.",o:""},
 {id:"capture",n:"Capture",keys:[],dom:[["capFmt","Format"]],acts:[["Capturer","capBtn"]],sub:()=>mtOptDom("capFmt"),
  d:"Garde une prise de ce que tu entends, pendant la lecture.",o:""},
 {id:"export",n:"Export",keys:[],dom:[["dur","Durée"],["fmt","Format audio"],["xLoop","Boucle"],["xStems","Pistes séparées"],["xMidi","MIDI"],["xTun","Micro-intervalles en MIDI"]],acts:[["Rendre et exporter","exp"]],sub:()=>mtOptDom("fmt"),
  d:"Rendu hors ligne avec la graine et les réglages actuels : WAV, MP3, MIDI, boucle sans couture ou une piste par voix. Le suivi s'affiche dans Composer, chapitre VI.",o:""},
 {id:"scenes",n:"Ambiances enregistrées",keys:[],dom:[["fade","Fondu entre deux ambiances"],["enchMode","Point de sortie"],["enchSting","Signal au changement"]],acts:[["Enregistrer cette table","saveScene"]],sub:()=>getScenes().length+" enregistrée"+(getScenes().length>1?"s":""),
  d:"Ta table devient une ambiance à toi, rappelée en fondu enchaîné (dans la marge de Composer, Scènes). Le changement d'ambiance peut attendre la fin de la mesure, de la phrase ou le retour à la tonique, avec un signal. Le code de partage est dans l'export.",o:""}
];
function mtOptDom(id){ const el=$(id); if(!el||el.tagName!=="SELECT") return ""; const o=el.options[el.selectedIndex]; return o?o.textContent.split(" (")[0]:""; }

/* ---------- au-dessus : l'écriture ---------- */
const MT_EC=[
 {id:"fond",n:"Fondations",keys:["root","scales.0","scales.1","scales.2","sectionBars","temper","a4"],g:"ch-I",sub:()=>NOTES[S.root]+" "+mtOpt("scales.0").toLowerCase(),
  d:"La tonalité, les gammes qui se succèdent section par section, la durée d'une section, le tempérament et le diapason. La gamme dessinée et l'import Scala sont dans le cercle des hauteurs (Composer, marge).",o:""},
 {id:"pulse",n:"Pulsation",keys:["tempo","meter","swing"],sub:()=>S.tempo+" · "+S.meter,d:"Tempo, mesure, swing.",o:""},
 {id:"logique",n:"Logique",keys:["mus.logic","mus.model","mus.crit","mus.expr"],sub:()=>mtOpt("mus.logic").toLowerCase(),
  d:"Comment la machine compose : modale (la mélodie suit les accords) ou corpus (des airs anciens appris par chaîne de Markov) ; modèles physiques ; exigence (plusieurs phrases tirées, la meilleure gardée) ; jeu expressif.",o:"Corpus : d'après Charles Ames. Jeu expressif : règles du KTH.",a:["nostalgique","sacré"]},
 {id:"harmonie",n:"Harmonie",keys:["mus.harm","mus.tharm","mus.cine","mus.cineAmt"],sub:()=>mtOpt("mus.harm").toLowerCase()+(getP("mus.cine")&&getP("mus.cine")!=="off"?" · cinéma":""),
  d:"Les enchaînements du genre ou libres ; la tension harmonique éloigne les accords de la tonique quand la tension monte ; l'harmonie de cinéma (médiantes chromatiques pour le merveilleux, pôle hexatonique pour la menace).",o:"Cinéma : d'après Frank Lehman.",a:["inquiétant","féerique","majestueux"]},
 {id:"caractere",n:"Caractère",keys:["car.grav","mel.leap","car.aud","mel.orn","car.orn","car.sil"],sub:()=>"gravité "+mtPct(mtNum("car.grav")),
  d:"Le caractère de la mélodie : retour vers la tonique, sauts, ornements, souffles entre les notes.",o:""},
 {id:"memoire",n:"Mémoire",keys:["mel.deja","car.rep","mel.loop","pad.deja","pad.loop"],sub:()=>"retour du passé "+mtPct(mtNum("mel.deja")),
  d:"Ce qui revient : phrases déjà jouées, boucles de mélodie et de nappes.",o:""},
 {id:"hasard",n:"Hasard",keys:["chance.skip","chance.ratchet","chance.mutate","chance.octave","chance.rest"],sub:()=>"mutations "+mtPct(mtNum("chance.mutate")),
  d:"Notes manquantes, roulements, mutations de degré, sauts d'octave, silences imprévus. Actif par défaut, à petites doses.",o:"",a:["étrange","sauvage"]},
 {id:"turing",n:"Registre de Turing",keys:["turing.lock","turing.len","turing.rate"],sub:()=>"verrou "+mtPct(mtNum("turing.lock")),
  d:"Une boucle de notes qui mute plus ou moins : sert à la forme Turing et à l'arpège Turing.",o:"D'après la Turing Machine de Music Thing Modular.",a:["étrange","mystérieux"]},
 {id:"synthe",n:"Synthé perso",keys:[],acts:[["Ouvrir Forger","mode:atelier"]],sub:()=>"forgé dans l'atelier",
  d:"Ton propre synthé, construit dans Forger (oscillateurs, filtres, enveloppes, modulations, effets). Choisis « Synthé perso » comme instrument d'une voix pour que la machine le joue.",o:""},
 {id:"gestes",n:"Gestes",keys:[],acts:[["Suspense","g:suspense"],["Révélation","g:revelation"],["Apaisement","g:apaisement"],["Surprise","g:surprise"],["Figer","jeuFreeze"],["Autre phrase","jeuReroll"]],sub:()=>"en direct",
  d:"Posés sur la prochaine noire, pendant la lecture : suspense, révélation, apaisement, surprise. Figer garde la phrase en boucle, Autre phrase en tire une nouvelle.",o:""}
];
/* ---------- en dessous : les mouvements ---------- */
const MT_MO=[
 {id:"tension",n:"Tension",keys:["tension"],always:true,sub:()=>tensionWord(mtNum("tension")),d:"Nervosité et dissonance de la pièce. Une courbe ou l'adaptation peuvent la faire bouger toute seule.",o:""},
 {id:"forme",n:"Forme",keys:["mus.mode","mus.form","mus.arc"],always:true,sub:()=>mtOpt("mus.form").toLowerCase()+(getP("mus.mode")==="piece"?" · pièce":""),
  d:"Veillée (sans fin) ou pièce (intro, thème, développement, apogée, retombée, coda, puis fin) ; la forme (libre, rondeau, passacaille, variations, estampie, Turing…) ; le plan en arche.",o:"",a:["majestueux","héroïque"]},
 {id:"resp",n:"Respiration",keys:["form.shape","form.period","form.amount","form.breath"],has:()=>getP("form.shape")!=="constante",plugP:()=>({"form.shape":"vagues"}),unplugP:()=>({"form.shape":"constante"}),
  sub:()=>mtOpt("form.shape").toLowerCase(),d:"L'énergie qui monte et descend sur quelques minutes : arche, vagues ou escalier.",o:"",a:["mélancolique","serein"]},
 {id:"courbe",n:"Courbe de tension",keys:["curve.mode","curve.dur"],g:"ch-IV",has:()=>getP("curve.mode")!=="off",plugP:()=>({"curve.mode":"loop"}),unplugP:()=>({"curve.mode":"off"}),
  sub:()=>mtOpt("curve.mode").toLowerCase()+" · "+(+getP("curve.dur"))+" min",d:"Une courbe de tension dessinée à la main (Composer, chapitre IV), jouée une fois ou en boucle.",o:"",a:["inquiétant","majestueux"]},
 {id:"adapt",n:"Adaptation",keys:["adapt.mode","adapt.amount","adapt.span"],g:"ch-IV",has:()=>getP("adapt.mode")!=="off",plugP:()=>({"adapt.mode":"apaiser"}),unplugP:()=>({"adapt.mode":"off"}),
  sub:()=>mtOpt("adapt.mode").toLowerCase(),d:"L'énergie suit l'heure de la journée et la météo du lieu, ou s'apaise au fil de l'écoute.",o:"",a:["serein"]},
 {id:"couleur",n:"Couleur du mode",keys:["mus.color"],has:()=>getP("mus.color")!=="off",plugP:()=>({"mus.color":"tension"}),unplugP:()=>({"mus.color":"off"}),
  sub:()=>mtOpt("mus.color").toLowerCase(),d:"La gamme glisse du plus clair (lydien) au plus sombre (locrien) avec la tension ou la météo.",o:"",a:["étrange","mélancolique","tragique"]},
 {id:"lien",n:"Mélodie → nappes",keys:["link.melPad"],has:()=>mtNum("link.melPad")>0.001,plugP:()=>({"link.melPad":0.4}),unplugP:()=>({"link.melPad":0}),
  sub:()=>mtPct(mtNum("link.melPad")),d:"Chaque note de la mélodie ouvre le filtre des nappes, qui se referme ensuite. Actif par défaut.",o:"",a:["tendre","nostalgique"]}
].concat([0,1,2,3].map(i=>({id:"drift"+i,n:"Dérive "+(i+1),keys:["drift."+i+".t","drift."+i+".t2","drift."+i+".d","drift."+i+".v"],
  has:()=>mtNum("drift."+i+".d")>0.001&&getP("drift."+i+".t")!=="none",plugP:()=>Object.assign(getP("drift."+i+".t")==="none"?{["drift."+i+".t"]:"filtre"}:{},{["drift."+i+".d"]:0.3}),unplug:()=>mtSet("drift."+i+".d",0),
  sub:()=>mtOpt("drift."+i+".t").toLowerCase()+(getP("drift."+i+".t2")&&getP("drift."+i+".t2")!=="none"?" et "+mtOpt("drift."+i+".t2").toLowerCase():""),
  d:"Une marche aléatoire lente qui promène un réglage, et une seconde cible dans le même sens ou à l'envers. Les quatre dérives sont actives par défaut.",o:"",a:["mélancolique","serein","mystérieux"]})));

/* exhaustivité : tous les réglages de Composer ont une place sur la table */
function montMissing(){
  const all=new Set(["tension"]); UI.forEach(ch=>ch.groups.forEach(g=>g.items.forEach(it=>all.add(it.k))));
  const cov=new Set(); [MT_VOIX,MT_PED,MT_SP,MT_MS,MT_OUT,MT_EC,MT_MO].forEach(L=>L.forEach(b=>(b.keys||[]).forEach(k=>cov.add(k))));
  return [...all].filter(k=>!cov.has(k));
}
function montKeyCount(){ const s=new Set(); [MT_VOIX,MT_PED,MT_SP,MT_MS,MT_OUT,MT_EC,MT_MO].forEach(L=>L.forEach(b=>{ (b.keys||[]).forEach(k=>s.add(k)); (b.dom||[]).forEach(d=>s.add("#"+d[0])); })); return s.size; }

/* ---------- construction ---------- */
const mtEl=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!==undefined) e.textContent=txt; return e; };
function buildMontage(){
  if(MT.built) return; MT.built=true;
  const host=document.querySelector(".folio"), sec=mtEl("section","montage"); sec.id="montage"; sec.hidden=true; sec.setAttribute("aria-label","Table de montage");
  sec.innerHTML=
   '<header class="mt-head"><div class="mt-title"><h2>Table de montage</h2><p class="mt-sub">Le son se lit de gauche à droite. Touche un bloc pour le régler, « + » pour en brancher un autre.</p></div>'+
   '<div class="mt-keys"><label class="mt-amb"><span>Ambiance</span><select id="mtAmb"></select></label><button class="seal mt-play" id="mtPlay" type="button" aria-pressed="false">Jouer</button></div></header>'+
   '<div class="mt-band mt-int"><span class="mt-lab">Intention<small>les émotions marquent les blocs qui leur vont</small></span><div class="mt-chips" id="mtChips" role="group" aria-label="Émotions"></div>'+
   '<button class="lnk" id="mtPropose" type="button" title="Charge l\'ambiance de l\'univers qui va le mieux avec les émotions choisies, comme dans Conduire">Proposer une ambiance</button></div>'+
   '<div class="mt-band mt-pal"><span class="mt-lab">Palette<small id="mtPalU"></small></span><div class="mt-chips" id="mtPal" role="group" aria-label="Palette de l\'univers"></div></div>'+
   '<div class="mt-band mt-ecr"><span class="mt-lab">Écriture<small>ce qui est joué</small></span><div class="mt-row" id="mtEcr"></div></div>'+
   '<p class="mt-count" id="mtCount" aria-live="polite"></p>'+
   '<div class="mt-body"><div class="mt-flow">'+
    '<section class="mt-lanes" aria-label="Voix, pédales et envois"><div class="mt-cols" aria-hidden="true"><span>1 · Voix</span><span>2 · Pédales</span><span>3 · Envois</span></div><div id="mtLanes"></div>'+
     '<button class="mt-add" id="mtAddVoice" type="button">+ une voix</button></section>'+
    '<section class="mt-right" aria-label="Salles, master et sorties">'+
     '<div class="mt-stack"><span class="mt-h">4 · Salles et échos<small>partagés : chaque voix y envoie sa part</small></span><div id="mtSpaces"></div><button class="mt-add" id="mtAddSpace" type="button">+ salle ou écho</button></div>'+
     '<div class="mt-stack"><span class="mt-h">5 · Master</span><div id="mtMaster"></div><span class="mt-h">6 · Sorties</span><div id="mtOuts"></div></div></section>'+
    '<section class="mt-band mt-mvt" aria-label="Mouvements"><span class="mt-lab">Mouvements<small>ce qui bouge sur des minutes</small></span><div class="mt-row" id="mtMvts"></div><button class="mt-add" id="mtAddMvt" type="button" aria-label="Ajouter un mouvement">+</button></section>'+
   '</div><aside class="mt-panel" id="mtPanel" aria-live="polite"></aside></div>';
  host.appendChild(sec);
  /* ambiances : toutes, rangées par univers */
  const sel=$("mtAmb");
  UNIVERS.forEach(u=>{ const og=document.createElement("optgroup"); og.label=u.name; u.items.forEach((it,i)=>{ const o=document.createElement("option"); o.value=u.id+"|"+i; o.textContent=it[0]; og.appendChild(o); }); sel.appendChild(og); });
  const mine=document.createElement("option"); mine.value=""; mine.textContent="Réglages personnels"; sel.insertBefore(mine,sel.firstChild);
  sel.onchange=()=>{ if(!sel.value) return; const [uid,i]=sel.value.split("|"), u=UNIVERS.find(x=>x.id===uid), it=u.items[+i]; loadScene(it[1],null,undefined,{name:it[0],gloss:it[2],univ:uid}); };
  $("mtPlay").onclick=()=>{ const p=$("play"); if(p) p.click(); setTimeout(mtPlayUI,60); };
  $("mtPropose").onclick=()=>{ if(!AFF.sel.size){ mtFlash("Choisis d'abord une ou plusieurs émotions."); return; } affResults(true); };
  const chips=$("mtChips");
  EMOTIONS.forEach(e=>{ const b=mtEl("button","aff-chip",e); b.type="button"; b.onclick=()=>{ if(AFF.sel.has(e)) AFF.sel.delete(e); else AFF.sel.add(e); if(typeof chipsSync==="function") chipsSync(); mtRender(); }; chips.appendChild(b); });
  $("mtAddVoice").onclick=()=>mtCat("src"); $("mtAddSpace").onclick=()=>mtCat("esp"); $("mtAddMvt").onclick=()=>mtCat("mvt");
}
let mtFlashT=0;
function mtFlash(t){ const c=$("mtCount"); if(!c) return; c.textContent=t; clearTimeout(mtFlashT); mtFlashT=setTimeout(mtCountUI,2600); }
function mtPlayUI(){ const b=$("mtPlay"); if(!b) return; b.textContent=live?"Arrêter":"Jouer"; b.setAttribute("aria-pressed",live?"true":"false"); }
function mtCat(c,lane){ mtPrevStop(); MT.cat=c; MT.catLane=lane||null; mtPanel(); const p=$("mtPanel"); if(p&&p.scrollIntoView&&window.innerWidth<900) p.scrollIntoView({block:"start"}); }
function mtPick(key){ mtPrevStop(); MT.sel=key; MT.cat=null; mtRender(); const p=$("mtPanel"); if(p&&p.scrollIntoView&&window.innerWidth<900) p.scrollIntoView({block:"start"}); }
const mtAff=a=>(a||[]).filter(x=>AFF.sel.has(x));

/* une carte : un bouton, son nom, une ligne de détail */
function mtCard(key,name,sub,opt){
  opt=opt||{}; const b=mtEl("button","mt-card"+(MT.sel===key&&!MT.cat?" sel":"")+(opt.off?" off":"")+(opt.cls?" "+opt.cls:"")); b.type="button";
  b.appendChild(mtEl("span","mt-n",name)); if(sub) b.appendChild(mtEl("span","mt-s",sub));
  if(opt.hint) b.appendChild(mtEl("span","mt-a",opt.hint));
  if(MT.sel===key&&!MT.cat) b.setAttribute("aria-current","true");
  b.onclick=()=>mtPick(key); return b;
}
function mtCountUI(){
  const c=$("mtCount"); if(!c) return;
  const nv=MT_VOIX.filter(mtOn).length, np=MT_VOIX.reduce((t,v)=>t+MT_PED.filter(p=>mtPedLanes(p,v.id)&&v.id!=="canon"&&mtOn(v)&&p.has(v.id)).length,0)+MT_PED.filter(p=>mtPedLanes(p,"master")&&p.has("master")).length, ns=MT_SP.filter(s=>s.has()).length, nm=MT_MO.filter(m=>m.always||m.has()).length;
  c.textContent=nv+" voix, "+np+" pédale"+(np>1?"s":"")+", "+ns+" salle"+(ns>1?"s":"")+" ou écho, "+nm+" mouvements actifs · "+montKeyCount()+" réglages sur la table, tous ceux de la machine";
}
function mtRender(){ if(!MT.built) return; mtBoard(); mtPanel(); }
function mtBoard(){
  if(!MT.built) return;
  mtPlayUI(); mtCountUI();
  /* ambiance en cours */
  { const sel=$("mtAmb"); let v=""; UNIVERS.forEach(u=>u.items.forEach((it,i)=>{ if(it[0]===SCENE.name) v=u.id+"|"+i; })); sel.value=v; }
  document.querySelectorAll("#mtChips .aff-chip").forEach(b=>b.setAttribute("aria-pressed",AFF.sel.has(b.textContent)?"true":"false"));
  /* écriture */
  mtPalUI();
  const ecr=$("mtEcr"); ecr.innerHTML=""; MT_EC.forEach(b=>ecr.appendChild(mtCard("e:"+b.id,b.n,b.sub(),{hint:mtAff(b.a).length?"conseillé":""})));
  /* voix */
  const lanes=$("mtLanes"); lanes.innerHTML="";
  const D=S.daw||{mix:{solo:{},mute:{}}}, solo=D.mix&&D.mix.solo||{}, mute=D.mix&&D.mix.mute||{}, anySolo=Object.keys(solo).some(k=>solo[k]);
  MT_VOIX.filter(mtOn).forEach(v=>{
    const row=mtEl("div","mt-lane"); row.dataset.v=v.id; if(anySolo&&v.bus&&!solo[v.bus]) row.classList.add("dim"); if(v.bus&&mute[v.bus]) row.classList.add("dim");
    const card=mtCard("v:"+v.id,v.n,mtInst(v),{cls:"mt-voice"});
    const m=mtEl("span","mt-meter"); m.setAttribute("aria-hidden","true"); const mi=mtEl("i"); mi.style.width=Math.round(mtLevel(v)*100)+"%"; m.appendChild(mi); const mb=mtEl("b"); m.appendChild(mb); card.appendChild(m);
    if(v.bus&&solo[v.bus]) card.querySelector(".mt-n").appendChild(mtEl("em","mt-tag","seule")); if(v.bus&&mute[v.bus]) card.querySelector(".mt-n").appendChild(mtEl("em","mt-tag","coupée"));
    row.appendChild(card);
    const ins=mtEl("div","mt-ins");
    MT_PED.filter(p=>mtPedLanes(p,v.id)&&p.has(v.id)).forEach(p=>ins.appendChild(mtCard("i:"+v.id+":"+p.id,p.n,p.sub(),{cls:"mt-ped"})));
    const add=mtEl("button","mt-plus","+"); add.type="button"; add.setAttribute("aria-label","Brancher une pédale sur : "+v.n); add.onclick=()=>mtCat("ins",v.id); ins.appendChild(add);
    row.appendChild(ins);
    const snd=mtEl("div","mt-snd");
    if(!v.bus) snd.appendChild(mtEl("span","mt-s","jamais dans la salle"));
    else if(v.id==="canon") snd.appendChild(mtEl("span","mt-s","avec la mélodie"));
    else if(v.id==="nature") snd.appendChild(mtEl("span","mt-s","avec la salle"));
    else [["rev","salle"],["dly","écho"]].forEach(([k,l])=>{ if(k==="dly"&&["perc","amb"].includes(v.bus)) return;
      const e=(S.envoi&&S.envoi[v.bus])||{}, val=e[k]===undefined?1:e[k];
      const lab=mtEl("label","mt-send"); lab.appendChild(mtEl("span","",l)); const r=document.createElement("input"); r.type="range"; r.min=0; r.max=k==="dly"?3:2; r.step=0.05; r.value=val; r.setAttribute("aria-label","Envoi vers "+(k==="rev"?"la salle":"l'écho")+" : "+v.n);
      const o=mtEl("output","",Math.round(val*100)+" %"); r.oninput=()=>{ S.envoi=S.envoi||{}; S.envoi[v.bus]=Object.assign({},S.envoi[v.bus]||{},{[k]:+r.value}); o.textContent=Math.round(r.value*100)+" %"; if(live) live.eng.setLevels(); };
      lab.appendChild(r); lab.appendChild(o); snd.appendChild(lab); });
    row.appendChild(snd);
    lanes.appendChild(row);
  });
  if(!lanes.children.length) lanes.appendChild(mtEl("p","mt-empty","Aucune voix : la table est muette. Ajoute-en une avec « + une voix »."));
  /* salles, master, sorties */
  const sp=$("mtSpaces"); sp.innerHTML=""; MT_SP.filter(s=>s.has()).forEach(s=>sp.appendChild(mtCard("s:"+s.id,s.n,s.sub())));
  MT_SP.filter(s=>!s.has()).forEach(s=>sp.appendChild(mtCard("s:"+s.id,s.n,"débranché",{off:true})));
  const ms=$("mtMaster"); ms.innerHTML=""; MT_MS.forEach(b=>ms.appendChild(mtCard("m:"+b.id,b.n,b.sub())));
  MT_PED.filter(p=>mtPedLanes(p,"master")&&p.has("master")).forEach(p=>ms.appendChild(mtCard("i:master:"+p.id,p.n,"sur tout le mélange · "+p.sub(),{cls:"mt-ped"})));
  { const ad=mtEl("button","mt-add","+ pédale sur le mélange"); ad.type="button"; ad.onclick=()=>mtCat("ins","master"); ms.appendChild(ad); }
  const os=$("mtOuts"); os.innerHTML=""; MT_OUT.forEach(b=>os.appendChild(mtCard("o:"+b.id,b.n,b.sub())));
  /* mouvements */
  const mv=$("mtMvts"); mv.innerHTML=""; MT_MO.filter(m=>m.always||m.has()).forEach(m=>mv.appendChild(mtCard("mv:"+m.id,m.n,m.sub())));
}

/* ---------- le panneau : réglages du bloc choisi, ou le catalogue ---------- */
/* une commande miroir : elle pilote la vraie commande de Composer et la suit */
function mtMirror(k,sig){
  const c=CTL.find(x=>x.it.k===k); if(!c) return null;
  const it=c.it, id="mt_"+k.replace(/\./g,"_"), wrap=mtEl("div","ctl"), row=mtEl("div","l");
  let name=it.label, help=it.hint||""; const mm=name.match(/^(.{4,44}?) : (.+)$/)||(name.length>40&&name.match(/^(.{4,44}?) \((.+)\)$/)); if(!help&&mm){ name=mm[1]; help=mm[2].charAt(0).toUpperCase()+mm[2].slice(1)+"."; }
  const lab=mtEl("label","",name); lab.htmlFor=id; row.appendChild(lab); wrap.appendChild(row);
  if(help){ const hp=mtEl("p","hint",help); hp.hidden=true; hp.id=id+"_h"; const hb=mtEl("button","help","?"); hb.type="button"; hb.setAttribute("aria-label","Explication : "+name); hb.setAttribute("aria-expanded","false"); hb.setAttribute("aria-controls",hp.id);
    hb.onclick=()=>{ hp.hidden=!hp.hidden; hb.setAttribute("aria-expanded",hp.hidden?"false":"true"); }; lab.after(hb); wrap.appendChild(hp); }
  let el, out=null;
  if(c.el.tagName==="SELECT"){ el=document.createElement("select"); el.innerHTML=c.el.innerHTML; }
  else { el=document.createElement("input"); el.type="range"; el.min=c.el.min; el.max=c.el.max; el.step=c.el.step; out=document.createElement("output"); out.htmlFor=id; row.appendChild(out); }
  el.id=id; wrap.insertBefore(el,wrap.querySelector(".hint")); el.value=c.el.value;
  const upd=()=>{ if(out) out.textContent=it.fmt?it.fmt(parseFloat(el.value)):el.value; }; upd();
  if(el.tagName==="SELECT") el.addEventListener("change",()=>{ c.el.value=el.value; c.el.dispatchEvent(new Event("change")); mtSoon(); });
  else { el.addEventListener("input",()=>{ c.el.value=el.value; c.el.dispatchEvent(new Event("input")); upd(); mtSoon(); }); el.addEventListener("change",()=>{ c.el.dispatchEvent(new Event("change")); mtSoon(); }); }
  const back=()=>{ el.value=c.el.value; upd(); };
  c.el.addEventListener("input",back,{signal:sig}); c.el.addEventListener("change",back,{signal:sig});
  return wrap;
}
/* le même miroir pour une commande de la page qui n'est pas dans Composer (extinction, format d'export…) */
function mtMirrorDom(id,label,sig){
  const src=$(id); if(!src) return null;
  const wrap=mtEl("div","ctl"), row=mtEl("div","l"), lab=mtEl("label","",label); lab.htmlFor="mtd_"+id; row.appendChild(lab); wrap.appendChild(row);
  let el;
  if(src.tagName==="SELECT"){ el=document.createElement("select"); el.innerHTML=src.innerHTML; el.value=src.value; el.onchange=()=>{ src.value=el.value; src.dispatchEvent(new Event("change")); mtSoon(); }; }
  else if(src.type==="checkbox"){ el=document.createElement("input"); el.type="checkbox"; el.checked=src.checked; el.onchange=()=>{ src.checked=el.checked; src.dispatchEvent(new Event("change")); }; wrap.className="ctl mt-chk"; }
  else { el=document.createElement("input"); el.type=src.type||"range"; ["min","max","step"].forEach(a=>{ if(src[a]!==undefined&&src[a]!=="") el[a]=src[a]; }); el.value=src.value; el.oninput=()=>{ src.value=el.value; src.dispatchEvent(new Event("input")); }; el.onchange=()=>{ src.dispatchEvent(new Event("change")); }; }
  el.id="mtd_"+id; wrap.appendChild(el);
  const back=()=>{ if(el.type==="checkbox") el.checked=src.checked; else el.value=src.value; }; src.addEventListener("change",back,{signal:sig}); src.addEventListener("input",back,{signal:sig});
  return wrap;
}
function mtSoon(){ clearTimeout(MT.soon); MT.soon=setTimeout(()=>{ mtBoard(); mtPanelHead(); },150); }
/* une action : clique le vrai bouton de la page (lecture, capture, gestes…) */
function mtAct(label,id){
  const b=mtEl("button","btn",label); b.type="button";
  b.onclick=()=>{ if(id.startsWith("mode:")){ setMode(id.slice(5)); return; }
    const t=id.startsWith("g:")?document.querySelector('#jeuGest [data-g="'+id.slice(2)+'"]'):$(id);
    if(!t){ mtFlash("Indisponible ici."); return; }
    if(t.disabled){ mtFlash("Pendant la lecture seulement : lance d'abord la musique."); return; }
    t.click(); setTimeout(()=>{ mtBoard(); mtPanelHead(); },80); };
  return b;
}
function mtBlock(sel){
  const p=sel.split(":"), kind=p[0];
  if(kind==="v") return {k:"Voix",b:mtVoix(p[1])};
  if(kind==="i") return {k:"Pédale",b:mtPed(p[2]),lane:p[1]};
  if(kind==="s") return {k:"Salle et écho",b:MT_SP.find(x=>x.id===p[1])};
  if(kind==="m") return {k:"Master",b:MT_MS.find(x=>x.id===p[1])};
  if(kind==="o") return {k:"Sortie",b:MT_OUT.find(x=>x.id===p[1])};
  if(kind==="e") return {k:"Écriture",b:MT_EC.find(x=>x.id===p[1])};
  if(kind==="mv") return {k:"Mouvement",b:MT_MO.find(x=>x.id===p[1])};
  return {k:"",b:null};
}
function mtPanelHead(){ const s=document.querySelector("#mtPanel .mt-p-sub"); if(!s) return; const {b,lane}=mtBlock(MT.sel); if(b&&b.sub) s.textContent=lane?b.sub(lane):b.sub(); }
function mtPanel(){
  const P=$("mtPanel"); if(!P) return;
  if(MT.ac) MT.ac.abort(); MT.ac=typeof AbortController!=="undefined"?new AbortController():null; const sig=MT.ac?MT.ac.signal:undefined;
  P.innerHTML="";
  if(MT.cat) return mtCatalog(P);
  let {k,b,lane}=mtBlock(MT.sel);
  if(!b){ MT.sel="v:drone"; ({k,b,lane}=mtBlock(MT.sel)); }
  if(!b) return;
  P.appendChild(mtEl("p","mt-p-kind",k+(lane?" · sur "+mtLaneName(lane):"")));
  P.appendChild(mtEl("h3","",b.n));
  if(b.sub) P.appendChild(mtEl("p","mt-p-sub",lane?b.sub(lane):b.sub()));
  P.appendChild(mtEl("p","mt-p-d",b.d));
  if(b.o) P.appendChild(mtEl("p","mt-p-o",b.o));
  const hit=mtAff(b.a); if(hit.length) P.appendChild(mtEl("p","mt-p-aff","Va avec : "+hit.join(", ")+"."));
  const isVoice=MT.sel.startsWith("v:"), on=isVoice?mtOn(b):(b.has?(lane?b.has(lane):b.has()):true);
  /* les réglages */
  const f=mtEl("div","fields mt-fields");
  if(b.tk) f.appendChild(mtMirror(b.tk(lane),sig));
  (b.keys||[]).forEach(key=>{ const m=mtMirror(key,sig); if(m) f.appendChild(m); });
  (b.dom||[]).forEach(([id,l])=>{ const m=mtMirrorDom(id,l,sig); if(m) f.appendChild(m); });
  if(f.children.length) P.appendChild(f);
  /* les actions de la page */
  if(b.acts&&b.acts.length){ const a=mtEl("div","mt-acts"); b.acts.forEach(([l,id])=>a.appendChild(mtAct(l,id))); P.appendChild(a); }
  /* la voix : écouter seule, couper */
  const a=mtEl("div","mt-acts");
  if(isVoice&&b.bus){
    const D=S.daw=S.daw||{tracks:[],mix:{mute:{},solo:{}}}; D.mix=D.mix||{mute:{},solo:{}}; D.mix.solo=D.mix.solo||{}; D.mix.mute=D.mix.mute||{};
    const so=mtEl("button","btn",D.mix.solo[b.bus]?"Tout écouter":"Écouter seule"); so.type="button"; so.setAttribute("aria-pressed",D.mix.solo[b.bus]?"true":"false");
    so.onclick=()=>{ const was=!!D.mix.solo[b.bus]; Object.keys(D.mix.solo).forEach(x=>D.mix.solo[x]=false); D.mix.solo[b.bus]=!was; if(live) live.eng.setLevels(); mtRender(); };
    const mu=mtEl("button","btn",D.mix.mute[b.bus]?"Rétablir":"Couper"); mu.type="button"; mu.setAttribute("aria-pressed",D.mix.mute[b.bus]?"true":"false");
    mu.onclick=()=>{ D.mix.mute[b.bus]=!D.mix.mute[b.bus]; if(live) live.eng.setLevels(); mtRender(); };
    a.append(so,mu);
    /* place dans le stéréo (le panoramique du mixeur) */
    if(["drone","mel","pad","perc","loops","pend","bille","arbre","nuee","amb"].includes(b.bus)){
      const pw=mtEl("div","ctl"), pl=mtEl("div","l"), lb=mtEl("label","","Place dans le stéréo"), po=document.createElement("output"); lb.htmlFor="mt_pan"; pl.append(lb,po); pw.appendChild(pl);
      const pr=document.createElement("input"); pr.type="range"; pr.id="mt_pan"; pr.min=-1; pr.max=1; pr.step=0.05; D.mix.pan=D.mix.pan||{}; pr.value=D.mix.pan[b.bus]||0;
      const pu=()=>{ const v=+pr.value; po.textContent=Math.abs(v)<0.03?"au centre":(v<0?"à gauche ":"à droite ")+Math.round(Math.abs(v)*100)+" %"; }; pu();
      pr.oninput=()=>{ D.mix.pan[b.bus]=+pr.value; pu(); if(live) live.eng.setLevels(); }; pw.appendChild(pr); f.appendChild(pw); if(!f.parentNode) P.appendChild(f); }
    if(["mel","canon"].includes(b.id)||b.bus==="amb") a.appendChild(mtEl("span","mt-s",b.id==="canon"?"solo et coupure : avec la mélodie":b.bus==="amb"?"solo et coupure : salle et nature ensemble":""));
  }
  /* brancher, débrancher, retirer */
  if(isVoice){ const r=mtEl("button","btn",on?"Retirer de la table":"Remettre sur la table"); r.type="button";
    r.onclick=()=>{ if(on){ b.lv.forEach(key=>{ const v=mtNum(key); if(v>0.001){ MT.mem[key]=v; mtSet(key,0); } }); MT.sel="e:fond"; } else mtPlugVoice(b); mtRender(); }; a.appendChild(r); }
  else if(b.plugP&&!b.always){ const r=mtEl("button","btn",on?"Débrancher":"Brancher"); r.type="button";
    r.onclick=()=>{ if(on) (lane?b.unplug(lane):b.unplug()); else mtApply(lane?b.plugP(lane):b.plugP()); if(on&&lane) MT.sel=lane==="master"?"m:patine":"v:"+lane; mtRender(); }; a.appendChild(r); }
  if(a.children.length) P.appendChild(a);
  /* envois de la voix */
  if(isVoice&&b.bus&&!["canon","nature"].includes(b.id)) P.appendChild(mtEl("p","mt-p-o","Ses envois vers la salle et l'écho se règlent sur sa ligne (100 % : le dosage d'origine)."));
  const g=b.g||(isVoice?b.g:null);
  if(g){ const go=mtEl("button","lnk mt-go","Voir dans Composer"); go.type="button"; go.onclick=()=>{ setMode("reglage"); setTimeout(()=>ppGo(g),60); }; P.appendChild(go); }
}
function mtVoicePairs(v){ const o={}; Object.keys(v.plug).forEach(key=>o[key]=MT.mem[key]||v.plug[key]); return o; }
function mtPlugVoice(v){ mtApply(mtVoicePairs(v)); }
function mtApply(pairs){ Object.keys(pairs).forEach(k=>mtSet(k,pairs[k])); }
/* poser une valeur dans un état copié (aperçu) : « drift.0.t », « scales.1 »… */
function mtSetPath(o,k,v){ const p=k.split("."); let x=o; for(let i=0;i<p.length-1;i++){ const q=/^\d+$/.test(p[i])?+p[i]:p[i]; if(x[q]===undefined||x[q]===null) x[q]={}; x=x[q]; } x[/^\d+$/.test(p[p.length-1])?+p[p.length-1]:p[p.length-1]]=v; }
/* le catalogue : ce qu'on peut brancher à cet endroit, les blocs conseillés par les émotions d'abord */
function mtCatalog(P){
  const lane=MT.catLane==="master"?{id:"master",n:"Tout le mélange"}:MT.catLane?mtVoix(MT.catLane):null;
  const T={src:"Ajouter une voix",ins:"Brancher une pédale",esp:"Ajouter une salle ou un écho",mvt:"Ajouter un mouvement"}[MT.cat];
  const hd=mtEl("div","mt-p-top"); hd.appendChild(mtEl("h3","",T)); const x=mtEl("button","mt-x","×"); x.type="button"; x.setAttribute("aria-label","Fermer le catalogue"); x.onclick=()=>{ MT.cat=null; mtPanel(); }; hd.appendChild(x); P.appendChild(hd);
  P.appendChild(mtEl("p","mt-p-o",(lane?"Sur : "+lane.n+". ":"")+(AFF.sel.size?"Les blocs qui vont avec « "+[...AFF.sel].join(", ")+" » passent en premier.":"Choisis des émotions en haut : les blocs qui leur vont passeront en premier.")));
  let items=[];
  if(MT.cat==="src") items=MT_VOIX.filter(v=>!mtOn(v)).map(v=>({n:v.n,d:v.d,o:"",a:v.a,pairs:()=>mtVoicePairs(v),go:()=>{ mtPlugVoice(v); MT.sel="v:"+v.id; }}));
  else if(MT.cat==="ins"&&lane) items=MT_PED.filter(p=>mtPedLanes(p,lane.id)&&!p.has(lane.id)).map(p=>{ const w=p.where?p.where():"aucune", away=w&&w!=="aucune"&&w!==mtBusOf(lane.id);
    return {n:p.n,d:p.d+(away?" Elle est aujourd'hui sur : "+(w==="master"?"tout le mélange":(MT_VOIX.find(v=>v.bus===w)||{n:w}).n)+" ; elle viendra ici.":""),o:p.o,a:p.a,pairs:()=>p.plugP(lane.id),go:()=>{ mtApply(p.plugP(lane.id)); MT.sel="i:"+lane.id+":"+p.id; }}; });
  else if(MT.cat==="esp") items=MT_SP.filter(s=>!s.has()).map(s=>({n:s.n,d:s.d,o:s.o,a:s.a,pairs:()=>s.plugP(),go:()=>{ mtApply(s.plugP()); MT.sel="s:"+s.id; }}));
  else if(MT.cat==="mvt") items=MT_MO.filter(m=>!m.always&&!m.has()).map(m=>({n:m.n,d:m.d,o:m.o,a:m.a,pairs:()=>m.plugP(),go:()=>{ mtApply(m.plugP()); MT.sel="mv:"+m.id; }}));
  const pal=mtPalKeys(); items.forEach(it=>{ it.hit=mtAff(it.a); it.pal=Object.keys(it.pairs()).some(k=>pal.has(k)); it.score=(it.hit.length?3:0)+(it.pal?2:0); });
  items.sort((a,b)=>b.score-a.score);
  if(MT.cat==="ins"&&lane&&!MT_PED.some(p=>mtPedLanes(p,lane.id))) P.appendChild(mtEl("p","mt-p-aff","Pas de pédale sur cette voix : elle passe par la salle. Pose-en une sur tout le mélange, dans la colonne Master."));
  if(!items.length){ P.appendChild(mtEl("p","mt-p-d","Tout est déjà branché ici.")); return; }
  const list=mtEl("div","mt-cat");
  items.forEach(it=>{
    const c=mtEl("div","mt-ci"+(it.hit.length?" hit":""));
    const h=mtEl("div","mt-ci-h"); h.appendChild(mtEl("span","mt-n",it.n)); if(it.hit.length||it.pal) h.appendChild(mtEl("span","mt-a",[it.hit.length?"conseillé : "+it.hit.join(", "):"",it.pal?"palette de l'univers":""].filter(Boolean).join(" · "))); c.appendChild(h);
    c.appendChild(mtEl("p","mt-p-d",it.d)); if(it.o) c.appendChild(mtEl("p","mt-p-o",it.o));
    const row=mtEl("div","mt-acts"), b=mtEl("button","btn main","Brancher"); b.type="button";
    b.onclick=()=>{ mtPrevStop(); it.go(); MT.cat=null; mtRender(); };
    const pv=mtEl("button","btn","Aperçu 8 s"); pv.type="button"; pv.title="Écouter 8 secondes de la table avec ce bloc branché, sans rien changer"; pv.onclick=()=>mtPreview(it.pairs(),pv);
    row.append(b,pv); c.appendChild(row); list.appendChild(c);
  });
  P.appendChild(list);
}
/* signes de vie : le niveau de chaque voix bat pendant la lecture */
function mtLoop(){
  if(typeof MODE==="undefined"||MODE!=="montage"){ MT.raf=0; return; }
  if(live&&live.eng&&live.eng.meter) document.querySelectorAll("#mtLanes .mt-lane").forEach(r=>{ const v=mtVoix(r.dataset.v), b=r.querySelector(".mt-meter b"); if(!v||!v.bus||!b) return;
    let pk=0; try{ pk=live.eng.meter(v.bus); }catch(e){} b.style.width=Math.min(100,Math.round(pk*140))+"%"; });
  MT.raf=requestAnimationFrame(mtLoop);
}
function montEnter(){ buildMontage(); mtRender(); if(!MT.raf) MT.raf=requestAnimationFrame(mtLoop); }
function montSync(){ if(MT.built&&typeof MODE!=="undefined"&&MODE==="montage") mtRender(); }

/* ---------- palette de l'univers : trois blocs qui lui vont, branchés d'un clic, rendus d'un autre ----------
   Les ambiances ne changent pas : la palette propose, on essaie, on garde ou on revient. */
const MT_PAL={
 dungeon:[["Écho zone rouge",{"zr.mix":0.25,"zr.div":3,"zr.fb":0.5}],["Porte passe-bas",{"mel.lpg":0.4}],["Respiration en vagues",{"form.shape":"vagues"}]],
 dark:[["Textures",{"tex.sub":0.45,"tex.mid":0.3,"tex.air":0.2}],["Nuage de grains",{"grain.mix":0.3}],["Ressort saturé",{"spr.mix":0.25,"spr.alt":0.35}]],
 antique:[["Ruisseau",{"nature.ruisseau":0.3}],["Pendules",{"pend.lvl":0.25}],["Couleur du mode",{"mus.color":"tension"}]],
 medieval:[["Plain-chant",{"plain.lvl":0.35}],["Airs anciens (corpus)",{"mus.logic":"corpus"}],["Porte passe-bas",{"mel.lpg":0.4}]],
 aventure:[["Arpège",{"arp.lvl":0.3}],["Courbe de tension",{"curve.mode":"loop"}],["Écho",{"fx.dly":0.2}]],
 pirates:[["La mer",{"nature.mer":0.3,"nature.mouettes":0.1}],["Boucles",{"loops.lvl":0.25}],["Écho zone rouge",{"zr.mix":0.25,"zr.div":2}]],
 nordique:[["Fuzz sur le bourdon",{"fuzz.src":"bourdon","fuzz.mix":0.45,"fuzz.tone":0.2}],["Corbeaux",{"nature.corbeaux":0.2}],["Ressort saturé",{"spr.mix":0.25}]],
 feerie:[["Billes",{"bille.lvl":0.3}],["Arbre",{"arbre.lvl":0.3}],["Scintillement",{"fx.shim":0.3}]],
 horreur:[["Chambres en porte",{"fx.algo":"chambres","fx.rmode":"porte","fx.rdp":0.3}],["Fuzz à porte sur le bourdon",{"fgun.src":"drone","fgun.mix":0.45}],["Loups",{"nature.loup":0.2}]],
 cyber:[["8 bits sur la mélodie",{"bits.src":"mel","bits.mix":0.5}],["Filtre balayé sur les nappes",{"filt.src":"pad","filt.mix":0.7,"filt.sweep":0.6}],["Fuzz à deux bandes sur la percussion",{"cross.src":"perc","cross.mix":0.45}]],
 espace:[["Nuée",{"nuee.lvl":0.3}],["Chambres en gong",{"fx.algo":"chambres","fx.rmode":"gong","fx.rdp":0.75}],["Nuage de grains",{"grain.mix":0.3}]],
 orient:[["Porte passe-bas",{"mel.lpg":0.4}],["Nuit",{"nature.nuit":0.3}],["Écho zone rouge",{"zr.mix":0.2,"zr.div":1.5}]],
 nature:[["Oiseaux",{"nature.oiseaux":0.3}],["Boucles",{"loops.lvl":0.2}],["Respiration en vagues",{"form.shape":"vagues"}]],
 calme:[["Billes",{"bille.lvl":0.25}],["S'apaiser avec le temps",{"adapt.mode":"apaiser"}],["Nuage de grains",{"grain.mix":0.25}]]
};
const mtUniv=()=>(SCENE&&SCENE.univ)||(typeof seekUni==="function"?seekUni():"medieval");
function mtPalKeys(){ const s=new Set(); (MT_PAL[mtUniv()]||[]).forEach(([,pr])=>Object.keys(pr).forEach(k=>s.add(k))); return s; }
const mtPalOn=pr=>Object.keys(pr).every(k=>String(getP(k))===String(pr[k]));
MT.palMem={};
function mtPalUI(){
  const host=$("mtPal"), u=UNIVERS.find(x=>x.id===mtUniv()); if(!host) return; host.innerHTML="";
  $("mtPalU").textContent=u?"de l'univers "+u.name:"";
  (MT_PAL[mtUniv()]||[]).forEach(([n,pr])=>{
    const on=mtPalOn(pr), b=mtEl("button","aff-chip mt-palc",(on?"✓ ":"+ ")+n); b.type="button"; b.setAttribute("aria-pressed",on?"true":"false");
    b.title=on?"Rendre les réglages d'avant":"Brancher : "+Object.keys(pr).map(k=>{ const c=CTL.find(x=>x.it.k===k); return c?c.it.label.split(" : ")[0]:k; }).join(", ");
    b.onclick=()=>{
      if(mtPalOn(pr)){ Object.keys(pr).forEach(k=>{ const m=MT.palMem[k]; mtSet(k,m!==undefined?m:getP(k)); delete MT.palMem[k]; }); }
      else { Object.keys(pr).forEach(k=>{ if(MT.palMem[k]===undefined) MT.palMem[k]=getP(k); }); mtApply(pr); }
      mtRender(); };
    host.appendChild(b);
  });
}
/* ---------- aperçu : 8 secondes de la table avec ce bloc, rendues hors ligne, sans rien changer ----------
   Pendant la lecture, la machine descend le temps de l'aperçu et remonte après. */
async function mtPreview(pairs,btn){
  const same=MT.prev&&MT.prev.btn===btn; mtPrevStop(); if(same) return;
  if(typeof renderOffline!=="function"){ mtFlash("Aperçu impossible ici."); return; }
  const old=btn.textContent; btn.textContent="Calcul…"; btn.disabled=true; const tok={}; MT.prevTok=tok;
  try{
    const Sx=clone(S); Object.keys(pairs).forEach(k=>mtSetPath(Sx,k,pairs[k]));
    const r=await renderOffline(Sx,8,{fadeIn:0.25});
    if(MT.prevTok!==tok) return;
    const AC=window.AudioContext||window.webkitAudioContext, ctx=live?live.ctx:(MT.pctx=MT.pctx||new AC());
    if(ctx.state==="suspended") await ctx.resume();
    const buf=ctx.createBuffer(2,r.L.length,r.sr); buf.getChannelData(0).set(r.L); buf.getChannelData(1).set(r.R);
    const src=ctx.createBufferSource(), g=ctx.createGain(); src.buffer=buf; g.gain.setValueAtTime(0,ctx.currentTime); g.gain.linearRampToValueAtTime(1,ctx.currentTime+0.05);
    src.connect(g); g.connect(ctx.destination);
    const tap=live&&live.eng&&live.eng.tap?live.eng.tap():null, was=tap?tap.gain.value:0; if(tap) tap.gain.setTargetAtTime(was*0.12,ctx.currentTime,0.08);
    src.start(); btn.disabled=false; btn.textContent="Arrêter l'aperçu";
    MT.prev={src,g,btn,tap,was,ctx,old}; src.onended=()=>{ if(MT.prev&&MT.prev.src===src) mtPrevStop(); };
  }catch(e){ btn.disabled=false; btn.textContent=old; mtFlash("Aperçu impossible : "+(e&&e.message||"erreur")); }
}
function mtPrevStop(){
  MT.prevTok=null; const p=MT.prev; if(!p) return; MT.prev=null;
  try{ p.src.onended=null; p.src.stop(); }catch(e){}
  if(p.tap) p.tap.gain.setTargetAtTime(p.was,p.ctx.currentTime,0.12);
  p.btn.textContent=p.old; p.btn.disabled=false;
}
