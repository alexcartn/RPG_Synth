"use strict";
/* ============================================================
   MOTEUR AUDIO
   ============================================================ */
function buildEngine(ctx, S, o){
  o = o||{};
  const seed=S.seed>>>0, sr=ctx.sampleRate;
  const R={m:mulberry32(seed), d:mulberry32(seed^0xA1B2C3), p:mulberry32(seed^0x51ED27), a:mulberry32(seed^0x7F4A7C),
           s:mulberry32(seed^0x3C6EF3), v:mulberry32(seed^0x2545F4), n:mulberry32(seed^0x85ebca6b), w:mulberry32(seed^0x1234567)};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const G=v=>{const g=ctx.createGain(); g.gain.value=v; return g;};
  const PAN=v=>{ if(ctx.createStereoPanner){const p=ctx.createStereoPanner(); p.pan.value=v; return p;} return G(1); };
  const freq=mkFreq(S);
  const E=30/S.tempo, PAT=METERS[S.meter].p, barE=PAT.length, bar=barE*E;
  const want=n=>!o.solo||o.solo===n;
  const events=[];
  const starts=[];
  let t0=0;

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
  const sat=ctx.createWaveShaper(); sat.oversample="2x";
  function satCurve(d){const n=1024,c=new Float32Array(n),k=1+d*6,nt=Math.tanh(0.25*k); for(let i=0;i<n;i++){const x=i/(n-1)*2-1; c[i]=0.25*Math.tanh(k*x)/nt;} return c;}
  const wowD=ctx.createDelay(0.05); wowD.delayTime.value=0.012;
  const wowL1=ctx.createOscillator(); wowL1.frequency.value=0.55; const wowG1=G(0); wowL1.connect(wowG1); wowG1.connect(wowD.delayTime);
  const wowL2=ctx.createOscillator(); wowL2.frequency.value=6.3;  const wowG2=G(0); wowL2.connect(wowG2); wowG2.connect(wowD.delayTime);
  starts.push(wowL1,wowL2);
  const veil=ctx.createBiquadFilter(); veil.type="lowpass"; veil.Q.value=0.5;
  const master=G(0);
  out.connect(sat); sat.connect(wowD); wowD.connect(veil); veil.connect(master);
  if(o.noComp){ master.connect(ctx.destination); }
  else{
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-20; comp.ratio.value=3; comp.attack.value=0.02; comp.release.value=0.4;
    master.connect(comp); comp.connect(ctx.destination);
  }
  const hissSrc=loopSrc(wb), hissHP=ctx.createBiquadFilter(); hissHP.type="highpass"; hissHP.frequency.value=3500;
  const hissG=G(0); hissSrc.connect(hissHP); hissHP.connect(hissG); hissG.connect(master);

  /* réverb */
  function makeIR(size,dark){
    const len=Math.floor(sr*clamp(size,0.4,9)), ir=ctx.createBuffer(2,len,sr), rr=mulberry32((seed^0x9e3779b9)>>>0), dec=6.9/clamp(size,0.4,9);
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
  const revIn=G(1); revIn.connect(conv);

  /* écho en ping-pong */
  const dIn=G(1), dl=ctx.createDelay(4), dr=ctx.createDelay(4), dfb=G(0.4), dtone=ctx.createBiquadFilter();
  dtone.type="lowpass"; dtone.frequency.value=3200;
  dIn.connect(dl); dl.connect(dtone); dtone.connect(dr); dr.connect(dfb); dfb.connect(dl);
  const dOut=G(0), pL=PAN(-0.7), pR=PAN(0.7);
  dl.connect(pL); dr.connect(pR); pL.connect(dOut); pR.connect(dOut); dOut.connect(out);

  /* bus */
  function bus(rev,dly){
    const lvl=G(1), it=G(1); lvl.connect(it); it.connect(out);
    const rs=G(rev); it.connect(rs); rs.connect(revIn);
    if(dly){const ds=G(dly); it.connect(ds); ds.connect(dIn);}
    return {in:lvl, lvl, it};
  }
  const B={drone:bus(0.45,0.1), mel:bus(0.9,1), pad:bus(0.8,0.6), perc:bus(0.2,0), amb:bus(0.3,0)};
  const canonG=G(0); canonG.connect(B.mel.it);
  const murG=G(0), fireG=G(0), windG=G(0), dripG=G(0);
  [murG,fireG,windG,dripG].forEach(g=>g.connect(B.amb.in));

  function setLevels(){
    const lv=(n,v)=>want(n)?v:0;
    B.drone.lvl.gain.value=lv("drone",S.drone.lvl);
    B.mel.lvl.gain.value=lv("mel",S.mel.lvl);
    canonG.gain.value=lv("mel",S.canon.lvl);
    B.pad.lvl.gain.value=lv("pad",S.pad.lvl);
    B.perc.lvl.gain.value=lv("perc",S.perc.lvl);
    B.amb.lvl.gain.value=lv("amb",1);
    murG.gain.value=S.amb.murmur; fireG.gain.value=S.amb.feu*1.2; windG.gain.value=S.amb.vent*0.9; dripG.gain.value=S.amb.gouttes*0.8;
    wet.gain.value=S.fx.rev*2;
    dOut.gain.value=S.fx.dly; dfb.gain.value=Math.min(0.9,S.fx.fb);
    dl.delayTime.value=E*S.fx.dlyDiv; dr.delayTime.value=E*S.fx.dlyDiv*1.0;
    sat.curve=satCurve(S.fx.sat);
    wowG1.gain.value=S.fx.wow*0.003; wowG2.gain.value=S.fx.wow*0.0003;
    veil.frequency.value=18000*Math.pow(2500/18000,S.fx.veil);
    hissG.gain.value=S.fx.hiss*0.03;
  }
  function setReverb(){ conv.buffer=makeIR(S.fx.size,S.fx.dark); }
  setLevels();

  /* ---------- bourdon ---------- */
  const droneFilters=[]; let fifthGl=[]; const droneStarts=[];
  function droneVoice(off,lvl,cut,ty,isFifth){
    const bright=0.5+S.drone.bright*1.5, base=cut*bright, w=3+S.drone.width*14;
    const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=base; f.Q.value=0.7; droneFilters.push({f,base});
    const g=G(lvl); f.connect(g); g.connect(B.drone.in);
    const fr0=freq(off), oscs=[], srcs=[], gls=[];
    const mk=(type,mult,det,dst,gain)=>{
      const os=ctx.createOscillator(); os.type=type; os.frequency.value=fr0*mult; os.detune.value=det;
      if(gain!==undefined){const gg=G(gain); os.connect(gg); gg.connect(dst);} else os.connect(dst);
      oscs.push(os); srcs.push(os); gls.push({p:os.frequency,m:mult}); return os;
    };
    if(ty==="sine"){ mk("sine",1,0,f); }
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
    droneVoice(19,0.045,900,tone,false);
  }

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

  /* ---------- ordonnanceur ---------- */
  const cur={mel:0,drone:0,clink:0,perc:0,k:0,pad:0,int:0,fire:0,wind:0,drip:0};
  let idx=0; const lastOff={v:null};
  function rec(tr,t,off,dur,vel){ if(o.record) events.push({tr,t,off,dur,vel}); }
  function canonNote(t,off,vel,len,iv){
    const n=iv.length, wide=poolOf(iv,-24,72), k=wide.indexOf(off); if(k<0) return;
    const shifts={"uni":0,"oct+":n,"oct-":-n,"q+":Math.round(n*4/7),"q-":-Math.round(n*4/7),"t+":Math.round(n*2/7)};
    const k2=clamp(k+(shifts[S.canon.shift]||0),0,wide.length-1), off2=wide[k2];
    const tt=sw(t+S.canon.delay*bar);
    (INST[S.canon.inst]||INST.harpe)(tt,freq(off2),vel*0.9,len,canonG,(R.v()*2-1)*0.5);
    rec(1,tt,off2,len,vel*0.9);
    if(o.onNote) o.onNote(tt,off2,"canon");
  }
  function schedule(until){
    /* intensité */
    while(cur.int<until){
      const t=cur.int, I=inten(t), A=S.form.shape==="constante"?0:S.form.amount, m=1-A+A*I, ie=S.form.shape==="constante"?0.5:I;
      B.perc.it.gain.setTargetAtTime(m,t,1.2); B.pad.it.gain.setTargetAtTime(0.45+0.55*m,t,1.2);
      droneFilters.forEach(({f,base})=>f.frequency.setTargetAtTime(base*(0.7+0.6*ie),t,2));
      cur.int=t+2;
    }
    /* percussion */
    while(cur.perc<until){
      const k=cur.k%barE, sym=PAT[k], odd=(cur.k%2)===1;
      const t=cur.perc+(odd?S.swing*E*0.5:0)+R.p()*0.006;
      if(want("perc")&&S.perc.lvl>0.001){
        if(sym==="S") stomp(t,0.95); else if(sym==="s") stomp(t,0.6);
        else if(sym==="T") tap(t,0.5+R.p()*0.15); else if(sym==="t") tap(t,0.4+R.p()*0.1);
        else{
          if(R.p()<S.perc.shaker) shaker(t,0.1+R.p()*0.08);
          if(k===barE-3&&R.p()<S.perc.ghost) tap(t,0.2);
        }
      } else { R.p(); }
      cur.perc+=E; cur.k++;
    }
    /* mélodie et canon */
    while(cur.mel<until){
      const sc=secOf(cur.mel), iv=ivOf(S,sc.key), stab=stableOf(iv), I=inten(cur.mel);
      const evo=S.form.shape==="constante"?0:(I-0.5)*S.form.amount;
      const dens=clamp(S.mel.dens+evo,0,1);
      const lo=12+12*S.mel.reg, hi=lo+12*S.mel.span, pool=poolOf(iv,lo,hi);
      if(!pool.length){cur.mel+=bar; continue;}
      if(lastOff.v!==null){ let bi=0,bd=1e9; pool.forEach((p,j)=>{const d=Math.abs(p-lastOff.v); if(d<bd){bd=d;bi=j;}}); idx=bi; }
      else idx=Math.floor(pool.length/3);
      const n=4+Math.floor(R.m()*(3+5*dens)), durs=dens>0.6?[1,1,1,2,2,3]:[1,1,2,2,3,4];
      let t=cur.mel;
      for(let i=0;i<n;i++){
        let s;
        if(R.m()<S.mel.leap*0.5) s=(R.m()<0.5?-1:1)*(3+Math.floor(R.m()*3));
        else s=[-2,-1,-1,1,1,2][Math.floor(R.m()*6)];
        idx=clamp(idx+s,0,pool.length-1);
        if(i===n-1){
          for(let k=0;k<=3;k++){
            if(idx+k<pool.length&&stab.indexOf(((pool[idx+k]%12)+12)%12)>=0){idx+=k;break;}
            if(idx-k>=0&&stab.indexOf(((pool[idx-k]%12)+12)%12)>=0){idx-=k;break;}
          }
        }
        const off=pool[idx], dE=durs[Math.floor(R.m()*6)], tt=sw(t), vel=0.16+R.m()*0.1, len=E*dE*0.92;
        const grace=R.m()<S.mel.orn&&pool.length>2;
        const gdir=R.m()<0.5?-1:1;
        if(want("mel")&&S.mel.lvl>0.001){
          const fn=INST[S.mel.inst]||INST.luth;
          if(grace&&(S.mel.inst==="luth"||S.mel.inst==="harpe"||S.mel.inst==="carillon")){
            const gi=clamp(idx+gdir,0,pool.length-1); fn(tt-0.07,freq(pool[gi]),vel*0.55,0.08,B.mel.in,0);
          }
          fn(tt,freq(off),vel,len,B.mel.in,(R.v()*2-1)*0.35);
          if(S.canon.lvl>0.001) canonNote(t,off,vel,len,iv);
        }
        rec(0,tt,off,len,vel);
        if(o.onNote) o.onNote(tt,off,"mel");
        lastOff.v=off;
        t+=E*dE;
      }
      const bars=Math.ceil((t-t0)/bar-1e-6);
      cur.mel=t0+bar*(bars+Math.round(R.m()*2*(1.6-1.5*dens)));
    }
    /* nappes */
    while(cur.pad<until){
      const t=cur.pad, sc=secOf(t), iv=ivOf(S,sc.key), n=iv.length;
      const d=(R.s()<0.35+0.4*(1-S.pad.motion))?0:Math.floor(R.s()*n);
      const len=S.pad.len*bar, vc=clamp(Math.round(S.pad.voices),2,4);
      if(want("pad")&&S.pad.lvl>0.001){
        const offs=[degOff(iv,d),degOff(iv,d+2),degOff(iv,d+4),degOff(iv,d+6)].slice(0,vc).map(x=>x+12);
        offs.forEach(off=>{padVoice(t,len,freq(off),S.pad.timbre); rec(2,t,off,len,0.3);});
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
    /* lieu */
    if(want("amb")){
      bands.forEach(b=>{
        while(b.cur<until){
          const v=Math.pow(R.a(),2)*0.5*b.lvl; b.g.gain.setTargetAtTime(v,b.cur,0.35); b.cur+=0.5+R.a()*1.8;
        }
      });
      while(cur.clink<until){ clink(cur.clink); cur.clink+=(18+R.a()*30)/(0.25+S.amb.clink*1.5); }
      while(cur.fire<until){
        const t=cur.fire, big=R.a()<0.04, v=Math.pow(R.a(),2)*0.9*(big?1.8:1), fq=1500+R.a()*3500, d=0.01+R.a()*0.03;
        if(S.amb.feu>0.001){ if(big) noiseHit(t,v,900,0.07,"lowpass",fireG); else noiseHit(t,v,fq,d,"bandpass",fireG); }
        cur.fire=t+(-Math.log(1-R.a()*0.999)*0.18+0.02);
      }
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
    cur.drone=t+25+R.d()*20; cur.clink=t+10; cur.fire=t; cur.wind=t; cur.drip=t+4;
    bands.forEach(b=>b.cur=t);
  }
  function stop(now){ master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0,now,0.4); }
  return {start,schedule,setLevels,setReverb,stop,events,out,master,secAt:t=>secOf(t),bar,E,t0f:()=>t0};
}
