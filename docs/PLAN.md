# 🗂️ PLAN — 문해력 해독기 (Literacy Decoder)

> 개발 계획 및 진행 상태
> Last updated: 2026-06-02

## 📍 현재 상태

**전체**: ✅ v1.0 핵심 루프 구현 완료 (Phase 0 ~ 6) — 일부 보강 항목 잔존
**완료**: AGENTS.md, PRD.md, TRD.md, Phase 0 ~ Phase 6 전 단계 핵심 기능
**잔존(미구현)**: 한자 long-press 툴팁, SRL 복습 한자 우선 등장, 복습 알림, 학부모 PIN 잠금, i18n, 코퍼스 분량 확대(현재 intro 5 / mid 5 / advanced 5 / boss 5편)
**모드 변경(2026-06-02)**: 학년(5/6) 선택 제거 → **통합 모드**. 전체 지문을 manifest 순서(입문→중급→심화)로 제공. `pickNextCorpus`의 grade/level 은 선택적 필터로만 남김. 한자 도감의 급수(8급~1급) 필터는 별개로 유지.
**리포지토리**: https://github.com/littleanti/literacy_decoder
**실행**: `npm run dev` → http://localhost:4326

### Phase 완료 요약
- ✅ **Phase 0**: 한자 마스터 DB (~280자), 코퍼스 스키마, IndexedDB 래퍼, 빌드 마커 스크립트 (`scripts/build-corpus.js`)
- ✅ **Phase 1**: 시작/읽기/종료 화면, 빈칸 드래그 매칭, 어원 풀이, IndexedDB 진척도 저장
- ✅ **Phase 2**: 페이지 단위 검증, 키보드/스와이프 이동, 태블릿 분할 레이아웃, 읽기 속도 측정 (코퍼스 분량은 5편으로 시드 수준)
- ✅ **Phase 3**: 사자성어 보스 4×1 슬롯, 7단계 게이트웨이 (`window.literacyDecoderGateway`), 7단계 `SAJASUNGO_DATA` 옵트인 import (`?seventh-stage=1`)
- ✅ **Phase 4**: 어원 풀이 모달 + 형태소 애니메이션, 루비 텍스트, TTS 지문 낭독 + 한자 음 발음 (한자 long-press 툴팁 미구현)
- 🟡 **Phase 5**: Vanilla SVG 대시보드 ✅, 읽기 속도 그래프 ✅, export/import ✅, SRL 망각 곡선 큐 ✅ / 복습 우선 등장·복습 알림·학부모 PIN 미구현
- 🟡 **Phase 6**: PWA (manifest + sw.js) ✅, 응용 작문 미션 ✅, 다크 모드 ✅, 폰트 크기 조절 ✅ / i18n 미구현
- ✅ **추가**: 도감 (`collection.js`, 화면 라벨 "📚 도감") — 한자 278자 그리드 + 급수 필터(전체/8·7·6·5급/고급) + 한자별 어휘(지문 빈칸 + 사자성어) 상세, 학습한 한자 표시 (5단계 도감 이식)
- ✅ **검증**: 헤드리스 Puppeteer E2E (`scripts/e2e-verify.mjs`)

## 🎯 마일스톤 개요

| Phase | 목표 | 예상 기간 | 의존성 |
|---|---|---|---|
| Phase 0 | 데이터 스키마 + 인접 단계 호환 검증 | 1주 | 5단계, 7단계 데이터 |
| Phase 1 | 입문 난이도 MVP | 2주 | Phase 0 |
| Phase 2 | 중급 난이도 + 페이지네이션 | 1.5주 | Phase 1 |
| Phase 3 | 심화 난이도 + 사자성어 보스 | 2주 | Phase 2, 7단계 데이터 |
| Phase 4 | 어원 풀이 + TTS + 루비 텍스트 | 1주 | Phase 3 |
| Phase 5 | 학습 기록 대시보드 + SRL | 1.5주 | Phase 4 |
| Phase 6 | 응용 작문 + PWA + 다크모드 | 1주 | Phase 5 |

## 🚧 Phase 0 — 데이터 모델 + 호환 검증

**목표**: 본 게임이 5단계 / 7단계와 단절 없이 작동하도록 데이터 출발점 스키마 확정.

- [x] **한자 마스터 DB 스키마 확정** (`src/data/hanja.js`)
  - sound / meaning / strokes / grade 필드 (현재 ~280자, 향후 ~500자 목표)
  - 5단계의 향후 DB가 본 스키마를 그대로 채택할 수 있는지 검증
