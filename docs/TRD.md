# 🔧 TRD — 문해력 해독기 (Literacy Decoder)

> Technical Requirements Document
> Last updated: 2026-04-25

## 1. 기술 스택

| 레이어 | 선택 | 근거 |
|---|---|---|
| 언어 | Vanilla JavaScript (ES2022+) | 1단계 / 7단계 컨벤션, 빌드 불필요 |
| 모듈 시스템 | ES Modules (`type="module"`) | 네이티브, 점진적 로딩 |
| CSS | Vanilla CSS + CSS Variables (디자인 토큰) | 1단계 토큰 체계 재사용 |
| 폰트 | Google Fonts (Pretendard 본문, Noto Sans CJK KR 한자) | 가독성 + 한자 서브셋 |
| 한자 폰트 | Noto Sans CJK KR **서브셋** | 8급 ~ 준4급 한자 + 사자성어 한자만 임베드 |
| 개발 서버 | `npx http-server . -p 3006 --cors -o` | 7단계 컨벤션 일치, 포트 3006 |
| 저장소 | IndexedDB (Dexie.js 또는 자체 래퍼) | 누적 학습 데이터, localStorage 한도 회피 |
| 설정 저장 | localStorage | 폰트 크기, 다크모드, 마지막 진행 위치 |
| TTS | Web Speech API | 지문 낭독, 한자 음 발음 |
| 그래프 | Vanilla SVG (대시보드용) | 의존성 최소화, 학습 곡선 단순 |

**의도적으로 제외한 것**:
- React / Vue / Svelte 프레임워크 — 1단계 / 7단계 컨벤션 일치, 학습 친화
- 빌드 도구 (Vite / Webpack) — ES Modules + 정적 서버로 충분
- TypeScript — 본 단계는 프로토타입 우선, 데이터 스키마는 JSDoc로 보강
- 외부 차트 라이브러리 — 대시보드 그래프는 SVG 직접 작성

## 2. 아키텍처

### 2.1 디렉터리 구조
```
6_literacy_decoder/
├── index.html               # 진입점, 화면 슬롯 + hidden-input (단어 채우기용)
├── package.json             # npx http-server, 포트 3006
├── src/
│   ├── css/
│   │   ├── tokens.css        # 색상, 간격, 타이포 토큰
│   │   ├── base.css          # 리셋 + 기본 타이포 (한자 폰트 fallback 포함)
│   │   ├── components.css    # 빈칸 셀, 형태소 카드, 도크, 어원 팝업
│   │   ├── screens.css       # start / read / boss / dashboard / end
│   │   └── responsive.css    # 폰 ≤600px, 태블릿 ≥768px 분기
│   ├── data/
│   │   ├── corpus/
│   │   │   ├── grade5.json   # 초5 지문 100~200편 (chunked)
│   │   │   ├── grade6.json
│   │   │   └── manifest.json # 지문 메타 (id, 학년, 글자수, 빈칸 위치)
│   │   ├── hanja.js          # 한자 마스터 DB (5단계와 호환 스키마)
│   │   └── idioms.js         # 사자성어 보스용 (7단계 SAJASUNGO_DATA 호환 import)
│   └── js/
│       ├── main.js           # 진입점 + 라우팅
│       ├── config.js         # 상수 (스토리지 키, 난이도 임계값, 페이지네이션 사이즈)
│       ├── state.js          # 전역 상태 싱글톤
│       ├── storage.js        # IndexedDB 래퍼 + localStorage 래퍼
│       ├── utils.js          # 한자 추출, 빈칸 마커 파싱, shuffle
│       ├── tts.js            # Web Speech API
│       ├── ui.js             # 화면 전환, 페이지네이션
│       ├── corpus.js         # 지문 lazy-load + 빈칸 메타 적용
│       ├── morpheme.js       # 형태소 도크 + 디스트랙터 생성
│       ├── reading.js        # 핵심 게임 루프 (지문 + 빈칸 + 채점)
│       ├── boss.js           # 사자성어 보스 스테이지
│       ├── dashboard.js      # 학습 기록 시각화 (SVG)
│       └── srl.js            # SRL 스케줄러 (5단계와 호환 가능)
├── docs/                    # 본 문서
└── AGENTS.md
```

