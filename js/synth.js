"use strict";
/* ============================================================
   ATELIER : un synthétiseur à part entière
   Deux oscillateurs à table d'ondes (avec unisson), un sous-oscillateur, du bruit, une modulation de fréquence,
   un filtre à enveloppe, trois enveloppes, deux LFO et une matrice de modulation à quatre emplacements.
   ============================================================ */
const SYN_WAVES=["Sinus","Triangle","Dent de scie","Carré","Impulsion étroite","Orgue","Voyelle"];
const SYN_SRC=[["none","Aucune"],["lfo1","LFO 1"],["lfo2","LFO 2"],["env2","Enveloppe 2"],["vel","Vélocité"]];
const SYN_DST=[["pitch","Hauteur"],["cutoff","Coupure du filtre"],["reso","Résonance"],["amp","Volume (trémolo)"],["pan","Panoramique"],["fm","Quantité de FM"],["detuneb","Désaccord de B"]];

const SYN_DEFAULT={
  oscA:{wave:0.34, oct:0, semi:0, det:0, lvl:0.8, uni:3, spread:14, width:0.6},
  oscB:{wave:0.5, oct:0, semi:0, det:6, lvl:0, uni:1},
  sub:{lvl:0, shape:"sine"},
  noise:{lvl:0},
  fm:{amt:0, ratio:2},
  fil:{type:"lowpass", cut:1800, res:0.9, key:0.5, env:1200},
  envA:{a:0.35, d:0.8, s:0.75, r:1.2},
  envF:{a:0.4, d:0.9, s:0.4, r:1.2},
  env2:{a:0.2, d:1, s:0.5, r:1},
  lfo1:{shape:"sine", rate:0.3},
  lfo2:{shape:"triangle", rate:5},
  mod:[{src:"lfo1",dst:"cutoff",amt:0.25},{src:"lfo2",dst:"pitch",amt:0.02},{src:"none",dst:"amp",amt:0},{src:"vel",dst:"cutoff",amt:0.3}],
  vel:{amt:0.6},
  fx:{drive:0, level:0.8}
};

/* ---- tables d'ondes : chaque position entre deux formes est une interpolation de leurs harmoniques ---- */
const SYN_N=48;
function synHarm(kind){
  const re=new Float32Array(SYN_N+1), im=new Float32Array(SYN_N+1);
  for(let k=1;k<=SYN_N;k++){
    if(kind===0) im[k]=k===1?1:0;
    else if(kind===1) im[k]=(k%2)?((k%4===1?1:-1)*8/(Math.PI*Math.PI*k*k)):0;
    else if(kind===2) im[k]=(2/Math.PI)*((k%2)?1:-1)/k*-1;
    else if(kind===3) im[k]=(k%2)?4/(Math.PI*k):0;
    else if(kind===4) im[k]=2/(Math.PI*k)*Math.sin(Math.PI*k*0.2);
    else if(kind===5) im[k]=[0,1,0.7,0.5,0.4,0,0.25,0,0.18][k]||0;
    else im[k]=(Math.exp(-Math.pow((k-5)/1.6,2))*0.9+Math.exp(-Math.pow((k-11)/2,2))*0.55+Math.exp(-Math.pow((k-17)/2.4,2))*0.3)+(k===1?0.5:0);
  }
  return [re,im];
}
const SYN_BASE=SYN_WAVES.map((_,i)=>synHarm(i));
const synWaveCache=new WeakMap();
function synWave(ctx,p){
  if(!ctx.createPeriodicWave) return null;
  let m=synWaveCache.get(ctx); if(!m){ m=new Map(); synWaveCache.set(ctx,m); }
  const k=Math.round(Math.max(0,Math.min(1,p))*72); if(m.has(k)) return m.get(k);
  const x=k/72*(SYN_BASE.length-1), i=Math.min(SYN_BASE.length-2,Math.floor(x)), f=x-i, re=new Float32Array(SYN_N+1), im=new Float32Array(SYN_N+1);
  for(let h=0;h<=SYN_N;h++){ im[h]=SYN_BASE[i][1][h]*(1-f)+SYN_BASE[i+1][1][h]*f; }
  const w=ctx.createPeriodicWave(re,im); m.set(k,w); return w;
}
const synDriveCurves={};
function synDrive(a){
  const k=Math.round(a*20); if(synDriveCurves[k]) return synDriveCurves[k];
  const n=512,c=new Float32Array(n),g=1+a*12; for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(g*x)/Math.tanh(g); } return synDriveCurves[k]=c;
}

