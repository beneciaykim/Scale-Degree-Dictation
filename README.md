# Scale Degree Dictation v2.3 — custom SoundFont web app

기존 v2.2의 Settings → Session → Results 및 음계·조성·프레이즈 기능을 유지하면서 **Custom SoundFont** 기능을 추가했습니다.

## Quick start — GitHub Pages / Netlify

압축 파일의 **내용 전체**를 정적 호스팅 루트에 업로드하세요. `index.html`, `soundfont-engine.js`, `sw.js`, `manifest.webmanifest`, `assets/`가 같은 상대 경로에 있어야 합니다. npm, 서버, 빌드 과정, 계정이 필요 없습니다.

**로컬 테스트:** 이 폴더에서 `python -m http.server 8000` 실행 후 `http://localhost:8000/` 방문. HTTPS 배포 주소에서 PWA 홈 화면 설치 및 서비스 워커 오프라인 캐시를 사용할 수 있습니다.

## Custom SoundFont 사용법

1. **Settings → Piano sound → Custom SoundFont · SF2 / SF3** 선택
2. 파일 선택에서 기기의 **.sf2** 또는 **.sf3** 파일 지정
3. **Instrument preset** 드롭다운에서 악기 선택; 샘플 준비 상태가 `ready`가 될 때까지 확인
4. **Preview C4**에서 미리 듣기, **Start new session**으로 시작

선택된 프리셋은 기준 케이던스·목표음·토닉 버튼·해결 프레이즈·미리 듣기에 적용됩니다. 기존 Sampled Grand Piano 및 Original Synth Piano도 유지됩니다.

## 기술적 참고 및 제한

- 파일은 **브라우저 안에서만 읽고 디코딩**합니다. 서버에 업로드하거나 인터넷으로 전송하지 않습니다.
- 파일은 브라우저 메모리에만 보관됩니다. 페이지 새로고침/앱 재시작 시 다시 선택해야 합니다. (IndexedDB 저장 기능은 미구현.)
- **SF2**: RIFF/SF2의 프리셋, 건반 영역, MIDI 전조, 샘플 재생, 루프, 기본 음량 엔벨로프·패닝을 지원합니다.
- **SF3**: Ogg Vorbis 샘플을 브라우저의 오디오 디코더로 여는 방식입니다. 해당 디코더가 없는 브라우저에서는 지원되지 않을 수 있습니다.
- 이 경량 재생기는 FluidSynth의 완전한 구현은 아닙니다. 일부 SoundFont의 세밀한 필터, 변조 및 효과는 원본과 다르게 들릴 수 있습니다. 악기/샘플 커버리지에 따라 일부 건반이 무음일 수 있습니다.
- 아주 큰 파일은 모바일에서 메모리 부족이 발생할 수 있습니다. 280 MB 이상 파일은 예방 차원에서 로드를 차단합니다.
- 사용자 SoundFont의 저작권/배포 조건은 사용자가 확인해야 합니다. **타인의 SoundFont를 공개 저장소에 업로드하지 않아도 됩니다.**
- 내장 샘플 음원은 TimGM6mb (GPL-2.0) 기반입니다. 기존 HTML 내 출처 및 `LICENSE-TimGM6mb.txt`는 유지됩니다.
- 오프라인/PWA 캐시에는 **앱 파일만** 포함됩니다. 사용자 음원 파일 자체는 캐시되지 않습니다.

## File map

- `index.html`: 기존 앱과 SoundFont UI/오디오 연동
- `soundfont-engine.js`: 브라우저에서 실행되는 로컬 SoundFont 샘플러 (외부 CDN 없음)
- `sw.js`: 앱 파일 오프라인 캐시
- `manifest.webmanifest`, `assets/`: PWA 설정/아이콘
- `LICENSE-TimGM6mb.txt`: 내장 음원 라이선스
