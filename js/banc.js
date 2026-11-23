"use strict";
/* ============================================================
   BANC D'ÉCOUTE : juger la musique à l'oreille, pas seulement aux mesures
   Deux outils, tout reste dans le navigateur et s'exporte en CSV :
   - Notes en séance : pendant une vraie partie, un clic « ça porte » ou « ça distrait » note l'instant, la scène, la tension, les émotions.
   - Essai à l'aveugle : deux versions d'une même pièce (même graine, une seule différence), rendues hors ligne, ramenées au même niveau,
     présentées en A et B dans un ordre tiré au sort. On note chacune de 1 (distrait) à 5 (porte la scène), on dit sa préférence,
     puis on découvre laquelle était laquelle. Le bilan compte les préférences et donne la probabilité qu'elles viennent du hasard
     (test du signe). Méthode : Bech et Zacharov, Perceptual Audio Evaluation (2006) ; ITU-R BS.1534 pour l'écoute comparée.
   ============================================================ */
const BANC_F=[
  {id:"logique", n:"Logique modale ou hasard", a:["modale",S=>{S.mus.logic="modal";}], b:["hasard",S=>{S.mus.logic="hasard";}]},
  {id:"tharm", n:"Tension harmonique ou non", a:["tension harmonique",S=>{S.mus.tharm=0.8; S.tension=0.8;}], b:["sans",S=>{S.mus.tharm=0; S.tension=0.8;}]},
  {id:"cine", n:"Harmonie de cinéma ou non", a:["cinéma",S=>{S.mus.cine="merveilleux"; S.mus.cineAmt=0.5;}], b:["sans",S=>{S.mus.cine="off";}]},
  {id:"modele", n:"Modèle physique ou synthèse classique", a:["physique",S=>{S.mus.model="physique";}], b:["classique",S=>{S.mus.model="classique";}]},
  {id:"exigence", n:"Exigence ou premier tirage", a:["exigence",S=>{S.mus.crit=0.8;}], b:["premier tirage",S=>{S.mus.crit=0;}]}
];
const BANC={trial:null, ctx:null, src:null, busy:false, dur:30};
const bancLoad=k=>{ try{ const v=JSON.parse(localStorage.getItem(k)||"[]"); return Array.isArray(v)?v:[]; }catch(e){ return []; } };
const bancSave=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };

/* ---------- notes en séance ---------- */
function seanceNote(kind){
  const l=bancLoad("bourdon.seance");
  l.push({date:new Date().toISOString(), note:kind, scene:(typeof SCENE!=="undefined"&&SCENE.name)||"", univers:(typeof seekUni==="function"?seekUni():""), tension:+(+S.tension).toFixed(2),
    emotions:(typeof AFF!=="undefined"?[...AFF.sel].join(" "):""), sousLaVoix:!!(typeof VOIX!=="undefined"&&VOIX.under), joue:!!live});
  bancSave("bourdon.seance",l); seanceUI(kind);
}
function seanceUI(last){
  const n=$("seanceN"); if(!n) return; const l=bancLoad("bourdon.seance"), p=l.filter(x=>x.note==="porte").length, d=l.length-p;
  n.textContent=l.length?(last?(last==="porte"?"Noté : ça porte. ":"Noté : ça distrait. "):"")+p+" porte, "+d+" distrait, à exporter depuis le banc d'écoute.":"";
}

/* ---------- statistiques ---------- */
/* test du signe, bilatéral : probabilité d'un écart au moins aussi grand si les deux versions se valaient */
function signTest(k,n){
  if(n<=0) return 1; const m=Math.min(k,n-k); let c=1, s=0;
  for(let i=0;i<=m;i++){ if(i>0) c=c*(n-i+1)/i; s+=c; }
  return Math.min(1,2*s/Math.pow(2,n));
}
function bancStats(){
  const l=bancLoad("bourdon.banc"), out=[];
  BANC_F.forEach(f=>{ const t=l.filter(x=>x.facteur===f.id); if(!t.length) return;
    const pa=t.filter(x=>x.pref===f.a[0]).length, pb=t.filter(x=>x.pref===f.b[0]).length, eq=t.length-pa-pb;
    const mean=v=>{ const z=t.map(x=>x.notes[v]).filter(x=>x>0); return z.length?z.reduce((a,b)=>a+b,0)/z.length:0; };
    out.push({f, n:t.length, pa, pb, eq, p:signTest(pa,pa+pb), ma:mean(f.a[0]), mb:mean(f.b[0])}); });
  return out;
}

