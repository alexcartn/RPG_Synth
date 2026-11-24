"use strict";
/* ============================================================
   LEITMOTIV : des motifs attachés aux personnages, aux lieux, aux factions
   Ils suivent la table d'une scène à l'autre : le moteur les joue dans le mode de la scène,
   transformés selon la tension et la couleur (voir leitPhrase dans engine.js).
   ============================================================ */
const LEIT={list:[], active:null, form:"auto", presence:"appel", pending:false, lastTxt:""};
const LEIT_KEY="bourdon.leit";
const LEIT_TXT={tel:"tel quel", lointain:"au loin, la tête seule", apaise:"apaisé, deux fois plus lent", tendu:"tendu, la tête en marche qui monte", menace:"menaçant, renversé une octave plus bas", glorieux:"glorieux, plus fort, la dernière note tenue"};
const LEIT_FORM_OPTS=[["auto","Selon la scène"],["tel","Tel quel"],["lointain","Lointain"],["apaise","Apaisé"],["tendu","Tendu"],["menace","Menaçant"],["glorieux","Glorieux"]];
const LEIT_PRES_OPTS=[["appel","Quand je l'appelle"],["rare","Revient de temps en temps"],["souvent","Revient souvent"]];
(()=>{ try{ const v=JSON.parse(localStorage.getItem(LEIT_KEY)||"{}");
  if(Array.isArray(v.list)) LEIT.list=v.list.filter(m=>m&&Array.isArray(m.degs)&&m.degs.length>=2);
  if(v.active) LEIT.active=v.active; if(v.form) LEIT.form=v.form; if(v.presence) LEIT.presence=v.presence; }catch(e){} })();
