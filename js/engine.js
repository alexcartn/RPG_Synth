"use strict";
/* ============================================================
   MOTEUR AUDIO
   ============================================================ */
function buildEngine(ctx, S, o){
  o = o||{};
  const seed=S.seed>>>0, sr=ctx.sampleRate;
  const R={m:mulberry32(seed), d:mulberry32(seed^0xA1B2C3), p:mulberry32(seed^0x51ED27), a:mulberry32(seed^0x7F4A7C),
           s:mulberry32(seed^0x3C6EF3), v:mulberry32(seed^0x2545F4), n:mulberry32(seed^0x85ebca6b), w:mulberry32(seed^0x1234567), l:mulberry32(seed^0x1F2E3D4B), t:mulberry32(seed^0x6D2B79F5)};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const G=v=>{const g=ctx.createGain(); g.gain.value=v; return g;};
  const PAN=v=>{ if(ctx.createStereoPanner){const p=ctx.createStereoPanner(); p.pan.value=v; return p;} return G(1); };
  const freq=mkFreq(S);
  const PEND_N0=3, pendN=()=>clamp(Math.round(S.pend.count),3,10);
  const tens=()=>S.tension===undefined?0.5:S.tension;
  const curveOn=()=>!!(S.curve&&S.curve.mode&&S.curve.mode!=="off"&&S.curve.pts&&S.curve.pts.length>1);
  /* tension au temps t : la courbe dessinée (répétée ou jouée une fois) ou le curseur */
  function tensAt(t){
    if(!curveOn()) return tens();
    const p=S.curve.pts, L=Math.max(30,S.curve.dur*60), x=(t-t0)/L, f=S.curve.mode==="loop"?((x%1)+1)%1:clamp(x,0,1), i=f*(p.length-1), a=Math.floor(i), b=Math.min(p.length-1,a+1);
    return clamp(p[a]+(p[b]-p[a])*(i-a),0,1);
  }
  const tensMul=k=>({perc:clamp(1+k,0,2), pad:clamp(1-0.5*k,0,2), drone:1+0.3*k, amb:clamp(1-0.6*k,0,2)});
  const E=30/S.tempo, PAT=METERS[S.meter].p, barE=PAT.length, bar=barE*E;
  const want=n=>!o.solo||o.solo===n;
  const events=[];
  const starts=[];
  /* aiguillages : un module à zéro est débranché de la sortie, donc plus calculé du tout */
  const links=[], droneLinks=[];
  const link=(from,to)=>{ const l={from,to,on:false}; links.push(l); return l; };
  const setLink=(l,on)=>{ if(l.on===on) return; l.on=on; if(on) l.from.connect(l.to); else { try{ l.from.disconnect(l.to); }catch(e){} } };
  let t0=0, started=false;

  /* sections */
  function secOf(t){
    const l=S.scales.filter(Boolean); if(!l.length) l.push("mixolydien");
    const i=Math.max(0,Math.floor((t-t0)/(S.sectionBars*bar)+1e-6));
    return {i, key:l[i%l.length]};
  }
  function sw(t){ const k=Math.round((t-t0)/E); return (k%2===1)? t+S.swing*E*0.5 : t; }

  /* bruits */
  const nLen=sr*6, nb=ctx.createBuffer(1,nLen,sr), nd=nb.getChannelData(0);
  let last=0; for(let i=0;i<nLen;i++){const x=R.n()*2-1; last=(last+0.02*x)/1.02; nd[i]=last*3.5;}
  const wb=ctx.createBuffer(1,sr*2,sr), wd=wb.getChannelData(0);
  for(let i=0;i<wd.length;i++) wd[i]=R.w()*2-1;
  function loopSrc(buf){const s=ctx.createBufferSource(); s.buffer=buf; s.loop=true; starts.push(s); return s;}

  /* chaîne maîtresse : sommation, saturation, ondulation, voile, comp */
  const out=G(1);
  const sat=ctx.createWaveShaper(); sat.oversample=o.lite?"none":"2x";
  function satCurve(d){const n=1024,c=new Float32Array(n),k=1+d*6,nt=Math.tanh(0.25*k); for(let i=0;i<n;i++){const x=i/(n-1)*2-1; c[i]=0.25*Math.tanh(k*x)/nt;} return c;}
  const wowD=ctx.createDelay(0.05); wowD.delayTime.value=0.012;
  const wowL1=ctx.createOscillator(); wowL1.frequency.value=0.55; const wowG1=G(0); wowL1.connect(wowG1); wowG1.connect(wowD.delayTime);
  const wowL2=ctx.createOscillator(); wowL2.frequency.value=6.3;  const wowG2=G(0); wowL2.connect(wowG2); wowG2.connect(wowD.delayTime);
  starts.push(wowL1,wowL2);
  const veil=ctx.createBiquadFilter(); veil.type="lowpass"; veil.Q.value=0.5;
  const master=G(0);
  out.connect(sat); veil.connect(master);
  const lWowIn=link(sat,wowD), lWowOut=link(wowD,veil), lWowBy=link(sat,veil);
  const volG=G(1); volG.connect(ctx.destination);
  const sleepG=G(1); sleepG.connect(volG);
  if(o.noComp){ master.connect(sleepG); }
  else{
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-20; comp.ratio.value=3; comp.attack.value=0.02; comp.release.value=0.4;
    master.connect(comp); comp.connect(sleepG);
  }
  /* extinction : tient le niveau jusqu'à tEnd-len puis descend en courbe douce jusqu'au silence en tEnd */
  const sleepV=x=>Math.pow(0.5+0.5*Math.cos(Math.PI*Math.max(0,Math.min(1,x))),2);
  function sleepFade(tEnd,len){
    const g=sleepG.gain, now=ctx.currentTime, tS=tEnd-len, x0=Math.max(0,Math.min(1,(now-tS)/len));
    g.cancelScheduledValues(now);
    const from=Math.max(now,tS), span=tEnd-from; if(span<=0.05){ g.setValueAtTime(0,now); return; }
    g.setValueAtTime(sleepV(x0),now);
    const n=64, curve=new Float32Array(n); for(let i=0;i<n;i++) curve[i]=sleepV(x0+(1-x0)*i/(n-1));
    if(g.setValueCurveAtTime) g.setValueCurveAtTime(curve,from,span); else g.linearRampToValueAtTime(0,tEnd);
  }
  function sleepClear(){ const g=sleepG.gain, now=ctx.currentTime; g.cancelScheduledValues(now); g.setTargetAtTime(1,now,0.3); }
  const hissSrc=loopSrc(wb), hissHP=ctx.createBiquadFilter(); hissHP.type="highpass"; hissHP.frequency.value=3500;
  const hissG=G(0); hissSrc.connect(hissHP); hissHP.connect(hissG); const lHiss=link(hissG,master);

  /* réverb */
  function makeIR(size,dark){
    const sz=clamp(size,0.4,o.lite?5:9), len=Math.floor(sr*sz), ir=ctx.createBuffer(2,len,sr), rr=mulberry32((seed^0x9e3779b9)>>>0), dec=6.9/sz;
    for(let c=0;c<2;c++){
      const d=ir.getChannelData(c); let lp=0, e=0;
      for(let i=0;i<len;i++){
        const t=i/sr, n=rr()*2-1, k=(0.6-0.54*dark)*(0.25+0.75*Math.exp(-t*0.7));
        lp+=(n-lp)*k; const v=lp*Math.exp(-t*dec)*(i<sr*0.02?i/(sr*0.02):1); d[i]=v; e+=v*v;
      }
      const nrm=1/Math.sqrt(e||1); for(let i=0;i<len;i++) d[i]*=nrm;
    }
    return ir;
  }
  const conv=ctx.createConvolver(); conv.buffer=makeIR(S.fx.size,S.fx.dark);
  const wet=G(1); conv.connect(wet); wet.connect(out);
  const revIn=G(1); const lRev=link(revIn,conv);

  /* écho en ping-pong */
  const dIn=G(1), dl=ctx.createDelay(4), dr=ctx.createDelay(4), dfb=G(0.4), dtone=ctx.createBiquadFilter();
  dtone.type="lowpass"; dtone.frequency.value=3200;
  const lDly=link(dIn,dl); dl.connect(dtone); dtone.connect(dr); dr.connect(dfb); dfb.connect(dl);
  const dOut=G(0), pL=PAN(-0.7), pR=PAN(0.7);
  dl.connect(pL); dr.connect(pR); pL.connect(dOut); pR.connect(dOut); const lDout=link(dOut,out);

  /* bus */
  function bus(rev,dly){
    const lvl=G(1), tm=G(1), it=G(1); lvl.connect(tm); tm.connect(it); it.connect(out);
    const rs=G(rev); it.connect(rs); rs.connect(revIn);
    if(dly){const ds=G(dly); it.connect(ds); ds.connect(dIn);}
    return {in:lvl, lvl, tm, it};
  }
  const B={drone:bus(0.45,0.1), mel:bus(0.9,1), pad:bus(0.8,0.6), perc:bus(0.2,0), amb:bus(0.3,0), loops:bus(0.9,0.8), pend:bus(0.9,0.7), evt:bus(0.55,0.35)};
  const canonG=G(0); const lCanon=link(canonG,B.mel.it);
  const murG=G(0), fireG=G(0), windG=G(0), dripG=G(0);
  const lMur=link(murG,B.amb.in), lFire=link(fireG,B.amb.in), lWind=link(windG,B.amb.in); dripG.connect(B.amb.in);
  /* sons de nature : chaque lit n'est construit que s'il est utilisé, et débranché quand il retombe à zéro */
  const NATS=["pluie","mer","nuit","ruisseau"], natG={}, natL={}, natB={}, birdG=G(0), lBird=link(birdG,B.amb.in);
  NATS.forEach(k=>{ natG[k]=G(0); natL[k]=link(natG[k],B.amb.in); });

  function setLevels(){
    const lv=(n,v)=>want(n)?v:0;
    B.drone.lvl.gain.value=lv("drone",S.drone.lvl);
    B.mel.lvl.gain.value=lv("mel",S.mel.lvl);
    canonG.gain.value=lv("mel",S.canon.lvl);
    B.pad.lvl.gain.value=lv("pad",S.pad.lvl);
    B.perc.lvl.gain.value=lv("perc",S.perc.lvl);
    B.amb.lvl.gain.value=lv("amb",1);
    B.evt.lvl.gain.value=S.evt?S.evt.lvl:0.7;
    volG.gain.value=S.vol===undefined?1:S.vol;
    { const nt=S.nature||{}, wa=want("amb");
      NATS.forEach(k=>{ if(wa&&(nt[k]||0)>0.001) ensureNature(k); });
      natG.pluie.gain.value=1; natG.mer.gain.value=(nt.mer||0)*1.0; natG.nuit.gain.value=(nt.nuit||0)*2.4; natG.ruisseau.gain.value=(nt.ruisseau||0)*1.6;
      if(natB.pluie){ const r=nt.pluie||0; natB.pluie.bg.gain.value=0.22*Math.pow(r,0.7); natB.pluie.ag.gain.value=0.28*r; natB.pluie.bg2.gain.value=0.5*r*r; }
      birdG.gain.value=(nt.oiseaux||0)*0.9; }
    if(!curveOn()){ /* curseur : valeur fixe ; courbe : le planificateur automatise ces gains */
      const m=tensMul((tens()-0.5)*2), now=ctx.currentTime||0;
      [["perc",m.perc],["pad",m.pad],["drone",m.drone],["amb",m.amb]].forEach(([n,v])=>{ const g=B[n].tm.gain; if(g.cancelScheduledValues) g.cancelScheduledValues(now); g.value=v; });
    }
    B.loops.lvl.gain.value=lv("loops",S.loops.lvl);
    B.pend.lvl.gain.value=lv("pend",S.pend.lvl);
    murG.gain.value=S.amb.murmur; fireG.gain.value=S.amb.feu*1.2; windG.gain.value=S.amb.vent*0.9; dripG.gain.value=S.amb.gouttes*0.8;
    wet.gain.value=S.fx.rev*2;
    dOut.gain.value=S.fx.dly; dfb.gain.value=Math.min(0.9,S.fx.fb);
    dl.delayTime.value=E*S.fx.dlyDiv; dr.delayTime.value=E*S.fx.dlyDiv*1.0;
    sat.curve=satCurve(S.fx.sat);
    wowG1.gain.value=S.fx.wow*0.003; wowG2.gain.value=S.fx.wow*0.0003;
    veil.frequency.value=18000*Math.pow(2500/18000,S.fx.veil);
    hissG.gain.value=S.fx.hiss*0.03;
    applyLinks();
  }
  function applyLinks(){
    const wow=S.fx.wow>0.001, rev=S.fx.rev>0.001, dly=S.fx.dly>0.001;
    setLink(lWowIn,wow); setLink(lWowOut,wow); setLink(lWowBy,!wow);
    setLink(lHiss,S.fx.hiss>0.001);
    setLink(lRev,rev); setLink(lDly,dly); setLink(lDout,dly);
    setLink(lCanon,S.canon.lvl>0.001);
    { const nt=S.nature||{}, wa=want("amb"); NATS.forEach(k=>setLink(natL[k],wa&&(nt[k]||0)>0.001)); setLink(lBird,wa&&(nt.oiseaux||0)>0.001); }
    setLink(lMur,S.amb.murmur>0.001); setLink(lFire,S.amb.feu>0.001); setLink(lWind,S.amb.vent>0.001);
    droneLinks.forEach(l=>setLink(l,S.drone.lvl>0.001));
  }
  function setReverb(){ conv.buffer=makeIR(S.fx.size,S.fx.dark); }

  /* ---------- sons de nature ---------- */
  function natSrc(buf,loopEnd){ const x=ctx.createBufferSource(); x.buffer=buf; x.loop=true; if(loopEnd) x.loopEnd=loopEnd; starts.push(x); if(started) x.start(ctx.currentTime); return x; }
  /* gouttes : de petits claquements secs ("tick") ou des plocs qui chutent ("plop"), tirés une fois pour toutes */
  function genDrops(len,rate,kind,sd){
    const n=Math.floor(sr*len), b=ctx.createBuffer(1,n,sr), d=b.getChannelData(0), r=mulberry32((seed^sd)>>>0);
    for(let t=0;t<len;t+=-Math.log(1-r()*0.999)/rate){
      const i0=Math.floor(t*sr), a=0.25+r()*0.75;
      if(kind==="tick"){ const dl=Math.floor(sr*(0.002+r()*0.003)); let lp=0; for(let i=0;i<dl&&i0+i<n;i++){ const x=r()*2-1; lp+=(x-lp)*0.6; d[i0+i]+=(x-lp)*a*(1-i/dl); } }
      else{ const dl=Math.floor(sr*(0.02+r()*0.03)), f0=500+r()*700; for(let i=0;i<dl&&i0+i<n;i++){ const tt=i/sr; d[i0+i]+=Math.sin(2*Math.PI*f0*tt*(1-6*tt))*a*0.5*Math.exp(-i/dl*4); } }
    }
    return b;
  }
  /* vagues : une succession de houles (montée lente, crête mousseuse, retrait), un canal décalé pour la largeur */
  function genSea(){
    const len=30, fade=Math.floor(sr*0.2), n=Math.floor(sr*len)+fade, b=ctx.createBuffer(2,n,sr), r=mulberry32((seed^0x51A5EA)>>>0);
    const ws=[]; let tot=0; while(tot<len-3){ const w=5+r()*4; ws.push(w); tot+=w; } const sc=len/ws.reduce((a,x)=>a+x,0); ws.forEach((w,i)=>ws[i]=w*sc);
    const starts_=[]; let acc=0; ws.forEach(w=>{ starts_.push(acc); acc+=w; });
    const env=t=>{ t=((t%len)+len)%len; let k=0; while(k+1<ws.length&&starts_[k+1]<=t) k++; const u=(t-starts_[k])/ws[k]; return u<0.55?Math.pow(u/0.55,1.6):Math.pow(1-(u-0.55)/0.45,1.4); };
    for(let c=0;c<2;c++){
      const d=b.getChannelData(c); let lp=0, lp2=0, mx=0;
      for(let i=0;i<n;i++){
        const e=env(i/sr+c*1.3), x=r()*2-1; lp+=(x-lp)*(0.012+0.2*e); lp2+=(x-lp2)*0.35;
        d[i]=lp*(1.2+3.2*e)+(x-lp2)*e*e*e*0.2; if(Math.abs(d[i])>mx) mx=Math.abs(d[i]);
      }
      const g=0.8/(mx||1); for(let i=0;i<n;i++) d[i]*=g;
      for(let i=0;i<fade;i++){ const w=i/fade; d[i]=d[i]*w+d[n-fade+i]*(1-w); } /* raccord de la boucle */
    }
    return {b,loopEnd:(n-fade)/sr};
  }
  /* nuit : grillons de hauteurs différentes, chacun une série d'impulsions très brèves */
  function genNight(){
    const len=22, n=Math.floor(sr*len), b=ctx.createBuffer(1,n,sr), d=b.getChannelData(0), r=mulberry32((seed^0x7A11E5)>>>0);
    for(let k=0;k<6;k++){
      const fc=3600+r()*1700, rate=28+r()*16, period=0.5+r()*0.6, amp=0.05+r()*0.05, np=3+Math.floor(r()*3);
      for(let t=r()*period;t<len-0.5;t+=period*(0.85+0.3*r())){
        for(let q=0;q<np;q++){ const i0=Math.floor((t+q/rate)*sr), dl=Math.floor(sr*0.011); for(let i=0;i<dl&&i0+i<n;i++) d[i0+i]+=Math.sin(2*Math.PI*fc*i/sr)*amp*Math.sin(Math.PI*i/dl); }
      }
    }
    return b;
  }
  /* ruisseau : un fond d'eau qui ondule et des bulles qui montent */
  function genBrook(){
    const len=16, n=Math.floor(sr*len), b=ctx.createBuffer(1,n,sr), d=b.getChannelData(0), r=mulberry32((seed^0x8B00C1)>>>0);
    let lp=0; for(let i=0;i<n;i++){ const t=i/sr, m=0.7+0.3*Math.sin(2*Math.PI*t/len*5)+0.15*Math.sin(2*Math.PI*t/len*13); lp+=((r()*2-1)-lp)*0.2; d[i]=lp*0.25*m; }
    for(let t=0;t<len-0.1;t+=-Math.log(1-r()*0.999)/38){
      const i0=Math.floor(t*sr), dl=Math.floor(sr*(0.015+r()*0.03)), f0=500+r()*1300, a=0.05+r()*0.14;
      for(let i=0;i<dl&&i0+i<n;i++){ const tt=i/sr; d[i0+i]+=Math.sin(2*Math.PI*f0*tt*(1+14*tt))*a*Math.exp(-i/dl*3); }
    }
    return b;
  }
  function ensureNature(k){
    if(natB[k]) return; natB[k]=true;
    const out=natG[k], bq=(type,f,q)=>{ const x=ctx.createBiquadFilter(); x.type=type; x.frequency.value=f; if(q) x.Q.value=q; return x; };
    if(k==="pluie"){
      const bed=natSrc(wb), hp=bq("highpass",900), lp=bq("lowpass",9000), bg=G(0); bed.connect(hp); hp.connect(lp); lp.connect(bg); bg.connect(out);
      const a=natSrc(genDrops(11.3,70,"tick",0x2F6E2B1)), ag=G(0), b2=natSrc(genDrops(13.7,9,"plop",0x4C3B1F7)), bg2=G(0); a.connect(ag); ag.connect(out); b2.connect(bg2); bg2.connect(out);
      natB.pluie={bg,ag,bg2};
    }
    else if(k==="mer"){ const {b,loopEnd}=genSea(), x=natSrc(b,loopEnd); x.connect(out); }
    else if(k==="nuit"){ const x=natSrc(genNight()); x.connect(out); }
    else if(k==="ruisseau"){ const x=natSrc(genBrook()), f=bq("lowpass",5200,0.5); x.connect(f); f.connect(out); }
  }
  /* oiseaux : phrases brèves tirées au hasard (trois "espèces"), planifiées comme les autres événements */
  function bird(t){
    const sp=Math.floor(R.t()*3), pan=(R.t()*2-1)*0.8, base=2200+R.t()*2400, n=sp===0?3+Math.floor(R.t()*3):sp===1?6+Math.floor(R.t()*5):2+Math.floor(R.t()*2);
    let tt=t;
    for(let i=0;i<n;i++){
      let d,f0,f1;
      if(sp===0){ d=0.07+R.t()*0.05; f0=base*(0.9+R.t()*0.3); f1=f0*(R.t()<0.5?1.35:0.75); }
      else if(sp===1){ d=0.035; f0=base*(i%2?1.12:1); f1=f0*0.97; }
      else{ d=0.18+R.t()*0.1; f0=base*0.8; f1=f0*1.6; }
      const x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(f0,tt); x.frequency.exponentialRampToValueAtTime(f1,tt+d);
      const e=G(0); e.gain.setValueAtTime(0,tt); e.gain.linearRampToValueAtTime(0.5,tt+0.012); e.gain.exponentialRampToValueAtTime(0.0001,tt+d+0.04);
      x.connect(e); route(e,pan,birdG); x.start(tt); x.stop(tt+d+0.1);
      tt+=d+(sp===1?0.02:0.05+R.t()*0.06);
    }
  }
  setLevels();

  /* ---------- bourdon ---------- */
  const droneFilters=[]; let fifthGl=[];
  function droneVoice(off,lvl,cut,ty,isFifth){
    const bright=0.5+S.drone.bright*1.5, base=cut*bright, w=3+S.drone.width*14;
    const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=base; f.Q.value=0.7; droneFilters.push({f,base});
    const g=G(lvl); f.connect(g); droneLinks.push(link(g,B.drone.in));
    const fr0=freq(off), oscs=[], srcs=[], gls=[];
    const mk=(type,mult,det,dst,gain)=>{
      const os=ctx.createOscillator(); os.type=type; os.frequency.value=fr0*mult; os.detune.value=det;
      if(gain!==undefined){const gg=G(gain); os.connect(gg); gg.connect(dst);} else os.connect(dst);
      oscs.push(os); srcs.push(os); gls.push({p:os.frequency,m:mult}); return os;
    };
    if(ty==="sine"||ty==="pur"){ mk("sine",1,0,f); }
    else if(ty==="bol"){ mk("sine",1,-w*0.25,f,0.9); mk("sine",1,w*0.25,f,0.9); mk("sine",2.003,0,f,0.28); mk("sine",2.71,w*0.1,f,0.12); }
    else if(ty==="anche"){ mk("sawtooth",1,-w,f); mk("sawtooth",1,w,f); }
    else if(ty==="orgue"){ [[1,1],[2,0.5],[3,0.25],[4,0.14]].forEach(([m,a])=>mk("sine",m,(m%2?-1:1)*w*0.4,f,a*0.8)); }
    else{
      const bpA=ctx.createBiquadFilter(); bpA.type="bandpass"; bpA.frequency.value=625; bpA.Q.value=5;
      const bpB=ctx.createBiquadFilter(); bpB.type="bandpass"; bpB.frequency.value=1100; bpB.Q.value=7;
      const gA=G(0.9), gB=G(0.7), gD=G(0.35);
      bpA.connect(gA); gA.connect(g); bpB.connect(gB); gB.connect(g); gD.connect(f);
      [-w,w].forEach(dt=>{
        const os=ctx.createOscillator(); os.type="sawtooth"; os.frequency.value=fr0; os.detune.value=dt;
        os.connect(bpA); os.connect(bpB); os.connect(gD); oscs.push(os); srcs.push(os); gls.push({p:os.frequency,m:1});
      });
      const lf=ctx.createOscillator(); lf.frequency.value=0.05+R.d()*0.06; const lg=G(180); lf.connect(lg); lg.connect(bpA.frequency); oscs.push(lf);
    }
    const lfo=ctx.createOscillator(); lfo.frequency.value=0.04+R.d()*0.08; const lg=G(2+S.drone.drift*14);
    lfo.connect(lg); srcs.forEach(os=>lg.connect(os.detune)); oscs.push(lfo);
    const lfo2=ctx.createOscillator(); lfo2.frequency.value=0.02+R.d()*0.05; const lg2=G(base*(0.12+0.35*S.drone.drift));
    lfo2.connect(lg2); lg2.connect(f.frequency); oscs.push(lfo2);
    oscs.forEach(x=>starts.push(x));
    if(isFifth) fifthGl=gls;
  }
  if(want("drone")){
    const tone=S.drone.timbre;
    droneVoice(-12,0.55,300,"sine",false);
    droneVoice(0,0.17,420,tone,false);
    droneVoice(7,0.13,460,tone,true);
    droneVoice(12,0.09,700,tone,false);
    if(!o.lite) droneVoice(19,0.045,900,tone,false);
  }

  applyLinks();

  /* ---------- instruments mélodiques ---------- */
  function route(node,pan,dst){const p=PAN(pan); node.connect(p); p.connect(dst);}
  function envA(t,a,peak,rel,len){const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(peak,t+a); e.gain.setValueAtTime(peak,t+Math.max(a,len)); e.gain.linearRampToValueAtTime(0,t+len+rel); return e;}
  function envD(t,peak,dur){const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(peak,t+0.006); e.gain.exponentialRampToValueAtTime(0.0001,t+dur); return e;}
  const INST={
    luth(t,f,vel,len,dst,pan){
      const dur=2.8, o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator();
      o1.type="triangle"; o2.type="sawtooth"; o3.type="sine"; o1.frequency.value=f; o2.frequency.value=f; o2.detune.value=5; o3.frequency.value=f*2;
      const g2=G(0.18), g3=G(0.22), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.8;
      fl.frequency.setValueAtTime(3000,t); fl.frequency.exponentialRampToValueAtTime(520,t+1.3);
      const e=envD(t,vel,dur); o1.connect(fl); o2.connect(g2); g2.connect(fl); o3.connect(g3); g3.connect(fl); fl.connect(e); route(e,pan,dst);
      [o1,o2,o3].forEach(o=>{o.start(t); o.stop(t+dur+0.1);});
    },
    harpe(t,f,vel,len,dst,pan){
      const dur=4.2, o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator();
      o1.type="triangle"; o2.type="sine"; o3.type="sine"; o1.frequency.value=f; o2.frequency.value=f*2; o3.frequency.value=f*3;
      const g2=G(0.3), g3=G(0.12), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.6;
      fl.frequency.setValueAtTime(5200,t); fl.frequency.exponentialRampToValueAtTime(1400,t+1.8);
      const e=envD(t,vel*1.05,dur); o1.connect(fl); o2.connect(g2); g2.connect(fl); o3.connect(g3); g3.connect(fl); fl.connect(e); route(e,pan,dst);
      [o1,o2,o3].forEach(o=>{o.start(t); o.stop(t+dur+0.1);});
    },
    flute(t,f,vel,len,dst,pan){
      const L=Math.max(0.18,len), o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator();
      o1.type="sine"; o2.type="sine"; o3.type="sine"; o1.frequency.value=f; o2.frequency.value=f*2; o3.frequency.value=f*3;
      const g2=G(0.14), g3=G(0.05), mix=G(1);
      o1.connect(mix); o2.connect(g2); g2.connect(mix); o3.connect(g3); g3.connect(mix);
      const vib=ctx.createOscillator(); vib.frequency.value=5.1; const vg=G(0); vib.connect(vg); [o1,o2,o3].forEach(o=>vg.connect(o.detune));
      vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(9,t+L*0.7);
      const br=ctx.createBufferSource(); br.buffer=wb; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=Math.min(9000,f*2.2); bp.Q.value=1.4;
      const bg=G(vel*0.5); br.connect(bp); bp.connect(bg); bg.connect(mix);
      const e=envA(t,0.07,vel*1.0,0.16,L); mix.connect(e); route(e,pan,dst);
      br.start(t,R.v()*1.4); br.stop(t+L+0.3);
      [o1,o2,o3,vib].forEach(o=>{o.start(t); o.stop(t+L+0.3);});
    },
    carillon(t,f,vel,len,dst,pan){
      const sum=G(1);
      [[1,1,3.8],[2.76,0.45,2.2],[5.4,0.22,1.3],[8.93,0.1,0.7]].forEach(([m,a,d])=>{
        if(f*m>12000) return;
        const os=ctx.createOscillator(); os.type="sine"; os.frequency.value=f*m;
        const e=envD(t,vel*a*1.1,d); os.connect(e); e.connect(sum); os.start(t); os.stop(t+d+0.1);
      });
      route(sum,pan,dst);
    },
    bol(t,f,vel,len,dst,pan){
      const sum=G(1);
      [[1,1,7,-3],[1,0.8,7,3],[2.71,0.3,5,0],[5.15,0.1,3.4,0]].forEach(([m,a,d,det])=>{
        if(f*m>12000) return; const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m; x.detune.value=det;
        const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*a*0.9,t+0.012); e.gain.exponentialRampToValueAtTime(0.0001,t+d); x.connect(e); e.connect(sum); x.start(t); x.stop(t+d+0.1);
      });
      route(sum,pan,dst);
    },
    verre(t,f,vel,len,dst,pan){
      const sum=G(0.9), tr=ctx.createOscillator(), tg=G(0.1); tr.frequency.value=5.6; tr.connect(tg); tg.connect(sum.gain);
      [[1,1,5],[2.76,0.26,3.2],[5.4,0.09,2]].forEach(([m,a,d])=>{
        if(f*m>12000) return; const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m;
        const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*a*1.05,t+0.04); e.gain.exponentialRampToValueAtTime(0.0001,t+d); x.connect(e); e.connect(sum); x.start(t); x.stop(t+d+0.1);
      });
      tr.start(t); tr.stop(t+5.2); route(sum,pan,dst);
    },
    kalimba(t,f,vel,len,dst,pan){
      const sum=G(1);
      [[1,1,1.9],[2,0.18,0.9],[5.4,0.3,0.45]].forEach(([m,a,d])=>{
        if(f*m>12000) return; const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m; const e=envD(t,vel*a*1.2,d); x.connect(e); e.connect(sum); x.start(t); x.stop(t+d+0.1);
      });
      route(sum,pan,dst);
    },
    oud(t,f,vel,len,dst,pan){
      const dur=2.6, fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=1.2;
      fl.frequency.setValueAtTime(3400,t); fl.frequency.exponentialRampToValueAtTime(420,t+1);
      const e=envD(t,vel*0.95,dur); fl.connect(e); route(e,pan,dst);
      [-5,5].forEach(det=>{
        const a=ctx.createOscillator(), b=ctx.createOscillator(), gb=G(0.45); a.type="triangle"; b.type="sawtooth"; a.frequency.value=f; b.frequency.value=f; a.detune.value=det; b.detune.value=det;
        a.connect(fl); b.connect(gb); gb.connect(fl); [a,b].forEach(x=>{x.start(t); x.stop(t+dur+0.1);});
      });
      noiseHit(t,vel*0.18,2600,0.03,"bandpass",dst);
    },
    ney(t,f,vel,len,dst,pan){
      const L=Math.max(0.3,len), o1=ctx.createOscillator(), o2=ctx.createOscillator(), mix=G(1);
      o1.type="sine"; o2.type="triangle"; o1.frequency.setValueAtTime(f*0.96,t); o1.frequency.exponentialRampToValueAtTime(f,t+0.14); o2.frequency.setValueAtTime(f*0.96*2,t); o2.frequency.exponentialRampToValueAtTime(f*2,t+0.14);
      const g2=G(0.12); o1.connect(mix); o2.connect(g2); g2.connect(mix);
      const vib=ctx.createOscillator(); vib.frequency.value=4.7; const vg=G(0); vib.connect(vg); vg.connect(o1.detune); vg.connect(o2.detune);
      vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(14,t+L*0.8);
      const br=ctx.createBufferSource(); br.buffer=wb; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=Math.min(9000,f*2.4); bp.Q.value=2;
      const bg=G(vel*0.75); br.connect(bp); bp.connect(bg); bg.connect(mix);
      const e=envA(t,0.12,vel,0.25,L); mix.connect(e); route(e,pan,dst);
      br.start(t,R.v()*1.4); br.stop(t+L+0.4); [o1,o2,vib].forEach(x=>{x.start(t); x.stop(t+L+0.4);});
    },
    synthe(t,f,vel,len,dst,pan){
      const L=Math.max(0.6,len), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.7;
      fl.frequency.setValueAtTime(900,t); fl.frequency.linearRampToValueAtTime(1500,t+L*0.4); fl.frequency.linearRampToValueAtTime(700,t+L+0.8);
      const e=envA(t,0.25,vel*0.7,0.8,L); fl.connect(e); route(e,pan,dst);
      [-8,8].forEach(det=>{ const x=ctx.createOscillator(); x.type="sawtooth"; x.frequency.value=f; x.detune.value=det; x.connect(fl); x.start(t); x.stop(t+L+1); });
    },
    orgue(t,f,vel,len,dst,pan){
      const L=Math.max(0.2,len), mix=G(1), os=[];
      [[1,1],[2,0.45],[4,0.25]].forEach(([m,a])=>{const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m; const g=G(a); x.connect(g); g.connect(mix); os.push(x);});
      const e=envA(t,0.03,vel*0.85,0.14,L); mix.connect(e); route(e,pan,dst);
      const br=ctx.createBufferSource(); br.buffer=wb; const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=2500;
      const cg=G(0); cg.gain.setValueAtTime(vel*0.4,t); cg.gain.exponentialRampToValueAtTime(0.0001,t+0.05); br.connect(hp); hp.connect(cg); cg.connect(e);
      br.start(t,R.v()*1.4); br.stop(t+0.08);
      os.forEach(x=>{x.start(t); x.stop(t+L+0.3);});
    }
  };

  /* ---------- nappes ---------- */
  function padVoice(t,len,f,timbre){
    const a=Math.min(3,len*0.45), rel=Math.min(3.5,len*0.8), e=G(0);
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.09,t+a); e.gain.setValueAtTime(0.09,t+len); e.gain.linearRampToValueAtTime(0,t+len+rel);
    e.connect(B.pad.in);
    const end=t+len+rel+0.1, os=[];
    const add=(type,fr,det,dst,gain)=>{const x=ctx.createOscillator(); x.type=type; x.frequency.value=fr; x.detune.value=det; if(gain!==undefined){const g=G(gain); x.connect(g); g.connect(dst);} else x.connect(dst); os.push(x); return x;};
    if(timbre==="orgue"){ [[1,1],[2,0.45],[3,0.22],[4,0.12]].forEach(([m,a2])=>add("sine",f*m,0,e,a2*0.9)); }
    else if(timbre==="synthe"){
      const fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.frequency.value=1100; fl.Q.value=0.5; fl.connect(e);
      add("sawtooth",f,-12,fl,0.55); add("sawtooth",f,12,fl,0.55); add("sine",f*0.5,0,e,0.5);
      const lf=ctx.createOscillator(); lf.frequency.value=0.05+R.v()*0.05; const lg=G(420); lf.connect(lg); lg.connect(fl.frequency); os.push(lf);
    }
    else if(timbre==="verre"){
      [[1,1],[2.003,0.3],[3.01,0.12],[4.07,0.06]].forEach(([m,a2])=>{ add("sine",f*m,-4,e,a2*0.5); add("sine",f*m,4,e,a2*0.5); });
      const tr=ctx.createOscillator(); tr.frequency.value=0.3+R.v()*0.3; const tg=G(0.25); tr.connect(tg); tg.connect(e.gain); os.push(tr);
    }
    else if(timbre==="cordes"){
      const fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.frequency.value=1700; fl.Q.value=0.6; fl.connect(e);
      add("sawtooth",f,-9,fl); add("sawtooth",f,9,fl);
      const vb=ctx.createOscillator(); vb.frequency.value=4.6+R.v()*1.2; const vg=G(0); vb.connect(vg); os.forEach(x=>vg.connect(x.detune));
      vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(7,t+a+1); os.push(vb);
    }else{
      const bpA=ctx.createBiquadFilter(); bpA.type="bandpass"; bpA.frequency.value=650; bpA.Q.value=6;
      const bpB=ctx.createBiquadFilter(); bpB.type="bandpass"; bpB.frequency.value=1150; bpB.Q.value=8;
      const gA=G(0.8), gB=G(0.6), gD=G(0.22), lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=2200;
      bpA.connect(gA); gA.connect(e); bpB.connect(gB); gB.connect(e); gD.connect(lp); lp.connect(e);
      [-7,7].forEach(dt=>{const x=add("sawtooth",f,dt,bpA); x.connect(bpB); x.connect(gD);});
      const lf=ctx.createOscillator(); lf.frequency.value=0.08+R.v()*0.07; const lg=G(150); lf.connect(lg); lg.connect(bpA.frequency); os.push(lf);
    }
    os.forEach(x=>{x.start(t); x.stop(end);});
  }

  /* ---------- percussion ---------- */
  function noiseHit(t,vel,fq,dur,type,dst){
    const s=ctx.createBufferSource(); s.buffer=wb; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=fq; f.Q.value=type==="bandpass"?1.2:0.7;
    const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel,t+0.002); e.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(e); e.connect(dst); s.start(t,R.v()*1.5); s.stop(t+dur+0.05);
  }
  function thump(t,vel,f0,f1,dur){
    const x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(f0,t); x.frequency.exponentialRampToValueAtTime(f1,t+0.14);
    const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel,t+0.003); e.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    x.connect(e); e.connect(B.perc.in); x.start(t); x.stop(t+dur+0.05);
  }
  const stomp=(t,v)=>{thump(t,v*0.7,115,46,0.35); noiseHit(t,v*0.18,420,0.06,"lowpass",B.perc.in);};
  const tap=(t,v)=>{thump(t,v*0.25,220,150,0.1); noiseHit(t,v*0.5,1700,0.09,"bandpass",B.perc.in);};
  const shaker=(t,v)=>noiseHit(t,v,7000,0.045,"highpass",B.perc.in);

  /* ---------- lieu : murmure, tintements, feu, vent, gouttes ---------- */
  const bands=[];
  let windBP=null;
  if(want("amb")){
    const nsrc=loopSrc(nb);
    [[320,1.0,1.0],[900,1.4,0.8],[2100,2.0,0.35]].forEach(([fq,q,lv])=>{
      const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=fq; bp.Q.value=q;
      const g=G(0); nsrc.connect(bp); bp.connect(g); g.connect(murG); bands.push({g,cur:0,lvl:lv});
    });
    const fsrc=loopSrc(nb), flp=ctx.createBiquadFilter(); flp.type="lowpass"; flp.frequency.value=230; const fg=G(0.5); fsrc.connect(flp); flp.connect(fg); fg.connect(fireG);
    /* craquements : 12 s de claquements tirés une fois pour toutes, lus en boucle (un seul nœud au lieu de cinq par seconde) */
    const cn=Math.floor(sr*12), cb=ctx.createBuffer(1,cn,sr), cd=cb.getChannelData(0), cr=mulberry32((seed^0x5F3759DF)>>>0);
    for(let t=0.05; t<11.9; t+=-Math.log(1-cr()*0.999)*0.18+0.02){
      const big=cr()<0.04, v=Math.pow(cr(),2)*0.9*(big?1.8:1), dl=Math.floor((big?0.07:0.01+cr()*0.03)*sr), i0=Math.floor(t*sr);
      let lp=0;
      for(let i=0;i<dl&&i0+i<cn;i++){
        const x=cr()*2-1, e=1-i/dl; lp+=(x-lp)*(big?0.06:0.3);
        cd[i0+i]+=(big?lp*2:(x-lp))*v*e*e; /* gros : sourd et grave, petits : clairs */
      }
    }
    const csrc=loopSrc(cb); csrc.connect(fireG);
    const wsrc=loopSrc(nb); windBP=ctx.createBiquadFilter(); windBP.type="bandpass"; windBP.frequency.value=500; windBP.Q.value=0.8;
    wsrc.connect(windBP); windBP.connect(windG);
  }
  const windMod=G(0.3); /* gain interne du vent (automatisé) */
  if(windBP){ /* on insère windMod entre bandpass et windG */
    windBP.disconnect(); windBP.connect(windMod); windMod.connect(windG);
  }
  function clink(t){
    const f0=2600+R.a()*1200, dur=0.5, a=ctx.createOscillator(), b=ctx.createOscillator(), e=G(0);
    a.frequency.value=f0; b.frequency.value=f0*2.41;
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.035,t+0.003); e.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const gb=G(0.4); a.connect(e); b.connect(gb); gb.connect(e); route(e,(R.a()*2-1)*0.7,murG);
    a.start(t); b.start(t); a.stop(t+dur+0.1); b.stop(t+dur+0.1);
  }
  function drip(t){
    const f0=1400+R.a()*1400, x=ctx.createOscillator(); x.type="sine";
    x.frequency.setValueAtTime(f0,t); x.frequency.exponentialRampToValueAtTime(f0*0.55,t+0.09);
    const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.5,t+0.004); e.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
    x.connect(e); route(e,(R.a()*2-1)*0.6,dripG); x.start(t); x.stop(t+0.3);
  }

  /* ---------- sons à la demande : porte, cloche, tonnerre, cor, coups, verre, magie, loup ---------- */
  const EVT={
    porte(t){
      const d=2.4, o1=ctx.createOscillator(), am=G(0.6), lf=ctx.createOscillator(), lg=G(0.4), bp=ctx.createBiquadFilter(), e=envA(t,0.12,0.2,0.9,d-0.9);
      o1.type="sawtooth"; o1.frequency.setValueAtTime(92,t); o1.frequency.linearRampToValueAtTime(168,t+0.95); o1.frequency.linearRampToValueAtTime(118,t+d);
      lf.type="square"; lf.frequency.value=15; lf.connect(lg); lg.connect(am.gain);
      bp.type="bandpass"; bp.Q.value=7; bp.frequency.setValueAtTime(520,t); bp.frequency.linearRampToValueAtTime(1150,t+0.95); bp.frequency.linearRampToValueAtTime(700,t+d);
      o1.connect(am); am.connect(bp); bp.connect(e); e.connect(B.evt.in);
      [o1,lf].forEach(x=>{x.start(t); x.stop(t+d+0.1);});
    },
    cloche(t){
      const base=freq(12), toll=(tt,g)=>{
        const sum=G(g);
        [[1,1,7],[2.0,0.55,5.5],[2.76,0.45,4.5],[4.07,0.25,3],[5.4,0.2,2.2],[8.93,0.1,1.2]].forEach(([m,a,d])=>{
          const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=base*m; const e=envD(tt,a*0.22,d); x.connect(e); e.connect(sum); x.start(tt); x.stop(tt+d+0.1);
        });
        route(sum,0,B.evt.in);
      };
      toll(t,1); toll(t+2.4,0.5);
    },
    tonnerre(t){
      const s=ctx.createBufferSource(); s.buffer=nb; const f=ctx.createBiquadFilter(); f.type="lowpass"; f.Q.value=0.7;
      f.frequency.setValueAtTime(900,t); f.frequency.exponentialRampToValueAtTime(90,t+3.5);
      const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.9,t+0.04); e.gain.exponentialRampToValueAtTime(0.3,t+0.6);
      e.gain.linearRampToValueAtTime(0.65,t+1.1); e.gain.exponentialRampToValueAtTime(0.0001,t+5);
      s.connect(f); f.connect(e); e.connect(B.evt.in); s.start(t,Math.random()*3); s.stop(t+5.2);
      const x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(52,t); x.frequency.exponentialRampToValueAtTime(30,t+1.2);
      const xe=envD(t,0.5,1.4); x.connect(xe); xe.connect(B.evt.in); x.start(t); x.stop(t+1.5);
    },
    cor(t){
      [[12,0.7,0],[19,1.9,0.8]].forEach(([off,dur,dt])=>{
        const tt=t+dt, f=freq(off), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=1;
        fl.frequency.setValueAtTime(500,tt); fl.frequency.linearRampToValueAtTime(1700,tt+dur*0.4);
        const e=envA(tt,0.1,0.2,0.4,dur); fl.connect(e); e.connect(B.evt.in);
        [-6,6].forEach(dt2=>{ const x=ctx.createOscillator(); x.type="sawtooth"; x.frequency.value=f; x.detune.value=dt2; x.connect(fl); x.start(tt); x.stop(tt+dur+0.5); });
      });
    },
    coups(t){
      [0,0.22,0.4].forEach((dt,i)=>{
        const tt=t+dt, x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(170,tt); x.frequency.exponentialRampToValueAtTime(60,tt+0.1);
        const e=envD(tt,i===2?0.9:0.7,0.2); x.connect(e); e.connect(B.evt.in); x.start(tt); x.stop(tt+0.25);
        noiseHit(tt,0.3,420,0.07,"bandpass",B.evt.in);
      });
    },
    verre(t){
      [0,0.5,0.78].forEach((dt,i)=>{
        const tt=t+dt, f0=2700+Math.random()*1500, a=ctx.createOscillator(), b=ctx.createOscillator(), e=envD(tt,0.16-0.03*i,0.9), gb=G(0.4);
        a.frequency.value=f0; b.frequency.value=f0*2.41; a.connect(e); b.connect(gb); gb.connect(e); route(e,(i-1)*0.4,B.evt.in);
        a.start(tt); b.start(tt); a.stop(tt+1); b.stop(tt+1);
      });
    },
    magie(t){
      const iv=ivOf(S,secOf(t).key);
      for(let k=0;k<10;k++){
        const tt=t+k*0.11, f=freq(degOff(iv,k)+24), x=ctx.createOscillator(), y=ctx.createOscillator(), g2=G(0.3), e=envD(tt,0.11,1.7);
        x.frequency.value=f; y.frequency.value=f*2; x.connect(e); y.connect(g2); g2.connect(e); route(e,(k/9*2-1)*0.6,B.evt.in);
        [x,y].forEach(z=>{z.start(tt); z.stop(tt+1.8);});
      }
      const s=ctx.createBufferSource(); s.buffer=wb; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.Q.value=1.2;
      bp.frequency.setValueAtTime(1200,t); bp.frequency.exponentialRampToValueAtTime(6000,t+1.4);
      const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.12,t+0.7); e.gain.linearRampToValueAtTime(0,t+1.6);
      s.connect(bp); bp.connect(e); e.connect(B.evt.in); s.start(t,Math.random()); s.stop(t+1.7);
    },
    loup(t){
      const d=3.6, o1=ctx.createOscillator(), f1=freq(19), f2=freq(31), f3=freq(24);
      o1.type="sawtooth"; o1.frequency.setValueAtTime(f1,t); o1.frequency.exponentialRampToValueAtTime(f2,t+1.2); o1.frequency.setValueAtTime(f2,t+1.6); o1.frequency.exponentialRampToValueAtTime(f3,t+d);
      const vib=ctx.createOscillator(); vib.frequency.value=5.2; const vg=G(f2*0.012); vib.connect(vg); vg.connect(o1.frequency);
      const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=700; bp.Q.value=2.5;
      const e=envA(t,0.5,0.18,1.2,d-1.2); o1.connect(bp); bp.connect(e); e.connect(B.evt.in);
      const br=ctx.createBufferSource(); br.buffer=wb; const bb=ctx.createBiquadFilter(); bb.type="bandpass"; bb.frequency.value=1300; bb.Q.value=1;
      const bg=G(0.03); br.connect(bb); bb.connect(bg); bg.connect(e); br.start(t,Math.random()); br.stop(t+d+0.2);
      [o1,vib].forEach(x=>{x.start(t); x.stop(t+d+0.3);});
    }
  };
  function fire(name){
    if(!EVT[name]) return;
    const t=ctx.currentTime+0.03; EVT[name](t);
    if(o.onNote) o.onNote(t,0,"evt",0,0,name);
  }

  /* ---------- évolution ---------- */
  function inten(t){
    const sh=S.form.shape; if(sh==="constante") return 1;
    const x=(t-t0)/(S.form.period*60);
    if(sh==="arche") return 0.5-0.5*Math.cos(2*Math.PI*x);
    if(sh==="vagues") return clamp(0.5+0.28*Math.sin(2*Math.PI*x)+0.22*Math.sin(2*Math.PI*x*2.7+1),0,1);
    if(sh==="escalier"){const ph=((x%2)+2)%2, tri=ph<1?ph:2-ph; return Math.floor(tri*3.999)/3;}
    return 1;
  }

  /* ---------- mémoire (déjà-vu) ---------- */
  const memM=[], memP=[]; let nPhrase=0, nChord=0, idx=0;
  const nearest=(pool,x)=>{let bi=pool[0],bd=1e9; pool.forEach(p=>{const d=Math.abs(p-x); if(d<bd){bd=d;bi=p;}}); return bi;};
  /* boucle de L cases ; avec la probabilité p on rejoue la case, sinon on la tire de nouveau */
  function recall(mem,n,L,p,rnd,gen){
    const j=n%L;
    if(p>0&&mem[j]!==undefined&&rnd()<p) return mem[j];
    const v=gen(); mem[j]=v; return v;
  }
  function genPhrase(pool,stab,dens){
    if(lastOff.v!==null){ let bi=0,bd=1e9; pool.forEach((p,j)=>{const d=Math.abs(p-lastOff.v); if(d<bd){bd=d;bi=j;}}); idx=bi; }
    else idx=Math.floor(pool.length/3);
    const n=4+Math.floor(R.m()*(3+5*dens)), durs=dens>0.6?[1,1,1,2,2,3]:[1,1,2,2,3,4], notes=[];
    let e=0;
    for(let i=0;i<n;i++){
      let st;
      if(R.m()<S.mel.leap*0.5) st=(R.m()<0.5?-1:1)*(3+Math.floor(R.m()*3));
      else st=[-2,-1,-1,1,1,2][Math.floor(R.m()*6)];
      idx=clamp(idx+st,0,pool.length-1);
      if(i===n-1){
        for(let k=0;k<=3;k++){
          if(idx+k<pool.length&&stab.indexOf(((pool[idx+k]%12)+12)%12)>=0){idx+=k;break;}
          if(idx-k>=0&&stab.indexOf(((pool[idx-k]%12)+12)%12)>=0){idx-=k;break;}
        }
      }
      const dE=durs[Math.floor(R.m()*6)], vel=0.16+R.m()*0.1, grace=R.m()<S.mel.orn, gdir=R.m()<0.5?-1:1;
      notes.push({e,off:pool[idx],dE,vel,grace,gdir}); e+=dE;
    }
    return {notes,end:e,gr:R.m(),pool};
  }

  /* ---------- ordonnanceur ---------- */
  const cur={mel:0,drone:0,clink:0,perc:0,k:0,pad:0,int:0,fire:0,wind:0,drip:0,bird:0};
  let loopsL=[], pendK=[];
  const lastOff={v:null};
  function rec(tr,t,off,dur,vel){ if(o.record) events.push({tr,t,off,dur,vel}); }
  function canonNote(t,off,vel,len,iv){
    const n=iv.length, wide=poolOf(iv,-24,72), k=wide.indexOf(off); if(k<0) return;
    const shifts={"uni":0,"oct+":n,"oct-":-n,"q+":Math.round(n*4/7),"q-":-Math.round(n*4/7),"t+":Math.round(n*2/7)};
    const k2=clamp(k+(shifts[S.canon.shift]||0),0,wide.length-1), off2=wide[k2];
    const tt=sw(t+S.canon.delay*bar);
    (INST[S.canon.inst]||INST.harpe)(tt,freq(off2),vel*0.9,len,canonG,(R.v()*2-1)*0.5);
    rec(1,tt,off2,len,vel*0.9);
    if(o.onNote) o.onNote(tt,off2,"canon",len,vel*0.9);
  }
  function schedule(until){
    /* intensité */
    while(cur.int<until){
      const t=cur.int, I=inten(t), A=S.form.shape==="constante"?0:S.form.amount, m=1-A+A*I, ie=S.form.shape==="constante"?0.5:I;
      B.perc.it.gain.setTargetAtTime(m,t,1.2); B.pad.it.gain.setTargetAtTime(0.45+0.55*m,t,1.2);
      droneFilters.forEach(({f,base})=>f.frequency.setTargetAtTime(base*(0.7+0.6*ie),t,2));
      if(curveOn()){
        const m=tensMul((tensAt(t+1)-0.5)*2);
        B.perc.tm.gain.setTargetAtTime(m.perc,t,1.5); B.pad.tm.gain.setTargetAtTime(m.pad,t,1.5);
        B.drone.tm.gain.setTargetAtTime(m.drone,t,1.5); B.amb.tm.gain.setTargetAtTime(m.amb,t,1.5);
      }
      cur.int=t+2;
    }
    /* percussion */
    while(cur.perc<until){
      const k=cur.k%barE, sym=PAT[k], odd=(cur.k%2)===1;
      const t=cur.perc+(odd?S.swing*E*0.5:0)+R.p()*0.006;
      if(want("perc")&&S.perc.lvl>0.001){
        if(sym==="S"){ stomp(t,0.95); if(o.onNote) o.onNote(t,0,"stomp",0,0.95); } else if(sym==="s"){ stomp(t,0.6); if(o.onNote) o.onNote(t,0,"stomp",0,0.6); }
        else if(sym==="T"){ const v=0.5+R.p()*0.15; tap(t,v); if(o.onNote) o.onNote(t,0,"tap",0,v); } else if(sym==="t"){ const v=0.4+R.p()*0.1; tap(t,v); if(o.onNote) o.onNote(t,0,"tap",0,v); }
        else{
          if(R.p()<S.perc.shaker){ const v=0.1+R.p()*0.08; shaker(t,v); if(o.onNote) o.onNote(t,0,"shk",0,v); }
          if(k===barE-3&&R.p()<S.perc.ghost) tap(t,0.2);
        }
      } else { R.p(); }
      cur.perc+=E; cur.k++;
    }
    /* mélodie et canon : chaque phrase est mémorisée, le déjà-vu décide de la rejouer */
    while(cur.mel<until){
      const sc=secOf(cur.mel), iv=ivOf(S,sc.key), stab=stableOf(iv), I=inten(cur.mel);
      const evo=S.form.shape==="constante"?0:(I-0.5)*S.form.amount;
      const dens=clamp(S.mel.dens+evo+(tensAt(cur.mel)-0.5)*0.6,0,1);
      const lo=12+12*S.mel.reg, hi=lo+12*S.mel.span, pool=poolOf(iv,lo,hi);
      if(!pool.length){cur.mel+=bar; continue;}
      const gen=()=>genPhrase(pool,stab,dens);
      let ph=recall(memM,nPhrase++,Math.max(1,Math.round(S.mel.loop)),S.mel.deja,R.m,gen);
      if(ph.pool!==pool){ /* rejouée : recaler sur la gamme de la section */
        ph={notes:ph.notes.map(n=>({...n,off:nearest(pool,n.off)})),end:ph.end,gr:ph.gr};
      }
      let t=cur.mel;
      ph.notes.forEach(nt=>{
        const off=nt.off, tt=sw(cur.mel+nt.e*E), vel=nt.vel, len=E*nt.dE*0.92;
        if(want("mel")&&S.mel.lvl>0.001){
          const fn=INST[S.mel.inst]||INST.luth;
          if(nt.grace&&pool.length>2&&(S.mel.inst==="luth"||S.mel.inst==="harpe"||S.mel.inst==="carillon"||S.mel.inst==="oud"||S.mel.inst==="kalimba")){
            const gi=clamp(pool.indexOf(off)+nt.gdir,0,pool.length-1); fn(tt-0.07,freq(pool[gi]),vel*0.55,0.08,B.mel.in,0);
          }
          fn(tt,freq(off),vel,len,B.mel.in,(R.v()*2-1)*0.35);
          if(S.canon.lvl>0.001) canonNote(cur.mel+nt.e*E,off,vel,len,iv);
        }
        rec(0,tt,off,len,vel);
        if(o.onNote) o.onNote(tt,off,"mel",len,vel);
        lastOff.v=off;
      });
      t=cur.mel+ph.end*E;
      const bars=Math.ceil((t-t0)/bar-1e-6);
      cur.mel=t0+bar*(bars+Math.round(ph.gr*2*(1.6-1.5*dens)));
    }
    /* nappes */
    while(cur.pad<until){
      const t=cur.pad, sc=secOf(t), iv=ivOf(S,sc.key), n=iv.length;
      const d=recall(memP,nChord++,Math.max(1,Math.round(S.pad.loop)),S.pad.deja,R.s,()=>(R.s()<0.35+0.4*(1-S.pad.motion))?0:Math.floor(R.s()*n))%n;
      const len=S.pad.len*bar, vc=clamp(Math.round(S.pad.voices),2,o.lite?3:4);
      if(want("pad")&&S.pad.lvl>0.001){
        const offs=[degOff(iv,d),degOff(iv,d+2),degOff(iv,d+4),degOff(iv,d+6)].slice(0,vc).map(x=>x+12);
        offs.forEach(off=>{padVoice(t,len,freq(off),S.pad.timbre); rec(2,t,off,len,0.3); if(o.onNote) o.onNote(t,off,"pad",len,0.3);});
      }
      cur.pad=t+len;
    }
    /* bourdon : la quinte glisse vers un degré voisin */
    while(cur.drone<until){
      const t=cur.drone, iv=ivOf(S,secOf(t).key), cands=[5,10,3,2,8,1].filter(x=>iv.indexOf(x)>=0);
      const pick=cands.length?cands[Math.floor(R.d()*Math.min(cands.length,3))]:null, hold=12+R.d()*14;
      if(pick!==null&&S.drone.glide>0.02&&fifthGl.length){
        const f0=freq(7), f1=freq(pick);
        fifthGl.forEach(({p,m})=>{p.setValueAtTime(f0*m,t); p.exponentialRampToValueAtTime(f1*m,t+4); p.setValueAtTime(f1*m,t+4+hold); p.exponentialRampToValueAtTime(f0*m,t+8+hold);});
      }
      cur.drone=t+8+hold+(30+R.d()*50)*(1.8-1.6*S.drone.glide);
    }
    /* boucles de bande à longueurs incommensurables (Eno) */
    if(S.loops.lvl>0.001&&want("loops")){
      const fn=INST[S.loops.inst]||INST.carillon;
      loopsL.forEach(lp=>{
        while(lp.next<until){
          const tt=lp.next, iv=ivOf(S,secOf(tt).key), off=degOff(iv,lp.deg)+12*lp.oct, vel=lp.vel*(0.85+0.3*R.l());
          fn(tt,freq(off),vel,E*10,B.loops.in,lp.pan);
          rec(3,tt,off,E*10,vel);
          if(o.onNote) o.onNote(tt,off,"loop",E*10,vel);
          lp.next+=lp.len;
        }
      });
    } else loopsL.forEach(lp=>{ while(lp.next<until) lp.next+=lp.len; });
    /* pendules : un coup quand chaque pendule repasse par le bas, tous alignés à chaque période */
    {
      const N=pendN(), T=S.pend.period*bar, fn=INST[S.pend.inst]||INST.carillon, on=S.pend.lvl>0.001&&want("pend");
      for(let i=0;i<N;i++){
        const c=PEND_N0+i;
        while(true){
          const tt=t0+T*(0.25+pendK[i])/c; if(tt>=until) break;
          pendK[i]++;
          if(!on) continue;
          const iv=ivOf(S,secOf(tt).key), off=degOff(iv,i)+12, vel=0.17-0.07*i/N;
          fn(tt,freq(off),vel,E*6,B.pend.in,(i/Math.max(1,N-1)*2-1)*0.6);
          rec(4,tt,off,E*6,vel);
          if(o.onNote) o.onNote(tt,off,"pend",E*6,vel);
        }
      }
    }
    /* lieu */
    if(want("amb")){
      bands.forEach(b=>{
        while(b.cur<until){
          const v=Math.pow(R.a(),2)*0.5*b.lvl; b.g.gain.setTargetAtTime(v,b.cur,0.35); b.cur+=0.5+R.a()*1.8;
        }
      });
      while(cur.clink<until){ clink(cur.clink); cur.clink+=(18+R.a()*30)/(0.25+S.amb.clink*1.5); }
      cur.fire=until; /* les craquements viennent de la boucle précalculée */
      while(cur.bird<until){ const t=cur.bird, ov=(S.nature||{}).oiseaux||0; if(ov>0.001) bird(t); cur.bird=t+(7+R.t()*14)/(0.25+ov*1.75); }
      while(cur.wind<until){
        const t=cur.wind;
        if(windBP){ windBP.frequency.setTargetAtTime(250+R.a()*700,t,2.5); windMod.gain.setTargetAtTime(0.2+R.a()*0.8,t,2.5); }
        cur.wind=t+5+R.a()*5;
      }
      while(cur.drip<until){
        const t=cur.drip; if(S.amb.gouttes>0.001) drip(t);
        cur.drip=t+(2+R.a()*7)/(0.4+S.amb.gouttes*1.2);
      }
    }
  }

  function start(t,fadeIn,fadeOutAt){
    t0=t;
    starts.forEach(s=>s.start(t));
    master.gain.setValueAtTime(0,t); master.gain.linearRampToValueAtTime(1,t+fadeIn);
    if(fadeOutAt){ master.gain.setValueAtTime(1,t+fadeOutAt-7); master.gain.linearRampToValueAtTime(0,t+fadeOutAt-0.2); }
    cur.perc=t+bar*Math.ceil(4/bar); cur.k=0; cur.mel=t+bar*Math.ceil(7/bar); cur.pad=t; cur.int=t;
    cur.drone=t+25+R.d()*20; cur.clink=t+10; cur.fire=t; cur.wind=t; cur.drip=t+4; cur.bird=t+3; started=true;
    bands.forEach(b=>b.cur=t);
    const nl=clamp(Math.round(S.loops.count),1,5), lens=[29,31,37,41,43,47,53,59].slice();
    loopsL=[];
    for(let i=0;i<nl;i++){
      const L=lens.splice(Math.floor(R.l()*lens.length),1)[0]*E*S.loops.speed, deg=[0,4,2,1,3][i];
      loopsL.push({len:L, next:t+(0.15+0.85*R.l())*L, deg, oct:i===0?1:1+Math.floor(R.l()*2), pan:(R.l()*2-1)*0.7, vel:0.13+R.l()*0.04});
    }
    pendK=Array.from({length:pendN()},()=>0);
  }
  function stop(now,tc){ master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0,now,tc||0.4); }
  /* fondu enchaîné : l'ancien moteur s'éteint sur d secondes puis libère ses oscillateurs */
  function fadeOut(now,d){
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value,now); master.gain.linearRampToValueAtTime(0,now+d);
    starts.forEach(x=>{try{x.stop(now+d+0.2);}catch(e){}});
  }
  const pendX=t=>Array.from({length:pendN()},(_,i)=>Math.cos(2*Math.PI*(PEND_N0+i)*(t-t0)/(S.pend.period*bar)));
  return {start,schedule,setLevels,setReverb,stop,fadeOut,sleepFade,sleepClear,pendX,fire,tensNow:()=>tensAt(ctx.currentTime),tensPos:()=>{ if(!curveOn()) return -1; const L=Math.max(30,S.curve.dur*60), x=(ctx.currentTime-t0)/L; return S.curve.mode==='loop'?((x%1)+1)%1:clamp(x,0,1); },events,out,master,secAt:t=>secOf(t),bar,E,t0f:()=>t0};
}
