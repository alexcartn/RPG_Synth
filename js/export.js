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
  const PPQ=480, spq=60/Sx.tempo, base=36+Sx.root, trs=Array.from({length:5+(Sx.daw?Math.min(8,Sx.daw.tracks.length):0)},()=>[]);
  events.forEach(e=>{
    const n0=base+e.off, rn=Math.round(n0), frac=n0-rn, note=Math.max(0,Math.min(127,rn)), t=Math.round(e.t/spq*PPQ), d=Math.max(30,Math.round(e.dur/spq*PPQ)), vel=Math.max(1,Math.min(127,Math.round(40+e.vel*200)));
    /* quart de ton : note voisine + pitch bend de 50 cents (plage de 2 demi-tons), sauf sur les nappes qui sont polyphoniques */
    const bend=(e.tr!==2&&Math.abs(frac)>0.01)?8192+Math.round(frac*4096):undefined;
    if(!trs[e.tr]) return;
    trs[e.tr].push({t,on:true,note,vel,bend},{t:t+d,on:false,note,vel:0});
  });
  const m=METERS[Sx.meter], tempoUs=Math.round(60e6/Sx.tempo);
  const hdr=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,6,(PPQ>>8)&255,PPQ&255];
  const chunk=(bytes)=>[0x4d,0x54,0x72,0x6b,(bytes.length>>>24)&255,(bytes.length>>>16)&255,(bytes.length>>>8)&255,bytes.length&255,...bytes];
  const tempoTrack=[0,0xff,0x51,3,(tempoUs>>16)&255,(tempoUs>>8)&255,tempoUs&255, 0,0xff,0x58,4,m.n,m.d,24,8, 0,0xff,0x2f,0];
  const names=["Melodie","Canon","Nappes","Boucles","Pendules"].concat((Sx.daw?Sx.daw.tracks:[]).map((t,i)=>(t.name||"Piste "+(i+1)).normalize("NFD").replace(/[^\x20-\x7e]/g,"")));
  const chOf=i=>i>=9?i+1:i;
  const tracks=[chunk(tempoTrack)];
  trs.forEach((evs,i)=>{
    evs.sort((a,b)=>a.t-b.t||(a.on?1:-1));
    const usesBend=evs.some(x=>x.bend!==undefined);
    const nm=[...names[i]].map(c=>c.charCodeAt(0)), b=[0,0xff,0x03,nm.length,...nm];
    let last=0;
    evs.forEach(e=>{
      if(e.on&&usesBend){ const bv=e.bend===undefined?8192:e.bend; b.push(...vlq(e.t-last),0xE0|chOf(i),bv&127,(bv>>7)&127); last=e.t; }
      b.push(...vlq(e.t-last),(e.on?0x90:0x80)|chOf(i),e.note,e.vel); last=e.t;
    });
    b.push(0,0xff,0x2f,0); tracks.push(chunk(b));
  });
  return new Uint8Array([...hdr,...tracks.flat()]);
}

