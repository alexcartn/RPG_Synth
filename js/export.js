"use strict";
/* ============================================================
   EXPORT : WAV, boucle, stems, MIDI, réglages
   ============================================================ */
function status(msg,kind){const s=$("status"); if(!s) return; s.textContent=msg; s.className="status"+(kind?" "+kind:"");}
const nextFrame=()=>new Promise(r=>setTimeout(r,30));

function wavFromChannels(L,R,sr,gain){
  const n=L.length, out=new ArrayBuffer(44+n*4), v=new DataView(out);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,"RIFF"); v.setUint32(4,36+n*4,true); w(8,"WAVE"); w(12,"fmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,2,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*4,true); v.setUint16(32,4,true); v.setUint16(34,16,true); w(36,"data"); v.setUint32(40,n*4,true);
  let o=44;
  for(let i=0;i<n;i++){
    v.setInt16(o,Math.max(-1,Math.min(1,L[i]*gain))*32767,true); o+=2;
    v.setInt16(o,Math.max(-1,Math.min(1,R[i]*gain))*32767,true); o+=2;
  }
  return new Uint8Array(out);
}
function peakOf(L,R){let p=0; for(let i=0;i<L.length;i++){const a=Math.abs(L[i]), b=Math.abs(R[i]); if(a>p)p=a; if(b>p)p=b;} return p;}