- [x] **지문 코퍼스 메타 스키마 확정** (`src/data/corpus/manifest.json`)
  - 학년 / 난이도 / 글자수 / 빈칸 위치 / 보스 연결
- [x] **사자성어 import 호환** (`src/data/idioms.js`)
  - 7단계 `SAJASUNGO_DATA` 옵트인 import 동작 확인 (`?seventh-stage=1`, 임베디드 fallback)
  - 형태소 분해 메타(`hanja: ["東","問","西","答"]`) 추가
- [x] **IndexedDB 스키마 정의** (`src/js/storage.js`)
  - 5단계와 호환 가능한 progress / hanjaMastery / bossPassed 테이블 + `nextReview` 인덱스
- [x] **빌드 마커 명세** (`{{단어:漢字}}` 토큰 → JSON 변환)
  - `scripts/build-corpus.js` (Node)

**산출물**: `data/` 디렉터리 + 스키마 문서 1편 (TRD §3 보강)

## 🚧 Phase 1 — 입문 난이도 MVP

**목표**: 100자 내외 지문 1편 + 빈칸 1개 + 형태소 도크의 핵심 루프를 끝까지 작동.

### Phase 1.1 — 시작 화면 + 라우팅
- [x] `index.html` 골격 + 화면 슬롯
- [x] `main.js` 진입점 + `ui.js` 화면 전환
- [x] 학년 선택 (5 / 6) + "이어하기" / "처음부터"
- [x] localStorage 사용자 ID 생성 + grade 저장

### Phase 1.2 — 지문 렌더
- [x] `corpus.js` lazy-load (manifest → 본문)
- [x] `reading.js` 지문 텍스트 렌더 + 빈칸 셀 마킹
- [x] 빈칸 셀 활성화 인터랙션 (탭 / 클릭)

### Phase 1.3 — 형태소 도크
- [x] `morpheme.js` 도크 렌더링 (하단 sticky)
- [x] 디스트랙터 알고리즘 (Phase 0의 한자 DB 활용)
- [x] 형태소 카드 음·뜻 표시 (입문 난이도)
- [x] 카드 → 빈칸 드래그 매칭 (자성 스냅)

### Phase 1.4 — 채점 (어원 풀이는 Phase 4에서 강화)
- [x] 정답 시 단어 채워짐 + 단순 ✓ 토스트
- [x] 오답 시 카드 원위치 + 형태소별 ✕ 표시
- [x] 모든 빈칸 완료 → 종료 화면 (점수만)

### Phase 1.5 — 영속화 기본
- [x] IndexedDB 진척도 저장 (corpusId, accuracy, completedAt)
- [x] 새로고침 후 "이어하기" 동작

**산출물**: 입문 지문 5편 + 핵심 루프 동작 데모. 모바일 세로 작동.

## 🚧 Phase 2 — 중급 난이도 + 페이지네이션

**목표**: 300 ~ 500자 지문을 폰 화면에 분할하고 빈칸 2 ~ 3개를 자연스럽게 처리.

- [x] **모바일 페이지네이션** (`paginateForMobile`)
  - 빈칸 단위 분할, 빈칸이 항상 상단 50%에 위치
  - 페이지 인디케이터 (1/4, 2/4 ...)
  - 좌우 스와이프 + 키보드 좌우 화살표
- [x] **태블릿 분할 레이아웃**
  - 좌 65% 지문 / 우 35% 도크 + 어원
  - `@media (min-width: 768px)` 분기
- [x] **빈칸 ↔ 형태소 카드 드래그** (태블릿 정밀 작업)
- [x] **중급 난이도 디스트랙터 강화** — 음만 표시 (뜻 숨김)
- [ ] **지문 코퍼스 30편 추가** (중급 난이도) — 현재 mid 5편 시드만 존재
- [x] **읽기 속도 측정** — 페이지 전환 timestamp 기록 → session.charsRead / elapsed

**산출물**: 폰/태블릿 분기 작동 ✅ + 중급 지문 5편 시드 (목표 30편).

## 🚧 Phase 3 — 심화 난이도 + 사자성어 보스

**목표**: 800자+ 지문 처리 + 사자성어 보스 스테이지로 7단계 게이트웨이 완성.

### Phase 3.1 — 심화 지문
- [x] 다중 페이지 지문 페이지네이션
- [x] 빈칸 다수, 형태소만 표시 (음·뜻 모두 숨김)
- [ ] 한자 long-press 툴팁 (학습자가 모르는 한자 확인용) — `state.overlayTooltip` 슬롯만 정의, UI 미구현

