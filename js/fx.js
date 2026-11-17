"use strict";
/* ============================================================
   AUDIOWORKLET : réverbération modulée, nuage de grains, synthé à tables d'ondes
   Le code des processeurs est une fonction, envoyée au worklet par une URL de blob :
   ça marche en file://, hors ligne et dans un OfflineAudioContext (export).
   ============================================================ */
function fxWorkletBody(){
  const pow2=n=>{ let p=1; while(p<n) p<<=1; return p; };
  const kr=(name,def,min,max)=>({name,defaultValue:def,minValue:min,maxValue:max,automationRate:"k-rate"});

  /* réverbération : réseau de 8 lignes à retard bouclées (matrice de Hadamard), amorties, aux longueurs
     modulées lentement ; un décaleur d'octave réinjecté donne le scintillement */
  class Verb extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("decay",3,0.2,30),kr("damp",0.5,0,1),kr("mod",0.5,0,1),kr("shimmer",0,0,1),kr("pre",0,0,0.25)]; }
    constructor(){
      super();
      const k=sampleRate/44100;
      this.len=[1487,1823,2143,2539,2903,3331,3761,4201].map(x=>Math.round(x*k));
      this.size=pow2(this.len[7]+Math.ceil(64*k)+8); this.mask=this.size-1;
      this.buf=this.len.map(()=>new Float32Array(this.size));
      this.w=0; this.lp=new Float32Array(8); this.v=new Float32Array(8);
      this.ph=[0,1.3,2.9,4.1,0.7,3.3,5.2,2.1]; this.rate=[0.21,0.37,0.53,0.71,0.29,0.43,0.61,0.83];
      this.dm=new Float32Array(8); this.ds=new Float32Array(8);
      this.apLen=[[142,107,379,277],[151,113,389,283]].map(a=>a.map(x=>Math.round(x*k)));
      this.apBuf=this.apLen.map(a=>a.map(n=>new Float32Array(n))); this.apI=[[0,0,0,0],[0,0,0,0]];
      this.pSize=pow2(Math.ceil(0.26*sampleRate)); this.pBuf=[new Float32Array(this.pSize),new Float32Array(this.pSize)]; this.pW=0;
      this.sW=Math.round(0.085*sampleRate); this.sSize=pow2(this.sW+8); this.sBuf=new Float32Array(this.sSize); this.sI=0; this.sP=0; this.sLp=0; this.sHp=0; this.fb=0;
      this.depth=40*k; this.quiet=1e9;
    }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], oL=out[0], oR=out[1]||out[0], n=oL.length, iL=inp[0], iR=inp[1]||inp[0];
      /* rien n'entre et la queue est éteinte : on ne calcule plus */
      if(!iL&&this.quiet>sampleRate*2) return true;
      const sr=sampleRate, T=P.decay[0], c=1-0.78*P.damp[0], dep=this.depth*P.mod[0], sh=P.shimmer[0]*0.42, pre=Math.min(this.pSize-2,Math.round(P.pre[0]*sr));
      const g=this._g||(this._g=new Float32Array(8)); for(let i=0;i<8;i++) g[i]=Math.pow(10,-3*this.len[i]/(T*sr));
      /* modulation : la longueur de chaque ligne glisse d'un bout du bloc à l'autre */
      for(let i=0;i<8;i++){ const a=this.len[i]+dep*Math.sin(this.ph[i]); this.ph[i]+=2*Math.PI*this.rate[i]*n/sr; if(this.ph[i]>6.2831853) this.ph[i]-=6.2831853; const b=this.len[i]+dep*Math.sin(this.ph[i]); this.dm[i]=a; this.ds[i]=(b-a)/n; }
      const v=this.v, lp=this.lp, buf=this.buf, mask=this.mask, size=this.size, sB=this.sBuf, sM=this.sSize-1, sW=this.sW;
      let w=this.w, peak=0;
      for(let s=0;s<n;s++){
        let xl=iL?iL[s]:0, xr=iL?iR[s]:0;
        if(pre>0){ const pb=this.pBuf, pm=this.pSize-1; pb[0][this.pW]=xl; pb[1][this.pW]=xr; const r=(this.pW-pre)&pm; xl=pb[0][r]; xr=pb[1][r]; this.pW=(this.pW+1)&pm; }
        xl+=this.fb; xr+=this.fb;
        /* diffusion : quatre passe-tout en série par canal */
        for(let ch=0;ch<2;ch++){
          let x=ch?xr:xl; const L=this.apLen[ch], Bf=this.apBuf[ch], I=this.apI[ch];
          for(let q=0;q<4;q++){ const b=Bf[q], j=I[q], d=b[j], y=d-0.6*x; b[j]=x+0.6*y; I[q]=j+1===L[q]?0:j+1; x=y; }
          if(ch) xr=x; else xl=x;
        }
        for(let i=0;i<8;i++){
          const d=this.dm[i]; this.dm[i]=d+this.ds[i];
          let rp=w-d; if(rp<0) rp+=size; const i0=rp|0, fr=rp-i0, b=buf[i], a0=b[i0&mask], a1=b[(i0+1)&mask];
          lp[i]+=((a0+(a1-a0)*fr)-lp[i])*c; v[i]=lp[i];
        }
        const yl=(v[0]-v[2]+v[4]-v[6])*0.5, yr=(v[1]-v[3]+v[5]-v[7])*0.5;
        /* Hadamard 8x8 en trois passes */
        for(let h=1;h<8;h<<=1) for(let i=0;i<8;i+=h<<1) for(let j=i;j<i+h;j++){ const a=v[j], b=v[j+h]; v[j]=a+b; v[j+h]=a-b; }
        for(let i=0;i<8;i++) buf[i][w]=(i&1?xr:xl)+v[i]*0.35355339*g[i];
        w=(w+1)&mask;
        /* scintillement : la sortie remonte d'une octave (deux têtes de lecture en fondu) et revient à l'entrée */
        if(sh>0.0005){
          sB[this.sI]=(yl+yr)*0.5;
          const p=this.sP, p2=p<0.5?p+0.5:p-0.5, d1=(1-p)*sW, d2=(1-p2)*sW, w1=1-Math.abs(2*p-1);
          const a=sB[(this.sI-(d1|0))&sM], b=sB[(this.sI-(d2|0))&sM];
          let y=a*w1+b*(1-w1);
          this.sLp+=(y-this.sLp)*0.35; this.sHp+=(this.sLp-this.sHp)*0.02; y=(this.sLp-this.sHp)*sh;
          this.fb=y>1?1:y<-1?-1:y;
          this.sI=(this.sI+1)&sM; this.sP=p+1/sW; if(this.sP>=1) this.sP-=1;
        } else this.fb=0;
        oL[s]=yl; if(oR!==oL) oR[s]=yr;
        const m=yl<0?-yl:yl; if(m>peak) peak=m;
      }
      this.w=w;
      if(iL||peak>1e-5) this.quiet=0; else this.quiet+=n;
      return true;
    }
  }
  registerProcessor("bourdon-verb",Verb);

  /* plaque de Dattorro (1997) : filtre de bande passante, quatre passe-tout de diffusion, puis une « cuve » à deux branches croisées
     (passe-tout modulé, retard, amortissement, gain de décroissance, passe-tout, retard) ; la sortie est une somme de prises dans la cuve.
     Longueurs d'origine à 29 761 Hz, mises à l'échelle ; « size » les allonge pour la salle. */
  class Plate extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("decay",3,0.2,30),kr("damp",0.5,0,1),kr("pre",0,0,0.25)]; }
    constructor(o){
      super(); const sz=(o&&o.processorOptions&&o.processorOptions.size)||1, k=sampleRate/29761*sz, K=x=>Math.max(2,Math.round(x*k));
      this.k=k; const mkL=n=>({b:new Float32Array(pow2(n+40)),n,w:0});
      this.ap=[142,107,379,277].map(x=>mkL(K(x))); this.apG=[0.75,0.75,0.625,0.625];
      this.mA=[mkL(K(672)+Math.ceil(16*k)),mkL(K(908)+Math.ceil(16*k))]; this.mN=[K(672),K(908)];
      this.d1=[mkL(K(4453)),mkL(K(4217))]; this.a2=[mkL(K(1800)),mkL(K(2656))]; this.d2=[mkL(K(3720)),mkL(K(3163))];
      this.loop=(672+4453+1800+3720+908+4217+2656+3163)/29761*sz*0.5;
      this.lp=[0,0]; this.bw=0; this.ph=0; this.ex=16*k; this.fbk=[0,0];
      this.pSize=pow2(Math.ceil(0.26*sampleRate)); this.pBuf=new Float32Array(this.pSize); this.pW=0;
      const T=(a)=>Math.round(a*k); this.tL=[[1,0,T(266)],[1,0,T(2974)],[-1,1,T(1913)],[1,2,T(1996)],[-1,3,T(1990)],[-1,4,T(187)],[-1,5,T(1066)]];
      this.tR=[[1,3,T(353)],[1,3,T(3627)],[-1,4,T(1228)],[1,5,T(2673)],[-1,0,T(2111)],[-1,1,T(335)],[-1,2,T(121)]];
      this.quiet=1e9;
    }
    rd(L,d){ const m=L.b.length-1; return L.b[(L.w-d)&m]; }
    wr(L,x){ const m=L.b.length-1; L.b[L.w]=x; L.w=(L.w+1)&m; }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], oL=out[0], oR=out[1]||out[0], n=oL.length, iL=inp[0], iR=inp[1]||inp[0];
      if(!iL&&this.quiet>sampleRate*3) return true;
      const g=Math.pow(10,-3*this.loop/Math.max(0.2,P.decay[0])), dmp=0.05+0.75*P.damp[0], pre=Math.min(this.pSize-2,Math.round(P.pre[0]*sampleRate)), pm=this.pSize-1;
      const srcs=[this.d1[1],this.a2[1],this.d2[1],this.d1[0],this.a2[0],this.d2[0]];
      let peak=0;
      for(let s=0;s<n;s++){
        let x=iL?(iL[s]+iR[s])*0.5:0;
        this.pBuf[this.pW]=x; x=this.pBuf[(this.pW-pre)&pm]; this.pW=(this.pW+1)&pm;
        this.bw+=(x-this.bw)*0.9995; x=this.bw;
        for(let q=0;q<4;q++){ const L=this.ap[q], d=this.rd(L,L.n), y=d-this.apG[q]*x; this.wr(L,x+this.apG[q]*y); x=y; }
        this.ph+=2*Math.PI*1/sampleRate; if(this.ph>6.2831853) this.ph-=6.2831853;
        const nx=[0,0];
        for(let b=0;b<2;b++){
          let y=x+this.fbk[1-b];
          /* passe-tout modulé (lecture interpolée) */
          const L=this.mA[b], m=L.b.length-1, dl=this.mN[b]+this.ex*Math.sin(this.ph+b*1.7), di=dl|0, fr=dl-di;
          const a0=L.b[(L.w-di)&m], a1=L.b[(L.w-di-1)&m], dv=a0+(a1-a0)*fr, z=dv+0.7*y; L.b[L.w]=y-0.7*z; L.w=(L.w+1)&m; y=z;
          this.wr(this.d1[b],y); y=this.rd(this.d1[b],this.d1[b].n);
          this.lp[b]+=(y-this.lp[b])*(1-dmp); y=this.lp[b]*g;
          const A=this.a2[b], d2=this.rd(A,A.n), y2=d2+0.5*y; this.wr(A,y-0.5*y2); y=y2;
          this.wr(this.d2[b],y); nx[b]=this.rd(this.d2[b],this.d2[b].n)*g;
        }
        this.fbk=nx;
        let l=0,r=0; for(const [sg,i,d] of this.tL) l+=sg*this.rd(srcs[i],d); for(const [sg,i,d] of this.tR) r+=sg*this.rd(srcs[i],d);
        l*=0.6; r*=0.6; oL[s]=l; if(oR!==oL) oR[s]=r; const m=l<0?-l:l; if(m>peak) peak=m;
      }
      if(iL||peak>1e-5) this.quiet=0; else this.quiet+=n;
      return true;
    }
  }
  registerProcessor("bourdon-plate",Plate);

  /* nuage de grains : l'entrée s'écrit dans une bande de 8 secondes, relue par petits grains fenêtrés,
     tirés dans le passé récent, parfois à l'octave ou à la quinte ; gelée, la bande ne s'écrit plus */
  class Grain extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("dens",0.45,0,1),kr("size",0.5,0,1),kr("spread",0.4,0,1),kr("pitch",0.3,0,1),kr("freeze",0,0,1)]; }
    constructor(opt){
      super();
      let a=((opt&&opt.processorOptions&&opt.processorOptions.seed)||1)>>>0;
      this.rnd=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
      this.size=pow2(Math.ceil(8*sampleRate)); this.mask=this.size-1; this.buf=new Float32Array(this.size); this.w=0;
      this.N=40; this.act=new Uint8Array(this.N); this.pos=new Float64Array(this.N); this.inc=new Float32Array(this.N);
      this.i=new Float32Array(this.N); this.len=new Float32Array(this.N); this.gl=new Float32Array(this.N); this.gr=new Float32Array(this.N);
      this.next=0; this.since=1e9;
    }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], oL=out[0], oR=out[1]||out[0], n=oL.length, iL=inp[0], iR=inp[1]||inp[0];
      const frozen=P.freeze[0]>=0.5;
      /* bande vide depuis plus longtemps que sa longueur : rien à relire */
      if(!iL&&!frozen&&this.since>this.size) return true;
      const sr=sampleRate, rate=1.5+38*P.dens[0]*P.dens[0], gLen=Math.round(sr*(0.04+0.56*P.size[0]*P.size[0])), spread=sr*(0.03+6.2*P.spread[0]*P.spread[0]);
      const pitch=P.pitch[0], amp=0.9/Math.sqrt(Math.max(1,rate*gLen/sr)), buf=this.buf, mask=this.mask, N=this.N, rnd=this.rnd;
      for(let s=0;s<n;s++){
        if(!frozen){
          const x=iL?(iL[s]+iR[s])*0.5:0; buf[this.w]=x; this.w=(this.w+1)&mask;
          if(x>1e-6||x<-1e-6) this.since=0; else this.since++;
        }
        if(--this.next<=0){
          this.next=(0.5+rnd())*sr/rate;
          let k=-1; for(let q=0;q<N;q++) if(!this.act[q]){ k=q; break; }
          const r=rnd(), r2=rnd(), pan=rnd(), det=rnd(), back=rnd();
          if(k>=0){
            let ratio=1; if(r<pitch*0.6) ratio=r2<0.55?2:r2<0.85?0.5:1.5;
            ratio*=Math.pow(2,(det-0.5)*0.012);
            const margin=(frozen?gLen*ratio:Math.max(0,gLen*(ratio-1)))+16, D=Math.min(this.size-gLen*2-64,back*spread+margin);
            this.act[k]=1; this.pos[k]=this.w-D; this.inc[k]=ratio; this.i[k]=0; this.len[k]=gLen;
            const th=pan*1.5707963; this.gl[k]=Math.cos(th)*amp*1.4142; this.gr[k]=Math.sin(th)*amp*1.4142;
          }
        }
        let l=0, rr=0;
        for(let q=0;q<N;q++){
          if(!this.act[q]) continue;
          let p=this.pos[q]; if(p<0) p+=this.size;
          const i0=p|0, fr=p-i0, a0=buf[i0&mask], a1=buf[(i0+1)&mask], x=this.i[q]/this.len[q];
          let wd=4*x*(1-x); wd*=wd;
          const y=(a0+(a1-a0)*fr)*wd; l+=y*this.gl[q]; rr+=y*this.gr[q];
          this.pos[q]+=this.inc[q]; if(++this.i[q]>=this.len[q]) this.act[q]=0;
        }
        oL[s]=l; if(oR!==oL) oR[s]=rr;
      }
      return true;
    }
  }
  registerProcessor("bourdon-grain",Grain);

  /* ---------- synthé à tables d'ondes ----------
     Toutes les voix d'une destination sont calculées ici, échantillon par échantillon : tables de 2048 points
     filtrées par octave (pas de repliement), position de table modulable, unisson à phases libres, torsion,
     modulation de phase, filtre à variables d'état, enveloppes, LFO, matrice et macros.
     Les tables sont partagées par tous les processeurs du contexte. */
  const TS=2048, NH=256, MIPS=9, TAB={tabs:null, v:-1}, SIN=new Float32Array(TS+1);
  for(let i=0;i<=TS;i++) SIN[i]=Math.sin(2*Math.PI*i/TS);
  function buildTable(re,im){
    const acc=new Float32Array(TS), mips=new Array(MIPS);
    for(let m=MIPS-1;m>=0;m--){
      const hi=NH>>m, lo=m===MIPS-1?0:NH>>(m+1);
      for(let k=lo+1;k<=hi;k++){
        const a=im[k]||0, b=re[k]||0; if(!a&&!b) continue;
        for(let n=0;n<TS;n++){ const j=(k*n)&(TS-1); acc[n]+=a*SIN[j]+b*SIN[(j+(TS>>2))&(TS-1)]; }
      }
      const t=new Float32Array(TS+1); t.set(acc); t[TS]=acc[0]; mips[m]=t;
    }
    let pk=0; const top=mips[0]; for(let n=0;n<TS;n++){ const x=top[n]<0?-top[n]:top[n]; if(x>pk) pk=x; }
    if(pk>0){ const g=1/pk; for(let m=0;m<MIPS;m++){ const t=mips[m]; for(let n=0;n<=TS;n++) t[n]*=g; } }
    return mips;
  }
  const envAt=(E,x)=>{ const a=E.a>0.0005?E.a:0.0005; return x<=0?0:x<a?x/a:E.s+(1-E.s)*Math.exp(-(x-a)/((E.d>0.01?E.d:0.01)/3)); };
  const envV=(E,tt,tr)=>(tr<0||tt<tr)?envAt(E,tt):envAt(E,tr)*Math.exp(-(tt-tr)/((E.r>0.01?E.r:0.01)/3));
  const lfoV=(sh,p,tb)=>{ p-=Math.floor(p); if(sh==="draw"){ if(!tb||!tb.length) return 0; const x=p*tb.length, i=x|0, f=x-i; return tb[i]+(tb[(i+1)%tb.length]-tb[i])*f; } return sh==="sine"?Math.sin(6.2831853*p):sh==="triangle"?(p<0.25?4*p:p<0.75?2-4*p:4*p-4):sh==="sawtooth"?(p<0.5?2*p:2*p-2):(p<0.5?1:-1); };
  const SRCK=["lfo1","lfo2","lfo3","env1","env2","vel","key","rand","mac1","mac2","mac3","mac4"];

  class Synth extends AudioWorkletProcessor{
    constructor(opt){
      super();
      const po=(opt&&opt.processorOptions)||{}; let a=(po.seed||1)>>>0;
      this.rnd=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
      this.maxV=po.lite?10:20; this.maxU=po.lite?3:7; this.P=null; this.pend=[]; this.voices=[]; this.dead=Infinity;
      this.src={}; this.mod={pitch:0,cutoff:0,reso:0,amp:0,pan:0,fm:0,detuneb:0,lvlb:0,wave:0,waveb:0,warp:0};
      this.port.onmessage=e=>this.msg(e.data);
    }
    msg(d){
      if(d.type==="patch") this.P=d.P;
      else if(d.type==="tab"){
        if(d.spec&&(!TAB.tabs||TAB.tabs.length!==d.spec.length)) TAB.tabs=d.spec.map(s=>buildTable(s[0],s[1]));
        else if(d.draw&&TAB.tabs) TAB.tabs[TAB.tabs.length-1]=buildTable(d.draw[0],d.draw[1]);
        TAB.v=d.v;
      }
      else if(d.type==="on"){ let i=this.pend.length; while(i>0&&this.pend[i-1].t>d.t) i--; this.pend.splice(i,0,d); }
      else if(d.type==="off"){
        for(const v of this.voices) if(v.id===d.id){ const a=Math.max(v.age+1,Math.round((d.t-v.tOn)*sampleRate)); if(a<v.offAge) v.offAge=Math.max(a,Math.round(0.02*sampleRate)); }
        for(const p of this.pend) if(p.id===d.id) p.dur=Math.max(0.02,d.t-p.t);
      }
      else if(d.type==="dead") this.dead=d.t;
      else if(d.type==="sync") this.port.postMessage({type:"sync",k:d.k});
      else if(d.type==="panic"){ this.pend.length=0; for(const v of this.voices) v.steal=1; }
    }
    start(ev,ofs){
      if(this.voices.length>=this.maxV){ /* vol de voix : la plus avancée dans son relâchement, sinon la plus ancienne */
        let b=null, bs=-1; for(const v of this.voices){ if(v.steal) continue; const sc=(v.offAge<=v.age?1e9:0)+v.age; if(sc>bs){ bs=sc; b=v; } } if(b) b.steal=1;
      }
      const U=this.maxU, v={id:ev.id, f:ev.f, vel:Math.max(0.02,Math.min(1,ev.vel)), pan:ev.pan||0, tOn:ev.t, age:0, start:ofs,
        offAge:(ev.dur===null||ev.dur===undefined)?Infinity:Math.round(Math.max(0.02,ev.dur)*sampleRate),
        fromF:ev.fromF||0, glide:ev.glide||0, rand:this.rnd()*2-1, steal:0, done:false, g:0,
        phA:new Float64Array(U), phB:new Float64Array(U), incA:new Float64Array(U), incB:new Float64Array(U),
        glA:new Float32Array(U), grA:new Float32Array(U), glB:new Float32Array(U), grB:new Float32Array(U),
        pm:0, ps:0, f1:new Float64Array(8)};
      for(let u=0;u<U;u++){ v.phA[u]=this.rnd(); v.phB[u]=this.rnd(); }
      this.voices.push(v);
    }
    process(inputs,outputs){
      const out=outputs[0], L=out[0], R=out[1]||out[0], n=L.length, t0=currentTime, sr=sampleRate;
      if(t0>this.dead) return false;
      const pend=this.pend, lim=t0+n/sr;
      while(pend.length&&pend[0].t<lim){ const ev=pend.shift(); this.start(ev,Math.max(0,Math.min(n-1,Math.round((ev.t-t0)*sr)))); }
      const vs=this.voices; if(!vs.length) return true;
      const P=this.P; if(!P||!TAB.tabs){ return true; }
      for(let i=0;i<vs.length;i++) this.render(vs[i],L,R,n,P);
      for(let i=vs.length-1;i>=0;i--) if(vs[i].done) vs.splice(i,1);
      return true;
    }
    render(v,L,R,n,P){
      const sr=sampleRate, T=TAB.tabs, nT=T.length, A=P.oscA, B=P.oscB, src=this.src, M=this.mod, mods=P.mod||[], mac=P.mac||{};
      const nA=A.lvl>0.001?Math.max(1,Math.min(this.maxU,Math.round(A.uni||1))):0;
      const bMod=mods.some(m=>m.dst==="lvlb"&&m.src!=="none"&&m.amt), nB=(B.lvl>0.001||bMod)?Math.max(1,Math.min(this.maxU,Math.round(B.uni||1))):0;
      const f24=P.fil.type==="lowpass24"||P.fil.type==="highpass24", ft=f24?P.fil.type.slice(0,-2):P.fil.type, fmode=ft==="lowpass"?0:ft==="highpass"?1:ft==="bandpass"?2:3;
      /* une voix sans unisson est mono : même niveau que l'ancien moteur (répartition à puissance égale) */
      const lvl0=0.34*(P.fx.level===undefined?0.8:P.fx.level)/0.8*((1-P.vel.amt)+P.vel.amt*v.vel)*(nA<=1&&nB<=1?0.70710678:1);
      const drv=P.fx.drive>0.02?1+P.fx.drive*12:0, drvN=drv?1/Math.tanh(drv):1;
      const subL=P.sub.lvl>0.001?P.sub.lvl*(P.sub.shape==="square"?0.5:0.8):0, subSq=P.sub.shape==="square", nz=P.noise.lvl>0.001?P.noise.lvl*0.6:0;
      const keyV=Math.max(-1,Math.min(1,Math.log2(v.f/261.63)/2)), octB=Math.pow(2,B.oct||0), rA=Math.pow(2,(A.oct||0)+(A.semi||0)/12), rB=octB*Math.pow(2,(B.semi||0)/12);
      const tail=2.3*Math.max(0.01,P.envA.r)+0.05, f1=v.f1, rnd=this.rnd;
      let i=v.start; v.start=0;
      while(i<n){
        const m=Math.min(16,n-i), tt=v.age/sr, tr=v.offAge<=v.age?v.offAge/sr:-1;
        /* sources de modulation, puis la matrice */
        const e1=envV(P.envA,tt,tr), eF=envV(P.envF,tt,tr);
        src.lfo1=lfoV(P.lfo1.shape,tt*P.lfo1.rate,P.lfo1.draw); src.lfo2=lfoV(P.lfo2.shape,tt*P.lfo2.rate,P.lfo2.draw); src.lfo3=lfoV(P.lfo3.shape,tt*P.lfo3.rate,P.lfo3.draw);
        src.env1=e1; src.env2=envV(P.env2,tt,tr); src.vel=v.vel; src.key=keyV; src.rand=v.rand; src.mac1=mac.m1||0; src.mac2=mac.m2||0; src.mac3=mac.m3||0; src.mac4=mac.m4||0;
        M.pitch=M.cutoff=M.reso=M.amp=M.pan=M.fm=M.detuneb=M.lvlb=M.wave=M.waveb=M.warp=0;
        for(let q=0;q<mods.length;q++){ const s=mods[q]; if(s.src==="none"||!s.amt||M[s.dst]===undefined) continue; const x=src[s.src]; if(x!==undefined) M[s.dst]+=x*s.amt; }
        let fb=v.f*Math.pow(2,M.pitch);
        if(v.glide>0&&v.fromF>0&&tt<v.glide) fb*=Math.pow(v.fromF/v.f,1-tt/v.glide);
        /* oscillateurs : pas de phase, niveaux et panoramique de chaque voix d'unisson */
        let maxInc=0;
        for(let u=0;u<nA;u++){ const sp=nA>1?u/(nA-1)*2-1:0, inc=fb*rA*Math.pow(2,((A.det||0)+sp*(A.spread||0))/1200)/sr; v.incA[u]=inc; if(inc>maxInc) maxInc=inc;
          const lv=A.lvl/Math.sqrt(nA); if(nA>1){ const th=(sp*(A.width===undefined?0.6:A.width)+1)*0.78539816; v.glA[u]=Math.cos(th)*lv; v.grA[u]=Math.sin(th)*lv; } else v.glA[u]=v.grA[u]=lv; }
        const lvB=Math.max(0,(B.lvl||0)+0.5*M.lvlb);
        for(let u=0;u<nB;u++){ const sp=nB>1?u/(nB-1)*2-1:0, inc=fb*rB*Math.pow(2,((B.det||0)+100*M.detuneb+sp*(B.spread||0))/1200)/sr; v.incB[u]=inc; if(inc>maxInc) maxInc=inc;
          const lv=lvB/Math.sqrt(nB); if(nB>1){ const th=(sp*(B.width===undefined?0.6:B.width)+1)*0.78539816; v.glB[u]=Math.cos(th)*lv; v.grB[u]=Math.sin(th)*lv; } else v.glB[u]=v.grB[u]=lv; }
        let mip=maxInc>0?Math.ceil(Math.log2(maxInc*NH*2.1)):0; mip=mip<0?0:mip>MIPS-1?MIPS-1:mip;
        const pa=Math.max(0,Math.min(1,A.wave+0.5*M.wave))*(nT-1), ia=Math.min(nT-2,pa|0), fa=pa-ia, a0=T[ia][mip], a1=T[ia+1][mip];
        const pb=Math.max(0,Math.min(1,B.wave+0.5*M.waveb))*(nT-1), ib=Math.min(nT-2,pb|0), fbm=pb-ib, b0=T[ib][mip], b1=T[ib+1][mip];
        const wA=Math.max(-0.95,Math.min(0.95,(A.warp||0)+M.warp)), bkA=0.5+0.47*wA, wB=Math.max(-0.95,Math.min(0.95,B.warp||0)), bkB=0.5+0.47*wB;
        const fmA=Math.max(0,(P.fm.amt||0)+M.fm), beta=fmA>0.001?fmA*3/((P.fm.ratio||1)*octB)/6.2831853:0, incM=fb*(P.fm.ratio||1)*octB/sr, incS=fb*0.5/sr;
        let smip=Math.ceil(Math.log2(incS*NH*2.1)); smip=smip<0?0:smip>MIPS-1?MIPS-1:smip; const sq=T[3][smip];
        /* filtre : coupure suivie par le clavier, l'enveloppe et la matrice */
        let fc=P.fil.cut*Math.pow(v.f/261.63,P.fil.key)*Math.pow(2,(P.fil.env*eF+4800*M.cutoff)/1200); fc=fc<20?20:fc>sr*0.45?sr*0.45:fc;
        const res=Math.max(0.05,P.fil.res+12*M.reso), g=Math.tan(Math.PI*fc/sr);
        const k1=fmode<2?1/Math.pow(10,(f24?res*0.7:res)/20):1/Math.max(0.1,res), a1c=1/(1+g*(g+k1)), a2c=g*a1c, a3c=g*a2c;
        const k2=1/Math.pow(10,0.035), c1=1/(1+g*(g+k2)), c2=g*c1, c3=g*c2;
        const gT=Math.max(0,lvl0*e1*(1+0.9*M.amp))*(v.steal?0:1), gs=(gT-v.g)/m; let gg=v.g;
        const pn=Math.max(-1,Math.min(1,v.pan+M.pan)), bl=pn>0?1-pn:1, br=pn<0?1+pn:1;
        const phA=v.phA, phB=v.phB, incA=v.incA, incB=v.incB, glA=v.glA, grA=v.grA, glB=v.glB, grB=v.grB;
        let pm=v.pm, ps=v.ps;
        for(let s=0;s<m;s++){
          let xl=0, xr=0, fo=0;
          if(beta){ pm+=incM; if(pm>=1) pm-=1; const x=pm*TS, j=x|0; fo=beta*(SIN[j]+(SIN[j+1]-SIN[j])*(x-j)); }
          for(let u=0;u<nA;u++){
            let ph=phA[u]+incA[u]; if(ph>=1) ph-=1; phA[u]=ph;
            let q=ph+fo; if(fo) q-=Math.floor(q);
            if(wA) q=q<bkA?0.5*q/bkA:0.5+0.5*(q-bkA)/(1-bkA);
            const x=q*TS, j=x|0, fr=x-j, ya=a0[j]+(a0[j+1]-a0[j])*fr, yb=a1[j]+(a1[j+1]-a1[j])*fr, y=ya+(yb-ya)*fa;
            xl+=y*glA[u]; xr+=y*grA[u];
          }
          for(let u=0;u<nB;u++){
            let q=phB[u]+incB[u]; if(q>=1) q-=1; phB[u]=q;
            if(wB) q=q<bkB?0.5*q/bkB:0.5+0.5*(q-bkB)/(1-bkB);
            const x=q*TS, j=x|0, fr=x-j, ya=b0[j]+(b0[j+1]-b0[j])*fr, yb=b1[j]+(b1[j+1]-b1[j])*fr, y=ya+(yb-ya)*fbm;
            xl+=y*glB[u]; xr+=y*grB[u];
          }
          if(subL){ ps+=incS; if(ps>=1) ps-=1; const x=ps*TS, j=x|0, y=(subSq?sq[j]+(sq[j+1]-sq[j])*(x-j):SIN[j]+(SIN[j+1]-SIN[j])*(x-j))*subL; xl+=y; xr+=y; }
          if(nz){ const y=(rnd()*2-1)*nz; xl+=y; xr+=y; }
          /* filtre à variables d'état, un ou deux étages, par canal */
          { let v3=xl-f1[1], v1=a1c*f1[0]+a2c*v3, v2=f1[1]+a2c*f1[0]+a3c*v3; f1[0]=2*v1-f1[0]; f1[1]=2*v2-f1[1];
            xl=fmode===0?v2:fmode===1?xl-k1*v1-v2:fmode===2?k1*v1:xl-k1*v1;
            v3=xr-f1[3]; v1=a1c*f1[2]+a2c*v3; v2=f1[3]+a2c*f1[2]+a3c*v3; f1[2]=2*v1-f1[2]; f1[3]=2*v2-f1[3];
            xr=fmode===0?v2:fmode===1?xr-k1*v1-v2:fmode===2?k1*v1:xr-k1*v1; }
          if(f24){ let v3=xl-f1[5], v1=c1*f1[4]+c2*v3, v2=f1[5]+c2*f1[4]+c3*v3; f1[4]=2*v1-f1[4]; f1[5]=2*v2-f1[5]; xl=fmode===0?v2:xl-k2*v1-v2;
            v3=xr-f1[7]; v1=c1*f1[6]+c2*v3; v2=f1[7]+c2*f1[6]+c3*v3; f1[6]=2*v1-f1[6]; f1[7]=2*v2-f1[7]; xr=fmode===0?v2:xr-k2*v1-v2; }
          if(drv){ xl=Math.tanh(drv*xl)*drvN; xr=Math.tanh(drv*xr)*drvN; }
          gg+=gs; L[i+s]+=xl*gg*bl; R[i+s]+=xr*gg*br;
        }
        v.pm=pm; v.ps=ps; v.g=gT; v.age+=m; i+=m;
        if((v.steal&&gT===0)||(tr>=0&&tt-tr>tail)){ v.done=true; break; }
      }
    }
  }
  registerProcessor("bourdon-synth",Synth);
}

/* charge les processeurs dans un contexte ; la promesse rend true s'ils sont disponibles.
   Une URL de blob d'abord ; en file:// elle est refusée, une URL data: prend le relais. */
function fxLoad(ctx){
  if(ctx.__fxP) return ctx.__fxP;
  if(!ctx.audioWorklet){ ctx.__fxDone=true; return ctx.__fxP=Promise.resolve(false); }
  const src="("+fxWorkletBody.toString()+")();", ways=[];
  if(typeof Blob!=="undefined"&&typeof URL!=="undefined"&&URL.createObjectURL) ways.push(()=>{ const u=URL.createObjectURL(new Blob([src],{type:"application/javascript"})); return ctx.audioWorklet.addModule(u).finally(()=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); });
  ways.push(()=>ctx.audioWorklet.addModule("data:application/javascript;charset=utf-8,"+encodeURIComponent(src)));
  const attempt=i=>{ let p; try{ p=ways[i](); }catch(e){ p=Promise.reject(e); } return p.then(()=>{ ctx.__fx=true; return true; },()=>i+1<ways.length?attempt(i+1):false); };
  return ctx.__fxP=attempt(0).then(ok=>{ ctx.__fxDone=true; return ok; });
}
