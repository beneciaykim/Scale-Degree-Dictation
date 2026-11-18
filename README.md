# Scale Degree Dictation — deployable web app

기존 **Scale Degree Dictation v2.2**를 서버 설치 없이 배포 가능한 정적 웹앱(PWA)으로 패키징했습니다.

## 구성 파일

- `index.html`: 기존 v2.2 연습 화면, 오디오, 음계 및 해결음 엔진 (변경 최소화)
- `manifest.webmanifest`: 홈 화면 설치 설정
- `sw.js`: 최초 방문 후 오프라인 실행용 캐시
- `assets/icon-192.png`, `assets/icon-512.png`: 홈 화면 아이콘
- `LICENSE-TimGM6mb.txt`: 임베디드 피아노 샘플 출처 관련 GPL-2.0 라이선스

## 가장 쉬운 배포법

정적 웹사이트 호스팅(Netlify, Cloudflare Pages, GitHub Pages 등)에 **이 폴더의 내용 전체**를 업로드하면 됩니다. 특별한 빌드 명령도, 서버도, 데이터베이스도 필요하지 않습니다. `index.html`이 배포 루트에 있어야 합니다.

- Netlify의 수동 사이트 배포 기능에 폴더 내용을 드래그 앤 드롭할 수 있습니다.
- GitHub Pages에서는 리포지토리에 파일을 올리고 Pages를 활성화하면 됩니다.

HTTPS 주소로 최초 방문하면 오프라인 캐시가 설치됩니다. 설치 후에는 브라우저의 *앱 설치* 또는 *홈 화면에 추가* 기능을 활용하세요. iPhone의 Safari에서는 공유 메뉴에서 **홈 화면에 추가**를 선택할 수 있습니다.

## 로컬 개발 테스트

이 폴더에서:

```bash
python -m http.server 8000
```

이후 `http://localhost:8000/`을 엽니다. 단순히 `index.html`을 더블클릭해 여는 `file://` 환경에서는 서비스 워커/PWA 설치가 작동하지 않지만, 연습 화면은 실행할 수 있습니다.

## 참고

- 기존 설정/세션/결과 3화면, 커스텀 스케일, 사용자 지정 해결 프레이즈, 오프라인 피아노 샘플은 유지됩니다.
- 별도 계정 및 클라우드 성적 동기화는 포함하지 않습니다. 세션 기록도 기기 간 동기화되지 않습니다.
- 피아노 샘플은 **TimGM6mb SoundFont (GPL-2.0)** 기반입니다. 기존 출처 표기와 라이선스 본문을 보존했습니다. 공개 배포 시 라이선스 의무를 확인하세요.
- 앱 업데이트 뒤에는 `sw.js`의 `CACHE_NAME` 버전을 바꾸면 기존 캐시가 갱신됩니다.
