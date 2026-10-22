import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ROUTES,resolveRoute,routeURL,categoryPath,lessonPath} from '../src/routes.js';
import {TECHNIQUES,FOUNDATIONS,GROUNDWORK_GROUPS} from '../src/curriculum.js';
test('published lessons use Japanese romanization under their parent category',()=>{
 for(const t of TECHNIQUES){const path=lessonPath(t.id);assert.equal(path,`/katame-waza/shime-waza/${t.roman.toLowerCase()}`);assert.equal(resolveRoute(path).parent,'/katame-waza/shime-waza')}
 assert.equal(lessonPath('belt'),'/basics/belt');assert.equal(categoryPath('katame'),'/katame-waza');
 assert.equal(lessonPath('baemilgi'),'/basics/hindu-push-up');
 for(const t of FOUNDATIONS.filter(t=>!t.available))assert.equal(lessonPath(t.id),undefined);
 for(const g of GROUNDWORK_GROUPS)assert.equal(resolveRoute('/katame-waza/'+g.id).group,g.id);
});
test('routes resolve exact paths, trailing slashes and local build prefixes',()=>{
 assert.equal(resolveRoute('/').screen,'home');assert.equal(resolveRoute('/index.html').screen,'home');
 assert.equal(resolveRoute('/basics/belt/').lesson,'belt');assert.equal(resolveRoute('/dist/basics/belt','/dist/').lesson,'belt');
 assert.equal(resolveRoute('/dist/index.html','/dist/').screen,'home');
 for(const path of ['/basics/unknown','/basics/breakfall','/src/missing.js','/katame','/basics/belt/more'])assert.equal(resolveRoute(path),null);
 assert.equal(resolveRoute('/dist-other/basics','/dist/'),null);
 assert.equal(routeURL('/basics/belt','/dist/','?lang=en'),'/dist/basics/belt?lang=en');
});
test('every published subpage has an exact production rewrite and valid parent',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.deepEqual(config.rewrites.map(r=>r.source).sort(),ROUTES.filter(r=>r.path!=='/').map(r=>r.path).sort());
 for(const r of config.rewrites)assert.equal(r.destination,'/index.html');
 for(const r of ROUTES.filter(r=>r.parent))assert.ok(resolveRoute(r.parent));
 assert.equal(new Set(ROUTES.map(r=>r.path)).size,ROUTES.length);
});
