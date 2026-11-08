# PC 화면과 스마트폰 카메라 연결

PC에서 배밀기, 띠 매기 또는 조르기 수련을 열고 **스마트폰 카메라 연결**을 누른다. 폰의 기본 카메라로 QR을 스캔해 열린 페이지에서 **카메라 켜고 연결**을 누른다. 별도 앱 설치는 필요 없다. PC와 폰은 같은 Wi-Fi를 사용한다.

폰은 후면 광각을 우선 사용하며, 연결 후 카메라 선택에서 전면 또는 노출된 다른 렌즈로 전환할 수 있다. PC는 시연·가이드·자세 분석을 실행한다. PC에서 중단하거나 메뉴를 나가면 폰 카메라도 종료된다. 폰에서도 **촬영 종료**로 끊을 수 있다. 촬영 중에는 폰 화면을 켜 둔다.

## 연결 구조

- `api/phone-camera.js`는 기존 Upstash Redis 설정(`KV_REST_API_*` 또는 `UPSTASH_REDIS_REST_*`)을 재사용한다. 새 계정이나 유료 서비스 설정을 추가하지 않는다. 리더보드와 분리된 `just-judo:phone-camera:v1:` 키만 사용한다.
- QR의 연결 키는 URL fragment에 넣어 정적 페이지 요청이나 Referer에 포함하지 않는다. 서버에는 PC/폰의 서로 다른 키 해시, 연결 메시지와 접속 제한 카운터를 보관한다. QR과 연결 메시지는 최대 5분 뒤 삭제되며, 연결 후 영상 전송에 저장소를 계속 폴링하지 않는다. 제한 카운터는 1시간 후 삭제된다.
- QR 하나는 폰 한 대만 사용할 수 있다. 원래 폰의 요청 재시도는 허용하고 다른 폰의 참여는 거부한다. API는 같은 출처의 JSON POST만 허용하며, PC/폰의 역할과 메시지 크기를 검사한다.
- 영상은 WebRTC로 폰에서 PC에 전달한다. 영상 프레임을 API나 Redis에 보내지 않는다. 기본 설정은 STUN을 이용한 직접 연결이며, 게스트 Wi-Fi나 기기 간 통신이 막힌 네트워크에서는 연결되지 않을 수 있다. 외부망까지 보장하는 TURN 중계 서비스는 이번 변경에 추가하지 않는다.
- PC와 폰 사이의 제어 채널과 연결 상태를 이용해 종료를 전파한다. 처음 연결에 실패하면 35초 뒤 정리하고, 잠시 끊긴 연결은 10초 동안 복구를 기다린다. 새 연결에는 새 QR을 사용한다.
- 기존 PC/폰 직접 카메라 기능은 유지한다. `phone-camera-host.js`의 스트림 관리 함수가 원격 카메라와 기존 로컬 카메라의 종료 처리를 구분한다.

## 로컬 검증

```sh
npm run build
PHONE_CAMERA_MEMORY=1 PORT=5186 npm start
node --test tests/phone-camera-api.test.mjs tests/routes.test.mjs
node scripts/browser-phone-camera.cjs <playwright-package-path>
PHONE_CAMERA_REAL=1 node scripts/browser-phone-camera.cjs <playwright-package-path>
```

PowerShell에서는 환경 변수를 `$env:PHONE_CAMERA_MEMORY='1'`, `$env:PORT='5186'`처럼 지정한다. 메모리 저장소는 localhost 개발 서버에서 명시적으로 켰을 때만 사용한다. 운영 API는 Redis가 없으면 503을 반환한다.

브라우저 검사는 서로 분리된 PC/폰 컨텍스트를 실제 WebRTC로 연결한다. 기본 검사는 테스트 영상·자세 입력을 쓰고, `PHONE_CAMERA_REAL=1`은 실제 MediaPipe 모델로 수신 영상의 자세·손 분석까지 검사한다. PC 카메라를 호출하지 않는지, 양쪽 종료·취소·권한 거부 후 재시도·렌즈 교체를 확인한다. 실제 iPhone/Android 기기와 실제 Wi-Fi에서의 최종 검증은 별도다.

QR 생성기는 [Project Nayuki 공식 배포](https://www.nayuki.io/page/qr-code-generator-library)를 로컬 ESM으로 포함했다. 원본 MIT 라이선스는 `src/qr-code.js`에 보존했다. 2026-11-08에 받은 공식 ES6 파일의 SHA-256은 `2511bc17f40a3c41d4a0578995db956b38997334d3d20113a5d4dc5c49c69480`이다. 원본에 ESM export와 출처 주석을 추가하고 줄 끝 공백을 정리했다.
