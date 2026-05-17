// 공통 유틸 — 한자 추출, 빈칸 마커 파싱, shuffle, UUID 등

const HANJA_RE = /\p{Script=Han}/u;

export function isHanja(ch) {
  return HANJA_RE.test(ch);
}

export function extractHanja(text) {
  if (!text) return [];
  return [...text].filter(isHanja);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // RFC 4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * `[B1] 텍스트 [B2]` 형태의 페이지 텍스트를 segments 로 분해
 * segments: [{ type:'text', text }, { type:'blank', blankId }]
 */
export function parsePageText(text) {
  const segs = [];
  const re = /\[(B\d+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", text: text.slice(last, m.index) });
    segs.push({ type: "blank", blankId: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ type: "text", text: text.slice(last) });
  return segs;
}

/**
 * `{{단어:漢字}}` 마커 문법을 [B1] 토큰 + blank 메타로 변환 (저작 도구용).
 * 코퍼스 빌드 시 한 번 호출, 런타임은 이미 토큰화된 JSON만 로드한다.
 */
export function buildCorpusMarkers(rawText, etymologyLookup = {}, startIdx = 1) {
  const blanks = [];
  let idx = startIdx;
  const text = rawText.replace(/\{\{([^:]+):([^}]+)\}\}/g, (_, word, hanja) => {
    const id = `B${idx++}`;
    const etymology = [...hanja].map(ch => etymologyLookup[ch] || { char: ch, sound: "?", meaning: "?" });
    blanks.push({ id, answer: { word, hanja }, etymology, morphemeHints: [...hanja], contextClues: [] });
    return `[${id}]`;
  });
  return { text, blanks };
}

/**
 * 안전 textContent — XSS 방지를 위해 어디서나 innerHTML 대신 사용
 */
export function setText(el, text) {
  el.textContent = text;
}

/**
 * 음·뜻 라벨 한 줄 (예: "농(農: 농사)")
 */
export function formatMorpheme(char, sound, meaning) {
  return `${sound}(${char}: ${meaning})`;
}
