"use strict";
/* ============================================================
   MOTEUR AUDIO
   ============================================================ */
function buildEngine(ctx, S, o){
  o = o||{};
  const seed=S.seed>>>0, sr=ctx.sampleRate;
  const R={m:mulberry32(seed), d:mulberry32(seed^0xA1B2C3), p:mulberry32(seed^0x51ED27), a:mulberry32(seed^0x7F4A7C),
           s:mulberry32(seed^0x3C6EF3), v:mulberry32(seed^0x2545F4), n:mulberry32(seed^0x85ebca6b), w:mulberry32(seed^0x1234567), l:mulberry32(seed^0x1F2E3D4B), t:mulberry32(seed^0x6D2B79F5), h:mulberry32(seed^0x3B9ACA07), c:mulberry32(seed^0xC4A1CE), k:mulberry32(seed^0x9A7C3), x:mulberry32(seed^0xD71F7), u:mulberry32(seed^0x7B0DE5)};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  /* notes du synthé perso : le moteur à tables (worklet) quand il est chargé, sinon les nœuds natifs ; on retient les destinations pour les éteindre */
  const synOwn=new Set(), synN=q=>{ synOwn.add(q.dst); q.seed=seed; return synthNote(ctx,S.syn,q); };
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
  /* dérives : des marches aléatoires lentes qui promènent filtre, réverb, densité, pan, tension et voile */
  const DR=[0,0,0,0], drifts=()=>S.drift||[];
  function driftStep(dt){ drifts().forEach((w,i)=>{ const u=R.x()*2-1, sp=0.12+0.9*(w.v||0); DR[i]=clamp((DR[i]||0)*(1-0.04*dt)+u*sp*dt*0.5,-1,1); }); }
  /* une dérive peut promener une seconde cible, dans le même sens ou à l'envers ("-cible") : les mouvements sont alors liés */
  const dv=k=>{ let a=0; drifts().forEach((w,i)=>{ const x=(DR[i]||0)*(w.d||0); if(w.t===k) a+=x; if(w.t2===k) a+=x; else if(w.t2==="-"+k) a-=x; }); return a; };
  function tensAt(t){
    let v=tens();
    if(curveOn()){
      const p=S.curve.pts, L=Math.max(30,S.curve.dur*60), x=(t-t0)/L, f=S.curve.mode==="loop"?((x%1)+1)%1:clamp(x,0,1), i=f*(p.length-1), a=Math.floor(i), b=Math.min(p.length-1,a+1);
      v=p[a]+(p[b]-p[a])*(i-a);
    }
    if(adaptOn()) v+=S.adapt.amount*(adaptE(t)-0.5)*0.9;
    v+=0.4*dv("tension")+arcAt(t);
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
  /* forme de la pièce : un plan d'intro, thème, développement, apogée, retombée, coda, avec ses transitions */
  const ARC=[{n:"intro",e:-0.35,sh:0},{n:"thème",e:0,sh:0},{n:"développement",e:0.12,sh:1},{n:"apogée",e:0.4,sh:-2},{n:"retombée",e:-0.15,sh:0},{n:"coda",e:-0.4,sh:0}];
  const pieceOn=()=>(S.mus&&S.mus.mode)==="piece", arcOn=()=>pieceOn()||(S.mus&&S.mus.arc)==="arche", secLen=()=>S.sectionBars*bar;
  const roleOf=i=>ARC[i%ARC.length];
  function arcAt(t){
    if(!arcOn()) return 0;
    const x=(t-t0)/secLen(), i=Math.max(0,Math.floor(x+1e-6)), f=Math.max(0,x-i), a=roleOf(i).e, b=roleOf(i+1).e, k=f<0.8?0:0.5-0.5*Math.cos(Math.PI*(f-0.8)/0.2);
    return a+(b-a)*k;
  }
  /* rituel ↔ chanson : 0 = rituel (bourdon, accords immobiles, modules libres), 1 = chanson (accords qui avancent, arpège, thème, bourdon en pédale) ;
     le plan de la pièce le fait respirer : l'intro et la coda tirent vers le rituel, le thème et l'apogée vers la chanson */
  const rcBase=()=>clamp(S.rc===undefined?0.5:S.rc,0,1);
  const rcAt=t=>clamp(rcBase()+(arcOn()?0.6*arcAt(t):0),0,1);
  const RCM={drone:x=>1.5-x, loops:x=>1.3-0.6*x, pend:x=>1.3-0.6*x, perc:x=>0.8+0.4*x, mel:x=>0.9+0.2*x, arp:x=>clamp((x-0.05)/0.45,0,1)};
  function rcApply(t,tc){ const x=rcAt(t); for(const k in RCM){ const g=B[k]&&B[k].rq&&B[k].rq.gain; if(!g) continue; if(tc&&g.setTargetAtTime) g.setTargetAtTime(RCM[k](x),t,tc); else g.value=RCM[k](x); } }
  /* transition : la dernière mesure (ou demi-mesure) avant une section plus énergique */
  function arcRise(t,span){ if(!arcOn()) return false; const L=secLen(), x=(t-t0)/L, i=Math.max(0,Math.floor(x+1e-6)), f=x-i; return f>=1-span/L-1e-6&&roleOf(i+1).e>roleOf(i).e+0.2; }
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
    const base=l[i%l.length], ar=arcOn()&&!(S.mus&&S.mus.color&&S.mus.color!=="off"), lx=LADDER.indexOf(base);
    return {i, key:colorKey(i)||(ar&&lx>=0?LADDER[clamp(lx+roleOf(i).sh,0,6)]:base), role:arcOn()?roleOf(i).n:""};
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
  out.connect(sat); const voixEQ=ctx.createBiquadFilter(); voixEQ.type="peaking"; voixEQ.frequency.value=1900; voixEQ.Q.value=0.8; voixEQ.gain.value=0; veil.connect(voixEQ); voixEQ.connect(master);
  const lWowIn=link(sat,wowD), lWowOut=link(wowD,veil), lWowBy=link(sat,veil);
  const volG=G(1); volG.connect(o.dest||ctx.destination); /* téléphone : la sortie passe par un lecteur audio (arrière-plan) */
  const sleepG=G(1); sleepG.connect(volG);
  /* normalisation : chaque ambiance a été mesurée hors ligne (sonie pondérée), son gain la ramène au niveau commun */
  const normG=G(1);
  /* limiteur : rattrape les crêtes, ce qui permet de monter le niveau perçu sans écrêter (pas sur les stems, laissés bruts) */
  if(o.noComp) normG.connect(sleepG);
  else{ const lim=ctx.createDynamicsCompressor(); lim.threshold.value=-2.5; lim.knee.value=0; lim.ratio.value=20; lim.attack.value=0.001; lim.release.value=0.12; normG.connect(lim); lim.connect(sleepG); }
  if(o.noComp){ master.connect(normG); }
  else{
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-20; comp.ratio.value=3; comp.attack.value=0.02; comp.release.value=0.4;
    master.connect(comp); comp.connect(normG);
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
  const revHP=ctx.createBiquadFilter(); revHP.type="highpass"; revHP.frequency.value=190; revHP.Q.value=0.6; revHP.connect(revIn);
  /* petite pièce pour la percussion : une queue courte et claire, au lieu de la grande réverbération qui brouille les frappes */
  const roomIR=(()=>{ const len=Math.floor(sr*0.7), ir=ctx.createBuffer(2,len,sr), rr=mulberry32((seed^0x2C1B3C6D)>>>0);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); let e=0; for(let i=0;i<len;i++){ const t=i/sr, v=(rr()*2-1)*Math.exp(-t*9.5)*(i<sr*0.004?i/(sr*0.004):1); d[i]=v; e+=v*v; } const n=1/Math.sqrt(e||1); for(let i=0;i<len;i++) d[i]*=n; }
    return ir; })();
  const room=ctx.createConvolver(); room.buffer=roomIR; const roomG=G(0.55); room.connect(roomG); roomG.connect(out);

  /* écho en ping-pong */
  const dIn=G(1), dl=ctx.createDelay(4), dr=ctx.createDelay(4), dfb=G(0.4), dtone=ctx.createBiquadFilter();
  dtone.type="lowpass"; dtone.frequency.value=3200;
  const lDly=link(dIn,dl); dl.connect(dtone); dtone.connect(dr); dr.connect(dfb); dfb.connect(dl);
  const dOut=G(0), pL=PAN(-0.7), pR=PAN(0.7);
  dl.connect(pL); dr.connect(pR); pL.connect(dOut); pR.connect(dOut); const lDout=link(dOut,out);

  /* bus */
  function bus(rev,dly,eq){
    const lvl=G(1), rq=G(1), br=G(1), dk=G(1), tm=G(1), gs=G(1), it=G(1), pn=PAN(0); lvl.connect(rq); rq.connect(br); br.connect(dk); dk.connect(tm); tm.connect(gs);
    /* égaliseur de la voix : un passe-haut pour laisser le grave au bourdon, une bosse ou un creux pour lui faire sa place */
    let head=gs, hp=null, pk=null;
    if(eq&&eq.hp){ hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=eq.hp; hp.Q.value=0.6; head.connect(hp); head=hp; }
    if(eq&&eq.pk){ pk=ctx.createBiquadFilter(); pk.type="peaking"; pk.frequency.value=eq.pk[0]; pk.gain.value=eq.pk[1]; pk.Q.value=eq.pk[2]||1; head.connect(pk); head=pk; }
    /* compression douce : la voix garde un niveau égal (le gain rattrape ce qu'elle perd) */
    if(eq&&eq.comp&&!o.lite){ const c=ctx.createDynamicsCompressor(), mk=G(Math.pow(10,eq.comp[2]/20)); c.threshold.value=eq.comp[0]; c.ratio.value=eq.comp[1]; c.knee.value=10; c.attack.value=0.012; c.release.value=0.25; head.connect(c); c.connect(mk); head=mk; }
    /* ensemble (chorus de machine à cordes) : trois lignes à retard, chacune balancée par un lent et un rapide LFO décalés d'un tiers de tour, à gauche, au centre, à droite */
    let ens=null;
    if(eq&&eq.ens){
      const dn=eq.mono?Math.SQRT1_2:1, dry=G(dn), wet=G(0), sum=G(1); head.connect(dry); dry.connect(sum); /* une voix mono passée en stéréo perd les 3 dB que le panoramique lui ôtait : on les retire ici */
      const ph=k=>{ const a=k*2*Math.PI/3, re=new Float32Array([0,Math.sin(a)]), im=new Float32Array([0,Math.cos(a)]); return ctx.createPeriodicWave(re,im,{disableNormalization:true}); };
      [-0.7,0,0.7].forEach((pv,k)=>{ const d=ctx.createDelay(0.05); d.delayTime.value=0.009+0.002*k;
        const s1=ctx.createOscillator(), g1=G(0.0024), s2=ctx.createOscillator(), g2=G(0.00035); s1.setPeriodicWave(ph(k)); s2.setPeriodicWave(ph(k)); s1.frequency.value=0.63; s2.frequency.value=5.9;
        s1.connect(g1); g1.connect(d.delayTime); s2.connect(g2); g2.connect(d.delayTime); starts.push(s1,s2);
        const pp=PAN(pv); head.connect(d); d.connect(pp); pp.connect(wet); });
      wet.connect(sum); head=sum; ens={set:on=>{ wet.gain.value=on?0.62:0; dry.gain.value=(on?0.55:1)*dn; }};
    }
    head.connect(it); it.connect(pn); pn.connect(out);
    const rs=G(rev); it.connect(rs); rs.connect(eq&&eq.room?room:revHP); if(eq&&eq.room){ const rl=G(eq.longRev||0); it.connect(rl); rl.connect(revHP); }
    if(dly){const ds=G(dly); it.connect(ds); ds.connect(dIn);}
    return {in:lvl, lvl, rq, br, dk, tm, gs, it, pn, hp, ens, eq:eq||{}};
  }
  /* le grave est au bourdon ; la mélodie a un peu de présence, les nappes un creux dans le bas-médium pour ne pas l'empâter, la percussion sa petite pièce */
  const B={drone:bus(0.45,0.1,{pk:[2600,-2,0.8],ens:true,mono:true}), mel:bus(0.9,1,{hp:140,pk:[2800,2,0.9],comp:[-26,2.5,3]}), pad:bus(0.8,0.6,{hp:170,pk:[380,-3,1],comp:[-30,2,2],ens:true}), perc:bus(0.4,0,{hp:30,room:true,longRev:0.06}),
    amb:bus(0.3,0,{hp:110}), loops:bus(0.9,0.8,{hp:190}), arp:bus(0.8,0.45,{hp:110}), plain:bus(0.95,0.2,{hp:80}), pend:bus(0.9,0.7,{hp:190}), bille:bus(0.85,0.6,{hp:180}), arbre:bus(0.95,0.45,{hp:120}), play:bus(0.85,0.9,{hp:60}), daw:bus(0.7,0.6,{hp:40})};
  /* une voix jouée à la basse garde son grave */
  function eqSync(){ const lo=(n,inst)=>{ const h=B[n].hp; if(h) h.frequency.value=inst?35:B[n].eq.hp; };
    lo("mel",S.mel.inst==="basse"||S.canon.inst==="basse"); lo("loops",S.loops.inst==="basse"); lo("pend",S.pend.inst==="basse"); lo("bille",S.bille&&S.bille.inst==="basse");
    if(B.pad.ens) B.pad.ens.set(S.pad.timbre==="machine"); if(B.drone.ens) B.drone.ens.set(S.drone.timbre==="machine"); }
  const canonG=G(0); const lCanon=link(canonG,B.mel.it);
  /* liens entre voix : chaque note de la mélodie ouvre le filtre des nappes, qui se referme ensuite */
  const padF=ctx.createBiquadFilter(); padF.type="lowpass"; padF.Q.value=0.9; padF.frequency.value=20000; padF.connect(B.pad.lvl); B.pad.in=padF;
  const melPad=()=>(S.link&&S.link.melPad)||0, padClosed=()=>melPad()<0.01?20000:2500*Math.pow(0.08,melPad());
  let padC=20000;
  function padOpen(t,len,vel){
    { const d=B.pad.dk.gain; d.setTargetAtTime(0.78,t,0.04); d.setTargetAtTime(1,t+Math.max(0.12,len*0.7),0.35); }
    if(melPad()<0.01) return;
    const c=padClosed(), f=padF.frequency;
    f.setTargetAtTime(Math.min(16000,c*Math.pow(2,4*Math.min(1,vel/0.24))),t,0.04); f.setTargetAtTime(c,t+Math.max(0.1,len*0.6),0.5);
  }
  function padRest(now){ const f=padF.frequency; if(f.cancelScheduledValues) f.cancelScheduledValues(now); padC=padClosed(); padF.Q.value=0.9+2*melPad(); if(started&&f.setTargetAtTime) f.setTargetAtTime(padC,now,0.25); else f.value=padC; }
  /* ---------- effets en worklet : réverbération vivante (modulée, scintillante) et nuage de grains ----------
     fxAttach() les branche dès que les processeurs sont chargés ; sans eux, la réverbération à convolution reste seule */
  const GR=()=>S.grain||{mix:0};
  let fx=null, built=false;
  const PLATE_G=3.59, HALL_G=3.56; /* niveaux alignés sur la réverbération vivante (mesuré) */
  const algoR=()=>!fx?"lieu":(S.fx.algo==="lieu"||S.fx.algo==="plaque"||S.fx.algo==="salle"?S.fx.algo:"vivante");
  const vivante=()=>algoR()!=="lieu";
  function fxAttach(){
    if(fx||!ctx.__fx||typeof AudioWorkletNode==="undefined") return !!fx;
    try{
      const mk=(name,opt)=>new AudioWorkletNode(ctx,name,Object.assign({numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:"explicit"},opt||{}));
      const vb=mk("bourdon-verb"), vbG=G(1); vb.connect(vbG); vbG.connect(wet);
      /* plaque et salle de Dattorro (la salle est la même cuve, plus grande) */
      const pl=mk("bourdon-plate",{processorOptions:{size:1}}), sa=mk("bourdon-plate",{processorOptions:{size:1.45}}), plG=G(1), saG=G(1); pl.connect(plG); plG.connect(wet); sa.connect(saG); saG.connect(wet);
      const gr=mk("bourdon-grain",{processorOptions:{seed:(seed^0x5EED6A)>>>0}}), grIn=G(1), grOut=G(0), grRev=G(0.6);
      grIn.connect(gr); gr.connect(grOut); grOut.connect(out); grOut.connect(grRev); grRev.connect(revIn);
      fx={vb,vbG,pl,sa,plG,saG,lPl:link(revIn,pl),lSa:link(revIn,sa),gr,grOut,frozen:false,lVb:link(revIn,vb),src:{mel:[link(B.mel.it,grIn)],pad:[link(B.pad.it,grIn)],cycles:[link(B.loops.it,grIn),link(B.pend.it,grIn)]}};
    }catch(e){ fx=null; return false; }
    if(built) setLevels();
    return true;
  }
  /* gel : la bande du nuage ne s'écrit plus, les grains relisent ce qu'elle contient */
  function grainFreeze(on){ if(!fx) return false; fx.frozen=!!on; const p=fx.gr.parameters.get("freeze"); if(p) p.value=on?1:0; return fx.frozen; }
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
  [["mel",B.mel.in],["canon",canonG],["pad",B.pad.in],["loops",B.loops.in],["pend",B.pend.in],["bille",B.bille.in],["arbre",B.arbre.in],["arp",B.arp.in],["plain",B.plain.in]].forEach(([n,d])=>{ V[n]={dst:d,node:null}; newGen(n); });
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
    { const pp=(DAW().mix||{}).pan||{}; ["drone","mel","pad","perc","loops","pend","bille","arbre","amb"].forEach(n=>{ const p=B[n].pn.pan; if(p) p.value=clamp(pp[n]||0,-1,1); }); }
    B.drone.lvl.gain.value=lv("drone",S.drone.lvl);
    B.mel.lvl.gain.value=lv("mel",S.mel.lvl);
    canonG.gain.value=lv("mel",S.canon.lvl);
    B.pad.lvl.gain.value=lv("pad",S.pad.lvl);
    B.perc.lvl.gain.value=lv("perc",S.perc.lvl);
    B.amb.lvl.gain.value=lv("amb",S.amb.lvl===undefined?1:S.amb.lvl);
    B.play.lvl.gain.value=S.play?S.play.lvl:0.8;
    volG.gain.value=S.vol===undefined?1:S.vol; voixEQ.gain.value=-6*clamp((S.fx&&S.fx.voix)||0,0,1); if(texSet) texSet(); normG.gain.value=Math.pow(10,clamp(S.norm||0,-12,12)/20);
    { const nt=natv(), wa=want("amb");
      NATS.forEach(k=>{ if(wa&&mach()&&(nt[k]||0)>0.001) ensureNature(k); });
      /* le lieu reste un fond : les sources continues (pluie, mer, ruisseau, nuit, feu) sont calées au niveau du murmure et du vent, 15 à 20 dB sous la musique */
      natG.pluie.gain.value=0.3; natG.mer.gain.value=(nt.mer||0)*0.3; natG.nuit.gain.value=(nt.nuit||0)*1.2; natG.ruisseau.gain.value=(nt.ruisseau||0)*0.55;
      if(natB.pluie){ const r=nt.pluie||0; natB.pluie.bg.gain.value=0.22*Math.pow(r,0.7); natB.pluie.ag.gain.value=0.28*r; natB.pluie.bg2.gain.value=0.5*r*r; }
      birdG.gain.value=(nt.oiseaux||0)*0.9; }
    if(!dynTens()){ /* curseur : valeur fixe ; courbe ou adaptation : le planificateur automatise ces gains */
      const m=tensMul((tens()-0.5)*2), now=ctx.currentTime||0;
      [["perc",m.perc],["pad",m.pad],["drone",m.drone],["amb",m.amb]].forEach(([n,v])=>{ const g=B[n].tm.gain; if(g.cancelScheduledValues) g.cancelScheduledValues(now); g.value=v; });
    }
    B.loops.lvl.gain.value=lv("loops",S.loops.lvl); B.arp.lvl.gain.value=lv("arp",(S.arp&&S.arp.lvl)||0); B.plain.lvl.gain.value=lv("plain",(S.plain&&S.plain.lvl)||0);
    B.pend.lvl.gain.value=lv("pend",S.pend.lvl); B.bille.lvl.gain.value=lv("bille",(S.bille&&S.bille.lvl)||0); B.arbre.lvl.gain.value=lv("arbre",(S.arbre&&S.arbre.lvl)||0);
    murG.gain.value=S.amb.murmur; fireG.gain.value=S.amb.feu*0.4; windG.gain.value=ventv()*0.9; dripG.gain.value=S.amb.gouttes*0.8;
    wet.gain.value=S.fx.rev*2;
    if(padC!==padClosed()) padRest(ctx.currentTime||0);
    if(fx){
      const rm=ROOMS[S.fx.room]||ROOMS.gen, T=clamp(S.fx.size,0.4,o.lite?5:9)/rm.dec, g=GR(), set=(nd,k,v)=>{ const p=nd.parameters.get(k); if(p) p.value=v; };
      const damp=clamp(0.12+0.75*S.fx.dark-0.3*(rm.br-1),0,1);
      set(fx.vb,"decay",T); set(fx.vb,"damp",damp); set(fx.vb,"mod",S.fx.mod===undefined?0.5:S.fx.mod); set(fx.vb,"shimmer",S.fx.shim||0); set(fx.vb,"pre",rm.pre);
      /* niveau : même énergie que la réponse à convolution (mesuré sur la réponse impulsionnelle du réseau) */
      fx.vbG.gain.value=1/Math.sqrt(0.5*Math.pow(T,0.43)*Math.pow((1-0.78*damp)/0.61,1.35));
      [fx.pl,fx.sa].forEach(nd=>{ set(nd,"decay",T); set(nd,"damp",damp); set(nd,"pre",rm.pre); });
      fx.plG.gain.value=PLATE_G*Math.pow(T,-0.5); fx.saG.gain.value=HALL_G*Math.pow(T,-0.5);
      set(fx.gr,"dens",g.dens===undefined?0.45:g.dens); set(fx.gr,"size",g.size===undefined?0.5:g.size); set(fx.gr,"spread",g.spread===undefined?0.4:g.spread); set(fx.gr,"pitch",g.pitch===undefined?0.3:g.pitch);
      fx.grOut.gain.value=(g.mix||0)*2.2;
    }
    dOut.gain.value=S.fx.dly; dfb.gain.value=Math.min(0.9,S.fx.fb);
    dl.delayTime.value=E*S.fx.dlyDiv; dr.delayTime.value=E*S.fx.dlyDiv*1.0;
    sat.curve=satCurve(S.fx.sat);
    rcApply(ctx.currentTime||0,0); eqSync(); dawSync(); rackSync(); if(typeof synPush==="function") synPush(ctx,S.syn);
    wowG1.gain.value=S.fx.wow*0.003; wowG2.gain.value=S.fx.wow*0.0003;
    veil.frequency.value=18000*Math.pow(2500/18000,S.fx.veil);
    hissG.gain.value=S.fx.hiss*0.03;
    applyLinks();
  }
  function applyLinks(){
    const wow=S.fx.wow>0.001, rev=S.fx.rev>0.001, dly=S.fx.dly>0.001;
    setLink(lWowIn,wow); setLink(lWowOut,wow); setLink(lWowBy,!wow);
    setLink(lHiss,S.fx.hiss>0.001);
    setLink(lRev,rev&&!vivante()); setLink(lDly,dly); setLink(lDout,dly);
    if(fx){ const al=algoR(); setLink(fx.lVb,rev&&al==="vivante"); setLink(fx.lPl,rev&&al==="plaque"); setLink(fx.lSa,rev&&al==="salle"); const g=GR(), on=(g.mix||0)>0.001, src=g.src||"mel"; for(const k in fx.src) fx.src[k].forEach(l=>setLink(l,on&&(k===src||src==="tout"))); }
    setLink(lCanon,S.canon.lvl>0.001);
    { const nt=natv(), wa=want("amb")&&mach(); NATS.forEach(k=>setLink(natL[k],wa&&(nt[k]||0)>0.001)); setLink(lBird,wa&&(nt.oiseaux||0)>0.001); setLink(lBeast,wa&&BEASTS.some(k=>(nt[k]||0)>0.001)); }
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
    else if(k==="nuit"){ const x=natSrc(genNight()); x.connect(out); /* les grillons chantent plus vite quand il fait chaud (loi de Dolbear) */ if(wxOn()&&S.wx.d&&S.wx.d.temp!==undefined) x.playbackRate.value=clamp(0.75+(S.wx.d.temp-12)/30,0.7,1.35); }
    else if(k==="ruisseau"){ const x=natSrc(genBrook()), f=bq("lowpass",5200,0.5); x.connect(f); f.connect(out); }
  }
  /* bêtes : grenouilles, hibou, loup, corbeaux, chevaux, mouettes ; chacune est un petit modèle (source, enveloppe, filtres), jouée comme les oiseaux, loin dans l'espace */
  const beastG=G(1), lBeast=link(beastG,B.amb.in), BEASTS=["grenouilles","hibou","loup","corbeaux","chevaux","mouettes"];
  const BEAST_T={grenouilles:4, hibou:16, loup:34, corbeaux:12, chevaux:28, mouettes:9};
  function beast(k,t,v){
    const pan=(R.t()*2-1)*0.85, a=0.35+0.65*v, O=(type,fr)=>{ const x=ctx.createOscillator(); x.type=type; x.frequency.value=fr; return x; }, fin=(n,lpf)=>{ const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=lpf; n.connect(lp); route(lp,pan,beastG); };
    if(k==="grenouilles"){ /* coassement : un train de 6 à 14 impulsions nasillardes, une ou deux fois */
      const f0=170+R.t()*170, rate=18+R.t()*14, n=6+Math.floor(R.t()*9), rep=R.t()<0.5?2:1, x=O("sawtooth",f0), bp=ctx.createBiquadFilter(), e=G(0); bp.type="bandpass"; bp.frequency.value=900+R.t()*500; bp.Q.value=3;
      x.connect(bp); bp.connect(e); fin(e,3000); let tt=t;
      for(let r=0;r<rep;r++){ for(let i=0;i<n;i++){ const p=tt+i/rate; e.gain.setValueAtTime(0,p); e.gain.linearRampToValueAtTime(a*0.9,p+0.004); e.gain.exponentialRampToValueAtTime(0.0005,p+0.7/rate); } tt+=n/rate+0.18; }
      x.start(t); x.stop(tt+0.1); return; }
    if(k==="hibou"){ /* « hou… hou-hou » : un sinus grave qui fléchit, souffle léger */
      const f0=330+R.t()*90, hoots=[[0,0.22],[0.55,0.18],[0.85,0.55]];
      hoots.forEach(([d,L])=>{ const x=O("sine",f0), e=G(0), tt=t+d; x.frequency.setValueAtTime(f0*1.04,tt); x.frequency.exponentialRampToValueAtTime(f0*0.93,tt+L); e.gain.setValueAtTime(0,tt); e.gain.linearRampToValueAtTime(a*0.35,tt+0.06); e.gain.setValueAtTime(a*0.35,tt+L-0.08); e.gain.linearRampToValueAtTime(0,tt+L); x.connect(e); fin(e,1200); x.start(tt); x.stop(tt+L+0.05); });
      return; }
    if(k==="loup"){ /* hurlement : monte, tient avec un vibrato, retombe ; parfois un second loup répond une tierce au-dessus */
      const one=(tt,f0,L)=>{ const x=O("sawtooth",f0), s=O("sine",f0), lp=ctx.createBiquadFilter(), e=G(0), vb=O("sine",5.2), vg=G(14); lp.type="lowpass"; lp.frequency.value=1300; x.connect(lp); lp.connect(e); const gs=G(0.6); s.connect(gs); gs.connect(e);
        [x,s].forEach(o=>{ o.frequency.setValueAtTime(f0,tt); o.frequency.exponentialRampToValueAtTime(f0*1.6,tt+L*0.3); o.frequency.setValueAtTime(f0*1.6,tt+L*0.7); o.frequency.exponentialRampToValueAtTime(f0*1.15,tt+L); vg.connect(o.detune); });
        vb.connect(vg); e.gain.setValueAtTime(0,tt); e.gain.linearRampToValueAtTime(a*0.22,tt+L*0.3); e.gain.setValueAtTime(a*0.22,tt+L*0.75); e.gain.linearRampToValueAtTime(0,tt+L); fin(e,2400); [x,s,vb].forEach(o=>{ o.start(tt); o.stop(tt+L+0.1); }); };
      const f0=330+R.t()*80, L=2.8+R.t()*1.8; one(t,f0,L); if(R.t()<0.45) one(t+0.8+R.t(),f0*1.19,L*0.85); return; }
    if(k==="corbeaux"){ /* croassements : deux à quatre « crâ » rauques */
      const n=2+Math.floor(R.t()*3), f0=500+R.t()*180;
      for(let i=0;i<n;i++){ const tt=t+i*(0.38+R.t()*0.12), x=O("sawtooth",f0), sh=ctx.createWaveShaper(); sh.curve=BASS_CURVE; const bp=ctx.createBiquadFilter(), pk=ctx.createBiquadFilter(), e=G(0);
        bp.type="bandpass"; bp.frequency.value=1250; bp.Q.value=1.6; pk.type="peaking"; pk.frequency.value=1700; pk.gain.value=8; pk.Q.value=2;
        x.frequency.setValueAtTime(f0*1.1,tt); x.frequency.exponentialRampToValueAtTime(f0*0.85,tt+0.26); x.connect(sh); sh.connect(bp); bp.connect(pk); pk.connect(e);
        e.gain.setValueAtTime(0,tt); e.gain.linearRampToValueAtTime(a*0.5,tt+0.02); e.gain.exponentialRampToValueAtTime(0.001,tt+0.28); fin(e,5000); x.start(tt); x.stop(tt+0.32); noiseHit(tt,a*0.12,2400,0.2,"bandpass",beastG,1.5); }
      return; }
    if(k==="chevaux"){ /* hennissement qui dégringole en tremblant, puis un ébrouement */
      const L=1.1+R.t()*0.5, x=O("sawtooth",1100), am=G(1), fl=O("sine",11+R.t()*4), fg=G(0.55), bp=ctx.createBiquadFilter(), e=G(0); bp.type="bandpass"; bp.frequency.value=1400; bp.Q.value=1.2;
      x.frequency.setValueAtTime(1150,t); x.frequency.exponentialRampToValueAtTime(480,t+L); fl.connect(fg); fg.connect(am.gain); x.connect(am); am.connect(bp); bp.connect(e);
      e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(a*0.4,t+0.08); e.gain.linearRampToValueAtTime(0,t+L); fin(e,4500); [x,fl].forEach(o=>{ o.start(t); o.stop(t+L+0.1); });
      noiseHit(t+L+0.25,a*0.5,500,0.35,"lowpass",beastG,0.7,0.03); return; }
    if(k==="mouettes"){ /* cris de mouette : « kiaou », glissés vers l'aigu puis retombés */
      const n=2+Math.floor(R.t()*4), f0=1350+R.t()*500;
      for(let i=0;i<n;i++){ const tt=t+i*(0.32+R.t()*0.2), L=0.26+R.t()*0.12, x=O("sawtooth",f0), lp=ctx.createBiquadFilter(), e=G(0); lp.type="lowpass"; lp.frequency.value=4200;
        x.frequency.setValueAtTime(f0,tt); x.frequency.exponentialRampToValueAtTime(f0*1.55,tt+L*0.35); x.frequency.exponentialRampToValueAtTime(f0*1.1,tt+L); x.connect(lp); lp.connect(e);
        e.gain.setValueAtTime(0,tt); e.gain.linearRampToValueAtTime(a*0.28,tt+0.03); e.gain.exponentialRampToValueAtTime(0.001,tt+L); fin(e,6000); x.start(tt); x.stop(tt+L+0.05); }
      return; }
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
  /* ---------- moteur de voix ----------
     source glottale : la dérivée d'une impulsion de Rosenberg (ouverture en cosinus, fermeture rapide), dont on tire la série de Fourier une fois pour toutes ;
     deux sources : tendue (fermeture brève, plus brillante) et soufflée (fermeture lente, plus sombre).
     Puis les cinq formants d'une voyelle, choisis selon la tessiture (basse, ténor, alto, soprano) ; le premier formant suit la note quand elle le dépasse, comme chez les sopranos. */
  const GLOT={};
  function glottal(kind){
    if(GLOT[kind]) return GLOT[kind];
    const N=2048, Tp=kind==="souffle"?0.5:0.42, Tn=kind==="souffle"?0.28:0.12, g=new Float32Array(N);
    for(let i=0;i<N;i++){ const x=i/N; g[i]=x<Tp?0.5*(1-Math.cos(Math.PI*x/Tp)):(x<Tp+Tn?Math.cos(Math.PI*(x-Tp)/(2*Tn)):0); }
    const d=new Float32Array(N); for(let i=0;i<N;i++) d[i]=g[(i+1)%N]-g[i];
    const K=72, re=new Float32Array(K+1), im=new Float32Array(K+1);
    for(let k=1;k<=K;k++){ let a=0,b=0; for(let i=0;i<N;i++){ const ph=2*Math.PI*k*i/N; a+=d[i]*Math.cos(ph); b+=d[i]*Math.sin(ph); } re[k]=a; im[k]=b; }
    return (GLOT[kind]=ctx.createPeriodicWave(re,im));
  }
  /* formants (Hz, dB, largeur) par tessiture et par voyelle */
  const FORM={
    basse:{i:[[250,0,60],[1750,-30,90],[2600,-16,100],[3050,-22,120],[3340,-28,120]], a:[[600,0,60],[1040,-7,70],[2250,-9,110],[2450,-9,120],[2750,-20,130]], o:[[400,0,40],[750,-11,80],[2400,-21,100],[2600,-20,120],[2900,-40,120]], u:[[350,0,40],[600,-20,80],[2400,-32,100],[2675,-28,120],[2950,-36,120]], e:[[400,0,60],[1620,-12,80],[2400,-9,100],[2800,-12,120],[3100,-18,120]]},
    tenor:{i:[[290,0,40],[1870,-15,90],[2800,-18,100],[3250,-20,120],[3540,-30,120]], a:[[650,0,80],[1080,-6,90],[2650,-7,120],[2900,-8,130],[3250,-22,140]], o:[[400,0,40],[800,-10,80],[2600,-12,100],[2800,-12,120],[3000,-26,120]], u:[[350,0,40],[600,-20,60],[2700,-17,100],[2900,-14,120],[3300,-26,120]], e:[[400,0,70],[1700,-14,80],[2600,-12,100],[3200,-14,120],[3580,-20,120]]},
    alto:{i:[[350,0,50],[1700,-20,100],[2700,-30,120],[3700,-36,150],[4950,-60,200]], a:[[800,0,80],[1150,-4,90],[2800,-20,120],[3500,-36,130],[4950,-60,140]], o:[[450,0,70],[800,-9,80],[2830,-16,100],[3500,-28,130],[4950,-55,135]], u:[[325,0,50],[700,-12,60],[2530,-30,170],[3500,-40,180],[4950,-64,200]], e:[[400,0,60],[1600,-24,80],[2700,-30,120],[3300,-35,150],[4950,-60,200]]},
    soprano:{i:[[270,0,60],[2140,-12,90],[2950,-26,100],[3900,-26,120],[4950,-44,120]], a:[[800,0,80],[1150,-6,90],[2900,-32,120],[3900,-20,130],[4950,-50,140]], o:[[450,0,70],[800,-11,80],[2830,-22,100],[3800,-22,130],[4950,-50,135]], u:[[325,0,50],[700,-16,60],[2700,-35,170],[3800,-40,180],[4950,-60,200]], e:[[350,0,60],[2000,-20,100],[2800,-15,120],[3600,-40,150],[4950,-56,200]]}
  };
  const tess=f=>f<165?"basse":f<260?"tenor":f<440?"alto":"soprano";
  /* banc de formants : src → 5 passe-bandes en parallèle → out ; la voyelle passe de v0 à v1 entre t1 et t2 */
  function formants(src,out,f,v0,v1,t,t1,t2,gain){
    const T=FORM[tess(f)], A=T[v0]||T.a, Bv=T[v1]||A;
    A.forEach(([F,db,bw],k)=>{
      const bp=ctx.createBiquadFilter(), g=G(0), F0=k===0?Math.max(F,f*1.08):F, F1=k===0?Math.max(Bv[k][0],f*1.08):Bv[k][0];
      bp.type="bandpass"; bp.Q.value=F0/bw; bp.frequency.setValueAtTime(F0,t); const a0=Math.pow(10,db/20)*gain, a1=Math.pow(10,Bv[k][1]/20)*gain;
      g.gain.setValueAtTime(a0,t);
      if(v1!==v0){ bp.frequency.setValueAtTime(F0,t1); bp.frequency.linearRampToValueAtTime(F1,t2); g.gain.setValueAtTime(a0,t1); g.gain.linearRampToValueAtTime(a1,t2); }
      src.connect(bp); bp.connect(g); g.connect(out);
    });
  }
  /* ---------- orgues ----------
     orgue à tuyaux : des jeux (pied, spectre du tuyau) additionnés en une seule onde ; bourdon (tuyau bouché, harmoniques impaires), principal, flûte.
     orgue à roues : neuf tirettes (16', 5⅓', 8', 4', 2⅔', 2', 1⅗', 1⅓', 1'), chaque cran vaut 3 dB ; l'onde est construite une octave sous la note (pour le 16'). */
  /* onde de cor : harmoniques en 1/k^1,6, les dix premières seulement */
  let HORNW=null; const hornWave=()=>HORNW||(HORNW=(()=>{ const K=10, re=new Float32Array(K+1), im=new Float32Array(K+1); for(let k=1;k<=K;k++) im[k]=Math.pow(k,-1.6); return ctx.createPeriodicWave(re,im); })());
  const ORGW={};
  function organWave(kind){
    if(ORGW[kind]) return ORGW[kind];
    const K=64, re=new Float32Array(K+1), im=new Float32Array(K+1), put=(k,a)=>{ if(k>=1&&k<=K) im[k]+=a; };
    const pipe={principal:[1,0.55,0.32,0.22,0.12,0.09,0.05,0.04], flute:[1,0.18,0.08,0.04], bourdon:[1,0,0.22,0,0.07,0,0.03]};
    const rank=(mult,sp,a)=>pipe[sp].forEach((x,i)=>put(Math.round(mult*(i+1)*2),x*a)); /* base une octave sous la note : pied 8' = harmonique 2 */
    if(kind==="positif"){ rank(1,"bourdon",1); rank(2,"principal",0.45); rank(4,"flute",0.25); }
    else if(kind==="plein"){ rank(1,"principal",1); rank(2,"principal",0.6); rank(4,"principal",0.4); rank(3,"flute",0.18); rank(6,"principal",0.15); rank(8,"principal",0.12); rank(0.5,"bourdon",0.35); }
    else if(kind==="roues"){ const db=[8,8,8,8,0,0,0,0,0], rat=[0.5,1.5,1,2,3,4,5,6,8]; db.forEach((d,i)=>{ if(d>0){ const a=Math.pow(10,-3*(8-d)/20), k=Math.round(rat[i]*2); put(k,a); put(k*3,a*0.015); } }); }
    return (ORGW[kind]=ctx.createPeriodicWave(re,im));
  }
  /* chuintement d'attaque du tuyau (« chiff ») et souffle du vent */
  const chiff=(t,f,vel,dst)=>noiseHit(t,vel*0.25,Math.min(7000,f*3),0.05,"bandpass",dst,2.5,0.008);
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
    else if(ty==="aulos"){ mk("sawtooth",1,-w*0.3,f,0.55); mk("triangle",1,w*0.3,f,0.4); f.frequency.value=base*1.1; droneFilters[droneFilters.length-1].base=base*1.1; }
    else if(ty==="machine"){ mk("sawtooth",1,0,f,0.75); mk("sawtooth",2,0,f,0.38); f.frequency.value=base*2.2; droneFilters[droneFilters.length-1].base=base*2.2; }
    else if(ty==="orgue"){ /* deux rangs de principal, l'un un rien plus haut : la voix céleste */
      [-1,1].forEach(sg=>{ const os=mk("sine",0.5,sg*w*0.4,f,0.69); os.setPeriodicWave(organWave("plein")); }); }
    else{
      /* chœur d'hommes sur un « o » qui respire vers le « a » : source glottale, cinq formants dont le premier se promène lentement */
      const T=FORM[tess(fr0)], vw=T.o, bank=G(1);
      vw.forEach(([F,db,bw],k)=>{ const bp=ctx.createBiquadFilter(), gg=G(Math.pow(10,db/20)*1.5); bp.type="bandpass"; bp.frequency.value=k===0?Math.max(F,fr0*1.08):F; bp.Q.value=F/bw; bank.connect(bp); bp.connect(gg); gg.connect(g);
        if(k<2){ const lf=ctx.createOscillator(); lf.frequency.value=0.05+R.d()*0.06; const lg=G((T.a[k][0]-F)*0.5); lf.connect(lg); lg.connect(bp.frequency); oscs.push(lf); } });
      const gD=G(0.12); bank.connect(gD); gD.connect(f);
      [-w,w].forEach(dt=>{
        const os=ctx.createOscillator(); os.setPeriodicWave(glottal("tendu")); os.frequency.value=fr0; os.detune.value=dt;
        os.connect(bank); oscs.push(os); srcs.push(os); gls.push({p:os.frequency,m:1});
      });
      const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const nh=ctx.createBiquadFilter(); nh.type="highpass"; nh.frequency.value=1500; const ng=G(0.02); ns.connect(nh); nh.connect(ng); ng.connect(bank); oscs.push(ns);
    }
    const lfo=ctx.createOscillator(); lfo.frequency.value=0.04+R.d()*0.08; const lg=G(2+S.drone.drift*14);
    lfo.connect(lg); srcs.forEach(os=>lg.connect(os.detune)); oscs.push(lfo);
    const lfo2=ctx.createOscillator(); lfo2.frequency.value=0.02+R.d()*0.05; const lg2=G(base*(0.12+0.35*S.drone.drift));
    lfo2.connect(lg2); lg2.connect(f.frequency); oscs.push(lfo2);
    oscs.forEach(x=>starts.push(x));
    if(isFifth) fifthGl=gls;
  }
  /* ---------- textures (dark ambient) : trois couches continues, chacune dans sa bande, qui bougent sur des minutes ----------
     grave : un grondement de bruit brun sous 90 Hz et deux sinus graves qui battent lentement (jamais dans la réverbération) ;
     texture : du bruit passé par des résonateurs très étroits accordés sur les harmoniques de la tonique, qui dérivent : la pierre ou le métal qui chante ;
     air : un souffle aigu dont la bande se promène lentement. */
  var texSet=null; /* var : setLevels() peut être appelé avant cette ligne */
  if(want("tex")){
    const T=()=>S.tex||{}, slow=(f0,amt,dst,base)=>{ const l=ctx.createOscillator(); l.frequency.value=f0; const g=G(amt); l.connect(g); g.connect(dst); starts.push(l); if(base!==undefined) dst.value=base; return l; };
    const subG=G(0), midG=G(0), airG=G(0), texOut=G(1); subG.connect(texOut); texOut.connect(B.drone.it);
    const tb=bus(0.9,0.15,{hp:60}); midG.connect(tb.in); airG.connect(tb.in);
    /* grave */
    { const ns=loopSrc(nb), lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=70; lp.Q.value=0.7; const am=G(0.6); ns.connect(lp); lp.connect(am); am.connect(subG); slow(0.011+0.02*((seed%997)/997),0.35,am.gain);
      const f0=freq(-12); [0,0.13].forEach((d,i)=>{ const x=ctx.createOscillator(); x.frequency.value=f0+d; const g=G(0.35); x.connect(g); g.connect(subG); starts.push(x); slow(0.017+0.01*i,0.2,g.gain); }); }
    /* texture : résonateurs sur les harmoniques 2, 3, 5 et 7 de la tonique */
    { const ns=loopSrc(wb), f0=freq(0); [[2,1],[3,0.8],[5,0.55],[7,0.35]].forEach(([h,a],i)=>{ const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.Q.value=45; bp.frequency.value=f0*h; const g=G(a*3.2);
      ns.connect(bp); bp.connect(g); g.connect(midG); slow(0.007+0.006*i,f0*h*0.025,bp.frequency); slow(0.013+0.009*i,a*1.6,g.gain); }); }
    /* air */
    { const ns=loopSrc(wb), hp=ctx.createBiquadFilter(), bp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=4500; bp.type="bandpass"; bp.Q.value=0.9; bp.frequency.value=8000; const g=G(0.12);
      ns.connect(hp); hp.connect(bp); bp.connect(g); g.connect(airG); slow(0.009,3000,bp.frequency); slow(0.021,0.05,g.gain); }
    texSet=()=>{ const t=T(), l=t.lvl===undefined?1:t.lvl; subG.gain.value=(t.sub||0)*l*0.35; midG.gain.value=(t.mid||0)*l*0.85; airG.gain.value=(t.air||0)*l*0.9; tb.lvl.gain.value=mach()?1:0; texOut.gain.value=mach()?1:0; };
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
  const bri=v=>clamp(v/0.2,0.3,1.8); /* 1 = nuance moyenne ; plus fort, plus de partiels aigus */
  const INST={
    luth(t,f,vel,len,dst,pan){
      const dur=2.8, o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator();
      o1.type="triangle"; o2.type="sawtooth"; o3.type="sine"; o1.frequency.value=f; o2.frequency.value=f; o2.detune.value=5; o3.frequency.value=f*2;
      const g2=G(0.18), g3=G(0.22), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.8;
      fl.frequency.setValueAtTime(clamp(900+10500*vel,1000,5200),t); fl.frequency.exponentialRampToValueAtTime(520,t+0.9+1.6*clamp(vel*4,0,1));
      const e=envD(t,vel,dur); o1.connect(fl); o2.connect(g2); g2.connect(fl); o3.connect(g3); g3.connect(fl); fl.connect(e); route(e,pan,dst);
      [o1,o2,o3].forEach(o=>{o.start(t); o.stop(t+dur+0.1);});
    },
    harpe(t,f,vel,len,dst,pan){
      const dur=4.2, o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator();
      o1.type="triangle"; o2.type="sine"; o3.type="sine"; o1.frequency.value=f; o2.frequency.value=f*2; o3.frequency.value=f*3;
      const g2=G(0.3), g3=G(0.12), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.6;
      fl.frequency.setValueAtTime(clamp(1800+17000*vel,2200,9000),t); fl.frequency.exponentialRampToValueAtTime(1400,t+1.8);
      const e=envD(t,vel*1.05,dur); o1.connect(fl); o2.connect(g2); g2.connect(fl); o3.connect(g3); g3.connect(fl); fl.connect(e); route(e,pan,dst);
      [o1,o2,o3].forEach(o=>{o.start(t); o.stop(t+dur+0.1);});
    },
    flute(t,f,vel,len,dst,pan){
      const L=Math.max(0.18,len), o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator();
      o1.type="sine"; o2.type="sine"; o3.type="sine"; o1.frequency.value=f; o2.frequency.value=f*2; o3.frequency.value=f*3;
      const g2=G(0.14*bri(vel)), g3=G(0.05*bri(vel)*bri(vel)), mix=G(1);
      o1.connect(mix); o2.connect(g2); g2.connect(mix); o3.connect(g3); g3.connect(mix);
      const vib=ctx.createOscillator(); vib.frequency.value=5.1; const vg=G(0); vib.connect(vg); [o1,o2,o3].forEach(o=>vg.connect(o.detune));
      vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(9,t+L*0.7);
      const br=ctx.createBufferSource(); br.buffer=wb; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=Math.min(9000,f*2.2*bri(vel)); bp.Q.value=1.4;
      const bg=G(vel*0.5); br.connect(bp); bp.connect(bg); bg.connect(mix);
      const e=envA(t,0.07,vel*1.0,0.16,L); mix.connect(e); route(e,pan,dst);
      br.start(t,R.v()*1.4); br.stop(t+L+0.3);
      [o1,o2,o3,vib].forEach(o=>{o.start(t); o.stop(t+L+0.3);});
    },
    carillon(t,f,vel,len,dst,pan){
      const sum=G(1);
      [[1,1,3.8],[2.76,0.45,2.2],[5.4,0.22,1.3],[8.93,0.1,0.7]].forEach(([m,a0,d])=>{
        const a=m>1?a0*Math.pow(bri(vel),1.5):a0; if(f*m>12000) return;
        const os=ctx.createOscillator(); os.type="sine"; os.frequency.value=f*m;
        const e=envD(t,vel*a*1.1,d); os.connect(e); e.connect(sum); os.start(t); os.stop(t+d+0.1);
      });
      route(sum,pan,dst);
    },
    bol(t,f,vel,len,dst,pan){
      const sum=G(1);
      [[1,1,7,-3],[1,0.8,7,3],[2.71,0.3,5,0],[5.15,0.1,3.4,0]].forEach(([m,a0,d,det])=>{
        const a=m>1?a0*Math.pow(bri(vel),1.5):a0; if(f*m>12000) return; const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m; x.detune.value=det;
        const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*a*0.9,t+0.012); e.gain.exponentialRampToValueAtTime(0.0001,t+d); x.connect(e); e.connect(sum); x.start(t); x.stop(t+d+0.1);
      });
      route(sum,pan,dst);
    },
    verre(t,f,vel,len,dst,pan){
      const sum=G(0.9), tr=ctx.createOscillator(), tg=G(0.1); tr.frequency.value=5.6; tr.connect(tg); tg.connect(sum.gain);
      [[1,1,5],[2.76,0.26,3.2],[5.4,0.09,2]].forEach(([m,a0,d])=>{
        const a=m>1?a0*Math.pow(bri(vel),1.5):a0; if(f*m>12000) return; const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m;
        const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*a*1.05,t+0.04); e.gain.exponentialRampToValueAtTime(0.0001,t+d); x.connect(e); e.connect(sum); x.start(t); x.stop(t+d+0.1);
      });
      tr.start(t); tr.stop(t+5.2); route(sum,pan,dst);
    },
    kalimba(t,f,vel,len,dst,pan){
      const sum=G(1);
      [[1,1,1.9],[2,0.18,0.9],[5.4,0.3,0.45]].forEach(([m,a0,d])=>{
        const a=m>1?a0*Math.pow(bri(vel),1.5):a0; if(f*m>12000) return; const x=ctx.createOscillator(); x.type="sine"; x.frequency.value=f*m; const e=envD(t,vel*a*1.2,d); x.connect(e); e.connect(sum); x.start(t); x.stop(t+d+0.1);
      });
      route(sum,pan,dst);
    },
    oud(t,f,vel,len,dst,pan){
      const dur=2.6, fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=1.2;
      fl.frequency.setValueAtTime(clamp(900+12500*vel,1100,6000),t); fl.frequency.exponentialRampToValueAtTime(420,t+1);
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
      const g2=G(0.12*bri(vel)); o1.connect(mix); o2.connect(g2); g2.connect(mix);
      const vib=ctx.createOscillator(); vib.frequency.value=4.7; const vg=G(0); vib.connect(vg); vg.connect(o1.detune); vg.connect(o2.detune);
      vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(14,t+L*0.8);
      const br=ctx.createBufferSource(); br.buffer=wb; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=Math.min(9000,f*2.4*bri(vel)); bp.Q.value=2;
      const bg=G(vel*0.75); br.connect(bp); bp.connect(bg); bg.connect(mix);
      const e=envA(t,0.12,vel,0.25,L); mix.connect(e); route(e,pan,dst);
      br.start(t,R.v()*1.4); br.stop(t+L+0.4); [o1,o2,vib].forEach(x=>{x.start(t); x.stop(t+L+0.4);});
    },
    synthe(t,f,vel,len,dst,pan){
      const L=Math.max(0.6,len), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.7;
      { const b=bri(vel); fl.frequency.setValueAtTime(900*b,t); fl.frequency.linearRampToValueAtTime(1500*b,t+L*0.4); fl.frequency.linearRampToValueAtTime(700*b,t+L+0.8); }
      const e=envA(t,0.25,vel*0.7,0.8,L); fl.connect(e); route(e,pan,dst);
      [-8,8].forEach(det=>{ const x=ctx.createOscillator(); x.type="sawtooth"; x.frequency.value=f; x.detune.value=det; x.connect(fl); x.start(t); x.stop(t+L+1); });
    },
    cuivre(t,f,vel,len,dst,pan){ /* cor : un cuivre sombre et rond (harmoniques qui tombent vite), le filtre ne s'ouvre qu'avec la nuance, attaque douce et prise par en dessous ; plus rien d'une trompette de clavier */
      const L=Math.max(0.25,len), v=Math.min(1,vel*4), fl=ctx.createBiquadFilter(), warm=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.5;
      fl.frequency.setValueAtTime(f*1.3,t); fl.frequency.linearRampToValueAtTime(Math.min(3200,f*(2.4+2.6*v)),t+0.12); fl.frequency.setTargetAtTime(Math.min(2400,f*(1.8+1.4*v)),t+0.14,0.4);
      warm.type="peaking"; warm.frequency.value=Math.min(900,f*2); warm.gain.value=3; warm.Q.value=0.9;
      const e=envA(t,0.09,vel*0.88,0.2,L); fl.connect(warm); warm.connect(e); route(e,pan,dst);
      const vib=ctx.createOscillator(); vib.frequency.value=5; const vg=G(0); vib.connect(vg); vg.gain.setValueAtTime(0,t+Math.min(0.4,L*0.4)); vg.gain.linearRampToValueAtTime(6,t+Math.min(1.2,L*0.8));
      [-3,3].forEach(d=>{ const x=ctx.createOscillator(); x.setPeriodicWave(hornWave()); x.frequency.setValueAtTime(f*0.985,t); x.frequency.exponentialRampToValueAtTime(f,t+0.08); x.detune.value=d; vg.connect(x.detune); x.connect(fl); x.start(t); x.stop(t+L+0.4); });
      vib.start(t); vib.stop(t+L+0.4);
    },
    archet(t,f,vel,len,dst,pan){
      const L=Math.max(0.3,len), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=0.8; fl.frequency.setValueAtTime(Math.min(1500,f*3)*bri(vel),t); fl.frequency.linearRampToValueAtTime(Math.min(3800,f*6+1200)*bri(vel),t+0.25);
      const e=envA(t,0.18,vel*0.8,0.3,L); fl.connect(e); route(e,pan,dst);
      const vib=ctx.createOscillator(); vib.frequency.value=5.2; const vg=G(0); vib.connect(vg); vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(9,t+Math.min(1.5,L*0.7));
      [-7,0,7].forEach(d=>{ const x=ctx.createOscillator(); x.type="sawtooth"; x.frequency.value=f; x.detune.value=d; vg.connect(x.detune); x.connect(fl); x.start(t); x.stop(t+L+0.5); });
      vib.start(t); vib.stop(t+L+0.5);
    },
    orgue(t,f,vel,len,dst,pan){ /* orgue positif : bourdon 8', principal 4', flûte 2' ; chuintement d'attaque */
      const L=Math.max(0.2,len), x=ctx.createOscillator(); x.setPeriodicWave(organWave("positif")); x.frequency.value=f/2;
      const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=Math.min(12000,f*(6+10*Math.min(1,vel*4))); lp.Q.value=0.5;
      const e=envA(t,0.035,vel*1.15,0.12,L); x.connect(lp); lp.connect(e); route(e,pan,dst); chiff(t,f,vel,dst);
      x.start(t); x.stop(t+L+0.3);
    },
    roues(t,f,vel,len,dst,pan){ /* orgue à roues : tirettes 88 8800 000, clic de touche, percussion sur la quinte de l'octave, cabine rotative lente */
      const L=Math.max(0.15,len), x=ctx.createOscillator(); x.setPeriodicWave(organWave("roues")); x.frequency.value=f/2;
      const e=envA(t,0.006,vel*1.48,0.03,L), am=G(1); x.connect(am); am.connect(e); route(e,pan,dst);
      const ls=ctx.createOscillator(), lg=G(0.22), lv=G(9); ls.frequency.value=0.82; ls.connect(lg); lg.connect(am.gain); ls.connect(lv); lv.connect(x.detune);
      const pc=ctx.createOscillator(), pg=G(0); pc.frequency.value=f*3; pg.gain.setValueAtTime(vel*0.5,t); pg.gain.exponentialRampToValueAtTime(0.0001,t+0.45); pc.connect(pg); pg.connect(e);
      noiseHit(t,vel*0.35,2500,0.006,"highpass",dst,0.7,0.0005);
      [x,ls,pc].forEach(o=>{ o.start(t); o.stop(t+L+0.1); });
    }
  };

  /* ---------- modèle physique : corde pincée (Karplus-Strong avec accord fin) ---------- */
  const pluckCache=new Map();
  function pluckBuf(f,vel,spec){
    const key=Math.round(f*20)+"|"+Math.round(vel*16)+"|"+spec.id;
    const hit=pluckCache.get(key); if(hit){ pluckCache.delete(key); pluckCache.set(key,hit); return hit; }
    const dur=Math.min(4.6,spec.t60*1.1), n=Math.floor(sr*dur), P=sr/f, Ld=P-0.5, L=Math.max(2,Math.floor(Ld)), F=Ld-L, c=(1-F)/(1+F);
    const line=new Float32Array(L), rnd=mulberry32((Math.floor(f*100)*2654435761)>>>0), out=new Float32Array(n);
    /* excitation : bruit adouci (plus vif quand la note est forte), avec un peigne qui place le point de pincement */
    let lp=0; const kx=clamp(0.12+0.9*vel*4*spec.bright,0.12,0.95);
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
  /* caisse de résonance : quelques bosses (fréquence, gain en dB, Q) propres à chaque instrument, entre la corde et la sortie */
  function body(src,peaks){ let h=src; peaks.forEach(([fq,gn,q])=>{ const b=ctx.createBiquadFilter(); b.type="peaking"; b.frequency.value=fq; b.gain.value=gn; b.Q.value=q; h.connect(b); h=b; }); return h; }
  const BODY={y:[[230,5,1.2],[720,3,1.5],[3100,3,2]], l:[[175,6,1.4],[410,3.5,1.5],[2600,-2,1]], h:[[240,3.5,1],[880,2.5,1.2]], o:[[135,7,1.3],[290,4,1.4],[1800,-2.5,1]]};
  /* bruits de jeu : glissement de doigt sur la corde, de temps en temps (déterministe : même rendu, même bruit) */
  const hz=x=>{ const v=Math.sin(x*12.9898)*43758.5453; return v-Math.floor(v); };
  function squeak(t,vel,dst){ const s=ctx.createBufferSource(); s.buffer=wb; const f=ctx.createBiquadFilter(); f.type="bandpass"; f.Q.value=4; f.frequency.setValueAtTime(1300,t-0.06); f.frequency.exponentialRampToValueAtTime(3200,t);
    const e=G(0); e.gain.setValueAtTime(0,t-0.07); e.gain.linearRampToValueAtTime(vel*0.06,t-0.03); e.gain.linearRampToValueAtTime(0,t+0.005); s.connect(f); f.connect(e); e.connect(dst); s.start(Math.max(0,t-0.08),hz(t)*1.5); s.stop(t+0.02); }
  function pluck(t,f,vel,dst,pan,spec,gain){
    const pb=pluckBuf(f,vel,spec), x=ctx.createBufferSource(); x.buffer=pb.buf;
    const e=G(vel*gain), bp=BODY[spec.id[0]]; (bp&&spec.id!=="g"?body(x,bp):x).connect(e);
    route(e,pan,dst); x.start(t); x.stop(t+pb.dur+0.05);
    if(spec.id!=="o2"&&t>0.1&&hz(t*7.13+f)<0.14) squeak(t,vel,dst);
  }
  const PHYS={
    luth(t,f,vel,len,dst,pan){ pluck(t,f,vel,dst,pan,{id:"l",t60:2.6,bright:0.55,pos:0.18},4.2); },
    harpe(t,f,vel,len,dst,pan){ pluck(t,f,vel*1.05,dst,pan,{id:"h",t60:4.2,bright:0.72,pos:0.25},3.6); },
    lyre(t,f,vel,len,dst,pan){ pluck(t,f,vel,dst,pan,{id:"y",t60:1.9,bright:0.95,pos:0.11},7.4); },
    oud(t,f,vel,len,dst,pan){ pluck(t,f,vel*0.62,dst,pan,{id:"o1",t60:3,bright:0.6,pos:0.12},6.2); pluck(t,f*1.0023,vel*0.55,dst,pan,{id:"o2",t60:3,bright:0.6,pos:0.12},6.2); noiseHit(t,vel*0.12,2600,0.03,"bandpass",dst); }
  };
  const wgCache=new Map();
  function wgBuf(kind,f,vel,dur,o2){
    dur=Math.min(4.2,Math.max(0.3,Math.round(dur*10)/10));
    const key=kind+"|"+Math.round(f*10)+"|"+dur+"|"+Math.round(vel*12), hit=wgCache.get(key);
    if(hit){ wgCache.delete(key); wgCache.set(key,hit); return hit; }
    const x=kind==="b"?physBowed(sr,f,vel,dur,o2):kind==="r"?physReed(sr,f,vel,dur,o2):physFlute(sr,f,vel,dur,o2), buf=ctx.createBuffer(1,x.length,sr); buf.getChannelData(0).set(x);
    const rec2={buf,dur}; wgCache.set(key,rec2); if(wgCache.size>40) wgCache.delete(wgCache.keys().next().value); return rec2;
  }
  function wgPlay(kind,t,f,vel,len,dst,pan,o2,gain,scoop){
    const w=wgBuf(kind,f,vel,len+0.2,o2), x=ctx.createBufferSource(); x.buffer=w.buf;
    if(scoop){ x.playbackRate.setValueAtTime(0.965,t); x.playbackRate.exponentialRampToValueAtTime(1,t+0.14); }
    const e=G(vel*gain), lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=0.5; lp.frequency.value=clamp(f*(2.5+14*vel),1200,14000); x.connect(lp); lp.connect(e); route(e,pan,dst); x.start(t); x.stop(t+w.dur+0.05);
  }
  PHYS.flute=(t,f,vel,len,dst,pan)=>wgPlay("f",t,f,vel,Math.max(0.2,len),dst,pan,{noise:0.12},1.2,false);
  PHYS.ney=(t,f,vel,len,dst,pan)=>wgPlay("f",t,f,vel,Math.max(0.25,len),dst,pan,{noise:0.24,att:0.12,pressure:0.97},1.15,true);
  /* aulos en modèle physique : l'anche et la colonne d'air, un peu de nasal (formant vers 1,2 kHz), prise par en dessous */
  PHYS.aulos=(t,f,vel,len,dst,pan)=>{ const pk=ctx.createBiquadFilter(); pk.type="peaking"; pk.frequency.value=1200; pk.gain.value=3; pk.Q.value=1.2; pk.connect(dst);
    wgPlay("r",t,f,vel,Math.max(0.2,len),pk,pan,{noise:0.25,att:0.04},0.84,true); noiseHit(t,vel*0.08,1600,Math.min(0.25,len),"bandpass",dst,1.2,0.02); };
  PHYS.syrinx=(t,f,vel,len,dst,pan)=>wgPlay("f",t,f,vel,Math.max(0.2,len),dst,pan,{noise:0.38,att:0.05,pressure:0.95},1.0,true); /* flûte de Pan : beaucoup de souffle, attaque vive */
  PHYS.archet=(t,f,vel,len,dst,pan)=>{ if(f>800) return INST.archet(t,f,vel,len,dst,pan); wgPlay("b",t,f,vel,Math.max(0.3,len),dst,pan,{},1.8,false); };
  /* ---------- piano droit de bastringue : partiels inharmoniques, deux cordes désaccordées par note, étouffoir au relâchement ---------- */
  const BASS_CURVE=(()=>{ const n=1024, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(1.8*x)/Math.tanh(1.8); } return c; })();
  const pianoCache=new Map();
  function pianoBuf(f,vel){
    const vq=Math.round(clamp(vel*4,0,1)*5), key=Math.round(f*20)+"|"+vq, hit=pianoCache.get(key);
    if(hit){ pianoCache.delete(key); pianoCache.set(key,hit); return hit; }
    const vv=vq/5, dur=clamp(1.4+1.8*(260/f),1.2,3.6), n=Math.floor(sr*dur), out=new Float32Array(n), Bi=0.0006, nyq=Math.min(sr*0.45,9500);
    const T=dur*0.55, bright=2.5+9*vv;
    [-11,11].forEach(cents=>{ /* honky-tonk : les deux cordes d'un même chœur battent l'une contre l'autre */
      const fs=f*Math.pow(2,cents/1200);
      for(let k=1;k<=18;k++){
        const fk=fs*k*Math.sqrt(1+Bi*k*k); if(fk>nyq) break;
        const a=Math.pow(k,-0.85)*Math.exp(-(k-1)/bright)*Math.abs(Math.sin(Math.PI*k*0.13))*0.5;
        const tau=T/(1+0.45*(k-1)), w=2*Math.PI*fk/sr, cw=Math.cos(w), sw=Math.sin(w);
        const d1=Math.exp(-1/(sr*tau*0.25)), d2=Math.exp(-1/(sr*tau));
        let re=0, im=1, e1=0.65*a, e2=0.35*a; /* double décroissance : attaque qui s'éteint vite, résonance qui traîne */
        for(let i=0;i<n;i++){ out[i]+=im*(e1+e2); const r2=re*cw-im*sw; im=re*sw+im*cw; re=r2; e1*=d1; e2*=d2; }
      }
    });
    /* le marteau : un petit choc sourd */
    let lp=0; const rnd=mulberry32((Math.floor(f*10)*2246822519)>>>0), hn=Math.floor(sr*0.012);
    for(let i=0;i<hn;i++){ lp+=((rnd()*2-1)-lp)*0.25; out[i]+=lp*0.35*(0.4+vv)*(1-i/hn); }
    let pk=0; for(let i=0;i<n;i++){ const a=out[i]<0?-out[i]:out[i]; if(a>pk) pk=a; }
    const nf=Math.floor(sr*0.04), sc=0.9/(pk||1); for(let i=0;i<n;i++){ let v=out[i]*sc; if(i>n-nf) v*=(n-i)/nf; out[i]=v; }
    const buf=ctx.createBuffer(1,n,sr); buf.getChannelData(0).set(out);
    const r={buf,dur}; pianoCache.set(key,r); if(pianoCache.size>48) pianoCache.delete(pianoCache.keys().next().value); return r;
  }
  INST.piano=(t,f,vel,len,dst,pan)=>{
    const pb=pianoBuf(f,vel), x=ctx.createBufferSource(); x.buffer=pb.buf; x.playbackRate.value=1;
    const e=G(0), off=t+Math.max(0.12,len)+0.02; e.gain.setValueAtTime(vel*4,t);
    if(off<t+pb.dur){ e.gain.setValueAtTime(vel*4,off); e.gain.setTargetAtTime(0,off,0.07); }
    x.connect(e); route(e,pan,dst); x.start(t); x.stop(Math.min(t+pb.dur,off+0.6)+0.05);
  };
  /* ---------- guitare : corde d'acier pincée près du chevalet, caisse de résonance en bois ---------- */
  INST.guitare=(t,f,vel,len,dst,pan)=>gtr(t,f,vel,dst,pan,0,true);
  /* une corde de guitare ; stopAt>0 : la main l'étouffe à cet instant (accompagnement gratté) */
  function gtr(t,f,vel,dst,pan,stopAt,noises){
    const pb=pluckBuf(f,vel,{id:"g",t60:3.4,bright:0.9,pos:0.09}), x=ctx.createBufferSource(); x.buffer=pb.buf;
    const b1=ctx.createBiquadFilter(), b2=ctx.createBiquadFilter(), hs=ctx.createBiquadFilter();
    b1.type="peaking"; b1.frequency.value=105; b1.gain.value=7; b1.Q.value=1.6;
    b2.type="peaking"; b2.frequency.value=230; b2.gain.value=4; b2.Q.value=1.4;
    hs.type="highshelf"; hs.frequency.value=3200; hs.gain.value=3;
    const e=G(vel*3.4); x.connect(b1); b1.connect(b2); b2.connect(hs); hs.connect(e); route(e,pan,dst);
    let end=t+pb.dur; if(stopAt&&stopAt<end){ e.gain.setValueAtTime(vel*3.4,stopAt); e.gain.setTargetAtTime(0,stopAt,0.03); end=stopAt+0.2; }
    x.start(t); x.stop(end+0.05);
    noiseHit(t,vel*0.1,4200,0.012,"bandpass",dst); /* le médiator */
    if(noises&&t>0.1&&hz(t*5.71+f)<0.16) squeak(t,vel,dst);
  }
  /* voix soliste : vocalise sur une voyelle qui glisse, prise par en dessous, vibrato qui s'installe, petites dérives de hauteur, souffle selon la nuance */
  const VOWS=["a","o","a","u","e","o"];
  INST.voix=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.2,len), soft=vel<0.17, x=ctx.createOscillator(), src=G(1), e=envA(t,soft?0.12:0.07,vel*1.6,0.28,L);
    x.setPeriodicWave(glottal(soft?"souffle":"tendu")); x.frequency.setValueAtTime(f*0.97,t); x.frequency.exponentialRampToValueAtTime(f,t+0.1); x.connect(src);
    const vb=ctx.createOscillator(), vg=G(0); vb.frequency.value=5.2+0.8*hz(f*1.7+t); vb.connect(vg); vg.connect(x.detune); vg.gain.setValueAtTime(0,t+Math.min(0.3,L*0.3)); vg.gain.linearRampToValueAtTime(22+14*hz(t*3.3),t+Math.min(1.1,L*0.9));
    const dr=ctx.createOscillator(), dg=G(5); dr.frequency.value=0.6+0.5*hz(t*7.1); dr.connect(dg); dg.connect(x.detune);
    const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=1200; const ng=G(soft?0.05:0.018); ns.connect(hp); hp.connect(ng); ng.connect(src);
    const i=Math.floor(hz(t*1.13+f*0.01)*VOWS.length), v0=VOWS[i], v1=VOWS[(i+1)%VOWS.length];
    formants(src,e,f,v0,v1,t,t+Math.min(0.3,L*0.3),t+L,2.4); route(e,pan,dst);
    [x,vb,dr].forEach(o=>{ o.start(t); o.stop(t+L+0.4); }); ns.start(t,hz(t)*1.5); ns.stop(t+L+0.4);
  };
  /* ---------- FM à la DX7 : un modulateur sinusoïdal fait varier la fréquence de la porteuse ; l'indice (la profondeur) décroît avec la note ---------- */
  function fmOp(t,f,ratio,index,decay,dst,sustain){ const m=ctx.createOscillator(), mg=G(0); m.frequency.value=f*ratio;
    mg.gain.setValueAtTime(index*f*ratio,t); mg.gain.setTargetAtTime(index*f*ratio*(sustain||0),t+0.002,decay); m.connect(mg); mg.connect(dst); return m; }
  /* piano électrique : porteuse 1:1 à indice qui retombe vite (le corps), plus une « lame » 1:14 très brève (le tintement de la frappe), deux voix un rien désaccordées */
  INST.fmpiano=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.12,len), v=Math.min(1,vel*4), e=G(0), off=t+L+0.02, dur=clamp(2.4*Math.pow(220/f,0.4),0.8,4);
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*1.24,t+0.003); e.gain.setTargetAtTime(0,t+0.01,dur/3);
    if(off<t+dur){ e.gain.setTargetAtTime(0,off,0.08); } route(e,pan,dst);
    const os=[]; [-4,4].forEach(dc=>{ const c=ctx.createOscillator(); c.frequency.value=f; c.detune.value=dc; c.connect(e); os.push(c,fmOp(t,f,1,0.6+1.6*v,0.25,c.frequency,0.15)); });
    const tn=ctx.createOscillator(), tg=G(0); tn.frequency.value=f; tg.gain.setValueAtTime(vel*0.35*v,t); tg.gain.setTargetAtTime(0,t,0.04); tn.connect(tg); tg.connect(e); os.push(tn,fmOp(t,f,14,2.5*v,0.02,tn.frequency,0));
    const end=Math.min(t+dur,off+0.5)+0.1; os.forEach(o=>{ o.start(t); o.stop(end); });
  };
  /* cloches FM : rapport 1:3,5 (inharmonique), indice qui s'éteint lentement, longue résonance */
  INST.fmcloche=(t,f,vel,len,dst,pan)=>{
    const v=Math.min(1,vel*4), dur=clamp(5*Math.pow(330/f,0.3),2,8), e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*1.02,t+0.002); e.gain.setTargetAtTime(0,t+0.005,dur/4); route(e,pan,dst);
    const c=ctx.createOscillator(), c2=ctx.createOscillator(), g2=G(0.25); c.frequency.value=f; c2.frequency.value=f*2.003; c.connect(e); c2.connect(g2); g2.connect(e);
    const m1=fmOp(t,f,3.5,1.2+2.5*v,dur/5,c.frequency,0.05), m2=fmOp(t,f,1.41,0.6*v,dur/8,c2.frequency,0);
    [c,c2,m1,m2].forEach(o=>{ o.start(t); o.stop(t+dur+0.1); });
  };
  /* ---------- Antiquité ----------
     aulos : la double flûte à anche des Grecs ; une anche nasillarde (scie et carré mêlés, formants vers 1,1 et 2,6 kHz), prise par en dessous, avec un souffle rauque.
     cornu : le cor romain, un cuivre poussé jusqu'à la saturation. hydraulis : l'orgue à eau, des tuyaux dont l'air tremble et bouillonne. */
  INST.aulos=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.12,len), a=ctx.createOscillator(), b=ctx.createOscillator(), gb=G(0.5), fl=ctx.createBiquadFilter(), f1=ctx.createBiquadFilter(), f2=ctx.createBiquadFilter();
    a.type="sawtooth"; b.type="square"; const sc=hz(t*1.7+f)<0.5?0.95:0.985; [a,b].forEach(o=>{ o.frequency.setValueAtTime(f*sc,t); o.frequency.exponentialRampToValueAtTime(f,t+0.08); }); b.detune.value=6;
    fl.type="lowpass"; fl.frequency.value=clamp(f*6+2500*Math.min(1,vel*4),1500,7000); fl.Q.value=0.7;
    f1.type="peaking"; f1.frequency.value=1100; f1.gain.value=7; f1.Q.value=1.6; f2.type="peaking"; f2.frequency.value=2600; f2.gain.value=5; f2.Q.value=2;
    const e=envA(t,0.025,vel*0.78,0.07,L), vb=ctx.createOscillator(), vg=G(0); vb.frequency.value=5.4; vb.connect(vg); vg.connect(a.detune); vg.connect(b.detune); vg.gain.setValueAtTime(0,t+0.2); vg.gain.linearRampToValueAtTime(10,t+Math.min(1,L));
    a.connect(fl); b.connect(gb); gb.connect(fl); fl.connect(f1); f1.connect(f2); f2.connect(e); route(e,pan,dst);
    noiseHit(t,vel*0.22,1800,Math.min(0.35,L),"bandpass",dst,1.4,0.02);
    [a,b,vb].forEach(o=>{ o.start(t); o.stop(t+L+0.15); });
  };
  INST.lyre=(t,f,vel,len,dst,pan)=>INST.harpe(t,f,vel,len*0.6,dst,pan); INST.syrinx=(t,f,vel,len,dst,pan)=>INST.ney(t,f,vel,len,dst,pan);
  INST.cornu=(t,f,vel,len,dst,pan)=>{ const sh=ctx.createWaveShaper(); sh.curve=BASS_CURVE; const g=G(0.6); sh.connect(g); g.connect(dst); INST.cuivre(t,f,vel*1.1,len,sh,pan); noiseHit(t,vel*0.15,900,0.05,"bandpass",dst,2); };
  INST.hydraulis=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.2,len), x=ctx.createOscillator(); x.setPeriodicWave(organWave("positif")); x.frequency.value=f/2;
    const e=envA(t,0.06,vel*0.95,0.15,L), am=G(1), tr=ctx.createOscillator(), tg=G(0.12); tr.frequency.value=4.5+2*hz(t+f); tr.connect(tg); tg.connect(am.gain);
    x.connect(am); am.connect(e); route(e,pan,dst); chiff(t,f,vel,dst);
    const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=320; bp.Q.value=3; const ng=G(vel*0.12); ns.connect(bp); bp.connect(ng); ng.connect(e); /* l'eau qui bouillonne */
    [x,tr].forEach(o=>{ o.start(t); o.stop(t+L+0.3); }); ns.start(t,hz(t)*1.5); ns.stop(t+L+0.3);
  };
  /* chant : la voix articule des syllabes d'un texte (latin ou grec), une syllabe par note. Les consonnes sont simples :
     occlusives (k, t, p, g, d, b) : un silence bref puis un petit bruit coloré ; s : un souffle aigu ; m, n, l : des formants nasaux ou latéraux qui glissent vers la voyelle ; r : un battement. */
  const TEXTS={kyrie:"ky ri e e le i son chri ste e le i son", alleluia:"al le lu i a al le lu i a", diesirae:"di es i rae di es il la sol vet sae clum in fa vil la",
    sanctus:"sanc tus sanc tus sanc tus do mi nus de us", agnus:"a gnus de i qui tol lis pec ca ta mun di", paian:"i e pai an i e pai an o pai an", gloria:"glo ri a in ex cel sis de o"};
  const VMAP={a:"a",e:"e",i:"i",y:"i",o:"o",u:"u"}, NAS={m:[[250,0,60],[1000,-14,120]], n:[[260,0,60],[1500,-14,120]], l:[[360,0,60],[1150,-8,100]], g:[[300,0,80],[1600,-10,120]]};
  let chantI=0;
  INST.chant=(t,f,vel,len,dst,pan)=>{ const words=(TEXTS[S.chant||"kyrie"]||TEXTS.kyrie).split(" "); singSyl(words[chantI++%words.length],t,f,vel,len,dst,pan); };
  function singSyl(syl,t,f,vel,len,dst,pan){
    const m=syl.match(/^([^aeiouy]*)([aeiouy]+)([^aeiouy]*)$/)||[syl,"","a",""];
    const on=m[1], vw=VMAP[m[2][m[2].length-1]]||"a", v0=VMAP[m[2][0]]||vw, coda=m[3], L=Math.max(0.25,len), soft=vel<0.17;
    let ts=t; const plo=/^(k|c|t|p|q|d|b|ch|qu)/.test(on);
    if(plo){ ts=t+0.035; const fq=/^(t|d)/.test(on)?4500:/^(p|b)/.test(on)?900:2600; noiseHit(ts-0.005,vel*0.5,fq,0.03,"bandpass",dst,1.5,0.002); }
    if(/s$|^s|sc/.test(on)) { noiseHit(t,vel*0.35,6000,0.09,"highpass",dst,0.7,0.02); ts=t+0.08; }
    const x=ctx.createOscillator(), src=G(1), e=envA(ts,soft?0.08:0.05,vel*1.6,0.25,Math.max(0.15,L-(ts-t)));
    x.setPeriodicWave(glottal(soft?"souffle":"tendu")); x.frequency.setValueAtTime(f*0.98,ts); x.frequency.exponentialRampToValueAtTime(f,ts+0.08); x.connect(src);
    const vb=ctx.createOscillator(), vg=G(0); vb.frequency.value=5.3; vb.connect(vg); vg.connect(x.detune); vg.gain.setValueAtTime(0,ts+Math.min(0.35,L*0.4)); vg.gain.linearRampToValueAtTime(16,ts+Math.min(1,L*0.9));
    const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=1200; const ng=G(soft?0.04:0.015); ns.connect(hp); hp.connect(ng); ng.connect(src);
    /* sonore initiale (m, n, l, gn) : on part de ses formants, la voyelle arrive en 70 ms */
    const son=on.slice(-1), nas=NAS[son]||(on==="gn"?NAS.n:null);
    if(nas&&!plo){ const T=FORM[tess(f)]; nas.forEach(([F,db,bw],k)=>{ const bp=ctx.createBiquadFilter(), g=G(0); bp.type="bandpass"; bp.Q.value=F/bw; bp.frequency.setValueAtTime(F,ts); bp.frequency.linearRampToValueAtTime((T[v0]||T.a)[k][0],ts+0.07);
      g.gain.setValueAtTime(Math.pow(10,db/20)*2.4,ts); g.gain.linearRampToValueAtTime(0,ts+0.08); src.connect(bp); bp.connect(g); g.connect(e); }); }
    formants(src,e,f,v0,vw,ts,ts+0.06,ts+Math.min(0.25,L*0.4),3.0);
    if(/r/.test(on)){ e.gain.setValueAtTime(vel*1.6,ts+0.06); e.gain.linearRampToValueAtTime(vel*0.5,ts+0.075); e.gain.linearRampToValueAtTime(vel*1.6,ts+0.09); }
    if(/[nm]$/.test(coda)){ /* finale nasale : la voyelle se ferme sur m ou n */ }
    if(/s$/.test(coda)) noiseHit(t+L-0.05,vel*0.3,6000,0.1,"highpass",dst,0.7,0.02);
    route(e,pan,dst); [x,vb].forEach(o=>{ o.start(ts); o.stop(t+L+0.4); }); ns.start(ts,hz(t)*1.5); ns.stop(t+L+0.4);
  }
  /* plain-chant : les vrais airs grégoriens, syllabe par syllabe (demi-tons au-dessus de la tonique) ; les phrases sont séparées par « | » et respirent */
  const TUNES={
    diesirae:{t:"di es i rae di es il la | sol vet sae clum in fa vil la | tes te da vid cum si byl la", n:[[3,2,3,0,2,-2,0,0],[3,3,5,3,2,0,2,0],[3,3,2,0,-2,0,2,0]]},
    kyrie:{t:"ky ri e e le i son | chri ste e le i son | ky ri e e le i son", n:[[0,2,3,5,3,2,0],[3,5,7,5,3,2],[5,3,2,0,2,0,0]]},
    alleluia:{t:"al le lu i a | al le lu i a", n:[[0,2,3,5,3],[5,7,5,3,2,0].slice(0,5)]},
    sanctus:{t:"sanc tus sanc tus sanc tus | do mi nus de us", n:[[0,2,3,3,2,0],[3,5,3,2,0]]},
    agnus:{t:"a gnus de i | qui tol lis pec ca ta mun di", n:[[0,3,2,0],[2,3,5,3,2,0,-2,0]]},
    gloria:{t:"glo ri a in ex cel sis de o", n:[[0,2,3,5,7,5,3,2,0]]},
    paian:{t:"i e pai an | i e pai an | o pai an", n:[[0,1,5,0],[5,7,5,0],[1,0,0]]}
  };
  function plainSeq(){ const T=TUNES[S.chant||"kyrie"]||TUNES.kyrie, ph=T.t.split(" | "); return ph.map((p,i)=>({syl:p.split(" "),n:T.n[i%T.n.length]})); }
  /* ---------- sifflet : presque un sinus, un léger souffle, un vibrato qui s'installe et une petite glissade d'attaque ---------- */
  INST.sifflet=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.15,len), x=ctx.createOscillator(), x2=ctx.createOscillator(), g2=G(0.06*bri(vel)), mix=G(1);
    x.type="sine"; x2.type="sine"; x.frequency.setValueAtTime(f*0.94,t); x.frequency.exponentialRampToValueAtTime(f,t+0.07); x2.frequency.setValueAtTime(f*1.88,t); x2.frequency.exponentialRampToValueAtTime(f*2,t+0.07);
    x.connect(mix); x2.connect(g2); g2.connect(mix);
    const vib=ctx.createOscillator(), vg=G(0); vib.frequency.value=5.6; vib.connect(vg); vg.connect(x.detune); vg.connect(x2.detune); vg.gain.setValueAtTime(0,t); vg.gain.setValueAtTime(0,t+Math.min(0.35,L*0.4)); vg.gain.linearRampToValueAtTime(18,t+Math.min(0.9,L*0.9));
    const e=envA(t,0.05,vel*0.9,0.12,L); mix.connect(e); route(e,pan,dst);
    noiseHit(t,vel*0.12,Math.min(9000,f*3),Math.min(0.4,L),"bandpass",dst,3,0.03);
    [x,x2,vib].forEach(o=>{ o.start(t); o.stop(t+L+0.2); });
  };
  /* ---------- harmonica : anche libre (onde carrée amincie), formant de la bouche, glissade par en dessous, trémolo de la main ---------- */
  INST.harmonica=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.12,len), a=ctx.createOscillator(), b=ctx.createOscillator(), gb=G(-0.85), fl=ctx.createBiquadFilter(), fm=ctx.createBiquadFilter(), fm2=ctx.createBiquadFilter();
    a.type="sawtooth"; b.type="sawtooth"; /* deux scies décalées : une impulsion étroite, nasillarde */
    const bend=hz(t*2.3+f)<0.35?0.94:0.985; a.frequency.setValueAtTime(f*bend,t); a.frequency.exponentialRampToValueAtTime(f,t+0.09); b.frequency.setValueAtTime(f*bend,t); b.frequency.exponentialRampToValueAtTime(f,t+0.09); b.detune.value=1;
    const d=ctx.createDelay(0.02); d.delayTime.value=0.3/f; a.connect(fl); b.connect(d); d.connect(gb); gb.connect(fl);
    fl.type="lowpass"; fl.Q.value=0.8; fl.frequency.setValueAtTime(clamp(f*3+2600*vel*4,900,6500),t);
    fm.type="peaking"; fm.frequency.value=1100; fm.gain.value=6; fm.Q.value=1.6; fm2.type="peaking"; fm2.frequency.value=2700; fm2.gain.value=4; fm2.Q.value=2;
    const e=envA(t,0.03,vel*0.7,0.08,L), tr=ctx.createOscillator(), tg=G(0); tr.frequency.value=6.2; tr.connect(tg); tg.connect(e.gain); tg.gain.setValueAtTime(0,t); tg.gain.linearRampToValueAtTime(vel*0.18,t+Math.min(0.8,L));
    fl.connect(fm); fm.connect(fm2); fm2.connect(e); route(e,pan,dst);
    noiseHit(t,vel*0.15,1600,Math.min(0.3,L),"bandpass",dst,1.2,0.02);
    [a,b,tr].forEach(o=>{ o.start(t); o.stop(t+L+0.15); });
  };
  /* ---------- basse : toujours ramenée dans le grave (40 à 160 Hz), scie et carré sous un filtre qui claque ---------- */
  INST.basse=(t,f,vel,len,dst,pan)=>{
    let fb=f; while(fb>160) fb/=2; while(fb<40) fb*=2;
    const L=Math.max(0.12,len), fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.Q.value=5;
    fl.frequency.setValueAtTime(clamp(fb*3+2600*vel*4,250,3200),t); fl.frequency.setTargetAtTime(fb*2.2,t+0.01,0.09);
    const sh=ctx.createWaveShaper(); sh.curve=BASS_CURVE; const e=envA(t,0.004,vel*1.5,0.07,L);
    fl.connect(sh); sh.connect(e); route(e,pan*0.3,dst);
    const a=ctx.createOscillator(), b=ctx.createOscillator(), gb=G(0.6); a.type="sawtooth"; b.type="square"; a.frequency.value=fb; b.frequency.value=fb; b.detune.value=-6;
    a.connect(fl); b.connect(gb); gb.connect(fl); [a,b].forEach(o=>{ o.start(t); o.stop(t+L+0.12); });
  };
  /* ---------- accordéon musette : trois anches (une juste, deux désaccordées), un soufflet qui respire ---------- */
  INST.accordeon=(t,f,vel,len,dst,pan)=>{
    const L=Math.max(0.15,len), fl=ctx.createBiquadFilter(), fm=ctx.createBiquadFilter();
    fl.type="lowpass"; fl.Q.value=0.7; fl.frequency.value=clamp(f*5+1500*bri(vel),1200,5500);
    fm.type="peaking"; fm.frequency.value=1250; fm.gain.value=5; fm.Q.value=1.3;
    const e=envA(t,0.035,vel*0.55,0.09,L), sw=ctx.createOscillator(), sg=G(vel*0.06); sw.frequency.value=0.9+((f*7.31+t*3.7)%1)*0.6; /* pas de tirage : les stems doivent rester alignés */ sw.connect(sg); sg.connect(e.gain);
    fl.connect(fm); fm.connect(e); route(e,pan,dst);
    [[-13,0.8],[0,1],[13,0.8]].forEach(([d,a])=>{ const x=ctx.createOscillator(), g=G(a); x.type="sawtooth"; x.frequency.value=f; x.detune.value=d; x.connect(g); g.connect(fl); x.start(t); x.stop(t+L+0.15); });
    sw.start(t); sw.stop(t+L+0.15);
  };
  /* ---------- synthèse modale : cloches, lames, verre, bols ----------
     chaque son est une somme de 20 à 30 modes (rapport de fréquence, amplitude, durée), calculée une fois par hauteur et par nuance.
     Plus on frappe fort, plus les modes aigus ressortent ; les modes aigus s'éteignent plus vite ; les bols ont des modes dédoublés qui battent. */
  const MODAL={
    carillon:{base:[[0.5,0.55,1.6],[1,1,1],[1.183,0.5,0.8],[1.506,0.35,0.6],[2,0.6,0.55],[2.514,0.3,0.35],[2.662,0.25,0.3],[3.011,0.2,0.25],[4.166,0.14,0.18],[5.433,0.1,0.13]], extra:{from:6.5,step:1.27,n:14,amp:0.07,p:1.3}, T:4.2, att:0.0015, strike:0.12},
    kalimba:{base:[[1,1,1],[1.003,0.25,0.9],[2.02,0.05,0.35],[5.93,0.32,0.16],[6.1,0.1,0.12],[16.6,0.07,0.05]], extra:{from:9,step:2.4,n:16,amp:0.025,p:1.6}, T:2.2, att:0.001, strike:0.05, click:0.5},
    verre:{base:[[1,1,1],[2.32,0.32,0.55],[4.25,0.14,0.35],[6.63,0.07,0.22],[9.38,0.04,0.15]], extra:{from:12,step:2.9,n:18,amp:0.018,p:1.2}, T:4.5, att:0.035, strike:0.2},
    bol:{base:[[1,1,1],[2.71,0.38,0.75],[5.15,0.16,0.5],[8.25,0.08,0.35],[11.8,0.045,0.25]], extra:{from:15.5,step:3.7,n:12,amp:0.02,p:1.1}, T:7.5, att:0.012, strike:0.1, split:0.0035}
  };
  const modalCache=new Map();
  function modalBuf(kind,f,vel){
    const M=MODAL[kind], vq=Math.round(clamp(vel*4,0,1)*5), key=kind+"|"+Math.round(f*20)+"|"+vq, hit=modalCache.get(key);
    if(hit){ modalCache.delete(key); modalCache.set(key,hit); return hit; }
    const vv=vq/5, modes=M.base.slice(), ex=M.extra, rr=mulberry32((Math.floor(f*37)^0x51F15E)>>>0);
    for(let i=0;i<ex.n;i++){ const r=ex.from+i*ex.step*(0.85+0.3*rr()); modes.push([r,ex.amp*Math.pow(ex.from/r,ex.p)*(0.6+0.8*rr()),Math.pow(ex.from/r,0.8)*0.12]); }
    const T=M.T*clamp(Math.pow(330/f,0.35),0.5,1.6), dur=Math.min(9,T*1.25), n=Math.floor(sr*dur), out=new Float32Array(n), nyq=Math.min(sr*0.45,15000);
    const bright=0.6+3.2*vv; /* nuance : plus fort, plus de modes aigus */
    const pairs=[]; modes.forEach(([r,a,d])=>{ if(M.split){ pairs.push([r*(1-M.split),a*0.55,d],[r*(1+M.split),a*0.5,d]); } else pairs.push([r,a,d]); });
    pairs.forEach(([r,a0,d],j)=>{
      const fk=f*r; if(fk>nyq||fk<20) return;
      const a=a0*Math.exp(-Math.max(0,r-1)/(bright*3))*Math.abs(Math.sin(Math.PI*(j+1)*M.strike+0.6)), tau=T*d/3, w=2*Math.PI*fk/sr, cw=Math.cos(w), sw=Math.sin(w), dk=Math.exp(-1/(sr*Math.max(0.01,tau)));
      const na=Math.max(1,Math.floor(M.att*sr*(r>1.5?0.6:1)));
      let re=Math.cos(rr()*6.28), im=Math.sin(rr()*6.28), e=a;
      for(let i=0;i<n;i++){ const g=i<na?i/na:1; out[i]+=im*e*g; const r2=re*cw-im*sw; im=re*sw+im*cw; re=r2; e*=dk; if(e<1e-5) break; }
    });
    if(M.click){ let lp=0; const cn=Math.floor(sr*0.006); for(let i=0;i<cn;i++){ lp+=((rr()*2-1)-lp)*0.5; out[i]+=lp*M.click*(0.3+vv)*(1-i/cn); } }
    let pk=0; for(let i=0;i<n;i++){ const v=out[i]<0?-out[i]:out[i]; if(v>pk) pk=v; }
    const nf=Math.floor(sr*0.05), sc=0.9/(pk||1); for(let i=0;i<n;i++){ let v=out[i]*sc; if(i>n-nf) v*=(n-i)/nf; out[i]=v; }
    const buf=ctx.createBuffer(1,n,sr); buf.getChannelData(0).set(out);
    const rec2={buf,dur}; modalCache.set(key,rec2); if(modalCache.size>64) modalCache.delete(modalCache.keys().next().value); return rec2;
  }
  function modalPlay(kind,t,f,vel,dst,pan,gain){
    const mb=modalBuf(kind,f,vel), x=ctx.createBufferSource(); x.buffer=mb.buf; const e=G(vel*gain); x.connect(e);
    if(kind==="verre"){ const tr=ctx.createOscillator(), tg=G(vel*gain*0.08); tr.frequency.value=5.6; tr.connect(tg); tg.connect(e.gain); tr.start(t); tr.stop(t+mb.dur); }
    route(e,pan,dst); x.start(t); x.stop(t+mb.dur+0.05);
  }
  PHYS.carillon=(t,f,vel,len,dst,pan)=>modalPlay("carillon",t,f,vel,dst,pan,1.25);
  PHYS.kalimba=(t,f,vel,len,dst,pan)=>{ modalPlay("kalimba",t,f,vel,dst,pan,1.35); };
  PHYS.verre=(t,f,vel,len,dst,pan)=>modalPlay("verre",t,f,vel,dst,pan,1.1);
  PHYS.bol=(t,f,vel,len,dst,pan)=>modalPlay("bol",t,f,vel,dst,pan,1.1);
  /* bruits de jeu des vents et de l'archet : le souffle qui s'échappe à la fin de la note, le crin qui accroche à l'attaque */
  { const fl=PHYS.flute, ny=PHYS.ney, ar=PHYS.archet;
    const breath=(t,f,vel,len,dst,q)=>noiseHit(t+Math.max(0.15,len),vel*q,Math.min(8000,f*2.6),0.16,"bandpass",dst,1.1,0.03);
    PHYS.flute=(t,f,vel,len,dst,pan)=>{ fl(t,f,vel,len,dst,pan); breath(t,f,vel,len,dst,0.35); };
    PHYS.ney=(t,f,vel,len,dst,pan)=>{ ny(t,f,vel,len,dst,pan); breath(t,f,vel,len,dst,0.55); };
    PHYS.archet=(t,f,vel,len,dst,pan)=>{ ar(t,f,vel,len,dst,pan); noiseHit(t,vel*0.18,Math.min(6000,f*4),0.07,"bandpass",dst,2.5,0.01); }; }
  /* touches et boutons : l'étouffoir du piano qui retombe, le bouton de l'accordéon et l'air du soufflet */
  { const pi=INST.piano, ac=INST.accordeon;
    INST.piano=(t,f,vel,len,dst,pan)=>{ pi(t,f,vel,len,dst,pan); noiseHit(t+Math.max(0.12,len)+0.02,vel*0.12,420,0.06,"lowpass",dst); };
    INST.accordeon=(t,f,vel,len,dst,pan)=>{ ac(t,f,vel,len,dst,pan); noiseHit(t,vel*0.12,3200,0.01,"bandpass",dst,2); noiseHit(t+Math.max(0.15,len),vel*0.08,900,0.12,"bandpass",dst,0.8,0.02); }; }
  const instRaw=(name,fb)=>(physOn()&&PHYS[name])||INST[name]||INST[fb||"luth"];
  /* porte passe-bas (à la manière d'une vactrol) : sur les sons pincés et frappés, le filtre se referme avec le son, plus vite quand la porte est réglée haut ; un son boisé, rond */
  const LPGI={lyre:1,luth:1,harpe:1,oud:1,guitare:1,kalimba:1,carillon:1,verre:1,bol:1,piano:1};
  const instOf=(name,fb)=>{ const fn=instRaw(name,fb), a=(S.mel&&S.mel.lpg)||0; if(a<0.01||!LPGI[name]) return fn;
    return (t,f,vel,len,dst,pan)=>{ const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=0.4; const v=Math.min(1,vel*4), c0=Math.min(16000,f*(3+26*v)), c1=Math.max(120,f*1.1), tau=0.05+0.6*(1-a);
      lp.frequency.setValueAtTime(c0,t); lp.frequency.setTargetAtTime(c1,t+0.004,tau); lp.connect(dst); fn(t,f,vel*(1+0.35*a),len,lp,pan); }; };

  /* ---------- synthé perso : l'Atelier comme instrument ---------- */
  INST.atelier=(t,f,vel,len,dst,pan)=>{ synN({t,f,vel,dur:Math.max(0.06,len),dst,pan,lite:o.lite,noise:wb}); };
  /* note tenue au clavier : on garde la poignée et on relâche plus tard */
  function synOn(off,vel,op){
    const t=ctx.currentTime+0.004, v=synN({t,f:freq(off),vel:vel||0.7,dur:null,dst:rackPlay.in,pan:0,lite:o.lite,noise:wb,fromF:op&&op.fromOff!==undefined?freq(op.fromOff):0,glide:op&&op.glide||0});
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
    if(tr.inst==="atelier"){ const h=synN({t,f,vel:v,dur:null,dst:st.vol,pan:0,lite:o.lite,noise:wb,fromF:op&&op.fromOff!==undefined?freq(op.fromOff):0,glide:op&&op.glide||0}); return {release:tt=>h.release(tt===undefined?ctx.currentTime:tt)}; }
    instOf(tr.inst,"luth")(t,f,v*0.4,E*3,st.vol,0); return {release:()=>{}};
  }
  /* une note à un instant précis (arpégiateur) */
  function dawNote(tr,off,vel,t,len){ const st=dawT(tr); instOf(tr.inst,"luth")(t,freq(off),vel,Math.max(0.05,len),st.vol,0); if(o.onNote) o.onNote(t,off,"play",len,vel); }
  const dawPos=tr=>{ const L=Math.max(1,tr.bars)*barE, x=(ctx.currentTime-t0)/E; return ((x%L)+L)%L; };

  /* ---------- nappes ---------- */
  function padVoice(t,len,f,timbre,vol){
    if(timbre==="grattee"){ /* chaque note de l'accord est une corde : coup vers le bas sur les temps, vers le haut sur la croche qui suit les temps pairs */
      const beat=E*(METERS[S.meter].d||2), ord=clamp(Math.log2(f/82),0,4), pan=((Math.round(f*3)%9)/4-1)*0.4, v0=0.075*(vol||1);
      for(let b=0,tb=t;tb<t+len-0.05;b++,tb+=beat){
        const dn=tb+ord*0.011, acc=b%2===0?1:0.75; gtr(dn,f,v0*acc,V.pad.node,pan,tb+beat-0.02,false);
        if(b%2===1&&tb+beat*0.5<t+len){ const up=tb+beat*0.5+(4-ord)*0.008; gtr(up,f,v0*0.5,V.pad.node,pan,tb+beat-0.02,false); }
      }
      return;
    }
    if(timbre==="atelier"){ synN({t,f,vel:0.55,dur:len,dst:V.pad.node,pan:0,lite:o.lite,noise:wb}); return; }
    const a=Math.min(3,len*0.45), rel=Math.min(3.5,len*0.8), e=G(0);
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(0.09*(vol||1),t+a); e.gain.setValueAtTime(0.09*(vol||1),t+len); e.gain.linearRampToValueAtTime(0,t+len+rel);
    route(e,((Math.round(f*3)%9)/4-1)*0.55,V.pad.node); /* nappes ouvertes : chaque hauteur a sa place dans l'espace */
    const end=t+len+rel+0.1, os=[];
    const add=(type,fr,det,dst,gain)=>{const x=ctx.createOscillator(); x.type=type; x.frequency.value=fr; x.detune.value=det; if(gain!==undefined){const g=G(gain); x.connect(g); g.connect(dst);} else if(dst) x.connect(dst); os.push(x); return x;};
    if(timbre==="phase"){ /* distorsion de phase façon CZ (onde « résonante ») : un sinus dont la fréquence est un multiple glissant de la note, fenêtré par une dent de scie qui s'éteint à chaque période ; le multiple monte et redescend au fil de la note, comme un formant qui balaie. Calculé note par note. */
      R.v(); const tot=len+rel+0.1, n=Math.floor(sr*Math.min(tot,40)), buf=ctx.createBuffer(1,n,sr), d=buf.getChannelData(0), h0=hz(f*0.37+t);
      const r0=1.6+1.4*h0, r1=4+5*hz(f+t*1.9), per=Math.max(4,len*0.7), lp0=Math.min(0.9,f*9/sr*6.28);
      let ph=0, ph2=0, y=0; for(let i=0;i<n;i++){ const tt=i/sr, sw=0.5-0.5*Math.cos(2*Math.PI*Math.min(1,tt/per)), r=r0+(r1-r0)*(sw<0.5?sw*2:2-sw*2)+0.3*Math.sin(tt*0.7+h0*6);
        ph+=f/sr; if(ph>=1){ ph-=1; ph2=0; } ph2+=r*f/sr; const x=(1-ph)*Math.sin(2*Math.PI*ph2); y+=(x-y)*lp0; d[i]=y*1.06; }
      const x=ctx.createBufferSource(); x.buffer=buf; x.connect(e); x.start(t); x.stop(t+tot);
      return;
    }
    if(timbre==="essaim"){ /* essaim : sept scies désaccordées qui dérivent chacune à leur rythme (façon Plaits), un filtre qui respire */
      const base=R.v(), N=o.lite?4:7, lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=0.8; lp.frequency.value=Math.min(6000,900+f*2.5); lp.connect(e);
      const lf=ctx.createOscillator(), lg=G(Math.min(2500,500+f*1.5)); lf.frequency.value=0.05+0.08*hz(base*9.1); lf.connect(lg); lg.connect(lp.frequency); os.push(lf);
      for(let i=0;i<N;i++){ const h=k=>hz(base*53.3+i*11.9+k*7.7), x=add("sawtooth",f,((i/(N-1))*2-1)*22,null), g=G(0.87/Math.sqrt(N)), pn=PAN(((i%2?1:-1)*(0.2+0.6*h(1))));
        x.connect(g); g.connect(pn); pn.connect(lp);
        const dr=ctx.createOscillator(), dg=G(4+6*h(2)); dr.frequency.value=0.07+0.25*h(3); dr.connect(dg); dg.connect(x.detune); os.push(dr); }
    }
    else if(timbre==="vecteur"){ /* nappe vectorielle : quatre timbres aux coins (chœur, verre, cordes, souffle) ; un point tourne lentement entre eux et chaque coin monte et descend à son tour */
      const base=R.v(), perR=14+16*hz(base*3.7), ph0=hz(base*5.3)*6.2832;
      const corner=(k,node)=>{ const g=G(0.87), lfo=ctx.createOscillator(), a=ph0+k*Math.PI/2, re=new Float32Array([0,Math.sin(a)]), im=new Float32Array([0,Math.cos(a)]);
        lfo.setPeriodicWave(ctx.createPeriodicWave(re,im,{disableNormalization:true})); lfo.frequency.value=1/perR; const lg=G(0.87); lfo.connect(lg); lg.connect(g.gain); os.push(lfo); node.connect(g); g.connect(e); };
      /* chœur : deux chanteurs, voyelle « o » */
      { const src=G(1), out3=G(1); { const x=add("sine",f,0,src,1); x.setPeriodicWave(glottal("souffle")); } formants(src,out3,f,"o","a",t,t+a,t+len,2.2); corner(0,out3); }
      /* verre : trois partiels purs */
      { const gv=G(1); [[1,0.7],[2.003,0.22],[3.01,0.09]].forEach(([m,a2])=>add("sine",f*m,0,gv,a2)); corner(1,gv); }
      /* cordes : deux scies désaccordées sous un passe-bas */
      { const lpc=ctx.createBiquadFilter(); lpc.type="lowpass"; lpc.frequency.value=Math.min(4500,1400+f*2); add("sawtooth",f,-9,lpc,0.4); add("sawtooth",f,9,lpc,0.4); corner(2,lpc); }
      /* souffle : du bruit passé par deux résonances accordées sur la note */
      { const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const gs=G(1); [[f,30,1.1]].forEach(([F,q,a2])=>{ const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=F; bp.Q.value=q; const g=G(a2*4); ns.connect(bp); bp.connect(g); g.connect(gs); }); os.push(ns); corner(3,gs); }
    }
    else if(timbre==="orgue"){ /* plein-jeu : principaux 8', 4', 2', nasard, fourniture, et un peu de bourdon 16' ; deux tuyaux un rien désaccordés ; chuintement et vent */
      [-2,2].forEach(dc=>{ const x=add("sine",f/2,dc,e,0.71); x.setPeriodicWave(organWave("plein")); });
      chiff(t,f,0.2,e); const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const nb=ctx.createBiquadFilter(); nb.type="bandpass"; nb.frequency.value=Math.min(5000,f*4); nb.Q.value=0.9; const ng=G(0.04); ns.connect(nb); nb.connect(ng); ng.connect(e); os.push(ns);
    }
    else if(timbre==="roues"){ /* orgue à roues, cabine rotative lente */
      const am=G(1); am.connect(e); const x=add("sine",f/2,0,am,1.25); x.setPeriodicWave(organWave("roues"));
      const ls=ctx.createOscillator(), lg=G(0.2), lv=G(8); ls.frequency.value=0.8+0.1*hz(f); ls.connect(lg); lg.connect(am.gain); ls.connect(lv); lv.connect(x.detune); os.push(ls);
    }
    else if(timbre==="machine"){ /* machine à cordes : registres 16', 8' et 4' accordés pile (l'ensemble fait le reste), voix brillante */
      const hp=ctx.createBiquadFilter(), lp=ctx.createBiquadFilter(), pk=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=110; lp.type="lowpass"; lp.frequency.value=Math.min(6500,2600+f*3); lp.Q.value=0.6; pk.type="peaking"; pk.frequency.value=2300; pk.gain.value=3; pk.Q.value=1;
      hp.connect(lp); lp.connect(pk); pk.connect(e);
      add("sawtooth",f,0,hp,0.66); add("sawtooth",f*2,0,hp,0.34); if(f<330) add("sawtooth",f/2,0,hp,0.36); R.v();
    }
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
      /* pupitre de cordes : plusieurs instrumentistes, chacun légèrement faux à sa manière, chacun avec son vibrato (vitesse, ampleur, moment où il s'installe), répartis dans l'espace ; une caisse de bois, l'archet qu'on entend à peine */
      const base=R.v(), N=o.lite?3:4, sum=G(1), fl=ctx.createBiquadFilter(), wood=ctx.createBiquadFilter(), nasal=ctx.createBiquadFilter();
      fl.type="lowpass"; fl.frequency.value=Math.min(5200,1500+f*2.2); fl.Q.value=0.5;
      wood.type="peaking"; wood.frequency.value=290; wood.gain.value=3; wood.Q.value=1.1; nasal.type="peaking"; nasal.frequency.value=1250; nasal.gain.value=-3; nasal.Q.value=1.2;
      sum.connect(wood); wood.connect(nasal); nasal.connect(fl); fl.connect(e);
      for(let i=0;i<N;i++){
        const h=k=>hz(base*97.3+i*13.7+k*3.1), det=(h(1)*2-1)*11, x=add("sawtooth",f,det,null), pn=PAN((i/(N-1)*2-1)*0.5), g=G(0.62/Math.sqrt(N)*1.6);
        x.connect(g); g.connect(pn); pn.connect(sum);
        const vb=ctx.createOscillator(), vg=G(0); vb.frequency.value=4.6+1.6*h(2); vb.connect(vg); vg.connect(x.detune); os.push(vb);
        const on=t+Math.min(a,0.4+0.9*h(3)); vg.gain.setValueAtTime(0,t); vg.gain.setValueAtTime(0,on); vg.gain.linearRampToValueAtTime(5+7*h(4),on+0.8);
        const sw=ctx.createOscillator(), sg=G(0.12); sw.frequency.value=0.13+0.2*h(5); sw.connect(sg); sg.connect(g.gain); os.push(sw); /* chaque archet respire à son rythme */
      }
      const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const nb=ctx.createBiquadFilter(); nb.type="bandpass"; nb.frequency.value=Math.min(6000,f*5); nb.Q.value=1.4; const ng=G(0.035);
      ns.connect(nb); nb.connect(ng); ng.connect(e); os.push(ns);
    }else{
      /* chœur : plusieurs chanteurs (une scie chacun, faux à leur manière, vibrato propre), passés par les formants d'une voyelle qui glisse lentement de « a » vers « o » puis « ou » ; un peu de souffle */
      const base=R.v(), N=o.lite?2:4, src=G(1), out2=G(1), lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=5200; lp.Q.value=0.5; out2.connect(lp); lp.connect(e);
      for(let i=0;i<N;i++){
        const h=k=>hz(base*71.1+i*17.3+k*5.7), x=add("sine",f,(h(1)*2-1)*13,null); x.setPeriodicWave(glottal(i%2?"souffle":"tendu")); const g=G(1/Math.sqrt(N)), pn=PAN((i/Math.max(1,N-1)*2-1)*0.35);
        x.connect(g); g.connect(pn); pn.connect(src);
        const vb=ctx.createOscillator(), vg=G(0); vb.frequency.value=4.8+1.2*h(2); vb.connect(vg); vg.connect(x.detune); os.push(vb);
        const on=t+Math.min(a,0.5+0.8*h(3)); vg.gain.setValueAtTime(0,t); vg.gain.setValueAtTime(0,on); vg.gain.linearRampToValueAtTime(6+8*h(4),on+1);
      }
      const ns=ctx.createBufferSource(); ns.buffer=wb; ns.loop=true; const ng=G(0.08); ns.connect(ng); ng.connect(src); os.push(ns);
      /* la voyelle glisse au fil de la note : de « a » vers « o », ou de « o » vers « ou » ; formants de la tessiture de la note */
      const PAIRS=[["a","o"],["o","u"],["a","e"]], pr=PAIRS[Math.floor(hz(base*31.7)*3)], mid=t+a+Math.max(0.5,(len-a)*0.6);
      formants(src,out2,f,pr[0],pr[1],t,t+a,mid,2.8);
    }
    os.forEach(x=>{x.start(t); x.stop(end);});
  }

  /* ---------- percussion ---------- */
  function noiseHit(t,vel,fq,dur,type,dst,q,att){
    const s=ctx.createBufferSource(); s.buffer=wb; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=fq; f.Q.value=q||(type==="bandpass"?1.2:0.7);
    const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel,t+(att||0.002)); e.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(e); e.connect(dst); s.start(t,hz(t*3.31+fq)*1.5); s.stop(t+dur+0.05); /* pas de tirage : le hasard des autres voix ne dépend pas des bruits */
  }
  function thump(t,vel,f0,f1,dur){
    const x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(f0,t); x.frequency.exponentialRampToValueAtTime(f1,t+0.14);
    const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel,t+0.003); e.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    x.connect(e); e.connect(PB); x.start(t); x.stop(t+dur+0.05);
  }
  /* peau : modes d'une membrane circulaire (rapports de Bessel), chacun amorti à sa vitesse, avec une chute de hauteur à l'attaque */
  function membrane(t,vel,f0,dec,body){
    [[1,1,1],[1.59,0.75,0.8],[2.14,0.55,0.62],[2.30,0.45,0.55],[2.65,0.35,0.45],[2.92,0.25,0.4]].forEach(([m,a,dm])=>{
      const x=ctx.createOscillator(); x.type="sine"; x.frequency.setValueAtTime(f0*m*1.18,t); x.frequency.exponentialRampToValueAtTime(f0*m,t+0.045);
      const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel*a*body,t+0.003); e.gain.exponentialRampToValueAtTime(0.0001,t+dec*dm);
      x.connect(e); e.connect(PB); x.start(t); x.stop(t+dec*dm+0.05);
    });
  }
  /* son bref accordé : hauteur qui tombe de f0 à f1 en « drop » secondes */
  function ping(t,vel,f0,f1,drop,dec,type){
    const x=ctx.createOscillator(); x.type=type||"sine"; x.frequency.setValueAtTime(f0,t); x.frequency.exponentialRampToValueAtTime(f1,t+drop);
    const e=G(0); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel,t+0.002); e.gain.exponentialRampToValueAtTime(0.0001,t+dec);
    x.connect(e); e.connect(PB); x.start(t); x.stop(t+dec+0.05);
  }
  /* métal : partiels inharmoniques (cymbalette, charleston), passés par un passe-haut */
  function metal(t,vel,ratios,f0,dec,hp){
    const f=ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=hp; const e=G(0);
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(vel,t+0.001); e.gain.exponentialRampToValueAtTime(0.0001,t+dec); f.connect(e); e.connect(PB);
    ratios.forEach(r=>{ const x=ctx.createOscillator(); x.type="square"; x.frequency.value=f0*r; x.connect(f); x.start(t); x.stop(t+dec+0.05); });
  }
  const pK=PAN(0), pT=PAN(0.18), pH=PAN(-0.35); [pK,pT,pH].forEach(x=>x.connect(B.perc.in));
  let PB=pK; const HAT=[1,1.483,1.932,2.546,2.63,3.897];
  /* batteries : chaque univers frappe sur sa peau. stomp = temps fort grave, tap = contretemps, shaker = remplissage */
  const KITS={
    cadre:{ /* tambour sur cadre, bodhrán : la batterie d'origine */
      stomp:(t,v)=>{ if(physOn()){ membrane(t,v,88,0.42,0.55); noiseHit(t,v*0.2,380,0.05,"lowpass",PB); } else{ thump(t,v*0.7,115,46,0.35); noiseHit(t,v*0.18,420,0.06,"lowpass",PB); } },
      tap:(t,v)=>{ if(physOn()){ membrane(t,v,170,0.16,0.3); noiseHit(t,v*0.45,1900,0.07,"bandpass",PB); } else{ thump(t,v*0.25,220,150,0.1); noiseHit(t,v*0.5,1700,0.09,"bandpass",PB); } },
      shaker:(t,v)=>noiseHit(t,v,7000,0.045,"highpass",PB)},
    caisse:{ /* grosse caisse et caisse claire à timbre : marche, bataille */
      stomp:(t,v)=>{ membrane(t,v*0.95,56,0.75,0.75); noiseHit(t,v*0.25,260,0.07,"lowpass",PB); },
      tap:(t,v)=>{ membrane(t,v*0.7,185,0.13,0.4); noiseHit(t,v*0.7,3800,0.19,"bandpass",PB,0.6); noiseHit(t,v*0.3,7000,0.12,"highpass",PB); },
      shaker:(t,v)=>noiseHit(t,v*1.3,4200,0.06,"bandpass",PB,0.8)},
    electro:{ /* boîte à rythmes : grosse caisse en sinus qui plonge, claquement, charleston métallique */
      stomp:(t,v)=>{ ping(t,v*1.1,165,46,0.07,0.55); noiseHit(t,v*0.12,3200,0.008,"highpass",PB); },
      tap:(t,v)=>{ [0,0.011,0.023].forEach((d,i)=>noiseHit(t+d,v*(i<2?0.5:0.75),1150,i<2?0.012:0.16,"bandpass",PB,1.6)); },
      shaker:(t,v)=>metal(t,v*0.8,HAT,330,0.045,7200)},
    darbouka:{ /* doum grave, tek sec sur le bord, cymbalettes du riqq */
      stomp:(t,v)=>{ membrane(t,v*0.9,98,0.5,0.7); },
      tap:(t,v)=>{ ping(t,v*0.45,900,700,0.02,0.07); noiseHit(t,v*0.75,3000,0.035,"bandpass",PB,1.8); },
      shaker:(t,v)=>{ metal(t,v*0.55,[1,1.37,1.81],4300,0.14,5000); noiseHit(t,v*0.5,8500,0.05,"highpass",PB); }},
    taiko:{ /* grand tambour de cérémonie, bord de fût au bâton, claquoir de bois */
      stomp:(t,v)=>{ membrane(t,v,48,1.2,0.95); noiseHit(t,v*0.3,180,0.15,"lowpass",PB); },
      tap:(t,v)=>{ membrane(t,v*0.75,118,0.32,0.55); ping(t,v*0.25,1250,1150,0.01,0.05); },
      shaker:(t,v)=>{ ping(t,v*1.4,1650,1500,0.01,0.03); noiseHit(t,v*0.4,2400,0.02,"bandpass",PB,3); }},
    antique:{ /* tympanon (tambour sur cadre grave), crotales (claquettes de bois), cymbalettes */
      stomp:(t,v)=>{ membrane(t,v*0.95,80,0.5,0.75); noiseHit(t,v*0.25,300,0.05,"lowpass",PB); },
      tap:(t,v)=>{ ping(t,v*0.55,2100,1900,0.005,0.03); ping(t+0.016,v*0.45,2250,2050,0.005,0.03); noiseHit(t,v*0.35,3000,0.025,"bandpass",PB,2); },
      shaker:(t,v)=>metal(t,v*0.5,[1,1.53,2.11],3600,0.22,4000)},
    bastringue:{ /* caisse au balai, coup de botte sur le plancher, tambourin */
      stomp:(t,v)=>{ ping(t,v*1.1,125,70,0.06,0.2); noiseHit(t,v*0.4,700,0.05,"lowpass",PB); },
      tap:(t,v)=>{ noiseHit(t,v,2600,0.16,"bandpass",PB,0.7,0.012); membrane(t,v*0.35,210,0.1,0.3); },
      shaker:(t,v)=>{ metal(t,v*0.6,[1,1.42,1.73],5200,0.16,6000); noiseHit(t,v*0.6,9000,0.07,"highpass",PB); }}
  };
  /* grilles propres à chaque batterie, case par croche : « avant/après » = sur la croche / sur la double croche qui suit.
     K grosse frappe, k frappe grave légère, T frappe aiguë, t frappe aiguë légère, h remplissage (selon la densité), H remplissage toujours, g frappe fantôme (selon le réglage) */
  const KPAT={
    antique:{ /* péan en 5/8 (deux plus trois), dactyle de l'hexamètre en 2/4 (long, bref, bref) */
      "5/8":["K/","h/","T/","h/","t/"], "2/4":["K/","h/","T/","t/"], "4/4":["K/","h/","T/","h/","k/","h/","T/","t/t"], "3/4":["K/","h/","T/","h/","t/","h/"],
      "6/8":["K/","h/","t/","T/","h/","t/"], "7/8":["K/","h/","T/","h/","k/","T/","h/"]},
    caisse:{ /* marche : grosse caisse aux temps forts, caisse claire aux temps 2 et 4, roulements */
      "4/4":["Kh/","h/g","Th/","h/","kh/","h/g","Th/t","t/t"], "2/4":["Kh/","h/g","Th/","t/t"], "3/4":["Kh/","h/","Th/","h/g","Th/t","t/"],
      "6/8":["Kh/","h/","t/g","Th/","h/","t/t"], "12/8":["K/","h/","t/","T/","h/","t/","k/","h/","t/","T/","h/","t/t"]},
    electro:{ /* une grosse caisse par temps, claquement aux temps 2 et 4, charleston en croches et doubles croches */
      "4/4":["KH/h","H/h","KTH/h","H/h","KH/h","H/h","KTH/h","H/hg"], "2/4":["KH/h","H/h","KTH/h","H/hg"], "3/4":["KH/h","H/h","TH/h","H/h","TH/h","H/hg"],
      "6/8":["KH/","H/","H/h","KTH/","H/","H/h"], "7/8":["KH/h","H/h","KTH/h","H/","KH/h","TH/h","H/hg"], "12/8":["KH/","H/","H/","KTH/","H/","H/h","KH/","H/","H/","KTH/","H/","H/h"]},
    darbouka:{ /* maqsoum (doum tek . tek doum . tek .), sama'i en 3/4, ayoub en 2/4 */
      "4/4":["K/","T/","h/h","T/","K/","h/h","T/","h/t"], "2/4":["K/","h/T","K/","T/h"], "3/4":["K/","h/","T/","h/h","T/","h/t"],
      "6/8":["K/","h/","T/","K/","T/","h/t"], "7/8":["K/","h/","T/","h/","K/","T/","h/t"], "12/8":["K/","h/","T/","h/","T/","h/","K/","h/","T/","h/","T/","t/t"]},
    taiko:{ /* peu de frappes, très espacées, le bâton sur le fût entre deux coups */
      "4/4":["K/","/","h/","/","k/","t/","T/","h/"], "2/4":["K/","h/","T/","/"], "3/4":["K/","/","h/","t/","T/","/"],
      "6/8":["K/","/","h/","k/","t/","/"], "12/8":["K/","/","/","h/","/","/","k/","/","t/","T/","/","h/"]},
    bastringue:{ /* « boum-tchac » du piano de saloon, gigue et valse */
      "4/4":["K/","h/","T/","h/h","K/","h/","T/","h/h"], "2/4":["K/","h/","T/","h/h"], "3/4":["K/","h/","T/","h/","T/","h/"],
      "6/8":["K/","t/t","T/","K/","t/t","T/"], "12/8":["K/","h/","T/","k/","h/","T/","K/","h/","T/","k/","h/","T/"]} /* 6/8 : le galop, sabot-sabot-sabot */
  };
  /* relances : [sur le dernier temps toutes les quatre mesures, roulement des deux derniers temps de la section] */
  const KFILL={antique:["T/t","T/T"], caisse:["T/t","T/T"], electro:["TH/T","T/T"], darbouka:["T/t","T/T"], taiko:["T/","T/T"], bastringue:["t/t","T/t"]};
  const lastTc=new Map(), lastT=P=>{ if(!lastTc.has(P)){ let j=-1; P.forEach((x,i)=>{ if(x.split("/")[0].indexOf("T")>=0) j=i; }); lastTc.set(P,j); } return lastTc.get(P); };
  const kitPat=()=>{ const P=KPAT[S.perc.kit]; return P&&P[S.meter]&&P[S.meter].length===barE?P[S.meter]:null; };
  const MD=METERS[S.meter].d||2; /* croches par temps */
  /* humanisation (ms) : retard propre à chaque son, flottement aléatoire, et variation de la nuance */
  const KHUM={antique:{lay:{K:0,T:2,h:-3},jit:6,vj:0.12}, cadre:{lay:{K:0,T:4,h:-2},jit:6,vj:0.1}, caisse:{lay:{K:0,T:3,h:0},jit:3,vj:0.06}, electro:{lay:{K:0,T:0,h:0},jit:0.5,vj:0.04},
    darbouka:{lay:{K:0,T:-3,h:5},jit:5,vj:0.12}, taiko:{lay:{K:0,T:6,h:0},jit:8,vj:0.1}, bastringue:{lay:{K:0,T:9,h:-4},jit:7,vj:0.12}};
  const kit=()=>KITS[S.perc.kit]||KITS.cadre;
  const stomp=(t,v)=>{ PB=pK; kit().stomp(t,v); }, tap=(t,v)=>{ PB=pT; kit().tap(t,v); }, shaker=(t,v)=>{ PB=pH; kit().shaker(t,v); };

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
  /* grammaire des modes : progressions typiques, ton de récitation des modes d'église, chemin du maqam */
  const IDIOM={dorien:[[0,3,0,6],[0,6,3,0],[0,3,6,0],[0,4,3,0]], mixolydien:[[0,6,3,0],[0,3,6,0],[0,6,0,3],[0,4,6,0]], phrygien:[[0,1,0,6],[0,1,6,0],[0,6,1,0],[0,3,1,0]], eolien:[[0,5,6,0],[0,6,5,0],[0,3,6,0],[0,5,3,6]], ionien:[[0,3,4,0],[0,5,3,4],[0,3,0,4],[0,4,3,0]], lydien:[[0,1,0,4],[0,1,4,0],[0,4,1,0],[0,1,5,0]], locrien:[[0,1,0,5],[0,5,1,0],[0,1,5,0]], harm:[[0,3,4,0],[0,5,4,0],[0,3,5,4]], melo:[[0,3,4,0],[0,5,4,0],[0,3,5,4]]}, CHURCH=["ionien","dorien","phrygien","lydien","mixolydien","eolien"];
  const harmE=()=>(S.mus&&S.mus.harm)||"idiome";
  function pcIx(pool,i,pc){ let best=i,bd=1e9; pool.forEach((p,j)=>{ if(Math.abs((((p%12)+12)%12)-pc)<0.01){ const d=Math.abs(j-i); if(d<bd){ bd=d; best=j; } } }); return best; }
  function seyirTarget(pool,startT){
    const L=secLen(), p=(((startT-t0)/L)%1+1)%1, t0i=tonicIx(pool,Math.floor(pool.length/3)), d5=Math.min(pool.length-1,pcIx(pool,t0i+3,7)), top=Math.min(pool.length-1,d5+4);
    if(p<0.25) return t0i; if(p<0.6) return Math.round(t0i+(d5-t0i)*(p-0.25)/0.35); if(p<0.8) return Math.round(d5+(top-d5)*(p-0.6)/0.2); return Math.round(top+(t0i-top)*(p-0.8)/0.2);
  }

  const modal=()=>!(S.mus&&S.mus.logic==="hasard");
  /* caractère de la mélodie : cinq curseurs qui orientent le tirage (0,5 = comme avant) */
  const car=()=>S.car||{grav:0.5,aud:0.5,orn:0.5,sil:0.5,rep:0.5};
  const leapE=()=>clamp(S.mel.leap+(car().aud-0.5)*1.2,0,1), ornE=()=>clamp(S.mel.orn+(car().orn-0.5)*0.9,0,1), dejaE=()=>clamp(S.mel.deja+(car().rep-0.5)*0.9,0,1);
  const silE=()=>0.25+1.5*car().sil, gravE=()=>car().grav;
  const formE=()=>(S.mus&&S.mus.form)||"libre";
  const FS={ref:[],theme:[],ost:null,ostN:0};
  const tonicIx=(pool,i)=>{ let best=i,bd=1e9; pool.forEach((p,j)=>{ if(((p%12)+12)%12===0){ const d=Math.abs(j-i); if(d<bd){bd=d;best=j;} } }); return best; };
  let idiomProg=null; const chordTl=[]; let chordEnd=-1, cpos=0, lastDeg=0, holdDeg=null, prevVoicing=null;
  /* progression en cycles de quatre accords : retour à la tonique, un accord libre, un accord de préparation (sous-tonique, dominante ou sous-dominante), puis la tonique */
  function nextDegree(n,key){
    if(holdDeg!==null) return holdDeg%n;
    { const F=formE(); if(F==="passacaille"){ const g=[0,n-1,Math.round(n*5/7)%n,Math.round(n*4/7)%n]; lastDeg=g[cpos++%4]; return lastDeg; } if(F==="ostinato"){ const p=cpos++%4; lastDeg=p===3?Math.round(n*4/7)%n:0; return lastDeg; } }
    if(n===7&&IDIOM[key]&&formE()==="libre"&&harmE()==="idiome"){ const ip=cpos%4, vs=IDIOM[key]; if(ip===0||!idiomProg) idiomProg=vs[Math.floor(R.s()*vs.length)]; if(R.s()<0.62){ cpos++; lastDeg=idiomProg[ip]; return lastDeg; } }
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
      const t=chordEnd, iv=ivOf(S,secOf(t).key), n=iv.length, stg=clamp(S.pad.stag===undefined?0.5:S.pad.stag,0,1), nb0=Math.max(1,Math.round(S.pad.len*(rcAt(t)<0.45?1+Math.round((0.45-rcAt(t))*5):1))), nb=ambE()*stg>0.05&&R.s()<ambE()*stg*0.6?[Math.max(1,Math.round(nb0/2)),nb0,nb0+1,nb0*2][Math.floor(R.s()*4)]:nb0, len=nb*bar, vc=clamp(Math.round(S.pad.voices),2,o.lite?3:4);
      let dRaw, offs;
      if(modal()){ dRaw=nextDegree(n,secOf(t).key); { const k1=R.k(), k2=R.k(); if(k1<(((S.chance||{}).mutate)||0)*0.6) dRaw=Math.floor(k2*n); } offs=voice(iv,dRaw%n,vc); prevVoicing=offs; }
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
    const pats=[[2,1,1,2],[1,1,2,2],[3,1,2],[2,2,1,1],[1,2,1,2],[2,1,2],[3,1,3,1],[3,1,2,2],[1,1,1,1,2,2],[2,1,1,1,1,2],[4,2,2],[1,3,2,2],[3,3,2],[1,1,2,1,3]], rh=pats[Math.floor(R.m()*pats.length)], sg=R.m()<0.5?-1:1, steps=[];
    for(let i=0;i<rh.length-1;i++) steps.push(i===0?sg*(1+Math.floor(R.m()*2)):(R.m()<0.6?-Math.sign(steps[i-1])||1:Math.sign(steps[i-1]))*(R.m()<0.7?1:2));
    motif={steps,rh}; return motif;
  }
  const chordPcs=ch=>ch.offs.map(x=>((x%12)+12)%12);
  /* cale la note sur l'accord, en évitant la hauteur de la note précédente (c'est ce calage qui écrasait les voisines sur le même son) */
  function snapTo(pool,i,pcs,reach,avoid){
    for(let k=0;k<=reach;k++){
      const up=i+k<pool.length&&i+k!==avoid&&pcs.indexOf(((pool[i+k]%12)+12)%12)>=0, dn=i-k>=0&&i-k!==avoid&&pcs.indexOf(((pool[i-k]%12)+12)%12)>=0;
      if(up) return i+k; if(dn) return i-k;
    }
    return i;
  }
  /* ambiance lente : tempo bas et densité faible appellent des notes tenues et un placement libre ; les danses gardent la grille */
  const slowE=dens=>clamp((1-dens)*0.6+clamp((90-S.tempo)/50,0,1)*0.5,0,1);
  /* part d'ambiance : les nappes ne décalent leurs entrées que pour une musique lente, jamais pour une danse */
  const ambE=()=>clamp(0.15+1.3*slowE(S.mel.dens),0,1);
  /* nettoyage d'une phrase : peu d'unissons (une paire sur dix au plus) et une part de tonique plafonnée, pour que la mélodie bouge et ne s'appuie pas toujours sur le repos */
  const pcOf=x=>((x%12)+12)%12;
  function tidy(notes,pool,keepEnd,startT){
    const n=notes.length; if(n<2) return notes;
    const ixs=notes.map(nt=>Math.max(0,pool.indexOf(nearest(pool,nt.off)))), last=n-1;
    /* les notes d'accord des temps forts restent des notes d'accord */
    const cp=notes.map(nt=>{ const tn=startT+nt.e*E; return Math.round((tn-t0)/E)%2===0?chordPcs(chordAt(tn)):null; });
    const capT=Math.max(1,Math.floor(n*(0.1+0.12*gravE())+0.5));
    const move=(k,dir)=>{ /* déplace la note k d'un ou deux degrés, dans le sens dir, sans créer d'unisson ni de tonique de plus */
      for(const st of [dir,-dir,2*dir,-2*dir]){ const j=clamp(ixs[k]+st,0,pool.length-1); if(j===ixs[k]) continue;
        if(k>0&&j===ixs[k-1]) continue; if(k<last&&j===ixs[k+1]) continue; if(pcOf(pool[j])===0&&pcOf(pool[ixs[k]])!==0) continue;
        if(cp[k]&&cp[k].indexOf(pcOf(pool[ixs[k]]))>=0&&cp[k].indexOf(pcOf(pool[j]))<0) continue;
        ixs[k]=j; return true; }
      return false; };
    for(let k=1;k<n;k++){
      if(ixs[k]===ixs[k-1]&&R.h()>=0.08){ const dir=k>=2&&ixs[k-1]!==ixs[k-2]?Math.sign(ixs[k-1]-ixs[k-2]):(R.h()<0.5?1:-1); if(!(keepEnd&&k===last&&pcOf(pool[ixs[k]])===0&&move(k-1,-dir))&&!move(k,dir)) move(k-1,-dir); }
    }
    let nt=0; ixs.forEach((j,k)=>{ if(pcOf(pool[j])===0) nt++; });
    for(let k=last-(keepEnd?1:0);k>=0&&nt>capT;k--){ if(pcOf(pool[ixs[k]])!==0) continue; const dir=k>0?Math.sign(ixs[k-1]-ixs[k])||1:1; if(move(k,dir)||move(k,-dir)) nt--; }
    return notes.map((x,k)=>ixs[k]===pool.indexOf(nearest(pool,x.off))?x:{...x,off:pool[ixs[k]]});
  }
  /* machine de Turing : un registre de pas qui boucle ; le verrou dit à quel point chaque pas résiste à la mutation (1 = boucle exacte, 0 = tout est tiré de nouveau) */
  const TM={steps:null,ix:0};
  function turingPass(pool,dens,startT){
    const T=S.turing||{lock:0.85,len:2,rate:1}, nb=clamp(Math.round(T.len||2),1,4), step=T.rate>=2?2:1, N=Math.max(2,Math.round(nb*barE/step)), lock=clamp(T.lock===undefined?0.85:T.lock,0,1), gv=Math.max(0,gravE()-0.35)*0.5;
    const fresh=prev=>{ const a=R.u(), b=R.u(), c=R.u(), d2=R.u(); let ix=prev===null?Math.floor(pool.length/3):prev+[-2,-1,-1,0,1,1,2][Math.floor(a*7)]; if(prev!==null&&b<gv){ const ti=tonicIx(pool,ix); ix+=Math.sign(ti-ix); } return {ix:clamp(ix,0,pool.length-1),rest:c<(1-dens)*0.45+0.05,acc:d2}; };
    if(!TM.steps||TM.steps.length!==N){ TM.steps=[]; for(let i=0;i<N;i++) TM.steps.push(fresh(i?TM.steps[i-1].ix:null)); }
    else TM.steps=TM.steps.map((st,i)=>R.u()<lock?(R.u(),R.u(),R.u(),R.u(),st):fresh(i?TM.steps[i-1].ix:st.ix));
    const notes=[]; TM.steps.forEach((st,i)=>{
      if(st.rest) return;
      const e=i*step, tn=startT+e*E, strong=Math.round((tn-t0)/E)%2===0; let ix=clamp(st.ix,0,pool.length-1);
      if(strong&&modal()) ix=snapTo(pool,ix,chordPcs(chordAt(tn)),2);
      notes.push({e,off:pool[ix],dE:step,vel:0.09+0.19*st.acc*(strong?1:0.8),grace:false,gdir:1,jit:(R.h()-0.5)*0.01});
    });
    return {notes,end:N*step,gr:0,pool};
  }
  /* critique : la machine tire plusieurs phrases et garde la meilleure selon des critères musicaux */
  function scorePhrase(ph,pool,stab){
    const nts=ph.notes; if(nts.length<2) return -5;
    const ix=nts.map(n=>{ let j=pool.indexOf(n.off); if(j<0) j=pool.indexOf(nearest(pool,n.off)); return j; });
    const leapW=1.4-0.9*car().aud, grav=gravE(); let sc=0, steps=0, run=1, maxRun=1;
    for(let i=1;i<ix.length;i++){
      const d=ix[i]-ix[i-1], a=Math.abs(d);
      if(a===0){ run++; maxRun=Math.max(maxRun,run); sc-=1.1; } else run=1;
      if(a<=1) steps++;
      if(a>=4) sc-=leapW*(a-3)*0.5;
      if(i>1){ const pd=ix[i-1]-ix[i-2]; if(Math.abs(pd)>=3) sc+=(Math.sign(d)===-Math.sign(pd)&&a<=2)?1.2:-1.0; }
      if(Math.abs(Math.abs(nts[i].off-nts[i-1].off)-6)<0.01) sc-=1.3;
    }
    if(maxRun>2) sc-=1.5*(maxRun-2);
    { const nt0=nts.filter(x=>pcOf(x.off)===0).length/nts.length; if(nt0>0.25) sc-=(nt0-0.25)*6; }
    sc-=3*Math.abs(steps/(ix.length-1)-0.6);
    const hi=Math.max(...ix), lo=Math.min(...ix), nHi=ix.filter(v=>v===hi).length, pos=ix.indexOf(hi)/(ix.length-1);
    sc+=nHi===1?1.2:-0.6*(nHi-1); if(pos>=0.25&&pos<=0.8) sc+=1; if(pos===0) sc-=1.5;
    const lpc=(((nts[nts.length-1].off)%12)+12)%12; if(stab.indexOf(lpc)>=0) sc+=1.5*(0.6+grav); if(lpc===0) sc+=1.6*grav;
    const span=hi-lo; if(span<3) sc-=(3-span)*0.8; if(span>9) sc-=(span-9)*0.5;
    if(lastPh&&lastPh.notes.length===nts.length){ let same=0; for(let i=0;i<nts.length;i++) if(nts[i].off===lastPh.notes[i].off) same++; if(same/nts.length>0.8) sc-=2; }
    return sc;
  }
  function bestOf(gen,pool,stab){
    const c=S.mus&&S.mus.crit!==undefined?S.mus.crit:0.6, K=1+Math.round(clamp(c,0,1)*11);
    if(K<=1) return gen();
    const saved=nPh; let best=null, bs=-1e9;
    for(let k=0;k<K;k++){ nPh=saved; const ph=gen(), sc=scorePhrase(ph,pool,stab)+R.c()*0.3; if(sc>bs){ bs=sc; best=ph; } }
    nPh=saved+1; return best;
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
  function formPhrase(F,gen,pool,startT,dens){
    const k=nPhrase++; if(frozen&&lastPh) return lastPh;
    if(F==="turing") return turingPass(pool,dens,startT);
    if(F==="ostinato"){ if(!FS.ost||FS.ostN>=8){ FS.ost=gen(); FS.ostN=0; } FS.ostN++; return FS.ost; }
    if(F==="rondeau"){ const A=[0,1,4,5,8,9], ai=A.indexOf(k%12); if(ai>=0){ const j=ai%2; if(!FS.ref[j]) FS.ref[j]=gen(); return FS.ref[j]; } return gen(); }
    /* thème : deux phrases (question, réponse) écrites au début ; elles reviennent telles quelles au thème, variées à l'apogée,
       en fragments au développement (la tête du thème, puis une phrase neuve), étirées dans l'intro et la coda */
    if(F==="theme"){
      if(!FS.theme[0]) FS.theme[0]=gen(); if(!FS.theme[1]&&k>0) FS.theme[1]=gen();
      const si=Math.max(0,Math.floor((startT-t0)/secLen()+1e-6)), role=arcOn()?roleOf(si).n:(si%2?"développement":"thème"), j=k%2, T=FS.theme[j]||FS.theme[0];
      FS.tN=(FS.tN||0)+1;
      if(role==="thème") return T;
      if(role==="apogée") return varyPhrase(T,1+(FS.tN%2)*3,pool);
      if(role==="développement") return (k%3===0)?varyPhrase(T,2+(k%2),pool):gen();
      if(role==="intro"||role==="coda") return varyPhrase(FS.theme[0],3,pool);
      return (k%2===0)?T:gen();
    }
    if(F==="variations"){ const j=k%4, cyc=Math.floor(k/4); if(!FS.theme[j]) FS.theme[j]=gen(); return cyc===0?FS.theme[j]:varyPhrase(FS.theme[j],cyc,pool); }
    return gen();
  }
  function genPhraseModal(pool,stab,dens,startT,secI){
    const mt=motifFor(secI), type=nPh++%4, ch0=chordAt(startT), key=secOf(startT).key, ivK=ivOf(S,key), church=CHURCH.indexOf(key)>=0, maqam=ivK.some(x=>x%1!==0);
    let i0;
    if(lastOff.v!==null){ let bi=0,bd=1e9; pool.forEach((p,j)=>{const d=Math.abs(p-lastOff.v); if(d<bd){bd=d;bi=j;}}); i0=bi; } else i0=Math.floor(pool.length/3);
    let idx=snapTo(pool,i0,chordPcs(ch0),3);
    if(type===1) idx=clamp(idx+[1,-1,2][Math.floor(R.m()*3)],0,pool.length-1); /* le motif repris plus haut ou plus bas */
    const slow=slowE(dens), mul=R.m()<slow*1.1?(R.m()<0.55?2:3):1, seq=[idx], dEs=[mt.rh[0]*mul];
    mt.steps.forEach((st,k)=>{ idx=clamp(idx+(type===1&&nPh%8>=4?-st:st),0,pool.length-1); seq.push(idx); dEs.push(mt.rh[k+1]*mul); });
    /* suite de la phrase : en arche pour la question, descendante vers le repos pour la réponse */
    const extra=1+Math.floor(R.m()*(1+3*dens)), durs=dens>0.6?[1,1,2,2,3]:[1,2,2,3,4];
    for(let k=0;k<extra;k++){
      let st;
      if(R.m()<leapE()*0.4) st=(type===2?1:-1)*(3+Math.floor(R.m()*2));
      else if(type===2) st=k<extra/2?(R.m()<0.75?1:2):(R.m()<0.7?-1:1);
      else if(type===3) st=R.m()<0.8?-1:(R.m()<0.5?-2:1);
      else st=[-2,-1,-1,1,1,2][Math.floor(R.m()*6)];
      { const pg=Math.max(0,gravE()-0.35)*0.9, ti=tonicIx(pool,idx); if(ti!==idx&&R.m()<pg) st=Math.sign(ti-idx); }
      if(harmE()==="idiome"){
        if(church&&type!==3&&type!==1){ const tx=pcIx(pool,idx,((degOff(ivK,key==="phrygien"?5:4)%12)+12)%12); if(tx!==idx&&R.m()<0.22) st=Math.sign(tx-idx); }
        else if(maqam){ const tg=seyirTarget(pool,startT); if(tg!==idx&&R.m()<0.45) st=Math.sign(tg-idx); }
      }
      idx=clamp(idx+st,0,pool.length-1); seq.push(idx); dEs.push(R.m()<slow*0.8?[3,4,4,6,8][Math.floor(R.m()*5)]:durs[Math.floor(R.m()*durs.length)]);
    }
    if(R.m()<slow*0.85&&type!==1) dEs[dEs.length-1]=Math.round(barE*[0.75,1,1,2,3][Math.floor(R.m()*5)]); /* la dernière note se tient, parfois sur plusieurs mesures */
    /* notes : temps forts sur les notes de l'accord, fin de phrase sur le repos voulu, silences et nuances de phrase */
    let prevIx=-1; const notes=[], n=seq.length, lvl=0.3+0.7*R.m(), freeP=0.75*clamp((slow-0.25)/0.75,0,1); let e=0;
    for(let k=0;k<n;k++){
      const tn=startT+e*E, ch=chordAt(tn), strong=Math.round((tn-t0)/E)%2===0;
      let ix=seq[k];
      if(k===n-1){
        if(type===3||R.m()<Math.max(0,gravE()-0.5)*1.2){ const tpc=stab.indexOf(0)>=0?[0]:[stab[0]]; ix=snapTo(pool,ix,tpc,5,prevIx); }
        else ix=snapTo(pool,ix,type===2?chordPcs(ch).slice(1,3):chordPcs(ch),4,prevIx);
      } else if(strong) ix=snapTo(pool,ix,chordPcs(ch),2,prevIx);
      prevIx=ix;
      const arch=0.5+0.5*Math.sin(Math.PI*(k+0.5)/n), vel=clamp(0.06+0.29*Math.pow(clamp(lvl*(0.4*arch+0.35*(strong?1:0.05)+0.25*R.m())*(type===2?0.9:1)+0.06*tensAt(tn),0,1),1.3),0.06,0.34);
      const grace=R.m()<ornE(), gdir=R.m()<0.5?-1:1, jit=(R.h()-0.5)*(strong?0.008:0.024)+(k>0&&k<n-1&&(!strong||slow>0.5)&&R.h()<freeP?(R.h()-0.35)*1.1*Math.min(dEs[k-1],3)*E*0.5:0), trill=ornE()>0.55&&R.m()<(ornE()-0.55)*0.8;
      notes.push({e,off:pool[ix],dE:dEs[k],vel,grace,gdir,jit,trill}); e+=dEs[k];
      if(k<n-2&&R.m()<0.3*(1-dens)*silE()) e+=1+Math.floor(R.m()*2); /* un souffle entre deux notes */
    }
    return {notes:tidy(notes,pool,type===3,startT),end:e,gr:R.m(),pool};
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
      const dE=durs[Math.floor(R.m()*6)], vel=0.09+R.m()*0.22, grace=R.m()<ornE(), gdir=R.m()<0.5?-1:1;
      notes.push({e,off:pool[idx],dE,vel,grace,gdir}); e+=dE;
    }
    return {notes,end:e,gr:R.m(),pool};
  }

  /* ---------- ordonnanceur ---------- */
  let pieceFade=0;
  const cur={mel:0,drone:0,clink:0,perc:0,k:0,pad:0,int:0,fire:0,wind:0,drip:0,bird:0,sec:1,arp:0,aj:0,pl:0,pli:0,plj:0};
  const phBars=new Set(), fillBars=[], melOn=[]; let arbre=null, billes=[], loopsL=[], pendK=[], lastPh=null, lastD=null, frozen=null;
  const lastOff={v:null};
  function rec(tr,t,off,dur,vel,tag){ if(o.record||o.rolling) events.push(tag?{tr,t,off,dur,vel,tag}:{tr,t,off,dur,vel}); }
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
      instOf(S.canon.inst,"harpe")(tt,freq(off2),vel*0.85,len,V.canon.node,0.32+(R.v()*2-1)*0.18);
      rec(1,tt,off2,len,vel*0.85); if(o.onNote) o.onNote(tt,off2,"canon",len,vel*0.85);
      return;
    }
    const shifts={"uni":0,"oct+":n,"oct-":-n,"q+":Math.round(n*4/7),"q-":-Math.round(n*4/7),"t+":Math.round(n*2/7)};
    const k2=clamp(k+(shifts[S.canon.shift]||0),0,wide.length-1), off2=wide[k2];
    const tt=sw(t+S.canon.delay*bar);
    instOf(S.canon.inst,"harpe")(tt,freq(off2),vel*0.9,len,V.canon.node,0.32+(R.v()*2-1)*0.18);
    rec(1,tt,off2,len,vel*0.9);
    if(o.onNote) o.onNote(tt,off2,"canon",len,vel*0.9);
  }
  function schedule(until){
    const M=mach();
    if(o.rolling&&events.length>9000) events.splice(0,events.length-6000);
    dawSchedule(until);
    /* intensité */
    while(cur.int<until){
      driftStep(2);
      const t=cur.int, I=inten(t), A=S.form.shape==="constante"?0:S.form.amount, m=1-A+A*I, ie=S.form.shape==="constante"?0.5:I;
      B.perc.it.gain.setTargetAtTime(m,t,1.2); B.pad.it.gain.setTargetAtTime(0.45+0.55*m,t,1.2);
      droneFilters.forEach(({f,base})=>f.frequency.setTargetAtTime(base*(0.7+0.6*ie)*(adaptOn()?1+S.adapt.amount*(adaptE(t+1)-0.5)*0.6:1)*(1+0.7*dv("filtre")),t,2));
      { const vv=clamp(S.fx.veil+(adaptOn()?S.adapt.amount*(0.5-adaptE(t+1))*0.6:0)+0.5*dv("voile")-0.35*arcAt(t+1),0,1); veil.frequency.setTargetAtTime(18000*Math.pow(2500/18000,vv),t,3); }
      wet.gain.setTargetAtTime(Math.max(0,S.fx.rev*2*(1+0.9*dv("reverb"))),t,3);
      rcApply(t,4);
      /* pièce : intro, thème, développement, apogée, retombée, coda, puis la musique s'éteint pendant la seconde moitié de la coda */
      if(pieceOn()&&!pieceFade&&t+4>=t0+6*secLen()-0.5*secLen()){ const te=t0+6*secLen(), ts=Math.max(t,te-0.5*secLen()); pieceFade=te; master.gain.cancelScheduledValues(ts); master.gain.setValueAtTime(1,ts); master.gain.linearRampToValueAtTime(0,te); }
      if(fx) fx.grOut.gain.setTargetAtTime(Math.max(0,(GR().mix||0)*2.2*(1+0.9*dv("grain"))),t,3);
      if(dynTens()){
        const m=tensMul((tensAt(t+1)-0.5)*2);
        B.perc.tm.gain.setTargetAtTime(m.perc,t,1.5); B.pad.tm.gain.setTargetAtTime(m.pad,t,1.5);
        B.drone.tm.gain.setTargetAtTime(m.drone,t,1.5); B.amb.tm.gain.setTargetAtTime(m.amb,t,1.5);
      }
      cur.int=t+2;
    }
    /* mélodie et canon : chaque phrase est mémorisée, le déjà-vu décide de la rejouer */
    while(cur.mel<until){
      if(!M){ cur.mel=t0+bar*Math.ceil((until-t0)/bar); break; }
      if(arcRise(cur.mel,bar)){ cur.mel=t0+(Math.floor((cur.mel-t0)/secLen()+1e-6)+1)*secLen(); continue; }
      const sc=secOf(cur.mel), iv=ivOf(S,sc.key), stab=stableOf(iv), I=inten(cur.mel);
      const evo=S.form.shape==="constante"?0:(I-0.5)*S.form.amount;
      const dens=clamp(S.mel.dens+evo+(tensAt(cur.mel)-0.5)*0.6+(formE()==='passacaille'?0.07*(Math.floor(cpos/4)%6):0)+0.4*dv("densite"),0,1);
      const shift=arcOn()?Math.round(arcAt(cur.mel)*6):0, lo=12+12*S.mel.reg+shift, hi=lo+12*S.mel.span, pool=poolOf(iv,lo,hi);
      if(!pool.length){cur.mel+=bar; continue;}
      const genRaw=modal()?(()=>genPhraseModal(pool,stab,dens,cur.mel,sc.i)):(()=>genPhrase(pool,stab,dens));
      let gen=()=>bestOf(genRaw,pool,stab);
      let fresh=false; const gen0=gen; gen=()=>{ fresh=true; return gen0(); };
      const F0=formE(), FF=(F0==='libre'&&rcAt(cur.mel)>=0.55)?'theme':F0; /* côté chanson, la forme libre devient un thème qui revient */
      let ph=FF==='libre'?recall(memM,nPhrase++,Math.max(1,Math.round(S.mel.loop)),dejaE(),R.m,gen):formPhrase(FF,gen,pool,cur.mel,dens);
      lastPh=ph;
      if(ph.pool!==pool||(!fresh&&modal())){ /* rejouée : recaler sur la gamme de la section et sur l'accord du moment */
        ph={notes:ph.notes.map(n=>({...n,off:nearest(pool,n.off)})),end:ph.end,gr:ph.gr};
        if(modal()){ /* et sur l'accord du moment : temps forts et dernière note */
          const last=ph.notes.length-1;
          let pv=-1; ph.notes=ph.notes.map((n,k)=>{ const tn=cur.mel+n.e*E, strong=Math.round((tn-t0)/E)%2===0, ci0=pool.indexOf(n.off); if(k===last&&stab.indexOf(pcOf(n.off))>=0){ pv=ci0; return n; } if(!strong&&k!==last){ pv=ci0; return n; } const ci=ci0<0?0:ci0, ix=snapTo(pool,ci,chordPcs(chordAt(tn)),k===last?4:2,pv); pv=ix; return {...n,off:pool[ix]}; });
          ph.notes=tidy(ph.notes,pool,false,cur.mel);
        }
      }
      let t=cur.mel;
      const onsets=ph.notes.map(n=>sw(cur.mel+n.e*E)+(n.jit||0));
      ph.notes.forEach((nt,ni)=>{
        /* chance : tirages toujours faits, même quand la voix est coupée, pour que les rendus restent alignés */
        const C=S.chance||{}, cSkip=R.c(), cMut=R.c(), cDir=R.c(), cMag=R.c(), cOct=R.c(), cOd=R.c(), cRat=R.c(), cRn=R.c();
        let off=nt.off;
        if(cMut<(C.mutate||0)){ const ci=Math.max(0,pool.indexOf(nearest(pool,off))); off=pool[clamp(ci+(cDir<0.5?-1:1)*(cMag<0.3?2:1),0,pool.length-1)]; }
        if(cOct<(C.octave||0)){ const up=off+12<=pool[pool.length-1], dn=off-12>=pool[0]; if(up&&(cOd<0.5||!dn)) off+=12; else if(dn) off-=12; }
        const skipped=cSkip<(C.skip||0), rat=cRat<(C.ratchet||0)?2+Math.floor(cRn*2):1;
        const tt=onsets[ni], vel=nt.vel, len=Math.max(0.05,Math.min(E*nt.dE*0.92,ni+1<onsets.length?onsets[ni+1]-tt-0.02:1e9));
        if(!skipped&&want("mel")&&S.mel.lvl>0.001){
          const fn=instOf(S.mel.inst,"luth");
          if((nt.grace||nt.trill)&&pool.length>2&&(S.mel.inst==="luth"||S.mel.inst==="harpe"||S.mel.inst==="carillon"||S.mel.inst==="oud"||S.mel.inst==="kalimba"||S.mel.inst==="guitare"||S.mel.inst==="piano")){
            const gi=clamp(pool.indexOf(off)+nt.gdir,0,pool.length-1); if(nt.trill){ fn(tt-0.16,freq(pool[gi]),vel*0.42,0.07,V.mel.node,0); fn(tt-0.08,freq(off),vel*0.5,0.07,V.mel.node,0); } fn(tt-0.07+(nt.trill?0.0:0),freq(pool[gi]),vel*0.55,0.08,V.mel.node,0);
          }
          const pan=clamp(-0.12+(R.v()*2-1)*0.2+0.8*dv("pan"),-1,1);
          if(rat>1){ for(let k=0;k<rat;k++) fn(tt+k*len/rat,freq(off),vel*(1-0.17*k),len/rat*0.85,V.mel.node,pan); }
          else fn(tt,freq(off),vel,len,V.mel.node,pan);
          if(S.canon.lvl>0.001) canonNote(cur.mel+nt.e*E,off,vel,len,iv);
        } else R.v();
        if(!skipped&&S.mel.lvl>0.001) padOpen(tt,len,vel);
        if(!skipped){ rec(0,tt,off,len,vel); if(S.mel.lvl>0.001) melOn.push(tt);
        if(o.onNote) o.onNote(tt,off,"mel",len,vel);
        lastOff.v=off; }
      });
      t=cur.mel+ph.end*E;
      const bars=Math.ceil((t-t0)/bar-1e-6);
      { const r1=R.c(), r2=R.c(); cur.mel=t0+bar*(bars+Math.round(ph.gr*2*(1.6-1.5*dens)*silE())+(r1<(((S.chance||{}).rest)||0)*2?1+(r2<0.4?1:0):0)); phBars.add(Math.round((cur.mel-t0)/bar)); if(phBars.size>400){ const lo=Math.round((until-t0)/bar)-8; phBars.forEach(b=>{ if(b<lo) phBars.delete(b); }); } }
    }
    /* respirations : dans une partie des sections, une voix se retire au début et revient à mi-section (ou aux trois quarts), sur une mesure */
    while(t0+cur.sec*secLen()<until){
      const i=cur.sec++, ts=t0+i*secLen(), L=secLen(), hr=mulberry32((seed^Math.imul(i,0x9E3779B1))>>>0), h1=hr(), h2=hr(), h3=hr();
      const p=(S.form&&S.form.breath!==undefined)?S.form.breath:0.5; if(h1>=p) continue;
      const cands=[["pad",S.pad.lvl],["perc",S.perc.lvl],["loops",S.loops.lvl],["pend",S.pend.lvl]].filter(([n,l])=>l>0.05&&want(n));
      if(!cands.length) continue;
      const n=cands[Math.floor(h2*cands.length)][0], g=B[n].br.gain, back=ts+Math.round(L*(h3<0.6?0.5:0.75)/bar)*bar;
      g.setTargetAtTime(n==="perc"?0:0.12,ts,n==="perc"?0.05:1.4); g.setTargetAtTime(1,back-(n==="perc"?0.02:2),n==="perc"?0.03:1.2);
    }
    /* percussion */
    while(cur.perc<until){
      const k=cur.k%barE, sym=PAT[k], odd=(cur.k%2)===1;
      const t=cur.perc+(odd?S.swing*E*0.5:0)+R.p()*(S.perc.kit==="electro"?0.0005:0.006), bi=Math.floor(cur.k/barE), f1=R.p(), f2=R.p(), endBar=k>=barE-2, hasMel=M&&want("mel")&&S.mel.lvl>0.001, endPhr=bi>0&&(hasMel?phBars.has(bi+1):bi%4===3), endSec=((bi+1)*bar)%secLen()<1e-6;
      if(endPhr&&k===barE-2) fillBars.push(bi);
      if(M&&want("perc")&&S.perc.lvl>0.001){
        const KP=kitPat(), H=KHUM[S.perc.kit]||KHUM.cadre;
        /* la percussion écoute la mélodie : en retrait quand elle chante beaucoup, plus présente dans ses silences */
        if(melOn.length>400) melOn.splice(0,melOn.length-200);
        let mc=0; for(let i=melOn.length-1;i>=0&&i>=melOn.length-60;i--){ const d=melOn[i]-t; if(d>-bar*0.5&&d<bar*0.5) mc++; }
        const busy=clamp(mc/(barE*0.6),0,1), hush=hasMel&&mc===0, shP=clamp(S.perc.shaker*(1-0.45*busy)*(hush?1.35:1),0,1), ghP=clamp(S.perc.ghost*(1-0.5*busy)*(hush?1.6:1),0,1), tSoft=1-0.12*busy;
        /* accents : premier temps de la mesure, puis les temps, puis les contretemps ; un peu de hasard sur chaque frappe */
        const acc=(slot,sub)=>(slot===0&&!sub?1.06:(slot%MD===0&&!sub?0.94:(sub?0.72:0.82)))*(1-H.vj+2*H.vj*R.p());
        /* décalage humain : chaque son a son retard propre (la caisse claire traîne, le charleston pousse), plus un flottement */
        const at=(tt,ch)=>tt+((H.lay[ch]||0)+(R.p()*2-1)*H.jit)/1000;
        if(KP){
          /* variations : tous les quatre temps une petite relance sur le dernier temps, une mesure sur quatre le contretemps anticipé, en fin de section un roulement qui monte */
          const F=KFILL[S.perc.kit], secEnd=endSec&&k>=barE-2*MD, beatFill=!secEnd&&bi%4===3&&k>=barE-MD;
          let sl=KP[k]||"/", ramp=1;
          if(F&&secEnd){ sl=F[1]; ramp=0.6+0.55*(k-(barE-2*MD))/(2*MD); }
          else if(F&&beatFill) sl=F[0];
          else if(bi%4===2&&k===lastT(KP)){ const [a1,b1]=sl.split("/"); sl=a1.replace(/T/g,"")+"/"+(b1||"")+"T"; }
          let [on,off]=sl.split("/");
          const sixt=E*0.5+(odd?0:S.swing*E*0.25), rest=S.perc.kit!=="electro"&&sym==="s"&&bi%8===4&&f1<0.5;
          [[on,0],[off,1]].forEach(([str,sub])=>{
            if(!str) return; const tb=t+(sub?sixt:0);
            for(const ch of str){
              if(ch==="K"){ if(rest) continue; const v=0.95*acc(k,sub)*ramp; stomp(at(tb,"K"),v); if(o.onNote) o.onNote(tb,0,"stomp",0,v); }
              else if(ch==="k"){ if(rest) continue; const v=0.62*acc(k,sub); stomp(at(tb,"K"),v); if(o.onNote) o.onNote(tb,0,"stomp",0,v); }
              else if(ch==="T"){ const v=0.58*acc(k,sub)*tSoft*ramp; tap(at(tb,"T"),v); if(o.onNote) o.onNote(tb,0,"tap",0,v); }
              else if(ch==="t"){ const v=0.42*acc(k,sub)*tSoft*ramp; tap(at(tb,"T"),v); if(o.onNote) o.onNote(tb,0,"tap",0,v); }
              else if(ch==="h"||ch==="H"){ if(R.p()<(ch==="H"?1-0.25*busy:shP)){ const v=(0.12+R.p()*0.06)*acc(k,sub)*1.15; shaker(at(tb,"h"),v); if(o.onNote) o.onNote(tb,0,"shk",0,v); } }
              else if(ch==="g"){ if(R.p()<ghP){ const v=0.16+0.08*R.p(); tap(at(tb,"T"),v); } }
            }
          });
        }else{
        /* tambour sur cadre : la grille de la mesure, avec ses variations de forme */
        if(sym==="S"&&k===0&&bi%4===0&&f1<0.7){ stomp(at(t,"K"),1); if(o.onNote) o.onNote(t,0,"stomp",0,1); }
        else if(sym==="s"&&bi%8===4&&f1<0.5){ /* le deuxième temps tombe : un silence qui fait respirer */ }
        else if(sym==="S"){ const v=0.95*acc(k,0); stomp(at(t,"K"),v); if(o.onNote) o.onNote(t,0,"stomp",0,v); } else if(sym==="s"){ const v=0.6*acc(k,0); stomp(at(t,"K"),v); if(o.onNote) o.onNote(t,0,"stomp",0,v); }
        else if(sym==="T"){ const v=(0.5+R.p()*0.15)*acc(k,0); tap(at(t,"T"),v); if(o.onNote) o.onNote(t,0,"tap",0,v); } else if(sym==="t"){ const v=(0.4+R.p()*0.1)*acc(k,0); tap(at(t,"T"),v); if(o.onNote) o.onNote(t,0,"tap",0,v); }
        else{
          if(R.p()<shP){ const v=0.1+R.p()*0.08; shaker(at(t,"h"),v); if(o.onNote) o.onNote(t,0,"shk",0,v); }
          if(k===barE-3&&R.p()<ghP) tap(at(t,"T"),0.2);
        }
        if(!endPhr&&bi%2===1&&odd&&sym!=="S"&&sym!=="s"&&sym!=="T"&&sym!=="t"&&f2<S.perc.ghost*0.35){ tap(at(t,"T"),0.14+0.1*f1); }
        }
        /* couche euclidienne : k frappes réparties au plus juste sur les doubles croches de la mesure, nombre et décalage tirés à chaque section */
        if((S.perc.eucl||0)>0.001){
          const n=barE*2, si=Math.floor(bi/Math.max(1,S.sectionBars)), hr=mulberry32((seed^Math.imul(si+1,0x2545F491))>>>0), kk=Math.max(2,Math.round(n*(0.22+0.33*hr()))), rot=Math.floor(hr()*n);
          const on=i=>((((i+rot)%n)*kk)%n)<kk; /* Bresenham : kk frappes sur n cases, aussi régulières que possible */
          [0,1].forEach(sb=>{ if(on(k*2+sb)&&R.p()<S.perc.eucl*(1-0.4*busy)){ const tt=t+sb*E*0.5, v=(0.13+0.07*R.p())*acc(k,sb); shaker(at(tt,"h"),v); if(o.onNote) o.onNote(tt,0,"shk",0,v); } });
        }
        /* relance de fin de phrase, roulement de fin de section, montée vers une section plus forte */
        if(!KP&&endPhr&&endBar&&f2<(endSec?0.95:0.6)){ const v=0.2+0.1*(k-(barE-2))+0.25*f1; tap(at(t+(endSec&&k===barE-1?E*0.5:0),"T"),v); if(o.onNote) o.onNote(t,0,"tap",0,v); }
        if(arcRise(cur.perc,bar/2)&&odd){ const v=0.22+0.5*R.p(); tap(at(t,"T"),v); if(o.onNote) o.onNote(t,0,"tap",0,v); }
      } else { R.p(); }
      cur.perc+=E; cur.k++;
    }
    /* plain-chant : l'air grégorien du texte choisi, chanté syllabe par syllabe ; une respiration entre les phrases, un long silence avant de reprendre */
    { const P=S.plain||{lvl:0};
      if(!(M&&want("plain")&&P.lvl>0.001)){ if(cur.pl<until) cur.pl=until; }
      else while(cur.pl<until){
        const seq=plainSeq(), ph=seq[cur.pli%seq.length], beat=E*(METERS[S.meter].d||2)*(P.slow||1.5), j=cur.plj, base=12*((P.reg===undefined?1:P.reg));
        const off=base+ph.n[Math.min(j,ph.n.length-1)], last=j>=ph.syl.length-1, L=beat*(last?2:1)*0.95;
        singSyl(ph.syl[j],cur.pl,freq(off),0.2,L,V.plain.node,0); if(o.onNote) o.onNote(cur.pl,off,"play",L,0.2);
        cur.pl+=beat*(last?2:1);
        if(last){ cur.plj=0; cur.pli++; cur.pl+=beat*(cur.pli%seq.length===0?6:1.5); } else cur.plj++;
      }
    }
    /* arpège : l'accord en cours, égrené note à note (montant, va-et-vient, Alberti), sur le registre choisi ; le pilier de l'accompagnement en dungeon synth */
    { const A=S.arp||{lvl:0};
      if(!(M&&want("arp")&&A.lvl>0.001)){ if(cur.arp<until) cur.arp=t0+Math.ceil((until-t0)/E)*E; }
      else while(cur.arp<until){
        const rt=Number(A.rate)||1, st=E*(rt===2?0.5:rt===0.5?2:1), tt=cur.arp, ch=chordAt(tt+0.001), pcs=chordPcs(ch), base=12*((A.reg===undefined?1:A.reg)), top=base+12*(A.span||1)+7, tones=[];
        for(let x=base;x<=top;x+=0.5){ const pc=((x%12)+12)%12; if(pcs.some(p=>Math.abs(p-pc)<0.01)) tones.push(x); }
        if(tones.length){
          const sinceChord=Math.max(0,Math.round((tt-ch.t)/st)), pat=A.pat||"vaetvient";
          let seq=tones;
          if(pat==="turing"||(pat==="auto"&&rcAt(tt)<0.5)){ /* machine de Turing : huit pas d'indices dans l'accord, verrouillés ; de temps en temps un pas se réécrit */
            if(!cur.tma) cur.tma=Array.from({length:8},(_,i)=>Math.floor(hz(seed*0.001+i*3.3)*8));
            const st8=sinceChord%8, lock=0.86+0.12*rcAt(tt); if(hz(tt*5.17+st8)>lock) cur.tma[st8]=Math.floor(hz(tt*9.31)*8);
            seq=[tones[cur.tma[st8]%tones.length]];
          } else if(pat==="vaetvient") seq=tones.concat(tones.slice(1,-1).reverse()); else if(pat==="alberti"){ const n=tones.length; seq=[tones[0],tones[Math.min(n-1,2)],tones[Math.min(n-1,1)],tones[Math.min(n-1,2)]]; }
          const off=seq.length===1?seq[0]:seq[sinceChord%seq.length], beat=Math.round((tt-t0)/E)%(MD*1)===0, vel=(beat?0.19:0.14)*(0.9+0.2*hz(tt*3.7)), len=st*(A.inst==="harpe"||A.inst==="luth"||A.inst==="kalimba"?3:1.4);
          instOf(A.inst||"harpe","harpe")(sw(tt),freq(off),vel,len,V.arp.node,((cur.aj++%2)?0.3:-0.3));
          if(o.onNote) o.onNote(sw(tt),off,"loop",len,vel);
        }
        cur.arp+=st;
      }
    }
    /* nappes */
    ensureChords(until);
    for(const ch of chordTl){
      if(ch.sched||ch.t>=until) continue;
      ch.sched=true; lastD=ch.d;
      if(M&&want("pad")&&S.pad.lvl>0.001){
        const stg=clamp(S.pad.stag===undefined?0.5:S.pad.stag,0,1)*ambE(), bs=clamp(S.pad.bass===undefined?0.5:S.pad.bass,0,1), n=ch.iv.length, beat=2*E, qb=x=>Math.round(x/beat)*beat, vs=ch.offs.slice().sort((a,b)=>a-b);
        const put=(t,len,off)=>{ padVoice(t,len,freq(off),S.pad.timbre); rec(2,t,off,len,0.3); if(o.onNote) o.onNote(t,off,"pad",len,0.3); };
        vs.forEach((off,i)=>{
          /* chaque voix entre à son tour ; la voix du milieu change parfois de note en cours d'accord */
          const dl=qb(stg*ch.len*0.3*(i+R.s()*0.6)/Math.max(1,vs.length-1)), len=Math.max(bar*0.5,ch.len-dl+(R.s()<stg*0.5?bar:0)), mid=i>0&&i<vs.length-1&&R.s()<stg*0.7;
          if(mid){ const j=ch.iv.map(x=>x+12*Math.round((off-x)/12)).sort((a,b)=>Math.abs(a-off)-Math.abs(b-off)), nb=j.find(x=>x!==off&&Math.abs(x-off)<=3), cut=Math.max(beat,qb(len*(0.4+0.25*R.s()))); if(nb!==undefined&&cut<len-beat/2&&!vs.includes(nb)){ put(ch.t+dl,cut,off); put(ch.t+dl+cut,len-cut,nb); return; } }
          put(ch.t+dl,len,off);
        });
        if(bs>0.02){
          /* octave au-dessus du bourdon ; muette quand sa fondamentale frotte contre la tonique (seconde ou septième) ou contre la quinte (demi-ton) */
          const root=ch.iv[ch.d%n]||0, pc=pcOf(root), dist=x=>{ const d=Math.abs(pcOf(pc-x)); return Math.min(d,12-d); }, rub=(dist(0)>0&&dist(0)<=2)||(dist(7)>0&&dist(7)<=1), bo=pc+12;
          if(!rub){ padVoice(ch.t,ch.len,freq(bo),S.pad.timbre,0.5+bs); rec(2,ch.t,bo,ch.len,0.3*bs,"bass"); if(o.onNote) o.onNote(ch.t,bo,"pad",ch.len,0.3*bs); }
        }
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
          const tt=lp.next, iv=ivOf(S,secOf(tt).key), th=FS.theme[0]&&FS.theme[0].notes, li=loopsL.indexOf(lp);
          /* quand un thème existe, chaque boucle en porte une note : le thème se recompose tout seul, à la manière d'Eno */
          const off=(th&&th.length)?th[(li*2)%th.length].off+12*(lp.oct-1):degOff(iv,lp.deg)+12*lp.oct, vel=lp.vel*(0.85+0.3*R.l());
          if(R.l()>=(((S.chance||{}).skip)||0)*1.5){
          fn(tt,freq(off),vel,E*10,V.loops.node,lp.pan);
          rec(3,tt,off,E*10,vel);
          if(o.onNote) o.onNote(tt,off,"loop",E*10,vel); }
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
          /* les pendules sonnent les notes de l'accord en cours, comme des cloches qui ponctuent */
          const cpc=chordPcs(chordAt(tt)), iv=ivOf(S,secOf(tt).key), cand=[]; for(let x=12;x<36;x+=0.5){ const pc=((x%12)+12)%12; if(cpc.some(p=>Math.abs(p-pc)<0.01)) cand.push(x); }
          const off=cand.length?cand[i%cand.length]:degOff(iv,i)+12, vel=0.17-0.07*i/N;
          fn(tt,freq(off),vel,E*6,V.pend.node,(i/Math.max(1,N-1)*2-1)*0.85);
          rec(4,tt,off,E*6,vel);
          if(o.onNote) o.onNote(tt,off,"pend",E*6,vel);
        }
      }
    }
    /* billes : chacune tombe, rebondit en perdant de l'énergie (chaque vol dure « rebond » fois le précédent),
       s'immobilise, puis est relâchée. Un rebond = une note, d'autant plus douce que la bille est fatiguée. */
    {
      const BL=S.bille||{}, on=M&&(BL.lvl||0)>0.001&&want("bille"), fn=instOf(BL.inst||"kalimba","kalimba"), e=clamp(BL.rebond||0.72,0.3,0.93);
      billes.forEach((b,i)=>{
        let guard=0;
        while(b.t<until&&guard++<400){
          if(b.phase==="rest"){ b.phase="fall"; b.drop=b.t; b.D=billeD(i); b.k=0; b.T=0; b.v=1; b.pitch=null; b.t+=b.D;
            /* en deux dimensions : la bille part de biais, ricoche sur les murs ; elle repart de là où elle s'était posée, dans l'autre sens */
            b.dir=-(b.dir||(i%2?-1:1)); b.sx={x0:b.x===undefined?(i+0.5)/billes.length:b.x,vx:(BL.travers===undefined?1:BL.travers)*(0.16+0.07*i)*b.dir,drop:b.drop};
            b.arcs.push({t0:b.drop,t1:b.t,type:"fall",D:b.D,sx:b.sx}); continue; }
          /* impact */
          if(on){
            if(b.pitch===null){ const cpc=chordPcs(chordAt(b.t)), cand=[]; for(let x=12;x<36;x+=0.5){ const pc=((x%12)+12)%12; if(cpc.some(p=>Math.abs(p-pc)<0.01)) cand.push(x); } const iv=ivOf(S,secOf(b.t).key); b.pitch=cand.length?cand[(i*2)%cand.length]+(i>=cand.length?12:0):degOff(iv,i)+12; b.deg=0; }
            let off=b.pitch; if(BL.mode==="clavier"){ const iv=ivOf(S,secOf(b.t).key), K=8, x=billeXof(b.sx,b.t); off=degOff(iv,Math.min(K-1,Math.floor(x*K)))+12; } else if(BL.mode==="descend"){ const iv=ivOf(S,secOf(b.t).key), base=iv.indexOf(((b.pitch%12)+12)%12); off=base>=0?degOff(iv,base-b.k)+12*Math.floor(b.pitch/12):b.pitch-b.k; }
            const vel=0.2*Math.pow(b.v,0.8), pan=(billeXof(b.sx,b.t)*2-1)*0.75;
            fn(b.t,freq(off),vel,Math.max(0.3,E*3),V.bille.node,pan); rec(4,b.t,off,E*3,vel); if(o.onNote) o.onNote(b.t,off,"pend",E*3,vel);
          }
          b.k++; b.T=b.k===1?2*e*b.D:b.T*e; b.v*=e;
          if(b.T<0.035||b.k>60){ b.x=billeXof(b.sx,b.t); b.arcs.push({t0:b.t,t1:b.t+billeD(i)*(BL.pause===undefined?1:BL.pause)+0.5,type:"rest",sx:{x0:b.x,vx:0,drop:b.t}}); b.phase="rest"; b.t+=billeD(i)*(BL.pause===undefined?1:BL.pause)+0.5; }
          else { b.arcs.push({t0:b.t,t1:b.t+b.T,type:"arc",h:(b.T*b.T)/(4*b.D*b.D),sx:b.sx}); b.t+=b.T; }
          if(b.arcs.length>80) b.arcs.splice(0,b.arcs.length-80);
        }
      });
    }
    /* arbre : bourgeons à chaque nouvel étage, puis rafales de vent qui font tinter les feuilles qu'elles traversent */
    if(arbre){
      const A=S.arbre||{}, on=M&&(A.lvl||0)>0.001&&want("arbre"), fn=instOf(A.inst||"verre","verre"), deep=instOf("bol","bol"), rr=arbre.rr, D=arbre.D, P=Math.max(0,(A.pousse===undefined?3:A.pousse)*60), vent=clamp(A.vent===undefined?0.4:A.vent,0,1);
      const grownAt=t=>P<=0?D:clamp((t-arbre.t0)/P*D,0,D);
      const play=(n,t,vel,len)=>{ let off=degOff(ivOf(S,secOf(t).key),n.g)+12;
        if(A.harm!==false){ const cpc=chordPcs(chordAt(t)); if(cpc.length){ let best=off,bd=99; for(let dx=-2;dx<=2;dx+=0.5){ const pc=(((off+dx)%12)+12)%12; if(cpc.some(p=>Math.abs(p-pc)<0.01)&&Math.abs(dx)<bd){ bd=Math.abs(dx); best=off+dx; } } off=best; } }
        n.hits.push(t); if(n.hits.length>6) n.hits.shift(); if(!on) return;
        const pan=(n.x*2-1)*0.8; (n.d<=1?deep:fn)(t,freq(off),vel,len,V.arbre.node,pan); rec(4,t,off,len,vel); if(o.onNote) o.onNote(t,off,"pend",len,vel); };
      /* bourgeons : quand un étage apparaît, ses branches s'éveillent une à une */
      while(arbre.budL<D&&arbre.t0+(P<=0?0:P*(arbre.budL+1)/D)<until){ const L=++arbre.budL, tL=arbre.t0+(P<=0?0:P*L/D)+1;
        if(P>0) arbre.nodes.filter(n=>n.d===L).forEach((n,k)=>play(n,tL+k*0.9*E+rr()*0.3,0.06,E*4)); }
      /* rafales */
      let guard=0;
      while(arbre.next<until&&guard++<50){ const tg=arbre.next, gd=grownAt(tg), c=rr(), w=0.07+0.17*rr(), str=(0.35+0.65*rr())*(0.4+0.6*vent), dir=rr()<0.5?-1:1;
        arbre.nodes.forEach(n=>{ if(n.d>gd+0.001) return; const dist=Math.abs(n.x-c); if(dist>w) return; const leaf=n.d>=Math.floor(gd);
          if(leaf&&rr()>0.3+0.5*str) return; if(!leaf&&rr()>0.2*str) return; if(n.d===0&&str<0.75) return;
          const t=tg+((n.x-c)*dir+w)*(1.6+1.2*(1-vent))+rr()*0.25, vel=(leaf?0.12:0.09)*str*(1-0.6*dist/w);
          play(n,t,vel,leaf?E*3:E*8); });
        arbre.next=tg+(-Math.log(1-rr()*0.98))/(0.025+0.3*vent); }
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
      { const nt=natv(); BEASTS.forEach(k=>{ const v=nt[k]||0; if(cur["b_"+k]===undefined) cur["b_"+k]=t0+2+R.t()*BEAST_T[k]*0.4;
        while(cur["b_"+k]<until){ const t=cur["b_"+k]; if(v>0.001) beast(k,t,v); cur["b_"+k]=t+BEAST_T[k]*(0.5+R.t())/(0.25+v*1.75); } }); }
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
    cur.perc=t+bar*Math.ceil(4/bar); cur.k=0; cur.mel=t+bar*Math.ceil(7/bar); cur.pad=t; cur.int=t; cur.sec=1; cur.arp=t+bar; cur.aj=0; cur.pl=t+bar*2; cur.pli=0; cur.plj=0; chordEnd=t;
    cur.drone=t+25+R.d()*20; cur.clink=t+10; cur.fire=t; cur.wind=t; cur.drip=t+4; cur.bird=t+3; started=true;
    bands.forEach(b=>b.cur=t);
    initLoops(t);
    pendK=Array.from({length:pendN()},()=>0);
    initBilles(t+bar*0.5);
    initArbre(t);
  }
  /* billes : temps de chute de chacune (plus haute = chute plus longue, rythmes qui s'entrecroisent) */
  const billeN=()=>clamp(Math.round((S.bille&&S.bille.count)||3),1,6);
  const billeD=i=>Math.max(0.25,((S.bille&&S.bille.haut)||1)*bar*(1+0.37*i));
  function initBilles(t){ const n=billeN(); billes=Array.from({length:n},(_,i)=>({phase:"rest",t:t+i*bar*0.75,x:(i+0.5)/n,arcs:[{t0:0,t1:t+i*bar*0.75,type:"hang",sx:{x0:(i+0.5)/n,vx:0,drop:0}}]})); }
  /* position horizontale (0 à 1) : mouvement uniforme, réfléchi par les deux murs */
  const billeXof=(sx,t)=>{ if(!sx) return 0.5; let u=sx.x0+sx.vx*(t-sx.drop)/bar; u=((u%2)+2)%2; return u>1?2-u:u; };
  /* arbre : une ramure fractale qui pousse ; tronc et branches graves, feuilles aiguës ; des rafales de vent la traversent */
  function initArbre(t){
    const A=S.arbre||{}, D=clamp(Math.round(A.prof||4),2,6), rr=mulberry32((seed^0x7A3B1E)>>>0), nodes=[];
    const grow=(par,x,y,ang,len,d,g)=>{ const nx=x+len*Math.sin(ang), ny=y+len*Math.cos(ang), i=nodes.length; nodes.push({x:nx,y:ny,px:x,py:y,par,d,g:Math.min(16,g),hits:[]});
      if(d<D){ const sp=0.38+0.2*rr(); grow(i,nx,ny,ang-sp*(0.8+0.4*rr()),len*(0.68+0.08*rr()),d+1,g+2); grow(i,nx,ny,ang+sp*(0.8+0.4*rr()),len*(0.68+0.08*rr()),d+1,g+4); } };
    grow(-1,0,0,0,0.32,0,-7);
    let x0=1e9,x1=-1e9,y1=0; nodes.forEach(n=>{ x0=Math.min(x0,n.x,n.px); x1=Math.max(x1,n.x,n.px); y1=Math.max(y1,n.y); });
    nodes.forEach(n=>{ const f=v=>(v-x0)/Math.max(1e-6,x1-x0); n.x=f(n.x); n.px=f(n.px); n.y/=y1; n.py/=y1; });
    arbre={nodes,D,t0:t,rr,next:t+2+rr()*4,budL:0};
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
      const old=V[name].node; old.gain.cancelScheduledValues(now); old.gain.setTargetAtTime(0,now,tc||0.03); synDrop(ctx,old,now+Math.max(0.2,(tc||0.03)*6)); synOwn.delete(old);
      if(typeof setTimeout==="function") setTimeout(()=>{ try{ old.disconnect(); }catch(e){} },1500);
      newGen(name);
    };
    if(all){ for(const k in COL) delete COL[k]; FS.ref.length=0; FS.theme.length=0; FS.ost=null; FS.ostN=0; TM.steps=null; ctr.pm=ctr.pc=ctr.li=null; }
    if(all||what==="mel"){ kill("mel"); kill("canon"); padRest(now); cur.mel=t0+Math.ceil((now+0.04-t0)/E)*E; }
    if(all||what==="pad"){ kill("pad",0.15); while(chordTl.length&&chordTl[chordTl.length-1].t>=now) chordTl.pop(); chordEnd=now+0.04; }
    if(all||what==="loops"){ kill("loops",0.05); initLoops(now); }
    if(all||what==="plain"){ kill("plain",0.05); cur.pl=t0+Math.ceil((now+0.05-t0)/bar)*bar; cur.plj=0; }
    if(all||what==="arp"){ kill("arp",0.05); cur.arp=t0+Math.ceil((now+0.05-t0)/E)*E; }
    if(all) dawReplan();
    if(all||what==="bille"){ kill("bille",0.05); initBilles(now+0.05); }
    if(all||what==="arbre"){ kill("arbre",0.05); const old=arbre; initArbre(old?old.t0:now); if(old){ arbre.next=Math.max(arbre.next,now+0.5); arbre.budL=old.budL; } }
    if(all||what==="pend"){
      kill("pend",0.05); const T=Math.max(1,S.pend.period*bar);
      pendK=Array.from({length:pendN()},(_,i)=>Math.max(0,Math.ceil(((now-t0)/T)*(PEND_N0+i)-0.25)));
    }
  }

  /* gestes musicaux, posés sur la prochaine noire : suspense, révélation, danger, poursuite, triomphe, apaisement.
     amp (0 discret, 1 plein, 2 immense) règle la durée, la force et la densité ; renvoie la durée en secondes (0 si rien n'est parti) */
  function gesture(name,amp){
    if(!started) return 0;
    const A=[0.6,1,1.7][amp===undefined||amp===null?1:Math.max(0,Math.min(2,Math.round(amp)))];
    const now=ctx.currentTime, tq=t0+Math.ceil((now+0.15-t0)/(2*E))*(2*E), iv=ivOf(S,secOf(tq).key), n=iv.length, big=A>1.3;
    const ramp=(g,v,t,tc)=>{ g.cancelScheduledValues(Math.max(now,t-0.001)); g.setTargetAtTime(v,t,tc); };
    const back=(names,t)=>names.forEach(k=>ramp(B[k].gs.gain,1,t,0.7));
    const mk=fn=>(t,off,v,len)=>{ fn(t,freq(off),v,len,B.play.in,0); if(o.onNote) o.onNote(t,off,"play",len,v); };
    const note=mk(instOf(S.mel.inst,"luth")), brass=mk(instOf("cuivre","luth"));
    const chord=(t,len,offs)=>offs.forEach(x=>padVoice(t,len,freq(x),S.pad.timbre));
    const deg=k=>degOff(iv,k);
    let len=0;
    if(name==="suspense"){
      len=bar*(1+2*A); const dom=Math.round(n*4/7)%n; ramp(B.mel.gs.gain,0,now,0.2); ramp(B.perc.gs.gain,0.15,now,0.4); ramp(B.pad.gs.gain,1+0.5*A,tq,1.2); ramp(B.drone.gs.gain,1+0.4*A,tq,1.2);
      chord(tq,len,[deg(dom)+12,deg(dom+2)+12,deg(dom+4)+12].concat(big?[deg(dom+6)+12,deg(dom)+24]:[]));
      back(["mel","perc","pad","drone"],tq+len);
    }else if(name==="revelation"){
      len=bar*(1+2*A); ramp(B.pad.gs.gain,1+0.35*A,tq,0.6); ramp(B.mel.gs.gain,1+0.15*A,tq,0.6);
      chord(tq,len,[0,4,7,11,16].map(x=>x+12).concat(big?[19+12,23+12]:[]));
      const run=Math.round(4+2*A); for(let i=0;i<run;i++) note(tq+i*E*0.5,deg(i)+12,0.2-0.008*i,E*3);
      note(tq+run*E*0.5,deg(run+1)+12,0.22,E*(big?12:8)); back(["pad","mel"],tq+len);
    }else if(name==="danger"){
      len=bar*(2+2*A); ramp(B.perc.gs.gain,1+0.9*A,tq,0.3); ramp(B.drone.gs.gain,1+0.5*A,tq,0.4); ramp(B.mel.gs.gain,0.4,tq,0.3);
      const m=Math.round(8*A); for(let k=0;k<m;k++){ const t=tq+k*E; note(t,k%2?-6:-12,0.3-0.012*k,E*1.6); if(k%2===0) note(t+E*0.5,-12+(k%4===0?0:1),0.16,E); }
      back(["perc","drone","mel"],tq+len);
    }else if(name==="poursuite"){
      len=bar*(1+2*A); ramp(B.perc.gs.gain,1+1.1*A,tq,0.25); ramp(B.drone.gs.gain,1+0.3*A,tq,0.4); ramp(B.mel.gs.gain,0.6,tq,0.3);
      const pat=[0,0,2,0,0,4,0,2], m=Math.floor(len/E)-1; for(let k=0;k<m;k++){ const acc=k%4===0; note(tq+k*E,deg(pat[k%8])-(big?24:12),acc?0.3:0.2,E*0.55); if(big&&acc) note(tq+k*E,deg(pat[k%8])-12,0.16,E*0.5); }
      back(["perc","drone","mel"],tq+len);
    }else if(name==="triomphe"){
      len=bar*(2+A); ramp(B.perc.gs.gain,1+0.6*A,tq,0.3); ramp(B.pad.gs.gain,1+0.4*A,tq,0.5); ramp(B.mel.gs.gain,0.5,tq,0.3);
      const seq=[0,2,4,7,4,7,9]; seq.forEach((d,i)=>brass(tq+i*E*0.5,deg(d)+12,0.26-0.01*i,E*0.8)); const tf=tq+seq.length*E*0.5;
      chord(tf,len-seq.length*E*0.5,[deg(0)+12,deg(2)+12,deg(4)+12,deg(0)+24].concat(big?[deg(4)+24]:[])); brass(tf,deg(7)+12,0.28,E*(big?10:6)); if(big) brass(tf,deg(0)+12,0.2,E*10);
      back(["perc","pad","mel"],tq+len);
    }else if(name==="apaisement"){
      len=bar*(2+2*A); ramp(B.perc.gs.gain,0.05,now,0.5); ramp(B.mel.gs.gain,0.35,now,0.5); ramp(B.pad.gs.gain,1+0.3*A,tq,1.4); ramp(B.drone.gs.gain,1+0.2*A,tq,1.4);
      chord(tq,len,[deg(0),deg(4),deg(0)+12,deg(2)+12]); note(tq+bar,deg(0)+12,0.12,E*10);
      back(["perc","mel","pad","drone"],tq+len);
    }else return 0;
    return len;
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
    padOpen(t,len,v);
    if(o.onNote) o.onNote(t,off,"play",len,v);
    return t;
  }
  function stop(now,tc){ master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0,now,tc||0.4); }
  /* fondu enchaîné : l'ancien moteur s'éteint sur d secondes puis libère ses oscillateurs */
  function fadeOut(now,d){
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value,now); master.gain.linearRampToValueAtTime(0,now+d);
    starts.forEach(x=>{try{x.stop(now+d+0.2);}catch(e){}});
    synDropAll(ctx,now+d+0.3,[...synOwn]);
  }
  /* position de chaque bille pour l'affichage : x de 0 à 1 entre les murs, y = 0 au sol, 1 à la hauteur de départ */
  const billeY=t=>billes.map(b=>{ const a=b.arcs.find(x=>t>=x.t0&&t<x.t1); if(!a) return {x:b.x===undefined?0.5:b.x,y:0}; const u=(t-a.t0)/(a.t1-a.t0), x=billeXof(a.sx,t);
    if(a.type==="hang") return {x,y:1}; if(a.type==="fall") return {x,y:1-u*u}; if(a.type==="arc") return {x,y:a.h*4*u*(1-u)}; return {x,y:0}; });
  /* l'arbre pour l'affichage : branches poussées, et l'éclat de chaque nœud (1 juste après qu'il a sonné) */
  const arbreState=t=>{ if(!arbre) return null; const A=S.arbre||{}, P=Math.max(0,(A.pousse===undefined?3:A.pousse)*60), D=arbre.D, gd=P<=0?D:clamp((t-arbre.t0)/P*D,0,D);
    return {grown:gd,nodes:arbre.nodes.map(n=>{ let h=-1; n.hits.forEach(x=>{ if(x<=t&&x>h) h=x; }); return {x:n.x,y:n.y,px:n.px,py:n.py,d:n.d,glow:h<0?0:Math.max(0,1-(t-h)/1.6)}; })}; };
  const pendX=t=>Array.from({length:pendN()},(_,i)=>Math.cos(2*Math.PI*(PEND_N0+i)*(t-t0)/(S.pend.period*bar)));
  built=true; fxAttach();
  /* banque de sons pour le Studio : les instruments, nappes et batteries de la machine, joués vers une destination donnée */
  const bank={
    inst:name=>instOf(name,"luth"),
    pad:(timbre,t,len,f,dst,vol)=>{ const s=V.pad.node; V.pad.node=dst; try{ padVoice(t,len,f,timbre,vol||1); } finally{ V.pad.node=s; } },
    perc:(k,part,t,v,dst)=>{ const s=PB; PB=dst; try{ (KITS[k]||KITS.cadre)[part](t,v); } finally{ PB=s; } },
    kpat:KPAT, kits:Object.keys(KITS), noise:()=>wb
  };
  return {arbreState,billeY,bank,pieceEnd:()=>pieceFade,fxAttach,grainFreeze,fxOn:()=>!!fx,start,schedule,setLevels,setReverb,stop,fadeOut,sleepFade,sleepClear,replan,freeze,reroll,gesture,play,synOn,dawOn,dawNote,rackSync,meter,tap:()=>volG,analyser:k=>k==="all"?anaAll:anaSyn,dawReplan,dawPos,pendX,tensNow:()=>tensAt(ctx.currentTime),adaptNow:()=>adaptE(ctx.currentTime),tensPos:()=>{ if(!curveOn()) return -1; const L=Math.max(30,S.curve.dur*60), x=(ctx.currentTime-t0)/L; return S.curve.mode==='loop'?((x%1)+1)%1:clamp(x,0,1); },events,out,master,secAt:t=>secOf(t),bar,E,t0f:()=>t0,chords:()=>chordTl.slice(),phraseBars:()=>[...phBars],fillBars:()=>fillBars.slice()};
}
