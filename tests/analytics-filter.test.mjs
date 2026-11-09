import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function filter({ua='Mozilla/5.0 Chrome/130.0 Safari/537.36',webdriver=false,search='',stored=null,blocked=false}={}){
 const window={},localStorage={getItem(){if(blocked)throw Error('blocked');return stored},setItem(k,v){if(blocked)throw Error('blocked');stored=v}};
 runInNewContext(script,{window,navigator:{userAgent:ua,webdriver},location:{search},localStorage,URLSearchParams});
 return window.vaq.find(v=>v[0]==='beforeSend')[1];
}
test('crawler, link preview, headless and webdriver visits are dropped before analytics collection',()=>{
 for(const ua of ['Googlebot/2.1','bingbot/2.0','GPTBot/1.0','OAI-SearchBot/1.0','ClaudeBot','ChatGPT-User/1.0','facebookexternalhit/1.1','meta-externalagent/1.1','WhatsApp/2.0','TelegramBot','DuckDuckBot','Applebot','YandexBot','HeadlessChrome/130.0','Chrome-Lighthouse','curl/8.0','python-requests/2.0']){
  const before=filter({ua});
  assert.equal(before({type:'pageview',url:'https://justjudo.app/'}),null,ua);
  assert.equal(before({type:'event',name:'practice'}),null,ua);
 }
 assert.equal(filter({webdriver:true})({type:'pageview'}),null);
});
test('ordinary desktop/mobile browsers remain counted without interaction or storage',()=>{
 for(const ua of ['Mozilla/5.0 Chrome/130.0 Safari/537.36','Mozilla/5.0 Firefox/130.0','Mozilla/5.0 (iPhone) AppleWebKit/605.1 Version/18.0 Mobile Safari/604.1','Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36','Mozilla/5.0 (iPhone) CriOS/130.0 Mobile/15E148 Safari/604.1']){
  const event={type:'pageview',url:'https://justjudo.app/'};
  assert.equal(filter({ua,blocked:true})(event),event);
 }
});
test('owner exclusions remain independent of bot filtering',()=>{
 const event={type:'pageview'};
 assert.equal(filter({search:'?exclude_visits=1',blocked:true})(event),null);
 assert.equal(filter({stored:'1'})(event),null);
 assert.equal(filter({search:'?exclude_visits=0',stored:'1'})(event),event);
 assert.equal(filter({search:'?exclude_visits=0',webdriver:true})(event),null);
 assert(html.indexOf("window.va('beforeSend'")<html.indexOf('src="/_vercel/insights/script.js"'));
});
