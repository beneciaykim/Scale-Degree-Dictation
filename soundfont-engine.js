/*
 * Scale Degree Dictation — small local SoundFont sampler.
 * Reads standard SoundFont2 (.sf2) preset/instrument/sample zones and SoundFont3
 * (.sf3) Ogg samples where the browser can decode Ogg Vorbis.
 * This sampler implements pitch, zones, attenuation, volume envelopes, pan and
 * sustain loops; it does not implement the complete SF2 modulator/filter spec.
 * No third-party code or remote runtime dependency.
 */
(function(global) {
  'use strict';
  const textDecoder = new TextDecoder('latin1');
  const signed16 = n => n < 32768 ? n : n - 65536;
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const centsToSeconds = (tc,fallback) => tc === undefined ? fallback : clamp(Math.pow(2,tc/1200),.001,18);
  const toDbAmplitude = centibels => Math.pow(10,-Math.max(0,centibels)/200);
  const str = (bytes,off,len) => textDecoder.decode(new Uint8Array(bytes,off,len)).replace(/\0.*$/,'').trim();

  function readList(view,from,to,callback){
    let offset=from;
    while(offset+8<=to){
      const id=str(view.buffer,offset,4),n=view.getUint32(offset+4,true);
      const start=offset+8,stop=start+n;
      if(stop>to)throw new Error('SoundFont 파일의 RIFF 청크가 잘못되었습니다.');
      callback(id,start,n);
      offset=stop+(n%2);
    }
  }
  const generatorNames = {0:'start',1:'end',2:'startLoop',3:'endLoop',4:'startCoarse',12:'endCoarse',17:'pan',34:'attack',35:'hold',36:'decay',37:'sustain',38:'release',41:'instrument',43:'keyRange',44:'velRange',45:'startLoopCoarse',48:'attenuation',50:'endLoopCoarse',51:'coarseTune',52:'fineTune',53:'sampleID',54:'sampleModes',56:'scaleTuning',58:'rootKey'};
  function parseGenerators(view,start,len){
    const a=[];
    for(let i=start;i+4<=start+len;i+=4){
      const op=view.getUint16(i,true),raw=view.getUint16(i+2,true);
      if(op===43||op===44)a.push({op,value:[raw&255,raw>>>8]});
      else if(op===41||op===53||op===54||op===58)a.push({op,value:raw});
      else a.push({op,value:signed16(raw)});
    }
    return a;
  }
  function parseHeaders(view,start,len,stride,reader){
    const out=[];
    if(len%stride!==0)throw new Error('SoundFont 헤더 길이가 올바르지 않습니다.');
    for(let pos=start;pos<start+len;pos+=stride)out.push(reader(pos));
    return out;
  }
  function mergeZones(...zones){
    const dest={};
    const additive=new Set([0,1,2,3,4,12,17,45,48,50,51,52]);
    for(const zone of zones){
      if(!zone)continue;
      for(const gen of zone){
        const key=generatorNames[gen.op];if(!key)continue;
        if(key==='keyRange'||key==='velRange'){
          const prev=dest[key]||[0,127];dest[key]=[Math.max(prev[0],gen.value[0]),Math.min(prev[1],gen.value[1])];
        }else if(additive.has(gen.op)){dest[key]=(dest[key]||0)+gen.value;}
        else dest[key]=gen.value;
      }
    }
    return dest;
  }
  class SoundFontSampler {
    constructor(arrayBuffer){
      if(!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength<128)throw new Error('유효한 SoundFont 파일이 아닙니다.');
      this.arrayBuffer=arrayBuffer;
      this.view=new DataView(arrayBuffer);
      const view=this.view;
      if(str(arrayBuffer,0,4)!=='RIFF'||str(arrayBuffer,8,4)!=='sfbk')throw new Error('SoundFont(.sf2/.sf3) 파일이 아닙니다.');
      let sampleStart=-1,sampleBytes=0,pdta={};
      readList(view,12,Math.min(view.byteLength,view.getUint32(4,true)+8),(id,start,n)=>{
        if(id!=='LIST'||n<4)return;
        const category=str(arrayBuffer,start,4);
        readList(view,start+4,start+n,(tag,data,len)=>{
          if(category==='sdta' && tag==='smpl'){sampleStart=data;sampleBytes=len;}
          if(category==='pdta')pdta[tag]={start:data,len};
        });
      });
      if(sampleStart<0)throw new Error('SoundFont에서 샘플 데이터를 찾지 못했습니다.');
      for(const tag of ['phdr','pbag','pgen','inst','ibag','igen','shdr'])if(!pdta[tag])throw new Error('SoundFont에 필수 헤더 '+tag+'가 없습니다.');
      this.sampleStart=sampleStart;this.sampleBytes=sampleBytes;
      const parse=(id,stride,reader)=>parseHeaders(view,pdta[id].start,pdta[id].len,stride,reader);
      this.phdr=parse('phdr',38,p=>({name:str(arrayBuffer,p,20),program:view.getUint16(p+20,true),bank:view.getUint16(p+22,true),bag:view.getUint16(p+24,true)}));
      this.pbag=parse('pbag',4,p=>({gen:view.getUint16(p,true)}));
      this.pgen=parseGenerators(view,pdta.pgen.start,pdta.pgen.len);
      this.inst=parse('inst',22,p=>({name:str(arrayBuffer,p,20),bag:view.getUint16(p+20,true)}));
      this.ibag=parse('ibag',4,p=>({gen:view.getUint16(p,true)}));
      this.igen=parseGenerators(view,pdta.igen.start,pdta.igen.len);
      this.shdr=parse('shdr',46,p=>({name:str(arrayBuffer,p,20),start:view.getUint32(p+20,true),end:view.getUint32(p+24,true),loopStart:view.getUint32(p+28,true),loopEnd:view.getUint32(p+32,true),rate:view.getUint32(p+36,true),root:view.getUint8(p+40),correction:view.getInt8(p+41),link:view.getUint16(p+42,true),type:view.getUint16(p+44,true)}));
      const readable=this.phdr.slice(0,-1);
      if(!readable.length)throw new Error('SoundFont에 연주 가능한 프리셋이 없습니다.');
      this.presets=readable.map((p,i)=>({id:i,name:p.name,bank:p.bank,program:p.program,label:`${p.bank}:${String(p.program+1).padStart(3,'0')} · ${p.name}`}));
      this._regions=new Map();this._buffers=new Map();this._decodePromises=new Map();
    }
    zones(bags,gens,first,last){
      const out=[];
      for(let j=first;j<last;j++){
        if(j+1>=bags.length)break;
        const s=bags[j].gen,e=bags[j+1].gen;
        out.push(gens.slice(s,e));
      }
      return out;
    }
    regions(presetIndex){
      if(this._regions.has(presetIndex))return this._regions.get(presetIndex);
      const header=this.phdr[presetIndex],next=this.phdr[presetIndex+1];
      if(!header||!next)throw new Error('악기 프리셋을 찾지 못했습니다.');
      const presetZones=this.zones(this.pbag,this.pgen,header.bag,next.bag);
      const pg=presetZones.find(z=>!z.some(g=>g.op===41))||[];
      const regions=[];
      for(const pz of presetZones){
        const instrGen=pz.find(g=>g.op===41);if(!instrGen)continue;
        const idx=instrGen.value,ih=this.inst[idx],inext=this.inst[idx+1];
        if(!ih||!inext)continue;
        const instrumentZones=this.zones(this.ibag,this.igen,ih.bag,inext.bag);
        const ig=instrumentZones.find(z=>!z.some(g=>g.op===53))||[];
        for(const iz of instrumentZones){
          const sg=iz.find(g=>g.op===53);if(!sg)continue;
          const sample=this.shdr[sg.value];if(!sample||!sample.rate||sample.end<=sample.start)continue;
          if(sample.type&0x8000)continue; // ROM-backed samples cannot be loaded from the file.
          const g=mergeZones(pg,pz,ig,iz);
          if(g.keyRange&&g.keyRange[0]>g.keyRange[1])continue;
          regions.push({sampleId:sg.value,sample,g});
        }
      }
      if(!regions.length)throw new Error('선택한 프리셋에 재생 가능한 샘플이 없습니다.');
      this._regions.set(presetIndex,regions);return regions;
    }
    async _decodeSample(ctx,id){
      if(this._buffers.has(id))return this._buffers.get(id);
      if(this._decodePromises.has(id))return this._decodePromises.get(id);
      const promise=(async()=>{
        const sh=this.shdr[id];let buffer;
        if(sh.type&0x10){
          // SF3 start/end are byte offsets, and loop locations refer to decoded frames.
          if(sh.end>this.sampleBytes)throw new Error('SF3 샘플 범위가 잘못되었습니다.');
          const ogg=this.arrayBuffer.slice(this.sampleStart+sh.start,this.sampleStart+sh.end);
          if(str(ogg,0,4)!=='OggS')throw new Error('SF3 샘플의 Ogg 헤더가 없습니다.');
          try{buffer=await ctx.decodeAudioData(ogg);}catch(e){throw new Error('이 브라우저에서 SF3 Ogg Vorbis 샘플을 디코딩하지 못했습니다. .sf2를 사용하거나 Chrome/Firefox를 시도해 주세요.');}
        }else{
          const frames=sh.end-sh.start,origin=this.sampleStart+sh.start*2;
          if(origin<0||origin+frames*2>this.sampleStart+this.sampleBytes)throw new Error('SF2 샘플 범위가 잘못되었습니다.');
          if(frames<2)throw new Error('재생 가능한 길이의 샘플이 없습니다.');
          buffer=ctx.createBuffer(1,frames,sh.rate);
          const dst=buffer.getChannelData(0);
          // Take Int16 PCM from the source file. LSB-first: SoundFont specification.
          for(let j=0;j<frames;j++)dst[j]=this.view.getInt16(origin+j*2,true)/32768;
        }
        this._buffers.set(id,buffer);return buffer;
      })().catch(err=>{this._decodePromises.delete(id);throw err;});
      this._decodePromises.set(id,promise);return promise;
    }
    async prepare(ctx,presetIndex){
      const regions=this.regions(presetIndex);
      const sampleIds=[...new Set(regions.map(r=>r.sampleId))];
      // Some user SF3 files have hundreds of compressed samples. Avoid an unbounded
      // number of simultaneous Vorbis decoders and excessive peak memory.
      for(let i=0;i<sampleIds.length;i+=6){
        await Promise.all(sampleIds.slice(i,i+6).map(id=>this._decodeSample(ctx,id)));
      }
      this.currentPreset=presetIndex;
      return regions.length;
    }
    play(ctx,midi,at,duration,volume,played){
      if(this.currentPreset===undefined)throw new Error('SoundFont 프리셋 준비가 완료되지 않았습니다.');
      const regions=this.regions(this.currentPreset).filter(r=>{
        const range=r.g.keyRange||[0,127],velocity=r.g.velRange||[0,127];
        return midi>=range[0]&&midi<=range[1]&&velocity[0]<=100&&velocity[1]>=100;
      });
      for(const reg of regions){
        const sh=reg.sample,g=reg.g,buffer=this._buffers.get(reg.sampleId);
        if(!buffer)continue;
        const s=ctx.createBufferSource();s.buffer=buffer;
        const root=g.rootKey!==undefined&&g.rootKey<=127?g.rootKey:sh.root;
        const scale=g.scaleTuning===undefined?100:g.scaleTuning;
        const cents=(midi-root)*scale + (g.coarseTune||0)*100 +(g.fineTune||0)-sh.correction;
        s.playbackRate.value=(sh.rate/buffer.sampleRate)*Math.pow(2,cents/1200);
        const startOffset=(g.start||0)+(g.startCoarse||0)*32768;
        const endOffset=(g.end||0)+(g.endCoarse||0)*32768;
        // In SF3, offsets are decoded-frame offsets, not Ogg byte offsets.
        const beginFrame=Math.max(0,startOffset);
        const endFrame=Math.min(buffer.length,buffer.length+endOffset);
        if(beginFrame>=endFrame)continue;
        const loopStart=(sh.type&0x10?sh.loopStart:sh.loopStart-sh.start)+(g.startLoop||0)+(g.startLoopCoarse||0)*32768;
        const loopEnd=(sh.type&0x10?sh.loopEnd:sh.loopEnd-sh.start)+(g.endLoop||0)+(g.endLoopCoarse||0)*32768;
        if(((g.sampleModes||0)&1) && loopEnd-loopStart>16 && loopStart>=beginFrame && loopEnd<=endFrame){
          s.loop=true;s.loopStart=loopStart/buffer.sampleRate;s.loopEnd=loopEnd/buffer.sampleRate;
        }
        const amp=ctx.createGain();
        const attenuation=toDbAmplitude(g.attenuation||0);
        const maxGain=Math.min(1.5,volume*.65*attenuation);
        const attack=centsToSeconds(g.attack,.008);
        const hold=centsToSeconds(g.hold,0);
        const decay=centsToSeconds(g.decay,.3);
        const sustain=toDbAmplitude(g.sustain||0);
        const release=centsToSeconds(g.release,.16);
        const end=Math.max(at+.025,at+duration);
        const releaseStart=Math.max(at+.02,end-Math.min(.55,release));
        amp.gain.setValueAtTime(.0001,at);
        amp.gain.linearRampToValueAtTime(Math.max(.0001,maxGain),Math.min(releaseStart,at+attack));
        const decayEnd=Math.min(releaseStart,at+attack+hold+decay);
        if(decayEnd>at+attack)amp.gain.linearRampToValueAtTime(Math.max(.0001,maxGain*sustain),decayEnd);
        amp.gain.setValueAtTime(Math.max(.0001,maxGain*sustain),releaseStart);
        amp.gain.linearRampToValueAtTime(.0001,end);
        const pan=clamp((g.pan||0)/500,-1,1);
        s.connect(amp);
        if(pan && ctx.createStereoPanner){const pn=ctx.createStereoPanner();pn.pan.value=pan; amp.connect(pn);pn.connect(ctx.destination);}
        else amp.connect(ctx.destination);
        s.start(at,beginFrame/buffer.sampleRate);
        s.stop(end+.025);
        played.push(s);
        s.onended=()=>{const i=played.indexOf(s);if(i>=0)played.splice(i,1);};
      }
    }
    dispose(){this._buffers.clear();this._decodePromises.clear();this._regions.clear();this.arrayBuffer=null;this.view=null;}
  }
  global.SoundFontSampler=SoundFontSampler;
})(window);
