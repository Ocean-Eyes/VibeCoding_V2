import {language} from './i18n.js';
export const throwText=(ko,en)=>language==='en'?en:ko;
const t=throwText;
export const THROW_LESSONS=[
 {
  id:'o-soto-gari',roman:'O-soto-gari',name:t('밭다리 후리기','O-soto-gari'),kanji:'大外刈',available:true,
  label:'ASHI-WAZA',description:t('바깥으로 들어가 상대의 오른다리를 뒤에서 후립니다.','Enter on the outside and reap the partner’s right leg from behind.'),
  source:'https://judo.ijf.org/techniques/O-soto-gari',
 },
 {
  id:'o-uchi-gari',roman:'O-uchi-gari',name:t('안다리 후리기','O-uchi-gari'),kanji:'大内刈',available:true,
  label:'ASHI-WAZA',description:t('상대 두 다리 사이로 들어가 왼다리를 안쪽에서 후립니다.','Enter between the legs and reap the partner’s left leg from inside.'),
  source:'https://judo.ijf.org/techniques/O-uchi-gari',
 },
 {
  id:'ippon-seoi-nage',roman:'Ippon-seoi-nage',name:t('한팔 업어치기','Ippon-seoi-nage'),kanji:'一本背負投',available:true,
  label:'TE-WAZA',description:t('소매를 당겨 몸을 돌리고 오른어깨 위로 메치는 동작입니다.','Draw the sleeve, turn in, and throw over the right shoulder.'),
  source:'https://judo.ijf.org/techniques/Ippon-seoi-nage',
 },
];