### 2.2 모듈 의존성
```
main.js
  ├─ config.js
  ├─ state.js
  ├─ storage.js  → IndexedDB / localStorage
  ├─ corpus.js   → state, storage, hanja.js
  ├─ reading.js  → state, corpus, morpheme, tts, ui
  ├─ morpheme.js → state, hanja.js, utils
  ├─ boss.js     → state, idioms.js, reading
  ├─ srl.js      → state, storage
  └─ dashboard.js → state, storage
```

순환 의존: `reading.js` ↔ `boss.js` (보스 통과 후 reading으로 복귀). ES Module 런타임 참조이므로 안전.

### 2.3 상태 모델
```js
state = {
  user: {
    id: string,                    // UUID v4 로컬 생성
    grade: 5 | 6,
    fontSize: 16 | 18 | 22,
    darkMode: boolean,
  },
  session: {
    corpusId: string,              // 현재 지문 ID
    page: number,                  // 페이지네이션 인덱스
    blanks: Blank[],               // [{ id, answer, filled, hintMorphemes, gradeBand }]
    activeBlankId: string | null,
    startedAt: number,             // 읽기 속도 측정용 timestamp
    correctCount: number,
    wrongCount: number,
  },
  progress: {
    completedCorpusIds: Set<string>,
    learnedHanja: Map<hanjaId, { exposureCount, correctCount, nextReview }>,
    learnedWords: Map<word, { firstSeenAt, masteryLevel }>,
    bossesPassed: Set<idiomId>,    // 7단계 게이트웨이용
  },
  ui: {
    screen: 'start'|'read'|'boss'|'dashboard'|'end',
    dockExpanded: boolean,
    etymologyPopup: { visible, word, breakdown } | null,
  }
}
```

### 2.4 화면 상태 머신
```
start ──→ read ──→ (모든 빈칸 채움) ──→ boss? ──→ end
  ↑       │                              │         │
  │       └──→ dashboard (메뉴 진입)      └──→ read 다음 지문
  └──────────────────────────────────────────────────┘
```

전이 시 부작용:
- 모든 전이 → `tts.cancel()` + `clearInterval(readingTimer)`
- `read → boss`: 보스 진입 직전 어원 풀이 누적 표시
- `boss → end`: SRL 큐 업데이트 + IndexedDB flush
- `dashboard → start`: 차트 SVG cleanup

## 3. 데이터 모델

### 3.1 지문 코퍼스 스키마 (`corpus/grade5.json`)
```jsonc
{
  "version": 1,
  "corpora": [
    {
      "id": "g5-001",
      "title": "농부와 도깨비",
      "grade": 5,
      "level": "intro",          // intro | mid | advanced
      "charCount": 156,
      "estimatedReadingMs": 90000,
      "pages": [
        {
          "text": "옛날 옛적, 한 [B1]가 살았는데, 매일 [B2]에서 일했어요.",
          "blanks": [
            {
              "id": "B1",
              "answer": { "word": "농부", "hanja": "農夫" },
              "etymology": [
                { "char": "農", "sound": "농", "meaning": "농사" },
                { "char": "夫", "sound": "부", "meaning": "사내" }
              ],
              "morphemeHints": ["農", "夫", "山", "水", "火", "木"],
              "contextClues": ["일했어요", "옛날"]
            }
          ]
        }
      ],
      "boss": null               // 또는 사자성어 보스 ID 참조
    }
  ]
}
```

### 3.2 한자 마스터 DB (`data/hanja.js` — 5단계와 호환)
```js
export const HANJA = {
  "農": { sound: "농", meaning: "농사", strokes: 13, grade: "준4급" },
  "夫": { sound: "부", meaning: "사내", strokes: 4, grade: "7급" },
  // ...
};
```

### 3.3 사자성어 데이터 (`data/idioms.js` — 7단계 호환)
```js
// 7단계 data.js의 SAJASUNGO_DATA 형식 그대로 import 가능하도록 호환
import { SAJASUNGO_DATA } from "../../../7_four-character_idiom_crossword/data.js";

// 보스 스테이지용 추가 메타
export const BOSS_IDIOMS = SAJASUNGO_DATA.map(item => ({
  ...item,                      // word, meaning, hint
  hanja: ["東", "問", "西", "答"], // 형태소 분해
  contextStory: "철수가 ... 영희가 ..."
}));
```

### 3.4 IndexedDB 스키마 (5단계와 호환 가능)
```js
db.version(1).stores({
  users: "id, grade, createdAt",
  progress: "[userId+corpusId], userId, completedAt, accuracy",
  hanjaMastery: "[userId+hanja], userId, exposureCount, nextReview",
  bossPassed: "[userId+idiomId], userId, passedAt",  // 7단계 게이트웨이
  sessions: "++id, userId, startedAt, charsRead, accuracy"
});
```