### Phase 3.2 — 사자성어 보스
- [x] `boss.js` 진입점
- [x] 4×1 형태소 슬롯 격자 + 후보 형태소
- [x] 짧은 일화 지문 + 형태소 힌트
- [x] 정답 인정 (4글자 순서 일치)
- [x] 보스 통과 → `bossPassed[idiomId] = true` flush
- [x] 7단계 게이트웨이: `bossesPassed` Set 노출 (`window.literacyDecoderGateway`)

### Phase 3.3 — 7단계 데이터 통합
- [x] `idioms.js`가 7단계 `data.js`의 `SAJASUNGO_DATA`를 옵트인 import (`?seventh-stage=1`) + 임베디드 fallback
- [x] 보스용 메타 (`hanja`, `contextStory`) 별도 매핑 (`BOSS_META` → `BOSS_IDIOMS` 합성) — 코어 데이터는 7단계가 진실의 근원

**산출물**: 심화 지문 5편 + 보스 스테이지 5편 시드 (목표 20/10편) + 7단계 통합 검증 ✅.

## 🚧 Phase 4 — 어원 풀이 + TTS + 루비 텍스트

**목표**: 학습자가 정답 후 "왜 그 단어인가"를 이해하고 한자를 자연스럽게 흡수.

- [x] **어원 풀이 팝업** (`reading.js`)
  - 정답 직후 모달: `農夫 = 농(農: 농사) + 부(夫: 사내) → 농사 짓는 사람`
  - 형태소별 카드 + 애니메이션 (개별 등장)
- [x] **루비 텍스트** — 정답 공개 후 한자에 음·뜻 ruby
- [ ] **한자 long-press 툴팁** — 모바일에서 한자 확인 (미구현)
- [x] **TTS 지문 낭독** (`tts.js`)
  - 🔊 버튼 (지문 상단)
- [x] **TTS 한자 음 발음** — 한자 클릭 시 음 재생 (`speakWord`)
- [x] **자동재생 정책** — 사용자 첫 인터랙션 후만
- [x] **TTS 미지원 브라우저** — `speechSynthesis` 미지원 시 가드

**산출물**: 학습 효과를 결정짓는 핵심 UX 완성.

## 🚧 Phase 5 — 학습 기록 + SRL

**목표**: 누적 학습이 한 곳에 시각화되고, 망각 곡선에 따라 복습이 트리거됨.

- [x] **대시보드 화면** (`dashboard.js`)
  - 누적 어휘 / 한자 / 통과 보스 카운터
  - 정답률 곡선 (Vanilla SVG)
  - 자주 틀린 한자
- [x] **읽기 속도 그래프** — 주차별 자/분
- [x] **SRL 스케줄러** — 망각 곡선 큐 (`SRL_INTERVALS_MS` = 1/3/7/14/30일), `hanjaMastery.nextReview` 기록
  - [ ] 다음 세션 시작 시 복습 한자 우선 등장 — `corpus.js`는 아직 manifest 순서(단순 정책)
- [ ] **복습 알림** — Notification 권한/스케줄 미구현
- [ ] **학부모 PIN 잠금** — `PARENT_PIN` 상수만 정의, 대시보드 진입 검증 미구현
- [x] **데이터 export / import** — IndexedDB → JSON 다운로드 / 복원 (`downloadJSON`)

**산출물**: 학부모도 활용 가능한 진척도 대시보드.

## 🚧 Phase 6 — 응용 작문 + PWA + 다크모드

**목표**: 학습 전이 활동 + 모바일 홈 화면 설치 + 야간 학습 지원.

- [x] **응용 작문 미션** (선택) — `composition.js`
  - 학습 한자어로 짧은 문장 짓기
  - 키워드 매칭 평가 (느슨한 — 시도 자체 보상)
- [x] **PWA**
  - `manifest.json` (이름 / 아이콘 / theme color)
  - `sw.js` Service Worker (지문 / 한자 / 폰트 캐시)
  - 홈 화면 설치 안내 토스트 (`install-prompt.js`)
- [x] **다크 모드** — 토글 + 영속화 (`DARK_MODE`)
- [x] **폰트 크기 조절** — `FONT_SIZES` = 16 / 18 / 22px
- [ ] **i18n 준비** — 한국어 외 (영어 한국어 학습자 모드) 미구현

**산출물**: 배포 가능한 v1.0 — 모바일 홈 화면 설치 가능.

## 🌱 v1 이후 — 향후 로드맵

