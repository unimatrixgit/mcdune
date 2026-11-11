import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{32,128}$/i,PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
export function floodgateUuid(xuid){
 if(typeof xuid!=='string'||! /^[1-9][0-9]{0,19}$/.test(xuid))return null;
 const value=BigInt(xuid);if(value>0xffffffffffffffffn)return null;
 const hex=value.toString(16).padStart(16,'0');return '00000000-0000-0000-'+hex.slice(0,4)+'-'+hex.slice(4);
}
export function skinIdentity(value){
 if(typeof value!=='string'||!UUID.test(value))return null;
 const uuid=value.toLowerCase(),hex=uuid.replaceAll('-','');if(/^0+$/.test(hex))return null;
 if(hex.startsWith('0000000000000000')){const xuid=BigInt('0x'+hex.slice(16)).toString();return{uuid,type:'bedrock',xuid,key:'bedrock:'+xuid};}
 return{uuid,type:'java',key:'java:'+hex};
}
export function textureDescriptor(value,expectedUuid){
 if(typeof value!=='string'||value.length>60000||! /^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Invalid skin metadata');
 const bytes=Buffer.from(value,'base64');if(bytes.length>32768||bytes.toString('base64').replace(/=+$/,'')!==value.replace(/=+$/,''))throw Error('Invalid skin encoding');
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(expectedUuid&&data.profileId!=null&&(typeof data.profileId!=='string'||data.profileId.replaceAll('-','').toLowerCase()!==expectedUuid.replaceAll('-','').toLowerCase()))throw Error('Skin profile mismatch');
 const skin=data?.textures?.SKIN;if(!skin||typeof skin.url!=='string'||skin.url.length>512)throw Error('Missing skin');
 const url=new URL(skin.url);
 if(!['http:','https:'].includes(url.protocol)||url.hostname!=='textures.minecraft.net'||url.port||url.username||url.password||url.search||url.hash||!/^\/texture\/[0-9a-f]{32,128}$/i.test(url.pathname))throw Error('Unsafe texture location');
 url.protocol='https:';
 if(skin.metadata!=null&&(typeof skin.metadata!=='object'||Array.isArray(skin.metadata)))throw Error('Invalid model metadata');
 const model=skin.metadata?.model;if(model!=null&&!['default','slim'].includes(model))throw Error('Unknown skin model');
 return{url:url.href,textureId:url.pathname.slice('/texture/'.length).toLowerCase(),model:model||'default',declaredModel:model!=null};
}
export function validateSkinPng(input){
 const bytes=Buffer.from(input);if(bytes.length<57||bytes.length>1000000||!bytes.subarray(0,8).equals(PNG))throw Error('Invalid skin PNG');
 let at=8,header=null,ended=false,palette=false,idatEnded=false;const compressed=[];
 for(let count=0;at<bytes.length&&count<256;count++){
  if(at+12>bytes.length)throw Error('Truncated PNG');const size=bytes.readUInt32BE(at),end=at+12+size;if(end>bytes.length)throw Error('Truncated PNG chunk');
  const type=bytes.toString('latin1',at+4,at+8),data=bytes.subarray(at+8,at+8+size);
  if(!/^[A-Za-z]{4}$/.test(type)||crc32(bytes.subarray(at+4,at+8+size))!==bytes.readUInt32BE(at+8+size))throw Error('Invalid PNG chunk');
  if(['acTL','fcTL','fdAT'].includes(type))throw Error('Animated skins are unsupported');
  if(!header&&type!=='IHDR')throw Error('Missing PNG header');
  if(type==='IHDR'){
   if(header||at!==8||size!==13)throw Error('Invalid PNG header');
   const width=data.readUInt32BE(0),height=data.readUInt32BE(4),depth=data[8],color=data[9],interlace=data[12];
   if(width!==64||![32,64].includes(height)||!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}[color]||[]).includes(depth)||data[10]!==0||data[11]!==0||interlace>1)throw Error('Unsupported skin dimensions or PNG format');
   header={width,height,depth,color,interlace};
  }else if(type==='PLTE'){
   if(palette||compressed.length||!size||size%3||size>768)throw Error('Invalid PNG palette');palette=true;
  }else if(type==='IDAT'){
   if(idatEnded)throw Error('Invalid PNG data order');compressed.push(data);
  }else if(type==='IEND'){
   if(size||end!==bytes.length||!compressed.length)throw Error('Invalid PNG ending');ended=true;break;
  }else{
   if(compressed.length)idatEnded=true;
   if(type[0]===type[0].toUpperCase())throw Error('Unknown critical PNG chunk');
  }
  at=end;
 }
 if(!ended||header.color===3&&!palette)throw Error('Incomplete PNG');
 const raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:64*64*8+512}),channels=({0:1,2:3,3:1,4:2,6:4})[header.color];
 const passes=header.interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
 let offset=0;
 for(const[x,y,dx,dy]of passes){const width=Math.max(0,Math.ceil((header.width-x)/dx)),height=Math.max(0,Math.ceil((header.height-y)/dy));if(!width||!height)continue;const row=1+Math.ceil(width*channels*header.depth/8);for(let i=0;i<height;i++){if(offset+row>raw.length||raw[offset]>4)throw Error('Invalid PNG scanline');offset+=row;}}
 if(offset!==raw.length)throw Error('Invalid PNG pixel data');return{width:header.width,height:header.height};
}
async function boundedBytes(response,limit){
 if(!response.ok||response.redirected){await response.body?.cancel();throw Error('Skin service unavailable');}
 const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>limit)){await response.body?.cancel();throw Error('Skin response too large');}
 if(!response.body)throw Error('Empty skin response');const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Skin response too large');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 return Buffer.concat(chunks,size);
}
export function createSkinResolver({fetcher=fetch,now=Date.now,maxEntries=256,maxBytes=8388608,maxPending=16,lookupsPerMinute=60}={}){
 const cache=new Map(),pending=new Map();let total=0,windowEnd=0,lookups=0;
 function remember(key,value,ttl){const previous=cache.get(key);total-=previous?.value?.bytes.length||0;cache.delete(key);cache.set(key,{value,until:now()+ttl});total+=value?.bytes.length||0;while(cache.size>maxEntries||total>maxBytes){const key=cache.keys().next().value;total-=cache.get(key).value?.bytes.length||0;cache.delete(key);}}
 async function remote(url,kind){
  const response=await fetcher(url,{redirect:'error',credentials:'omit',headers:{Accept:kind==='json'?'application/json':'image/png','User-Agent':'DuneRealms-Tailor/1.0'},signal:AbortSignal.timeout(4000)});
  const type=response.headers.get('content-type')||'';
  if(kind==='json'&&!/^application\/json(?:\s*;|$)/i.test(type)||kind==='png'&&type&&!/^(?:image\/png|application\/octet-stream)(?:\s*;|$)/i.test(type)){await response.body?.cancel();throw Error('Unexpected skin response type');}
  const bytes=await boundedBytes(response,kind==='json'?65536:1000000);
  return kind==='json'?JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)):bytes;
 }
 async function load(identity){
  let descriptor;
  if(identity.type==='java'){
   const compact=identity.uuid.replaceAll('-',''),profile=await remote('https://sessionserver.mojang.com/session/minecraft/profile/'+compact,'json');
   if(typeof profile.id!=='string'||profile.id.toLowerCase()!==compact||!Array.isArray(profile.properties))throw Error('Skin profile mismatch');
   const properties=profile.properties.filter(p=>p?.name==='textures');if(properties.length!==1)throw Error('Invalid texture properties');descriptor=textureDescriptor(properties[0].value,identity.uuid);
  }else{
   const converted=await remote('https://api.geysermc.org/v2/skin/'+identity.xuid,'json');
   if(!converted||typeof converted.is_steve!=='boolean'||typeof converted.texture_id!=='string'||!HEX.test(converted.texture_id))throw Error('No converted Bedrock skin');
   descriptor=textureDescriptor(converted.value);if(descriptor.textureId!==converted.texture_id.toLowerCase())throw Error('Converted texture mismatch');
   const model=converted.is_steve?'default':'slim';if(descriptor.declaredModel&&descriptor.model!==model)throw Error('Converted model mismatch');descriptor.model=model;
  }
  const bytes=await remote(descriptor.url,'png'),dimensions=validateSkinPng(bytes);
  if(dimensions.height===32&&descriptor.model==='slim')throw Error('Unsupported legacy slim skin');
  return{bytes,model:descriptor.model,hash:createHash('sha256').update(descriptor.model+'\0').update(bytes).digest('hex'),...dimensions};
 }
 return{async resolve(uuid){
  const identity=skinIdentity(uuid);if(!identity)return null;const cached=cache.get(identity.key);
  if(cached&&cached.until>now()){cache.delete(identity.key);cache.set(identity.key,cached);return cached.value;}
  if(pending.has(identity.key))return pending.get(identity.key);
  if(now()>=windowEnd){windowEnd=now()+60000;lookups=0;}
  if(pending.size>=maxPending||lookups>=lookupsPerMinute)return null;lookups++;
  const work=(async()=>{try{const value=await load(identity);remember(identity.key,value,identity.type==='bedrock'?60000:300000);return value;}catch{remember(identity.key,null,30000);return null;}finally{pending.delete(identity.key);}})();
  pending.set(identity.key,work);return work;
 }};
}
export const minecraftSkins=createSkinResolver();