## 4. 핵심 알고리즘

### 4.1 빈칸 추출 (저작 시)
지문 작성자가 마커 문법으로 빈칸 지정:
```
원문: 옛날 옛적, 한 {{농부:農夫}}가 살았는데...
빌드: build-corpus.js 가 마커를 [B1] 토큰으로 치환 + JSON 메타 생성
```
런타임에서는 이미 토큰화된 JSON만 로드 (성능).

### 4.2 디스트랙터 형태소 생성
```js
function buildMorphemeDock(blank, learnedHanja) {
  const correct = blank.answer.hanja.split("");                // 정답 형태소
  const distractors = sampleDistractors({
    pool: learnedHanja,                                        // 5단계까지 학습한 한자만
    excludeSet: new Set(correct),
    count: 6 - correct.length,
    weighting: "byContextSimilarity"                           // 의미 카테고리 인접 우선
  });
  return shuffle([...correct, ...distractors]);
}
```

**디스트랙터 원칙**:
- 학습자가 모르는 한자는 절대 등장 금지 (좌절 방지)
- 시각적으로 비슷한 한자 (`日` vs `白`) 한 번에 둘 다 출현 금지
- 의미 카테고리 같은 한자 1 ~ 2개 포함 (난이도 조절)

### 4.3 페이지네이션 (모바일)
```js
// 기준 1: 폰의 경우 빈칸 단위 분할 — 빈칸이 항상 화면 상단 절반에 위치
function paginateForMobile(corpus) {
  const pages = [];
  let buffer = "";
  let pageBlanks = [];
  for (const segment of corpus.segments) {
    if (segment.type === "blank") {
      if (pageBlanks.length >= 1 && buffer.length > 200) {     // 폰 1페이지 한도
        pages.push({ text: buffer, blanks: pageBlanks });
        buffer = ""; pageBlanks = [];
      }
      pageBlanks.push(segment.blank);
    }
    buffer += segment.text;
  }
  if (buffer) pages.push({ text: buffer, blanks: pageBlanks });
  return pages;
}
```

### 4.4 채점 + 어원 풀이
```js
function checkAnswer(blank, droppedMorphemes) {
  const userWord = droppedMorphemes.map(m => m.char).join("");
  if (userWord === blank.answer.hanja) {
    showEtymology(blank.answer.etymology);                     // 형태소 분해 팝업
    state.session.correctCount++;
    srl.recordSuccess(blank.answer.hanja);
    return "correct";
  }
  // 부분 정답: 형태소 단위 피드백
  const feedback = blank.answer.hanja.split("").map((expected, i) => ({
    expected, got: droppedMorphemes[i]?.char,
    match: droppedMorphemes[i]?.char === expected
  }));
  showMorphemeFeedback(feedback);
  state.session.wrongCount++;
  srl.recordFailure(blank.answer.hanja);
  return "wrong";
}
```

### 4.5 사자성어 보스 스테이지
```js
function startBoss(idiom) {
  const morphemes = shuffle(idiom.hanja);                      // 4개 형태소
  // 학습자는 4개의 슬롯에 배치, 순서까지 일치해야 정답
  // 정답 시 7단계 게이트웨이 플래그 set: bossPassed[idiom.id] = true
}
```

### 4.6 SRL 스케줄러 (5단계와 호환)
```js
// 에빙하우스 망각 곡선 기반: 1일, 3일, 7일, 14일, 30일
const REVIEW_INTERVALS_MS = [1, 3, 7, 14, 30].map(d => d * 86400000);

function nextReview(mastery) {
  const idx = Math.min(mastery.consecutiveCorrect, REVIEW_INTERVALS_MS.length - 1);
  return Date.now() + REVIEW_INTERVALS_MS[idx];
}
```

## 5. 외부 API

### 5.1 Web Speech API (TTS)
```js
function readPassage(text) {
  if (!('speechSynthesis' in window)) return;                  // 미지원 graceful
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = 0.9; u.pitch = 1.0;
  u.voice = pickKoVoice();                                     // ko-KR > ko* > default
  speechSynthesis.speak(u);
}
```

**자동재생 정책**: 사용자가 명시적으로 🔊 버튼 탭 시에만 재생 (모바일 정책 준수).

