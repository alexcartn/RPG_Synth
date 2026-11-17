"use strict";
/* ============================================================
   STUDIO : le son. Chaînes d'appareils à la Ableton (instrument → effets → fader → envois),
   pistes de retour A et B, master avec limiteur, transport en vue Session, rendu hors ligne en MP3.
   Les timbres viennent de la machine (banque : instruments, nappes, batteries) et du synthé de Forger.
   ============================================================ */
const SON=(()=>{
  const dB=x=>x<=-59.5?0:Math.pow(10,x/20);
  const midiHz=p=>440*Math.pow(2,(p-69)/12);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  /* ---------- appareils (effets audio) ----------
     chaque paramètre : k, n (nom), min, max, def, u (unité), log, opts (liste de [valeur, nom]) */
  const SYNC=[[0.25,"1/16"],[0.5,"1/8"],[0.75,"1/8 pointée"],[1,"1/4"],[1.5,"1/4 pointée"],[2,"1/2"],[4,"1 mesure"]];
  const LFO=[[0,"Fixe"],[0.5,"1/8"],[1,"1/4"],[2,"1/2"],[4,"1 mesure"],[8,"2 mesures"],[16,"4 mesures"],[32,"8 mesures"]];
  const DEV={
    eq:{n:"EQ trois bandes", d:"Égaliseur : baisser ce qui gêne plutôt que monter ce qui manque. Le coupe-bas libère le grave pour le bourdon ou la basse.", p:[
      {k:"cut",n:"Coupe-bas",min:20,max:800,def:20,u:"Hz",log:1},{k:"low",n:"Graves",min:-15,max:15,def:0,u:"dB"},{k:"mid",n:"Médiums",min:-15,max:15,def:0,u:"dB"},
      {k:"fmid",n:"Fréq. méd.",min:150,max:6000,def:900,u:"Hz",log:1},{k:"high",n:"Aigus",min:-15,max:15,def:0,u:"dB"},{k:"top",n:"Coupe-haut",min:1000,max:20000,def:20000,u:"Hz",log:1}],
      build(ctx){ const hp=ctx.createBiquadFilter(), lo=ctx.createBiquadFilter(), mi=ctx.createBiquadFilter(), hi=ctx.createBiquadFilter(), lp=ctx.createBiquadFilter();
        hp.type="highpass"; hp.Q.value=0.7; lo.type="lowshelf"; lo.frequency.value=220; mi.type="peaking"; mi.Q.value=0.9; hi.type="highshelf"; hi.frequency.value=4500; lp.type="lowpass"; lp.Q.value=0.6;
        hp.connect(lo); lo.connect(mi); mi.connect(hi); hi.connect(lp);
        return {in:hp,out:lp,set(p){ hp.frequency.value=p.cut; lo.gain.value=p.low; mi.gain.value=p.mid; mi.frequency.value=p.fmid; hi.gain.value=p.high; lp.frequency.value=Math.min(p.top,ctx.sampleRate*0.45); }}; }},
    filtre:{n:"Filtre auto", d:"Un filtre qui respire au tempo : fait vivre une nappe ou un bourdon tenu. Vitesse « Fixe » pour un simple filtre.", p:[
      {k:"type",n:"Type",def:"lowpass",opts:[["lowpass","Passe-bas"],["highpass","Passe-haut"],["bandpass","Passe-bande"]]},
      {k:"freq",n:"Fréquence",min:40,max:18000,def:2000,u:"Hz",log:1},{k:"res",n:"Résonance",min:0.1,max:18,def:0.8,log:1},
      {k:"rate",n:"Vitesse",def:4,opts:LFO},{k:"depth",n:"Profondeur",min:0,max:1,def:0.3,u:"%"},{k:"mix",n:"Mix",min:0,max:1,def:1,u:"%"}],
      build(ctx,env){ const i=ctx.createGain(), f=ctx.createBiquadFilter(), w=ctx.createGain(), d=ctx.createGain(), o=ctx.createGain(), l=ctx.createOscillator(), lg=ctx.createGain();
        i.connect(f); f.connect(w); w.connect(o); i.connect(d); d.connect(o); l.connect(lg); lg.connect(f.frequency); l.start(env.t0||0);
        return {in:i,out:o,set(p){ f.type=p.type; f.frequency.value=p.freq; f.Q.value=p.res; w.gain.value=p.mix; d.gain.value=1-p.mix;
          const r=+p.rate; l.frequency.value=r>0?1/(r*env.spb()):0.0001; lg.gain.value=r>0?Math.min(p.freq*0.9,p.freq*p.depth*1.6):0; }}; }},
    sat:{n:"Saturateur", d:"Ajoute des harmoniques : réchauffe une nappe trop lisse, donne du grain lo-fi. À doser.", p:[
      {k:"drive",n:"Drive",min:0,max:1,def:0.3,u:"%"},{k:"tone",n:"Tonalité",min:800,max:20000,def:9000,u:"Hz",log:1},{k:"mix",n:"Mix",min:0,max:1,def:1,u:"%"},{k:"out",n:"Sortie",min:-18,max:6,def:-2,u:"dB"}],
      build(ctx){ const i=ctx.createGain(), pre=ctx.createGain(), ws=ctx.createWaveShaper(), lp=ctx.createBiquadFilter(), w=ctx.createGain(), d=ctx.createGain(), o=ctx.createGain(); let last=-1;
        lp.type="lowpass"; ws.oversample="2x"; i.connect(pre); pre.connect(ws); ws.connect(lp); lp.connect(w); w.connect(o); i.connect(d); d.connect(o);
        return {in:i,out:o,set(p){ if(p.drive!==last){ last=p.drive; const k=1+p.drive*24, n=2048, c=new Float32Array(n); for(let j=0;j<n;j++){ const x=j/(n-1)*2-1; c[j]=Math.tanh(k*x)/Math.tanh(k); } ws.curve=c; }
          lp.frequency.value=Math.min(p.tone,ctx.sampleRate*0.45); w.gain.value=p.mix*dB(p.out); d.gain.value=(1-p.mix)*dB(p.out); }}; }},
    chorus:{n:"Chorus · Ensemble", d:"Trois voix qui ondulent, à gauche, au centre, à droite. En mode Ensemble, c'est le son des vieilles machines à cordes du dungeon synth.", p:[
      {k:"mode",n:"Mode",def:"chorus",opts:[["chorus","Chorus"],["ensemble","Ensemble à cordes"]]},{k:"rate",n:"Vitesse",min:0.05,max:5,def:0.6,u:"Hz",log:1},{k:"depth",n:"Profondeur",min:0,max:1,def:0.5,u:"%"},{k:"mix",n:"Mix",min:0,max:1,def:0.5,u:"%"}],
      build(ctx,env){ const i=ctx.createGain(), o=ctx.createGain(), d=ctx.createGain(), w=ctx.createGain(); i.connect(d); d.connect(o); w.connect(o); const L=[];
        [-0.8,0,0.8].forEach((pan,k)=>{ const dl=ctx.createDelay(0.05), p=ctx.createStereoPanner(), l1=ctx.createOscillator(), g1=ctx.createGain(), l2=ctx.createOscillator(), g2=ctx.createGain();
          dl.delayTime.value=0.012; i.connect(dl); dl.connect(p); p.pan.value=pan; p.connect(w); l1.connect(g1); g1.connect(dl.delayTime); l2.connect(g2); g2.connect(dl.delayTime);
          const ph=k/3; l1.start((env.t0||0)+ph/0.6); l2.start((env.t0||0)+ph/5.9); L.push({l1,g1,l2,g2}); });
        return {in:i,out:o,set(p){ const ens=p.mode==="ensemble"; L.forEach(x=>{ x.l1.frequency.value=p.rate; x.g1.gain.value=0.004*p.depth; x.l2.frequency.value=5.9; x.g2.gain.value=ens?0.0007*p.depth:0; });
          w.gain.value=p.mix*0.75; d.gain.value=1-p.mix*0.5; }}; }},
    delay:{n:"Écho", d:"Écho calé sur le tempo. Le ping-pong élargit l'espace ; le filtre assombrit les répétitions pour qu'elles reculent.", p:[
      {k:"time",n:"Temps",def:0.75,opts:SYNC},{k:"fb",n:"Réinjection",min:0,max:0.92,def:0.35,u:"%"},{k:"pp",n:"Ping-pong",def:1,opts:[[1,"Oui"],[0,"Non"]]},
      {k:"tone",n:"Filtre",min:500,max:12000,def:4000,u:"Hz",log:1},{k:"mix",n:"Mix",min:0,max:1,def:0.3,u:"%"}],
      build(ctx,env){ const i=ctx.createGain(), o=ctx.createGain(), d=ctx.createGain(), w=ctx.createGain(), dl=ctx.createDelay(4), dr=ctx.createDelay(4), fl=ctx.createBiquadFilter(), fb=ctx.createGain(), cross=ctx.createGain(), self=ctx.createGain(), mg=ctx.createChannelMerger(2), mono=ctx.createGain();
        fl.type="lowpass"; i.connect(d); d.connect(o); i.connect(mono); mono.channelCount=1; mono.channelCountMode="explicit"; mono.connect(dl);
        dl.connect(fl); fl.connect(cross); cross.connect(dr); dr.connect(fb); fb.connect(dl); fl.connect(self); self.connect(dl);
        dl.connect(mg,0,0); dr.connect(mg,0,1); mg.connect(w); w.connect(o);
        return {in:i,out:o,set(p){ const t=Math.min(3.9,(+p.time)*env.spb()); dl.delayTime.value=t; dr.delayTime.value=t; fl.frequency.value=p.tone;
          const pp=+p.pp===1; cross.gain.value=pp?1:0; fb.gain.value=pp?p.fb:0; self.gain.value=pp?0:p.fb; if(!pp){ dr.delayTime.value=t; } w.gain.value=p.mix; d.gain.value=1-p.mix*0.5; }}; }},
    reverb:{n:"Réverb", d:"La salle. En insert sur une piste, ou mieux : à 100 % sur le retour A, et chaque piste y envoie ce qu'il faut.", p:[
      {k:"decay",n:"Durée",min:0.4,max:14,def:3.5,u:"s",log:1},{k:"damp",n:"Amorti",min:0,max:1,def:0.5,u:"%"},{k:"pre",n:"Prédélai",min:0,max:250,def:20,u:"ms"},
      {k:"low",n:"Coupe-bas",min:20,max:800,def:180,u:"Hz",log:1},{k:"mix",n:"Mix",min:0,max:1,def:0.3,u:"%"}],
      build(ctx,env){ const i=ctx.createGain(), o=ctx.createGain(), d=ctx.createGain(), w=ctx.createGain(), pre=ctx.createDelay(0.5), hp=ctx.createBiquadFilter(), cv=ctx.createConvolver(); let key="", tm=null;
        hp.type="highpass"; i.connect(d); d.connect(o); i.connect(pre); pre.connect(hp); hp.connect(cv); cv.connect(w); w.connect(o);
        const mk=p=>{ cv.buffer=impulse(ctx,p.decay,p.damp); };
        return {in:i,out:o,set(p){ pre.delayTime.value=p.pre/1000; hp.frequency.value=p.low; w.gain.value=p.mix*1.3; d.gain.value=1-p.mix;
          const k=p.decay.toFixed(2)+"|"+p.damp.toFixed(2); if(k!==key){ key=k; if(env.offline||!cv.buffer) mk(p); else{ clearTimeout(tm); tm=setTimeout(()=>mk(p),140); } } }}; }},
    bande:{n:"Bande", d:"Le vieux magnéto : pleurage, scintillement, usure des aigus et souffle. L'âme lo-fi du dungeon synth des années 90.", p:[
      {k:"wow",n:"Pleurage",min:0,max:1,def:0.3,u:"%"},{k:"flutter",n:"Scintillement",min:0,max:1,def:0.2,u:"%"},{k:"wear",n:"Usure",min:0,max:1,def:0.3,u:"%"},{k:"hiss",n:"Souffle",min:0,max:1,def:0.1,u:"%"}],
      build(ctx,env){ const i=ctx.createGain(), o=ctx.createGain(), dl=ctx.createDelay(0.05), lp=ctx.createBiquadFilter(), sh=ctx.createWaveShaper(), w1=ctx.createOscillator(), g1=ctx.createGain(), w2=ctx.createOscillator(), g2=ctx.createGain();
        dl.delayTime.value=0.006; lp.type="lowpass"; lp.Q.value=0.5; const c=new Float32Array(1024); for(let j=0;j<1024;j++){ const x=j/1023*2-1; c[j]=Math.tanh(1.6*x)/Math.tanh(1.6); } sh.curve=c;
        i.connect(dl); dl.connect(sh); sh.connect(lp); lp.connect(o); w1.frequency.value=0.55; w2.frequency.value=6.8; w1.connect(g1); g1.connect(dl.delayTime); w2.connect(g2); g2.connect(dl.delayTime); w1.start(env.t0||0); w2.start(env.t0||0);
        const ns=ctx.createBufferSource(); ns.buffer=env.noise; ns.loop=true; const nh=ctx.createBiquadFilter(); nh.type="highpass"; nh.frequency.value=3500; const ng=ctx.createGain(); ns.connect(nh); nh.connect(ng); ng.connect(o); ns.start(env.t0||0);
        return {in:i,out:o,set(p){ g1.gain.value=0.0025*p.wow; g2.gain.value=0.00025*p.flutter; lp.frequency.value=18000*Math.pow(2600/18000,p.wear); ng.gain.value=0.012*p.hiss*p.hiss; }}; }},
    comp:{n:"Compresseur", d:"Resserre la dynamique. Sur le master, un réglage doux (ratio 2, attaque lente) colle les couches ensemble.", p:[
      {k:"thr",n:"Seuil",min:-50,max:0,def:-18,u:"dB"},{k:"ratio",n:"Ratio",min:1,max:20,def:3,log:1},{k:"att",n:"Attaque",min:1,max:200,def:15,u:"ms",log:1},{k:"rel",n:"Relâche",min:20,max:1000,def:200,u:"ms",log:1},{k:"gain",n:"Gain",min:0,max:18,def:3,u:"dB"}],
      build(ctx){ const c=ctx.createDynamicsCompressor(), g=ctx.createGain(); c.knee.value=8; c.connect(g);
        return {in:c,out:g,set(p){ c.threshold.value=p.thr; c.ratio.value=p.ratio; c.attack.value=p.att/1000; c.release.value=p.rel/1000; g.gain.value=dB(p.gain); }}; }},
    util:{n:"Utilitaire", d:"Gain et largeur stéréo. Passe en mono les sons graves pour un mix solide.", p:[
      {k:"gain",n:"Gain",min:-24,max:12,def:0,u:"dB"},{k:"width",n:"Largeur",min:0,max:1.5,def:1,u:"%"}],
      build(ctx){ const i=ctx.createGain(), sp=ctx.createChannelSplitter(2), mg=ctx.createChannelMerger(2), o=ctx.createGain();
        const LL=ctx.createGain(), LR=ctx.createGain(), RL=ctx.createGain(), RR=ctx.createGain(); i.connect(sp); sp.connect(LL,0); sp.connect(LR,0); sp.connect(RL,1); sp.connect(RR,1);
        LL.connect(mg,0,0); RL.connect(mg,0,0); LR.connect(mg,0,1); RR.connect(mg,0,1); mg.connect(o);
        return {in:i,out:o,set(p){ const w=p.width, a=(1+w)/2, b=(1-w)/2; LL.gain.value=a; RR.gain.value=a; LR.gain.value=b; RL.gain.value=b; o.gain.value=dB(p.gain); }}; }}
  };
  const DEV_ORDER=["eq","filtre","sat","chorus","delay","reverb","bande","comp","util"];
  /* réponse impulsionnelle : bruit stéréo qui décroît (durée = RT60), les aigus s'éteignant plus vite avec l'amorti */
  const irCache=new Map();
  function impulse(ctx,dur,damp){
    const sr=ctx.sampleRate, n=Math.floor(sr*Math.min(15,dur*1.15)), key=sr+"|"+n+"|"+damp.toFixed(2);
    let data=irCache.get(key);
    if(!data){ data=[0,1].map(ch=>{ const a=new Float32Array(n); let s=(ch+1)*0x9E3779B1>>>0, lp=0; const k=6.9/(dur*sr);
      for(let i=0;i<n;i++){ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; const x=(s/4294967296)*2-1, tt=i/n, c=Math.min(0.97,0.08+damp*0.85*tt+0.02);
        lp+=(x-lp)*(1-c); a[i]=lp*Math.exp(-k*i)*(i<sr*0.004?i/(sr*0.004):1); }
      return a; }); if(irCache.size>8) irCache.clear(); irCache.set(key,data); }
    const b=ctx.createBuffer(2,n,sr); b.getChannelData(0).set(data[0]); b.getChannelData(1).set(data[1]); return b;
  }

  /* ---------- graphe : pistes, retours, master ---------- */
  function makeGraph(ctx,P,opt){
    opt=opt||{};
    const G=v=>{ const g=ctx.createGain(); g.gain.value=v===undefined?1:v; return g; };
    const bankS=clone(DEFAULT); bankS.tempo=P.tempo; bankS.mach=true;
    const eng=buildEngine(ctx,bankS,{solo:"studio",lite:false}), bank=eng.bank;
    const noise=bank.noise();
    const env={spb:()=>60/P.tempo, noise, offline:!!opt.offline, t0:0};
    const out=opt.dest||ctx.destination;
    /* master : appareils, fader, limiteur */
    const M={in:G(1), fader:G(1), lim:ctx.createDynamicsCompressor(), ana:ctx.createAnalyser(), devs:new Map(), list:[]};
    M.lim.threshold.value=-1.5; M.lim.knee.value=0; M.lim.ratio.value=20; M.lim.attack.value=0.002; M.lim.release.value=0.12;
    M.fader.connect(M.lim); M.lim.connect(out); M.ana.fftSize=1024; M.lim.connect(M.ana);
    const prev=G(0.8); prev.connect(M.in);
    function chain(holder,devs,head,tail){
      /* relie head → appareils actifs → tail, en réutilisant les appareils déjà construits */
      const keep=new Set();
      devs.forEach(d=>{ keep.add(d.id); let w=holder.devs.get(d.id); if(!w||w.type!==d.type){ const D=DEV[d.type]; if(!D) return; const x=D.build(ctx,env); w={type:d.type,x,in:G(1),out:G(1)}; w.in.connect(x.in); x.out.connect(w.out); holder.devs.set(d.id,w); }
        w.x.set(d.p); w.on=d.on!==false; });
      holder.devs.forEach((w,id)=>{ if(!keep.has(id)){ try{ w.out.disconnect(); w.in.disconnect(); }catch(e){} holder.devs.delete(id); } });
      try{ head.disconnect(); }catch(e){} holder.devs.forEach(w=>{ try{ w.out.disconnect(); }catch(e){} });
      let cur=head; devs.forEach(d=>{ const w=holder.devs.get(d.id); if(!w||!w.on) return; cur.connect(w.in); cur=w.out; }); cur.connect(tail);
      if(holder.extra) holder.extra();
    }
    const R=[0,1].map(i=>{ const r={in:G(1), fader:G(1), devs:new Map(), ana:ctx.createAnalyser()}; r.ana.fftSize=512; r.fader.connect(M.in); r.fader.connect(r.ana); return r; });
    const T=new Map();
    function trackNode(t){
      let n=T.get(t.id); if(n) return n;
      n={gen:G(1), head:G(1), fader:G(1), pan:ctx.createStereoPanner(), post:G(1), sa:G(0), sb:G(0), ana:ctx.createAnalyser(), devs:new Map()};
      n.gen.connect(n.head); n.fader.connect(n.pan); n.pan.connect(n.post); n.post.connect(M.in); n.post.connect(n.sa); n.post.connect(n.sb); n.sa.connect(R[0].in); n.sb.connect(R[1].in);
      n.ana.fftSize=512; n.post.connect(n.ana); T.set(t.id,n); return n;
    }
    function sync(){
      const anySolo=P.tracks.some(t=>t.solo);
      P.tracks.forEach(t=>{ const n=trackNode(t); chain(n,t.devs,n.head,n.fader); const on=!t.mute&&(!anySolo||t.solo);
        n.fader.gain.value=on?dB(t.vol):0; n.pan.pan.value=t.pan||0; n.sa.gain.value=t.a||0; n.sb.gain.value=t.b||0; });
      T.forEach((n,id)=>{ if(!P.tracks.some(t=>t.id===id)){ try{ n.post.disconnect(); }catch(e){} T.delete(id); } });
      P.ret.forEach((r,i)=>{ chain(R[i],r.devs,R[i].in,R[i].fader); R[i].fader.gain.value=r.mute?0:dB(r.vol); });
      chain(M,P.master.devs,M.in,M.fader); M.fader.gain.value=dB(P.master.vol);
    }
    sync();
    /* réglages seuls (boutons, faders) : sans recâbler les chaînes */
    function soft(){
      const anySolo=P.tracks.some(t=>t.solo), upd=(h,devs)=>devs.forEach(d=>{ const w=h.devs.get(d.id); if(w) w.x.set(d.p); });
      P.tracks.forEach(t=>{ const n=trackNode(t); upd(n,t.devs); const on=!t.mute&&(!anySolo||t.solo); n.fader.gain.value=on?dB(t.vol):0; n.pan.pan.value=t.pan||0; n.sa.gain.value=t.a||0; n.sb.gain.value=t.b||0; });
      P.ret.forEach((r,i)=>{ upd(R[i],r.devs); R[i].fader.gain.value=r.mute?0:dB(r.vol); });
      upd(M,P.master.devs); M.fader.gain.value=dB(P.master.vol);
    }
    /* une note sur une piste */
    function note(t,n,time,spb,dst){
      const dur=Math.max(0.04,n.d*spb), d=dst||(t.id?trackNode(t).gen:prev);
      if(t.kind==="drums"){ const l=t.lanes[n.p]; if(l) bank.perc(l.kit,l.part,time,clamp(n.v*(l.lvl===undefined?1:l.lvl),0,1.2),d); return; }
      const I=t.inst||{k:"inst",name:"luth"}, f=midiHz(n.p);
      if(I.k==="pad") bank.pad(I.name,time,dur,f,d,n.v*1.3);
      else if(I.k==="syn"&&I.patch) synthNote(ctx,I.patch,{t:time,f,vel:n.v,dur,dst:d,pan:0,lite:false,noise});
      else bank.inst(I.name)(time,f,n.v,dur,d,0);
    }
    /* couper ce qui sonne encore sur une piste (changement de clip, arrêt) */
    function cut(t,time){ const n=trackNode(t), old=n.gen; old.gain.setTargetAtTime(0,time,0.06); if(typeof synDrop==="function") synDrop(ctx,old,time+0.5);
      n.gen=G(1); n.gen.connect(n.head); setTimeout(()=>{ try{ old.disconnect(); }catch(e){} },Math.max(0,(time-ctx.currentTime)*1000)+1500); }
    /* jeu en direct : une note tenue tant que la touche l'est (synthé : vraie tenue ; nappes et instruments : longue note fermée au relâchement) */
    const SUS={flute:1,ney:1,archet:1,orgue:1,voix:1,accordeon:1,cuivre:1,aulos:1,hydraulis:1,harmonica:1,sifflet:1,synthe:1,roues:1,syrinx:1,cornu:1,chant:1,basse:1};
    function noteOn(t,p,v){
      const now=ctx.currentTime+0.004, n=trackNode(t);
      if(t.kind==="drums"){ const l=t.lanes[((p%12)+12)%12]; if(l) bank.perc(l.kit,l.part,now,clamp(v*(l.lvl===undefined?1:l.lvl),0,1.2),n.gen); return {off(){}}; }
      const I=t.inst||{k:"inst",name:"luth"}, f=midiHz(p);
      if(I.k==="syn"&&I.patch){ const h=synthNote(ctx,I.patch,{t:now,f,vel:v,dur:null,dst:n.gen,pan:0,lite:false,noise}); return {off(){ h.release(ctx.currentTime); }}; }
      const g=G(1); g.connect(n.gen);
      const fin=tc=>{ const x=ctx.currentTime; g.gain.cancelScheduledValues(x); g.gain.setValueAtTime(g.gain.value,x); g.gain.setTargetAtTime(0,x,tc); setTimeout(()=>{ try{ g.disconnect(); }catch(e){} },tc*12000); };
      if(I.k==="pad"){ bank.pad(I.name,now,12,f,g,v*1.3); return {off(){ fin(0.3); }}; }
      const sus=SUS[I.name]; bank.inst(I.name)(now,f,v,sus?6:3,g,0); return {off(){ fin(sus?0.07:0.25); }};
    }
    /* métronome : un clic, plus aigu sur le premier temps */
    function click(time,acc){ const o=ctx.createOscillator(), g=G(0); o.frequency.value=acc?1760:1180; o.connect(g); g.connect(M.fader); g.gain.setValueAtTime(0,time); g.gain.linearRampToValueAtTime(acc?0.35:0.22,time+0.001); g.gain.exponentialRampToValueAtTime(0.0001,time+0.05); o.start(time); o.stop(time+0.06); }
    function retempo(){ sync(); }
    function preview(t,p,v,dur){ const n={p,v:v||0.7,d:dur||1}; note(t,n,ctx.currentTime+0.01,60/P.tempo,t?trackNode(t).gen:prev); }
    function previewInst(inst,p,v,dur){ note({kind:"mel",inst},{p,v:v||0.7,d:dur||1},ctx.currentTime+0.01,60/P.tempo,prev); }
    const level=a=>{ if(!a) return 0; const b=a._buf||(a._buf=new Float32Array(a.fftSize)); a.getFloatTimeDomainData(b); let m=0; for(let i=0;i<b.length;i++){ const x=Math.abs(b[i]); if(x>m) m=x; } return m; };
    return {ctx,P,bank,sync,soft,note,noteOn,click,cut,retempo,preview,previewInst,trackNode,level,M,R,eng,setP(np){ P=np; this.P=np; }};
  }

  /* ---------- transport (vue Session et Arrangement) ---------- */
  const STEP=0.25;
  function Transport(getP,graph,cb){
    const ctx=graph.ctx, X={playing:false, mode:"session", t0:0, next:0, slots:{}, rec:false, recSegs:null, timer:0, arrFrom:0};
    const spb=()=>60/getP().tempo;
    const timeOf=b=>X.t0+b*spb();
    const beatNow=()=>X.playing?(ctx.currentTime-X.t0)/spb():X.next;
    const slot=id=>X.slots[id]||(X.slots[id]={row:null,anchor:0,pend:undefined});
    const B=()=>TH.bb(getP().meter);
    function quantAt(b){ const P=getP(); const q=P.quant===0?STEP:P.quant===-1?1:P.quant*B(); return Math.ceil((b-1e-6)/q)*q; }
    function start(fromBeat){ if(X.playing) return; if(ctx.state==="suspended") ctx.resume();
      X.ending=false; X.next=fromBeat||0; X.t0=ctx.currentTime+0.08-X.next*spb(); X.playing=true;
      if(X.rec&&X.mode==="session"){ X.recSegs={}; X.recStart=X.next; Object.keys(X.slots).forEach(id=>{ const s=X.slots[id]; if(s.row!==null) recOpen(id,s.row,X.next); }); }
      X.timer=setInterval(tick,25); tick(); cb.state(); }
    function stop(){ if(!X.playing) return; X.ending=false; clearInterval(X.timer); X.playing=false; const b=beatNow(), now=ctx.currentTime;
      if(X.recSegs) recClose(Math.ceil(b/B()-1e-6)*B());
      getP().tracks.forEach(t=>graph.cut(t,now)); Object.values(X.slots).forEach(s=>{ s.pend=undefined; s.row=null; }); X.next=0; cb.state(); }
    function recOpen(id,row,b){ (X.recSegs[id]=X.recSegs[id]||[]).push({at:Math.round((b-X.recStart)/B()),row,open:true}); }
    function recClose(b){ if(!X.recSegs) return; const segs={}; let len=0;
      Object.keys(X.recSegs).forEach(id=>{ segs[id]=X.recSegs[id].map(s=>{ const end=s.open?Math.round((b-X.recStart)/B()):s.end; const o={at:s.at,len:Math.max(1,end-s.at),row:s.row}; len=Math.max(len,o.at+o.len); return o; }); });
      X.recSegs=null; cb.recorded({segs,len}); }
    function recChange(id,row,b){ if(!X.recSegs) return; const l=X.recSegs[id]; if(l&&l.length){ const s=l[l.length-1]; if(s.open){ s.open=false; s.end=Math.round((b-X.recStart)/B()); } } if(row!==null) recOpen(id,row,b); }
    function launch(id,row){ const s=slot(id); if(!X.playing){ X.mode="session"; s.row=row; s.anchor=0; s.pend=undefined; start(0); return; } s.pend={row,at:quantAt(beatNow()+0.05)}; cb.state(); }
    function stopTrack(id){ const s=slot(id); if(!X.playing){ s.row=null; return; } s.pend={row:null,at:quantAt(beatNow()+0.05)}; cb.state(); }
    function launchScene(r){ const P=getP(); if(!X.playing){ X.mode="session"; P.tracks.forEach(t=>{ const s=slot(t.id); s.row=t.clips[r]?r:null; s.anchor=0; s.pend=undefined; }); start(0); return; }
      P.tracks.forEach(t=>t.clips[r]?launch(t.id,r):stopTrack(t.id)); }
    function playArr(fromBar){ if(X.playing) stop(); X.mode="arr"; start((fromBar||0)*B()); }
    function playSession(){ if(X.playing) return; X.mode="session"; start(0); }
    /* état d'une piste au temps b */
    function stateAt(P,t,b){
      if(X.mode==="arr"){ const seg=(P.arr.segs[t.id]||[]).find(s=>b>=s.at*B()-1e-6&&b<(s.at+s.len)*B()-1e-6); if(!seg) return null;
        const h=PJ.harmTrack(P), hs=h&&(P.arr.segs[h.id]||[]).find(s=>b>=s.at*B()-1e-6&&b<(s.at+s.len)*B()-1e-6);
        return {row:seg.row,anchor:seg.at*B(),harm:hs?h.clips[hs.row]:PJ.harmFor(P,seg.row),hAnchor:hs?hs.at*B():undefined,seg}; }
      const s=X.slots[t.id]; if(!s||s.row===null) return null;
      const h=PJ.harmTrack(P), hs=h&&X.slots[h.id], hOn=hs&&hs.row!==null&&h.clips[hs.row];
      return {row:s.row,anchor:s.anchor,harm:hOn?h.clips[hs.row]:PJ.harmFor(P,s.row),hAnchor:hOn?hs.anchor:undefined};
    }
    function tick(){
      const P=getP(), horizon=ctx.currentTime+(document.hidden?1.2:0.22);
      let guard=0;
      while(timeOf(X.next)<horizon&&guard++<64){
        const b=X.next;
        if(X.mode==="session") P.tracks.forEach(t=>{ const s=slot(t.id); if(s.pend!==undefined&&s.pend.at<=b+1e-6){ const was=s.row; s.row=s.pend.row; s.anchor=b; s.pend=undefined; if(was!==null) graph.cut(t,timeOf(b)); recChange(t.id,s.row,b); cb.state(); } });
        if(X.mode==="arr"&&X.loop&&b>=X.loop.b*B()-1e-9){ const d=(X.loop.b-X.loop.a)*B(); X.next-=d; X.t0+=d*spb(); P.tracks.forEach(t=>graph.cut(t,timeOf(X.next))); continue; }
        if(X.mode==="arr"){ const end=PJ.arrLen(P.arr)*B(); if(b>=end){ if(!X.ending){ X.ending=true; setTimeout(()=>{ if(X.ending) stop(); },Math.max(0,(timeOf(b)-ctx.currentTime)*1000+2500)); } break; }
          P.tracks.forEach(t=>{ const st=stateAt(P,t,b), prevSt=stateAt(P,t,b-STEP); if(prevSt&&(!st||st.seg!==prevSt.seg)&&Math.abs(b%B())<1e-6) graph.cut(t,timeOf(b)); }); }
        if(X.metro&&Math.abs(b-Math.round(b))<1e-6) graph.click(timeOf(b),Math.round(b)%B()===0);
        P.tracks.forEach(t=>{ const st=stateAt(P,t,b); if(!st) return; PJ.collect(P,t,st,b,b+STEP,(n,nb)=>{ graph.note(t,n,timeOf(nb),spb()); if(cb.note) cb.note(t,n,timeOf(nb)); }); });
        X.next+=STEP;
      }
    }
    /* changement de tempo en lecture : on garde le temps courant */
    function retempo(oldSpb){ if(!X.playing) return; const b=(ctx.currentTime-X.t0)/oldSpb; X.t0=ctx.currentTime-b*spb(); }
    const pos=(t)=>{ const P=getP(), b=beatNow(), st=X.playing?stateAt(P,t,b):null; if(!st) return null; const c=t.clips[st.row]; const D=PJ.clipData(P,t,c,st.harm), an=D.sync&&st.hAnchor!==undefined?st.hAnchor:st.anchor; return {row:st.row,f:(((b-an)%D.len)+D.len)%D.len/D.len}; };
    return {X,start,stop,launch,stopTrack,launchScene,playArr,playSession,beatNow,retempo,pos,slot};
  }

  /* ---------- rendu hors ligne de l'arrangement, puis MP3 ---------- */
  async function render(P,onProg,soloId){
    if(soloId){ P=JSON.parse(JSON.stringify(P)); P.tracks.forEach(t=>{ t.solo=false; t.mute=t.id!==soloId; }); }
    const B=TH.bb(P.meter), bars=PJ.arrLen(P.arr); if(!bars) throw new Error("L'arrangement est vide.");
    const spb=60/P.tempo, tail=6, dur=bars*B*spb+tail, sr=44100;
    const ctx=new OfflineAudioContext(2,Math.ceil(sr*dur),sr);
    if(typeof fxLoad==="function") await fxLoad(ctx);
    const g=makeGraph(ctx,P,{offline:true});
    const X={mode:"arr"}, end=bars*B;
    const stateAt=(t,b)=>{ const seg=(P.arr.segs[t.id]||[]).find(s=>b>=s.at*B-1e-6&&b<(s.at+s.len)*B-1e-6); if(!seg) return null; const h=PJ.harmTrack(P), hs=h&&(P.arr.segs[h.id]||[]).find(s=>b>=s.at*B-1e-6&&b<(s.at+s.len)*B-1e-6);
      return {row:seg.row,anchor:seg.at*B,harm:hs?h.clips[hs.row]:PJ.harmFor(P,seg.row),hAnchor:hs?hs.at*B:undefined,seg}; };
    /* les coupures de fin de segment sont planifiées via des gains par segment */
    const segGain=new Map();
    for(let b=0;b<end-1e-9;b+=STEP){
      P.tracks.forEach(t=>{ const st=stateAt(t,b); if(!st) return;
        let gk=t.id+"|"+st.seg.at, gn=segGain.get(gk);
        if(!gn){ gn=ctx.createGain(); gn.connect(g.trackNode(t).head); const e=(st.seg.at+st.seg.len)*B*spb; gn.gain.setValueAtTime(1,0); gn.gain.setTargetAtTime(0,e,0.08); segGain.set(gk,gn); }
        PJ.collect(P,t,st,b,b+STEP,(n,nb)=>g.note(t,n,0.05+nb*spb,spb,gn)); });
      if(onProg&&(b%(B*8))<1e-9) { onProg(0.3*b/end); await new Promise(r=>setTimeout(r,0)); }
    }
    if(typeof synFlush==="function") await synFlush(ctx);
    if(onProg&&ctx.suspend){ for(let k=1;k<10;k++){ const tt=Math.floor(dur*k/10*sr/128)*128/sr; ctx.suspend(tt).then(()=>{ onProg(0.3+0.6*k/10); ctx.resume(); }).catch(()=>{}); } }
    const buf=await ctx.startRendering();
    const L=buf.getChannelData(0), Rr=buf.getChannelData(1); let pk=0; for(let i=0;i<L.length;i++){ const a=Math.abs(L[i]), c=Math.abs(Rr[i]); if(a>pk) pk=a; if(c>pk) pk=c; }
    return {L,R:Rr,sr,peak:pk};
  }
  /* les notes jouées par l'arrangement, piste par piste (en temps) : pour l'export MIDI */
  function events(P){
    const B=TH.bb(P.meter), end=PJ.arrLen(P.arr)*B, out=new Map();
    const inSeg=(l,b)=>(l||[]).find(s=>b>=s.at*B-1e-6&&b<(s.at+s.len)*B-1e-6);
    for(let b=0;b<end-1e-9;b+=STEP) P.tracks.forEach(t=>{ const seg=inSeg(P.arr.segs[t.id],b); if(!seg) return; const h=PJ.harmTrack(P), hs=h&&inSeg(P.arr.segs[h.id],b);
      const st={row:seg.row,anchor:seg.at*B,harm:hs?h.clips[hs.row]:PJ.harmFor(P,seg.row),hAnchor:hs?hs.at*B:undefined}, segEnd=(seg.at+seg.len)*B;
      PJ.collect(P,t,st,b,b+STEP,(n,nb)=>{ if(!out.has(t)) out.set(t,[]); out.get(t).push({b:nb,d:Math.min(n.d,segEnd-nb),p:n.p,v:n.v}); }); });
    return out;
  }
  /* fichier MIDI standard (format 1, 480 tic par noire) : une piste par piste du studio, la batterie sur le canal 10 */
  function midiBytes(P,tracks){
    const PPQ=480, vlq=n=>{ const b=[n&0x7f]; n>>=7; while(n>0){ b.unshift((n&0x7f)|0x80); n>>=7; } return b; }, txt=s=>[...new TextEncoder().encode(s)];
    const chunk=(id,data)=>[...txt(id),(data.length>>>24)&255,(data.length>>>16)&255,(data.length>>>8)&255,data.length&255,...data];
    const [num,den]=P.meter.split("/").map(Number), us=Math.round(60000000/P.tempo);
    const head=[0,0xFF,0x51,3,(us>>16)&255,(us>>8)&255,us&255, 0,0xFF,0x58,4,num,Math.log2(den),24,8, 0,0xFF,0x03,...vlq(txt(P.name||"Studio").length),...txt(P.name||"Studio"), 0,0xFF,0x2F,0];
    const GM={stomp:36,tap:38,shaker:42}; let ch=0;
    const trks=tracks.map(({t,notes})=>{ const drum=t.kind==="drums"; let c=9; if(!drum){ c=ch%15; if(c>=9) c++; ch++; } const ev=[];
      notes.forEach(n=>{ const p=drum?(GM[(t.lanes[n.p]||{}).part]||37+n.p):Math.max(0,Math.min(127,Math.round(n.p))), v=Math.max(1,Math.min(127,Math.round(n.v*110))), a=Math.round(n.b*PPQ), e=Math.max(a+1,Math.round((n.b+n.d)*PPQ));
        ev.push([a,1,[0x90|c,p,v]],[e,0,[0x80|c,p,0]]); });
      ev.sort((x,y)=>x[0]-y[0]||x[1]-y[1]); const nm=txt(t.name||"Piste"); const data=[0,0xFF,0x03,...vlq(nm.length),...nm]; let last=0;
      ev.forEach(([tk,,m])=>{ data.push(...vlq(tk-last),...m); last=tk; }); data.push(0,0xFF,0x2F,0); return chunk("MTrk",data); });
    const hdr=chunk("MThd",[0,1,0,trks.length+1,(PPQ>>8)&255,PPQ&255]);
    return new Uint8Array([...hdr,...chunk("MTrk",head),...trks.flat()]);
  }
  return {DEV,DEV_ORDER,SYNC,makeGraph,Transport,render,events,midiBytes,dB,midiHz,impulse};
})();
