"use strict";
/* ============================================================
   ENCHAÎNEMENTS : changer d'ambiance sur un point de sortie musical
   Comme dans la musique de jeu (iMUSE, puis Wwise et FMOD : points de sortie, transitions quantifiées, stingers),
   le changement de scène peut attendre la prochaine mesure, la fin de la phrase en cours ou le retour sur la tonique,
   puis se ponctuer d'un court signal (cloche, timbale, souffle, accord) joué dans la tonalité de la nouvelle scène.
   ============================================================ */
const ENCH={mode:"direct", sting:"aucun", pending:0, at:0};
(()=>{ try{ const v=JSON.parse(localStorage.getItem("bourdon.enchaine")||"{}"); if(v.mode) ENCH.mode=v.mode; if(v.sting) ENCH.sting=v.sting; }catch(e){} })();
const ENCH_MODES=[["direct","Tout de suite"],["mesure","À la mesure"],["phrase","À la fin de la phrase"],["cadence","Sur la tonique"]];
const ENCH_STINGS=[["aucun","Aucun signal"],["cloche","Cloche grave"],["timbale","Roulement de timbale"],["souffle","Souffle qui monte"],["accord","Accord qui s'ouvre"]];
function enchSave(){ try{ localStorage.setItem("bourdon.enchaine",JSON.stringify({mode:ENCH.mode,sting:ENCH.sting})); }catch(e){} }

/* le prochain point de sortie de la pièce en cours, en secondes du contexte audio.
   Au plus huit mesures d'attente : passé ce délai, on prend la mesure suivante, pour que le meneur ne reste jamais sans réponse. */
function enchExit(eng,ctx,mode){
  const now=ctx.currentTime+0.4, t0=eng.t0f(), bar=eng.bar, nextBar=t0+Math.ceil((now-t0)/bar-1e-6)*bar, limit=now+8*bar;
  if(mode==="mesure") return nextBar;
  if(mode==="phrase"){
    const b=Math.ceil((now-t0)/bar-1e-6), ph=eng.phraseBars().filter(x=>x>=b).sort((x,y)=>x-y)[0];
    if(ph!==undefined&&t0+ph*bar<=limit) return t0+ph*bar;
    const b4=Math.ceil(b/4)*4; return t0+b4*bar<=limit?t0+b4*bar:nextBar;
  }
  if(mode==="cadence"){
    /* le prochain accord de tonique, déjà planifié : la musique vient de se poser, c'est là qu'on change */
    const c=eng.chords().find(x=>x.t>=now&&x.t<=limit&&(x.d%Math.max(1,(x.iv||[]).length||7))===0);
    if(c) return c.t;
    return enchExit(eng,ctx,"phrase");
  }
  return 0;
}
/* changer d'ambiance pendant la lecture : tout de suite, ou au prochain point de sortie */
function enchainer(d){
  if(!live) return;
  clearTimeout(ENCH.pending); ENCH.pending=0;
  const {ctx,eng}=live, mode=ENCH.mode;
  const at=mode==="direct"?0:enchExit(eng,ctx,mode);
  if(!at){ crossfade(d); enchSting(ctx.currentTime+0.05); enchNote(""); return; }
  ENCH.at=at; enchNote("Changement "+(mode==="mesure"?"à la prochaine mesure":mode==="phrase"?"à la fin de la phrase":"au retour sur la tonique")+" (dans "+Math.max(1,Math.round(at-ctx.currentTime))+" s)");
  /* le nouveau moteur est créé un peu avant le point de sortie, pour que ses premières notes soient planifiées à temps */
  ENCH.pending=setTimeout(()=>{ ENCH.pending=0; if(!live||live.ctx!==ctx) return; crossfade(d,at); enchSting(at); enchNote(""); },Math.max(0,(at-ctx.currentTime-0.35)*1000));
}
function enchNote(t){ const n=document.getElementById("enchNote"); if(n) n.textContent=t; }
/* le signal : joué hors du moteur (directement vers la sortie), pour qu'il sonne pleinement même pendant le fondu d'entrée */
function enchSting(t){
  const k=ENCH.sting; if(!live||k==="aucun") return;
  const {ctx,eng,out}=live, bank=eng.bank, dst=ctx.createGain(); dst.gain.value=0.55; dst.connect(out||ctx.destination);
  const fq=mkFreq(S), f=o=>fq(o);
  try{
    if(k==="cloche"){ const b=bank.inst("carillon"), bl=bank.inst("bol"); b(t,f(-12),0.32,6,dst,0); b(t+0.002,f(-5),0.18,5,dst,0.15); bl(t,f(-24),0.3,8,dst,0); }
    else if(k==="timbale"){ const bar=eng.bar, n=10; for(let i=0;i<n;i++){ const x=i/(n-1); const tt=t-bar*0.5+x*x*bar*0.5; if(tt>ctx.currentTime+0.01) bank.perc("taiko","stomp",tt,0.12+0.35*x,dst); } bank.perc("taiko","stomp",t,0.75,dst); }
    else if(k==="souffle"){
      const s=ctx.createBufferSource(); s.buffer=bank.noise(); s.loop=true; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.Q.value=1.4; const g=ctx.createGain();
      const L=Math.min(3,eng.bar), t0=Math.max(ctx.currentTime+0.02,t-L); bp.frequency.setValueAtTime(300,t0); bp.frequency.exponentialRampToValueAtTime(4500,t);
      g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.5,t); g.gain.setTargetAtTime(0.0001,t,0.25);
      s.connect(bp); bp.connect(g); g.connect(dst); s.start(t0); s.stop(t+2);
    }
    else if(k==="accord"){ const iv=ivOf(S,S.scales.filter(Boolean)[0]||"mixolydien"), deg=i=>degOff(iv,i); [deg(0),deg(2),deg(4),deg(0)+12].forEach((o,j)=>bank.pad(S.pad.timbre||"cordes",t+j*0.04,eng.bar*1.5,f(o),dst,0.9)); bank.inst("harpe")(t,f(deg(4)+12),0.2,3,dst,0); }
  }catch(e){}
  setTimeout(()=>{ try{ dst.disconnect(); }catch(e){} },Math.max(0,(t-ctx.currentTime+12)*1000));
}
function enchBuild(){
  const box=document.querySelector(".fadebox"); if(!box||document.getElementById("enchMode")) return;
  const w=document.createElement("div"); w.className="ctl enchbox";
  w.innerHTML='<label for="enchMode">Point de sortie</label><select id="enchMode" title="Quand changer d\'ambiance pendant la lecture : tout de suite, à la prochaine mesure, à la fin de la phrase en cours ou au prochain retour sur la tonique (huit mesures d\'attente au plus)."></select>'+
    '<label for="enchSting">Signal</label><select id="enchSting" title="Un court signal joué au moment du changement, dans la tonalité de la nouvelle scène."></select><p class="hint" id="enchNote" aria-live="polite"></p>';
  box.after(w);
  const m=w.querySelector("#enchMode"), st=w.querySelector("#enchSting");
  ENCH_MODES.forEach(([v,l])=>m.add(new Option(l,v))); ENCH_STINGS.forEach(([v,l])=>st.add(new Option(l,v)));
  m.value=ENCH.mode; st.value=ENCH.sting;
  m.onchange=()=>{ ENCH.mode=m.value; enchSave(); }; st.onchange=()=>{ ENCH.sting=st.value; enchSave(); };
}