### 5.2 IndexedDB
```js
try {
  await db.progress.put({ userId, corpusId, completedAt: Date.now(), accuracy });
} catch (e) {
  // private browsing 또는 storage quota 초과 시 메모리 폴백
  fallbackProgress.push({ userId, corpusId, completedAt: Date.now() });
}
```

## 6. 렌더링 전략

### 6.1 한자 루비 텍스트
```html
<ruby>農夫<rt>농부</rt></ruby>
```
- 정답 공개 후에만 ruby 노출 (학습 전에는 빈칸)
- 학습자가 한자 위 길게 누르기(long-press) 시 음·뜻 툴팁

### 6.2 빈칸 셀
```html
<span class="blank" data-blank-id="B1" tabindex="0">
  <span class="blank-char">□</span>
  <span class="blank-char">□</span>
</span>
```
- 활성화 시 `aria-current="true"` + 펄스 애니메이션
- 도크에서 형태소 카드 드래그 → drop 영역 ±20dp 자성 스냅

### 6.3 형태소 도크 (모바일 sticky)
```css
.morpheme-dock {
  position: sticky; bottom: 0; left: 0; right: 0;
  height: 96px;                  /* 기본 */
  height: 200px;                 /* 빈칸 활성 시 확장 */
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory;
}
```

### 6.4 무한 스크롤 / 가상화
힌트 풀이 누적 어휘로 100+ 형태소가 되어도, 보이는 가시영역 + 좌우 1화면 분만 DOM 렌더 (IntersectionObserver).

## 7. 성능 고려사항

| 영역 | 최적화 |
|---|---|
| 초기 로드 | 진입 시 학년별 manifest.json만 로드, 지문 본문은 lazy |
| 폰트 | Noto Sans CJK KR을 본 게임 사용 한자만 서브셋 (실제 < 200KB 목표) |
| TTS | speechSynthesis 인스턴스 재사용, voiceschanged 1회 캐싱 |
| 애니메이션 | `transform`/`opacity`만 사용 (compositor layer) |
| IndexedDB | 트랜잭션 batch (페이지 단위 1회 commit) |
| 어원 팝업 | 정답 시점까지 lazy fetch (라우트 prefetch 금지) |
| 가상 스크롤 | 도크 형태소가 50개 이상일 때 활성화 |

## 8. 테스트 전략

### 8.1 수동 테스트 체크리스트

**핵심 루프**
- [ ] 입문 지문 (100자, 빈칸 1) 진입 → 정답 도달 → 어원 팝업 표시
- [ ] 중급 지문 (300자, 빈칸 2) 페이지네이션 → 모든 빈칸 채움 → 다음 지문
- [ ] 심화 지문 (800자, 빈칸 4 + 보스) → 보스 통과 → 7단계 게이트웨이 플래그 set

**오답 / 엣지 케이스**
- [ ] 형태소 카드 드롭 위치 빗나감 (±20dp 밖) → 카드 원위치
- [ ] 정답 형태소 + 디스트랙터 1개 조합 → 부분 정답 피드백
- [ ] 빈칸 활성 상태에서 다른 빈칸 탭 → 컨텍스트 전환
- [ ] 학습한 적 없는 한자가 디스트랙터에 등장 → 알고리즘 버그 (절대 발생 금지)

**모바일 / 반응형**
- [ ] 폰 (375×667) 세로 — 지문 상단 50%, 도크 하단 sticky
- [ ] 폰 (375×667) 가로 — 회전 시 강제 세로 토스트
- [ ] 태블릿 (768×1024) — 좌측 지문 65%, 우측 도크 35% 분할
- [ ] iOS Safari 100dvh — 주소창 변동 시 도크 가려지지 않음
- [ ] Samsung Galaxy Chrome — 한자 폰트 폴백 정상

**접근성 / 가독성**
- [ ] 폰트 크기 16/18/22px 전환 → 빈칸 셀 폭 자동 재계산
- [ ] 다크 모드 — 한자 가독성, 빈칸 색 대비 WCAG AA
- [ ] TTS 미지원 브라우저 → 🔊 버튼 비활성화 + 힌트 툴팁
- [ ] 한자 long-press → 음·뜻 툴팁 (모바일)

**영속화**
- [ ] IndexedDB 정상 저장 후 새로고침 → 진척도 유지
- [ ] private browsing → 메모리 폴백 동작, 게임 자체는 정상
- [ ] localStorage 폰트 / 다크모드 설정 유지
- [ ] 5단계 게임의 한자 마스터 데이터와 스키마 호환 (수동 import 검증)