function leitSave(){ try{ localStorage.setItem(LEIT_KEY,JSON.stringify({list:LEIT.list,active:LEIT.active,form:LEIT.form,presence:LEIT.presence})); }catch(e){} }
const leitCur=()=>LEIT.list.find(m=>m.id===LEIT.active)||null;
/* ce que lit le moteur ; à l'export, seuls les retours d'eux-mêmes comptent (pas d'appel) */
function leitState(){ const m=leitCur(); if(!m) return null; LEIT.motif=m; return LEIT; }
function leitOpts(exp){
  if(!exp) return leitState;
  const m=leitCur(); if(!m||LEIT.presence==="appel") return null;
  const L={motif:m, form:LEIT.form, presence:LEIT.presence, pending:false}; return ()=>L;
}
/* notation : degrés à partir de 1 (1 = la tonique, 8 = l'octave, 0 = le degré sous la tonique), durées en croches */
const leitDegTxt=m=>m.degs.map(d=>d+1).join(" ");
const leitRhTxt=m=>m.rh.join(" ");
function leitParse(deg,rh){
  const ds=String(deg).split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite).slice(0,12).map(v=>Math.round(v)-1);
  const rs=String(rh).split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite).map(v=>Math.max(1,Math.min(16,Math.round(v))));
  if(ds.length<2) return null;
  return {degs:ds, rh:ds.map((x,i)=>rs[i]||rs[rs.length-1]||2)};
}
/* tirer un motif : court, un saut au début ou au milieu, une fin sur une note stable */
function leitDraw(){
  const RH=[[2,1,1,4],[1,1,2,4],[3,1,2,2,4],[2,2,1,1,4],[1,2,1,2,4],[3,1,4],[2,1,1,2,2,4],[4,2,2,4]];
  const rh=RH[Math.floor(Math.random()*RH.length)].slice(), n=rh.length, degs=[[0,0,4,2,7][Math.floor(Math.random()*5)]];
  const leapAt=Math.random()<0.6?1:Math.floor(n/2);
  for(let k=1;k<n;k++){
    const prev=degs[k-1];
    let st=k===leapAt?(Math.random()<0.5?1:-1)*(3+Math.floor(Math.random()*2)):(Math.random()<0.7?(Math.random()<0.5?-1:1):(Math.random()<0.5?-2:2));
    if(k===leapAt+1) st=-Math.sign(degs[k-1]-degs[k-2]||1)*(Math.random()<0.7?1:2); /* après un saut, on revient par degré */
    degs.push(Math.max(-3,Math.min(9,prev+st)));
  }
  const st=[0,2,4,7]; let last=degs[n-1], b=0, bd=99; st.forEach(x=>{ if(Math.abs(x-last)<bd){ bd=Math.abs(x-last); b=x; } }); degs[n-1]=b;
  if(degs[n-2]===b) degs[n-2]=b+(b>0?-1:1);
  return {degs,rh};
}
function leitNew(m,name){
  const id="m"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
  const it={id,name:name||("Motif "+(LEIT.list.length+1)),degs:m.degs,rh:m.rh}; LEIT.list.push(it); LEIT.active=id; leitSave(); leitUI(); return it;
}
function leitCallNow(){
  const m=leitCur(), st=$("leitSt"); if(!m) return;
  if(!live){ if(st) st.textContent="Lance la lecture, puis appelle le motif."; return; }
  const dt=live.eng.leitCall();
  if(st&&dt>=0) st.textContent=(m.name||"Le motif")+" entre dans "+Math.max(1,Math.round(dt))+" s.";
}
/* le moteur dit quel motif il joue et comment */
function leitHeard(x){
  const st=$("leitSt"); if(!st) return;
  const now=live?live.ctx.currentTime:0, d=Math.max(0,x.t-now);
  const txt=(x.name||"Le motif")+" : "+(LEIT_TXT[x.form]||x.form)+(x.call?"":", revenu de lui-même")+".";
  LEIT.lastTxt=txt;
  setTimeout(()=>{ if(LEIT.lastTxt===txt) st.textContent=txt; },Math.round(d*1000));
}
function leitUI(){
  const sel=$("leitSel"); if(!sel) return;
  sel.innerHTML=""; if(!LEIT.list.length){ const o=document.createElement("option"); o.value=""; o.textContent="Aucun motif"; sel.appendChild(o); }
  LEIT.list.forEach(m=>{ const o=document.createElement("option"); o.value=m.id; o.textContent=m.name; sel.appendChild(o); });
  const m=leitCur(); sel.value=m?m.id:"";
  $("leitForm").value=LEIT.form; $("leitPres").value=LEIT.presence;
  $("leitCall").disabled=!m||!live; $("leitDel").disabled=!m; $("leitGrab").disabled=!live;
  $("leitName").value=m?m.name:""; $("leitDeg").value=m?leitDegTxt(m):""; $("leitRh").value=m?leitRhTxt(m):"";
  ["leitName","leitDeg","leitRh"].forEach(k=>{ $(k).disabled=!m; });
}
function leitBuild(){
  const bar=document.querySelector(".jeu-bar"); if(!bar||$("leitBox")) return;
  const w=document.createElement("div"); w.className="leit"; w.id="leitBox"; w.setAttribute("role","group"); w.setAttribute("aria-label","Leitmotiv");
  const opts=a=>a.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join("");
  w.innerHTML='<span class="seek-l">Leitmotiv</span>'+
    '<select id="leitSel" aria-label="Motif" title="Le motif d\'un personnage, d\'un lieu, d\'une faction. Il te suit d\'une scène à l\'autre et prend le mode de chaque scène."></select>'+
    '<button class="btn" id="leitCall" type="button" disabled title="La phrase en cours s\'efface, le motif entre à la mesure suivante, transformé selon la scène.">Appeler</button>'+
    '<select id="leitForm" aria-label="Transformation" title="Selon la scène : la tension, la couleur du mode et le moment de la pièce choisissent. Calme : apaisé ; tension en mode sombre : menaçant ; tension en mode clair : tendu ; apogée : glorieux.">'+opts(LEIT_FORM_OPTS)+'</select>'+
    '<select id="leitPres" aria-label="Retours" title="Le motif peut revenir de lui-même, souvent au loin, comme un souvenir. Les retours sont aussi rendus dans l\'export ; les appels, en direct seulement.">'+opts(LEIT_PRES_OPTS)+'</select>'+
    '<details class="leit-more"><summary>Graver, tirer, retoucher</summary>'+
      '<div class="row"><button class="lnk" id="leitGrab" type="button" disabled title="La dernière phrase de la mélodie devient un motif.">Graver la dernière phrase</button><button class="lnk" id="leitDraw" type="button" title="Un motif court tiré au hasard : un saut, puis un retour par degrés, une fin sur une note stable.">Tirer un motif</button><button class="lnk" id="leitDel" type="button" disabled>Supprimer</button></div>'+
      '<div class="ctl"><label for="leitName">Nom</label><input type="text" id="leitName" maxlength="40" placeholder="Le roi-liche, la taverne, l\'ordre du Lys…"></div>'+
      '<div class="ctl"><label for="leitDeg">Degrés</label><input type="text" id="leitDeg" inputmode="numeric" title="1 = la tonique, 5 = la quinte, 8 = l\'octave, 0 = le degré sous la tonique. Le mode de la scène donne les hauteurs." placeholder="1 5 4 3 1"></div>'+
      '<div class="ctl"><label for="leitRh">Durées</label><input type="text" id="leitRh" inputmode="numeric" title="En croches : 1 = croche, 2 = noire, 4 = blanche." placeholder="2 1 1 2 4"></div>'+
      '<p class="hint">Les degrés suivent le mode de la scène : le même motif sonne majeur dans la taverne et phrygien dans la crypte.</p>'+
    '</details>'+
    '<p class="hint" id="leitSt" aria-live="polite"></p>';
  bar.appendChild(w);
  $("leitSel").onchange=e=>{ LEIT.active=e.target.value||null; leitSave(); leitUI(); };
  $("leitForm").onchange=e=>{ LEIT.form=e.target.value; leitSave(); };
  $("leitPres").onchange=e=>{ LEIT.presence=e.target.value; leitSave(); };
  $("leitCall").onclick=leitCallNow;
  $("leitDraw").onclick=()=>{ leitNew(leitDraw()); const st=$("leitSt"); if(st) st.textContent=live?"Motif tiré : appelle-le pour l'entendre.":"Motif tiré."; };
  $("leitGrab").onclick=()=>{ if(!live) return; const g=live.eng.leitGrab(), st=$("leitSt"); if(!g){ if(st) st.textContent="Pas encore de phrase à graver."; return; } leitNew(g); if(st) st.textContent="La dernière phrase est gravée."; };
  $("leitDel").onclick=()=>{ const m=leitCur(); if(!m) return; LEIT.list=LEIT.list.filter(x=>x!==m); LEIT.active=LEIT.list.length?LEIT.list[LEIT.list.length-1].id:null; leitSave(); leitUI(); };
  $("leitName").oninput=e=>{ const m=leitCur(); if(!m) return; m.name=e.target.value.trim()||"Motif"; leitSave(); const o=[...$("leitSel").options].find(x=>x.value===m.id); if(o) o.textContent=m.name; };
  const edit=()=>{ const m=leitCur(); if(!m) return; const p=leitParse($("leitDeg").value,$("leitRh").value); if(!p) return; m.degs=p.degs; m.rh=p.rh; leitSave(); };
  $("leitDeg").onchange=edit; $("leitRh").onchange=edit;
  leitUI();
}