async function renderOffline(Sx,dur,o,onProg){
  const sr=44100, tail=o.loop?8:0, total=dur+tail;
  const ctx=new OfflineAudioContext(2,Math.ceil(sr*total),sr);
  const eng=buildEngine(ctx,Sx,{solo:o.solo,noComp:o.noComp,record:o.record});
  eng.start(0,o.loop?0.05:5,o.loop?0:total);
  eng.schedule(total);
  /* points de contrôle : le rendu s'interrompt brièvement pour annoncer sa progression */
  if(onProg&&ctx.suspend){
    const q=128/sr, steps=20;
    for(let k=1;k<steps;k++){ const t=Math.floor(total*k/steps/q)*q; ctx.suspend(t).then(()=>{ onProg(k/steps); ctx.resume(); }).catch(()=>{}); }
  }
  const buf=await ctx.startRendering();
  if(onProg) onProg(1);
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

/* MP3 : encodeur lamejs chargé à la demande (SRI), jamais pour qui n'exporte pas en MP3 */
const LAME_URL="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js", LAME_SRI="sha384-xuasJXVcyv3hZq0eYpelEkBC8l4yufatZXDsKuyCU2rqfhDCb+ftuE/mSfZAteiK";
let lamePromise=null;
function loadLame(){
  if(window.lamejs&&window.lamejs.Mp3Encoder) return Promise.resolve();
  if(!lamePromise) lamePromise=new Promise((ok,ko)=>{
    const sc=document.createElement("script"); sc.src=LAME_URL; sc.integrity=LAME_SRI; sc.crossOrigin="anonymous";
    sc.onload=()=>(window.lamejs&&window.lamejs.Mp3Encoder)?ok():ko(new Error("encodeur MP3 inutilisable"));
    sc.onerror=()=>{ lamePromise=null; ko(new Error("encodeur MP3 introuvable : une connexion est nécessaire la première fois, sinon exporte en WAV")); };
    document.head.appendChild(sc);
  });
  return lamePromise;
}
async function mp3FromChannels(L,R,sr,gain,kbps){
  await loadLame();
  const enc=new lamejs.Mp3Encoder(2,sr,kbps), BLK=1152, parts=[], l16=new Int16Array(BLK), r16=new Int16Array(BLK);
  const q=x=>{x*=gain; return x>1?32767:x<-1?-32768:Math.round(x*32767);};
  for(let i=0,b=0;i<L.length;i+=BLK,b++){
    const n=Math.min(BLK,L.length-i), a=n===BLK?l16:new Int16Array(n), c=n===BLK?r16:new Int16Array(n);
    for(let j=0;j<n;j++){ a[j]=q(L[i+j]); c[j]=q(R[i+j]); }
    const out=enc.encodeBuffer(a,c); if(out.length) parts.push(new Uint8Array(out));
    if(b%200===199) await new Promise(r=>setTimeout(r,0));
  }
  const end=enc.flush(); if(end.length) parts.push(new Uint8Array(end));
  const all=new Uint8Array(parts.reduce((n,x)=>n+x.length,0)); let o=0; parts.forEach(x=>{all.set(x,o); o+=x.length;});
  return all;
}

function saveFiles(files,baseName){
  const single=files.length===1&&/\.(wav|mp3)$/.test(files[0].name);
  const blob=single?(files[0].data instanceof Blob?files[0].data:new Blob([files[0].data],{type:"audio/wav"})):zipStore(files);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=single?files[0].name:baseName+".zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  return single?files[0].name.slice(-3):"zip";
}

function codeOf(){ return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function fromCode(c){ return JSON.parse(decodeURIComponent(escape(atob(c.trim())))); }

function buildExport(host){
  const sec=document.createElement("section"); sec.className="chap"; sec.id="ch-IX";
  sec.innerHTML=
    '<header><span class="num">IX</span><div><h2>Transcriptio</h2><p class="sub"><span class="fr">Export</span> Rendu hors ligne avec la graine et les réglages actuels, stéréo 44,1 kHz. Compte une à deux minutes pour trois minutes de musique, la progression est affichée.</p></div></header>'+
    '<div class="fields">'+
      '<div class="ctl"><label for="dur">Durée</label><select id="dur"><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180" selected>3 minutes</option><option value="300">5 minutes</option><option value="480">8 minutes</option></select></div>'+
      '<div class="ctl"><label for="fmt">Format audio</label><select id="fmt"><option value="wav">WAV 16 bits (sans perte)</option><option value="mp3-320">MP3 320 kb/s</option><option value="mp3-192">MP3 192 kb/s</option><option value="both">WAV et MP3 320 kb/s</option></select><p class="hint">Le MP3 est dix fois plus léger, pratique pour écouter ou envoyer. Pour retravailler dans un logiciel, ou pour une boucle sans couture, garde le WAV : le MP3 ajoute un léger silence en tête.</p></div>'+
      '<div class="ctl"><label class="chk"><span><input type="checkbox" id="xLoop">Boucle sans couture</span></label><p class="hint">Fondu enchaîné de la fin sur le début : le fichier boucle sans clic.</p></div>'+
      '<div class="ctl"><label class="chk"><span><input type="checkbox" id="xStems">Stems séparés</span></label><p class="hint">Bourdon, mélodie et canon, nappes, percussion, lieu, boucles et pendules si activés. Sans compresseur, à sommer dans ton logiciel. 3 minutes maximum.</p></div>'+
      '<div class="ctl"><label class="chk"><span><input type="checkbox" id="xMidi">Fichier MIDI</span></label><p class="hint">Pistes mélodie, canon, nappes, boucles et pendules. Les tempéraments non égaux ne passent pas en MIDI. Les quarts de ton passent en pitch bend (plage de 2 demi-tons) sauf sur les nappes, où ils sont arrondis.</p></div>'+
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
  $("loadCode").onclick=()=>{ try{ S=merge(clone(DEFAULT),fromCode($("codeIn").value)); normS(); S.seed=newSeed(); syncUI(); restartIfLive(); status("Réglages chargés.","ok"); }catch(e){ status("Code illisible.","err"); } };
}

async function doExport(){
  const btn=$("exp"), label=btn.textContent; btn.disabled=true; btn.textContent="Rendu en cours...";
  try{
    const Sx=clone(S); Sx.seed=newSeed(); const dur=parseInt($("dur").value), loop=$("xLoop").checked, stems=$("xStems").checked, midi=$("xMidi").checked, fmt=$("fmt").value;
    const wantWav=fmt==="wav"||fmt==="both", kbps=fmt==="mp3-192"?192:320, wantMp3=fmt!=="wav";
    if(stems&&dur>180){ status("Stems : 3 minutes maximum. Choisis une durée plus courte.","err"); return; }
    const root=NOTES[Sx.root].replace("#","d"), mode=(Sx.scales[0]||"mode"), base="bourdon_"+root+"_"+mode+"_"+Sx.tempo+"bpm_"+(dur/60)+"min_"+Date.now().toString(36).slice(-4);
    const files=[], t0=Date.now();
    const prog=lab=>p=>status(lab+" : "+Math.round(p*100)+" %, "+Math.round((Date.now()-t0)/1000)+" s écoulées...");
    /* un fichier audio : WAV, MP3, ou les deux */
    const addAudio=async(name,L,R,sr,g)=>{
      if(wantWav) files.push({name:name+".wav", data:wavFromChannels(L,R,sr,g)});
      if(wantMp3){ status("Encodage MP3 de "+name.split("/").pop()+"..."); await nextFrame(); files.push({name:name+".mp3", data:await mp3FromChannels(L,R,sr,g,kbps)}); }
    };
    status("Rendu du mix : 0 %..."); await nextFrame();
    const mix=await renderOffline(Sx,dur,{loop,record:midi},prog("Rendu du mix"));
    await addAudio(base+(loop?"_boucle":""),mix.L,mix.R,mix.sr,0.891/(peakOf(mix.L,mix.R)||1));
    if(midi){ files.push({name:base+".mid", data:midiFile(mix.events,Sx)}); }
    if(stems){
      const groups=[["drone","bourdon"],["mel","melodie_canon"],["pad","nappes"],["perc","percussion"],["amb","lieu"]];
      if(Sx.loops.lvl>0.001) groups.push(["loops","boucles"]);
      if(Sx.pend.lvl>0.001) groups.push(["pend","pendules"]);
      if(Sx.daw&&Sx.daw.tracks.some(t=>t.notes.length)) groups.push(["daw","pistes"]);
      const res=[]; let mp=0;
      for(let i=0;i<groups.length;i++){
        const r=await renderOffline(Sx,dur,{loop:false,solo:groups[i][0],noComp:true},prog("Stem "+(i+1)+" sur "+groups.length+" ("+groups[i][1]+")")); res.push(r); mp=Math.max(mp,peakOf(r.L,r.R));
      }
      const gs=0.7/(mp||1);
      for(let i=0;i<res.length;i++) await addAudio("stems/"+base+"_"+groups[i][1],res[i].L,res[i].R,res[i].sr,gs);
    }
    const alone=files.length===1;
    if(!alone) files.push({name:base+"_reglages.json", data:new TextEncoder().encode(JSON.stringify(Sx,null,2))});
    status("Emballage des fichiers..."); await nextFrame();
    const kind=saveFiles(alone?[{name:files[0].name,data:new Blob([files[0].data],{type:files[0].name.endsWith("mp3")?"audio/mpeg":"audio/wav"})}]:files,base);
    status(kind==="zip"?"Prêt : le codex (.zip) contient "+files.length+" fichiers (audio"+(midi?", MIDI":"")+", réglages).":"Fichier "+kind.toUpperCase()+" enregistré.","ok");
  }catch(e){
    status("Échec de l'export : "+(e&&e.message||e),"err");
  }finally{ btn.disabled=false; btn.textContent=label; }
}
