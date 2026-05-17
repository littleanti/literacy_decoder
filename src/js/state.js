// 전역 상태 싱글톤 — TRD §2.3 모델 그대로

export const state = {
  user: {
    id: null,           // UUID v4
    grade: 5,           // 5 | 6
    fontSize: 18,       // 16 | 18 | 22
    darkMode: false,
  },
  session: {
    corpusId: null,
    page: 0,
    blanks: [],         // [{ id, answer, filled, hintMorphemes, page, ... }]
    activeBlankId: null,
    startedAt: 0,
    pageStartedAt: 0,
    correctCount: 0,
    wrongCount: 0,
    perPagePlacedChars: [], // [{ blankId, char, ts }]
    bossPending: null,  // 사자성어 id (지문 끝나면 진입)
    inBoss: false,
    compositionAttempts: [], // [{ word, hanja, text, ok, ts }]
  },
  progress: {
    completedCorpusIds: new Set(),
    learnedHanja: new Map(),     // hanjaChar -> { exposureCount, correctCount, consecutiveCorrect, nextReview }
    learnedWords: new Map(),     // word -> { firstSeenAt, masteryLevel }
    bossesPassed: new Set(),     // idiomId
  },
  ui: {
    screen: "start",             // start | read | boss | dashboard | end
    dockExpanded: false,
    etymologyPopup: null,        // { visible, word, breakdown } | null
    overlayTooltip: null,        // long-press 한자 툴팁
  },
};

export function resetSession() {
  state.session = {
    corpusId: null,
    page: 0,
    blanks: [],
    activeBlankId: null,
    startedAt: 0,
    pageStartedAt: 0,
    correctCount: 0,
    wrongCount: 0,
    perPagePlacedChars: [],
    bossPending: null,
    inBoss: false,
    compositionAttempts: [],
  };
}

/**
 * 7단계 게이트웨이 — bossesPassed Set 노출 (7단계가 본 게임 storage를 읽거나
 * window.literacyDecoderGateway 를 통해 접근)
 */
export function getBossesPassedSet() {
  return state.progress.bossesPassed;
}

if (typeof window !== "undefined") {
  window.literacyDecoderGateway = {
    bossesPassed: () => [...state.progress.bossesPassed],
    grade: () => state.user.grade,
    version: "0.6.0",
  };
}
