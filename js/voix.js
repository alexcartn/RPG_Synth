"use strict";
/* ============================================================
   LA VOIX DU MENEUR : jouer sous la parole
   Deux aides, en direct seulement (ni l'export ni la capture n'en tiennent compte) :
   - Sous la voix : la musique recule d'environ 9 dB, la bande où se joue la compréhension de la parole (1 à 4 kHz, ANSI S3.5)
     se creuse, la mélodie se fait rare et la percussion recule. Les recommandations de mixage pour la télévision placent
     la musique à 10 LU sous un commentaire et une ambiance à 15 LU (Torcoli et al., Fraunhofer IIS).
   - Micro : la page écoute le micro (rien n'est enregistré ni envoyé) et la musique s'efface quand on parle,
     puis revient quand on se tait. Le seuil suit le bruit de la pièce, musique comprise.
   ============================================================ */
const VOIX={under:false, mic:false, depth:10, sens:0.5, stream:null, src:null, ana:null, buf:null, timer:0, floor:-60, lvl:-90, talking:false, since:0, quiet:0, chain:null, err:""};
(()=>{ try{ const v=JSON.parse(localStorage.getItem("bourdon.voix")||"{}"); if(v.depth) VOIX.depth=v.depth; if(v.sens!==undefined) VOIX.sens=v.sens; VOIX.under=!!v.under; }catch(e){} })();
function voixSave(){ try{ localStorage.setItem("bourdon.voix",JSON.stringify({under:VOIX.under, depth:VOIX.depth, sens:VOIX.sens})); }catch(e){} }
const voixDb=d=>Math.pow(10,d/20);

/* chaîne de sortie, une par contexte audio : creux de la parole, niveau sous la voix, puis effacement au micro */
function voixChain(ctx,dest){
  const eq=ctx.createBiquadFilter(); eq.type="peaking"; eq.frequency.value=2200; eq.Q.value=0.7; eq.gain.value=0;
  const under=ctx.createGain(), duck=ctx.createGain();
  eq.connect(under); under.connect(duck); duck.connect(dest);
  VOIX.chain={ctx,eq,under,duck};
  voixApply(true); if(VOIX.mic) voixAttach();
  return eq;
}
/* sous la voix : réglage immédiat, avec une rampe courte pour ne rien entendre claquer */
function voixApply(now){
  const c=VOIX.chain; if(!c) return;
  const t=c.ctx.currentTime, tc=now?0.01:0.25;
  c.eq.gain.setTargetAtTime(VOIX.under?-7:0,t,tc);
  c.under.gain.setTargetAtTime(VOIX.under?voixDb(-9):1,t,tc);
  if(typeof live!=="undefined"&&live&&live.eng){ live.eng.setLevels(); if(!now&&live.eng.replan) live.eng.replan("mel"); }
}
function voixUnder(on){
  VOIX.under=on===undefined?!VOIX.under:!!on; voixSave(); voixApply(false); voixUI();
}
/* micro : demandé à la personne une seule fois par séance ; l'annulation d'écho du navigateur retire en partie la musique de la page */
async function voixMic(on){
  on=on===undefined?!VOIX.mic:!!on;
  if(!on){ VOIX.mic=false; voixDetach(); if(VOIX.stream){ VOIX.stream.getTracks().forEach(t=>t.stop()); VOIX.stream=null; } voixUI(); return; }
  const md=navigator.mediaDevices;
  if(!md||!md.getUserMedia){ VOIX.err="Ce navigateur ne donne pas accès au micro (il faut une page en https ou en local)."; voixUI(); return; }
  try{
    if(!VOIX.stream) VOIX.stream=await md.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:false}});
    VOIX.mic=true; VOIX.err=""; voixAttach();
  }catch(e){ VOIX.mic=false; VOIX.err="Micro refusé ou introuvable : la musique ne peut pas s'effacer toute seule."; }
  voixUI();
}
function voixAttach(){
  const c=VOIX.chain; if(!c||!VOIX.stream||VOIX.src||!(typeof live!=="undefined"&&live&&live.ctx===c.ctx)) return;
  try{
    const src=c.ctx.createMediaStreamSource(VOIX.stream), hp=c.ctx.createBiquadFilter(), lp=c.ctx.createBiquadFilter(), ana=c.ctx.createAnalyser();
    hp.type="highpass"; hp.frequency.value=300; lp.type="lowpass"; lp.frequency.value=3400; ana.fftSize=1024; ana.smoothingTimeConstant=0;
    src.connect(hp); hp.connect(lp); lp.connect(ana); /* l'analyseur n'est relié à aucune sortie : le micro n'est jamais entendu */
    Object.assign(VOIX,{src,ana,buf:new Float32Array(ana.fftSize),floor:-60,talking:false,since:0,quiet:0,cal:performance.now()+1000,talk0:0});
    clearInterval(VOIX.timer); VOIX.timer=setInterval(voixTick,40);
  }catch(e){ VOIX.err="Le micro n'a pas pu être branché sur la lecture."; voixUI(); }
}
function voixDetach(){
  clearInterval(VOIX.timer); VOIX.timer=0;
  try{ if(VOIX.src) VOIX.src.disconnect(); }catch(e){}
  VOIX.src=null; VOIX.ana=null; VOIX.talking=false;
  const c=VOIX.chain; if(c&&!(typeof live!=="undefined"&&live&&live.ctx===c.ctx&&VOIX.mic)){ try{ c.duck.gain.setTargetAtTime(1,c.ctx.currentTime,0.2); }catch(e){} }
}
/* détection de la parole, toutes les 40 ms : le niveau dans la bande de la voix (300 Hz à 3,4 kHz) comparé au bruit de fond.
   Le fond suit lentement le niveau quand personne ne parle (la musique qui revient par le micro y compris) ; il faut 80 ms au-dessus
   du seuil pour s'effacer, et 700 ms de silence pour revenir, afin que la musique ne pompe pas entre deux mots. */