/* valeur d'une enveloppe ADSR à l'instant tt (même formule que l'automation) : sert à partir du bon niveau au relâchement */
function synEnvAt(E,peak,tt){
  if(tt<=0) return 0;
  if(tt<E.a) return peak*(tt/Math.max(0.0005,E.a));
  const sus=peak*E.s; return sus+(peak-sus)*Math.exp(-(tt-E.a)/(Math.max(0.01,E.d)/3));
}
function synGate(param,t,E,peak,base){
  param.setValueAtTime(base,t); param.linearRampToValueAtTime(base+peak,t+Math.max(0.0005,E.a));
  param.setTargetAtTime(base+peak*E.s,t+Math.max(0.0005,E.a),Math.max(0.01,E.d)/3);
}
function synRelease(param,t,tr,E,peak,base){
  const v=base+synEnvAt(E,peak,tr-t);
  param.cancelScheduledValues(tr); param.setValueAtTime(v,tr); param.setTargetAtTime(base,tr,Math.max(0.01,E.r)/3);
}

/* une voix : renvoie {release(tr)} ; dur=null pour une note tenue, relâchée plus tard */
function synthVoice(ctx,P,o){
  const t=o.t, f=o.f, vel=Math.max(0.02,Math.min(1,o.vel)), lite=!!o.lite, maxU=lite?3:7;
  const G=v=>{ const g=ctx.createGain(); g.gain.value=v; return g; };
  const srcs=[], oscs=[], detB=[];
  const ampPeak=(1-P.vel.amt)+P.vel.amt*vel;
  const fil=ctx.createBiquadFilter(); fil.type=P.fil.type; fil.Q.value=P.fil.res;
  fil.frequency.value=Math.max(20,Math.min(20000,P.fil.cut*Math.pow(f/261.63,P.fil.key)));
  const amp=G(0), trem=G(1), pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
  let tail=fil;
  if(P.fx.drive>0.02&&ctx.createWaveShaper){ const ws=ctx.createWaveShaper(); ws.curve=synDrive(P.fx.drive); ws.oversample="none"; tail.connect(ws); tail=ws; }
  tail.connect(amp); amp.connect(trem);
  if(pan){ pan.pan.value=o.pan||0; trem.connect(pan); pan.connect(o.dst); } else trem.connect(o.dst);
  /* oscillateurs avec unisson */
  const setWave=(os,p)=>{ const w=synWave(ctx,p); if(w) os.setPeriodicWave(w); else os.type=p<0.17?"sine":p<0.5?"triangle":p<0.83?"sawtooth":"square"; };
  const addOsc=(def,isB)=>{
    const n=Math.max(1,Math.min(maxU,Math.round(def.uni||1))), out=[];
    for(let u=0;u<n;u++){
      const os=ctx.createOscillator(); setWave(os,def.wave); os.frequency.value=f*Math.pow(2,(def.oct||0)+(def.semi||0)/12);
      const sp=n>1?(u/(n-1)*2-1):0; os.detune.value=(def.det||0)+sp*(def.spread||0);
      const g=G((def.lvl||0)/Math.sqrt(n));
      os.connect(g);
      if(n>1&&ctx.createStereoPanner){ const pn=ctx.createStereoPanner(); pn.pan.value=sp*(def.width===undefined?0.6:def.width); g.connect(pn); pn.connect(fil); } else g.connect(fil);
      os.start(t+u*0.0011); srcs.push(os); oscs.push(os); out.push(os); if(isB) detB.push(os);
    }
    return out;
  };
  const aOscs=addOsc(P.oscA,false);
  let fmGain=null;
  if(P.fm.amt>0.001){
    const mo=ctx.createOscillator(); mo.type="sine"; mo.frequency.value=f*(P.fm.ratio||1)*Math.pow(2,(P.oscB.oct||0));
    fmGain=G(P.fm.amt*f*3); mo.connect(fmGain); aOscs.forEach(a=>fmGain.connect(a.frequency)); mo.start(t); srcs.push(mo);
  }
  if(P.oscB.lvl>0.001) addOsc(P.oscB,true);
  if(P.sub.lvl>0.001){ const so=ctx.createOscillator(); so.type=P.sub.shape==="square"?"square":"sine"; so.frequency.value=f/2; const sg=G(P.sub.lvl*(P.sub.shape==="square"?0.5:0.8)); so.connect(sg); sg.connect(fil); so.start(t); srcs.push(so); }
  if(P.noise.lvl>0.001&&o.noise){ const ns=ctx.createBufferSource(); ns.buffer=o.noise; ns.loop=true; const ng=G(P.noise.lvl*0.6); ns.connect(ng); ng.connect(fil); ns.start(t,Math.random()*1.5); srcs.push(ns); }
  /* enveloppes : volume, filtre (en centièmes de ton) et enveloppe 2 pour la matrice */
  const lvl=0.34*(P.fx.level===undefined?0.8:P.fx.level)/0.8, ampE=P.envA;
  synGate(amp.gain,t,ampE,lvl*ampPeak,0);
  synGate(fil.detune,t,P.envF,P.fil.env,0);
  let e2c=null, e2g=null;
  const needEnv2=P.mod.some(m=>m.src==="env2"&&m.dst!=="none"&&Math.abs(m.amt)>0.001);
  if(needEnv2&&ctx.createConstantSource){ e2c=ctx.createConstantSource(); e2c.offset.value=1; e2g=G(0); e2c.connect(e2g); e2c.start(t); srcs.push(e2c); synGate(e2g.gain,t,P.env2,1,0); }
  /* LFO et matrice : chaque emplacement relie une source à un paramètre de la voix */
  const lfos={};
  const lfo=(k)=>{ if(lfos[k]) return lfos[k]; const d=P[k], os=ctx.createOscillator(); os.type=d.shape; os.frequency.value=d.rate; os.start(t); srcs.push(os); return lfos[k]=os; };
  const velSrc=()=>{ if(!ctx.createConstantSource) return null; const c=ctx.createConstantSource(); c.offset.value=vel; c.start(t); srcs.push(c); return c; };
  const DST={
    pitch:{params:()=>oscs.map(x=>x.detune),scale:1200}, cutoff:{params:()=>[fil.detune],scale:4800}, reso:{params:()=>[fil.Q],scale:12},
    amp:{params:()=>[trem.gain],scale:0.9}, pan:{params:()=>pan?[pan.pan]:[],scale:1}, fm:{params:()=>fmGain?[fmGain.gain]:[],scale:f*3}, detuneb:{params:()=>detB.map(x=>x.detune),scale:100}
  };
  P.mod.forEach(m=>{
    const amt=m.amt; if(m.src==="none"||!DST[m.dst]||Math.abs(amt)<0.001) return;
    const ps=DST[m.dst].params(); if(!ps.length) return;
    let src=null; if(m.src==="lfo1"||m.src==="lfo2") src=lfo(m.src); else if(m.src==="env2") src=e2g; else if(m.src==="vel") src=velSrc();
    if(!src) return;
    ps.forEach(pr=>{ const sg=G(amt*DST[m.dst].scale); src.connect(sg); sg.connect(pr); });
  });
  let released=false;
  function release(tr){
    if(released) return; released=true; tr=Math.max(tr,t+0.02);
    synRelease(amp.gain,t,tr,ampE,lvl*ampPeak,0);
    synRelease(fil.detune,t,tr,P.envF,P.fil.env,0);
    if(e2g) synRelease(e2g.gain,t,tr,P.env2,1,0);
    const end=tr+Math.max(0.05,ampE.r)*1.4+0.15;
    srcs.forEach(s=>{ try{ s.stop(end); }catch(e){} });
  }
  if(o.dur!==null&&o.dur!==undefined) release(t+o.dur);
  return {release,t};
}

