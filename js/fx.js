"use strict";
/* ============================================================
   EFFETS EN AUDIOWORKLET : réverbération modulée, nuage de grains
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
}

/* charge les processeurs dans un contexte ; la promesse rend true s'ils sont disponibles.
   Une URL de blob d'abord ; en file:// elle est refusée, une URL data: prend le relais. */
function fxLoad(ctx){
  if(ctx.__fxP) return ctx.__fxP;
  if(!ctx.audioWorklet) return ctx.__fxP=Promise.resolve(false);
  const src="("+fxWorkletBody.toString()+")();", ways=[];
  if(typeof Blob!=="undefined"&&typeof URL!=="undefined"&&URL.createObjectURL) ways.push(()=>{ const u=URL.createObjectURL(new Blob([src],{type:"application/javascript"})); return ctx.audioWorklet.addModule(u).finally(()=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); });
  ways.push(()=>ctx.audioWorklet.addModule("data:application/javascript;charset=utf-8,"+encodeURIComponent(src)));
  const attempt=i=>{ let p; try{ p=ways[i](); }catch(e){ p=Promise.reject(e); } return p.then(()=>{ ctx.__fx=true; return true; },()=>i+1<ways.length?attempt(i+1):false); };
  return ctx.__fxP=attempt(0);
}
