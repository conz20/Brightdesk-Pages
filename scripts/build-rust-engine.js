'use strict';
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const manifest=path.join(root,'rust','Cargo.toml');
const exe=process.platform==='win32'?'brightdesk-rust-engine.exe':'brightdesk-rust-engine';
const built=path.join(root,'rust','target','release',exe);const outDir=path.join(root,'native');const out=path.join(outDir,exe);
const result=spawnSync('cargo',['build','--manifest-path',manifest,'--release','--bin','brightdesk-rust-engine'],{cwd:root,stdio:'inherit',env:process.env,shell:process.platform==='win32'});
if(result.error){console.error(result.error.message);process.exit(1);}if(result.status!==0)process.exit(result.status||1);
if(!fs.existsSync(built)){console.error('Rust sidecar build output is missing: '+built);process.exit(1);}
fs.mkdirSync(outDir,{recursive:true});fs.copyFileSync(built,out);if(process.platform!=='win32')fs.chmodSync(out,0o755);
console.log('Built Brightdesk Rust engine: '+path.relative(root,out));
