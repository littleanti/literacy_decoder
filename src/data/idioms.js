// 사자성어 보스 데이터
// 7단계(`7_four-character_idiom_crossword/data.js`)의 SAJASUNGO_DATA 와 동일 형식 (word, meaning, hint).
// 본 게임은 보스 스테이지용으로 추가 메타(hanja, contextStory)를 합성한다.
//
// 7단계가 진실의 근원 — 신규 사자성어가 늘어나면 7단계 data.js를 업데이트하고
// 본 파일의 BOSS_META 매핑만 보강하면 된다.

// 기본은 embedded fallback. 7단계가 같은 사이트로 함께 배포된 경우
// `?seventh-stage=1` 쿼리 파라미터로 원본 데이터를 옵트인 import 한다.
// (현재 7단계 data.js 는 `export` 없이 전역 const 만 정의하므로 globalThis 도 함께 확인)
const EMBEDDED_FALLBACK = [
  { word: "일석이조", meaning: "두 가지 이득",       hint: "돌 하나로 새 두 마리를 잡아요" },
  { word: "이심전심", meaning: "마음이 통함",         hint: "말하지 않아도 서로 마음이 통해요" },
  { word: "동문서답", meaning: "엉뚱한 대답",         hint: "동쪽을 물었는데 서쪽으로 대답해요" },
  { word: "오리무중", meaning: "갈피를 못 잡음",      hint: "짙은 안개 속에서 길을 잃었어요" },
  { word: "일취월장", meaning: "날로 발전함",         hint: "날마다 달마다 실력이 쑥쑥 자라요" },
  { word: "청출어람", meaning: "제자가 스승보다 나음", hint: "쪽빛이 남빛보다 더 파래요" },
  { word: "천고마비", meaning: "가을 하늘과 살찐 말", hint: "하늘은 높고 말은 살이 쪄요" },
  { word: "화룡점정", meaning: "마지막 마무리",       hint: "용 그림에 눈동자를 찍어 완성해요" },
  { word: "대기만성", meaning: "늦게 이루는 큰 인물", hint: "큰 그릇은 오래 걸려야 만들어져요" },
  { word: "백발백중", meaning: "항상 맞힘",           hint: "백 번 쏘면 백 번 다 맞혀요" },
];

let SAJASUNGO_DATA = EMBEDDED_FALLBACK;

try {
  const url = new URL(globalThis.location?.href || "http://_/");
  if (url.searchParams.get("seventh-stage") === "1") {
    const mod = await import("../../../7_four-character_idiom_crossword/data.js");
    if (Array.isArray(mod?.SAJASUNGO_DATA) && mod.SAJASUNGO_DATA.length > 0) {
      SAJASUNGO_DATA = mod.SAJASUNGO_DATA;
    } else if (Array.isArray(globalThis.SAJASUNGO_DATA) && globalThis.SAJASUNGO_DATA.length > 0) {
      SAJASUNGO_DATA = globalThis.SAJASUNGO_DATA;
    }
  }
} catch (_err) {
  // 인접 디렉터리 부재 / 네트워크 오류 등 — fallback 사용
}

export { SAJASUNGO_DATA };

/**
 * 보스 스테이지에 사용할 사자성어 메타.
 * - hanja: 4글자 한자 (순서 매칭 정답)
 * - contextStory: 사자성어 의미를 유도하는 짧은 일화
 * - id: 7단계 게이트웨이에서 참조할 안정 키
 */
export const BOSS_META = {
  "일석이조": {
    hanja: ["一", "石", "二", "鳥"],
    contextStory: "철수가 빨래를 널다가 떨어진 사과를 주웠어요. 마침 강아지가 그 사과 옆 공도 물어 왔답니다. 한 번에 두 가지 좋은 일이 생긴 거예요.",
  },
  "이심전심": {
    hanja: ["以", "心", "傳", "心"],
    // 以 한자가 아직 DB에 없으므로 더 흔한 변형으로 대체할 수 있음 — 보스 스테이지는 hanja DB에 존재하는 글자만 사용
    contextStory: "엄마와 딸이 동시에 같은 노래를 흥얼거렸어요. 말하지 않아도 마음이 통한 거랍니다.",
  },
  "동문서답": {
    hanja: ["東", "問", "西", "答"],
    contextStory: "철수가 영희에게 '오늘 점심 뭐 먹을래?'라고 물었더니, 영희는 '내일 비가 올 것 같아'라고 답했어요. 동쪽을 물었는데 엉뚱하게 서쪽을 대답한 셈이지요.",
  },
  "오리무중": {
    hanja: ["五", "里", "霧", "中"],
    contextStory: "산에서 길을 잃은 등산객은 사방이 짙은 안개로 가득해 어디로 가야 할지 알 수 없었어요.",
  },
  "일취월장": {
    hanja: ["日", "就", "月", "將"],
    contextStory: "민지는 매일 한 문제씩 푸는 습관을 들였더니, 한 달이 지나자 또래 친구들이 깜짝 놀랄 만큼 실력이 자랐어요.",
  },
  "청출어람": {
    hanja: ["靑", "出", "於", "藍"],
    contextStory: "스승이 가르친 제자가, 어느덧 스승보다 더 깊은 색을 내는 그림을 그리게 되었어요.",
  },
  "천고마비": {
    hanja: ["天", "高", "馬", "肥"],
    contextStory: "가을이 깊어지자 하늘은 한층 더 높아 보이고, 풀을 마음껏 먹은 말은 통통하게 살이 올랐어요.",
  },
  "화룡점정": {
    hanja: ["畵", "龍", "點", "睛"],
    contextStory: "화가가 용을 다 그린 뒤 마지막으로 눈동자를 찍자, 그림 속 용이 살아 움직이는 듯했어요.",
  },
  "대기만성": {
    hanja: ["大", "器", "晚", "成"],
    contextStory: "오래 빚은 큰 항아리는 시간이 더디지만, 마침내 단단하고 멋진 형태로 완성되었어요.",
  },
  "백발백중": {
    hanja: ["百", "發", "百", "中"],
    contextStory: "활쏘기 명수는 백 번을 쏘아도 백 번 모두 과녁 한가운데를 정확히 맞혔답니다.",
  },
};

/**
 * BOSS_IDIOMS — SAJASUNGO_DATA + BOSS_META 합성.
 * BOSS_META 가 정의된 사자성어만 보스 스테이지에 사용 가능.
 */
export const BOSS_IDIOMS = SAJASUNGO_DATA
  .filter(it => BOSS_META[it.word])
  .map(it => ({
    id: it.word,
    word: it.word,
    meaning: it.meaning,
    hint: it.hint,
    hanja: BOSS_META[it.word].hanja,
    contextStory: BOSS_META[it.word].contextStory,
  }));

/**
 * 사자성어 id로 보스 데이터 조회
 */
export function lookupBoss(id) {
  return BOSS_IDIOMS.find(b => b.id === id) || null;
}
