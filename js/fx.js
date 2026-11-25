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
  /* chambres : six manières de colorer le même réseau, d'après la pédale Rooms de Death By Audio (2020).
     mode 0 : réverb vivante seule. 1 pièce : prédélai à droite seulement, l'image s'élargit. 2 écho : un écho réinjecté nourrit la salle.
     3 crête : la queue passe par un passe-bande résonant, accordé par le moteur sur la tonique ou une quinte : la salle chante.
     4 porte : la queue se ferme peu après chaque attaque ; tout en haut de la profondeur, elle ne se ferme plus et se fige.
     5 onde : la queue ondule en hauteur (vibrato). 6 gong : repliement (à gauche) ou modulation en anneau (à droite), net au milieu.
     « fr » et « dp » sont les deux boutons de la pédale (0 à 1), « hz » la fréquence accordée (crête, gong), « dt » le temps de l'écho. */
  class Verb extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("decay",3,0.2,30),kr("damp",0.5,0,1),kr("mod",0.5,0,1),kr("shimmer",0,0,1),kr("pre",0,0,0.25),
      kr("mode",0,0,6),kr("fr",0.5,0,1),kr("dp",0.3,0,1),kr("hz",440,20,12000),kr("dt",0.3,0.01,1.6)]; }
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
      /* chambres */
      this.rpSize=pow2(Math.ceil(0.07*sampleRate)); this.rpBuf=new Float32Array(this.rpSize); this.rpW=0;
      this.eSize=pow2(Math.ceil(1.7*sampleRate)); this.eBuf=new Float32Array(this.eSize); this.eW=0; this.eLp=0;
      this.sv=new Float32Array(4);
      this.envF=0; this.envS=0; this.hold=0; this.gg=1;
      this.vSize=pow2(Math.ceil(0.03*sampleRate)); this.vBuf=[new Float32Array(this.vSize),new Float32Array(this.vSize)]; this.vW=0; this.vPh=0;
      this.rPh=0; this.shL=0; this.shR=0; this.shC=0;
    }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], oL=out[0], oR=out[1]||out[0], n=oL.length, iL=inp[0], iR=inp[1]||inp[0];
      /* rien n'entre et la queue est éteinte : on ne calcule plus */
      if(!iL&&this.quiet>sampleRate*2) return true;
      const sr=sampleRate, md=Math.round(P.mode[0]), fr=P.fr[0], dp=P.dp[0];
      /* porte tout en haut : la queue se fige (décroissance très longue, entrée presque fermée) */
      const fz=md===4&&dp>0.8?(dp-0.8)/0.2:0, inG=1/Math.sqrt(1+15*fz); /* l'énergie tenue reste celle d'avant : entrée réduite d'autant que la queue s'allonge */
      const T=P.decay[0]*(1+15*fz), c=1-0.78*P.damp[0], dep=this.depth*P.mod[0]*(md===5?1+3*dp:1), sh=P.shimmer[0]*0.42, pre=Math.min(this.pSize-2,Math.round(P.pre[0]*sr));
      /* réglages propres à chaque mode, calculés une fois par bloc */
      const dR=md===1?Math.min(this.rpSize-2,Math.round(dp*0.06*sr)):0;
      const eD=md===2?Math.max(1,Math.min(this.eSize-2,Math.round(P.dt[0]*sr))):0, eFb=0.88*dp, eM=this.eSize-1;
      let sk=0,sa1=0,sa2=0,sa3=0,sC=0;
      if(md===3){ const q=0.7+30*dp*dp, gw=Math.tan(Math.PI*Math.min(P.hz[0],sr*0.45)/sr); sk=1/q; sa1=1/(1+gw*(gw+sk)); sa2=gw*sa1; sa3=gw*sa2; sC=Math.pow(10,(8.5*(1-Math.exp(-(q-0.2)/3.5))+5*Math.max(0,Math.min(1,Math.log2(P.hz[0]/500))))/20); /* le passe-bande ôte de l'énergie : on la rend (mesuré sur des notes et un bourdon) */ }
      const holdN=Math.round((0.04+1.2*Math.min(dp,0.8)/0.8)*sr);
      const vRate=0.15*Math.pow(2,fr*5.5), vDep=dp*0.0045*sr, vBase=0.002*sr, vM=this.vSize-1;
      const rg=md===6?Math.max(0,2*dp-1):0, al=md===6?Math.max(0,1-2*dp):0, rInc=2*Math.PI*P.hz[0]/sr, shInc=Math.min(0.9,P.hz[0]*8/sr);
      const g=this._g||(this._g=new Float32Array(8)); for(let i=0;i<8;i++) g[i]=Math.pow(10,-3*this.len[i]/(T*sr));
      /* modulation : la longueur de chaque ligne glisse d'un bout du bloc à l'autre */
      for(let i=0;i<8;i++){ const a=this.len[i]+dep*Math.sin(this.ph[i]); this.ph[i]+=2*Math.PI*this.rate[i]*n/sr; if(this.ph[i]>6.2831853) this.ph[i]-=6.2831853; const b=this.len[i]+dep*Math.sin(this.ph[i]); this.dm[i]=a; this.ds[i]=(b-a)/n; }
      const v=this.v, lp=this.lp, buf=this.buf, mask=this.mask, size=this.size, sB=this.sBuf, sM=this.sSize-1, sW=this.sW;
      let w=this.w, peak=0;
      for(let s=0;s<n;s++){
        let xl=iL?iL[s]:0, xr=iL?iR[s]:0;
        if(pre>0){ const pb=this.pBuf, pm=this.pSize-1; pb[0][this.pW]=xl; pb[1][this.pW]=xr; const r=(this.pW-pre)&pm; xl=pb[0][r]; xr=pb[1][r]; this.pW=(this.pW+1)&pm; }
        let eo=0, eo2=0;
        if(md!==0){
          if(md===2){ /* écho : les répétitions s'assombrissent et saturent doucement en boucle, puis entrent dans la salle */
            const e=this.eBuf[(this.eW-eD)&eM]; this.eLp+=(e-this.eLp)*0.3; const m=(xl+xr)*0.5+eFb*this.eLp;
            this.eBuf[this.eW]=m>1.5?1:m<-1.5?-1:m-0.1481*m*m*m; eo=e; eo2=this.eBuf[(this.eW-(eD>>1)-eD)&eM]*eFb; this.eW=(this.eW+1)&eM;
            xl+=0.8*eo; xr+=0.8*eo2;
          } else if(md===4){ /* porte : chaque attaque ouvre la queue pour un temps donné */
            const a=Math.abs(xl)+Math.abs(xr); this.envF+=(a-this.envF)*(a>this.envF?0.0225:0.0011); this.envS+=(this.envF-this.envS)*0.000075;
            if(this.envF>1.6*this.envS+1e-4) this.hold=holdN; else if(this.hold>0) this.hold--;
            const tg=fz>0||this.hold>0?1:0; this.gg+=(tg-this.gg)*(tg>this.gg?0.005:0.0008);
            xl*=inG; xr*=inG;
          }
        }
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
        let yl=(v[0]-v[2]+v[4]-v[6])*0.5, yr=(v[1]-v[3]+v[5]-v[7])*0.5;
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
        if(md>=1){
          if(md===1){ const rm=this.rpSize-1; this.rpBuf[this.rpW]=yr; yr=this.rpBuf[(this.rpW-dR)&rm]; this.rpW=(this.rpW+1)&rm; } /* pièce : la sortie droite arrive plus tard */
          else if(md===2){ yl+=0.45*eo; yr+=0.45*eo2; }
          else if(md===3){ /* crête : passe-bande à état variable (forme trapézoïdale), gain unité au sommet ; un peu de salle reste autour */
            const S=this.sv;
            let v3=yl-S[1], v1=sa1*S[0]+sa2*v3, v2=S[1]+sa2*S[0]+sa3*v3; S[0]=2*v1-S[0]; S[1]=2*v2-S[1]; yl=0.2*yl+sk*v1*sC;
            v3=yr-S[3]; v1=sa1*S[2]+sa2*v3; v2=S[3]+sa2*S[2]+sa3*v3; S[2]=2*v1-S[2]; S[3]=2*v2-S[3]; yr=0.2*yr+sk*v1*sC;
          } else if(md===4){ yl*=this.gg; yr*=this.gg; }
          else if(md===5){ /* onde : deux lignes courtes balancées en quadrature */
            const vb=this.vBuf; vb[0][this.vW]=yl; vb[1][this.vW]=yr;
            let pq=this.vW-(vBase+vDep*(1+Math.sin(this.vPh))), iq=Math.floor(pq), fq=pq-iq; yl=vb[0][iq&vM]+(vb[0][(iq-1)&vM]-vb[0][iq&vM])*fq;
            pq=this.vW-(vBase+vDep*(1+Math.cos(this.vPh))); iq=Math.floor(pq); fq=pq-iq; yr=vb[1][iq&vM]+(vb[1][(iq-1)&vM]-vb[1][iq&vM])*fq;
            this.vW=(this.vW+1)&vM; this.vPh+=2*Math.PI*vRate/sr; if(this.vPh>6.2831853) this.vPh-=6.2831853;
          } else if(md===6){ /* gong : échantillonneur bloqué à la fréquence choisie (repliement), ou multiplication par un sinus (anneau) */
            this.shC+=shInc; if(this.shC>=1){ this.shC-=1; this.shL=yl; this.shR=yr; }
            if(al>0){ yl+=(this.shL-yl)*al; yr+=(this.shR-yr)*al; }
            if(rg>0){ const sn=Math.sin(this.rPh)*1.4142; yl+=(yl*sn-yl)*rg; yr+=(yr*Math.cos(this.rPh)*1.4142-yr)*rg; }
            this.rPh+=rInc; if(this.rPh>6.2831853) this.rPh-=6.2831853;
          }
          if(md===3||md===4&&fz>0){ yl=yl>2?2:yl<-2?-2:yl; yr=yr>2?2:yr<-2?-2:yr; }
        }
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
        const nx=this.nx||(this.nx=new Float64Array(2)), fbk=this.fbk;
        for(let b=0;b<2;b++){
          let y=x+fbk[1-b];
          /* passe-tout modulé (lecture interpolée) */
          const L=this.mA[b], m=L.b.length-1, dl=this.mN[b]+this.ex*Math.sin(this.ph+b*1.7), di=dl|0, fr=dl-di;
          const a0=L.b[(L.w-di)&m], a1=L.b[(L.w-di-1)&m], dv=a0+(a1-a0)*fr, z=dv+0.7*y; L.b[L.w]=y-0.7*z; L.w=(L.w+1)&m; y=z;
          this.wr(this.d1[b],y); y=this.rd(this.d1[b],this.d1[b].n);
          this.lp[b]+=(y-this.lp[b])*(1-dmp); y=this.lp[b]*g;
          const A=this.a2[b], d2=this.rd(A,A.n), y2=d2+0.5*y; this.wr(A,y-0.5*y2); y=y2;
          this.wr(this.d2[b],y); nx[b]=this.rd(this.d2[b],this.d2[b].n)*g;
        }
        fbk[0]=nx[0]; fbk[1]=nx[1];
        /* sans itérateur ni déstructuration : rien n'est alloué par échantillon (le ramasse-miettes faisait craquer le son) */
        let l=0,r=0; const tL=this.tL, tR=this.tR; for(let q=0;q<tL.length;q++){ const t=tL[q]; l+=t[0]*this.rd(srcs[t[1]],t[2]); } for(let q=0;q<tR.length;q++){ const t=tR[q]; r+=t[0]*this.rd(srcs[t[1]],t[2]); }
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

  /* lieu procédural, d'après Andy Farnell (Designing Sound, MIT Press, 2010) : feu, vent et gouttes de pluie fabriqués à chaque échantillon,
     sans boucle qui se répète. Trois sorties stéréo : 0 feu, 1 vent, 2 gouttes. Chaque paramètre change le caractère, pas seulement le niveau
     (le niveau reste réglé dehors). Tirages déterministes depuis la graine : un export et ses stems restent identiques.
     Feu : grondement (bruit sous 200 Hz qui vacille), sifflement (bruit aigu par bouffées), craquements (impulsions de bruit résonnant,
       2 à 27 par seconde selon l'intensité, parfois un gros « pop » grave).
     Vent : une vitesse qui marche lentement au hasard, avec des rafales ; le souffle passe un filtre dont la fréquence suit la vitesse,
       et au-dessus d'une certaine vitesse deux sifflements étroits apparaissent (arêtes, fentes).
     Gouttes : arrivées au hasard (20 à 420 par seconde), chacune un « plic » aigu qui s'éteint en quelques millisecondes ; parfois une goutte
       dans une flaque, dont la bulle chante en montant (modèle de bulle de Minnaert, van den Doel). */
  class Lieu extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("feu",0,0,1),kr("vent",0,0,1),kr("pluie",0,0,1)]; }
    constructor(o){ super(); let a=((o&&o.processorOptions&&o.processorOptions.seed)||12345)>>>0;
      this.rnd=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
      const z=()=>({x1:0,x2:0,y1:0,y2:0});
      this.f={roarL:z(),roarR:z(),flick:0,hissE:0,hiss:z(),cr:[],nextCr:0,
        v:{speed:0,gust:0,gs:0,bL:z(),bR:z(),w1:z(),w2:z(),pk:0},
        r:{drops:[],next:0,bub:[],nextB:0}};
      this.t=0; }
    /* filtre biquadratique (forme directe I) aux coefficients donnés */
    static bq(s,c,x){ const y=c[0]*x+c[1]*s.x1+c[2]*s.x2-c[3]*s.y1-c[4]*s.y2; s.x2=s.x1; s.x1=x; s.y2=s.y1; s.y1=y; return y; }
    static coef(type,f,q){ const w=2*Math.PI*Math.min(f,sampleRate*0.45)/sampleRate, cw=Math.cos(w), al=Math.sin(w)/(2*q); let b0,b1,b2;
      if(type==="lp"){ b0=(1-cw)/2; b1=1-cw; b2=b0; } else if(type==="hp"){ b0=(1+cw)/2; b1=-(1+cw); b2=b0; } else { b0=al; b1=0; b2=-al; }
      const a0=1+al; return [b0/a0,b1/a0,b2/a0,-2*cw/a0,(1-al)/a0]; }
    process(inp,outs,P){
      const fo=outs[0], wo=outs[1], ro=outs[2], N=fo[0].length, R=this.rnd, F=this.f, sr=sampleRate;
      const feu=P.feu[0], vent=P.vent[0], pluie=P.pluie[0];
      for(const o of [fo,wo,ro]) for(const ch of o) ch.fill(0);
      /* ---------- feu ---------- */
      if(feu>0.001){
        if(!F.cRoar) F.cRoar=Lieu.coef("lp",170,0.6); if(!F.cHiss) F.cHiss=Lieu.coef("hp",2400,0.7);
        const rate=2+25*feu, L=fo[0], Rr=fo[1];
        for(let i=0;i<N;i++){
          F.flick+=((R()*2-1)-F.flick)*0.0006; const fl=0.55+0.9*Math.abs(F.flick)*6;
          const rl=Lieu.bq(F.roarL,F.cRoar,R()*2-1)*fl*1.6, rr=Lieu.bq(F.roarR,F.cRoar,R()*2-1)*fl*1.6;
          F.hissE+=((R()<0.0004*(0.3+feu)?1:0)-F.hissE)*0.002; const hs=Lieu.bq(F.hiss,F.cHiss,R()*2-1)*F.hissE*0.9*feu;
          let c=0;
          if(--F.nextCr<=0){ F.nextCr=Math.floor(-Math.log(1-R()*0.999)/rate*sr);
            if(F.cr.length<6){ const big=R()<0.05, fq=big?300+R()*400:1500+R()*3500; F.cr.push({cf:Lieu.coef("bp",fq,big?3:6),s:{x1:0,x2:0,y1:0,y2:0},e:(big?1.6:0.5+R())*Math.pow(R(),0.5),d:Math.exp(-1/((big?0.015:0.0015+R()*0.004)*sr)),pan:R()*2-1}); } }
          let cl=0, cr2=0;
          for(let k=F.cr.length-1;k>=0;k--){ const q=F.cr[k]; const y=Lieu.bq(q.s,q.cf,(R()*2-1)*q.e)*3; q.e*=q.d; cl+=y*(1-q.pan)*0.5; cr2+=y*(1+q.pan)*0.5; if(q.e<1e-4) F.cr.splice(k,1); }
          L[i]=(rl+hs+cl)*0.5; Rr[i]=(rr+hs+cr2)*0.5;
        }
      }
      /* ---------- vent ---------- */
      if(vent>0.001){
        const V=F.v, L=wo[0], Rr=wo[1];
        for(let i=0;i<N;i+=32){
          /* vitesse : base selon le réglage, rafales en marche aléatoire lente */
          /* rafales : processus d'Ornstein-Uhlenbeck (marche aléatoire rappelée vers zéro), temps propre 3 s, écart 0,6 ; puis lissé sur 0,4 s */
          { const dt=32/sampleRate; V.gs+=-V.gs*dt/3+0.6*Math.sqrt(2*dt/3)*(R()+R()+R()-1.5)*2; V.gust+=(V.gs-V.gust)*dt/0.4; }
          V.speed=Math.max(0,Math.min(1.3,0.15+0.75*vent+0.55*vent*V.gust));
          const sp=V.speed, fc=220+900*sp, q=0.7+1.6*sp, cB=Lieu.coef("bp",fc,q), cB2=Lieu.coef("bp",fc*1.13,q), w1=Lieu.coef("bp",620+1500*sp,28), w2=Lieu.coef("bp",(620+1500*sp)*1.41,34);
          const amp=Math.pow(sp,1.5)*1.4, wh=Math.max(0,sp-0.55)*Math.max(0,sp-0.55)*2.2, end=Math.min(N,i+32);
          for(let j=i;j<end;j++){
            const nL=R()*2-1, nR=R()*2-1, bl=Lieu.bq(V.bL,cB,nL), br=Lieu.bq(V.bR,cB2,nR);
            const ws=Lieu.bq(V.w1,w1,(nL+nR)*0.5)*wh*4+Lieu.bq(V.w2,w2,nL)*wh*2.5;
            L[j]=(bl*amp+ws*0.8)*0.6; Rr[j]=(br*amp+ws*1.0)*0.6;
          }
        }
      }
      /* ---------- gouttes ---------- */
      if(pluie>0.001){
        const D=F.r, L=ro[0], Rr=ro[1], rate=20+400*Math.pow(pluie,1.5), brate=0.3+3*pluie;
        for(let i=0;i<N;i++){
          if(--D.next<=0){ D.next=Math.floor(-Math.log(1-R()*0.999)/rate*sr);
            if(D.drops.length<24){ const f=2200+R()*6000; D.drops.push({ph:0,w:2*Math.PI*f/sr,a:0.25*Math.pow(R(),2),d:Math.exp(-1/((0.002+R()*0.006)*sr)),ch:Math.exp(-1/(0.02*sr)),pan:R()*2-1}); } }
          if(--D.nextB<=0){ D.nextB=Math.floor(-Math.log(1-R()*0.999)/brate*sr);
            if(D.bub.length<4){ const f=500+R()*700; D.bub.push({ph:0,f,a:0.18*R(),d:Math.exp(-1/((0.012+R()*0.02)*sr)),k:Math.pow(1+0.8*R(),1/(0.03*sr)),pan:R()*2-1}); } }
          let l=0, r=0;
          for(let k=D.drops.length-1;k>=0;k--){ const q=D.drops[k]; q.ph+=q.w; q.w*=q.ch>0?1-0.00002:1; const y=Math.sin(q.ph)*q.a; q.a*=q.d; l+=y*(1-q.pan)*0.5; r+=y*(1+q.pan)*0.5; if(q.a<1e-4) D.drops.splice(k,1); }
          for(let k=D.bub.length-1;k>=0;k--){ const q=D.bub[k]; q.f*=q.k; q.ph+=2*Math.PI*q.f/sr; const y=Math.sin(q.ph)*q.a; q.a*=q.d; l+=y*(1-q.pan)*0.5; r+=y*(1+q.pan)*0.5; if(q.a<1e-4) D.bub.splice(k,1); }
          L[i]=l; Rr[i]=r;
        }
      }
      this.t+=N; return true;
    }
  }
  registerProcessor("bourdon-lieu",Lieu);

  /* égaliseur de niveau : entrée 0 = le signal avant l'effet, entrée 1 = après ; la sortie est l'entrée 1 ramenée à l'énergie de l'entrée 0.
     Les deux énergies sont suivies sur environ une demi-seconde ; dans le silence, le gain reste où il était. Sert à la fuzz. */
  class Match extends AudioWorkletProcessor{
    constructor(){ super(); this.er=0; this.ep=0; this.g=1; this.a=1-Math.exp(-1/(0.5*sampleRate)); }
    process(inputs,outputs){
      const r=inputs[0], q=inputs[1], out=outputs[0], n=out[0].length, a=this.a;
      if(!q||!q[0]){ for(const ch of out) ch.fill(0); return true; }
      const r0=r&&r[0], r1=r&&(r[1]||r[0]), q0=q[0], q1=q[1]||q[0], o0=out[0], o1=out[1]||out[0];
      let er=this.er, ep=this.ep, g=this.g;
      for(let s=0;s<n;s++){
        const x=r0?(r0[s]*r0[s]+r1[s]*r1[s])*0.5:0, y=(q0[s]*q0[s]+q1[s]*q1[s])*0.5;
        er+=(x-er)*a; ep+=(y-ep)*a;
        if(s===0||s===n>>1){ if(er>1e-9&&ep>1e-9){ const t=Math.sqrt(er/ep); g+=((t<0.03?0.03:t>12?12:t)-g)*0.08; } }
        o0[s]=q0[s]*g; if(o1!==o0) o1[s]=q1[s]*g;
      }
      this.er=er; this.ep=ep; this.g=g; return true;
    }
  }
  registerProcessor("bourdon-match",Match);

  /* pédales d'insert, d'après Death By Audio : une seule classe, le genre choisi à la création.
     Paramètres communs : mix (mélange, en puissance constante) et a, b, c, d, e (0 à 1), dont le sens change avec le genre.
     fgun (Supersonic Fuzz Gun) : a fuzz, b biais, c densité (bosse résonante avant l'écrêtage ; en oscillation, sa fréquence), d filtre de sortie, e 0 porte / 1 oscillation.
     cross (Crossover Fuzz) : a fréquence de croisement, b résonance, c gain, d équilibre grave/aigu ; chaque bande est saturée à part.
     bits (Robot) : a fréquence d'échantillonnage (400 Hz à 19 kHz), b nombre de bits (2 à 12) : le repliement des vieilles puces.
     filt (Evil Filter) : a fréquence, b résonance (jusqu'au sifflement), c 0 passe-bas / 0,5 passe-bande / 1 passe-haut, d drive avant le filtre, e balayage lent.
     Le niveau du son traité est égalé en continu sur le son propre (énergie suivie sur une demi-seconde), comme la fuzz. */
  class Pedal extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("mix",0.6,0,1),kr("a",0.5,0,1),kr("b",0.5,0,1),kr("c",0.5,0,1),kr("d",0.5,0,1),kr("e",0,0,1)]; }
    constructor(o){
      super(); this.kind=(o&&o.processorOptions&&o.processorOptions.kind)||"fgun"; this.o=new Float64Array(3);
      this.s=[new Float32Array(8),new Float32Array(8)]; this.er=0; this.ep=0; this.g=1; this.al=1-Math.exp(-1/(0.5*sampleRate));
      this.ph=0; this.lfo=0; this.env=[0,0]; this.envS=[0,0]; this.gg=[1,1]; this.hold=[0,0]; this.hc=0; this.dc=[0,0]; this.dcx=[0,0];
    }
    /* filtre à état variable (forme trapézoïdale), état dans st[i], st[i+1] ; rend passe-bas, passe-bande, passe-haut */
    /* rien n'est alloué ici : les trois sorties vont dans this.o (passe-bas, passe-bande, passe-haut) */
    svf(st,i,x,gw,k){ const a1=1/(1+gw*(gw+k)), a2=gw*a1, a3=gw*a2, v3=x-st[i+1], v1=a1*st[i]+a2*v3, v2=st[i+1]+a2*st[i]+a3*v3; st[i]=2*v1-st[i]; st[i+1]=2*v2-st[i+1]; const o=this.o; o[0]=v2; o[1]=v1; o[2]=x-k*v1-v2; return o; }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], n=out[0].length, sr=sampleRate;
      if(!inp||!inp[0]){ for(const ch of out) ch.fill(0); return true; }
      const mix=P.mix[0], A=P.a[0], Bp=P.b[0], C=P.c[0], Dp=P.d[0], Ep=P.e[0], wet=Math.sin(mix*Math.PI/2), dry=Math.cos(mix*Math.PI/2);
      const nc=Math.min(out.length,2), K=this.kind;
      /* réglages du bloc */
      let gw=0,k=1,G=1,fo=1,bias=0,thr=0,gw2=0,shInc=0,q=1,mode=0;
      if(K==="fgun"){ const fc=150*Math.pow(2,C*4); gw=Math.tan(Math.PI*fc/sr); k=1/(0.7+6*C); G=2*Math.pow(10,A*2.4); fo=1-Math.exp(-2*Math.PI*800*Math.pow(2,Dp*4)/sr); bias=(Bp-0.5)*1.2; thr=0.12+0.9*Math.abs(Bp-0.5); this.ph+=0; }
      else if(K==="cross"){ const fc=60*Math.pow(100,A); gw=Math.tan(Math.PI*Math.min(fc,sr*0.4)/sr); gw2=Math.tan(Math.PI*Math.min(fc*1.5,sr*0.45)/sr); k=1/(0.7+9.3*Bp*Bp); G=1+199*C*C; }
      else if(K==="bits"){ shInc=Math.min(1,400*Math.pow(2,A*5.57)/sr); q=Math.pow(2,2+Math.round(Bp*10)-1); } /* les pas se règlent sur le niveau du moment : même un son faible garde ses marches */
      else if(K==="filt"){ this.lfo+=2*Math.PI*0.07*n/sr; if(this.lfo>6.2831853) this.lfo-=6.2831853; const fc=40*Math.pow(250,A)*Math.pow(2,2*Ep*Math.sin(this.lfo)); gw=Math.tan(Math.PI*Math.min(fc,sr*0.45)/sr); k=1/(0.5+24.5*Bp*Bp); G=1+19*Dp*Dp; mode=C<0.25?0:C<0.75?1:2; }
      const oscInc=2*Math.PI*(75*Math.pow(2,C*4))/sr, osc=K==="fgun"&&Ep>=0.5;
      let er=this.er, ep=this.ep, g=this.g; const al=this.al;
      for(let s=0;s<n;s++){
        let xe=0, ye=0; const sn=osc?Math.sin(this.ph):0; if(osc){ this.ph+=oscInc; if(this.ph>6.2831853) this.ph-=6.2831853; }
        for(let ch=0;ch<nc;ch++){
          const x=(inp[ch]||inp[0])[s], st=this.s[ch]; let y=x;
          if(K==="fgun"){
            const f=this.svf(st,0,x,gw,k); let z=(x+2*C*f[1])*G+bias+(osc?0.35*sn:0);
            z=z>1?1:z<-1?-1:z;
            /* porte : elle s'ouvre sur l'attaque et se ferme vite quand le son retombe, d'où le crachotement */
            const a=Math.abs(x); this.env[ch]+=(a-this.env[ch])*(a>this.env[ch]?0.02:0.0015); this.envS[ch]+=(this.env[ch]-this.envS[ch])*0.00002;
            if(!osc){ const open=this.env[ch]>this.envS[ch]*thr+1e-5; this.gg[ch]+=((open?1:0)-this.gg[ch])*(open?0.05:0.02); z*=this.gg[ch]; }
            st[2]+=(z-st[2])*fo; st[3]+=(st[2]-st[3])*fo; y=st[3];
          } else if(K==="cross"){
            const lo=this.svf(st,0,x,gw,k)[0], hi=this.svf(st,2,x,gw2,k)[2]; /* [0] lu avant le second appel, qui réécrit this.o */
            y=(1-Dp)*Math.tanh(G*lo)+Dp*Math.tanh(G*hi);
          } else if(K==="bits"){
            const a=Math.abs(x); st[2]=a>st[2]?a:st[2]*0.99995+1e-7; st[1]+=shInc; if(st[1]>=1){ st[1]-=1; const e=st[2]||1e-3; st[0]=Math.round(x/e*q)/q*e; } y=st[0];
          } else if(K==="filt"){
            const xd=G>1.01?Math.tanh(G*x)/Math.tanh(G):x, f=this.svf(st,0,xd+(Bp>0.92?1e-4*(Math.random()-0.5):0),gw,k);
            y=f[mode]; y=y>1.5?1.5:y<-1.5?-1.5:y;
          }
          /* sans composante continue */
          const d=y-this.dcx[ch]+0.995*this.dc[ch]; this.dcx[ch]=y; this.dc[ch]=d; y=d;
          xe+=x*x; ye+=y*y; st[7]=y;
        }
        er+=(xe/nc-er)*al; ep+=(ye/nc-ep)*al;
        if((s&31)===0&&er>1e-10&&ep>1e-10){ const t=0.85*Math.sqrt(er/ep); g+=((t<0.03?0.03:t>12?12:t)-g)*0.05; }
        for(let ch=0;ch<out.length;ch++){ const x=(inp[Math.min(ch,inp.length-1)]||inp[0])[s], y=this.s[Math.min(ch,nc-1)][7]; out[ch][s]=dry*x+wet*g*y; }
      }
      this.er=er; this.ep=ep; this.g=g; return true;
    }
  }
  registerProcessor("bourdon-pedale",Pedal);

  /* écho zone rouge, d'après l'Echo Dream 2 et la Micro Dream : plus le temps est long, plus la puce est poussée,
     d'où une ligne qui s'échantillonne plus bas, s'assombrit et souffle ; la réinjection sature doucement et peut monter jusqu'à l'oscillation ;
     modulation sinus ou carrée ; une fuzz après l'écho, sur les répétitions. */
  class EchoZR extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("time",0.4,0.02,1.6),kr("fb",0.45,0,1.05),kr("mdep",0.3,0,1),kr("mspd",0.3,0,1),kr("shape",0,0,1),kr("fuzz",0,0,1)]; }
    constructor(){ super(); this.size=1<<17; this.buf=new Float32Array(this.size); this.w=0; this.lp=0; this.hold=0; this.hc=0; this.ph=0; this.rnd=12345; this.quiet=1e9; this.dm=0; }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], n=out[0].length, sr=sampleRate, iL=inp&&inp[0], iR=inp&&(inp[1]||inp[0]);
      if(!iL&&this.quiet>sr*8) { for(const ch of out) ch.fill(0); return true; }
      const T=P.time[0], fb=P.fb[0], deg=Math.max(0,Math.min(1,(T-0.25)/0.75)), hInc=1/(1+deg*5), lpc=0.5-0.42*deg, nz=0.004*deg;
      const dep=P.mdep[0]*0.012*sr, spd=0.1*Math.pow(60,P.mspd[0]), sq=P.shape[0]>0.5, fz=P.fuzz[0], fG=1+fz*25, fzc=t=>t*(1-fz)+fz*0.15*Math.tanh(fG*t);
      const M=this.size-1, b=this.buf; let peak=0;
      for(let s=0;s<n;s++){
        const x=iL?(iL[s]+iR[s])*0.5:0;
        this.ph+=2*Math.PI*spd/sr; if(this.ph>6.2831853) this.ph-=6.2831853;
        let m=Math.sin(this.ph); if(sq) m=Math.max(-1,Math.min(1,m*8));
        this.dm+=(m-this.dm)*0.002;
        const d=Math.max(2,T*sr+dep*(1+this.dm)), rp=this.w-d, i0=Math.floor(rp), fr=rp-i0;
        let y=b[i0&M]+(b[(i0+1)&M]-b[i0&M])*fr;
        /* la puce poussée : échantillonnée plus bas, assombrie, avec du souffle */
        this.hc+=hInc; if(this.hc>=1){ this.hc-=1; this.hold=y; } y=this.hold;
        this.lp+=(y-this.lp)*lpc; y=this.lp;
        this.rnd=(this.rnd*1103515245+12345)&0x7fffffff; y+=nz*(this.rnd/0x7fffffff-0.5);
        const v=x+fb*y; b[this.w]=v>1.2?1.2:v<-1.2?-1.2:Math.tanh(v);
        this.w=(this.w+1)&M;
        let o=fz>0.01?fzc(y):y;
        const rpR=rp-0.007*sr, j=Math.floor(rpR); let yr=b[j&M];
        if(fz>0.01) yr=fzc(yr);
        out[0][s]=o; if(out[1]) out[1][s]=yr;
        const a=o<0?-o:o; if(a>peak) peak=a;
      }
      if(iL||peak>1e-5) this.quiet=0; else this.quiet+=n;
      return true;
    }
  }
  registerProcessor("bourdon-zr",EchoZR);

  /* ressort saturé, d'après la Reverberation Machine : trois ressorts (une ligne bouclée chacun, longue de 33 à 46 ms),
     dont la boucle passe par six passe-tout du premier ordre (la dispersion qui fait le « boing »), amortie, sombre ou claire ;
     l'altitude sature l'entrée et la sortie. */
  class Spring extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return [kr("alt",0.3,0,1),kr("tone",0,0,1),kr("decay",0.5,0,1)]; }
    constructor(){ super(); const k=sampleRate/44100; this.len=[1455,1720,2030].map(x=>Math.round(x*k)); this.b=this.len.map(l=>new Float32Array(l+8)); this.w=[0,0,0];
      this.ap=this.len.map(()=>new Float32Array(12)); this.lp=[0,0,0]; this.hp=0; this.quiet=1e9; }
    process(inputs,outputs,P){
      const inp=inputs[0], out=outputs[0], n=out[0].length, sr=sampleRate, iL=inp&&inp[0], iR=inp&&(inp[1]||inp[0]);
      if(!iL&&this.quiet>sr*6){ for(const ch of out) ch.fill(0); return true; }
      const alt=P.alt[0], dG=1+alt*8, T=1.5+P.decay[0]*4, lc=P.tone[0]>0.5?0.6:0.22, oG=1+alt*2;
      const g=this.g||(this.g=new Float64Array(3)); for(let i=0;i<3;i++) g[i]=Math.pow(10,-3*this.len[i]/(T*sr)); const A=0.62; let peak=0;
      for(let s=0;s<n;s++){
        let x=iL?(iL[s]+iR[s])*0.5:0;
        this.hp+=(x-this.hp)*0.02; x=x-this.hp; x=Math.tanh(dG*x)/Math.sqrt(dG);
        const y=this.y||(this.y=new Float64Array(3));
        for(let i=0;i<3;i++){
          const L=this.len[i], bf=this.b[i]; let r=this.w[i]-L; if(r<0) r+=L+8; let v=bf[r];
          const ap=this.ap[i];
          for(let q=0;q<6;q++){ const xp=ap[2*q], yp=ap[2*q+1], o=-A*v+xp+A*yp; ap[2*q]=v; ap[2*q+1]=o; v=o; }
          this.lp[i]+=(v-this.lp[i])*lc; v=this.lp[i];
          y[i]=v; bf[this.w[i]]=x+g[i]*v; this.w[i]=(this.w[i]+1)%(L+8);
        }
        const l=Math.tanh(oG*(y[0]+0.6*y[1]))/oG, r=Math.tanh(oG*(y[2]+0.6*y[1]))/oG;
        out[0][s]=l; if(out[1]) out[1][s]=r; const a=l<0?-l:l; if(a>peak) peak=a;
      }
      if(iL||peak>1e-5) this.quiet=0; else this.quiet+=n;
      return true;
    }
  }
  registerProcessor("bourdon-ressort",Spring);
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
