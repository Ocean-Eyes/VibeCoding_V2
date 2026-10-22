# 배밀기 도전

주소: `/basics/hindu-push-up`. 기초 메뉴에서 진입한다. 띠 시연/기존 수련의 인식 모델과 상태를 변경하지 않고 별도의 Pose 전용 Worker를 사용한다.

## 동작 시연

진입 시 **동작 시연**을 먼저 보여준다. Ricky Bennison의 옆모습 원본 영상으로 배밀기의 내려가기·앞으로 통과하기·상체 올리기·되돌아가기 흐름을 확인한다. 재생/일시정지, 처음부터, 탐색, 0.5×/1× 속도를 제공한다. 영상과 포스터는 로컬 자산이며 출처와 CC BY-SA 4.0 라이선스를 화면에 표시한다. 자세한 출처는 `assets/demos/README.md`에 있다.

**카메라 켜고 도전**을 누르면 시연을 멈추고 카메라 화면으로 전환한다. 도전 중에는 시연 전환을 잠가 진행 중인 기록을 실수로 끊지 않으며, 종료/중단 후 다시 볼 수 있다. 메뉴 이동과 탭 숨김도 영상을 일시정지한다. 시연 재생은 카메라나 공용 기록 세션을 시작하지 않는다.

## 집계

- 카메라는 옆에 고정하고 수평을 유지한다. 눕고 일어서는 공간 전체가 화면 안에 들어와야 한다.
- 어깨·팔꿈치·손목·골반·무릎·발목이 보이는 한쪽 관절 체인을 사용한다. 이미지 종횡비를 보정해서 각도를 계산한다.
- 바닥에서 가슴을 낮춘 자세를 0.7초 확인한 뒤 시작한다. 낮은 자세 → 팔을 펴며 가슴을 올린 자세를 확인할 때 1회 증가한다.
- 다음 횟수에는 새로운 낮은 자세가 필요하다. 관절 유실/탭 숨김/프레임 단절 때 미완성 반복을 해제하며 기존 횟수는 유지한다.
- 다리를 펴고 완전히 선 자세를 1.2초 유지하면 자동 종료한다. 일어서기는 반복으로 세지 않는다. 취소·카메라 오류는 순위 제출로 이어지지 않는다.
- 이는 사용자의 요청을 구현한 카메라 집계 규칙이다. 자세 검정이나 공식 경기 심사가 아니다. 합성 관절 시퀀스 테스트와 실제 사람 카메라 인식 정확도는 구분한다. 실제 사용자·의복·카메라별 조정은 현장 검증이 필요하다.

## 과금 없는 공용 저장소 연결

2026-10-22에 Vercel `auto-nav/vibe-coding-v2`의 Production에 Upstash Redis `justjudo-hindu-pushup`을 연결했다. 실제 저장소 설정은 **Free**, 도쿄 `hnd1`, `autoUpgrade=false`, `prodPack=false`, `eviction=false`다. 카드 등록이나 유료 요금제 전환은 하지 않았다. [저장소 관리](https://vercel.com/auto-nav/~/stores/integration/store_SxTUZY8rxBPJuLJg)에서 확인할 수 있다.

Production의 `KV_REST_API_URL`, `KV_REST_API_TOKEN`을 서버에서만 사용한다. 자격 증명은 Git에 포함하지 않는다. 저장소를 다시 연결할 때도 아래 무료 설정을 유지한다.

1. Upstash 계정에서 Redis **Free ($0)** 데이터베이스를 만든다. **Auto Upgrade를 끈다.** 카드 등록/Pay as You Go/Fixed/Prod Pack을 선택하지 않는다. 3일 뒤 삭제되는 익명 임시 DB를 운영 기록에 사용하지 않는다.
2. Vercel의 이 프로젝트 Settings → Environment Variables에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`을 서버 환경 변수로 등록한다. 기존 무료 연동의 `KV_REST_API_URL`, `KV_REST_API_TOKEN`도 지원한다. 토큰을 소스, 프런트엔드 공개 변수, 채팅에 붙이지 않는다.
3. Production에 적용해 재배포한다. `GET /api/baemilgi`가 200과 `{ "entries": [] }`를 반환하면 연결 완료다. 설정이 없으면 503 `not_configured`, 무료 한도나 일시 장애면 503 `storage_unavailable`로 닫히며 유료 서비스로 전환하지 않는다.
4. 공용 도전을 시작하고 한 회 이상 수행한 뒤 서서 종료한다. 닉네임 저장 후 다른 브라우저에서 순위가 보이는지 확인한다. 한도에 걸리면 이 기기 저장은 계속 가능하다.

2026-10-22 확인: [Upstash 공식 가격](https://upstash.com/pricing/redis)은 Free 256 MB / 월 500K commands를 안내한다. 유료 전환 설정을 변경하는 코드는 없다. 기존 Vercel 호스팅 요금제도 이 변경에서 수정하지 않는다. 호스팅 자체의 무료 한도는 별도다.

## API와 기록

`api/baemilgi.js`는 Vercel Node 함수다. 로컬 `scripts/serve.mjs`도 같은 함수를 호출한다. 실행 환경에 위 변수를 설정하면 로컬에서도 실제 저장소를 사용하므로 테스트는 별도 DB를 써야 한다.

- GET: 상위 50개. 첫 조회는 공유 캐시 60초로 반복 조회를 줄인다. 저장 직후와 순위 새로고침은 `?fresh=1` 및 `Cache-Control: no-store`로 최신 목록을 읽는다. 같은 횟수는 공동 순위다.
- POST `action:start`: 무작위 브라우저 ID에 대해 서버 서명·시작 시각을 포함한 세션을 발급한다. IP별 시간당 30회 제한. 원 IP는 저장하지 않고 HMAC으로 키를 만든다.
- POST `action:save`: 서명, 세션 수명, 횟수와 반복 시각의 일치, 최소 주기, 종료 시각, 닉네임, 동일 출처를 검사한다. IP별 시간당 60회 제한. 최대 32 KB 요청.
- 하나의 Lua 트랜잭션으로 세션 중복 제출을 방지하고 브라우저별 최고 기록만 갱신한다. 상위 1,000명 보관. 중복 제출 응답은 7일 보관한다. 닉네임은 계정 ID가 아니므로 같은 이름이어도 합치지 않는다.
- 네트워크 오류 시 이 기기에 저장하고 공용 등록 재시도를 제공한다. 아직 전송하지 않은 세션은 페이지를 닫으면 사라지므로 결과 창에서 재시도한다.
- 영상과 관절 데이터는 전송하지 않는다. 서버에는 횟수·상대 반복 시각·닉네임·서명 세션만 전송한다. 공개 값은 닉네임, 최고 횟수, 날짜, 순위다.
- 클라이언트 집계는 조작 방지 인증이 아니다. 서버 형식/시간 검사로 실제 수행을 증명할 수 없으며, 개발자 도구로 조작한 기록을 완벽하게 막지 않는다. 현재 제품은 가벼운 경쟁용 자동 집계다.

참고: [MediaPipe Pose Web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [Redis REST](https://upstash.com/docs/redis/features/restapi), [Vercel Redis](https://vercel.com/docs/redis).
