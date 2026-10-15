import {EN} from './i18n-messages.js';
export const LANGUAGE_KEY='just-judo-language';
export function resolveLanguage(search='',stored=null){const query=new URLSearchParams(search).get('lang');return ['ko','en'].includes(query)?query:['ko','en'].includes(stored)?stored:'ko';}
function initialLanguage(){if(typeof window==='undefined')return 'ko';let stored;try{stored=window.localStorage.getItem(LANGUAGE_KEY)}catch{}return resolveLanguage(window.location.search,stored);}
export const language=initialLanguage();
export function translate(key,values=[],locale=language){const text=locale==='en'?(EN[key]??key):key;return text.replace(/\{(\d+)\}/g,(slot,index)=>index<values.length?String(values[index]):slot);}
// Plain strings and tagged templates share the same catalog. Render-time values
// are substituted once, so user/error text cannot become translation syntax.
export function tr(input,...values){const key=Array.isArray(input)?input.map((part,i)=>part+(i<values.length?`{${i}}`:'' )).join(''):input;return translate(key,values);}
export function localizeDocument(root=document){
 root.documentElement.lang=language;
 if(language!=='en')return;
 const walker=root.createTreeWalker(root.documentElement,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const node=walker.currentNode;if(node.parentElement?.closest('script,style,[data-no-translate]'))continue;const key=node.data.trim();if(EN[key])node.data=node.data.replace(key,EN[key]);}
 for(const element of root.querySelectorAll('[aria-label],[title],[alt],[placeholder],meta[name="description"]'))for(const name of ['aria-label','title','alt','placeholder','content']){const value=element.getAttribute(name);if(value&&EN[value])element.setAttribute(name,EN[value]);}
}
export function initLanguage(){
 localizeDocument();
 const dialog=document.getElementById('language-dialog'),button=document.getElementById('language-button');
 button.textContent=`Language · ${language.toUpperCase()}`;
 button.onclick=()=>dialog.showModal();
 dialog.querySelector('[data-language-close]').onclick=()=>dialog.close();
 for(const option of dialog.querySelectorAll('[data-language]')){
  option.setAttribute('aria-pressed',String(option.dataset.language===language));
  option.onclick=()=>{const selected=option.dataset.language;if(selected===language){dialog.close();return}try{localStorage.setItem(LANGUAGE_KEY,selected)}catch{}const url=new URL(location.href);url.searchParams.set('lang',selected);location.assign(url.href);};
 }
}