function voixTick(){
  const c=VOIX.chain, a=VOIX.ana; if(!c||!a) return;
  a.getFloatTimeDomainData(VOIX.buf); let s=0; for(let i=0;i<VOIX.buf.length;i++) s+=VOIX.buf[i]*VOIX.buf[i];
  const db=Math.max(-100,10*Math.log10(s/VOIX.buf.length+1e-12)); VOIX.lvl=db;
  const thr=18-12*VOIX.sens, now=performance.now();
  /* la première seconde sert à mesurer la pièce : pas de détection, le fond se cale vite */
  if(now<VOIX.cal){ VOIX.floor+=(db-VOIX.floor)*0.25; VOIX.floor=Math.max(-80,VOIX.floor); voixMeter(); return; }
  if(!VOIX.talking) VOIX.floor+=(db-VOIX.floor)*(db<VOIX.floor?0.3:0.004);
  else{ VOIX.floor+=(db-VOIX.floor)*0.001;
    /* la parole a toujours de petits creux entre les mots ; huit secondes au-dessus du seuil sans un seul creux,
       c'est un bruit continu qui a monté (la musique, la pièce) : on recale le fond et la musique revient */
    if(now-VOIX.talk0>8000){ VOIX.floor=db-3; VOIX.talking=false; VOIX.since=0; c.duck.gain.setTargetAtTime(1,c.ctx.currentTime,0.5); } }
  VOIX.floor=Math.max(-80,VOIX.floor);
  const over=db>VOIX.floor+thr&&db>-70;
  if(over){ VOIX.quiet=0; if(!VOIX.since) VOIX.since=now; if(!VOIX.talking&&now-VOIX.since>=80){ VOIX.talking=true; VOIX.talk0=now; c.duck.gain.setTargetAtTime(voixDb(-VOIX.depth),c.ctx.currentTime,0.06); } }
  else{ VOIX.since=0; if(VOIX.talking){ VOIX.talk0=now; if(!VOIX.quiet) VOIX.quiet=now; if(now-VOIX.quiet>=700){ VOIX.talking=false; VOIX.talk0=0; VOIX.quiet=0; c.duck.gain.setTargetAtTime(1,c.ctx.currentTime,0.5); } } }
  voixMeter();
}
function voixMeter(){
  const m=document.getElementById("voixMeter"); if(!m) return;
  const x=Math.max(0,Math.min(1,(VOIX.lvl+70)/60)), f=Math.max(0,Math.min(1,(VOIX.floor+18-12*VOIX.sens+70)/60));
  m.style.setProperty("--lv",(x*100).toFixed(1)+"%"); m.style.setProperty("--th",(f*100).toFixed(1)+"%");
  m.classList.toggle("on",VOIX.talking);
  const st=document.getElementById("voixState"); if(st) st.textContent=VOIX.talking?"tu parles : la musique s'efface":"à l'écoute";
}
function voixUI(){
  const u=document.getElementById("voixUnder"), m=document.getElementById("voixMicBtn"), d=document.getElementById("voixMore"), e=document.getElementById("voixErr");
  if(u) u.setAttribute("aria-pressed",VOIX.under?"true":"false");
  if(m) m.setAttribute("aria-pressed",VOIX.mic?"true":"false");
  if(d) d.hidden=!VOIX.mic;
  if(e) e.textContent=VOIX.err;
}
function voixBuild(){
  const host=document.getElementById("voixBox"); if(!host) return;
  host.innerHTML='<span class="ctl"><label>À la table</label></span>'+
    '<button class="btn" id="voixUnder" type="button" aria-pressed="false" title="La musique passe sous la voix du meneur : environ 9 dB plus bas, la bande de la parole (1 à 4 kHz) creusée, une mélodie plus rare et une percussion en retrait. En direct seulement : l\'export n\'en tient pas compte.">Sous la voix</button>'+
    '<button class="btn" id="voixMicBtn" type="button" aria-pressed="false" title="La page écoute le micro et la musique s\'efface quand tu parles, puis revient quand tu te tais. Rien n\'est enregistré ni envoyé.">Micro : s\'effacer quand je parle</button>'+
    '<div class="voix-more" id="voixMore" hidden>'+
      '<div class="voix-meter" id="voixMeter" aria-hidden="true"><i></i><b></b></div><p class="hint" id="voixState" aria-live="polite">à l\'écoute</p>'+
      '<div class="ctl"><label for="voixDepth">Effacement</label><select id="voixDepth"><option value="6">Léger (6 dB)</option><option value="10">Moyen (10 dB)</option><option value="16">Fort (16 dB)</option></select></div>'+
      '<div class="ctl"><label for="voixSens">Sensibilité</label><input type="range" id="voixSens" min="0" max="1" step="0.05" title="Plus haut : la moindre parole efface la musique. Plus bas : il faut parler franchement. Si la musique s\'efface toute seule, baisse."></div>'+
    '</div><p class="hint" id="voixErr" aria-live="polite"></p>';
  document.getElementById("voixUnder").onclick=()=>voixUnder();
  document.getElementById("voixMicBtn").onclick=()=>voixMic();
  const dp=document.getElementById("voixDepth"); dp.value=String(VOIX.depth); if(!dp.value) dp.value="10";
  dp.onchange=()=>{ VOIX.depth=parseFloat(dp.value)||10; voixSave(); };
  const sn=document.getElementById("voixSens"); sn.value=String(VOIX.sens); sn.oninput=()=>{ VOIX.sens=parseFloat(sn.value); voixSave(); };
  voixUI();
}