**7단계 통합**
- [ ] 보스 스테이지 통과 → 7단계 게임에서 해당 사자성어 정답률 향상 (대조군 비교)
- [ ] `idioms.js`가 7단계 `data.js`의 `SAJASUNGO_DATA`를 직접 import 가능

### 8.2 자동화 (추후)
- Vitest + jsdom: `paginateForMobile`, `buildMorphemeDock`, `nextReview` 유닛
- Playwright: S1 / S2 시나리오 E2E (모바일 에뮬레이션)
- Lighthouse: 모바일 PWA 점수 90+ 목표

## 9. 보안

- 사용자 입력은 응용 작문 미션 (P2)에서만 발생 — `textContent` 사용 필수, `innerHTML` 금지
- 지문 / 형태소 / 사자성어는 정적 데이터 → XSS 표면 작음
- IndexedDB 데이터는 학습자 ID(UUID v4)로만 식별, 외부 송신 없음
- 학부모 대시보드 (Future) PIN 잠금 — localStorage 저장 시 SHA-256 해시

## 10. 배포

정적 파일이므로 어디든 호스팅 가능 (1단계 컨벤션):

| 옵션 | 명령 |
|---|---|
| GitHub Pages | `gh-pages` 브랜치 푸시 |
| Netlify | `netlify deploy --dir=.` |
| Vercel | `vercel --prod` |
| Cloudflare Pages | 드래그 앤 드롭 |
| 자체 호스팅 | `npx http-server . -p 3006` |

빌드 단계 불필요 — 루트 디렉터리 그대로 업로드. 서비스워커 도입 시 `sw.js` 캐시 버전 갱신만 주의.

## 11. 홈·설정·완료 화면 디자인 시스템

시작 화면(`start-screen`), 설정 화면, 게임 완료 화면(`end-screen`)은 `1_chosung_quiz` 의 디자인 시스템을 계승한다. 아래 수치는 `1_chosung_quiz/src/css/screens.css` · `components.css` 의 실제 값이다.

### 폰트

| 요소 | 규격 |
|---|---|
| 폰트 로드 | `<link>` Google Fonts — `Jua`, `Gowun Dodum` (1단계와 동일) |
| 시작·완료 화면 제목 | `font-family: 'Jua', sans-serif` |
| 시작 화면 제목 크기 | `font-size: 3rem; letter-spacing: 2px; color: var(--coral)` |
| 설정 화면 제목 크기 | `font-size: 1.8rem; color: var(--coral)` |
| 완료 화면 제목 크기 | `font-size: 2.1rem; color: var(--coral)` |
| 설명·부제목·본문 | `font-family: 'Gowun Dodum', sans-serif; font-size: clamp(0.9rem, 3vw, 1.2rem)` |
| 섹션 레이블 (설정) | `font-family: 'Jua', sans-serif; font-size: 1.05rem` |

### 버튼

| 요소 | 규격 |
|---|---|
| 버튼 레이블 폰트 | `font-family: 'Jua', sans-serif; letter-spacing: 0.5px` |
| 버튼 기본 (`.btn`) | `font-size: 1.2rem; padding: 14px 28px; border-radius: 100px` |
| 버튼 대형 (`.btn.big`) | `font-size: 1.45rem; padding: 16px 44px; border-radius: 100px` |
| 버튼 소형 (`.btn.small`) | `font-size: 1rem; padding: 10px 20px; border-radius: 100px` |
| 버튼 기본 색상 | `background: var(--coral); color: #fff; box-shadow: 0 5px 0 var(--coral-dark)` |
| 버튼 눌림 효과 | `transform: translateY(4px); box-shadow: 0 1px 0 var(--coral-dark)` |

### 색상·레이아웃

| 요소 | 규격 |
|---|---|
| 색상 변수 출처 | `1_chosung_quiz/src/css/tokens.css` (`--coral #FF7757`, `--navy #2D3047`, `--cream #FFF6E4`, `--mint #6BCAB8`, `--yellow #FFD166`) |
| 배경 | `background: var(--cream)` (`#FFF6E4`) |
| 레이아웃 | 수직 중앙 정렬, 카드형 컨테이너 (`start-screen`, `end-screen`) |

> 지문 읽기 화면·대시보드 등 게임 고유 화면은 이 게임 특성에 맞게 확장 가능하다.  
> 시작·설정·완료 화면만 위 규격을 의무 준수한다.
