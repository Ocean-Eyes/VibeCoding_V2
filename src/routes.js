// Shared by browser navigation and the local server. Only published screens
// have routes; unavailable lessons stay on their category's existing cards.
export const ROUTES=[
 {path:'/',screen:'home'},
 {path:'/basics',screen:'category',category:'basics',parent:'/'},
 {path:'/katame-waza',screen:'category',category:'katame',parent:'/'},
 {path:'/throws',screen:'category',category:'throws',parent:'/'},
 {path:'/throws/o-soto-gari',screen:'lesson',category:'throws',lesson:'o-soto-gari',parent:'/throws'},
 {path:'/throws/o-uchi-gari',screen:'lesson',category:'throws',lesson:'o-uchi-gari',parent:'/throws'},
 {path:'/throws/ippon-seoi-nage',screen:'lesson',category:'throws',lesson:'ippon-seoi-nage',parent:'/throws'},
 {path:'/katame-waza/shime-waza',screen:'category',category:'katame',group:'shime-waza',parent:'/katame-waza'},
 {path:'/katame-waza/kansetsu-waza',screen:'category',category:'katame',group:'kansetsu-waza',parent:'/katame-waza'},
 {path:'/katame-waza/osaekomi-waza',screen:'category',category:'katame',group:'osaekomi-waza',parent:'/katame-waza'},
 {path:'/basics/belt',screen:'lesson',category:'basics',lesson:'belt',parent:'/basics'},
 {path:'/basics/hindu-push-up',screen:'lesson',category:'basics',lesson:'baemilgi',parent:'/basics'},
 {path:'/katame-waza/shime-waza/nami-juji-jime',screen:'lesson',category:'katame',lesson:'nami',parent:'/katame-waza/shime-waza'},
 {path:'/katame-waza/shime-waza/gyaku-juji-jime',screen:'lesson',category:'katame',lesson:'gyaku',parent:'/katame-waza/shime-waza'},
 {path:'/katame-waza/shime-waza/kata-juji-jime',screen:'lesson',category:'katame',lesson:'kata',parent:'/katame-waza/shime-waza'},
];
export function resolveRoute(pathname,base='/'){
 const prefix=base.replace(/\/$/,'');
 if(prefix&&pathname!==prefix&&!pathname.startsWith(prefix+'/'))return null;
 const path=(pathname.slice(prefix.length).replace(/\/+$/,'')||'/');
 return ROUTES.find(route=>route.path===(path==='/index.html'?'/':path))??null;
}
export function routeURL(path,base='/',search=''){
 return base.replace(/\/$/,'')+path+search;
}
export const categoryPath=id=>ROUTES.find(r=>r.screen==='category'&&r.category===id)?.path;
export const lessonPath=id=>ROUTES.find(r=>r.lesson===id)?.path;
