import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('main uses the approved atmosphere styles and composition',()=>{
 const home=read('index.html'),preview=read('design/atmosphere.html');
 const styles=html=>[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>match[1]);
 assert.deepEqual(styles(home),styles(preview));
 const scene=html=>html.slice(html.indexOf('<main class="scene">'),html.indexOf('</main>')+7);
 assert.equal(scene(home),scene(preview));
 assert(home.includes('data-live="true"'));
 assert(!home.includes('id="camera"'));assert(!home.includes('id="motion"'));
 assert(!home.includes('class="ink-hero"'));assert(!home.includes('id="preview-dialog"'));
});
test('production build retains real practice pages and lesson routes',()=>{
 assert(read('scripts/build.mjs').includes("'practice.html'"));
 assert(read('practice.html').includes('src/academy.js'));
 const rewrites=JSON.parse(read('vercel.json')).rewrites;
 assert.equal(rewrites.find(r=>r.source==='/throws/o-soto-gari').destination,'/practice.html');
 assert.equal(rewrites.find(r=>r.source==='/katame-waza').destination,'/index.html');
});
