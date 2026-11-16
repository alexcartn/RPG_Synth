"use strict";
/* ============================================================
   MOTEUR AUDIO
   ============================================================ */
function buildEngine(ctx, S, o){
  o = o||{};
  const seed=S.seed>>>0, sr=ctx.sampleRate;
  const R={m:mulberry32(seed), d:mulberry32(seed^0xA1B2C3), p:mulberry32(seed^0x51ED27), a:mulberry32(seed^0x7F4A7C),
           s:mulberry32(seed^0x3C6EF3), v:mulberry32(seed^0x2545F4), n:mulberry32(seed^0x85ebca6b), w:mulberry32(seed^0x1234567), l:mulberry32(seed^0x1F2E3D4B), t:mulberry32(seed^0x6D2B79F5), h:mulberry32(seed^0x3B9ACA07)};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const G=v=>{const g=ctx.createGain(); g.gain.value=v; return g;};
  const PAN=v=>{ if(ctx.createStereoPanner){const p=ctx.createStereoPanner(); p.pan.value=v; return p;} return G(1); };
  const freq=mkFreq(S);
  const physOn=()=>!(S.mus&&S.mus.model==="classique");
  const PEND_N0=3, pendN=()=>clamp(Math.round(S.pend.count),3,10);
  const mach=()=>S.mach!==false;
  const tens=()=>S.tension===undefined?0.5:S.tension;
  /* adaptation : l'énergie suit l'heure de la journée, ou s'apaise avec la durée d'écoute */
  const clock0=o.clock!==undefined?o.clock:Date.now();
  const adaptOn=()=>!!(S.adapt&&S.adapt.mode&&S.adapt.mode!=="off"&&S.adapt.amount>0.01);
  /* météo : se superpose à l'heure (pluie, nuit claire, oiseaux, vent, énergie) quand l'adaptation est « heure et météo » */
  const wxOn=()=>!!(S.adapt&&S.adapt.mode==="meteo"&&S.wx&&S.wx.d&&S.adapt.amount>0.01);
  const wxE=w=>clamp(0.6-0.25*w.clouds-0.2*w.rain-0.15*w.fog-0.15*w.snow+0.3*w.storm-(w.night?0.12:0),0.05,0.95);
  function natv(){
    const nt=S.nature||{}; if(!wxOn()) return nt;
    const w=S.wx.d, k=S.adapt.amount, o=Object.assign({},nt), clear=w.clouds<0.6&&w.rain<0.1;
    o.pluie=Math.max(nt.pluie||0,w.rain*0.85*k);
    if(w.night&&clear) o.nuit=Math.max(nt.nuit||0,0.5*k);
    if(!w.night&&clear&&!w.snow) o.oiseaux=Math.max(nt.oiseaux||0,0.3*k);
    return o;
  }
  const ventv=()=>Math.max(S.amb.vent,wxOn()?S.wx.d.wind*0.8*S.adapt.amount:0);
  function adaptE(t){
    if(!adaptOn()) return 0.5;
    if(S.adapt.mode==="heure"||S.adapt.mode==="meteo"){ const d=new Date(clock0+(t-t0)*1000), h=d.getHours()+d.getMinutes()/60, he=0.1+0.8*Math.pow(0.5+0.5*Math.cos(2*Math.PI*(h-14)/24),1.4); return (S.adapt.mode==="meteo"&&S.wx&&S.wx.d)?clamp(0.5*he+0.5*wxE(S.wx.d),0,1):he; }
    const x=clamp((t-t0)/(Math.max(5,S.adapt.span)*60),0,1); return 0.65-0.55*x*x*(3-2*x);
  }
  const curveOn=()=>!!(S.curve&&S.curve.mode&&S.curve.mode!=="off"&&S.curve.pts&&S.curve.pts.length>1);
  /* tension au temps t : la courbe dessinée (répétée ou jouée une fois) ou le curseur */
  const dynTens=()=>curveOn()||adaptOn();
  function tensAt(t){
    let v=tens();
    if(curveOn()){
      const p=S.curve.pts, L=Math.max(30,S.curve.dur*60), x=(t-t0)/L, f=S.curve.mode==="loop"?((x%1)+1)%1:clamp(x,0,1), i=f*(p.length-1), a=Math.floor(i), b=Math.min(p.length-1,a+1);
      v=p[a]+(p[b]-p[a])*(i-a);
    }
    if(adaptOn()) v+=S.adapt.amount*(adaptE(t)-0.5)*0.9;
    return clamp(v,0,1);
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
  /* couleur de mode : la tension et la météo font glisser la gamme du plus clair (lydien) au plus sombre (locrien), section par section */
  const LADDER=["lydien","ionien","mixolydien","dorien","eolien","phrygien","locrien"], COL={};
  function wxDark(w){ return w.storm?0.95:w.snow?0.4:w.fog?0.6:w.rain>0.5?0.72:w.rain>0.1?0.6:w.night?(w.clouds<0.6?0.45:0.55):w.clouds>0.7?0.5:0.15; }
  function colorKey(i){
    const c=S.mus&&S.mus.color; if(!c||c==="off") return null;
    if(COL[i]!==undefined) return COL[i];
    const parts=[], ts=t0+i*S.sectionBars*bar;
    if(c==="tension"||c==="les deux") parts.push(tensAt(ts));
    if((c==="meteo"||c==="les deux")&&S.wx&&S.wx.d) parts.push(wxDark(S.wx.d));
    if(!parts.length) return null;
    const v=parts.reduce((a,b)=>a+b,0)/parts.length; return COL[i]=LADDER[clamp(Math.round(v*6),0,6)];
  }
  function secOf(t){
    const l=S.scales.filter(Boolean); if(!l.length) l.push("mixolydien");
    const i=Math.max(0,Math.floor((t-t0)/(S.sectionBars*bar)+1e-6));
    return {i, key:colorKey(i)||l[i%l.length]};
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
  /* acoustiques : prédélai, premières réflexions, vitesse de décroissance et brillance de la queue selon le lieu */
  const ROOMS={gen:{pre:0,n:0,t0:0,t1:0,amp:0,dec:1,br:1}, chapelle:{pre:0.015,n:10,t0:0.02,t1:0.12,amp:0.5,dec:0.85,br:0.6}, salle:{pre:0.008,n:14,t0:0.008,t1:0.07,amp:0.6,dec:1.5,br:1.1}, grotte:{pre:0.02,n:8,t0:0.04,t1:0.3,amp:0.8,dec:0.8,br:0.5}, plaque:{pre:0,n:0,t0:0,t1:0,amp:0,dec:1.1,br:1.4}};
  function makeIR(size,dark){
    const rm=ROOMS[S.fx.room]||ROOMS.gen, sz=clamp(size,0.4,o.lite?5:9), len=Math.floor(sr*sz), ir=ctx.createBuffer(2,len,sr), rr=mulberry32((seed^0x9e3779b9)>>>0), dec=6.9/sz*rm.dec, pre=Math.floor(sr*rm.pre);
    for(let c=0;c<2;c++){
      const d=ir.getChannelData(c); let lp=0, e=0;
      for(let i=0;i<len;i++){
        const t=i/sr, n=rr()*2-1, k=Math.min(0.95,(0.6-0.54*dark)*rm.br)*(0.25+0.75*Math.exp(-t*0.7));
        lp+=(n-lp)*k; const v=i<pre?0:lp*Math.exp(-(t-rm.pre)*dec)*((i-pre)<sr*0.02?(i-pre)/(sr*0.02):1); d[i]=v; e+=v*v;
      }
      /* premières réflexions : quelques échos nets, différents à gauche et à droite */
      for(let q=0;q<rm.n;q++){
        const tq=rm.t0+(rm.t1-rm.t0)*Math.pow(rr(),1.3), iq=Math.floor(tq*sr), a=rm.amp*Math.exp(-tq*3)*(0.6+0.4*rr())*Math.sqrt(e/len)*14*(rr()<0.5?-1:1);
        for(let j=0;j<4&&iq+j<len;j++) d[iq+j]+=a*(1-j/4);
      }
      let e2=0; for(let i=0;i<len;i++) e2+=d[i]*d[i];
      const nrm=1/Math.sqrt(e2||1); for(let i=0;i<len;i++) d[i]*=nrm;
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
    const lvl=G(1), tm=G(1), gs=G(1), it=G(1); lvl.connect(tm); tm.connect(gs); gs.connect(it); it.connect(out);
    const rs=G(rev); it.connect(rs); rs.connect(revIn);
    if(dly){const ds=G(dly); it.connect(ds); ds.connect(dIn);}
    return {in:lvl, lvl, tm, gs, it};
  }
  const B={drone:bus(0.45,0.1), mel:bus(0.9,1), pad:bus(0.8,0.6), perc:bus(0.2,0), amb:bus(0.3,0), loops:bus(0.9,0.8), pend:bus(0.9,0.7), play:bus(0.85,0.9), daw:bus(0.7,0.6)};
  const canonG=G(0); const lCanon=link(canonG,B.mel.it);
  /* chaque voix planifiée passe par un gain "de génération" : replan() le coupe et en crée un neuf, ce qui rend les réglages immédiats */
  const V={}, DT={};

  /* ---------- rack d'effets du synthé perso : égaliseur, compresseur, chorus, écho, salle ----------
     il sert le clavier de l'atelier et les pistes du DAW réglées sur le synthé perso */
  let rackRev=null;
  function ensureRackRev(){ if(rackRev||!ctx.createConvolver) return rackRev; const c=ctx.createConvolver(), og=G(1); c.buffer=makeIR(2.6,0.45); c.connect(og); og.connect(out); rackRev={in:c}; return rackRev; }
  function makeRack(target){
    const inn=G(1), lo=ctx.createBiquadFilter(), mid=ctx.createBiquadFilter(), hi=ctx.createBiquadFilter(), comp=ctx.createDynamicsCompressor(), post=G(1);
    lo.type="lowshelf"; lo.frequency.value=220; mid.type="peaking"; mid.frequency.value=1400; mid.Q.value=0.8; hi.type="highshelf"; hi.frequency.value=5200;
    inn.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(comp); comp.connect(post); post.connect(target);
    const chS=G(1), chMix=G(0), d1=ctx.createDelay(0.05), d2=ctx.createDelay(0.05), lfo=ctx.createOscillator(), lg1=G(0), lg2=G(0), p1=PAN(-0.7), p2=PAN(0.7);
    d1.delayTime.value=0.017; d2.delayTime.value=0.025; lfo.frequency.value=0.6; lfo.connect(lg1); lfo.connect(lg2); lg1.connect(d1.delayTime); lg2.connect(d2.delayTime); starts.push(lfo);
    chS.connect(d1); chS.connect(d2); d1.connect(p1); d2.connect(p2); p1.connect(chMix); p2.connect(chMix); chMix.connect(post);
    const dl=ctx.createDelay(1.6), fb=G(0.4), dMix=G(0); dl.connect(fb); fb.connect(dl); dl.connect(dMix); dMix.connect(post);
    const rv=G(0); hi.connect(rv); let rvOn=false;
    const lCh=link(hi,chS), lDl=link(hi,dl);
    function update(R){
      lo.gain.value=R.eq.lo; mid.gain.value=R.eq.mid; hi.gain.value=R.eq.hi;
      const ca=R.comp.amt; comp.threshold.value=-4-32*ca; comp.ratio.value=1+9*ca; comp.knee.value=14; comp.attack.value=0.006; comp.release.value=0.22; post.gain.value=1+0.9*ca;
      const cm=R.chorus.mix; setLink(lCh,cm>0.01); chMix.gain.value=cm*0.9; lfo.frequency.value=R.chorus.rate; lg1.gain.value=0.0035*R.chorus.depth*2; lg2.gain.value=0.0042*R.chorus.depth*2;
      setLink(lDl,R.delay.mix>0.01); dl.delayTime.value=Math.max(0.02,Math.min(1.5,R.delay.time)); fb.gain.value=Math.min(0.9,R.delay.fb); dMix.gain.value=R.delay.mix;
      if(R.rev.mix>0.01&&!rvOn&&ensureRackRev()){ rv.connect(rackRev.in); rvOn=true; } rv.gain.value=R.rev.mix*0.9;
    }
    return {in:inn,update};
  }
  const rackPlay=makeRack(B.play.lvl), rackDaw=makeRack(B.daw.lvl);
  function rackSync(){ const R=(S.syn&&S.syn.rack)||SYN_DEFAULT.rack; rackPlay.update(R); rackDaw.update(R); }
  /* oscilloscope et spectre : le synthé seul (clavier et pistes) ou tout le mélange */
  const anaAll=ctx.createAnalyser(), anaSyn=ctx.createAnalyser(); anaAll.fftSize=anaSyn.fftSize=2048; anaAll.smoothingTimeConstant=anaSyn.smoothingTimeConstant=0.82;
  master.connect(anaAll); B.play.it.connect(anaSyn); B.daw.it.connect(anaSyn);
  /* vumètres : une voix de la machine ("drone", "mel"…) ou une piste ("t1"…), analyseur créé à la première demande */
  const MTR={};
  function meter(key){
    let m=MTR[key];
    if(!m){ const st=key[0]==="t"?DT[parseInt(key.slice(1),10)]:null, src=st?st.pan:(B[key]&&B[key].it); if(!src) return 0; const an=ctx.createAnalyser(); an.fftSize=256; src.connect(an); m=MTR[key]={an,buf:new Float32Array(256)}; }
    m.an.getFloatTimeDomainData(m.buf); let pk=0; for(let i=0;i<m.buf.length;i++){ const a=Math.abs(m.buf[i]); if(a>pk) pk=a; } return pk;
  }
  const newGen=name=>{ const v=V[name], g=G(1); g.connect(v.dst); v.node=g; };
  [["mel",B.mel.in],["canon",canonG],["pad",B.pad.in],["loops",B.loops.in],["pend",B.pend.in]].forEach(([n,d])=>{ V[n]={dst:d,node:null}; newGen(n); });
  const murG=G(0), fireG=G(0), windG=G(0), dripG=G(0);
  const lMur=link(murG,B.amb.in), lFire=link(fireG,B.amb.in), lWind=link(windG,B.amb.in); dripG.connect(B.amb.in);
  /* sons de nature : chaque lit n'est construit que s'il est utilisé, et débranché quand il retombe à zéro */
  const NATS=["pluie","mer","nuit","ruisseau"], natG={}, natL={}, natB={}, birdG=G(0), lBird=link(birdG,B.amb.in);
  NATS.forEach(k=>{ natG[k]=G(0); natL[k]=link(natG[k],B.amb.in); });

  /* mixeur : une seule notion de solo pour les voix de la machine et les pistes */
  const DAW=()=>S.daw||{tracks:[],mix:{mute:{},solo:{}}};
  const anySolo=()=>{ const D=DAW(); return Object.keys(D.mix.solo).some(k=>D.mix.solo[k])||D.tracks.some(t=>t.solo); };
  const mixOn=n=>{ const D=DAW(); if(D.mix.mute[n]) return false; return !anySolo()||!!D.mix.solo[n]; };
  const trkOn=t=>!t.mute&&(!anySolo()||!!t.solo);
  function setLevels(){
    const lv=(n,v)=>(want(n)&&mach()&&mixOn(n))?v:0;
    B.drone.lvl.gain.value=lv("drone",S.drone.lvl);
    B.mel.lvl.gain.value=lv("mel",S.mel.lvl);
    canonG.gain.value=lv("mel",S.canon.lvl);
    B.pad.lvl.gain.value=lv("pad",S.pad.lvl);
    B.perc.lvl.gain.value=lv("perc",S.perc.lvl);
    B.amb.lvl.gain.value=lv("amb",1);
    B.play.lvl.gain.value=S.play?S.play.lvl:0.8;
    volG.gain.value=S.vol===undefined?1:S.vol;
    { const nt=natv(), wa=want("amb");
      NATS.forEach(k=>{ if(wa&&mach()&&(nt[k]||0)>0.001) ensureNature(k); });
      natG.pluie.gain.value=1; natG.mer.gain.value=(nt.mer||0)*1.0; natG.nuit.gain.value=(nt.nuit||0)*2.4; natG.ruisseau.gain.value=(nt.ruisseau||0)*1.6;
      if(natB.pluie){ const r=nt.pluie||0; natB.pluie.bg.gain.value=0.22*Math.pow(r,0.7); natB.pluie.ag.gain.value=0.28*r; natB.pluie.bg2.gain.value=0.5*r*r; }
      birdG.gain.value=(nt.oiseaux||0)*0.9; }
    if(!dynTens()){ /* curseur : valeur fixe ; courbe ou adaptation : le planificateur automatise ces gains */
      const m=tensMul((tens()-0.5)*2), now=ctx.currentTime||0;
      [["perc",m.perc],["pad",m.pad],["drone",m.drone],["amb",m.amb]].forEach(([n,v])=>{ const g=B[n].tm.gain; if(g.cancelScheduledValues) g.cancelScheduledValues(now); g.value=v; });
    }
    B.loops.lvl.gain.value=lv("loops",S.loops.lvl);
    B.pend.lvl.gain.value=lv("pend",S.pend.lvl);
    murG.gain.value=S.amb.murmur; fireG.gain.value=S.amb.feu*1.2; windG.gain.value=ventv()*0.9; dripG.gain.value=S.amb.gouttes*0.8;
    wet.gain.value=S.fx.rev*2;
    dOut.gain.value=S.fx.dly; dfb.gain.value=Math.min(0.9,S.fx.fb);
    dl.delayTime.value=E*S.fx.dlyDiv; dr.delayTime.value=E*S.fx.dlyDiv*1.0;
    sat.curve=satCurve(S.fx.sat);
    dawSync(); rackSync();
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
    { const nt=natv(), wa=want("amb")&&mach(); NATS.forEach(k=>setLink(natL[k],wa&&(nt[k]||0)>0.001)); setLink(lBird,wa&&(nt.oiseaux||0)>0.001); }
    setLink(lMur,mach()&&S.amb.murmur>0.001); setLink(lFire,mach()&&S.amb.feu>0.001); setLink(lWind,mach()&&ventv()>0.001);
    droneLinks.forEach(l=>setLink(l,mach()&&S.drone.lvl>0.001));
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
      /* troisième formant : la voix chantée en a un vers 2,6 kHz qui lui donne son brillant */
      let bpC=null; if(physOn()){ bpC=ctx.createBiquadFilter(); bpC.type="bandpass"; bpC.frequency.value=2650; bpC.Q.value=9; const gC=G(0.28); bpC.connect(gC); gC.connect(g); }
      [-w,w].forEach(dt=>{
        const os=ctx.createOscillator(); os.type="sawtooth"; os.frequency.value=fr0; os.detune.value=dt;
        os.connect(bpA); os.connect(bpB); os.connect(gD); if(bpC) os.connect(bpC); oscs.push(os); srcs.push(os); gls.push({p:os.frequency,m:1});
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
    cuivre(t,f,vel,len,dst,pan){
      const L=Math.max(0.25,len), fl=ctx.createBiquadFilter(), bell=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=1.2; bell.type="peaking"; bell.frequency.value=Math.min(2400,f*4); bell.gain.value=5; bell.Q.value=1.5;
      fl.frequency.setValueAtTime(Math.min(900,f*1.6),t); fl.frequency.linearRampToValueAtTime(Math.min(5200,f*7+vel*4000),t+0.16); fl.frequency.setTargetAtTime(Math.min(2400,f*3.5),t+0.2,0.35);
      const e=envA(t,0.07,vel*0.9,0.18,L); fl.connect(bell); bell.connect(e); route(e,pan,dst);
      const vib=ctx.createOscillator(); vib.frequency.value=5.3; const vg=G(0); vib.connect(vg); vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(7,t+Math.min(1.2,L*0.6));
      [-4,4].forEach(d=>{ const x=ctx.createOscillator(); x.type="sawtooth"; x.frequency.setValueAtTime(f*0.97,t); x.frequency.exponentialRampToValueAtTime(f,t+0.06); x.detune.value=d; vg.connect(x.detune); x.connect(fl); x.start(t); x.stop(t+L+0.4); });
      const br=ctx.createBufferSource(); br.buffer=wb; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=Math.min(6000,f*5); bp.Q.value=1.2; const bg=G(vel*0.05); br.connect(bp); bp.connect(bg); bg.connect(fl); br.start(t,R.v()*1.4); br.stop(t+L+0.3);
      vib.start(t); vib.stop(t+L+0.4);
    },
    archet(t,f,vel,len,dst,pan){
      const L=Math.max(0.3,len), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.8; fl.frequency.setValueAtTime(Math.min(1500,f*3),t); fl.frequency.linearRampToValueAtTime(Math.min(3800,f*6+1200),t+0.25);
      const e=envA(t,0.18,vel*0.8,0.3,L); fl.connect(e); route(e,pan,dst);
      const vib=ctx.createOscillator(); vib.frequency.value=5.2; const vg=G(0); vib.connect(vg); vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(9,t+Math.min(1.5,L*0.7));
      [-7,0,7].forEach(d=>{ const x=ctx.createOscillator(); x.type="sawtooth"; x.frequency.value=f; x.detune.value=d; vg.connect(x.detune); x.connect(fl); x.start(t); x.stop(t+L+0.5); });
      vib.start(t); vib.stop(t+L+0.5);
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

  /* ---------- modèle physique : corde pincée (Karplus-Strong avec accord fin) ---------- */
  const pluckCache=new Map();
  function pluckBuf(f,vel,spec){
    const key=Math.round(f*20)+"|"+Math.round(vel*12)+"|"+spec.id;
    const hit=pluckCache.get(key); if(hit){ pluckCache.delete(key); pluckCache.set(key,hit); return hit; }
    const dur=Math.min(4.6,spec.t60*1.1), n=Math.floor(sr*dur), P=sr/f, Ld=P-0.5, L=Math.max(2,Math.floor(Ld)), F=Ld-L, c=(1-F)/(1+F);
    const line=new Float32Array(L), rnd=mulberry32((Math.floor(f*100)*2654435761)>>>0), out=new Float32Array(n);
    /* excitation : bruit adouci (plus vif quand la note est forte), avec un peigne qui place le point de pincement */
    let lp=0; const kx=clamp(0.25+0.65*vel*4*spec.bright,0.15,0.95);
    for(let i=0;i<L;i++){ const x=rnd()*2-1; lp+=(x-lp)*kx; line[i]=lp; }
    const m=Math.max(1,Math.round(spec.pos*L)), tmp=Float32Array.from(line); for(let i=0;i<L;i++) line[i]=tmp[i]-tmp[(i-m+L)%L];
    const g=Math.pow(10,-3/(Math.max(0.2,spec.t60)*f)), a=clamp(0.5-0.18*spec.bright,0.3,0.5);
    let p=0, prev=0, x1=0, y1=0, pk=0;
    for(let i=0;i<n;i++){
      const y0=line[p], lpv=y0*(1-a)+prev*a; prev=y0;
      const ap=c*lpv+x1-c*y1; x1=lpv; y1=ap;
      line[p]=ap*g; out[i]=y0; p++; if(p>=L) p=0;
      const av=y0<0?-y0:y0; if(av>pk) pk=av;
    }
    const nf=Math.floor(sr*0.05), sc=0.9/(pk||1); for(let i=0;i<n;i++){ let v=out[i]*sc; if(i>n-nf) v*=(n-i)/nf; out[i]=v; }
    const buf=ctx.createBuffer(1,n,sr); buf.getChannelData(0).set(out);
    const rec2={buf,dur}; pluckCache.set(key,rec2); if(pluckCache.size>56) pluckCache.delete(pluckCache.keys().next().value);
    return rec2;
  }
  function pluck(t,f,vel,dst,pan,spec,gain){
    const pb=pluckBuf(f,vel,spec), x=ctx.createBufferSource(); x.buffer=pb.buf;
    const e=G(vel*gain); x.connect(e); route(e,pan,dst); x.start(t); x.stop(t+pb.dur+0.05);
  }
  const PHYS={
    luth(t,f,vel,len,dst,pan){ pluck(t,f,vel,dst,pan,{id:"l",t60:2.6,bright:0.55,pos:0.18},4.2); },
    harpe(t,f,vel,len,dst,pan){ pluck(t,f,vel*1.05,dst,pan,{id:"h",t60:4.2,bright:0.72,pos:0.25},3.6); },
    oud(t,f,vel,len,dst,pan){ pluck(t,f,vel*0.62,dst,pan,{id:"o1",t60:3,bright:0.6,pos:0.12},6.2); pluck(t,f*1.0023,vel*0.55,dst,pan,{id:"o2",t60:3,bright:0.6,pos:0.12},6.2); noiseHit(t,vel*0.12,2600,0.03,"bandpass",dst); }
  };
  const wgCache=new Map();
  function wgBuf(kind,f,vel,dur,o2){
    dur=Math.min(4.2,Math.max(0.3,Math.round(dur*10)/10));
    const key=kind+"|"+Math.round(f*10)+"|"+dur+"|"+Math.round(vel*12), hit=wgCache.get(key);
    if(hit){ wgCache.delete(key); wgCache.set(key,hit); return hit; }
    const x=kind==="b"?physBowed(sr,f,vel,dur,o2):physFlute(sr,f,vel,dur,o2), buf=ctx.createBuffer(1,x.length,sr); buf.getChannelData(0).set(x);
    const rec2={buf,dur}; wgCache.set(key,rec2); if(wgCache.size>40) wgCache.delete(wgCache.keys().next().value); return rec2;
  }
  function wgPlay(kind,t,f,vel,len,dst,pan,o2,gain,scoop){
    const w=wgBuf(kind,f,vel,len+0.2,o2), x=ctx.createBufferSource(); x.buffer=w.buf;
    if(scoop){ x.playbackRate.setValueAtTime(0.965,t); x.playbackRate.exponentialRampToValueAtTime(1,t+0.14); }
    const e=G(vel*gain); x.connect(e); route(e,pan,dst); x.start(t); x.stop(t+w.dur+0.05);
  }
  PHYS.flute=(t,f,vel,len,dst,pan)=>wgPlay("f",t,f,vel,Math.max(0.2,len),dst,pan,{noise:0.12},1.2,false);
  PHYS.ney=(t,f,vel,len,dst,pan)=>wgPlay("f",t,f,vel,Math.max(0.25,len),dst,pan,{noise:0.24,att:0.12,pressure:0.97},1.15,true);
  PHYS.archet=(t,f,vel,len,dst,pan)=>{ if(f>800) return INST.archet(t,f,vel,len,dst,pan); wgPlay("b",t,f,vel,Math.max(0.3,len),dst,pan,{},1.8,false); };
  const instOf=(name,fb)=>(physOn()&&PHYS[name])||INST[name]||INST[fb||"luth"];

  /* ---------- synthé perso : l'Atelier comme instrument ---------- */
  INST.atelier=(t,f,vel,len,dst,pan)=>{ synthVoice(ctx,S.syn,{t,f,vel,dur:Math.max(0.06,len),dst,pan,lite:o.lite,noise:wb}); };
  /* note tenue au clavier : on garde la poignée et on relâche plus tard */
  function synOn(off,vel,op){
    const t=ctx.currentTime+0.004, v=synthVoice(ctx,S.syn,{t,f:freq(off),vel:vel||0.7,dur:null,dst:rackPlay.in,pan:0,lite:o.lite,noise:wb,fromF:op&&op.fromOff!==undefined?freq(op.fromOff):0,glide:op&&op.glide||0});
    if(o.onNote) o.onNote(t,off,"play",0.6,vel||0.6);
    return {release:tt=>v.release(tt===undefined?ctx.currentTime:tt)};
  }

  /* ---------- pistes de l'utilisateur (DAW) : des clips en boucle, joués par n'importe quel instrument ---------- */
  function dawT(tr){
    let st=DT[tr.id]; if(st) return st;
    st={vol:G(1),pan:PAN(0),gen:null,k:0,from:-1e9}; st.vol.connect(st.pan); st.pan.connect(B.daw.in); st.dest=B.daw.in;
    st.gen=G(1); st.gen.connect(st.vol); DT[tr.id]=st; return st;
  }
  function dawSync(){
    DAW().tracks.forEach(tr=>{ const st=dawT(tr); st.vol.gain.value=trkOn(tr)?tr.vol:0; if(st.pan.pan) st.pan.pan.value=tr.pan||0; const want=tr.inst==="atelier"?rackDaw.in:B.daw.in; if(st.dest!==want){ try{ st.pan.disconnect(); }catch(e){} st.pan.connect(want); st.dest=want; } });
    B.daw.lvl.gain.value=want("daw")?1:0;
  }
  function dawSchedule(until){
    DAW().tracks.forEach(tr=>{
      const st=dawT(tr), L=Math.max(1,tr.bars)*barE, fn=instOf(tr.inst,"luth"), idx=DAW().tracks.indexOf(tr);
      while(t0+st.k*L*E<until){
        const base=t0+st.k*L*E;
        tr.notes.forEach(n=>{
          const tt=sw(base+n.s*E); if(tt<st.from) return;
          const len=Math.max(0.05,n.d*E);
          fn(tt,freq(n.off),n.v,len,st.gen,0); rec(5+idx,tt,n.off,len,n.v);
          if(o.onNote) o.onNote(tt,n.off,"play",len,n.v);
        });
        st.k++;
      }
    });
  }
  /* après une modification : on coupe ce qui était planifié et on replanifie depuis maintenant */
  function dawReplan(id){
    if(!started) return;
    const now=ctx.currentTime;
    DAW().tracks.forEach(tr=>{
      if(id!==undefined&&tr.id!==id) return;
      const st=dawT(tr), L=Math.max(1,tr.bars)*barE, old=st.gen;
      old.gain.cancelScheduledValues(now); old.gain.setTargetAtTime(0,now,0.02);
      if(typeof setTimeout==="function") setTimeout(()=>{ try{ old.disconnect(); }catch(e){} },1500);
      st.gen=G(1); st.gen.connect(st.vol);
      st.k=Math.max(0,Math.floor((now-t0)/(L*E))); st.from=now+0.03;
    });
    dawSchedule(now+4);
  }
  /* note jouée à la main avec l'instrument d'une piste (tenue pour le synthé perso) */
  function dawOn(tr,off,vel,op){
    const t=ctx.currentTime+0.004, st=dawT(tr), f=freq(off), v=vel||0.7;
    if(o.onNote) o.onNote(t,off,"play",0.6,v);
    if(tr.inst==="atelier"){ const h=synthVoice(ctx,S.syn,{t,f,vel:v,dur:null,dst:st.vol,pan:0,lite:o.lite,noise:wb,fromF:op&&op.fromOff!==undefined?freq(op.fromOff):0,glide:op&&op.glide||0}); return {release:tt=>h.release(tt===undefined?ctx.currentTime:tt)}; }
    instOf(tr.inst,"luth")(t,f,v*0.4,E*3,st.vol,0); return {release:()=>{}};
  }
  /* une note à un instant précis (arpégiateur) */
  function dawNote(tr,off,vel,t,len){ const st=dawT(tr); instOf(tr.inst,"luth")(t,freq(off),vel,Math.max(0.05,len),st.vol,0); if(o.onNote) o.onNote(t,off,"play",len,vel); }
  const dawPos=tr=>{ const L=Math.max(1,tr.bars)*barE, x=(ctx.currentTime-t0)/E; return ((x%L)+L)%L; };

  /* ---------- nappes ---------- */
  function padVoice(t,len,f,timbre){
    if(timbre==="atelier"){ synthVoice(ctx,S.syn,{t,f,vel:0.55,dur:len,dst:V.pad.node,pan:0,lite:o.lite,noise:wb}); return; }
    const a=Math.min(3,len*0.45), rel=Math.min(3.5,len*0.8), e=G(0);
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.09,t+a); e.gain.setValueAtTime(0.09,t+len); e.gain.linearRampToValueAtTime(0,t+len+rel);
    e.connect(V.pad.node);
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
  /* peau : modes d'une membrane circulaire (rapports de Bessel), chacun amorti à sa vitesse, avec une chute de hauteur à l'attaque */
  function membrane(t,vel,f0,dec,body){
    [[1,1,1],[1.59,0.75,0.8],[2.14,0.55,0.62],[2.30,0.45,0.55],[2.65,0.35,0.45],[2.92,0.25,0.4]].forEach(([m,a,dm])=>{
      const x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(f0*m*1.18,t); x.frequency.exponentialRampToValueAtTime(f0*m,t+0.045);
      const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*a*body,t+0.003); e.gain.exponentialRampToValueAtTime(0.0001,t+dec*dm);
      x.connect(e); e.connect(B.perc.in); x.start(t); x.stop(t+dec*dm+0.05);
    });
  }
  const stomp=(t,v)=>{ if(physOn()){ membrane(t,v,88,0.42,0.55); noiseHit(t,v*0.2,380,0.05,"lowpass",B.perc.in); } else{ thump(t,v*0.7,115,46,0.35); noiseHit(t,v*0.18,420,0.06,"lowpass",B.perc.in); } };
  const tap=(t,v)=>{ if(physOn()){ membrane(t,v,170,0.16,0.3); noiseHit(t,v*0.45,1900,0.07,"bandpass",B.perc.in); } else{ thump(t,v*0.25,220,150,0.1); noiseHit(t,v*0.5,1700,0.09,"bandpass",B.perc.in); } };
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
  /* ---------- harmonie modale : une succession d'accords liée à la mélodie ---------- */
  const modal=()=>!(S.mus&&S.mus.logic==="hasard");
  /* caractère de la mélodie : cinq curseurs qui orientent le tirage (0,5 = comme avant) */
  const car=()=>S.car||{grav:0.5,aud:0.5,orn:0.5,sil:0.5,rep:0.5};
  const leapE=()=>clamp(S.mel.leap+(car().aud-0.5)*1.2,0,1), ornE=()=>clamp(S.mel.orn+(car().orn-0.5)*0.9,0,1), dejaE=()=>clamp(S.mel.deja+(car().rep-0.5)*0.9,0,1);
  const silE=()=>0.25+1.5*car().sil, gravE=()=>car().grav;
  const formE=()=>(S.mus&&S.mus.form)||"libre";
  const FS={ref:[],theme:[],ost:null,ostN:0};
  const tonicIx=(pool,i)=>{ let best=i,bd=1e9; pool.forEach((p,j)=>{ if(((p%12)+12)%12===0){ const d=Math.abs(j-i); if(d<bd){bd=d;best=j;} } }); return best; };
  const chordTl=[]; let chordEnd=-1, cpos=0, lastDeg=0, holdDeg=null, prevVoicing=null;
  /* progression en cycles de quatre accords : retour à la tonique, un accord libre, un accord de préparation (sous-tonique, dominante ou sous-dominante), puis la tonique */
  function nextDegree(n){
    if(holdDeg!==null) return holdDeg%n;
    { const F=formE(); if(F==="passacaille"){ const g=[0,n-1,Math.round(n*5/7)%n,Math.round(n*4/7)%n]; lastDeg=g[cpos++%4]; return lastDeg; } if(F==="ostinato"){ const p=cpos++%4; lastDeg=p===3?Math.round(n*4/7)%n:0; return lastDeg; } }
    const pos=cpos++%4, s4=Math.round(n*3/7)%n, s5=Math.round(n*4/7)%n, sub=n-1, vi=Math.round(n*5/7)%n, mot=clamp(S.pad.motion,0,1);
    const pick=(cands)=>{ const tot=cands.reduce((a,c)=>a+c[1],0); let r=R.s()*tot; for(const [d,w] of cands){ r-=w; if(r<=0) return d; } return cands[0][0]; };
    let d;
    if(pos===0) d=0;
    else if(pos===3) d=pick([[sub,1.0],[s5,0.8],[s4,0.5]]);
    else{
      const w=0.3+0.7*mot;
      d=pick([[0,0.3+(1-mot)*1.2],[s4,1.4*w],[sub,1.2*w],[vi,1.0*w],[s5,0.9*w],[2%n,0.6*w],[1%n,0.4*w]].filter(c=>c[0]!==lastDeg||c[0]===0));
    }
    lastDeg=d; return d;
  }
  /* conduite des voix : chaque voix va vers la note de l'accord la plus proche de la précédente */
  function voice(iv,d,vc){
    const tones=[degOff(iv,d),degOff(iv,d+2),degOff(iv,d+4),degOff(iv,d+6)], pcs=tones.map(x=>((x%12)+12)%12);
    if(!prevVoicing||!prevVoicing.length) return tones.slice(0,vc).map(x=>x+12);
    const cand=[]; pcs.forEach((pc,j)=>{ for(let k=0;k<5;k++){ const x=pc+12*k; if(x>=10&&x<=44) cand.push({x,j}); } });
    const used=new Set(), out=[], usedPc=new Set();
    prevVoicing.slice().sort((a,b)=>a-b).slice(0,vc).forEach(pv=>{
      let best=null,bd=1e9; cand.forEach(c=>{ if(used.has(c.x)) return; const dd=Math.abs(c.x-pv)+(usedPc.has(c.j)?5:0); if(dd<bd){bd=dd;best=c;} });
      if(best){ used.add(best.x); usedPc.add(best.j); out.push(best.x); }
    });
    for(let j=0;out.length<vc&&j<4;j++){ if(!usedPc.has(j)) out.push(tones[j]+12); }
    return out.sort((a,b)=>a-b);
  }
  function ensureChords(until){
    if(chordEnd<0) chordEnd=t0;
    while(chordEnd<until){
      const t=chordEnd, iv=ivOf(S,secOf(t).key), n=iv.length, len=S.pad.len*bar, vc=clamp(Math.round(S.pad.voices),2,o.lite?3:4);
      let dRaw, offs;
      if(modal()){ dRaw=nextDegree(n); offs=voice(iv,dRaw%n,vc); prevVoicing=offs; }
      else{ dRaw=recall(memP,nChord++,Math.max(1,Math.round(S.pad.loop)),S.pad.deja,R.s,()=>(R.s()<0.35+0.4*(1-S.pad.motion))?0:Math.floor(R.s()*n)); const d=dRaw%n; offs=[degOff(iv,d),degOff(iv,d+2),degOff(iv,d+4),degOff(iv,d+6)].slice(0,vc).map(x=>x+12); }
      chordTl.push({t,len,d:dRaw,iv,offs,sched:false}); chordEnd=t+len;
    }
    if(chordTl.length>80) chordTl.splice(0,chordTl.length-60);
  }
  function chordAt(t){ ensureChords(t+0.01); let c=chordTl[0]; for(const x of chordTl){ if(x.t<=t) c=x; else break; } return c; }

  /* ---------- mélodie modale : motif de la section, phrases en question et réponse, accents sur les accords ---------- */
  let motif=null, motifSec=-1, nPh=0;
  function motifFor(sec){
    if(motifSec===sec&&motif) return motif;
    motifSec=sec;
    const pats=[[2,1,1,2],[1,1,2,2],[3,1,2],[2,2,1,1],[1,2,1,2],[2,1,2]], rh=pats[Math.floor(R.m()*pats.length)], sg=R.m()<0.5?-1:1, steps=[];
    for(let i=0;i<rh.length-1;i++) steps.push(i===0?sg*(1+Math.floor(R.m()*2)):(R.m()<0.6?-Math.sign(steps[i-1])||1:Math.sign(steps[i-1]))*(R.m()<0.7?1:2));
    motif={steps,rh}; return motif;
  }
  const chordPcs=ch=>ch.offs.map(x=>((x%12)+12)%12);
  function snapTo(pool,i,pcs,reach){
    for(let k=0;k<=reach;k++){
      if(i+k<pool.length&&pcs.indexOf(((pool[i+k]%12)+12)%12)>=0) return i+k;
      if(i-k>=0&&pcs.indexOf(((pool[i-k]%12)+12)%12)>=0) return i-k;
    }
    return i;
  }
  /* formes de la pièce : le plan que suivent les phrases */
  function varyPhrase(ph,cyc,pool){
    const kind=cyc%4, ix0=pool.indexOf(nearest(pool,ph.notes[0].off)), idxOf=o2=>Math.max(0,pool.indexOf(nearest(pool,o2)));
    let notes=ph.notes.map(n=>({...n})), end=ph.end;
    if(kind===1) notes.forEach(n=>{ if(R.m()<0.6) n.grace=true; });
    else if(kind===2) notes.forEach(n=>{ n.off=pool[clamp(ix0-(idxOf(n.off)-ix0),0,pool.length-1)]; });
    else if(kind===3){ notes.forEach(n=>{ n.e*=2; n.dE*=2; }); end*=2; }
    else notes.forEach(n=>{ n.off=pool[clamp(idxOf(n.off)+2,0,pool.length-1)]; });
    return {notes,end,gr:ph.gr,pool};
  }
  function formPhrase(F,gen,pool){
    const k=nPhrase++; if(frozen&&lastPh) return lastPh;
    if(F==="ostinato"){ if(!FS.ost||FS.ostN>=8){ FS.ost=gen(); FS.ostN=0; } FS.ostN++; return FS.ost; }
    if(F==="rondeau"){ const A=[0,1,4,5,8,9], ai=A.indexOf(k%12); if(ai>=0){ const j=ai%2; if(!FS.ref[j]) FS.ref[j]=gen(); return FS.ref[j]; } return gen(); }
    if(F==="variations"){ const j=k%4, cyc=Math.floor(k/4); if(!FS.theme[j]) FS.theme[j]=gen(); return cyc===0?FS.theme[j]:varyPhrase(FS.theme[j],cyc,pool); }
    return gen();
  }
  function genPhraseModal(pool,stab,dens,startT,secI){
    const mt=motifFor(secI), type=nPh++%4, ch0=chordAt(startT);
    let i0;
    if(lastOff.v!==null){ let bi=0,bd=1e9; pool.forEach((p,j)=>{const d=Math.abs(p-lastOff.v); if(d<bd){bd=d;bi=j;}}); i0=bi; } else i0=Math.floor(pool.length/3);
    let idx=snapTo(pool,i0,chordPcs(ch0),3);
    if(type===1) idx=clamp(idx+[1,-1,2][Math.floor(R.m()*3)],0,pool.length-1); /* le motif repris plus haut ou plus bas */
    const seq=[idx], dEs=[mt.rh[0]];
    mt.steps.forEach((st,k)=>{ idx=clamp(idx+(type===1&&nPh%8>=4?-st:st),0,pool.length-1); seq.push(idx); dEs.push(mt.rh[k+1]); });
    /* suite de la phrase : en arche pour la question, descendante vers le repos pour la réponse */
    const extra=1+Math.floor(R.m()*(1+3*dens)), durs=dens>0.6?[1,1,2,2,3]:[1,2,2,3,4];
    for(let k=0;k<extra;k++){
      let st;
      if(R.m()<leapE()*0.4) st=(type===2?1:-1)*(3+Math.floor(R.m()*2));
      else if(type===2) st=k<extra/2?(R.m()<0.75?1:2):(R.m()<0.7?-1:1);
      else if(type===3) st=R.m()<0.8?-1:(R.m()<0.5?-2:1);
      else st=[-2,-1,-1,1,1,2][Math.floor(R.m()*6)];
      { const pg=Math.max(0,gravE()-0.35)*0.9, ti=tonicIx(pool,idx); if(ti!==idx&&R.m()<pg) st=Math.sign(ti-idx); }
      idx=clamp(idx+st,0,pool.length-1); seq.push(idx); dEs.push(durs[Math.floor(R.m()*durs.length)]);
    }
    /* notes : temps forts sur les notes de l'accord, fin de phrase sur le repos voulu, silences et nuances de phrase */
    const notes=[], n=seq.length; let e=0;
    for(let k=0;k<n;k++){
      const tn=startT+e*E, ch=chordAt(tn), strong=Math.round((tn-t0)/E)%2===0;
      let ix=seq[k];
      if(k===n-1){
        if(type===3||R.m()<Math.max(0,gravE()-0.5)*1.2){ const tpc=stab.indexOf(0)>=0?[0]:[stab[0]]; ix=snapTo(pool,ix,tpc,5); }
        else ix=snapTo(pool,ix,type===2?chordPcs(ch).slice(1,3):chordPcs(ch),4);
      } else if(strong) ix=snapTo(pool,ix,chordPcs(ch),2);
      const arch=0.5+0.5*Math.sin(Math.PI*(k+0.5)/n), vel=(0.14+0.1*arch)*(strong?1.1:0.92)*(type===2?0.95:1)+(R.m()-0.5)*0.03;
      const grace=R.m()<ornE(), gdir=R.m()<0.5?-1:1, jit=(R.h()-0.5)*(strong?0.008:0.024), trill=ornE()>0.55&&R.m()<(ornE()-0.55)*0.8;
      notes.push({e,off:pool[ix],dE:dEs[k],vel,grace,gdir,jit,trill}); e+=dEs[k];
      if(k<n-2&&R.m()<0.3*(1-dens)*silE()) e+=1+Math.floor(R.m()*2); /* un souffle entre deux notes */
    }
    return {notes,end:e,gr:R.m(),pool};
  }
  function genPhrase(pool,stab,dens){
    if(lastOff.v!==null){ let bi=0,bd=1e9; pool.forEach((p,j)=>{const d=Math.abs(p-lastOff.v); if(d<bd){bd=d;bi=j;}}); idx=bi; }
    else idx=Math.floor(pool.length/3);
    const n=4+Math.floor(R.m()*(3+5*dens)), durs=dens>0.6?[1,1,1,2,2,3]:[1,1,2,2,3,4], notes=[];
    let e=0;
    for(let i=0;i<n;i++){
      let st;
      if(R.m()<leapE()*0.5) st=(R.m()<0.5?-1:1)*(3+Math.floor(R.m()*3));
      else st=[-2,-1,-1,1,1,2][Math.floor(R.m()*6)];
      idx=clamp(idx+st,0,pool.length-1);
      if(i===n-1){
        for(let k=0;k<=3;k++){
          if(idx+k<pool.length&&stab.indexOf(((pool[idx+k]%12)+12)%12)>=0){idx+=k;break;}
          if(idx-k>=0&&stab.indexOf(((pool[idx-k]%12)+12)%12)>=0){idx-=k;break;}
        }
      }
      const dE=durs[Math.floor(R.m()*6)], vel=0.16+R.m()*0.1, grace=R.m()<ornE(), gdir=R.m()<0.5?-1:1;
      notes.push({e,off:pool[idx],dE,vel,grace,gdir}); e+=dE;
    }
    return {notes,end:e,gr:R.m(),pool};
  }

  /* ---------- ordonnanceur ---------- */
  const cur={mel:0,drone:0,clink:0,perc:0,k:0,pad:0,int:0,fire:0,wind:0,drip:0,bird:0};
  let loopsL=[], pendK=[], lastPh=null, lastD=null, frozen=null;
  const lastOff={v:null};
  function rec(tr,t,off,dur,vel){ if(o.record) events.push({tr,t,off,dur,vel}); }
  const ctr={pm:null,pc:null,li:null};
  function canonNote(t,off,vel,len,iv){
    const n=iv.length, wide=poolOf(iv,-24,72), k=wide.indexOf(off); if(k<0) return;
    if(S.canon.shift==="contre"){
      /* contrepoint : une voix sous la mélodie, en tierces et sixtes, de préférence en mouvement contraire et sans quintes ni octaves parallèles */
      const third=Math.max(1,Math.round(2*n/7)), sixth=Math.max(2,Math.round(5*n/7)), fifth=Math.max(2,Math.round(4*n/7)), cands=[third,sixth,third+n,fifth,n].map(d=>k-d).filter(i=>i>=0);
      if(!cands.length) return;
      const dm=ctr.pm===null?0:Math.sign(off-ctr.pm); let best=cands[0], bs=-1e9;
      cands.forEach(i=>{ const dc=ctr.pc===null?0:Math.sign(wide[i]-ctr.pc), gap=k-i; let sc=0;
        if(dm!==0&&dc!==0) sc+=dc===-dm?3:-1; else if(dm!==0) sc+=1;
        if(gap===third||gap===sixth) sc+=2; if(ctr.li===gap&&(gap===fifth||gap===n)) sc-=4; sc+=R.v()*0.5; if(sc>bs){ bs=sc; best=i; } });
      const off2=wide[best]; ctr.pm=off; ctr.pc=off2; ctr.li=k-best;
      const tt=sw(t)+0.012;
      instOf(S.canon.inst,"harpe")(tt,freq(off2),vel*0.85,len,V.canon.node,(R.v()*2-1)*0.5);
      rec(1,tt,off2,len,vel*0.85); if(o.onNote) o.onNote(tt,off2,"canon",len,vel*0.85);
      return;
    }
    const shifts={"uni":0,"oct+":n,"oct-":-n,"q+":Math.round(n*4/7),"q-":-Math.round(n*4/7),"t+":Math.round(n*2/7)};
    const k2=clamp(k+(shifts[S.canon.shift]||0),0,wide.length-1), off2=wide[k2];
    const tt=sw(t+S.canon.delay*bar);
    instOf(S.canon.inst,"harpe")(tt,freq(off2),vel*0.9,len,V.canon.node,(R.v()*2-1)*0.5);
    rec(1,tt,off2,len,vel*0.9);
    if(o.onNote) o.onNote(tt,off2,"canon",len,vel*0.9);
  }
  function schedule(until){
    const M=mach();
    dawSchedule(until);
    /* intensité */
    while(cur.int<until){
      const t=cur.int, I=inten(t), A=S.form.shape==="constante"?0:S.form.amount, m=1-A+A*I, ie=S.form.shape==="constante"?0.5:I;
      B.perc.it.gain.setTargetAtTime(m,t,1.2); B.pad.it.gain.setTargetAtTime(0.45+0.55*m,t,1.2);
      droneFilters.forEach(({f,base})=>f.frequency.setTargetAtTime(base*(0.7+0.6*ie)*(adaptOn()?1+S.adapt.amount*(adaptE(t+1)-0.5)*0.6:1),t,2));
      if(adaptOn()){ const vv=clamp(S.fx.veil+S.adapt.amount*(0.5-adaptE(t+1))*0.6,0,1); veil.frequency.setTargetAtTime(18000*Math.pow(2500/18000,vv),t,3); }
      if(dynTens()){
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
      if(M&&want("perc")&&S.perc.lvl>0.001){
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
      if(!M){ cur.mel=t0+bar*Math.ceil((until-t0)/bar); break; }
      const sc=secOf(cur.mel), iv=ivOf(S,sc.key), stab=stableOf(iv), I=inten(cur.mel);
      const evo=S.form.shape==="constante"?0:(I-0.5)*S.form.amount;
      const dens=clamp(S.mel.dens+evo+(tensAt(cur.mel)-0.5)*0.6+(formE()==='passacaille'?0.07*(Math.floor(cpos/4)%6):0),0,1);
      const lo=12+12*S.mel.reg, hi=lo+12*S.mel.span, pool=poolOf(iv,lo,hi);
      if(!pool.length){cur.mel+=bar; continue;}
      const gen=modal()?(()=>genPhraseModal(pool,stab,dens,cur.mel,sc.i)):(()=>genPhrase(pool,stab,dens));
      let ph=formE()==='libre'?recall(memM,nPhrase++,Math.max(1,Math.round(S.mel.loop)),dejaE(),R.m,gen):formPhrase(formE(),gen,pool);
      lastPh=ph;
      if(ph.pool!==pool){ /* rejouée : recaler sur la gamme de la section */
        ph={notes:ph.notes.map(n=>({...n,off:nearest(pool,n.off)})),end:ph.end,gr:ph.gr};
        if(modal()){ /* et sur l'accord du moment : temps forts et dernière note */
          const last=ph.notes.length-1;
          ph.notes=ph.notes.map((n,k)=>{ const tn=cur.mel+n.e*E, strong=Math.round((tn-t0)/E)%2===0; if(!strong&&k!==last) return n; const ci=pool.indexOf(n.off), ix=snapTo(pool,ci<0?0:ci,chordPcs(chordAt(tn)),k===last?4:2); return {...n,off:pool[ix]}; });
        }
      }
      let t=cur.mel;
      ph.notes.forEach(nt=>{
        const off=nt.off, tt=sw(cur.mel+nt.e*E)+(nt.jit||0), vel=nt.vel, len=E*nt.dE*0.92;
        if(want("mel")&&S.mel.lvl>0.001){
          const fn=instOf(S.mel.inst,"luth");
          if((nt.grace||nt.trill)&&pool.length>2&&(S.mel.inst==="luth"||S.mel.inst==="harpe"||S.mel.inst==="carillon"||S.mel.inst==="oud"||S.mel.inst==="kalimba")){
            const gi=clamp(pool.indexOf(off)+nt.gdir,0,pool.length-1); if(nt.trill){ fn(tt-0.16,freq(pool[gi]),vel*0.42,0.07,V.mel.node,0); fn(tt-0.08,freq(off),vel*0.5,0.07,V.mel.node,0); } fn(tt-0.07+(nt.trill?0.0:0),freq(pool[gi]),vel*0.55,0.08,V.mel.node,0);
          }
          fn(tt,freq(off),vel,len,V.mel.node,(R.v()*2-1)*0.35);
          if(S.canon.lvl>0.001) canonNote(cur.mel+nt.e*E,off,vel,len,iv);
        }
        rec(0,tt,off,len,vel);
        if(o.onNote) o.onNote(tt,off,"mel",len,vel);
        lastOff.v=off;
      });
      t=cur.mel+ph.end*E;
      const bars=Math.ceil((t-t0)/bar-1e-6);
      cur.mel=t0+bar*(bars+Math.round(ph.gr*2*(1.6-1.5*dens)*silE()));
    }
    /* nappes */
    ensureChords(until);
    for(const ch of chordTl){
      if(ch.sched||ch.t>=until) continue;
      ch.sched=true; lastD=ch.d;
      if(M&&want("pad")&&S.pad.lvl>0.001){
        ch.offs.forEach(off=>{padVoice(ch.t,ch.len,freq(off),S.pad.timbre); rec(2,ch.t,off,ch.len,0.3); if(o.onNote) o.onNote(ch.t,off,"pad",ch.len,0.3);});
      }
    }
    /* bourdon : la quinte glisse vers un degré voisin */
    while(cur.drone<until){
      if(!M){ cur.drone=until; break; }
      const t=cur.drone, iv=ivOf(S,secOf(t).key), cands=[5,10,3,2,8,1].filter(x=>iv.indexOf(x)>=0);
      const pick=cands.length?cands[Math.floor(R.d()*Math.min(cands.length,3))]:null, hold=12+R.d()*14;
      if(pick!==null&&S.drone.glide>0.02&&fifthGl.length){
        const f0=freq(7), f1=freq(pick);
        fifthGl.forEach(({p,m})=>{p.setValueAtTime(f0*m,t); p.exponentialRampToValueAtTime(f1*m,t+4); p.setValueAtTime(f1*m,t+4+hold); p.exponentialRampToValueAtTime(f0*m,t+8+hold);});
      }
      cur.drone=t+8+hold+(30+R.d()*50)*(1.8-1.6*S.drone.glide);
    }
    /* boucles de bande à longueurs incommensurables (Eno) */
    if(M&&S.loops.lvl>0.001&&want("loops")){
      const fn=instOf(S.loops.inst,"carillon");
      loopsL.forEach(lp=>{
        while(lp.next<until){
          const tt=lp.next, iv=ivOf(S,secOf(tt).key), off=degOff(iv,lp.deg)+12*lp.oct, vel=lp.vel*(0.85+0.3*R.l());
          fn(tt,freq(off),vel,E*10,V.loops.node,lp.pan);
          rec(3,tt,off,E*10,vel);
          if(o.onNote) o.onNote(tt,off,"loop",E*10,vel);
          lp.next+=lp.len;
        }
      });
    } else loopsL.forEach(lp=>{ while(lp.next<until) lp.next+=lp.len; });
    /* pendules : un coup quand chaque pendule repasse par le bas, tous alignés à chaque période */
    {
      const N=pendN(), T=S.pend.period*bar, fn=instOf(S.pend.inst,"carillon"), on=M&&S.pend.lvl>0.001&&want("pend");
      for(let i=0;i<N;i++){
        const c=PEND_N0+i;
        while(true){
          const tt=t0+T*(0.25+pendK[i])/c; if(tt>=until) break;
          pendK[i]++;
          if(!on) continue;
          const iv=ivOf(S,secOf(tt).key), off=degOff(iv,i)+12, vel=0.17-0.07*i/N;
          fn(tt,freq(off),vel,E*6,V.pend.node,(i/Math.max(1,N-1)*2-1)*0.6);
          rec(4,tt,off,E*6,vel);
          if(o.onNote) o.onNote(tt,off,"pend",E*6,vel);
        }
      }
    }
    /* lieu */
    if(!M){ for(const k of ["clink","fire","wind","drip","bird"]) if(cur[k]<until) cur[k]=until; bands.forEach(b=>{ if(b.cur<until) b.cur=until; }); }
    if(M&&want("amb")){
      bands.forEach(b=>{
        while(b.cur<until){
          const v=Math.pow(R.a(),2)*0.5*b.lvl; b.g.gain.setTargetAtTime(v,b.cur,0.35); b.cur+=0.5+R.a()*1.8;
        }
      });
      while(cur.clink<until){ clink(cur.clink); cur.clink+=(18+R.a()*30)/(0.25+S.amb.clink*1.5); }
      cur.fire=until; /* les craquements viennent de la boucle précalculée */
      while(cur.bird<until){ const t=cur.bird, ov=natv().oiseaux||0; if(ov>0.001) bird(t); cur.bird=t+(7+R.t()*14)/(0.25+ov*1.75); }
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
    cur.perc=t+bar*Math.ceil(4/bar); cur.k=0; cur.mel=t+bar*Math.ceil(7/bar); cur.pad=t; cur.int=t; chordEnd=t;
    cur.drone=t+25+R.d()*20; cur.clink=t+10; cur.fire=t; cur.wind=t; cur.drip=t+4; cur.bird=t+3; started=true;
    bands.forEach(b=>b.cur=t);
    initLoops(t);
    pendK=Array.from({length:pendN()},()=>0);
  }
  function initLoops(t){
    const nl=clamp(Math.round(S.loops.count),1,5), lens=[29,31,37,41,43,47,53,59].slice();
    loopsL=[];
    for(let i=0;i<nl;i++){
      const L=lens.splice(Math.floor(R.l()*lens.length),1)[0]*E*S.loops.speed, deg=[0,4,2,1,3][i];
      loopsL.push({len:L, next:t+(0.15+0.85*R.l())*L, deg, oct:i===0?1:1+Math.floor(R.l()*2), pan:(R.l()*2-1)*0.7, vel:0.13+R.l()*0.04});
    }
  }
  /* replan : coupe les notes déjà planifiées d'une voix et en planifie de nouvelles tout de suite, avec les réglages actuels */
  function replan(what){
    if(!started) return;
    const now=ctx.currentTime, all=what==="all";
    const kill=(name,tc)=>{
      const old=V[name].node; old.gain.cancelScheduledValues(now); old.gain.setTargetAtTime(0,now,tc||0.03);
      if(typeof setTimeout==="function") setTimeout(()=>{ try{ old.disconnect(); }catch(e){} },1500);
      newGen(name);
    };
    if(all){ for(const k in COL) delete COL[k]; FS.ref.length=0; FS.theme.length=0; FS.ost=null; FS.ostN=0; ctr.pm=ctr.pc=ctr.li=null; }
    if(all||what==="mel"){ kill("mel"); kill("canon"); cur.mel=t0+Math.ceil((now+0.04-t0)/E)*E; }
    if(all||what==="pad"){ kill("pad",0.15); while(chordTl.length&&chordTl[chordTl.length-1].t>=now) chordTl.pop(); chordEnd=now+0.04; }
    if(all||what==="loops"){ kill("loops",0.05); initLoops(now); }
    if(all) dawReplan();
    if(all||what==="pend"){
      kill("pend",0.05); const T=Math.max(1,S.pend.period*bar);
      pendK=Array.from({length:pendN()},(_,i)=>Math.max(0,Math.ceil(((now-t0)/T)*(PEND_N0+i)-0.25)));
    }
  }

  /* gestes musicaux : suspense, révélation, danger, posés sur la prochaine noire */
  function gesture(name){
    if(!started) return;
    const now=ctx.currentTime, tq=t0+Math.ceil((now+0.15-t0)/(2*E))*(2*E), iv=ivOf(S,secOf(tq).key), n=iv.length;
    const ramp=(g,v,t,tc)=>{ g.cancelScheduledValues(Math.max(now,t-0.001)); g.setTargetAtTime(v,t,tc); };
    const back=(names,t)=>names.forEach(k=>ramp(B[k].gs.gain,1,t,0.7));
    const fn=instOf(S.mel.inst,"luth"), note=(t,off,v,len)=>{ fn(t,freq(off),v,len,B.play.in,0); if(o.onNote) o.onNote(t,off,"play",len,v); };
    if(name==="suspense"){
      const len=3*bar, dom=Math.round(n*4/7)%n; ramp(B.mel.gs.gain,0,now,0.2); ramp(B.perc.gs.gain,0.15,now,0.4); ramp(B.pad.gs.gain,1.5,tq,1.2); ramp(B.drone.gs.gain,1.4,tq,1.2);
      [degOff(iv,dom),degOff(iv,dom+2),degOff(iv,dom+4)].forEach(x=>padVoice(tq,len,freq(x+12),S.pad.timbre));
      back(["mel","perc","pad","drone"],tq+len);
    }else if(name==="revelation"){
      const len=3*bar; ramp(B.pad.gs.gain,1.35,tq,0.6); ramp(B.mel.gs.gain,1.15,tq,0.6);
      [0,4,7,11,16].forEach(x=>padVoice(tq,len,freq(x+12),S.pad.timbre));
      for(let i=0;i<6;i++) note(tq+i*E*0.5,degOff(iv,i)+12,0.2-0.01*i,E*3);
      note(tq+3*E,degOff(iv,7)+12,0.22,E*8); back(["pad","mel"],tq+len);
    }else if(name==="danger"){
      const len=4*bar; ramp(B.perc.gs.gain,1.9,tq,0.3); ramp(B.drone.gs.gain,1.5,tq,0.4); ramp(B.mel.gs.gain,0.4,tq,0.3);
      for(let k=0;k<8;k++){ const t=tq+k*E; note(t,k%2?-6:-12,0.3-0.015*k,E*1.6); if(k%2===0) note(t+E*0.5,-12+(k%4===0?0:1),0.16,E); }
      back(["perc","drone","mel"],tq+len);
    }
  }
  /* figer : la dernière phrase et le dernier accord tournent en boucle jusqu'à ce qu'on relâche */
  function freeze(on){
    if(on&&!frozen){
      frozen={mdeja:S.mel.deja, mloop:S.mel.loop, pdeja:S.pad.deja, ploop:S.pad.loop};
      S.mel.deja=1; S.mel.loop=1; S.pad.deja=1; S.pad.loop=1;
      memM.length=0; if(lastPh) memM[0]=lastPh; nPhrase=0;
      memP.length=0; if(lastD!==null) memP[0]=lastD; nChord=0; holdDeg=lastD;
      replan("mel"); replan("pad");
    }else if(!on&&frozen){
      S.mel.deja=frozen.mdeja; S.mel.loop=frozen.mloop; S.pad.deja=frozen.pdeja; S.pad.loop=frozen.ploop; frozen=null; holdDeg=null;
    }
    return !!frozen;
  }
  /* autre phrase : on oublie la mémoire et on repart sur du neuf */
  function reroll(){ memM.length=0; memP.length=0; nPhrase=0; nChord=0; replan("mel"); replan("pad"); }
  /* jouer une note à la main : même instrument que la mélodie ou un autre, et le canon la reprend s'il est actif */
  function play(off,vel){
    const t=ctx.currentTime+0.01, inst=(S.play&&S.play.inst)||S.mel.inst, fn=instOf(inst,"luth"), len=E*3, v=vel||0.22;
    fn(t,freq(off),v,len,B.play.in,0);
    if(S.canon.lvl>0.001) canonNote(t,off,v,len,ivOf(S,secOf(t).key));
    if(o.onNote) o.onNote(t,off,"play",len,v);
    return t;
  }
  function stop(now,tc){ master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0,now,tc||0.4); }
  /* fondu enchaîné : l'ancien moteur s'éteint sur d secondes puis libère ses oscillateurs */
  function fadeOut(now,d){
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value,now); master.gain.linearRampToValueAtTime(0,now+d);
    starts.forEach(x=>{try{x.stop(now+d+0.2);}catch(e){}});
  }
  const pendX=t=>Array.from({length:pendN()},(_,i)=>Math.cos(2*Math.PI*(PEND_N0+i)*(t-t0)/(S.pend.period*bar)));
  return {start,schedule,setLevels,setReverb,stop,fadeOut,sleepFade,sleepClear,replan,freeze,reroll,gesture,play,synOn,dawOn,dawNote,rackSync,meter,analyser:k=>k==="all"?anaAll:anaSyn,dawReplan,dawPos,pendX,tensNow:()=>tensAt(ctx.currentTime),adaptNow:()=>adaptE(ctx.currentTime),tensPos:()=>{ if(!curveOn()) return -1; const L=Math.max(30,S.curve.dur*60), x=(ctx.currentTime-t0)/L; return S.curve.mode==='loop'?((x%1)+1)%1:clamp(x,0,1); },events,out,master,secAt:t=>secOf(t),bar,E,t0f:()=>t0};
}
