// 형태소 도크 — 카드 렌더링, 디스트랙터 생성, 드래그/탭 인터랙션.

import { HANJA, getHanjaByCategory, lookupHanja } from "../data/hanja.js";
import { shuffle, formatMorpheme } from "./utils.js";
import { DOCK_DISTRACTOR_TOTAL } from "./config.js";

/**
 * 빈칸의 정답 + 디스트랙터로 도크 후보 카드 배열을 생성.
 * - 학습자가 모르는 한자(이 게임의 HANJA DB에 없는 것)는 distractor 에서 제외
 * - 정답 형태소는 etymology 의 sound/meaning 우선 사용 (DB fallback)
 * - 의미 카테고리 인접 distractor 1~2개 가중
 */
export function buildMorphemeDock(blank, learnedSet = null) {
  const correctChars = blank.answer.hanja.split("");
  const etymologyMap = new Map(blank.etymology.map(e => [e.char, e]));

  // 정답 카드
  const correctCards = correctChars.map(char => {
    const e = etymologyMap.get(char) || {};
    const h = HANJA[char] || {};
    return {
      char,
      sound: e.sound || h.sound || "?",
      meaning: e.meaning || h.meaning || "?",
      isCorrect: true,
      cardId: `c-${char}-${Math.random().toString(36).slice(2, 7)}`,
    };
  });

  // 디스트랙터 풀 — corpus의 morphemeHints 에서 정답 외의 것 + 의미 카테고리 인접
  const exclude = new Set(correctChars);
  const hintPool = (blank.morphemeHints || [])
    .filter(c => !exclude.has(c) && HANJA[c]);
  // 의미 카테고리 인접 한자 (정답 첫 글자 기준)
  const firstCat = HANJA[correctChars[0]]?.category;
  const catNeighbors = firstCat ? getHanjaByCategory(firstCat, exclude).map(h => h.char) : [];

  // 시각적 유사 한자 회피 셋 (간단히 같은 첫 획수 또는 같은 카테고리 + 한 글자 차이 — 본 게임은 단순화)
  const distractorChars = [];
  const seen = new Set();
  for (const c of [...hintPool, ...catNeighbors]) {
    if (seen.has(c)) continue;
    seen.add(c);
    distractorChars.push(c);
    if (distractorChars.length >= DOCK_DISTRACTOR_TOTAL - correctChars.length) break;
  }

  // 부족하면 학년 풀에서 보충 (없으면 무시)
  if (learnedSet) {
    for (const c of learnedSet) {
      if (distractorChars.length >= DOCK_DISTRACTOR_TOTAL - correctChars.length) break;
      if (seen.has(c) || exclude.has(c)) continue;
      seen.add(c);
      distractorChars.push(c);
    }
  }

  const distractorCards = distractorChars.map(char => {
    const h = lookupHanja(char);
    return {
      char,
      sound: h.sound,
      meaning: h.meaning,
      isCorrect: false,
      cardId: `c-${char}-${Math.random().toString(36).slice(2, 7)}`,
    };
  });

  return shuffle([...correctCards, ...distractorCards]);
}

/**
 * 입문 난이도: 음·뜻 모두 표시.
 * 중급: 음만.
 * 심화: 형태소만.
 */
export function cardLabel(card, level) {
  if (level === "advanced") return card.char;
  if (level === "mid")      return `${card.char}\n${card.sound}`;
  return `${card.char}\n${card.sound}\n${card.meaning}`;
}

export function formatEtymologyLine(etyEntry) {
  return formatMorpheme(etyEntry.char, etyEntry.sound, etyEntry.meaning);
}