/* ---- patches : une petite bibliothèque, et un tirage au sort musical ---- */
const SYN_PATCHES=[
  ["Pad doux",{}],
  ["Basse sub",{oscA:{wave:0.5,uni:1,spread:0,lvl:0.7},sub:{lvl:0.8,shape:"sine"},fil:{type:"lowpass",cut:420,res:1.2,key:0.3,env:2200},envA:{a:0.006,d:0.25,s:0.7,r:0.18},envF:{a:0.004,d:0.22,s:0.2,r:0.2},mod:[{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"vel",dst:"cutoff",amt:0.3}]}],
  ["Pincé synthé",{oscA:{wave:0.67,uni:2,spread:8},fil:{type:"lowpass",cut:900,res:1.5,key:0.6,env:4200},envA:{a:0.004,d:0.5,s:0,r:0.25},envF:{a:0.002,d:0.3,s:0.05,r:0.2},mod:[{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"vel",dst:"cutoff",amt:0.4}],fx:{drive:0.1,level:0.9}}],
  ["Cloche FM",{oscA:{wave:0,uni:1,spread:0},oscB:{lvl:0,wave:0,oct:0},fm:{amt:0.9,ratio:3.5},fil:{type:"lowpass",cut:9000,res:0.5,key:0.2,env:0},envA:{a:0.003,d:2.2,s:0,r:1.6},envF:{a:0.01,d:0.5,s:1,r:0.5},mod:[{src:"env2",dst:"fm",amt:0.6},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],env2:{a:0.002,d:1.4,s:0,r:0.6}}],
  ["Orgue",{oscA:{wave:0.83,uni:1,spread:0,lvl:0.8},oscB:{wave:0.83,oct:1,lvl:0.4,uni:1,det:3},fil:{type:"lowpass",cut:3200,res:0.5,key:0.4,env:0},envA:{a:0.02,d:0.2,s:0.9,r:0.15},mod:[{src:"lfo2",dst:"amp",amt:0.08},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"amp",amt:0}],lfo2:{shape:"sine",rate:5.5}}],
  ["Cuivre doux",{oscA:{wave:0.5,uni:2,spread:9},fil:{type:"lowpass",cut:520,res:1,key:0.7,env:2600},envA:{a:0.14,d:0.4,s:0.8,r:0.3},envF:{a:0.2,d:0.5,s:0.6,r:0.3},mod:[{src:"lfo2",dst:"pitch",amt:0.012},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo2:{shape:"sine",rate:5}}],
  ["Voyelle chantée",{oscA:{wave:1,uni:3,spread:10,lvl:1},fil:{type:"bandpass",cut:900,res:3.2,key:0.3,env:1400},fx:{drive:0,level:2.6},envA:{a:0.25,d:0.5,s:0.85,r:0.7},envF:{a:0.5,d:1.2,s:0.5,r:0.8},mod:[{src:"lfo1",dst:"cutoff",amt:0.35},{src:"lfo2",dst:"pitch",amt:0.01},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo1:{shape:"sine",rate:0.22},lfo2:{shape:"sine",rate:5}}],
  ["Souffle",{oscA:{lvl:0,uni:1},noise:{lvl:1},fil:{type:"bandpass",cut:1400,res:5,key:0.9,env:1800},fx:{drive:0,level:3.6},envA:{a:0.9,d:1,s:0.8,r:1.6},envF:{a:1.2,d:1.5,s:0.3,r:1.6},mod:[{src:"lfo1",dst:"cutoff",amt:0.3},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo1:{shape:"sine",rate:0.15}}],
  ["Lead brillant",{oscA:{wave:0.5,uni:3,spread:16,lvl:0.7},oscB:{wave:0.67,oct:0,lvl:0.5,uni:2,det:7},fil:{type:"lowpass",cut:2600,res:2,key:0.6,env:2400},envA:{a:0.01,d:0.4,s:0.7,r:0.35},envF:{a:0.01,d:0.4,s:0.4,r:0.4},mod:[{src:"lfo2",dst:"pitch",amt:0.01},{src:"vel",dst:"cutoff",amt:0.3},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo2:{shape:"sine",rate:5.5},fx:{drive:0.25,level:0.5}}],
  ["Nappe de verre",{oscA:{wave:0,uni:5,spread:18,width:0.9,lvl:0.7},oscB:{wave:0.17,oct:1,lvl:0.3,uni:3,det:4},fil:{type:"lowpass",cut:5200,res:0.4,key:0.4,env:800},envA:{a:1.2,d:1.5,s:0.8,r:2.2},envF:{a:1.5,d:1.5,s:0.6,r:2},mod:[{src:"lfo1",dst:"detuneb",amt:0.3},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo1:{shape:"triangle",rate:0.12}}]
];
function synMerge(base,over){ const o=JSON.parse(JSON.stringify(base)); for(const k in over){ if(Array.isArray(over[k])) o[k]=over[k].map(x=>({...x})); else if(over[k]&&typeof over[k]==="object") o[k]={...(o[k]||{}),...over[k]}; else o[k]=over[k]; } return o; }
function synPatch(i){ return synMerge(SYN_DEFAULT,SYN_PATCHES[i][1]); }
/* tirage au sort : des valeurs musicales, pas n'importe lesquelles */
function synRandom(rnd){
  const r=(a,b)=>a+(b-a)*rnd(), pick=l=>l[Math.floor(rnd()*l.length)], P=synMerge(SYN_DEFAULT,{});
  P.oscA={wave:r(0,1),oct:pick([-1,0,0,0]),semi:0,det:0,lvl:r(0.5,0.9),uni:pick([1,2,3,5]),spread:r(4,24),width:r(0.3,0.9)};
  P.oscB={wave:r(0,1),oct:pick([-1,0,0,1]),semi:pick([0,0,7,12,-12]),det:r(-12,12),lvl:rnd()<0.6?r(0.15,0.6):0,uni:pick([1,2,3])};
  P.sub={lvl:rnd()<0.3?r(0.2,0.7):0,shape:pick(["sine","square"])}; P.noise={lvl:rnd()<0.25?r(0.05,0.4):0};
  P.fm={amt:rnd()<0.3?r(0.1,0.8):0,ratio:pick([1,2,3,3.5,5])};
  P.fil={type:pick(["lowpass","lowpass","lowpass","bandpass","highpass"]),cut:Math.exp(r(Math.log(300),Math.log(6000))),res:r(0.5,6),key:r(0,1),env:r(-1500,4000)};
  const slow=rnd()<0.5, env=()=>({a:slow?r(0.3,2):r(0.003,0.15),d:r(0.2,2),s:r(0.2,0.9),r:slow?r(0.8,3):r(0.1,0.8)});
  P.envA=env(); P.envA.s=Math.max(0.3,P.envA.s); P.envF=env(); P.env2=env();
  P.lfo1={shape:pick(["sine","triangle","sawtooth","square"]),rate:Math.exp(r(Math.log(0.08),Math.log(6)))}; P.lfo2={shape:pick(["sine","triangle"]),rate:Math.exp(r(Math.log(2),Math.log(9)))};
  P.mod=[0,1,2,3].map(()=>({src:pick(["lfo1","lfo2","env2","vel","none"]),dst:pick(["pitch","cutoff","cutoff","reso","amp","pan","fm","detuneb"]),amt:r(-0.4,0.5)}));
  P.mod.forEach(m=>{ if(m.dst==="pitch") m.amt=r(0,0.03); if(m.dst==="amp") m.amt=Math.abs(m.amt)*0.4; });
  P.vel={amt:r(0.2,0.8)}; P.fx={drive:rnd()<0.3?r(0.05,0.4):0,level:0.8};
  return P;
}
