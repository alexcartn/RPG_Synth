const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]*>/g,'');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.detail||e.message||e)));vc.on('error',e=>errs.push(String(e)));
class Param{constructor(){this.value=0}setValueAtTime(){return this}linearRampToValueAtTime(){return this}exponentialRampToValueAtTime(){return this}setTargetAtTime(){return this}cancelScheduledValues(){return this}}
let nodes=0;
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.detune=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.threshold=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();nodes++}connect(x){return x}disconnect(){}start(){}stop(){}getByteTimeDomainData(b){b.fill(128)}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node()}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createWaveShaper(){return new Node()}createDelay(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createOscillator(){return new Node()}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}createAnalyser(){return new Node()}close(){}}
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);b.getChannelData(0)[100]=.3;b.getChannelData(1)[100]=.3;return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.AudioContext=Ctx;w.OfflineAudioContext=Off;w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});}});
const w=dom.window,d=w.document;
setTimeout(async()=>{
 console.log('chapitres',d.querySelectorAll('.chap').length,'controles',d.querySelectorAll('.ctl input,.ctl select').length,'ring',d.querySelectorAll('.note-g').length);
 d.getElementById('play').click(); await new Promise(r=>setTimeout(r,600));
 console.log('play pressed',d.getElementById('play').getAttribute('aria-pressed'),'noeuds',nodes);
 d.querySelectorAll('#presets .lnk').forEach(b=>b.click());
 await new Promise(r=>setTimeout(r,800));
 d.getElementById('play').click();
 for(const [stems,midi,loop] of [[false,false,false],[true,true,true]]){
  d.getElementById('xStems').checked=stems;d.getElementById('xMidi').checked=midi;d.getElementById('xLoop').checked=loop;
  if(stems)d.getElementById('dur').value='60';
  w.URL.createObjectURL=()=>'blob:x';
  d.getElementById('exp').click();
  for(let i=0;i<60&&d.getElementById('exp').disabled;i++)await new Promise(r=>setTimeout(r,200));
  console.log('export',stems,'=>',d.getElementById('status').textContent);
 }
 // toggle ring note, libre
 d.querySelectorAll('.note-g')[3].dispatchEvent(new w.Event('click'));
 console.log('scale0 apres clic',w.eval('S.scales[0]'),'custom',w.eval('JSON.stringify(S.custom)'));
 console.log('ERREURS',errs.length?errs:'aucune');
 process.exit(0);
},500);
