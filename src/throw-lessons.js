import {language} from './i18n.js';
export const throwText=(ko,en)=>language==='en'?en:ko;
const t=throwText;
export const THROW_PHASES=[
 {id:'kuzushi',name:t('기울이기','Kuzushi'),roman:'KUZUSHI',meaning:t('상대의 중심을 움직입니다.','Move the partner’s balance.')},
 {id:'tsukuri',name:t('지읏기','Tsukuri'),roman:'TSUKURI',meaning:t('기술을 걸 위치로 몸을 맞춥니다.','Fit your body into position.')},
 {id:'kake',name:t('걸기','Kake'),roman:'KAKE',meaning:t('손과 몸, 다리의 움직임을 연결합니다.','Connect the hands, body and legs.')},
];
export const THROW_LESSONS=[
 {
  id:'o-soto-gari',roman:'O-soto-gari',name:t('밭다리 후리기','O-soto-gari'),kanji:'大外刈',available:true,
  label:'ASHI-WAZA',description:t('바깥으로 들어가 상대의 오른다리를 뒤에서 후립니다.','Enter on the outside and reap the partner’s right leg from behind.'),
  source:'https://judo.ijf.org/techniques/O-soto-gari',
  phases:[
   {title:t('오른쪽 뒤꿈치로 중심 보내기','Load the right heel'),cue:t('왼손은 상대 오른 소매, 오른손은 왼깃을 잡은 형태로 상대의 오른쪽 뒤로 기울입니다.','With left hand on the right sleeve and right hand on the left lapel, guide the partner toward their right rear corner.'),focus:t('상대의 오른쪽 뒤','Partner’s right rear'),check:t('손과 상체를 함께 움직였나요?','Did your hands and upper body move together?')},
   {title:t('왼발을 바깥에 딛고 밀착하기','Step outside with the left foot'),cue:t('왼발을 상대 오른발 바깥에 딛습니다. 몸을 가까이 붙이고 오른다리를 앞으로 들어 준비합니다.','Plant the left foot outside the partner’s right foot. Close the body distance and swing the right leg forward.'),focus:t('왼발 지지 · 오른다리 준비','Left support · right leg ready'),check:t('왼발로 지지하고 몸이 멀어지지 않았나요?','Are you supported on the left foot without leaning away?')},
   {title:t('상체와 오른다리를 함께 보내기','Connect the body and the reap'),cue:t('상체를 앞으로 보내면서 오른다리를 뒤로 후립니다. 혼자서는 다리를 낮고 천천히 움직이며 균형을 유지하세요.','Move your upper body forward as the right leg reaps backward. When practising solo, keep the leg low and the motion slow.'),focus:t('오른다리로 상대 오른다리 바깥 후리기','Right leg reaps the right leg from outside'),check:t('상체와 후리는 다리가 따로 움직이지 않았나요?','Did your body and reaping leg move as one?')},
  ],
 },
 {
  id:'o-uchi-gari',roman:'O-uchi-gari',name:t('안다리 후리기','O-uchi-gari'),kanji:'大内刈',available:true,
  label:'ASHI-WAZA',description:t('상대 두 다리 사이로 들어가 왼다리를 안쪽에서 후립니다.','Enter between the legs and reap the partner’s left leg from inside.'),
  source:'https://judo.ijf.org/techniques/O-uchi-gari',
  phases:[
   {title:t('왼쪽 뒤꿈치에 중심 싣기','Load the left heel'),cue:t('소매와 깃을 잡은 형태로 상대를 왼쪽 뒤로 기울입니다. 상대의 왼발에 체중이 실리는 방향을 확인하세요.','Use the sleeve-and-lapel position to guide the partner toward their left rear corner, loading the left heel.'),focus:t('상대의 왼쪽 뒤','Partner’s left rear'),check:t('중심을 보낼 방향을 확인했나요?','Have you checked the direction of balance?')},
   {title:t('오른발 진입 · 왼발로 받치기','Enter right, support left'),cue:t('오른발을 상대 두 발 사이로 넣고 왼발을 따라 옮겨 몸을 받칩니다. 상체는 상대를 향합니다.','Enter between the partner’s feet with the right foot, then bring the left foot in to support your body. Keep facing the partner.'),focus:t('두 발 사이로 진입','Enter between the feet'),check:t('왼발에 체중을 옮겨 오른다리가 자유로운가요?','Is your weight on the left foot so the right leg can move?')},
   {title:t('안쪽에서 큰 원으로 후리기','Reap in a wide inward arc'),cue:t('오른다리를 상대 왼다리 안쪽에 대고 자신의 오른쪽으로 크게 후립니다. 손과 상체도 상대가 뒤로 움직이는 방향을 따릅니다.','Bring the right leg inside the partner’s left leg and reap outward to your right. Let the hands and body follow the backward direction of the throw.'),focus:t('오른다리로 상대 왼다리 안쪽 후리기','Right leg reaps the left leg from inside'),check:t('발끝만 차지 않고 다리와 몸을 함께 움직였나요?','Did you move the leg and body together rather than kick with the toes?')},
  ],
 },
 {
  id:'ippon-seoi-nage',roman:'Ippon-seoi-nage',name:t('한팔 업어치기','Ippon-seoi-nage'),kanji:'一本背負投',available:true,
  label:'TE-WAZA',description:t('소매를 당겨 몸을 돌리고 오른어깨 위로 메치는 동작입니다.','Draw the sleeve, turn in, and throw over the right shoulder.'),
  source:'https://judo.ijf.org/techniques/Ippon-seoi-nage',
  phases:[
   {title:t('앞으로 끌어 중심 띄우기','Draw the balance forward'),cue:t('왼손으로 상대 오른 소매를 앞·위로 당깁니다. 자신의 팔만 접지 말고 상대가 앞으로 따라오게 합니다.','Draw the partner’s right sleeve forward and upward with the left hand, bringing the partner forward rather than just bending your own arm.'),focus:t('상대의 앞쪽','Partner’s front'),check:t('소매를 앞·위로 이끄는 방향을 확인했나요?','Have you checked the forward and upward sleeve direction?')},
   {title:t('왼쪽으로 돌아 등을 붙이기','Turn left and fit the back'),cue:t('오른발로 들어가 왼쪽으로 돌아섭니다. 왼발을 가져오며 무릎을 굽히고 오른팔을 상대 오른겨드랑이 아래에 넣습니다.','Step in with the right foot and pivot left. Bring in the left foot, bend the knees, and fit the right arm beneath the partner’s right armpit.'),focus:t('무릎 굽히기 · 오른팔 끼우기','Bend knees · fit the right arm'),check:t('허리만 숙이지 않고 무릎을 굽혀 들어갔나요?','Did you bend the knees instead of only bending at the waist?')},
   {title:t('다리를 펴며 오른어깨 너머로','Extend and turn over the right shoulder'),cue:t('등의 접촉을 유지하며 다리를 펴고 상체를 앞으로 돌립니다. 왼손의 당김을 이어 오른어깨 너머로 방향을 만듭니다.','Maintain back contact, extend the legs and turn the upper body forward, continuing the left-hand pull over the right shoulder.'),focus:t('다리 펴기 + 소매 당기기','Extend the legs + draw the sleeve'),check:t('다리의 펴짐과 손의 당김이 이어졌나요?','Did the leg extension connect with the sleeve pull?')},
  ],
 },
];