/* ---------- essai à l'aveugle ---------- */
/* même pièce, même graine, une seule différence ; les deux rendus sont ramenés au même niveau efficace, pour que le plus fort ne gagne pas d'office */
async function bancPrepare(){
  if(BANC.busy) return; const fsel=$("bancF"), psel=$("bancP"), f=BANC_F.find(x=>x.id===fsel.value)||BANC_F[0];
  let pr=PRESETS.find(p=>p[0]===psel.value); if(!pr){ const u=UNIVERS.find(x=>x.id===seekUni())||UNIVERS[0]; pr=u.items[Math.floor(Math.random()*u.items.length)]; pr=[pr[0],pr[1],pr[2]]; }
  BANC.busy=true; bancStop(); const st=$("bancSt"); const seed=newSeed(), swap=Math.random()<0.5;
  const mk=v=>{ const Sx=merge(clone(DEFAULT),clone(pr[1])); Sx.seed=seed; v[1](Sx); return Sx; };
  try{
    st.textContent="Rendu de la première version…"; const r1=await renderOffline(mk(swap?f.b:f.a),BANC.dur,{});
    st.textContent="Rendu de la seconde version…"; const r2=await renderOffline(mk(swap?f.a:f.b),BANC.dur,{});
    const rms=r=>{ let s=0,n=0; const a=Math.floor(r.sr*3); for(let i=a;i<r.L.length;i++){ s+=r.L[i]*r.L[i]+r.R[i]*r.R[i]; n+=2; } return Math.sqrt(s/Math.max(1,n))||1e-9; };
    const g1=rms(r1), g2=rms(r2), ref=Math.min(g1,g2);
    BANC.trial={f, preset:pr[0], seed, swap, A:{...r1,gain:ref/g1}, B:{...r2,gain:ref/g2}, labelA:(swap?f.b:f.a)[0], labelB:(swap?f.a:f.b)[0]};
    st.textContent="Prêt : écoute A et B, dans l'ordre que tu veux, autant de fois qu'il faut. Ambiance "+pr[0]+".";
  }catch(e){ st.textContent="Le rendu a échoué : "+(e&&e.message||e); BANC.trial=null; }
  BANC.busy=false; bancUI();
}
function bancPlay(which){
  const tr=BANC.trial; if(!tr) return; bancStop();
  const AC=window.AudioContext||window.webkitAudioContext; if(!BANC.ctx) BANC.ctx=new AC();
  const c=BANC.ctx, r=tr[which], b=c.createBuffer(2,r.L.length,r.sr); b.getChannelData(0).set(r.L); b.getChannelData(1).set(r.R);
  const s=c.createBufferSource(), g=c.createGain(); g.gain.value=r.gain; s.buffer=b; s.connect(g); g.connect(c.destination); s.start(); BANC.src=s; BANC.playing=which;
  s.onended=()=>{ if(BANC.src===s){ BANC.src=null; BANC.playing=null; bancUI(); } }; bancUI();
}
function bancStop(){ if(BANC.src){ try{ BANC.src.stop(); }catch(e){} BANC.src=null; } BANC.playing=null; }
function bancValidate(){
  const tr=BANC.trial; if(!tr) return; const na=+$("bancNA").value||0, nb=+$("bancNB").value||0, pf=(document.querySelector('input[name="bancPref"]:checked')||{}).value||"";
  if(!na||!nb||!pf){ $("bancSt").textContent="Note A et B, et dis ta préférence, avant de valider."; return; }
  const notes={}; notes[tr.labelA]=na; notes[tr.labelB]=nb;
  const pref=pf==="A"?tr.labelA:pf==="B"?tr.labelB:"égal";
  const l=bancLoad("bourdon.banc"); l.push({date:new Date().toISOString(), auditeur:($("bancWho").value||"").trim(), facteur:tr.f.id, ambiance:tr.preset, graine:tr.seed, A:tr.labelA, B:tr.labelB, notes, pref});
  bancSave("bourdon.banc",l); bancStop();
  $("bancSt").textContent="Enregistré. A était « "+tr.labelA+" », B était « "+tr.labelB+" ». Ta préférence : "+pref+".";
  BANC.trial=null; bancUI();
}
/* ---------- export ---------- */
const csvCell=v=>{ const s=String(v===undefined||v===null?"":v); return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
const csv=(rows,cols)=>[cols.join(";")].concat(rows.map(r=>cols.map(c=>csvCell(r[c])).join(";"))).join("\n");
function bancExport(){
  const tri=bancLoad("bourdon.banc").map(x=>({...x, noteA:x.notes[x.A], noteB:x.notes[x.B]})), se=bancLoad("bourdon.seance");
  const files=[{name:"essais.csv", data:new TextEncoder().encode(csv(tri,["date","auditeur","facteur","ambiance","graine","A","B","noteA","noteB","pref"]))},
    {name:"seance.csv", data:new TextEncoder().encode(csv(se,["date","note","scene","univers","tension","emotions","sousLaVoix","joue"]))}];
  saveFiles(files,"bourdon_ecoute_"+new Date().toISOString().slice(0,10));
}
function bancClear(){ if(!confirm("Effacer tous les essais et les notes de séance de ce navigateur ?")) return; bancSave("bourdon.banc",[]); bancSave("bourdon.seance",[]); seanceUI(); bancUI(); }
/* ---------- interface ---------- */
function bancUI(){
  const box=$("banc"); if(!box) return; const tr=BANC.trial;
  ["bancA","bancB"].forEach((id,i)=>{ const b=$(id); b.disabled=!tr; b.setAttribute("aria-pressed",BANC.playing===(i?"B":"A")?"true":"false"); });
  $("bancGo").disabled=BANC.busy; $("bancOk").disabled=!tr; $("bancStop").disabled=!BANC.src;
  const r=$("bancRes"), st=bancStats();
  r.innerHTML=st.length?'<table class="aff-table"><caption>Bilan des essais</caption><thead><tr><th>Comparaison</th><th>Essais</th><th>Préférences</th><th>Notes moyennes</th><th>Hasard ?</th></tr></thead><tbody>'+
    st.map(x=>"<tr><th scope=\"row\">"+x.f.n+"</th><td>"+x.n+"</td><td>"+x.f.a[0]+" "+x.pa+" · "+x.f.b[0]+" "+x.pb+" · égal "+x.eq+"</td><td>"+x.ma.toFixed(1).replace(".",",")+" contre "+x.mb.toFixed(1).replace(".",",")+"</td><td>p = "+x.p.toFixed(2).replace(".",",")+(x.p<0.05?" : écart net":x.n<10?" : trop peu d'essais":" : pas d'écart net")+"</td></tr>").join("")+"</tbody></table>"
    :'<p class="hint">Aucun essai pour l\'instant. Dix essais par comparaison donnent une première idée ; une vingtaine, avec plusieurs auditeurs, un avis solide.</p>';
}
function bancOpen(on){
  const b=$("banc"); if(!b) return; b.hidden=!on; if(!on){ bancStop(); return; }
  const ps=$("bancP"); if(ps&&!ps.options.length){ ps.add(new Option("Au hasard dans l'univers","")); PRESETS.forEach(p=>ps.add(new Option(p[0]+" ("+(UNIVERS.find(u=>u.id===p[3])||{name:""}).name+")",p[0]))); }
  bancUI(); $("bancF").focus();
}
function bancBuild(){
  if($("banc")) return;
  const d=document.createElement("div"); d.className="banc"; d.id="banc"; d.hidden=true; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","bancT");
  d.innerHTML='<div class="banc-in"><h2 id="bancT">Banc d\'écoute</h2>'+
    '<p class="hint">Deux versions d\'une même pièce, une seule différence, au même niveau, dans un ordre tiré au sort. Écoute A et B, note chacune, dis ta préférence : tu découvres ensuite laquelle était laquelle. Protocole complet dans ECOUTE.md.</p>'+
    '<div class="banc-row"><div class="ctl"><label for="bancF">Comparaison</label><select id="bancF">'+BANC_F.map(f=>'<option value="'+f.id+'">'+f.n+'</option>').join("")+'</select></div>'+
    '<div class="ctl"><label for="bancP">Ambiance</label><select id="bancP"></select></div>'+
    '<div class="ctl"><label for="bancWho">Auditeur</label><input id="bancWho" type="text" maxlength="24" placeholder="initiales"></div></div>'+
    '<div class="banc-row"><button class="btn main" id="bancGo" type="button">Préparer un essai</button><button class="btn" id="bancA" type="button" aria-pressed="false">Écouter A</button><button class="btn" id="bancB" type="button" aria-pressed="false">Écouter B</button><button class="btn" id="bancStop" type="button">Arrêter</button></div>'+
    '<p class="hint" id="bancSt" aria-live="polite">Choisis une comparaison et une ambiance, puis prépare un essai (une minute de rendu environ).</p>'+
    '<div class="banc-row"><div class="ctl"><label for="bancNA">A porte la scène</label><select id="bancNA"><option value="">…</option><option value="1">1 : distrait</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 : porte la scène</option></select></div>'+
    '<div class="ctl"><label for="bancNB">B porte la scène</label><select id="bancNB"><option value="">…</option><option value="1">1 : distrait</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 : porte la scène</option></select></div>'+
    '<fieldset class="banc-pref"><legend>Préférence</legend><label><input type="radio" name="bancPref" value="A"> A</label><label><input type="radio" name="bancPref" value="B"> B</label><label><input type="radio" name="bancPref" value="="> pareil</label></fieldset>'+
    '<button class="btn" id="bancOk" type="button">Valider et découvrir</button></div>'+
    '<div id="bancRes"></div>'+
    '<div class="banc-row"><button class="btn" id="bancExp" type="button">Exporter (CSV)</button><button class="btn" id="bancClr" type="button">Tout effacer</button><button class="btn" id="bancClose" type="button">Fermer</button></div></div>';
  document.body.appendChild(d);
  $("bancGo").onclick=bancPrepare; $("bancA").onclick=()=>bancPlay("A"); $("bancB").onclick=()=>bancPlay("B"); $("bancStop").onclick=()=>{ bancStop(); bancUI(); };
  $("bancOk").onclick=bancValidate; $("bancExp").onclick=bancExport; $("bancClr").onclick=bancClear; $("bancClose").onclick=()=>bancOpen(false);
  d.addEventListener("keydown",e=>{ if(e.key==="Escape") bancOpen(false); });
  /* le bouton d'ouverture, dans Séance */
  const host=document.querySelector(".seance"); if(host){ const w=document.createElement("div"); w.className="presets bancbox";
    w.innerHTML='<div class="ctl"><label>Écoute</label><button class="lnk" id="bancOpen" type="button">Banc d\'écoute à l\'aveugle</button></div>'; host.appendChild(w); $("bancOpen").onclick=()=>bancOpen(true); }
  /* les notes en séance, dans À la table */
  const vb=$("voixBox"); if(vb){ const w=document.createElement("div"); w.className="seance-note";
    w.innerHTML='<span class="seance-btns"><button class="btn" id="seancePorte" type="button" title="Note l\'instant : la musique porte la scène. L\'ambiance, la tension et les émotions sont notées avec.">Ça porte</button><button class="btn" id="seanceDistrait" type="button" title="Note l\'instant : la musique distrait.">Ça distrait</button></span><p class="hint" id="seanceN" aria-live="polite"></p>';
    vb.appendChild(w); $("seancePorte").onclick=()=>seanceNote("porte"); $("seanceDistrait").onclick=()=>seanceNote("distrait"); seanceUI(); }
}
