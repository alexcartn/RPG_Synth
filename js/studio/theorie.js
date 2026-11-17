"use strict";
/* ============================================================
   STUDIO : théorie musicale (gammes, accords, progressions, générateurs, conseils)
   Tout est écrit en règles : rien n'est tiré au hasard, l'outil conseille et c'est toi qui décides.
   ============================================================ */
const TH=(()=>{
  const NOM=["Do","Do♯","Ré","Mi♭","Mi","Fa","Fa♯","Sol","La♭","La","Si♭","Si"];
  const nomNote=pc=>NOM[((pc%12)+12)%12];
  const nomMidi=m=>nomNote(m)+(Math.floor(m/12)-1);

  /* ---------- les modes : caractère, note caractéristique, usage dans le genre ---------- */
  const MODES={
    eolien:{n:"Éolien (mineur naturel)", iv:[0,2,3,5,7,8,10], car:8, carN:"la sixte mineure",
      couleur:"sombre, résigné, épique", genre:"Le mode roi du dungeon synth épique : lisible, grave, qui sonne « légende ». Parfait pour une première pièce.",
      jouer:"Appuie la sixte mineure (bVI) : c'est elle qui donne le poids tragique. L'accord bVI puis bVII qui remonte vers i, c'est le grand souffle épique.",
      piege:"Le Ve degré est mineur (v) : la cadence reste douce. Pour une cadence plus tranchante, emprunte le V majeur au mineur harmonique, mais avec parcimonie.",
      prog:[["i bVI bIII bVII","la descente épique"],["i bVII bVI bVII","le balancier de la quête"],["i iv bVI v","la complainte"],["i bVI bVII i","retour au donjon"],["i v bVI bIII iv i v i","la grande boucle (8 accords)"]]},
    dorien:{n:"Dorien", iv:[0,2,3,5,7,9,10], car:9, carN:"la sixte majeure",
      couleur:"mineur mais lumineux, médiéval, mystique", genre:"Le mode des forêts, des ruines habitées et de la nostalgie douce. Très « comfy dungeon synth ».",
      jouer:"La sixte majeure (dans l'accord IV majeur) est la signature : l'enchaînement i–IV est le dorien à lui tout seul. Fais entendre cette note dans la mélodie.",
      piege:"Sans l'accord IV (ou la sixte majeure), ton dorien sonne éolien. Évite de t'installer sur vi° (accord diminué).",
      prog:[["i IV i IV","le balancement dorien"],["i bVII IV i","la marche dans la forêt"],["i ii bIII IV","la montée modale"],["i IV bVII i","le chant des ruines"]]},
    phrygien:{n:"Phrygien", iv:[0,1,3,5,7,8,10], car:1, carN:"la seconde mineure",
      couleur:"menaçant, oriental, rituel", genre:"Le mode des cryptes, des cultes et des menaces. Excellent en dark ambient : un seul accord et la seconde mineure suffisent.",
      jouer:"L'accord bII majeur, juste au-dessus de la tonique, est l'arme absolue : i–bII–i. En mélodie, tourne autour de la tonique en touchant la seconde mineure.",
      piege:"Le Ve degré est diminué (v°) : n'y reste pas. Les cadences se font par bII ou bvii qui retombent sur i.",
      prog:[["i bII i bII","l'appel du culte"],["i bII bIII bII","la procession"],["i bvii bVI bII","la descente aux enfers"],["i iv bII i","le rituel"]]},
    harm:{n:"Mineur harmonique", iv:[0,2,3,5,7,8,11], car:11, carN:"la sensible (septième majeure)",
      couleur:"dramatique, gothique, oriental", genre:"Le mineur des châteaux hantés et des vampires : la seconde augmentée entre la sixte et la sensible sonne immédiatement « ancien et dangereux ».",
      jouer:"Le V majeur (et V7) qui revient sur i donne une cadence très forte. En mélodie, l'intervalle bVI → VII (seconde augmentée) est la couleur.",
      piege:"bIII+ (accord augmenté) est très instable : à n'utiliser qu'en passage. Trop de V–i rend la pièce classique plutôt que modale.",
      prog:[["i iv V i","la cadence gothique"],["i bVI V i","le drame"],["i iv bVI V","l'escalier du château"],["i V bVI V","la valse du vampire"]]},
    ionien:{n:"Ionien (majeur)", iv:[0,2,4,5,7,9,11], car:11, carN:"la septième majeure (sensible)",
      couleur:"clair, héroïque, apaisé", genre:"Pour les villages, les aubes et les tavernes au coin du feu. Le côté « comfy » le plus doux.",
      jouer:"I–IV–V–I est la grammaire de base, mais en dungeon synth on préfère I–IV–I–V ou I–vi–IV–V tenus longtemps.",
      piege:"Le majeur peut vite sonner variété : garde des accords longs, des quintes à vide et un bourdon pour l'ancrer dans l'ancien.",
      prog:[["I IV I V","le village"],["I vi IV V","la veillée"],["I V vi IV","le voyage"],["I iii IV I","l'aube"]]},
    mixolydien:{n:"Mixolydien", iv:[0,2,4,5,7,9,10], car:10, carN:"la septième mineure",
      couleur:"majeur rustique, celtique, festif", genre:"Le mode des cornemuses, des fêtes de village et des peuples du nord.",
      jouer:"L'accord bVII majeur qui revient à I est la signature (I–bVII–I). Il remplace la cadence V–I.",
      piege:"Si tu joues V majeur avec la sensible, tu retombes en majeur classique. Garde la septième mineure.",
      prog:[["I bVII I bVII","la fête du clan"],["I bVII IV I","la cornemuse"],["I v bVII I","le retour des drakkars"],["I IV bVII IV","la danse"]]},
    lydien:{n:"Lydien", iv:[0,2,4,6,7,9,11], car:6, carN:"la quarte augmentée",
      couleur:"féerique, flottant, merveilleux", genre:"Le mode des fées, des cieux étoilés et de l'émerveillement. Sublime en nappes lentes.",
      jouer:"L'accord II majeur posé sur la tonique (I–II–I) fait flotter la musique. La quarte augmentée en mélodie est la couleur.",
      piege:"Évite IV : il n'existe pas en lydien (c'est #iv°). Ne résous pas trop vers V–I sinon tu perds l'apesanteur.",
      prog:[["I II I II","l'apesanteur"],["I II vii I","la clairière des fées"],["I V II I","la voûte étoilée"],["I iii II I","le songe"]]},
    locrien:{n:"Locrien", iv:[0,1,3,5,6,8,10], car:6, carN:"la quinte diminuée",
      couleur:"instable, malsain, horrifique", genre:"Le mode le plus inquiétant : la tonique elle-même est diminuée. À utiliser en dark ambient, sur un bourdon, presque sans accords.",
      jouer:"Reste sur un bourdon de tonique et fais entendre la quinte diminuée en mélodie. bII et bV majeurs sont les accords les plus utiles.",
      piege:"Pas de vraie cadence possible : c'est voulu. Un bourdon fort aide l'oreille à sentir la tonique.",
      prog:[["i° bII i° bII","le malaise"],["i° bV bII i°","l'horreur lente"],["i° biii bII i°","la cave"]]},
    phrygdom:{n:"Phrygien dominant", iv:[0,1,4,5,7,8,10], car:4, carN:"la tierce majeure avec la seconde mineure",
      couleur:"oriental, désertique, sacré", genre:"Le désert, les temples anciens, les magiciens d'orient. Très évocateur en bourdon + mélodie.",
      jouer:"I–bII–I sur un bourdon, et la mélodie qui glisse entre la seconde mineure et la tierce majeure.",
      piege:"C'est le Ve mode du mineur harmonique : si tu t'installes sur iv, l'oreille entend un mineur harmonique.",
      prog:[["I bII I bII","le temple"],["I bII biii bII","la caravane"],["I iv bII I","le désert"]]},
    dorien4:{n:"Dorien ♯4 (roumain)", iv:[0,2,3,6,7,9,10], car:6, carN:"la quarte augmentée dans le mineur",
      couleur:"tzigane, sorcier, inquiétant", genre:"Pour les sorcières, les forêts de l'est, les vieilles légendes slaves.",
      jouer:"L'accord II majeur sur la tonique mineure, et la quarte augmentée qui monte vers la quinte.",
      piege:"Peu d'accords stables : utilise surtout i, II et bVII, et laisse la mélodie porter la couleur.",
      prog:[["i II i II","la sorcière"],["i II bVII i","la légende de l'est"]]},
    melo:{n:"Mineur mélodique", iv:[0,2,3,5,7,9,11], car:9, carN:"la sixte et la septième majeures",
      couleur:"mineur ascendant, noble, mélancolique", genre:"Un mineur qui s'élève : utile pour les passages de résolution et les finales nobles.",
      jouer:"IV majeur et V majeur dans un contexte mineur : i–IV–V–i donne une couleur de choral ancien.",
      piege:"Moins de caractère modal : à réserver aux passages de transition.",
      prog:[["i IV V i","le choral"],["i ii IV V","l'élévation"]]},
    dblharm:{n:"Double harmonique (byzantin)", iv:[0,1,4,5,7,8,11], car:1, carN:"les deux secondes augmentées",
      couleur:"byzantin, exotique, solennel", genre:"Cathédrales d'orient, rituels anciens, temples oubliés.",
      jouer:"I–bII–I, et une mélodie très ornée autour des secondes augmentées.",
      piege:"Très typé : quelques notes suffisent. Ne surcharge pas l'harmonie.",
      prog:[["I bII I bII","le rituel byzantin"],["I bII iv I","la cathédrale d'orient"]]},
    tzigane:{n:"Mineur tzigane", iv:[0,2,3,6,7,8,11], car:6, carN:"les deux secondes augmentées dans le mineur",
      couleur:"passionné, sombre, folklorique", genre:"Pour les campements, les fêtes tragiques, les danses autour du feu.",
      jouer:"i–V–i avec la quarte augmentée et la sensible en mélodie.",
      piege:"Peu d'accords naturels : i, V et bVI sont tes appuis.",
      prog:[["i V i V","la danse tragique"],["i bVI V i","le campement"]]}
  };
  const ORDRE=["eolien","dorien","phrygien","harm","ionien","mixolydien","lydien","locrien","phrygdom","dorien4","melo","dblharm","tzigane"];

  /* ---------- accords ---------- */
  const Q={M:[0,4,7], m:[0,3,7], dim:[0,3,6], aug:[0,4,8], sus2:[0,2,7], sus4:[0,5,7], "5":[0,7]};
  const QN={M:"", m:"m", dim:"°", aug:"+", sus2:"sus2", sus4:"sus4", "5":"5"};
  const QL={M:"majeur", m:"mineur", dim:"diminué", aug:"augmenté", sus2:"suspendu 2", sus4:"suspendu 4", "5":"quinte à vide"};
  const ROM=["I","bII","II","bIII","III","IV","#IV","V","bVI","VI","bVII","VII"];
  const inScale=(iv,pc)=>iv.indexOf(((pc%12)+12)%12)>=0;
  /* les notes (en demi-tons depuis la tonique) d'un accord {r, q, x} */
  function tones(ch,iv){
    const base=(Q[ch.q]||Q.M).map(i=>ch.r+i);
    if(ch.x==="7"){ const s=[10,11,9].map(k=>ch.r+k).find(p=>iv&&inScale(iv,p)); base.push(s!==undefined?s:ch.r+(ch.q==="M"&&!iv?11:10)); }
    if(ch.x==="add9") base.push(ch.r+14);
    if(ch.x==="6"){ const s=[9,8].map(k=>ch.r+k).find(p=>iv&&inScale(iv,p)); base.push(s!==undefined?s:ch.r+9); }
    return base;
  }
  function roman(ch){
    let s=ROM[((ch.r%12)+12)%12]; const low=ch.q==="m"||ch.q==="dim";
    if(low) s=s.replace(/[IV]+/,x=>x.toLowerCase());
    if(ch.q==="dim") s+="°"; else if(ch.q==="aug") s+="+"; else if(ch.q==="sus2"||ch.q==="sus4"||ch.q==="5") s+=ch.q;
    if(ch.x) s+=ch.x==="7"?"7":ch.x==="add9"?"add9":ch.x;
    return s;
  }
  const chordName=(ch,key)=>nomNote(key+ch.r)+QN[ch.q]+(ch.x==="7"?"7":ch.x==="add9"?"add9":ch.x==="6"?"6":"");
  /* accords diatoniques (triades) de la gamme */
  function diatonic(iv){
    return iv.map((r,d)=>{
      const t=iv[(d+2)%7]+(d+2>=7?12:0)-r, f=iv[(d+4)%7]+(d+4>=7?12:0)-r;
      const q=t===4&&f===7?"M":t===3&&f===7?"m":t===3&&f===6?"dim":t===4&&f===8?"aug":"5";
      return {r,q,d};
    });
  }
  function parseRoman(s,iv){
    const m=/^(b|#)?(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})(°|\+|sus2|sus4|5)?(7|add9)?$/.exec(s.trim()); if(!m) return null;
    const U=m[2].toUpperCase(), base={I:0,II:2,III:4,IV:5,V:7,VI:9,VII:11}[U];
    let r=base+(m[1]==="b"?-1:m[1]==="#"?1:0); r=(r+12)%12;
    const low=m[2]!==U; let q=m[3]==="°"?"dim":m[3]==="+"?"aug":m[3]==="sus2"?"sus2":m[3]==="sus4"?"sus4":m[3]==="5"?"5":low?"m":"M";
    return {r,q,x:m[4]||"",b:1};
  }
  const isDiatonic=(ch,iv)=>tones(ch,iv).every(p=>inScale(iv,p));
  const outNotes=(ch,iv)=>tones(ch,iv).filter(p=>!inScale(iv,p)).map(p=>((p%12)+12)%12);
  const hasCar=(ch,mode)=>{ const M=MODES[mode]; return !!M&&tones(ch,M.iv).some(p=>((p%12)+12)%12===M.car); };
  /* emprunts utiles : accords des modes voisins, avec la raison */
  function borrowed(mode){
    const iv=MODES[mode].iv, cand=[
      ["IV","emprunt au dorien : une lueur dans le mineur"],["iv","emprunt au mineur : une ombre dans le majeur"],
      ["V","dominante majeure (mineur harmonique) : cadence forte vers i"],["bVI","emprunt au mineur : le grand souffle épique"],
      ["bVII","emprunt au mixolydien ou au mineur : retour modal vers la tonique"],["bII","accord napolitain / phrygien : la menace"],
      ["I","tierce picarde : finir en majeur une pièce mineure"],["bIII","emprunt au mineur : héroïsme sombre"],["II","emprunt au lydien : l'apesanteur"]];
    return cand.map(([r,why])=>({ch:parseRoman(r,iv),why})).filter(o=>o.ch&&!isDiatonic(o.ch,iv)&&!(o.ch.r===0&&o.ch.q===(diatonic(iv)[0].q)));
  }

  /* ---------- suggestions d'enchaînement : règles de mouvement de fondamentale, notes communes, couleur du mode ---------- */
  function nextSuggest(mode,cur,progLen){
    const iv=MODES[mode].iv, dia=diatonic(iv).filter(c=>c.q!=="aug"), out=[];
    const curT=cur?tones(cur,iv).map(p=>((p%12)+12)%12):[];
    dia.forEach(c=>{
      if(cur&&c.r===cur.r&&c.q===cur.q) return;
      let sc=0, why=[];
      const T=tones(c,iv).map(p=>((p%12)+12)%12), common=T.filter(p=>curT.indexOf(p)>=0).length;
      if(!cur){ if(c.r===0){ sc+=5; why.push("commencer sur la tonique installe le mode"); } }
      else{
        const mv=((c.r-cur.r)%12+12)%12;
        if(c.r===0&&cur.r!==0){ sc+=3; why.push("retour à la tonique : repos"); if([10,1,7,5].indexOf(cur.r)>=0){ sc+=2; why.push("cadence modale ("+roman(cur)+" → "+roman(c)+")"); } }
        if(mv===5){ sc+=2.5; why.push("quinte descendante : enchaînement le plus naturel"); }
        else if(mv===7){ sc+=1.5; why.push("quinte ascendante : ouverture"); }
        else if(mv===2||mv===10){ sc+=2; why.push(mv===2?"montée d'un ton : élan épique":"descente d'un ton : glissement modal typique"); }
        else if(mv===1||mv===11){ sc+=1; why.push("mouvement d'un demi-ton : tension, couleur sombre"); }
        else if(mv===3||mv===4||mv===8||mv===9){ sc+=1.5; why.push("mouvement de tierce : "+common+" note"+(common>1?"s":"")+" en commun, très doux"); }
        else if(mv===6){ sc-=1; why.push("triton : étrange, à réserver à l'horreur"); }
        if(common>=2) sc+=0.5;
        if(cur.r===8&&c.r===10){ sc+=1.5; why.push("bVI → bVII : la montée épique du genre"); }
      }
      if(hasCar(c,mode)&&c.r!==0){ sc+=1.5; why.push("contient "+MODES[mode].carN+" : affirme le mode"); }
      if(c.q==="dim"){ sc-=2.5; why.push("accord diminué : instable, en passage seulement"); }
      if(progLen>=3&&c.r===0) sc+=1;
      out.push({ch:{r:c.r,q:c.q,x:"",b:1},sc,why});
    });
    return out.sort((a,b)=>b.sc-a.sc).slice(0,4);
  }

  /* ---------- relecture d'une progression ---------- */
  function reviewProg(mode,chords,meter){
    const M=MODES[mode], iv=M.iv, tips=[]; if(!chords.length) return [{k:"info",t:"Pose un premier accord. En général on commence par la tonique ("+roman(diatonic(iv)[0])+") pour installer le mode."}];
    const first=chords[0], last=chords[chords.length-1], tot=chords.reduce((a,c)=>a+c.b,0);
    if(first.r!==0) tips.push({k:"warn",t:"La boucle ne commence pas sur la tonique : l'oreille risque de prendre "+roman(first)+" pour la tonique. C'est voulu ? Sinon, commence par i."});
    else tips.push({k:"ok",t:"Départ sur la tonique : le mode est installé."});
    if(chords.length>1){
      if(last.r===0) tips.push({k:"info",t:"La boucle finit sur la tonique : en boucle, tu entendras deux fois la tonique d'affilée. Finir sur un accord qui y mène (bVII, V, bII, IV) relance mieux."});
      else if([10,7,1,5,8].indexOf(last.r)>=0) tips.push({k:"ok",t:"La fin ("+roman(last)+") relance bien vers le début de la boucle."});
    }
    const car=chords.some(c=>hasCar(c,mode));
    if(!car&&mode!=="eolien"&&mode!=="ionien") tips.push({k:"warn",t:"Aucun accord ne contient "+M.carN+" : la couleur du mode "+M.n.toLowerCase()+" ne s'entend pas. "+M.jouer});
    else if(car) tips.push({k:"ok",t:"La couleur du mode ("+M.carN+") est présente."});
    const outs=chords.filter(c=>!isDiatonic(c,iv)); if(outs.length) tips.push({k:"info",t:"Emprunt"+(outs.length>1?"s":"")+" hors gamme : "+outs.map(roman).join(", ")+". Ça colore, mais la mélodie doit éviter la note de la gamme qui frotte pendant ces accords."});
    const dims=chords.filter(c=>c.q==="dim"&&c.b>=2); if(dims.length) tips.push({k:"warn",t:"Un accord diminué tenu deux mesures ou plus : il est instable, raccourcis-le ou remplace-le par un sus4."});
    const diff=new Set(chords.map(c=>c.r+c.q)).size;
    if(diff>5) tips.push({k:"info",t:diff+" accords différents : c'est beaucoup pour le genre. Le dungeon synth vit de 2 à 4 accords qui reviennent."});
    if(chords.length>=2&&chords.every(c=>c.b<1)) tips.push({k:"info",t:"Changements très rapides : en dungeon synth, une à deux mesures par accord laisse les nappes respirer."});
    if(tot%2===1&&tot>1) tips.push({k:"info",t:"La boucle fait "+tot+" mesures (impair) : ça crée un décalage, intéressant mais moins carré. 4 ou 8 mesures sonnent plus naturel."});
    for(let i=1;i<chords.length;i++) if(chords[i].r===chords[i-1].r&&chords[i].q===chords[i-1].q&&chords[i].x===chords[i-1].x){ tips.push({k:"info",t:"Deux "+roman(chords[i])+" de suite : autant n'en faire qu'un, plus long."}); break; }
    return tips;
  }

  /* ---------- mesures ---------- */
  const METER={"4/4":{bb:4,strong:[0,2],div:16},"3/4":{bb:3,strong:[0],div:12},"6/8":{bb:3,strong:[0,1.5],div:12},"2/4":{bb:2,strong:[0],div:8}};
  const bb=meter=>(METER[meter]||METER["4/4"]).bb;

  /* ---------- générateurs : de la progression aux notes, sans hasard ---------- */
  /* une liste d'accords posée sur la ligne du temps (en temps, une noire = 1) */
  function timeline(chords,meter){ const B=bb(meter); let s=0; return chords.map(c=>{ const o={ch:c,s,d:c.b*B}; s+=c.b*B; return o; }); }
  const progLen=(chords,meter)=>Math.max(bb(meter),chords.reduce((a,c)=>a+c.b,0)*bb(meter));
  /* voicings proches : on garde le renversement qui bouge le moins depuis l'accord précédent */
  function voice(ch,iv,key,lo,hi,prev,style){
    const pcs=[...new Set(tones(ch,iv).map(p=>((p%12)+12)%12))], root=((key+ch.r)%12+12)%12;
    let cands=[];
    if(style==="quintes"){ for(let m=lo;m<=hi;m++) if(m%12===root) cands.push([m,m+7,m+12]); }
    else{
      const abs=pcs.map(pc=>(pc+key)%12);
      for(let m=lo;m<=hi;m++){ if(abs.indexOf(m%12)<0) continue; const v=[m]; abs.forEach(pc=>{ if(pc===m%12) return; v.push(m+((pc-m%12)+12)%12); }); v.sort((a,b)=>a-b);
        if(style==="ouverte"&&v.length>=3){ v[1]+=12; v.sort((a,b)=>a-b); }
        if(v[v.length-1]<=hi+(style==="ouverte"?12:4)) cands.push(v); }
    }
    if(!cands.length) cands=[[lo+((root-lo)%12+12)%12]];
    if(!prev) { const mid=(lo+hi)/2; cands.sort((a,b)=>Math.abs(avg(a)-mid)-Math.abs(avg(b)-mid)); return cands[0]; }
    let best=cands[0], bd=1e9; cands.forEach(v=>{ const d=v.reduce((a,x)=>a+Math.min(...prev.map(y=>Math.abs(x-y))),0)+Math.abs(v.length-prev.length); if(d<bd){ bd=d; best=v; } }); return best;
  }
  const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const GEN_DEF={
    nappe:{voicing:"serree", oct:4, rythme:"tenue", vel:0.7},
    bourdon:{note:"tonique", quinte:true, oct:2, tenue:"boucle", vel:0.75},
    basse:{motif:"tenue", oct:2, vel:0.8},
    arpege:{motif:"vaetvient", rate:0.5, oct:4, ambitus:1, gate:0.8, vel:0.7, accent:true}
  };
  const GEN_N={nappe:"Nappe", bourdon:"Bourdon", basse:"Basse", arpege:"Arpège"};
  /* notes d'un clip généré : {s,d,p,v} en temps */
  function generate(type,g,chords,ctx){
    const {iv,key,meter}=ctx, B=bb(meter), TL=timeline(chords,meter), out=[]; g=Object.assign({},GEN_DEF[type],g||{});
    const base=12*(g.oct+1)+key;
    if(type==="nappe"){
      let prev=null; const lo=12*(g.oct+1), hi=lo+14;
      TL.forEach(({ch,s,d})=>{
        const v=voice(ch,iv,key,lo,hi,prev,g.voicing); prev=v;
        const step=g.rythme==="tenue"?d:g.rythme==="rondes"?B:g.rythme==="blanches"?Math.min(2,B):1;
        for(let t=0;t<d-1e-6;t+=step) v.forEach((p,i)=>out.push({s:s+t,d:Math.min(step,d-t)*(g.rythme==="tenue"?1:0.95),p,v:g.vel*(i===0?1:0.9)}));
      });
    }
    else if(type==="bourdon"){
      const tot=progLen(chords,meter);
      const add=(s,d,r)=>{ out.push({s,d,p:base+r,v:g.vel}); if(g.quinte) out.push({s,d,p:base+r+7,v:g.vel*0.75}); };
      if(g.tenue==="boucle"&&g.note==="tonique") add(0,tot,0);
      else TL.forEach(({ch,s,d})=>add(s,d,g.note==="tonique"?0:((ch.r%12)+12)%12));
    }
    else if(type==="basse"){
      TL.forEach(({ch,s,d})=>{
        const r=base+(((ch.r%12)+12)%12), q=(Q[ch.q]||Q.M), fifth=r+(q[2]||7);
        if(g.motif==="tenue") out.push({s,d,p:r,v:g.vel});
        else if(g.motif==="noires") for(let t=0;t<d-1e-6;t+=1) out.push({s:s+t,d:0.9,p:r,v:g.vel*((t%B)===0?1:0.8)});
        else if(g.motif==="croches") for(let t=0;t<d-1e-6;t+=0.5) out.push({s:s+t,d:0.45,p:r,v:g.vel*((t%B)===0?1:0.75)});
        else if(g.motif==="quinte") for(let t=0;t<d-1e-6;t+=1) out.push({s:s+t,d:0.9,p:Math.round(t)%2?fifth-12<r-5?fifth:fifth-12:r,v:g.vel*((t%B)===0?1:0.8)});
        else if(g.motif==="octave") for(let t=0;t<d-1e-6;t+=0.5) out.push({s:s+t,d:0.45,p:Math.round(t*2)%2?r+12:r,v:g.vel*((t%B)===0?1:0.75)});
      });
    }
    else if(type==="arpege"){
      TL.forEach(({ch,s,d})=>{
        const pcs=tones(ch,iv), lo=12*(g.oct+1)+key, oct=Math.max(1,Math.min(3,g.ambitus|0));
        const asc=[]; for(let o=0;o<oct;o++) pcs.slice(0,ch.x?4:3).forEach(p=>asc.push(lo+p+12*o)); asc.sort((a,b)=>a-b); asc.push(asc[0]+12*oct);
        let seq;
        if(g.motif==="montant") seq=asc.slice(0,-1);
        else if(g.motif==="descendant") seq=asc.slice(1).reverse();
        else if(g.motif==="vaetvient") seq=asc.concat(asc.slice(1,-1).reverse());
        else if(g.motif==="alberti") seq=[asc[0],asc[2]||asc[1],asc[1],asc[2]||asc[1]];
        else if(g.motif==="dungeon") seq=[asc[0],asc[2]||asc[1],asc[3]||asc[0]+12,asc[2]||asc[1]];
        else if(g.motif==="cascade") seq=asc.slice().reverse().concat(asc.slice(1,-1));
        else if(g.motif==="pedale") seq=asc.slice(1).flatMap(x=>[asc[0],x]);
        else seq=asc;
        const rate=g.rate||0.5; let k=0;
        for(let t=0;t<d-1e-6;t+=rate,k++){
          const bt=(s+t)%B, acc=g.accent?(Math.abs(bt)<1e-6?1:(Math.abs(bt-Math.round(bt))<1e-6?0.85:0.7)):0.85;
          out.push({s:s+t,d:rate*g.gate,p:seq[k%seq.length],v:g.vel*acc});
        }
      });
    }
    return out;
  }
  const MOTIFS={arpege:[["montant","Montant"],["descendant","Descendant"],["vaetvient","Va-et-vient"],["alberti","Alberti (bas, haut, milieu, haut)"],["dungeon","Dungeon (1-5-8-5)"],["cascade","Cascade (descend puis remonte)"],["pedale","Pédale (la fondamentale entre chaque note)"]],
    basse:[["tenue","Tenue"],["noires","Noires"],["croches","Croches"],["quinte","Fondamentale-quinte"],["octave","Octaves en croches"]],
    nappe:[["tenue","Tenue (tout l'accord)"],["rondes","Une par mesure"],["blanches","Blanches"],["noires","Noires (pulsée)"]],
    voicing:[["serree","Serrée (proche, voix qui bougent peu)"],["ouverte","Ouverte (large, aérée)"],["quintes","Quintes à vide (archaïque)"]]};

  /* ---------- relecture d'une mélodie ---------- */
  function reviewMel(notes,chords,ctx){
    const {iv,key,meter,mode}=ctx, M=MODES[mode], B=bb(meter), tips=[];
    if(!notes.length) return [{k:"info",t:"Clip vide. Pose des notes au piano roll ou arme la piste (●) et joue au clavier : Z X C V B N M pour le grave, A S D F G H J K L, puis Q W E R T Y U I O P."},
      {k:"info",t:"Méthode du genre : un motif de 2 mesures, répété, puis une réponse qui finit sur la tonique. La simplicité est une qualité en dungeon synth."}];
    const TL=timeline(chords,meter), L=Math.max(1,progLen(chords,meter)), chordAt=s=>{ const x=((s%L)+L)%L; return (TL.find(c=>x>=c.s-1e-6&&x<c.s+c.d-1e-6)||TL[0]||{}).ch; };
    const S=notes.slice().sort((a,b)=>a.s-b.s), strong=S.filter(n=>{ const bt=((n.s%B)+B)%B; return (METER[meter]||METER["4/4"]).strong.some(x=>Math.abs(bt-x)<0.05); });
    if(chords.length&&strong.length){
      const ok=strong.filter(n=>{ const ch=chordAt(n.s); return ch&&tones(ch,iv).some(p=>((p+key)%12+12)%12===((n.p%12)+12)%12); }).length, pc=Math.round(100*ok/strong.length);
      tips.push(pc>=60?{k:"ok",t:pc+" % des notes sur les temps forts sont dans l'accord : la mélodie est bien posée sur l'harmonie."}:{k:"warn",t:"Seulement "+pc+" % des notes des temps forts sont dans l'accord. Sur les temps forts, préfère une note de l'accord ; garde les autres notes pour les temps faibles (notes de passage)."});
    }
    const ps=S.map(n=>n.p), amb=Math.max(...ps)-Math.min(...ps);
    if(amb>17) tips.push({k:"warn",t:"Ambitus de "+amb+" demi-tons : c'est large. Une mélodie chantable tient dans une octave et demie."});
    else tips.push({k:"ok",t:"Ambitus de "+amb+" demi-tons : chantable."});
    let big=0, unrec=0; for(let i=1;i<S.length;i++){ const j=S[i].p-S[i-1].p; if(Math.abs(j)>7){ big++; if(i+1<S.length){ const k=S[i+1].p-S[i].p; if(Math.sign(k)===Math.sign(j)||Math.abs(k)>4) unrec++; } } }
    if(unrec) tips.push({k:"info",t:unrec+" grand"+(unrec>1?"s":"")+" saut"+(unrec>1?"s":"")+" sans retour : après un saut de plus d'une quinte, reviens par mouvement conjoint dans l'autre sens."});
    const lastN=S[S.length-1], lpc=((lastN.p-key)%12+12)%12;
    if(lpc===0) tips.push({k:"ok",t:"La phrase finit sur la tonique : conclusion nette."});
    else if(lpc===7) tips.push({k:"info",t:"La phrase finit sur la quinte : suspendue, elle appelle une suite. Bien pour une question, à résoudre plus tard."});
    else tips.push({k:"info",t:"La phrase finit sur "+nomNote(lastN.p)+" : ni tonique ni quinte, la fin reste en l'air."});
    const usesCar=S.some(n=>((n.p-key)%12+12)%12===M.car);
    tips.push(usesCar?{k:"ok",t:"Tu utilises "+M.carN+" : la couleur du mode passe par la mélodie."}:{k:"info",t:"La mélodie n'utilise pas "+M.carN+" ("+nomNote(key+M.car)+"), la note qui fait le mode. Glisse-la au moins une fois."});
    const out=S.filter(n=>!inScale(iv,n.p-key)); if(out.length) tips.push({k:"warn",t:out.length+" note"+(out.length>1?"s":"")+" hors gamme : "+[...new Set(out.map(n=>nomNote(n.p)))].join(", ")+"."});
    const durs=new Set(S.map(n=>Math.round(n.d*4))); if(durs.size===1&&S.length>4) tips.push({k:"info",t:"Toutes les notes ont la même durée : varie (une longue, deux courtes) pour donner une respiration."});
    return tips;
  }

  /* ---------- conseils de couches (arrangement vertical) ---------- */
  function reviewLayers(info){
    const tips=[], has=k=>info.roles.indexOf(k)>=0;
    if(!info.roles.length) return [{k:"info",t:"Ajoute une première couche : une nappe ou un bourdon pour poser le sol."}];
    if(!has("nappe")&&!has("bourdon")) tips.push({k:"info",t:"Ni nappe ni bourdon : le genre repose sur un fond tenu. Commence par là."});
    if(has("bourdon")&&has("basse")) tips.push({k:"warn",t:"Bourdon et basse jouent tous deux dans le grave : un seul élément doit tenir le grave, sinon ça devient boueux. Baisse l'un, ou passe le bourdon une octave plus haut."});
    if(info.lowCount>2) tips.push({k:"warn",t:info.lowCount+" couches descendent sous Do3 : coupe le grave des nappes avec un EQ (coupe-bas vers 150 Hz)."});
    if(has("arpege")&&info.arpOct!==null&&info.melOct!==null&&Math.abs(info.arpOct-info.melOct)<1) tips.push({k:"info",t:"Arpège et mélodie sont dans le même registre : ils vont se masquer. Sépare-les d'une octave."});
    if(has("arpege")&&!has("nappe")) tips.push({k:"info",t:"Un arpège seul sonne nu : une nappe dessous, même discrète, le porte."});
    if(!has("melodie")&&info.roles.length>=2) tips.push({k:"info",t:"Le fond est là. Étape suivante : la mélodie, sur une piste « Notes »."});
    if(info.insRev>1) tips.push({k:"info",t:"Plusieurs pistes ont une réverbération en insert : utilise plutôt l'envoi A (une seule réverb partagée), le mix sera plus cohérent et plus léger."});
    if(!tips.length) tips.push({k:"ok",t:"L'empilement est sain : chaque couche a sa place."});
    return tips;
  }

  return {NOM,nomNote,nomMidi,MODES,ORDRE,Q,QN,QL,tones,roman,chordName,diatonic,parseRoman,isDiatonic,outNotes,hasCar,borrowed,nextSuggest,reviewProg,METER,bb,timeline,progLen,generate,GEN_DEF,GEN_N,MOTIFS,reviewMel,reviewLayers,inScale};
})();
if(typeof module!=="undefined") module.exports=TH;
