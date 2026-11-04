'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('Brightdesk Pages bundles and displays its own branded application icon',()=>{
 const root=path.join(__dirname,'..');
 const icon=fs.readFileSync(path.join(root,'src','assets','icons','pages.svg'),'utf8');
 const html=fs.readFileSync(path.join(root,'src','index.html'),'utf8');
 assert.match(icon,/<svg[^>]+role="img"/);
 assert.ok(html.includes('assets/icons/pages.svg'));
 assert.ok(html.includes('assets/brand/brightdesk-mark.svg'));
});