### P2 후보
- [ ] 친구와 경쟁 — 동일 지문 정답 시간 랭킹 (비식별)
- [ ] 음성 답안 — 빈칸을 음성으로 채우기 (Web Speech Recognition)
- [ ] 학습자 자체 지문 작성 — `{{단어:漢字}}` 마커로 친구에게 출제
- [ ] 교사 모드 — 학급 전체 진척도 대시보드

### P3 (실험)
- [ ] AI 지문 생성 — 학습자 수준 맞춤 지문 생성 (LLM 호출, 옵트인)
- [ ] AR 한자 — 카메라로 실제 사물에서 한자 발견 (4단계와 연계)
- [ ] 부모-자녀 동시 진행 — 같은 지문을 부모는 텍스트로 자녀는 그림으로

## 🔄 기술 부채 / 개선 후보

| 항목 | 우선순위 | 메모 |
|---|---|---|
| TypeScript 마이그레이션 | Medium | 데이터 스키마가 커지면 이득 (5단계 / 7단계 동시) |
| Vitest 유닛 테스트 | Medium | `paginateForMobile`, `buildMorphemeDock`, SRL 우선 |
| E2E 테스트 | ~~Medium~~ → 기본 완료 | ✅ 헤드리스 Puppeteer (`scripts/e2e-verify.mjs`) — 시나리오 확대는 향후 |
| Vite 빌드 | Low | 코퍼스가 커지면 청크 분할 자동화 |
| Dexie.js 도입 | Low | 자체 IndexedDB 래퍼가 한계 보일 때 |
| 한자 폰트 자동 서브셋 | Medium | 사용 한자 set → 폰트 빌드 스크립트 |
| 단일 학습자 프로필 통합 | High (cross-stage) | 1 ~ 7단계 공통 사용자 ID 체계 |

## 🎯 브랜치 전략 (예시)

```
main                          # 배포 가능한 안정 버전
├── dev                       # 통합 개발 브랜치
    ├── feat/phase-0-schemas
    ├── feat/phase-1-mvp
    ├── feat/phase-2-pagination
    ├── feat/phase-3-boss
    └── refactor/idb-wrapper
```

커밋 메시지 컨벤션 (1단계 일치): `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `data:`(코퍼스 추가)

## 📦 Cross-Stage 통합 체크리스트

| 단계 | 통합 지점 | 상태 |
|---|---|---|
| 4_morpheme_detective | 한자 마스터 DB 스키마 (출발점) | ✅ Phase 0에서 정의 — 4단계 채택은 향후 |
| 5_vocabulary_tree | 한자-어휘 파생 DB, IndexedDB 스키마 | ✅ 스키마 호환 정의 — 실제 통합은 향후 |
| 7_four-character_idiom_crossword | `SAJASUNGO_DATA` import, `bossesPassed` 게이트웨이 | ✅ 옵트인 import + 게이트웨이 노출 완료 |
| 학부모 대시보드 (Future) | 학습자 ID + 단계별 진척도 | 🟡 export/import·SRL 스키마 정합 — PIN 잠금 미구현 |

## 📝 릴리즈 노트 (예정)

### v0.1.0 — Phase 1 완료 시
- 입문 난이도 MVP, 지문 5편, 핵심 루프 작동
- 모바일 세로 모드 지원

### v0.5.0 — Phase 4 완료 시
- 입문 / 중급 / 심화 모두 지원
- 사자성어 보스 스테이지 + 7단계 게이트웨이
- 어원 풀이 + TTS + 루비 텍스트

### v1.0.0 — Phase 6 완료 시
- 학습 기록 대시보드 + SRL
- PWA 홈 화면 설치
- 다크 모드, 폰트 크기 조절
- 응용 작문 미션 (선택)

---

## 디자인 일관성 체크리스트 (홈·설정·완료 화면)

시작·설정·완료 화면 구현 전·후 아래 항목을 확인한다 (기준: `1_chosung_quiz`).

- [ ] 제목에 `font-family: 'Jua', sans-serif` 적용
- [ ] 설명·본문에 `font-family: 'Gowun Dodum', sans-serif` 적용
- [ ] `tokens.css` CSS 변수 팔레트 — 1단계 기준 색상·배경·간격 동일 적용
- [ ] 큰 라운드 버튼 스타일 (`1_chosung_quiz/src/css/components.css` 참조)
- [ ] 배경 색상 `--color-bg` 동일 사용
- [ ] 게임 완료 화면(end-screen)에도 동일 폰트·색상·버튼 스타일 적용
- [ ] 1단계 홈·설정·완료 화면과 나란히 놓고 시각적 통일감 육안 확인
