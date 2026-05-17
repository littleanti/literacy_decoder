// Web Speech API — 지문 낭독 + 한자 음 발음. 사용자 인터랙션 후에만 호출.

let voiceCache = null;

function pickKoVoice() {
  if (!("speechSynthesis" in globalThis)) return null;
  if (!voiceCache) {
    const all = speechSynthesis.getVoices();
    voiceCache =
      all.find(v => v.lang === "ko-KR") ||
      all.find(v => v.lang?.startsWith("ko")) ||
      all[0] || null;
  }
  return voiceCache;
}

if ("speechSynthesis" in globalThis) {
  // voices 캐시 — voiceschanged 한 번만
  speechSynthesis.onvoiceschanged = () => { voiceCache = null; pickKoVoice(); };
}

export function isSupported() {
  return "speechSynthesis" in globalThis && typeof SpeechSynthesisUtterance !== "undefined";
}

export function cancelAll() {
  if (!isSupported()) return;
  try { speechSynthesis.cancel(); } catch { /* noop */ }
}

export function speakPassage(text, opts = {}) {
  if (!isSupported() || !text) return;
  cancelAll();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = opts.rate ?? 0.92;
  u.pitch = opts.pitch ?? 1.0;
  const v = pickKoVoice();
  if (v) u.voice = v;
  try { speechSynthesis.speak(u); } catch { /* noop */ }
}

export function speakWord(word, opts = {}) {
  if (!isSupported() || !word) return;
  cancelAll();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = opts.lang || "ko-KR";
  u.rate = opts.rate ?? 0.9;
  const v = pickKoVoice();
  if (v) u.voice = v;
  try { speechSynthesis.speak(u); } catch { /* noop */ }
}
