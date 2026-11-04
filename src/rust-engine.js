'use strict';
const { spawn }=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
function fallbackAnalyzeText(input){
 if(typeof input!=='string')throw new TypeError('Text must be a string.');
 const lines=input.length===0?0:input.split(/\r\n|\r|\n/).length-(/(?:\r\n|\r|\n)$/.test(input)?1:0);
 return {characters:Array.from(input).length,words:input.trim()?input.trim().split(/\s+/u).length:0,lines};
}
function parseMetricsLine(line){
 const p=line.split('\t'); if(p.length!==4||!/^\d+$/.test(p[0]))throw new Error('Invalid response from the Brightdesk Rust engine.');
 const v=p.slice(1).map(Number); if(v.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('The Brightdesk Rust engine returned invalid text metrics.');
 return {id:Number(p[0]),metrics:{characters:v[0],words:v[1],lines:v[2]}};
}
function defaultBinaryPath(){
 const name=process.platform==='win32'?'brightdesk-rust-engine.exe':'brightdesk-rust-engine';
 if(process.versions.electron&&process.resourcesPath)return path.join(process.resourcesPath,'native',name);
 return path.join(__dirname,'..','rust','target','release',name);
}
function createRustEngine({binaryPath=defaultBinaryPath(),spawnProcess=spawn}={}){
 let child=null,state='javascript-fallback',nextId=1,closed=false; const pending=new Map();
 function fallbackPending(){for(const [id,item] of pending){pending.delete(id);item.resolve(fallbackAnalyzeText(item.input));}}
 function fallback(){if(state==='javascript-fallback'||state==='closed')return;state='javascript-fallback';fallbackPending();child=null;}
 function start(){
  if(child||closed||!fs.existsSync(binaryPath))return child;
  try{child=spawnProcess(binaryPath,[],{stdio:['pipe','pipe','ignore'],windowsHide:true});state='rust-native';
   const lines=readline.createInterface({input:child.stdout});
   lines.on('line',line=>{try{const result=parseMetricsLine(line);const item=pending.get(result.id);if(item){pending.delete(result.id);item.resolve(result.metrics);}}catch{fallback();}});
   child.once('error',fallback);child.once('exit',fallback);
  }catch{fallback();} return child;
 }
 function analyzeText(input){
  if(typeof input!=='string')return Promise.reject(new TypeError('Text must be a string.'));
  const proc=start();if(!proc||state!=='rust-native')return Promise.resolve(fallbackAnalyzeText(input));
  const id=nextId++;
  return new Promise(resolve=>{pending.set(id,{input,resolve});proc.stdin.write(`${id}\t${Buffer.from(input,'utf8').toString('hex')}\n`,error=>{if(error)fallback();});});
 }
 function status(){return {engine:state,available:state==='rust-native'};}
 function close(){closed=true;if(child&&!child.killed)child.kill();child=null;fallbackPending();state='closed';}
 return {analyzeText,status,close};
}
module.exports={createRustEngine,fallbackAnalyzeText,parseMetricsLine};