const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRCT[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function zipStore(files){
  const enc=new TextEncoder(), parts=[], cds=[]; let off=0;
  files.forEach(f=>{
    const nb=enc.encode(f.name), data=f.data, crc=crc32(data), sz=data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(12,33,true);
    lh.setUint32(14,crc,true); lh.setUint32(18,sz,true); lh.setUint32(22,sz,true); lh.setUint16(26,nb.length,true);
    parts.push(lh,nb,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(14,33,true);
    ch.setUint32(16,crc,true); ch.setUint32(20,sz,true); ch.setUint32(24,sz,true); ch.setUint16(28,nb.length,true); ch.setUint32(42,off,true);
    cds.push(ch,nb); off+=30+nb.length+sz;
  });
  const cdSize=cds.reduce((a,x)=>a+(x.byteLength!==undefined?x.byteLength:x.length),0);
  const en=new DataView(new ArrayBuffer(22));
  en.setUint32(0,0x06054b50,true); en.setUint16(8,files.length,true); en.setUint16(10,files.length,true); en.setUint32(12,cdSize,true); en.setUint32(16,off,true);
  return new Blob([...parts,...cds,en],{type:"application/zip"});
}

function vlq(n){const b=[n&0x7f]; n>>=7; while(n>0){b.unshift((n&0x7f)|0x80); n>>=7;} return b;}
function midiFile(events,Sx){
  const PPQ=480, spq=60/Sx.tempo, base=36+Sx.root, trs=[[],[],[]];
  events.forEach(e=>{
    const note=Math.max(0,Math.min(127,base+e.off)), t=Math.round(e.t/spq*PPQ), d=Math.max(30,Math.round(e.dur/spq*PPQ)), vel=Math.max(1,Math.min(127,Math.round(40+e.vel*200)));
    trs[e.tr].push({t,on:true,note,vel},{t:t+d,on:false,note,vel:0});
  });
  const m=METERS[Sx.meter], tempoUs=Math.round(60e6/Sx.tempo);
  const hdr=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,4,(PPQ>>8)&255,PPQ&255];
  const chunk=(bytes)=>[0x4d,0x54,0x72,0x6b,(bytes.length>>>24)&255,(bytes.length>>>16)&255,(bytes.length>>>8)&255,bytes.length&255,...bytes];
  const tempoTrack=[0,0xff,0x51,3,(tempoUs>>16)&255,(tempoUs>>8)&255,tempoUs&255, 0,0xff,0x58,4,m.n,m.d,24,8, 0,0xff,0x2f,0];
  const names=["Melodie","Canon","Nappes"];
  const tracks=[chunk(tempoTrack)];
  trs.forEach((evs,i)=>{
    evs.sort((a,b)=>a.t-b.t||(a.on?1:-1));
    const nm=[...names[i]].map(c=>c.charCodeAt(0)), b=[0,0xff,0x03,nm.length,...nm];
    let last=0; evs.forEach(e=>{ b.push(...vlq(e.t-last), (e.on?0x90:0x80)|i, e.note, e.vel); last=e.t; });
    b.push(0,0xff,0x2f,0); tracks.push(chunk(b));
  });
  return new Uint8Array([...hdr,...tracks.flat()]);
}

async function renderOffline(Sx,dur,o){
  const sr=44100, tail=o.loop?8:0, total=dur+tail;
  const ctx=new OfflineAudioContext(2,Math.ceil(sr*total),sr);
  const eng=buildEngine(ctx,Sx,{solo:o.solo,noComp:o.noComp,record:o.record});
  eng.start(0,o.loop?0.05:5,o.loop?0:total);
  eng.schedule(total);
  const buf=await ctx.startRendering();
  let L=buf.getChannelData(0), R=buf.getChannelData(1);
  if(o.loop){
    const N=Math.floor(sr*dur), tn=Math.floor(sr*tail), L2=new Float32Array(N), R2=new Float32Array(N);
    for(let i=0;i<N;i++){
      if(i<tn){const w=i/tn, a=Math.sin(w*Math.PI/2), b=Math.cos(w*Math.PI/2); L2[i]=L[i]*a+L[N+i]*b; R2[i]=R[i]*a+R[N+i]*b;}
      else{L2[i]=L[i]; R2[i]=R[i];}
    }
    L=L2; R=R2;
  }
  return {L,R,sr,events:eng.events};
}

function saveFiles(files,baseName){
  const single=files.length===1&&/\.wav$/.test(files[0].name);
  const blob=single?new Blob([files[0].data],{type:"audio/wav"}):zipStore(files);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=single?files[0].name:baseName+".zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  return single?"wav":"zip";
}

function codeOf(){ return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function fromCode(c){ return JSON.parse(decodeURIComponent(escape(atob(c.trim())))); }

function buildExport(host){
  const sec=document.createElement("section"); sec.className="chap";
  sec.innerHTML=
    '<header><span class="num">VIII</span><div><h2>Export</h2><p class="sub">Rendu hors ligne, plus vite que le temps réel, avec la graine et les réglages actuels. WAV 16 bits stéréo à 44,1 kHz.</p></div></header>'+
    '<div class="fields">'+
      '<div class="ctl"><label for="dur">Durée</label><select id="dur"><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180" selected>3 minutes</option><option value="300">5 minutes</option><option value="480">8 minutes</option></select></div>'+
      '<div class="ctl"><label class="chk"><span><input type="checkbox" id="xLoop">Boucle sans couture</span></label><p class="hint">Fondu enchaîné de la fin sur le début : le fichier boucle sans clic.</p></div>'+
      '<div class="ctl"><label class="chk"><span><input type="checkbox" id="xStems">Stems séparés</span></label><p class="hint">Bourdon, mélodie et canon, nappes, percussion, lieu. Sans compresseur, à sommer dans ton logiciel. 3 minutes maximum.</p></div>'+
      '<div class="ctl"><label class="chk"><span><input type="checkbox" id="xMidi">Fichier MIDI</span></label><p class="hint">Pistes mélodie, canon et nappes. Les tempéraments non égaux ne passent pas en MIDI.</p></div>'+
    '</div>'+
    '<div class="row" style="margin-top:24px"><button class="btn main" id="exp" type="button">Rendre et exporter</button></div>'+
    '<p class="status" id="status" role="status" aria-live="polite"></p>'+
    '<details class="fin"><summary>Code de partage des réglages</summary>'+
      '<div class="fields"><div class="ctl"><label for="codeOut">Ton code</label><textarea id="codeOut" readonly></textarea><div class="row"><button class="lnk" id="copyCode" type="button">Copier le code</button></div></div>'+
      '<div class="ctl"><label for="codeIn">Coller un code</label><textarea id="codeIn" placeholder="Colle ici un code reçu"></textarea><div class="row"><button class="lnk" id="loadCode" type="button">Charger ces réglages</button></div></div></div></details>';
  host.appendChild(sec);
  $("exp").onclick=doExport;
  sec.querySelector("details").addEventListener("toggle",()=>{ $("codeOut").value=codeOf(); });
  $("copyCode").onclick=async()=>{ $("codeOut").value=codeOf(); try{ await navigator.clipboard.writeText($("codeOut").value); status("Code copié.","ok"); }catch(e){ $("codeOut").select(); status("Copie automatique refusée : sélectionne le code et copie-le à la main."); } };
  $("loadCode").onclick=()=>{ try{ S=merge(clone(DEFAULT),fromCode($("codeIn").value)); syncUI(); restartIfLive(); status("Réglages chargés.","ok"); }catch(e){ status("Code illisible.","err"); } };
}

async function doExport(){
  const btn=$("exp"); btn.disabled=true;
  try{
    const Sx=clone(S), dur=parseInt($("dur").value), loop=$("xLoop").checked, stems=$("xStems").checked, midi=$("xMidi").checked;
    if(stems&&dur>180){ status("Stems : 3 minutes maximum. Choisis une durée plus courte.","err"); return; }
    const root=NOTES[Sx.root].replace("#","d"), mode=(Sx.scales[0]||"mode"), base="bourdon_"+root+"_"+mode+"_"+Sx.tempo+"bpm_graine"+Sx.seed+"_"+(dur/60)+"min";
    const files=[];
    status("Rendu du mix, quelques secondes..."); await nextFrame();
    const mix=await renderOffline(Sx,dur,{loop,record:midi});
    const g=0.891/(peakOf(mix.L,mix.R)||1);
    files.push({name:base+(loop?"_boucle":"")+".wav", data:wavFromChannels(mix.L,mix.R,mix.sr,g)});
    if(midi){ files.push({name:base+".mid", data:midiFile(mix.events,Sx)}); }
    if(stems){
      const groups=[["drone","bourdon"],["mel","melodie_canon"],["pad","nappes"],["perc","percussion"],["amb","lieu"]];
      const res=[]; let mp=0;
      for(let i=0;i<groups.length;i++){
        status("Stem "+(i+1)+" sur "+groups.length+" : "+groups[i][1]+"..."); await nextFrame();
        const r=await renderOffline(Sx,dur,{loop:false,solo:groups[i][0],noComp:true}); res.push(r); mp=Math.max(mp,peakOf(r.L,r.R));
      }
      const gs=0.7/(mp||1);
      res.forEach((r,i)=>files.push({name:"stems/"+base+"_"+groups[i][1]+".wav", data:wavFromChannels(r.L,r.R,r.sr,gs)}));
    }
    files.push({name:base+"_reglages.json", data:new TextEncoder().encode(JSON.stringify(Sx,null,2))});
    status("Emballage des fichiers..."); await nextFrame();
    const kind=saveFiles(files.length===2&&!midi&&!stems?[files[0],files[1]]:files,base);
    status(kind==="wav"?"Fichier WAV enregistré.":"Prêt : le .zip contient "+files.length+" fichier"+(files.length>1?"s":"")+" (WAV"+(midi?", MIDI":"")+", réglages).","ok");
  }catch(e){
    status(e&&e.code==="declined"?"Enregistrement annulé.":"Échec de l'export : "+(e&&e.message||e),"err");
  }finally{ btn.disabled=false; }
}
