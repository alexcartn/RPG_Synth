"use strict";
/* ============================================================
   STUDIO : l'interface. Vue Session (pistes × scènes, clips qu'on lance), détail du clip
   (harmonie, générateur, piano roll, séquenceur), chaîne d'appareils, arrangement, conseils.
   ============================================================ */
(()=>{
  const $=id=>document.getElementById(id);
  const el=(tag,cls,html)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; };
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const KEY="bourdon.studio.v1";
  const INSTS=[["luth","Luth"],["harpe","Harpe"],["flute","Flûte"],["carillon","Carillon"],["orgue","Orgue positif"],["roues","Orgue à roues"],["oud","Oud"],["ney","Ney"],["kalimba","Kalimba"],["bol","Bol chantant"],["verre","Cloches de verre"],["synthe","Synthé doux"],["archet","Archet (violon, viole)"],["cuivre","Cor sombre"],["guitare","Guitare"],["piano","Piano de bastringue"],["fmpiano","Piano électrique FM"],["fmcloche","Cloches FM"],["accordeon","Accordéon"],["voix","Voix (vocalise)"],["chant","Chant (latin)"],["aulos","Aulos"],["lyre","Lyre"],["syrinx","Syrinx"],["cornu","Cornu"],["hydraulis","Hydraulis"],["sifflet","Sifflet"],["harmonica","Harmonica"],["basse","Basse synthé"]];
  const PADS=[["machine","Machine à cordes"],["choeur","Chœur"],["cordes","Cordes"],["orgue","Orgue (plein-jeu)"],["synthe","Synthé doux"],["verre","Verre"],["vecteur","Vectorielle"],["essaim","Essaim de scies"],["phase","Distorsion de phase"],["roues","Orgue à roues"],["grattee","Guitare grattée"]];
  const KITS=[["taiko","Grand tambour"],["cadre","Tambour sur cadre"],["caisse","Caisse claire, grosse caisse"],["antique","Antique (tympanon, crotales)"],["darbouka","Darbouka"],["electro","Boîte à rythmes"],["bastringue","Balais"]];
  const PARTS=[["stomp","Grave"],["tap","Frappe"],["shaker","Remplissage"]];
  const INST_TIP={machine:"La machine à cordes : le son roi du dungeon synth des années 90. Ajoute un Chorus en mode Ensemble pour l'effet complet.",choeur:"Chœur d'hommes : solennel, idéal en bourdon ou en nappe grave.",harpe:"Harpe pincée : l'instrument d'arpège par excellence.",flute:"Flûte : mélodie pure, médiévale. Garde-la dans le médium-aigu.",orgue:"Orgue : sacré, massif. Attention au grave, coupe sous 150 Hz si une basse joue.",carillon:"Carillon : mélodie rare et lointaine, superbe en dark ambient avec beaucoup de réverb.",vecteur:"Nappe vectorielle : quatre timbres qui tournent, parfait pour une texture qui ne reste jamais figée.",essaim:"Essaim de scies : épais et vivant, pour les textures sombres.",basse:"Basse synthé : toujours ramenée dans le grave. Un seul élément doit tenir le grave.",archet:"Archet : mélodie expressive, triste. Laisse-le respirer avec des notes longues."};
  let P=load()||PJ.template("dungeon"), ctx=null, graph=null, TR=null;
  const UI={view:"session", tab:"clip", t:0, r:0, focus:"clip", sel:null, chordSel:-1, grid:0.5, scaleOnly:true, kbOct:0, arrCur:0, arrSel:null, zoom:28, selNotes:new Set(), dirty:{}, cells:{}, menuFor:null};
  const undo=[], redo=[];
  if(!P.sel) P.sel={t:0,r:0}; UI.t=Math.min(P.sel.t,P.tracks.length-1); UI.r=P.sel.r||0;

  /* ---------- persistance et annulation ---------- */
  function load(){ try{ const s=localStorage.getItem(KEY); if(!s) return null; const p=JSON.parse(s); return p&&p.tracks?p:null; }catch(e){ return null; } }
  let saveT=0; function save(){ clearTimeout(saveT); saveT=setTimeout(()=>{ try{ P.sel={t:UI.t,r:UI.r}; localStorage.setItem(KEY,JSON.stringify(P)); }catch(e){} },300); }
  function snap(){ undo.push(JSON.stringify(P)); if(undo.length>80) undo.shift(); redo.length=0; undoUI(); }
  function swapTo(json){ P=JSON.parse(json); if(graph){ graph.setP(P); graph.sync(); } UI.t=Math.min(UI.t,P.tracks.length-1); UI.r=Math.min(UI.r,P.scenes.length-1); renderAll(); save(); }
  function doUndo(){ if(!undo.length) return; redo.push(JSON.stringify(P)); swapTo(undo.pop()); undoUI(); }
  function doRedo(){ if(!redo.length) return; undo.push(JSON.stringify(P)); swapTo(redo.pop()); undoUI(); }
  function undoUI(){ $("bUndo").disabled=!undo.length; $("bRedo").disabled=!redo.length; }
  /* une modification : instantané, changement, puis ce qu'il faut redessiner */
  function edit(fn,what){ snap(); fn(); changed(what); }
  function changed(what){ what=what||"all"; save(); if(graph){ if(what==="soft") graph.soft(); else graph.sync(); }
    if(what==="soft") return;
    if(what==="all"){ renderAll(); return; }
    what.split(" ").forEach(w=>{ if(w==="session") renderSession(); if(w==="detail") renderDetail(); if(w==="conseils") renderConseils(); if(w==="arr") renderArr(); if(w==="gamme") renderGamme(); if(w==="top") renderTop(); }); }
  const toast=(m)=>{ const t=$("toast"); t.textContent=m; t.classList.add("on"); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove("on"),2600); };

  /* ---------- audio ---------- */
  function audio(){
    if(graph){ if(ctx.state==="suspended") ctx.resume(); return graph; }
    const AC=window.AudioContext||window.webkitAudioContext; ctx=new AC({latencyHint:"interactive"});
    if(typeof fxLoad==="function") fxLoad(ctx);
    graph=SON.makeGraph(ctx,P);
    TR=SON.Transport(()=>P,graph,{state:()=>{ UI.dirty.state=true; renderTopState(); },recorded:a=>{ snap(); P.arr=a; save(); toast("Arrangement enregistré : "+a.len+" mesures. Vue Arrangement pour le retoucher."); renderArr(); renderConseils(); }});
    return graph;
  }
  const curT=()=>P.tracks[UI.t];
  const curClip=()=>{ const t=curT(); return t&&t.clips[UI.r]; };
  const ctxP=()=>PJ.ctxOf(P);
  const harmOf=row=>PJ.harmFor(P,row);

  /* ---------- boutons rotatifs ---------- */
  function knob(o){
    const w=el("div","knob"+(o.sm?" sm":"")), min=o.min, max=o.max, lg=!!o.log&&min>0;
    const norm=v=>lg?Math.log(v/min)/Math.log(max/min):(v-min)/(max-min), real=n=>{ let v=lg?min*Math.pow(max/min,n):min+(max-min)*n; if(o.step) v=Math.round(v/o.step)*o.step; return v; };
    w.innerHTML='<svg viewBox="0 0 40 40" role="slider" tabindex="0" aria-label="'+esc(o.label)+'"><path class="trk" d="" fill="none" stroke-width="4" stroke-linecap="round"/><path class="val" d="" fill="none" stroke-width="4" stroke-linecap="round"/><circle class="cap" cx="20" cy="20" r="11"/><line class="ptr" x1="20" y1="20" x2="20" y2="10" stroke-width="2" stroke-linecap="round"/></svg><span class="kl" title="'+esc(o.label)+'">'+esc(o.label)+'</span><span class="kv"></span>';
    const sv=w.querySelector("svg"), kv=w.querySelector(".kv");
    const arc=(a0,a1)=>{ const p=a=>[20+15*Math.cos(a),20+15*Math.sin(a)], s=p(a0), e=p(a1), big=a1-a0>Math.PI?1:0; return "M"+s[0].toFixed(2)+" "+s[1].toFixed(2)+" A15 15 0 "+big+" 1 "+e[0].toFixed(2)+" "+e[1].toFixed(2); };
    const A0=Math.PI*0.75, A1=Math.PI*2.25; sv.querySelector(".trk").setAttribute("d",arc(A0,A1));
    let n=clamp(norm(o.value),0,1);
    const fmt=o.fmt||(v=>(Math.abs(v)<10?v.toFixed(2):Math.round(v))+(o.u?" "+o.u:""));
    function draw(){ const a=A0+(A1-A0)*n, bip=min<0&&max>0, z=bip?A0+(A1-A0)*norm(0):A0; sv.querySelector(".val").setAttribute("d",n>0.001||bip?arc(Math.min(z,a),Math.max(z,a)+0.0001):""); const l=sv.querySelector(".ptr"); l.setAttribute("x2",(20+9*Math.cos(a)).toFixed(2)); l.setAttribute("y2",(20+9*Math.sin(a)).toFixed(2)); kv.textContent=fmt(real(n)); sv.setAttribute("aria-valuetext",kv.textContent); }
    draw();
    const set=(nn,fin)=>{ n=clamp(nn,0,1); draw(); o.on(real(n),fin); };
    sv.addEventListener("pointerdown",e=>{ e.preventDefault(); sv.setPointerCapture(e.pointerId); if(o.begin) o.begin(); const y0=e.clientY, n0=n;
      const mv=ev=>set(n0+(y0-ev.clientY)/(ev.shiftKey?600:150)), up=()=>{ sv.removeEventListener("pointermove",mv); sv.removeEventListener("pointerup",up); o.on(real(n),true); };
      sv.addEventListener("pointermove",mv); sv.addEventListener("pointerup",up); });
    sv.addEventListener("dblclick",()=>{ if(o.def===undefined) return; if(o.begin) o.begin(); set(norm(o.def),true); });
    sv.addEventListener("wheel",e=>{ e.preventDefault(); if(o.begin&&!w._wh){ o.begin(); w._wh=1; setTimeout(()=>w._wh=0,800); } set(n-(e.deltaY>0?1:-1)*(e.shiftKey?0.01:0.04),true); },{passive:false});
    sv.addEventListener("keydown",e=>{ const d=e.key==="ArrowUp"||e.key==="ArrowRight"?1:e.key==="ArrowDown"||e.key==="ArrowLeft"?-1:0; if(!d) return; e.preventDefault(); if(o.begin) o.begin(); set(n+d*(e.shiftKey?0.01:0.04),true); });
    w.setV=v=>{ n=clamp(norm(v),0,1); draw(); };
    return w;
  }
  const fmtHz=v=>v>=1000?(v/1000).toFixed(1)+" kHz":Math.round(v)+" Hz";
  const fmtU=u=>u==="%"?(v=>Math.round(v*100)+" %"):u==="Hz"?fmtHz:u==="dB"?(v=>(v>0?"+":"")+v.toFixed(1)+" dB"):u==="ms"?(v=>Math.round(v)+" ms"):u==="s"?(v=>v.toFixed(1)+" s"):(v=>v<10?v.toFixed(2):Math.round(v)+"");
  function sel(opts,val,fn,label){ const s=el("select"); if(label) s.setAttribute("aria-label",label); opts.forEach(o=>{ if(o.group){ const g=el("optgroup"); g.label=o.group; o.items.forEach(([v,n])=>{ const op=el("option"); op.value=v; op.textContent=n; g.appendChild(op); }); s.appendChild(g); } else { const op=el("option"); op.value=o[0]; op.textContent=o[1]; s.appendChild(op); } }); s.value=String(val); s.onchange=()=>fn(s.value); return s; }
  function btn(txt,fn,cls,title){ const b=el("button","btn"+(cls?" "+cls:""),txt); b.type="button"; if(title) b.title=title; b.onclick=fn; return b; }
  function lab(txt,ctl){ const l=el("label"); l.appendChild(document.createTextNode(txt)); l.appendChild(ctl); return l; }

  /* ---------- menu contextuel ---------- */
  function menu(x,y,items){
    const m=$("menu"); m.innerHTML=""; items.forEach(it=>{ if(it.h){ m.appendChild(el("div","mh",esc(it.h))); return; } const b=el("button","",esc(it.t)); b.type="button"; b.onclick=()=>{ hideMenu(); it.f(); }; m.appendChild(b); });
    m.hidden=false; const r=m.getBoundingClientRect(); m.style.left=Math.min(x,innerWidth-r.width-8)+"px"; m.style.top=Math.min(y,innerHeight-r.height-8)+"px"; const f=m.querySelector("button"); if(f) f.focus();
  }
  function hideMenu(){ $("menu").hidden=true; }
  document.addEventListener("pointerdown",e=>{ if(!$("menu").hidden&&!$("menu").contains(e.target)) hideMenu(); });

  /* ============================================================ EN-TÊTE ============================================================ */
  function renderTop(){
    $("pName").value=P.name; $("iTempo").value=P.tempo; $("sMeter").value=P.meter; $("sQuant").value=String(P.quant);
    document.querySelectorAll(".views button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===UI.view?"true":"false"));
    $("session").hidden=UI.view!=="session"; $("arrange").hidden=UI.view!=="arr";
    renderTopState(); undoUI();
  }
  function renderTopState(){ $("bPlay").setAttribute("aria-pressed",TR&&TR.X.playing?"true":"false"); $("bRec").setAttribute("aria-pressed",TR&&TR.X.rec?"true":"false"); }

  /* ============================================================ GAMME ============================================================ */
  function renderGamme(){
    const g=$("gamme"), M=TH.MODES[P.mode]; g.innerHTML="";
    g.appendChild(el("span","lbl","I · Gamme"));
    g.appendChild(sel(TH.NOM.map((n,i)=>[i,n]),P.key,v=>setKey(+v),"Tonique"));
    g.appendChild(sel([{group:"Modes",items:TH.ORDRE.slice(0,8).map(k=>[k,TH.MODES[k].n])},{group:"Couleurs",items:TH.ORDRE.slice(8).map(k=>[k,TH.MODES[k].n])}],P.mode,v=>{ edit(()=>{ P.mode=v; P.step=Math.max(P.step||0,1); UI.focus="gamme"; },"all"); },"Mode"));
    const nt=el("div","notes"); M.iv.forEach((iv,i)=>{ const c=el("button","chip"+(iv===0?" ton":"")+(iv===M.car?" car":""),TH.nomNote(P.key+iv)+"<small>"+(i+1)+"</small>"); c.type="button"; c.title=iv===0?"Tonique":iv===M.car?"Note caractéristique : "+M.carN:"Degré "+(i+1); c.onclick=()=>{ audio(); graph.previewInst({k:"inst",name:"harpe"},60+P.key+iv,0.7,1.2); }; nt.appendChild(c); }); g.appendChild(nt);
    g.appendChild(btn("▷ Gamme",()=>playScale(),"sm","Écouter la gamme"));
    g.appendChild(btn("▷ Accords",()=>playChords(),"sm","Écouter les sept accords de la gamme"));
    const d=el("span","desc",esc(M.couleur)+" · note caractéristique : <b>"+esc(TH.nomNote(P.key+M.car))+"</b> ("+esc(M.carN)+")"); g.appendChild(d);
    g.onclick=e=>{ if(UI.focus!=="gamme"&&e.target.tagName!=="SELECT"){ UI.focus="gamme"; renderConseils(); } };
  }
  function setKey(k){ const d0=((k-P.key)%12+12)%12, d=d0>6?d0-12:d0; edit(()=>{ P.key=k; P.step=Math.max(P.step||0,1); UI.focus="gamme"; P.tracks.forEach(t=>t.clips.forEach(c=>{ if(c&&c.type==="notes") c.notes.forEach(n=>n.p+=d); })); },"all"); }
  function playScale(){ audio(); const M=TH.MODES[P.mode], t0=ctx.currentTime+0.05, s=0.32; [...M.iv,12].forEach((iv,i)=>graph.note({kind:"mel",inst:{k:"inst",name:"harpe"}},{p:60+P.key+iv,v:0.7,d:1.4},t0+i*s,1,null)); }
  function playChords(){ audio(); const M=TH.MODES[P.mode], t0=ctx.currentTime+0.05; TH.diatonic(M.iv).forEach((c,i)=>TH.tones(c,M.iv).forEach(p=>graph.note({kind:"mel",inst:{k:"pad",name:"orgue"}},{p:52+P.key+p,v:0.55,d:1.1},t0+i*1.2,1,null))); }
  function playChord(ch,inst){ audio(); const M=TH.MODES[P.mode], t0=ctx.currentTime+0.03; TH.tones(ch,M.iv).forEach((p,i)=>graph.note({kind:"mel",inst:inst||{k:"pad",name:"orgue"}},{p:(i===0?40:52)+P.key+p,v:0.6,d:1.6},t0,1,null)); }

  /* ============================================================ SESSION ============================================================ */
  function renderSession(){
    const host=$("session"); host.innerHTML=""; UI.cells={};
    const N=P.tracks.length, grid=el("div","grid"); grid.style.gridTemplateColumns="repeat("+N+",var(--colw)) 34px var(--colw) var(--colw) 160px";
    /* en-têtes */
    P.tracks.forEach((t,i)=>{ const h=el("div","hd"+(UI.t===i&&UI.focus==="piste"?" sel":""),"<span>"+esc(t.name)+"</span>"); h.style.setProperty("--c",t.color); h.title="Clic : la chaîne d'appareils de la piste. Clic droit : renommer, dupliquer, supprimer.";
      const x=el("button","x","⋯"); x.type="button"; x.setAttribute("aria-label","Menu de la piste "+t.name); x.onclick=e=>{ e.stopPropagation(); trackMenu(i,e.clientX,e.clientY); }; h.appendChild(x);
      h.onclick=()=>{ UI.t=i; UI.focus="piste"; UI.tab="piste"; renderSession(); renderDetail(); renderConseils(); };
      h.oncontextmenu=e=>{ e.preventDefault(); trackMenu(i,e.clientX,e.clientY); }; h.ondblclick=()=>renameTrack(i); grid.appendChild(h); });
    const add=el("button","addcol","+"); add.type="button"; add.title="Ajouter une piste"; add.setAttribute("aria-label","Ajouter une piste"); add.onclick=e=>addTrackMenu(e.clientX,e.clientY); grid.appendChild(add);
    P.ret.forEach((r,i)=>{ const h=el("div","hd"+(UI.focus==="ret"+i?" sel":""),"<span>"+esc(r.name)+"</span>"); h.style.setProperty("--c","var(--ink-3)"); h.onclick=()=>{ UI.focus="ret"+i; UI.tab="piste"; renderSession(); renderDetail(); renderConseils(); }; grid.appendChild(h); });
    const mh=el("div","hd mcol"+(UI.focus==="master"?" sel":""),"<span>Master · Scènes</span>"); mh.style.setProperty("--c","var(--ink)"); mh.onclick=()=>{ UI.focus="master"; UI.tab="piste"; renderSession(); renderDetail(); renderConseils(); }; grid.appendChild(mh);
    /* scènes */
    P.scenes.forEach((s,r)=>{
      P.tracks.forEach((t,i)=>grid.appendChild(slotEl(t,i,r)));
      grid.appendChild(el("div")); grid.appendChild(el("div")); grid.appendChild(el("div"));
      const sc=el("div","scn mcol"+(UI.r===r?" sel":"")), go=el("button","go","▶"); go.type="button"; go.title="Lancer la scène : toute la rangée"; go.setAttribute("aria-label","Lancer la scène "+s.name); go.onclick=()=>{ audio(); TR.launchScene(r); UI.r=r; renderSession(); };
      const nm=el("span","",esc(s.name)); nm.title="Double-clic : renommer"; nm.ondblclick=()=>{ const v=prompt("Nom de la scène",s.name); if(v!==null) edit(()=>s.name=v.trim()||s.name,"session arr"); };
      const x=el("button","go","⋯"); x.type="button"; x.setAttribute("aria-label","Menu de la scène"); x.onclick=e=>sceneMenu(r,e.clientX,e.clientY);
      sc.append(go,nm,x); sc.onclick=e=>{ if(e.target===sc||e.target===nm){ UI.r=r; renderSession(); } }; grid.appendChild(sc);
    });
    /* ajouter une scène */
    for(let i=0;i<N+3;i++) grid.appendChild(el("div"));
    const as=el("button","addcol mcol","+ Scène"); as.type="button"; as.onclick=()=>edit(()=>{ P.scenes.push({name:"Scène "+(P.scenes.length+1)}); P.tracks.forEach(t=>t.clips.push(null)); },"session"); grid.appendChild(as);
    /* arrêts */
    P.tracks.forEach(t=>{ const b=el("button","stp","■"); b.type="button"; b.title="Arrêter la piste"; b.setAttribute("aria-label","Arrêter "+t.name); b.onclick=()=>{ if(TR) TR.stopTrack(t.id); }; const c=el("div","stoprow"); c.appendChild(b); b.style.width="100%"; grid.appendChild(c); });
    grid.appendChild(el("div")); grid.appendChild(el("div")); grid.appendChild(el("div"));
    const sa=el("div","stoprow mcol"), sb=el("button","stp","■ Tout arrêter"); sb.type="button"; sb.style.width="100%"; sb.onclick=()=>{ if(TR) TR.stop(); }; sa.appendChild(sb); grid.appendChild(sa);
    /* mixeur */
    P.tracks.forEach((t,i)=>grid.appendChild(mixEl(t,"t"+i)));
    grid.appendChild(el("div"));
    P.ret.forEach((r,i)=>grid.appendChild(mixEl(r,"r"+i)));
    { const mm=mixEl(P.master,"m"); mm.classList.add("mcol"); grid.appendChild(mm); }
    host.appendChild(grid);
  }
  function slotEl(t,i,r){
    const c=t.clips[r], s=el("div","slot"+(UI.t===i&&UI.r===r&&UI.focus==="clip"?" sel":""));
    s.onclick=()=>{ UI.t=i; UI.r=r; UI.focus="clip"; UI.tab="clip"; UI.chordSel=-1; UI.selNotes.clear(); renderSession(); renderDetail(); renderConseils(); };
    s.oncontextmenu=e=>{ e.preventDefault(); UI.t=i; UI.r=r; clipMenu(i,r,e.clientX,e.clientY); };
    if(!c){ const b=el("button","stp","+"); b.type="button"; b.title="Créer un clip (double-clic)"; b.setAttribute("aria-label","Créer un clip"); b.ondblclick=e=>{ e.stopPropagation(); createClip(i,r); }; b.onclick=e=>{ e.stopPropagation(); UI.t=i; UI.r=r; UI.focus="clip"; UI.tab="clip"; renderSession(); renderDetail(); renderConseils(); }; s.appendChild(b); return s; }
    const cl=el("div","clip"); cl.style.setProperty("--c",t.color);
    const go=el("button","go","▶"); go.type="button"; go.title="Lancer le clip"; go.setAttribute("aria-label","Lancer "+(c.name||"le clip")); go.onclick=e=>{ e.stopPropagation(); audio(); TR.launch(t.id,r); };
    const nm=el("span","nm",esc(clipLabel(t,c))); const bar=el("i","bar");
    nm.ondblclick=e=>{ e.stopPropagation(); const v=prompt("Nom du clip",c.name||""); if(v!==null) edit(()=>c.name=v.trim(),"session detail"); };
    cl.append(go,nm,bar); s.appendChild(cl); UI.cells[t.id+"|"+r]={cl,bar}; return s;
  }
  function clipLabel(t,c){ if(t.kind==="harm") return (c.name||"Accords")+" · "+c.chords.map(ch=>TH.roman(ch)).join(" "); if(c.type==="gen") return (c.name||TH.GEN_N[c.gen])+" ⟳"; return c.name||"Clip"; }
  function mixEl(o,id){
    const m=el("div","mix"), isT=id[0]==="t", kn=el("div","kn3");
    if(isT||id[0]==="r"){ if(isT){ kn.appendChild(knob({label:"Pan",min:-1,max:1,value:o.pan||0,def:0,sm:1,fmt:v=>Math.abs(v)<0.02?"C":(v<0?"G ":"D ")+Math.round(Math.abs(v)*100),begin:snap,on:(v,f)=>{ o.pan=v; changed("soft"); }}));
      kn.appendChild(knob({label:"A",min:0,max:1,value:o.a||0,def:0,sm:1,fmt:v=>Math.round(v*100)+"",begin:snap,on:v=>{ o.a=v; changed("soft"); }}));
      kn.appendChild(knob({label:"B",min:0,max:1,value:o.b||0,def:0,sm:1,fmt:v=>Math.round(v*100)+"",begin:snap,on:v=>{ o.b=v; changed("soft"); }})); } m.appendChild(kn); }
    const bs=el("div","btns");
    const tb=(txt,k,cls,title)=>{ const b=el("button",cls,txt); b.type="button"; b.title=title; b.setAttribute("aria-pressed",o[k]?"true":"false"); b.onclick=()=>edit(()=>{ o[k]=!o[k]; if(k==="arm"&&o[k]) P.tracks.forEach(x=>{ if(x!==o) x.arm=false; }); },"session"); bs.appendChild(b); };
    if(isT||id[0]==="r") tb("M","mute","m","Sourdine");
    if(isT){ tb("S","solo","s","Solo"); if(o.kind==="mel") tb("●","arm","a","Armer : en lecture, ce que tu joues au clavier s'écrit dans le clip « Notes » qui tourne sur cette piste"); }
    m.appendChild(bs);
    const fd=el("div","fad"), r=el("input"); r.type="range"; r.min=-48; r.max=6; r.step=0.5; r.value=o.vol; r.setAttribute("aria-label","Volume "+(o.name||"master"));
    const mt=el("div","meter"), mi=el("i"); mt.appendChild(mi); const db=el("span","db",(o.vol>0?"+":"")+(+o.vol).toFixed(1));
    r.addEventListener("pointerdown",snap); r.addEventListener("keydown",snap,{once:true});
    r.oninput=()=>{ o.vol=+r.value; db.textContent=(o.vol>0?"+":"")+o.vol.toFixed(1); changed("soft"); };
    r.ondblclick=()=>{ snap(); o.vol=0; r.value=0; db.textContent="0.0"; changed("soft"); };
    fd.append(r,mt); m.append(fd,db); UI.cells["mix|"+id]={mi};
    return m;
  }
  function createClip(i,r,kind){
    const t=P.tracks[i];
    if(t.kind==="mel"&&!kind){ const ro=PJ.ROLE[t.role]; kind=ro&&ro.gen?ro.gen:"notes"; }
    edit(()=>{
      if(t.kind==="harm") t.clips[r]={name:"Accords",chords:[{r:0,q:TH.diatonic(TH.MODES[P.mode].iv)[0].q,x:"",b:1}]};
      else if(t.kind==="drums") t.clips[r]=PJ.drumClip(t,1,P.meter);
      else if(kind==="notes") t.clips[r]={name:"Notes",type:"notes",bars:4,notes:[]};
      else t.clips[r]={name:TH.GEN_N[kind],type:"gen",gen:kind,g:{}};
      UI.t=i; UI.r=r; UI.focus="clip"; UI.tab="clip"; UI.chordSel=t.kind==="harm"?0:-1;
    },"all");
  }
  function clipMenu(i,r,x,y){
    const t=P.tracks[i], c=t.clips[r], items=[];
    if(!c){ if(t.kind==="mel"){ items.push({h:"Créer"}); [["notes","Notes (piano roll)"],["nappe","Nappe (suit les accords)"],["bourdon","Bourdon (suit les accords)"],["basse","Basse (suit les accords)"],["arpege","Arpège (suit les accords)"]].forEach(([k,n])=>items.push({t:n,f:()=>createClip(i,r,k)})); }
      else items.push({t:"Créer un clip",f:()=>createClip(i,r)});
      if(UI.clip&&UI.clip.kind===t.kind) items.push({t:"Coller",f:()=>edit(()=>{ t.clips[r]=JSON.parse(UI.clip.json); },"all")});
    } else {
      items.push({t:"Renommer",f:()=>{ const v=prompt("Nom du clip",c.name||""); if(v!==null) edit(()=>c.name=v.trim(),"session detail"); }});
      items.push({t:"Dupliquer dans la scène suivante",f:()=>dupClip(i,r)});
      items.push({t:"Copier",f:()=>{ UI.clip={kind:t.kind,json:JSON.stringify(c)}; toast("Clip copié."); }});
      if(UI.clip&&UI.clip.kind===t.kind) items.push({t:"Coller (remplacer)",f:()=>edit(()=>{ t.clips[r]=JSON.parse(UI.clip.json); },"all")});
      if(c.type==="gen") items.push({t:"Figer en notes (pour retoucher)",f:()=>freeze(i,r)});
      items.push({t:"Supprimer",f:()=>edit(()=>{ t.clips[r]=null; },"all")});
    }
    menu(x,y,items);
  }
  function dupClip(i,r){ const t=P.tracks[i]; edit(()=>{ if(r+1>=P.scenes.length){ P.scenes.push({name:"Scène "+(P.scenes.length+1)}); P.tracks.forEach(x=>x.clips.push(null)); } t.clips[r+1]=JSON.parse(JSON.stringify(t.clips[r])); UI.r=r+1; },"all"); }
  function freeze(i,r){ const t=P.tracks[i], c=t.clips[r], h=harmOf(r); if(!h){ toast("Pas d'harmonie à suivre."); return; } const D=PJ.clipData(P,t,c,h);
    edit(()=>{ t.clips[r]={name:(c.name||"")+" (notes)",type:"notes",bars:Math.max(1,Math.round(D.len/TH.bb(P.meter))),notes:D.notes.map(n=>({...n}))}; },"all"); toast("Clip figé en notes : tu peux maintenant le retoucher au piano roll."); }
  function trackMenu(i,x,y){
    const t=P.tracks[i], items=[{t:"Renommer",f:()=>renameTrack(i)},{t:"Couleur suivante",f:()=>edit(()=>{ const C=["#a3301c","#2f6f5b","#b0801f","#4a5a8a","#7a4a7a","#4a7a8a","#8a6a3a","#5a5a5a","#7a5a2a"]; t.color=C[(C.indexOf(t.color)+1)%C.length]; },"session arr")}];
    if(t.kind!=="harm"){ items.push({t:"Dupliquer la piste",f:()=>edit(()=>{ const c=JSON.parse(JSON.stringify(t)); c.id=PJ.nid("t"); c.name=t.name+" 2"; c.devs.forEach(d=>d.id=PJ.nid("d")); P.tracks.splice(i+1,0,c); },"all")});
      items.push({t:"Supprimer la piste",f:()=>{ if(TR) TR.stopTrack(t.id); edit(()=>{ P.tracks.splice(i,1); delete P.arr.segs[t.id]; UI.t=Math.max(0,Math.min(UI.t,P.tracks.length-1)); },"all"); }}); }
    menu(x,y,items);
  }
  function renameTrack(i){ const t=P.tracks[i], v=prompt("Nom de la piste",t.name); if(v!==null) edit(()=>t.name=v.trim()||t.name,"session detail arr"); }
  function addTrackMenu(x,y){ menu(x,y,[{h:"Ajouter une piste"},...[["nappe","Nappe"],["bourdon","Bourdon"],["basse","Basse"],["arpege","Arpège"],["melodie","Mélodie (notes)"],["texture","Texture"],["percu","Percussion"]].map(([k,n])=>({t:n,f:()=>edit(()=>{ P.tracks.push(PJ.newTrack(k,P.scenes.length)); UI.t=P.tracks.length-1; UI.focus="piste"; UI.tab="piste"; },"all")}))]); }
  function sceneMenu(r,x,y){ menu(x,y,[
    {t:"Renommer",f:()=>{ const v=prompt("Nom de la scène",P.scenes[r].name); if(v!==null) edit(()=>P.scenes[r].name=v.trim()||P.scenes[r].name,"session arr"); }},
    {t:"Dupliquer la scène",f:()=>edit(()=>{ P.scenes.splice(r+1,0,{name:P.scenes[r].name+" bis"}); P.tracks.forEach(t=>t.clips.splice(r+1,0,t.clips[r]?JSON.parse(JSON.stringify(t.clips[r])):null)); fixArrRows(r+1,1); },"all")},
    {t:"Insérer une scène vide",f:()=>edit(()=>{ P.scenes.splice(r+1,0,{name:"Scène"}); P.tracks.forEach(t=>t.clips.splice(r+1,0,null)); fixArrRows(r+1,1); },"all")},
    {t:"Supprimer la scène",f:()=>{ if(P.scenes.length<2) return; edit(()=>{ P.scenes.splice(r,1); P.tracks.forEach(t=>t.clips.splice(r,1)); fixArrRows(r,-1); UI.r=Math.min(UI.r,P.scenes.length-1); },"all"); }}]); }
  function fixArrRows(from,d){ Object.keys(P.arr.segs).forEach(id=>{ P.arr.segs[id]=P.arr.segs[id].filter(s=>!(d<0&&s.row===from)).map(s=>({...s,row:s.row>=from?s.row+d:s.row})); }); }

  /* ============================================================ DÉTAIL ============================================================ */
  function renderDetail(){
    const host=$("detail"); host.innerHTML="";
    const tabs=el("div","tabs"); [["clip","Clip"],["piste","Appareils"]].forEach(([k,n])=>{ const b=el("button","",n); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",UI.tab===k?"true":"false"); b.onclick=()=>{ UI.tab=k; renderDetail(); }; tabs.appendChild(b); });
    const t=curT(), who=UI.focus==="master"?"Master":UI.focus.startsWith("ret")?P.ret[+UI.focus[3]].name:(t?t.name:"")+(UI.tab==="clip"?" · "+(P.scenes[UI.r]?P.scenes[UI.r].name:""):"");
    tabs.appendChild(el("span","who",esc(who))); host.appendChild(tabs);
    const pane=el("div","pane"); host.appendChild(pane);
    if(UI.tab==="piste"||UI.focus==="master"||UI.focus.startsWith("ret")){ devicesPane(pane); return; }
    const c=curClip();
    if(!t){ pane.appendChild(el("p","empty","Aucune piste.")); return; }
    if(!c){ const e=el("div","empty"); e.innerHTML="Case vide. "+(t.kind==="mel"?"Choisis ce que tu veux y mettre :":"Crée un clip :"); const row=el("div","row");
      if(t.kind==="mel") [["notes","Notes (piano roll)"],["nappe","Nappe"],["bourdon","Bourdon"],["basse","Basse"],["arpege","Arpège"]].forEach(([k,n])=>row.appendChild(btn(n,()=>createClip(UI.t,UI.r,k))));
      else row.appendChild(btn(t.kind==="harm"?"Créer une progression d'accords":"Créer un rythme",()=>createClip(UI.t,UI.r)));
      e.appendChild(row); if(t.kind==="mel") e.appendChild(el("p","hint","Nappe, bourdon, basse et arpège suivent les accords de la piste Harmonie (même scène). Ils ne tirent rien au hasard : c'est toi qui choisis le motif, le registre, le voicing.")); pane.appendChild(e); return; }
    if(t.kind==="harm") harmPane(pane,t,c);
    else if(t.kind==="drums") drumPane(pane,t,c);
    else if(c.type==="gen") genPane(pane,t,c);
    else rollPane(pane,t,c);
  }
  const nameField=c=>{ const i=el("input"); i.type="text"; i.value=c.name||""; i.setAttribute("aria-label","Nom du clip"); i.onchange=()=>edit(()=>c.name=i.value.trim(),"session"); return i; };

  /* ---------- harmonie ---------- */
  const chordCol=ch=>ch.r===0?"var(--ink)":TH.hasCar(ch,P.mode)?"var(--rubric)":ch.q==="dim"?"var(--ink-3)":"var(--gold)";
  function harmPane(pane,t,c){
    const M=TH.MODES[P.mode], iv=M.iv, B=TH.bb(P.meter);
    const bar=el("div","bar2"); bar.appendChild(nameField(c));
    const tot=c.chords.reduce((a,x)=>a+x.b,0); bar.appendChild(el("span","hint",tot+" mesure"+(tot>1?"s":"")+" · "+c.chords.length+" accord"+(c.chords.length>1?"s":"")));
    bar.appendChild(btn("▷ Écouter la boucle",()=>{ audio(); TR.launch(t.id,UI.r); },"sm"));
    bar.appendChild(btn("Adapter à la gamme",()=>edit(()=>{ c.chords=c.chords.map(ch=>{ if(TH.isDiatonic(ch,iv)) return ch; const d=TH.diatonic(iv), best=d.reduce((a,x)=>Math.abs(x.r-ch.r)<Math.abs(a.r-ch.r)?x:a,d[0]); return {r:best.r,q:best.q,x:"",b:ch.b}; }); },"all"),"sm","Remplace les accords hors gamme par l'accord de la gamme le plus proche"));
    bar.appendChild(btn("Vider",()=>edit(()=>{ c.chords=[]; UI.chordSel=-1; },"all"),"sm"));
    if(t.mute) bar.appendChild(el("span","hint","La piste Harmonie est en sourdine : elle sert de guide. Démute-la (M) pour entendre les accords bruts."));
    pane.appendChild(bar);
    const pr=el("div","prog");
    c.chords.forEach((ch,k)=>{ const b=el("button","chd"+(UI.chordSel===k?" sel":"")+(TH.isDiatonic(ch,iv)?"":" out")); b.type="button"; b.style.setProperty("--c",chordCol(ch)); b.style.minWidth=(64+ch.b*36)+"px";
      b.innerHTML="<b>"+esc(TH.roman(ch))+"</b><i>"+esc(TH.chordName(ch,P.key))+"</i><small>"+(ch.b===0.5?"½":ch.b)+" mes.</small>";
      b.onclick=()=>{ UI.chordSel=k; playChord(ch); renderDetail(); renderConseils(); }; pr.appendChild(b); });
    if(!c.chords.length) pr.appendChild(el("span","hint","Clique un accord de la gamme ci-dessous pour commencer."));
    pane.appendChild(pr);
    const ch=c.chords[UI.chordSel];
    if(ch){ const ed=el("div","bar2");
      ed.appendChild(el("b","",esc(TH.roman(ch)+" · "+TH.chordName(ch,P.key)+" ("+TH.QL[ch.q]+")")));
      ed.appendChild(lab("Durée ",sel([[0.5,"½ mesure"],[1,"1 mesure"],[2,"2 mesures"],[3,"3 mesures"],[4,"4 mesures"]],ch.b,v=>edit(()=>ch.b=+v,"all"))));
      const qv=ch.x?ch.x:ch.q==="sus2"||ch.q==="sus4"||ch.q==="5"?ch.q:"tri";
      ed.appendChild(lab("Couleur ",sel([["tri","Triade"],["sus2","sus2 (ouvert, médiéval)"],["sus4","sus4 (suspendu)"],["5","Quinte à vide (archaïque)"],["7","Septième (plus riche)"],["add9","add9 (lumineux)"],["6","Sixte"]],qv,v=>edit(()=>{ const base=TH.diatonic(iv).find(x=>x.r===ch.r); const q0=base?base.q:(ch.q==="sus2"||ch.q==="sus4"||ch.q==="5"?"M":ch.q);
        if(v==="tri"){ ch.q=q0; ch.x=""; } else if(v==="sus2"||v==="sus4"||v==="5"){ ch.q=v; ch.x=""; } else { ch.q=(ch.q==="sus2"||ch.q==="sus4"||ch.q==="5")?q0:ch.q; ch.x=v; } },"all"))));
      ed.appendChild(btn("◀",()=>{ if(UI.chordSel>0) edit(()=>{ c.chords.splice(UI.chordSel-1,0,c.chords.splice(UI.chordSel,1)[0]); UI.chordSel--; },"all"); },"sm","Déplacer à gauche"));
      ed.appendChild(btn("▶",()=>{ if(UI.chordSel<c.chords.length-1) edit(()=>{ c.chords.splice(UI.chordSel+1,0,c.chords.splice(UI.chordSel,1)[0]); UI.chordSel++; },"all"); },"sm","Déplacer à droite"));
      ed.appendChild(btn("Dupliquer",()=>edit(()=>{ c.chords.splice(UI.chordSel+1,0,{...ch}); UI.chordSel++; },"all"),"sm"));
      ed.appendChild(btn("Supprimer",()=>edit(()=>{ c.chords.splice(UI.chordSel,1); UI.chordSel=Math.min(UI.chordSel,c.chords.length-1); },"all"),"sm"));
      if(!TH.isDiatonic(ch,iv)) ed.appendChild(el("span","hint","Hors gamme : "+TH.outNotes(ch,iv).map(p=>TH.nomNote(p+P.key)).join(", ")));
      pane.appendChild(ed); }
    pane.appendChild(el("div","sub","Accords de la gamme"+(ch?" · clic : ajouter après l'accord choisi · Maj+clic : le remplacer":" · clic : ajouter")));
    const pal=el("div","pal"); TH.diatonic(iv).forEach(d=>{ const cc={r:d.r,q:d.q,x:"",b:1}; const b=el("button",(d.r===0?"ton":"")+(TH.hasCar(cc,P.mode)?" car":"")+(d.q==="dim"||d.q==="aug"?" dim":"")); b.type="button";
      b.innerHTML="<b>"+esc(TH.roman(cc))+"</b><i>"+esc(TH.chordName(cc,P.key))+"</i>"; b.title=d.r===0?"Tonique : le repos":TH.hasCar(cc,P.mode)?"Contient "+M.carN+" : la couleur du mode":d.q==="dim"?"Diminué : instable, en passage":"";
      b.onclick=e=>addChord(c,cc,e.shiftKey); pal.appendChild(b); }); pane.appendChild(pal);
    const bo=TH.borrowed(P.mode); if(bo.length){ pane.appendChild(el("div","sub","Emprunts (hors gamme, à doser)")); const pb=el("div","pal"); bo.forEach(o=>{ const b=el("button","",'<b>'+esc(TH.roman(o.ch))+'</b><i>'+esc(TH.chordName(o.ch,P.key))+'</i>'); b.type="button"; b.title=o.why; b.onclick=e=>addChord(c,{...o.ch,b:1},e.shiftKey); pb.appendChild(b); }); pane.appendChild(pb); }
    pane.appendChild(el("div","sub","Progressions typiques du mode "+M.n.toLowerCase()));
    const tp=el("div","tpls"); M.prog.forEach(([s,n])=>{ const b=el("button","","<b>"+esc(s.replace(/ /g," – "))+"</b> · "+esc(n)); b.type="button"; b.title="Remplace la progression du clip (annulable)"; b.onclick=()=>{ edit(()=>{ c.chords=PJ.parse(s,iv); if(!c.name||c.name==="Accords") c.name=n.replace(/^l[ae]s? |^l'/,""); UI.chordSel=-1; },"all"); playChord(c.chords[0]); }; tp.appendChild(b); }); pane.appendChild(tp);
  }
  function addChord(c,cc,replace){ edit(()=>{ if(replace&&c.chords[UI.chordSel]){ c.chords[UI.chordSel]={...cc,b:c.chords[UI.chordSel].b}; } else { const at=UI.chordSel>=0?UI.chordSel+1:c.chords.length; c.chords.splice(at,0,{...cc}); UI.chordSel=at; } P.step=Math.max(P.step||0,1); },"all"); playChord(cc); }

  /* ---------- générateur ---------- */
  function genPane(pane,t,c){
    const bar=el("div","bar2"); bar.appendChild(nameField(c));
    bar.appendChild(lab("Type ",sel([["nappe","Nappe"],["bourdon","Bourdon"],["basse","Basse"],["arpege","Arpège"]],c.gen,v=>edit(()=>{ c.gen=v; c.g={}; if(!c.name||Object.values(TH.GEN_N).indexOf(c.name)>=0) c.name=TH.GEN_N[v]; },"all"))));
    const h=harmOf(UI.r), hr=h?PJ.harmTrack(P).clips.indexOf(h):-1;
    bar.appendChild(el("span","hint",h?"Suit « "+esc(h.name||"Accords")+" » ("+esc(P.scenes[hr]?P.scenes[hr].name:"")+") : "+h.chords.map(TH.roman).join(" – ")+". En lecture, il suit la progression qui tourne.":"Aucune progression : crée d'abord des accords sur la piste Harmonie."));
    bar.appendChild(btn("▷ Lancer",()=>{ audio(); TR.launch(t.id,UI.r); },"sm"));
    bar.appendChild(btn("Figer en notes",()=>freeze(UI.t,UI.r),"sm","Transforme le résultat en notes éditables au piano roll"));
    pane.appendChild(bar);
    const g=Object.assign({},TH.GEN_DEF[c.gen],c.g), F=el("div","fields"), setG=(k,v)=>edit(()=>{ c.g=Object.assign({},c.g,{[k]:v==="true"?true:v==="false"?false:v}); },"detail conseils");
    const S=(label,k,opts,num)=>F.appendChild(lab(label,sel(opts,g[k],v=>setG(k,num?+v:v))));
    const octs=a=>a.map(o=>[o,"Octave "+o+" ("+TH.nomNote(P.key)+o+")"]);
    if(c.gen==="nappe"){ S("Voicing","voicing",TH.MOTIFS.voicing); S("Rythme","rythme",TH.MOTIFS.nappe); S("Registre","oct",octs([2,3,4,5]),1); }
    if(c.gen==="bourdon"){ S("Note","note",[["tonique","Tonique (pédale)"],["fondamentale","Fondamentale de chaque accord"]]); S("Quinte","quinte",[["true","Avec la quinte"],["false","Note seule"]]); S("Registre","oct",octs([1,2,3,4]),1); S("Tenue","tenue",[["boucle","Toute la boucle"],["accord","Un par accord"]]); }
    if(c.gen==="basse"){ S("Motif","motif",TH.MOTIFS.basse); S("Registre","oct",octs([1,2,3]),1); }
    if(c.gen==="arpege"){ S("Motif","motif",TH.MOTIFS.arpege); S("Vitesse","rate",[[1,"Noires"],[0.5,"Croches"],[1/3,"Triolets de croches"],[0.25,"Doubles croches"]],1); S("Registre","oct",octs([3,4,5,6]),1); S("Ambitus","ambitus",[[1,"1 octave"],[2,"2 octaves"],[3,"3 octaves"]],1); S("Accents","accent",[["true","Temps forts appuyés"],["false","Égal"]]);
      F.appendChild(knob({label:"Durée des notes",min:0.1,max:1.5,value:g.gate,def:0.8,fmt:v=>Math.round(v*100)+" %",begin:snap,on:(v,fin)=>{ c.g=Object.assign({},c.g,{gate:v}); if(fin) changed("detail"); }})); }
    F.appendChild(knob({label:"Nuance",min:0.2,max:1,value:g.vel,def:TH.GEN_DEF[c.gen].vel,fmt:v=>Math.round(v*100)+" %",begin:snap,on:(v,fin)=>{ c.g=Object.assign({},c.g,{vel:v}); if(fin) changed("detail"); }}));
    pane.appendChild(F);
    /* aperçu des notes produites */
    ["quinte","accent"].forEach(k=>{ if(typeof c.g[k]==="string") c.g[k]=c.g[k]==="true"; });
    const cv=el("canvas","prev"); pane.appendChild(cv); requestAnimationFrame(()=>drawPreview(cv,t,c,h));
  }
  function drawPreview(cv,t,c,h){
    const D=PJ.clipData(P,t,c,h), r=cv.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1); cv.width=r.width*dpr; cv.height=r.height*dpr; const g=cv.getContext("2d"); g.scale(dpr,dpr);
    const W=r.width, H=r.height, cs=getComputedStyle(document.documentElement); if(!D.notes.length) return;
    let lo=Math.min(...D.notes.map(n=>n.p))-2, hi=Math.max(...D.notes.map(n=>n.p))+2; const B=TH.bb(P.meter);
    g.strokeStyle=cs.getPropertyValue("--rule"); for(let b=0;b<=D.len;b+=B){ const x=b/D.len*W; g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); }
    if(h){ g.fillStyle=cs.getPropertyValue("--ink-2"); g.font="11px serif"; TH.timeline(h.chords,P.meter).forEach(({ch,s})=>g.fillText(TH.chordName(ch,P.key),s/D.len*W+3,11)); }
    g.fillStyle=t.color; D.notes.forEach(n=>{ const x=n.s/D.len*W, w=Math.max(2,n.d/D.len*W-1), y=14+(hi-n.p)/(hi-lo)*(H-20); g.globalAlpha=0.4+0.6*n.v; g.fillRect(x,y-3,w,5); }); g.globalAlpha=1;
  }

  /* ---------- piano roll ---------- */
  const RH=14, KW=48, CH=0, LANE=22;
  function rollPane(pane,t,c){
    const B=TH.bb(P.meter), iv=TH.MODES[P.mode].iv, bar=el("div","bar2");
    bar.appendChild(nameField(c));
    bar.appendChild(lab("Longueur ",sel([[1,"1 mesure"],[2,"2 mesures"],[4,"4 mesures"],[8,"8 mesures"],[16,"16 mesures"]],c.bars,v=>edit(()=>{ c.bars=+v; },"all"))));
    bar.appendChild(lab("Grille ",sel([[1,"Noire"],[0.5,"Croche"],[0.25,"Double croche"],[1/3,"Triolet"]],UI.grid,v=>{ UI.grid=+v; renderDetail(); })));
    const sc=btn("Gamme seule",()=>{ UI.scaleOnly=!UI.scaleOnly; renderDetail(); },"sm","N'affiche que les notes de la gamme"); sc.setAttribute("aria-pressed",UI.scaleOnly?"true":"false"); bar.appendChild(sc);
    bar.appendChild(el("span","sep"));
    bar.appendChild(btn("Degré ↓",()=>transSel(c,-1),"sm","Descend les notes choisies (ou toutes) d'un degré de la gamme"));
    bar.appendChild(btn("Degré ↑",()=>transSel(c,1),"sm","Monte les notes choisies (ou toutes) d'un degré de la gamme"));
    bar.appendChild(btn("Quantifier",()=>edit(()=>{ pick(c).forEach(n=>{ n.s=Math.round(n.s/UI.grid)*UI.grid; n.d=Math.max(UI.grid,Math.round(n.d/UI.grid)*UI.grid); }); },"detail"),"sm"));
    bar.appendChild(btn("Doubler",()=>edit(()=>{ const L=c.bars*B; c.notes=c.notes.concat(c.notes.map(n=>({...n,s:n.s+L}))); c.bars*=2; },"all"),"sm","Recopie le clip à la suite : pour construire question et réponse"));
    bar.appendChild(btn("Vider",()=>edit(()=>{ c.notes=[]; UI.selNotes.clear(); },"all"),"sm"));
    const vel=el("input"); vel.type="range"; vel.min=0.1; vel.max=1; vel.step=0.05; vel.value=0.8; vel.setAttribute("aria-label","Nuance des notes choisies"); vel.title="Nuance des notes choisies";
    vel.addEventListener("pointerdown",snap); vel.oninput=()=>{ pick(c,true).forEach(n=>n.v=+vel.value); drawRoll(); save(); };
    bar.appendChild(lab("Nuance ",vel));
    const h=harmOf(UI.r); bar.appendChild(el("span","hint",(t.arm?"Armée : joue au clavier pendant la lecture, ça s'écrit. ":"")+(h?"Accords en fond : « "+esc(h.name||"")+" ».":"")));
    pane.appendChild(bar);
    const lane=el("canvas"); lane.style.display="block"; lane.setAttribute("aria-hidden","true"); pane.appendChild(lane);
    const wrap=el("div","rollwrap"), cv=el("canvas"); cv.setAttribute("role","img"); cv.setAttribute("aria-label","Piano roll : clic pour poser une note, glisser pour la déplacer, bord droit pour l'allonger, clic droit ou Maj+clic pour l'effacer");
    wrap.appendChild(cv); pane.appendChild(wrap);
    pane.appendChild(el("p","hint","Clic : poser · glisser : déplacer · bord droit : allonger · clic droit ou Maj+clic : effacer · Ctrl+clic : choisir plusieurs · Suppr, flèches. Clavier : Z X C V… (grave), A S D F… , Q W E R… (aigu) ; Page ↑/↓ change d'octave. Les rangées teintées sont les notes de l'accord en cours."));
    UI.roll={cv,wrap,t,c,h,lane};
    requestAnimationFrame(()=>{ drawRoll(); const rows=rollRows(); const mid=rows.findIndex(p=>p<=60+P.key+7); if(mid>0) wrap.scrollTop=Math.max(0,(mid-8)*RH); });
    bindRoll(cv);
  }
  const pick=(c,selOnly)=>{ const s=c.notes.filter((n,i)=>UI.selNotes.has(n)); return s.length||selOnly?s:c.notes; };
  function transSel(c,d){ const iv=TH.MODES[P.mode].iv; edit(()=>pick(c).forEach(n=>{ let p=n.p; do{ p+=d; } while(!TH.inScale(iv,p-P.key)&&Math.abs(p-n.p)<12); n.p=p; }),"detail"); }
  function rollRows(){ const R=UI.roll, iv=TH.MODES[P.mode].iv; let lo=36+P.key, hi=84+P.key; R.c.notes.forEach(n=>{ lo=Math.min(lo,n.p-2); hi=Math.max(hi,n.p+2); });
    const rows=[]; for(let p=hi;p>=lo;p--) if(!UI.scaleOnly||TH.inScale(iv,p-P.key)||R.c.notes.some(n=>n.p===p)) rows.push(p); return rows; }
  function rollGeom(){ const R=UI.roll, B=TH.bb(P.meter), L=R.c.bars*B, W=Math.max(R.wrap.clientWidth-2,400), ppb=Math.max(22,(W-KW)/L); return {L,ppb,W:KW+L*ppb,rows:rollRows(),B}; }
  function drawRoll(){
    const R=UI.roll; if(!R||!R.cv.isConnected) return; const G=rollGeom(), {L,ppb,rows,B}=G, H=CH+rows.length*RH, dpr=Math.min(2,devicePixelRatio||1), cv=R.cv;
    if(cv.width!==Math.round(G.W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(G.W*dpr); cv.height=Math.round(H*dpr); cv.style.width=G.W+"px"; cv.style.height=H+"px"; }
    const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); const cs=getComputedStyle(document.documentElement), col=k=>cs.getPropertyValue(k).trim();
    g.fillStyle=col("--cell"); g.fillRect(0,0,G.W,H);
    const iv=TH.MODES[P.mode].iv, M=TH.MODES[P.mode], lanes=[];
    /* rangées : tonique, note caractéristique, notes de l'accord */
    rows.forEach((p,i)=>{ const y=CH+i*RH, pc=((p-P.key)%12+12)%12; if(pc===0){ g.fillStyle="rgba(176,128,31,.13)"; g.fillRect(KW,y,G.W,RH); } if(!TH.inScale(iv,pc)){ g.fillStyle="rgba(0,0,0,.05)"; g.fillRect(KW,y,G.W,RH); } });
    if(R.h&&R.h.chords.length){ const HL=TH.progLen(R.h.chords,P.meter), TL=TH.timeline(R.h.chords,P.meter);
      for(let off=0;off<L;off+=HL) TL.forEach(({ch,s,d})=>{ const x0=KW+(off+s)*ppb, w=Math.min(d,L-off-s)*ppb; if(w<=0) return; const T=TH.tones(ch,iv).map(x=>((x+P.key)%12+12)%12);
        rows.forEach((p,i)=>{ if(T.indexOf(((p%12)+12)%12)>=0){ g.fillStyle="rgba(47,111,91,.12)"; g.fillRect(x0,CH+i*RH,w,RH); } });
        lanes.push([x0,w,TH.roman(ch)+" · "+TH.chordName(ch,P.key)]); }); }
    { const lc=R.lane, LW=G.W; if(lc.width!==Math.round(LW*dpr)){ lc.width=Math.round(LW*dpr); lc.height=Math.round(LANE*dpr); lc.style.width=LW+"px"; lc.style.height=LANE+"px"; }
      const lg=lc.getContext("2d"); lg.setTransform(dpr,0,0,dpr,0,0); lg.fillStyle=col("--parch-2"); lg.fillRect(0,0,LW,LANE); lg.fillStyle=col("--ink-3"); lg.font="11px Alegreya, serif"; lg.fillText("Accords",4,15);
      lanes.forEach(([x0,w,tx])=>{ lg.fillStyle="rgba(47,111,91,.10)"; lg.fillRect(x0+1,2,w-2,LANE-4); lg.fillStyle=col("--ink"); lg.font="italic 12px Alegreya, serif"; lg.fillText(tx,x0+5,15); lg.strokeStyle=col("--rule"); lg.beginPath(); lg.moveTo(x0,0); lg.lineTo(x0,LANE); lg.stroke(); });
      if(!lanes.length){ lg.fillStyle=col("--ink-3"); lg.font="italic 11px Alegreya, serif"; lg.fillText("pas d'accords dans cette scène",KW+6,15); } }
    /* grille */
    for(let b=0;b<=L+1e-9;b+=UI.grid){ const x=KW+b*ppb, bar=Math.abs(b%B)<1e-6||Math.abs(b%B-B)<1e-6, beat=Math.abs(b-Math.round(b))<1e-6; g.strokeStyle=bar?col("--ink-3"):col("--rule"); g.globalAlpha=bar?0.9:beat?0.55:0.25; g.beginPath(); g.moveTo(x,CH); g.lineTo(x,H); g.stroke(); }
    g.globalAlpha=0.25; rows.forEach((p,i)=>{ g.strokeStyle=col("--rule"); g.beginPath(); g.moveTo(KW,CH+i*RH); g.lineTo(G.W,CH+i*RH); g.stroke(); }); g.globalAlpha=1;
    /* touches */
    g.fillStyle=col("--parch-2"); g.fillRect(0,CH,KW,H); rows.forEach((p,i)=>{ const pc=((p-P.key)%12+12)%12; g.fillStyle=pc===0?col("--rubric"):pc===M.car?col("--rubric-d"):col("--ink-2"); g.font=(pc===0?"bold ":"")+"11px Alegreya, serif"; g.fillText(TH.nomMidi(p),4,CH+i*RH+11); });
    /* notes */
    R.c.notes.forEach(n=>{ const i=rows.indexOf(n.p); if(i<0) return; const x=KW+n.s*ppb, y=CH+i*RH; g.globalAlpha=0.45+0.55*n.v; g.fillStyle=R.t.color; g.fillRect(x+1,y+1,Math.max(3,n.d*ppb-2),RH-2); g.globalAlpha=1;
      if(UI.selNotes.has(n)){ g.strokeStyle=col("--ink"); g.lineWidth=2; g.strokeRect(x+1,y+1,Math.max(3,n.d*ppb-2),RH-2); g.lineWidth=1; } });
    /* tête de lecture */
    if(TR&&TR.X.playing){ const ps=TR.pos(R.t); if(ps&&ps.row===UI.r){ const x=KW+ps.f*L*ppb; g.fillStyle=col("--rubric"); g.fillRect(x,0,2,H); } }
  }
  function bindRoll(cv){
    let drag=null;
    const at=e=>{ const r=cv.getBoundingClientRect(), G=rollGeom(), x=e.clientX-r.left, y=e.clientY-r.top; return {x,y,b:(x-KW)/G.ppb,i:Math.floor((y-CH)/RH),G}; };
    const hit=(c,a)=>{ const p=a.G.rows[a.i]; return c.notes.find(n=>n.p===p&&a.b>=n.s-1e-6&&a.b<n.s+n.d); };
    cv.addEventListener("contextmenu",e=>e.preventDefault());
    cv.addEventListener("pointerdown",e=>{
      const R=UI.roll, c=R.c, a=at(e); if(a.y<CH) return;
      if(a.x<KW){ const p=a.G.rows[a.i]; if(p!==undefined){ audio(); graph.preview(R.t,p,0.7,1); } return; }
      const n=hit(c,a); snap();
      if(n&&(e.button===2||e.shiftKey||e.altKey)){ c.notes.splice(c.notes.indexOf(n),1); UI.selNotes.delete(n); drawRoll(); afterRoll(); return; }
      if(e.button===2) return;
      cv.setPointerCapture(e.pointerId);
      if(n){ if(e.ctrlKey||e.metaKey){ UI.selNotes.has(n)?UI.selNotes.delete(n):UI.selNotes.add(n); drawRoll(); return; }
        if(!UI.selNotes.has(n)){ UI.selNotes.clear(); UI.selNotes.add(n); }
        const edge=(n.s+n.d)*a.G.ppb+KW-a.x<7; drag={n,mode:edge?"len":"move",off:a.b-n.s,p0:n.p,i0:a.i,orig:[...UI.selNotes].map(x=>({x,s:x.s,p:x.p}))}; }
      else{ const p=a.G.rows[a.i]; if(p===undefined) return; const s=Math.max(0,Math.floor(a.b/UI.grid+1e-6)*UI.grid); if(s>=a.G.L) return; const nn={s,d:UI.grid,p,v:0.8}; c.notes.push(nn); UI.selNotes.clear(); UI.selNotes.add(nn); drag={n:nn,mode:"len",off:0}; audio(); graph.preview(R.t,p,0.75,0.6); }
      drawRoll();
    });
    cv.addEventListener("pointermove",e=>{ if(!drag) return; const a=at(e), R=UI.roll;
      if(drag.mode==="len"){ drag.n.d=Math.max(UI.grid,Math.round((a.b-drag.n.s)/UI.grid+0.5)*UI.grid); drag.n.d=Math.min(drag.n.d,a.G.L-drag.n.s); }
      else{ const ds=Math.round((a.b-drag.off-drag.orig.find(o=>o.x===drag.n).s)/UI.grid)*UI.grid, di=clamp(a.i,0,a.G.rows.length-1)-drag.i0;
        drag.orig.forEach(o=>{ o.x.s=clamp(o.s+ds,0,a.G.L-o.x.d); const ri=a.G.rows.indexOf(o.p); if(ri>=0){ const np=a.G.rows[clamp(ri+di,0,a.G.rows.length-1)]; if(o.x===drag.n&&np!==o.x.p){ audio(); graph.preview(R.t,np,0.6,0.3); } o.x.p=np; } }); }
      drawRoll(); });
    cv.addEventListener("pointerup",()=>{ if(drag){ drag=null; afterRoll(); } });
  }
  function afterRoll(){ save(); renderConseils(); renderSessionLabels(); }
  function renderSessionLabels(){ /* les noms des clips ne changent pas ici */ }

  /* ---------- séquenceur de batterie ---------- */
  function drumPane(pane,t,c){
    PJ.fixDrum(t,c,P.meter); const per=PJ.stepsPerBar(P.meter), B=TH.bb(P.meter), n=c.bars*per, beatEvery=per/B;
    const bar=el("div","bar2"); bar.appendChild(nameField(c));
    bar.appendChild(lab("Longueur ",sel([[1,"1 mesure"],[2,"2 mesures"],[4,"4 mesures"]],c.bars,v=>edit(()=>{ const old=c.bars; c.bars=+v; PJ.fixDrum(t,c,P.meter); if(c.bars>old) c.steps.forEach(row=>{ for(let i=old*per;i<c.bars*per;i++) row[i]=row[i%(old*per)]; }); },"all"))));
    bar.appendChild(lab("Grille toute faite ",sel([["","Choisir…"],...KITS.map(([k,nm])=>[k,nm])],"",v=>{ if(v) loadKit(t,c,v); })));
    bar.appendChild(btn("+ Voie",()=>edit(()=>{ t.lanes.push({n:"Voie",kit:"cadre",part:"tap",lvl:0.8}); PJ.fixDrum(t,c,P.meter); },"detail"),"sm","Ajouter une voie (un son)"));
    bar.appendChild(btn("Vider",()=>edit(()=>{ c.steps.forEach(r=>r.fill(0)); },"detail"),"sm"));
    bar.appendChild(btn("▷ Lancer",()=>{ audio(); TR.launch(t.id,UI.r); },"sm"));
    pane.appendChild(bar);
    const seq=el("div","seq"); UI.seq={t,c,btns:[]};
    t.lanes.forEach((ln,li)=>{
      const row=el("div","lane"), lh=el("div","lh");
      const nm=el("input"); nm.type="text"; nm.value=ln.n; nm.setAttribute("aria-label","Nom de la voie"); nm.onchange=()=>edit(()=>ln.n=nm.value,"soft");
      lh.append(nm, sel(KITS,ln.kit,v=>{ edit(()=>ln.kit=v,"soft"); audition(t,li); },"Batterie"), sel(PARTS,ln.part,v=>{ edit(()=>ln.part=v,"soft"); audition(t,li); },"Son"));
      lh.appendChild(knob({label:"Niv.",min:0,max:1.2,value:ln.lvl===undefined?1:ln.lvl,def:1,sm:1,fmt:v=>Math.round(v*100)+"",begin:snap,on:v=>{ ln.lvl=v; save(); }}));
      lh.appendChild(btn("▷",()=>audition(t,li),"sm","Écouter"));
      lh.appendChild(btn("✕",()=>edit(()=>{ t.lanes.splice(li,1); t.clips.forEach(cc=>{ if(cc&&cc.steps) cc.steps.splice(li,1); }); },"detail"),"sm","Retirer la voie"));
      const st=el("div","steps"), bl=[];
      for(let i=0;i<n;i++){ const b=el("button",(i%beatEvery===0?"beat":"")+(i%per===0&&i?" barS":"")); b.type="button"; const lv=v=>v>=0.85?3:v>=0.5?2:v>0?1:0; b.dataset.v=lv(c.steps[li][i]); b.setAttribute("aria-label","Pas "+(i+1)+" de "+ln.n);
        b.addEventListener("pointerdown",e=>{ e.preventDefault(); snap(); const cur=lv(c.steps[li][i]), nv=e.button===2?0:[0.9,0.6,0.35,0][cur===0?0:cur===3?1:cur===2?2:3]; UI.paint={li,v:nv}; c.steps[li][i]=nv; b.dataset.v=lv(nv); if(nv){ audition(t,li,nv); } save(); });
        b.addEventListener("pointerenter",()=>{ if(UI.paint&&UI.paint.li===li){ c.steps[li][i]=UI.paint.v; b.dataset.v=lv(UI.paint.v); } });
        b.oncontextmenu=e=>e.preventDefault(); st.appendChild(b); bl.push(b); }
      UI.seq.btns.push(bl); row.append(lh,st); seq.appendChild(row);
    });
    pane.appendChild(seq);
    pane.appendChild(el("p","hint","Clic : fort, puis moyen, puis doux, puis rien. Glisser pour peindre. Chaque voie choisit sa batterie et son son : mélange les moteurs (grave du taiko, frappe du tambour sur cadre, cymbalettes antiques…)."));
  }
  document.addEventListener("pointerup",()=>{ if(UI.paint){ UI.paint=null; renderConseils(); } });
  function audition(t,li,v){ audio(); const ln=t.lanes[li]; if(ln) graph.bank.perc(ln.kit,ln.part,ctx.currentTime+0.01,(v||0.9)*(ln.lvl===undefined?1:ln.lvl),graph.trackNode(t).gen); }
  function loadKit(t,c,kit){ audio(); const K=graph.bank.kpat[kit], pat=K&&K[P.meter]; if(!pat){ toast("Pas de grille pour cette mesure avec cette batterie."); return; }
    edit(()=>{ t.lanes=[{n:"Grave",kit,part:"stomp",lvl:1},{n:"Frappe",kit,part:"tap",lvl:0.85},{n:"Remplissage",kit,part:"shaker",lvl:0.6}]; c.steps=t.lanes.map(()=>Array(c.bars*PJ.stepsPerBar(P.meter)).fill(0));
      const put=(ch,i)=>{ const m={K:[0,0.9],k:[0,0.6],T:[1,0.9],t:[1,0.5],h:[2,0.6],H:[2,0.6],g:[1,0.35]}[ch]; if(m) c.steps[m[0]][i]=Math.max(c.steps[m[0]][i],m[1]); };
      for(let b=0;b<c.bars;b++) pat.forEach((cell,e)=>{ const [a,s]=cell.split("/"); const i=b*pat.length*2+e*2; [...(a||"")].forEach(ch=>put(ch,i)); [...(s||"")].forEach(ch=>put(ch,i+1)); });
      t.clips.forEach(cc=>{ if(cc&&cc!==c) PJ.fixDrum(t,cc,P.meter); }); },"all"); toast("Grille chargée : à toi de l'élaguer. En dungeon synth, moins c'est mieux."); }

  /* ---------- appareils ---------- */
  function devicesPane(pane){
    let holder, isTrack=false, t=null;
    if(UI.focus==="master") holder=P.master; else if(UI.focus.startsWith("ret")) holder=P.ret[+UI.focus[3]]; else { t=curT(); holder=t; isTrack=true; }
    if(!holder){ pane.appendChild(el("p","empty","Choisis une piste.")); return; }
    const ch=el("div","chain");
    if(isTrack) ch.appendChild(instCard(t));
    holder.devs.forEach((d,k)=>ch.appendChild(devCard(holder,d,k)));
    const ad=el("div","adddev"); ad.appendChild(sel([["","+ Ajouter un effet…"],...SON.DEV_ORDER.map(k=>[k,SON.DEV[k].n])],"",v=>{ if(v) edit(()=>holder.devs.push(PJ.dev(v)),"detail conseils"); },"Ajouter un effet"));
    ad.appendChild(sel([["","Chaînes toutes faites…"],["lofi","Lo-fi années 90 (bande, saturation, EQ)"],["machine","Machine à cordes (ensemble, EQ)"],["cathedrale","Cathédrale (réverb longue en insert)"],["respire","Nappe qui respire (filtre auto lent)"],["grave","Grave propre (EQ, compresseur, mono)"]],"",v=>{ if(v) edit(()=>holder.devs.push(...CHAINS[v]()),"detail conseils"); },"Chaînes toutes faites"));
    if(UI.focus==="master") ad.appendChild(el("span","hint","Un limiteur protège toujours la sortie."));
    ch.appendChild(ad); pane.appendChild(ch);
    if(isTrack&&t.kind!=="drums") pane.appendChild(el("p","hint","L'ordre compte, de gauche à droite comme dans Ableton : l'instrument, puis chaque effet. Mets la réverb de préférence sur le retour A (bouton A du mixeur)."));
  }
  const CHAINS={lofi:()=>[PJ.dev("bande",{wow:0.35,flutter:0.25,wear:0.45,hiss:0.12}),PJ.dev("sat",{drive:0.25,tone:7000,mix:0.7,out:-2}),PJ.dev("eq",{cut:90,top:9000})],
    machine:()=>[PJ.dev("chorus",{mode:"ensemble",rate:0.63,depth:0.7,mix:0.6}),PJ.dev("eq",{cut:160,mid:-2,fmid:400})],
    cathedrale:()=>[PJ.dev("reverb",{decay:9,damp:0.6,pre:60,low:200,mix:0.45})],
    respire:()=>[PJ.dev("filtre",{type:"lowpass",freq:1200,res:1.5,rate:16,depth:0.55,mix:1})],
    grave:()=>[PJ.dev("eq",{cut:35,top:4000}),PJ.dev("comp",{thr:-20,ratio:3,att:30,rel:200,gain:3}),PJ.dev("util",{width:0})]};
  function instCard(t){
    const d=el("div","dev inst"), h=el("div","dh","<span>"+(t.kind==="drums"?"Batterie":"Instrument")+"</span>"); d.appendChild(h); const b=el("div","db2"); d.appendChild(b);
    if(t.kind==="drums"){ b.appendChild(el("span","hint",t.lanes.length+" voies : "+t.lanes.map(l=>l.n).join(", ")+". Batterie et son de chaque voie se choisissent dans le clip (onglet Clip).")); return d; }
    const I=t.inst||{k:"inst",name:"luth"}, up=(()=>{ try{ const a=JSON.parse(localStorage.getItem("bourdon.synpatches")||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } })();
    const val=I.k==="syn"?"syn:"+(I.pid||"f0"):I.k+":"+I.name;
    const opts=[{group:"Nappes (sons tenus)",items:PADS.map(([k,n])=>["pad:"+k,n])},{group:"Instruments",items:INSTS.map(([k,n])=>["inst:"+k,n])},{group:"Synthé de Forger",items:SYN_PATCHES.map((p,i)=>["syn:f"+i,p[0]]).concat(up.map((p,i)=>["syn:u"+i,"Mon patch : "+p.name]))}];
    b.appendChild(sel(opts,val,v=>{ const [k,id]=v.split(":"); edit(()=>{ if(k==="syn"){ const pt=id[0]==="f"?synPatch(+id.slice(1)):(up[+id.slice(1)]?synMerge(SYN_DEFAULT,up[+id.slice(1)].syn):synPatch(0)); t.inst={k:"syn",pid:id,patch:pt}; } else t.inst={k,name:id}; },"detail conseils"); audio(); graph.preview(t,60+P.key,0.75,1.2); },"Instrument"));
    b.appendChild(btn("▷",()=>{ audio(); graph.preview(t,60+P.key,0.75,1.5); },"sm","Écouter une note"));
    const tip=INST_TIP[I.name]; if(tip) b.appendChild(el("p","hint",esc(tip)));
    if(I.k==="syn") b.appendChild(el("p","hint","Patch du synthé de Forger : pour en créer un, va dans la machine, mode Forger, et enregistre-le sous un nom ; il apparaîtra ici."));
    return d;
  }
  function devCard(holder,d,k){
    const D=SON.DEV[d.type], c=el("div","dev"+(d.on===false?" off":"")), h=el("div","dh");
    const led=el("button","led"); led.type="button"; led.title=d.on===false?"Activer":"Désactiver"; led.setAttribute("aria-label",(d.on===false?"Activer ":"Désactiver ")+D.n); led.onclick=()=>edit(()=>d.on=d.on===false,"detail");
    h.appendChild(led); h.appendChild(el("span","",esc(D.n)));
    const mv=(dir)=>edit(()=>{ const j=k+dir; if(j<0||j>=holder.devs.length) return; holder.devs.splice(j,0,holder.devs.splice(k,1)[0]); },"detail");
    const b1=el("button","","◀"); b1.type="button"; b1.title="Avant"; b1.onclick=()=>mv(-1); const b2=el("button","","▶"); b2.type="button"; b2.title="Après"; b2.onclick=()=>mv(1);
    const bh=el("button","","?"); bh.type="button"; bh.title=D.d; bh.onclick=()=>toast(D.d);
    const bx=el("button","","✕"); bx.type="button"; bx.title="Retirer"; bx.onclick=()=>edit(()=>holder.devs.splice(k,1),"detail conseils");
    h.append(b1,b2,bh,bx); c.appendChild(h); c.title=D.d;
    const body=el("div","db2");
    D.p.forEach(s=>{ if(s.opts){ body.appendChild(lab(s.n,sel(s.opts,d.p[s.k],v=>edit(()=>d.p[s.k]=isNaN(+v)?v:+v,"soft")))); return; }
      body.appendChild(knob({label:s.n,min:s.min,max:s.max,log:s.log,value:d.p[s.k]===undefined?s.def:d.p[s.k],def:s.def,fmt:fmtU(s.u),begin:snap,on:v=>{ d.p[s.k]=v; changed("soft"); }})); });
    c.appendChild(body); return c;
  }

  /* ============================================================ ARRANGEMENT ============================================================ */
  function renderArr(){
    const host=$("arrange"); if(host.hidden&&UI.view!=="arr") return; host.innerHTML="";
    const B=TH.bb(P.meter), len=PJ.arrLen(P.arr), sec=len*B*60/P.tempo;
    const bar=el("div","bar2");
    bar.appendChild(btn("▶ Lire depuis le curseur",()=>{ audio(); if(!len){ toast("L'arrangement est vide."); return; } TR.playArr(UI.arrCur); renderTopState(); }));
    bar.appendChild(btn("Construire depuis les scènes…",e=>menu(e.clientX,e.clientY,[{h:"Toutes les scènes non vides, dans l'ordre"},...[1,2,4].map(k=>({t:"Chaque scène ×"+k,f:()=>{ const rows=P.scenes.map((s,r)=>r).filter(r=>P.tracks.some(t=>t.clips[r])); edit(()=>{ P.arr=PJ.arrFromScenes(P,rows,k); },"arr conseils"); toast("Arrangement construit. Ctrl+Z pour revenir."); }}))])));
    bar.appendChild(btn("Dupliquer",()=>{ const s=selSeg(); if(s) edit(()=>{ const l=P.arr.segs[UI.arrSel.id]; l.push({...s,at:s.at+s.len}); UI.arrSel.i=l.length-1; },"arr"); },"sm","Copie le bloc choisi juste après"));
    bar.appendChild(btn("Supprimer",()=>delSeg(),"sm","Supprime le bloc choisi (Suppr)"));
    bar.appendChild(btn("Insérer 1 mesure au curseur",()=>edit(()=>{ Object.values(P.arr.segs).forEach(l=>l.forEach(s=>{ if(s.at>=UI.arrCur) s.at++; else if(s.at+s.len>UI.arrCur) s.len++; })); },"arr"),"sm"));
    bar.appendChild(btn("Vider",()=>edit(()=>{ P.arr={segs:{},len:0}; },"arr conseils"),"sm"));
    bar.appendChild(lab("Zoom ",sel([[14,"serré"],[28,"moyen"],[48,"large"]],UI.zoom,v=>{ UI.zoom=+v; renderArr(); })));
    bar.appendChild(el("span","hint",len?len+" mesures · "+Math.floor(sec/60)+" min "+String(Math.round(sec%60)).padStart(2,"0"):"Vide : arme ● puis joue tes scènes en vue Session, ou construis depuis les scènes."));
    host.appendChild(bar);
    const total=Math.max(len+8,32), ppb=UI.zoom, wrap=el("div","arrwrap");
    const ru=el("div","ruler"); ru.appendChild(el("div","ah")); const rt=el("div","at"); rt.style.width=total*ppb+"px";
    for(let b=0;b<total;b+=(ppb<20?4:1)) { const s=el("span","",String(b+1)); s.style.left=b*ppb+"px"; rt.appendChild(s); }
    rt.onclick=e=>{ const r=rt.getBoundingClientRect(); UI.arrCur=Math.max(0,Math.floor((e.clientX-r.left)/ppb)); renderArr(); };
    ru.appendChild(rt); wrap.appendChild(ru);
    P.tracks.forEach(t=>{ const ln=el("div","alane"), ah=el("div","ah",esc(t.name)); ah.style.setProperty("--c",t.color); const at=el("div","at"); at.style.width=total*ppb+"px";
      (P.arr.segs[t.id]||[]).forEach((s,i)=>{ const c=t.clips[s.row], sg=el("div","seg"+(UI.arrSel&&UI.arrSel.id===t.id&&UI.arrSel.i===i?" sel":"")); sg.style.setProperty("--c",t.color); sg.style.left=s.at*ppb+"px"; sg.style.width=s.len*ppb+"px";
        sg.textContent=c?clipLabel(t,c):"(clip supprimé)"; sg.title=(c?clipLabel(t,c):"")+" · mesures "+(s.at+1)+" à "+(s.at+s.len); const rz=el("span","rz"); sg.appendChild(rz); segDrag(sg,rz,t,i,ppb); at.appendChild(sg); });
      at.ondblclick=e=>{ if(e.target!==at) return; const r=at.getBoundingClientRect(), b0=Math.floor((e.clientX-r.left)/ppb), items=[{h:"Insérer à la mesure "+(b0+1)}];
        t.clips.forEach((c,row)=>{ if(c) items.push({t:P.scenes[row].name+" : "+clipLabel(t,c),f:()=>edit(()=>{ const L=Math.max(1,Math.round(PJ.clipData(P,t,c,PJ.harmFor(P,row)).len/B)); (P.arr.segs[t.id]=P.arr.segs[t.id]||[]).push({at:b0,len:L,row}); },"arr conseils")}); });
        if(items.length===1) items.push({t:"(aucun clip sur cette piste)",f:()=>{}}); menu(e.clientX,e.clientY,items); };
      ln.append(ah,at); wrap.appendChild(ln); });
    const cur=el("div","cursor"); cur.style.left=(120+UI.arrCur*ppb)+"px"; wrap.appendChild(cur);
    const ph=el("div","phead"); ph.style.display="none"; wrap.appendChild(ph); UI.arrPh={ph,ppb};
    host.appendChild(wrap);
    host.appendChild(el("p","hint","Glisser un bloc : le déplacer · bord droit : l'allonger (le clip boucle) · double-clic dans une piste vide : insérer un clip · clic sur la règle : placer le curseur. Le flux d'Ableton : on joue en vue Session avec ● armé, tout s'écrit ici."));
  }
  const selSeg=()=>UI.arrSel&&(P.arr.segs[UI.arrSel.id]||[])[UI.arrSel.i];
  function delSeg(){ if(!selSeg()) return; edit(()=>{ P.arr.segs[UI.arrSel.id].splice(UI.arrSel.i,1); UI.arrSel=null; },"arr conseils"); }
  function segDrag(sg,rz,t,i,ppb){
    sg.addEventListener("pointerdown",e=>{ e.preventDefault(); UI.arrSel={id:t.id,i}; document.querySelectorAll(".seg.sel").forEach(x=>x.classList.remove("sel")); sg.classList.add("sel");
      const s=P.arr.segs[t.id][i], x0=e.clientX, at0=s.at, len0=s.len, mode=e.target===rz?"len":"move"; let moved=false; sg.setPointerCapture(e.pointerId);
      const mv=ev=>{ const d=Math.round((ev.clientX-x0)/ppb); if(d&&!moved){ snap(); moved=true; } if(mode==="len") s.len=Math.max(1,len0+d); else s.at=Math.max(0,at0+d); sg.style.left=s.at*ppb+"px"; sg.style.width=s.len*ppb+"px"; };
      const up=()=>{ sg.removeEventListener("pointermove",mv); sg.removeEventListener("pointerup",up); if(moved){ P.arr.len=PJ.arrLen(P.arr); changed("arr conseils"); } };
      sg.addEventListener("pointermove",mv); sg.addEventListener("pointerup",up); });
  }

  /* ============================================================ CONSEILS ============================================================ */
  function steps(){
    const h=PJ.harmTrack(P), mel=P.tracks.filter(t=>t.kind!=="harm"&&t.clips.some(Boolean)).length;
    return [
      ["I","Choisir la gamme",(P.step||0)>=1,()=>{ UI.focus="gamme"; }],
      ["II","Poser les accords",!!(h&&h.clips.some(c=>c&&c.chords.length>=2)),()=>{ UI.t=P.tracks.indexOf(h); const r=h.clips.findIndex(Boolean); UI.r=r<0?0:r; UI.focus="clip"; UI.tab="clip"; }],
      ["III","Empiler les couches",mel>=2,()=>{ UI.focus="couches"; }],
      ["IV","Écrire la mélodie",P.tracks.some(t=>t.clips.some(c=>c&&c.type==="notes"&&c.notes.length>=4)),()=>{ let i=P.tracks.findIndex(t=>t.role==="melodie"); if(i<0){ edit(()=>P.tracks.push(PJ.newTrack("melodie",P.scenes.length)),"all"); i=P.tracks.length-1; } UI.t=i; UI.focus="clip"; UI.tab="clip"; }],
      ["V","Arranger",PJ.arrLen(P.arr)>0,()=>{ UI.view="arr"; UI.focus="arr"; }],
      ["VI","Mixer et exporter",!!P.exported,()=>{ UI.focus="master"; UI.tab="piste"; }]
    ];
  }
  function renderConseils(){
    const host=$("conseils"); host.innerHTML=""; const M=TH.MODES[P.mode], iv=M.iv;
    host.appendChild(el("h2","","Conseils"));
    const mc=el("div","modecard"); mc.innerHTML="<b>"+esc(TH.nomNote(P.key)+" "+M.n.toLowerCase())+"</b> · "+esc(M.couleur)+"<p>Note caractéristique : <b>"+esc(TH.nomNote(P.key+M.car))+"</b>, "+esc(M.carN)+".</p>"; host.appendChild(mc);
    const S=steps(), cur=S.findIndex(s=>!s[2]), ol=el("ol","fil");
    S.forEach((s,i)=>{ const li=el("li",(s[2]?"done":"")+(i===cur?" cur":"")), b=el("button",""); b.type="button"; b.innerHTML='<span class="n">'+s[0]+'</span><span class="t">'+esc(s[1])+'</span>'; b.onclick=()=>{ s[3](); renderAll(); }; li.appendChild(b); ol.appendChild(li); });
    host.appendChild(ol);
    const tips=[], add=(h,list)=>{ host.appendChild(el("h3","",esc(h))); const ul=el("ul","tips"); list.forEach(x=>{ const li=el("li",x.k||"info"); li.appendChild(document.createTextNode(x.t)); if(x.act){ const a=el("div","act row"); x.act.forEach(([n,f])=>a.appendChild(btn(n,f,"sm"))); li.appendChild(a); } ul.appendChild(li); }); host.appendChild(ul); };
    const t=curT(), c=curClip(), f=UI.focus;
    if(f==="gamme"||!(P.step>=1)){
      add("La gamme : "+M.n,[{k:"info",t:M.genre},{k:"info",t:"Ce qui la fait sonner : "+M.jouer},{k:"warn",t:"Piège : "+M.piege},
        {k:"info",t:"Pour le dungeon synth, les valeurs sûres : éolien (épique), dorien (forêt, nostalgie), phrygien (crypte, rituel), mineur harmonique (château hanté). Écoute la gamme et ses accords (boutons ▷) avant de choisir.",act:[["▷ Gamme",playScale],["▷ Accords",playChords]]},
        ...[{k:"info",t:"Quand la gamme te plaît, passe aux accords (étape II).",act:[["Valider la gamme et passer aux accords",()=>edit(()=>{ P.step=1; const h=PJ.harmTrack(P); UI.t=P.tracks.indexOf(h); UI.focus="clip"; UI.tab="clip"; if(!h.clips[UI.r]) h.clips[UI.r]={name:"Accords",chords:[]}; },"all")]]}]]);
    }
    else if(f==="clip"&&t&&t.kind==="harm"&&c){
      const last=c.chords[UI.chordSel>=0?UI.chordSel:c.chords.length-1], sug=TH.nextSuggest(P.mode,last,c.chords.length);
      add(last?"Après "+TH.roman(last)+" ("+TH.chordName(last,P.key)+"), essaie":"Pour commencer",sug.map(s=>({k:"info",t:TH.roman(s.ch)+" ("+TH.chordName(s.ch,P.key)+") : "+s.why.join(" ; ")+".",act:[["Ajouter",()=>addChord(c,s.ch,false)],["▷",()=>playChord(s.ch)]]})));
      add("Relecture de la progression",TH.reviewProg(P.mode,c.chords,P.meter).map(x=>x.k==="warn"&&/Aucun accord ne contient/.test(x.t)?{...x,act:M.prog[0]?[["Essayer « "+M.prog[0][1]+" »",()=>edit(()=>{ c.chords=PJ.parse(M.prog[0][0],iv); },"all")]]:null}:x));
      if(c.chords.length>=2&&!P.tracks.some(x=>x.kind==="mel"&&x.clips[UI.r])) add("Et maintenant",[{k:"info",t:"La progression est posée. Étape III : empile une nappe qui la joue, puis un bourdon ou un arpège.",act:[["+ Nappe ici",()=>addLayer("nappe")],["+ Arpège ici",()=>addLayer("arpege")]]}]);
    }
    else if(f==="clip"&&t&&c&&c.type==="gen"){
      const G={nappe:["La nappe tient l'harmonie : c'est le sol. Voicing serré pour que les voix bougent peu (le plus doux), ouvert pour l'ampleur, quintes à vide pour un son archaïque.","Registre 3 ou 4 : au-dessus du bourdon, sous la mélodie. En dessous de Do3, coupe le grave à l'EQ.","Machine à cordes + Chorus Ensemble : le son du genre. Chœur pour le sacré, orgue pour le solennel."],
        bourdon:["Le bourdon est l'ancre : une tonique tenue (avec sa quinte) que tout le reste colore. En dark ambient, c'est souvent la seule harmonie.","S'il y a une basse, choisis : le bourdon ou la basse tient le grave, pas les deux.","Un Filtre auto lent (4 à 8 mesures) le fait respirer sans qu'on remarque d'où vient le mouvement."],
        basse:["La basse marque la fondamentale de chaque accord. En dungeon synth, une basse tenue suffit souvent.","Garde-la mono et propre : chaîne « Grave propre » dans Appareils."],
        arpege:["L'arpège égrène l'accord : le pilier de l'accompagnement en dungeon synth. Va-et-vient ou Dungeon (1-5-8-5) en croches, c'est le classique.","Harpe, luth, kalimba ou un patch pincé de Forger. Un peu d'écho (envoi B) le fait flotter.","Laisse une octave d'écart avec la mélodie, sinon ils se masquent."]}[c.gen]||[];
      add(TH.GEN_N[c.gen]+" : comment la régler",G.map(x=>({k:"info",t:x})));
      add("L'empilement",TH.reviewLayers(layerInfo()));
    }
    else if(f==="clip"&&t&&c&&c.type==="notes"){
      const h=harmOf(UI.r); add("Relecture de la mélodie",TH.reviewMel(c.notes,h?h.chords:[],{...ctxP()}));
      add("Méthode",[{k:"info",t:"Écris une question (2 mesures qui finissent en suspens, sur la quinte) puis une réponse (2 mesures qui finissent sur la tonique). « Doubler » puis modifie la fin."},{k:"info",t:"Les rangées teintées de vert sont les notes de l'accord en cours : pose-y les temps forts. Les autres notes de la gamme servent de passage."}]);
    }
    else if(f==="clip"&&t&&c&&t.kind==="drums"){
      add("Percussion dans le genre",[{k:"info",t:"En dungeon synth, la percussion est rare : une timbale lointaine sur le premier temps, parfois toutes les deux mesures. Elle marque la marche, elle ne fait pas danser."},{k:"info",t:"Teste les moteurs : chaque voie peut prendre une batterie différente. Grand tambour pour la guerre, tambour sur cadre pour le rituel, crotales antiques pour le temple."},{k:"info",t:"Envoie la percussion dans la réverb (A) pour l'éloigner : on l'entend au fond de la salle."}]);
    }
    else if(f==="couches"||(f==="clip"&&t&&!c)){
      add("Étape III : les couches",[{k:"info",t:"Ordre conseillé : bourdon ou nappe (le sol), puis arpège (le mouvement), puis mélodie (la voix). Une couche à la fois, en écoutant."},...TH.reviewLayers(layerInfo())].map(x=>x));
      add("Ajouter dans la scène « "+(P.scenes[UI.r]?P.scenes[UI.r].name:"")+" »",[{k:"info",t:"Chaque couche suit les accords de la piste Harmonie de la même scène.",act:[["+ Nappe",()=>addLayer("nappe")],["+ Bourdon",()=>addLayer("bourdon")],["+ Arpège",()=>addLayer("arpege")],["+ Basse",()=>addLayer("basse")]]}]);
    }
    else if(f==="arr"||UI.view==="arr"){
      add("L'arrangement",[{k:"info",t:"Le flux d'Ableton : arme ● en vue Session, lance la lecture, puis lance scènes et clips au fil de l'eau. Tout est écrit ici, à retoucher ensuite."},{k:"info",t:"Forme classique du genre : intro (nappe seule) → thème (tout) → pont (sans mélodie, autre progression) → thème → fin (le bourdon reste seul)."},{k:"info",t:"Une pièce de dungeon synth dure souvent 3 à 6 minutes : à 76 de tempo en 4/4, c'est 60 à 110 mesures."}]);
    }
    else if(f==="master"||f.startsWith("ret")||(f==="piste")){
      const L=[]; if(graph){ const pk=graph.level(graph.M.ana); if(pk>0.97) L.push({k:"warn",t:"Le master touche le limiteur : baisse un peu les pistes les plus fortes plutôt que le master."}); }
      if(f==="master") L.push({k:"info",t:"Sur le master : une Bande légère colle tout et donne l'âge ; un Compresseur doux (ratio 2) unit les couches. Le limiteur final empêche toute saturation de l'export."});
      else if(f.startsWith("ret")) L.push({k:"info",t:"Un retour reçoit ce que chaque piste lui envoie (boutons A et B du mixeur). Garde ses effets à 100 % de mix."});
      else if(t){ L.push({k:"info",t:"La chaîne se lit de gauche à droite : instrument, puis effets. EQ d'abord pour nettoyer, puis couleur (saturation, chorus), puis espace."}); if(t.devs.some(d=>d.type==="reverb")&&(t.a||0)>0.2) L.push({k:"warn",t:"Réverb en insert et envoi A en même temps : double réverb, le son se noie. Garde l'un des deux."}); }
      add("Mixage",L.concat(TH.reviewLayers(layerInfo()).filter(x=>x.k==="warn")));
    }
    else add("Session",[{k:"info",t:"Chaque colonne est une piste, chaque rangée une scène (une partie du morceau). ▶ sur un clip le lance, ▶ à droite lance toute la scène. Les lancements tombent sur la mesure suivante."}]);
  }
  function addLayer(role){ edit(()=>{ let i=P.tracks.findIndex(t=>t.role===role); if(i<0){ P.tracks.push(PJ.newTrack(role,P.scenes.length)); i=P.tracks.length-1; } const t=P.tracks[i]; if(!t.clips[UI.r]) t.clips[UI.r]={name:TH.GEN_N[role]||"Notes",type:"gen",gen:role,g:{}}; UI.t=i; UI.focus="clip"; UI.tab="clip"; P.step=Math.max(P.step||0,1); },"all"); }
  function layerInfo(){ const roles=[], r=UI.r; let low=0, arpOct=null, melOct=null, insRev=0;
    P.tracks.forEach(t=>{ if(t.devs.some(d=>d.type==="reverb")) insRev++; const c=t.clips[r]; if(!c||t.kind==="harm"||t.mute) return; if(t.kind==="drums"){ roles.push("percu"); return; }
      if(c.type==="gen"){ roles.push(c.gen); const g=Object.assign({},TH.GEN_DEF[c.gen],c.g); if(g.oct<=2||(c.gen==="nappe"&&g.oct<3)) low++; if(c.gen==="arpege") arpOct=g.oct; }
      else{ roles.push("melodie"); if(c.notes.length){ const m=c.notes.reduce((a,n)=>a+n.p,0)/c.notes.length; melOct=Math.floor(m/12)-1; if(m<48) low++; } } });
    return {roles,lowCount:low,arpOct,melOct,insRev}; }

  /* ============================================================ EXPORT ============================================================ */
  function openExport(){
    const d=$("dlgExport"), b=$("expBody"), len=PJ.arrLen(P.arr), B=TH.bb(P.meter); b.innerHTML="";
    const src=sel([...(len?[["arr","L'arrangement ("+len+" mesures)"]]:[]),["sc1","Les scènes dans l'ordre, chacune une fois"],["sc2","Les scènes dans l'ordre, chacune deux fois"]],len?"arr":"sc2",()=>{},"Source");
    const q=sel([[128,"128 kb/s"],[192,"192 kb/s"],[256,"256 kb/s"],[320,"320 kb/s"]],192,()=>{},"Qualité");
    b.append(lab("Ce qu'on exporte ",src),document.createElement("br"),lab("Qualité ",q));
    const pg=el("div","prog-bar","<i></i>"); b.appendChild(pg); $("expNote").textContent="Le rendu se fait hors temps réel, puis l'encodeur MP3 se charge (une connexion est nécessaire la première fois).";
    $("expGo").disabled=false;
    $("expGo").onclick=async()=>{
      $("expGo").disabled=true; const Pr=JSON.parse(JSON.stringify(P));
      if(src.value!=="arr"){ const rows=P.scenes.map((s,r)=>r).filter(r=>P.tracks.some(t=>t.clips[r])); Pr.arr=PJ.arrFromScenes(Pr,rows,src.value==="sc1"?1:2); }
      if(!PJ.arrLen(Pr.arr)){ $("expNote").textContent="Rien à exporter : crée au moins un clip."; $("expGo").disabled=false; return; }
      try{
        const fill=pg.querySelector("i"); $("expNote").textContent="Rendu en cours…";
        const r=await SON.render(Pr,p=>fill.style.width=Math.round(p*100)+"%");
        $("expNote").textContent="Encodage MP3…"; const gain=r.peak>0?Math.min(4,0.95/r.peak):1;
        const mp3=await mp3FromChannels(r.L,r.R,r.sr,gain,+q.value); fill.style.width="100%";
        const name=(P.name||"studio").replace(/[^\w\- àâäéèêëîïôöùûüç]/gi,"").trim()||"studio", a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([mp3],{type:"audio/mpeg"})); a.download=name+".mp3"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),20000);
        $("expNote").textContent="Fini : "+name+".mp3 ("+(mp3.length/1048576).toFixed(1)+" Mo, "+Math.round(r.L.length/r.sr)+" s)."; P.exported=true; save(); renderConseils();
      }catch(e){ $("expNote").textContent="Échec : "+(e&&e.message||e); }
      $("expGo").disabled=false;
    };
    d.showModal();
  }

  /* ============================================================ CLAVIER ============================================================ */
  const ROWS=[["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"],["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon"],["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP"]];
  const held=new Map();
  function keyPitch(code){ const iv=TH.MODES[P.mode].iv; for(let r=0;r<3;r++){ const k=ROWS[r].indexOf(code); if(k>=0){ const deg=k+r*7; return 12*(4+UI.kbOct)+P.key+iv[deg%7]+12*Math.floor(deg/7); } } return null; }
  const typing=e=>{ const tg=e.target; return tg&&(tg.tagName==="INPUT"&&tg.type!=="range"||tg.tagName==="SELECT"||tg.tagName==="TEXTAREA"||tg.isContentEditable); };
  document.addEventListener("keydown",e=>{
    if(typing(e)||$("dlgProj").open||$("dlgExport").open) return;
    if((e.ctrlKey||e.metaKey)&&e.code==="KeyZ"){ e.preventDefault(); e.shiftKey?doRedo():doUndo(); return; }
    if((e.ctrlKey||e.metaKey)&&e.code==="KeyY"){ e.preventDefault(); doRedo(); return; }
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    if(e.code==="Space"){ e.preventDefault(); togglePlay(); return; }
    if(e.code==="Escape"){ hideMenu(); return; }
    if(e.code==="PageUp"||e.code==="PageDown"){ e.preventDefault(); UI.kbOct=clamp(UI.kbOct+(e.code==="PageUp"?1:-1),-2,2); toast("Clavier : octave "+(4+UI.kbOct)); return; }
    if(e.code==="Delete"||e.code==="Backspace"){
      if(UI.view==="arr"&&UI.arrSel){ e.preventDefault(); delSeg(); return; }
      const c=curClip(); if(UI.roll&&c&&c.type==="notes"&&UI.selNotes.size){ e.preventDefault(); edit(()=>{ c.notes=c.notes.filter(n=>!UI.selNotes.has(n)); UI.selNotes.clear(); },"detail conseils"); return; }
      if(UI.focus==="clip"&&c&&e.code==="Delete"){ e.preventDefault(); edit(()=>{ curT().clips[UI.r]=null; },"all"); }
      return; }
    if(UI.roll&&UI.selNotes.size&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code)>=0){ const c=curClip(); if(c&&c.type==="notes"){ e.preventDefault();
      if(e.code==="ArrowUp"||e.code==="ArrowDown"){ const d=e.code==="ArrowUp"?1:-1; snap(); [...UI.selNotes].forEach(n=>{ const iv=TH.MODES[P.mode].iv; let p=n.p; if(e.shiftKey) p+=12*d; else do{ p+=d; } while(!TH.inScale(iv,p-P.key)&&Math.abs(p-n.p)<12); n.p=p; }); }
      else { snap(); const d=(e.code==="ArrowRight"?1:-1)*UI.grid, L=c.bars*TH.bb(P.meter); [...UI.selNotes].forEach(n=>n.s=clamp(n.s+d,0,L-n.d)); }
      drawRoll(); save(); return; } }
    if(e.repeat) return;
    const p=keyPitch(e.code); if(p===null) return; e.preventDefault();
    const t=curT(); if(!t||t.kind!=="mel") { audio(); graph.previewInst({k:"inst",name:"harpe"},p,0.7,1); return; }
    audio(); graph.preview(t,p,0.75,0.9); held.set(e.code,{p,b:TR&&TR.X.playing?TR.beatNow():null});
  });
  document.addEventListener("keyup",e=>{ const h=held.get(e.code); if(!h) return; held.delete(e.code); recNote(h); });
  function recNote(h){
    const t=P.tracks.find(x=>x.arm); if(!t||!TR||!TR.X.playing||h.b===null) return; const st=TR.slot(t.id); if(st.row===null) return; const c=t.clips[st.row]; if(!c||c.type!=="notes") return;
    const L=c.bars*TH.bb(P.meter), now=TR.beatNow(), g=UI.grid; let s=(((h.b-st.anchor)%L)+L)%L; s=Math.round(s/g)*g; if(s>=L) s-=L; const d=Math.max(g,Math.round((now-h.b)/g)*g);
    snap(); c.notes.push({s,d:Math.min(d,L-s),p:h.p,v:0.8}); save(); if(UI.roll&&UI.roll.c===c) drawRoll(); clearTimeout(recNote.t); recNote.t=setTimeout(renderConseils,600);
  }
  function togglePlay(){ audio(); if(TR.X.playing){ TR.stop(); } else if(UI.view==="arr"){ if(PJ.arrLen(P.arr)) TR.playArr(UI.arrCur); else toast("L'arrangement est vide."); } else TR.launchScene(UI.r); renderTopState(); }

  /* ============================================================ BOUCLE D'AFFICHAGE ============================================================ */
  function frame(){
    requestAnimationFrame(frame);
    if(!TR) return;
    const B=TH.bb(P.meter), b=TR.beatNow(); $("pos").textContent=TR.X.playing?(Math.floor(b/B)+1)+"."+(Math.floor(b%B)+1):"—";
    P.tracks.forEach(t=>{ const s=TR.X.slots[t.id], ps=TR.pos(t);
      t.clips.forEach((c,r)=>{ const cell=UI.cells[t.id+"|"+r]; if(!cell) return; const pl=TR.X.playing&&s&&s.row===r&&TR.X.mode==="session", pd=s&&s.pend!==undefined&&s.pend.row===r;
        cell.cl.classList.toggle("play",!!pl); cell.cl.classList.toggle("pend",!!pd); cell.bar.style.width=pl&&ps?(ps.f*100).toFixed(1)+"%":"0"; }); });
    const mt=(id,a)=>{ const c=UI.cells["mix|"+id]; if(!c) return; const v=graph.level(a), h=Math.min(1,Math.pow(v,0.5)); c.mi.style.height=(h*100).toFixed(0)+"%"; c.mi.classList.toggle("hot",v>0.98); };
    P.tracks.forEach((t,i)=>mt("t"+i,graph.trackNode(t).ana)); graph.R.forEach((r,i)=>mt("r"+i,r.ana)); mt("m",graph.M.ana);
    if(UI.arrPh&&UI.view==="arr"){ const on=TR.X.playing&&TR.X.mode==="arr"; UI.arrPh.ph.style.display=on?"block":"none"; if(on) UI.arrPh.ph.style.left=(120+b/B*UI.arrPh.ppb)+"px"; }
    if(UI.tab==="clip"&&TR.X.playing){ const c=curClip(), t=curT(); if(c&&c.type==="notes"&&UI.roll) drawRoll();
      if(UI.seq&&UI.seq.c===c){ const ps=TR.pos(t); const n=UI.seq.btns[0]?UI.seq.btns[0].length:0; const k=ps&&ps.row===UI.r?Math.floor(ps.f*n):-1; UI.seq.btns.forEach(bl=>bl.forEach((x,i)=>x.classList.toggle("now",i===k))); } }
  }

  /* ============================================================ BRANCHEMENTS ============================================================ */
  function renderAll(){ renderTop(); renderGamme(); renderSession(); renderDetail(); renderArr(); renderConseils(); }
  $("bPlay").onclick=()=>{ audio(); if(TR.X.playing) return; togglePlay(); };
  $("bStop").onclick=()=>{ if(TR) TR.stop(); renderTopState(); };
  $("bRec").onclick=()=>{ audio(); TR.X.rec=!TR.X.rec; renderTopState(); toast(TR.X.rec?"Enregistrement armé : lance la lecture, puis tes scènes et clips. L'arrêt écrit l'arrangement.":"Enregistrement désarmé."); };
  $("iTempo").onchange=()=>{ const v=clamp(+$("iTempo").value||P.tempo,30,220), old=60/P.tempo; edit(()=>P.tempo=v,"top"); if(TR) TR.retempo(old); if(graph) graph.soft(); };
  $("sMeter").onchange=()=>{ const v=$("sMeter").value; if(TR) TR.stop(); edit(()=>{ P.meter=v; P.tracks.forEach(t=>{ if(t.kind==="drums") t.clips.forEach(c=>c&&PJ.fixDrum(t,c,v)); }); },"all"); };
  $("sQuant").onchange=()=>edit(()=>P.quant=+$("sQuant").value,"top");
  $("pName").onchange=()=>edit(()=>P.name=$("pName").value.trim()||"Sans titre","top");
  document.querySelectorAll(".views button").forEach(b=>b.onclick=()=>{ UI.view=b.dataset.v; if(UI.view==="arr") UI.focus="arr"; else if(UI.focus==="arr") UI.focus="clip"; renderTop(); renderArr(); renderConseils(); });
  $("bUndo").onclick=doUndo; $("bRedo").onclick=doRedo;
  $("bProj").onclick=()=>$("dlgProj").showModal();
  document.querySelectorAll("#tplRow button").forEach(b=>b.onclick=()=>{ if(TR) TR.stop(); snap(); P=PJ.template(b.dataset.tpl); if(graph){ graph.setP(P); graph.sync(); } UI.t=0; UI.r=0; UI.focus=b.dataset.tpl==="vide"?"gamme":"clip"; UI.tab="clip"; $("dlgProj").close(); renderAll(); save(); toast("Nouveau projet. Ctrl+Z pour revenir à l'ancien."); });
  $("bSaveFile").onclick=()=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(P,null,1)],{type:"application/json"})); a.download=(P.name||"studio")+".bourdon.json"; document.body.appendChild(a); a.click(); a.remove(); };
  $("iOpen").onchange=async e=>{ const f=e.target.files[0]; if(!f) return; try{ const p=JSON.parse(await f.text()); if(!p.tracks) throw 0; if(TR) TR.stop(); snap(); P=p; if(graph){ graph.setP(P); graph.sync(); } UI.t=0; UI.r=0; renderAll(); save(); $("dlgProj").close(); toast("Projet ouvert."); }catch(x){ toast("Fichier illisible."); } e.target.value=""; };
  $("bExport").onclick=openExport; $("expClose").onclick=()=>$("dlgExport").close();
  window.addEventListener("resize",()=>{ if(UI.roll) drawRoll(); });
  renderAll(); requestAnimationFrame(frame);
  if(!localStorage.getItem(KEY)) setTimeout(()=>{ $("dlgProj").showModal(); },300);
  window.__studio={get P(){ return P; },UI,get graph(){ return graph; },get TR(){ return TR; },audio,renderAll};
})();
