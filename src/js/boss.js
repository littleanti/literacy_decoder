// 사자성어 보스 스테이지 — 4×1 슬롯 격자 + 후보 형태소 4~6개

import { state, resetSession } from "./state.js";
import { el, clear, showScreen, toast, showModal, closeModal } from "./ui.js";
import { shuffle } from "./utils.js";
import { lookupHanja } from "../data/hanja.js";

let dom = null;
function getDOM() {
  if (dom) return dom;
  dom = {
    screen:   document.getElementById("boss-screen"),
    title:    document.getElementById("boss-title"),
    story:    document.getElementById("boss-story"),
    hint:     document.getElementById("boss-hint"),
    slots:    document.getElementById("boss-slots"),
    pool:     document.getElementById("boss-pool"),
    submitBtn:document.getElementById("boss-submit-btn"),
    resetBtn: document.getElementById("boss-reset-btn"),
    quitBtn:  document.getElementById("boss-quit-btn"),
  };
  return dom;
}

let currentIdiom = null;
let currentSlots = []; // [{ char | null }]
let onComplete = null;

export function startBoss(idiom, done) {
  currentIdiom = idiom;
  currentSlots = Array(idiom.hanja.length).fill(null);
  onComplete = done;
  state.ui.screen = "boss";
  showScreen("boss");
  const d = getDOM();
  d.title.textContent = "🐉 사자성어 보스";
  d.story.textContent = idiom.contextStory;
  d.hint.textContent = `힌트: ${idiom.hint}`;
  renderSlots();
  renderPool();
  bindBossEvents();
}

function bindBossEvents() {
  const d = getDOM();
  if (d._bound) return;
  d._bound = true;
  d.submitBtn.addEventListener("click", submitAnswer);
  d.resetBtn.addEventListener("click", () => { currentSlots = currentSlots.map(() => null); renderSlots(); renderPool(); });
  d.quitBtn.addEventListener("click", () => {
    if (confirm("보스를 포기하고 종료할까요?")) {
      onComplete && onComplete(false);
    }
  });
}

function renderSlots() {
  const d = getDOM();
  clear(d.slots);
  currentSlots.forEach((char, idx) => {
    const slot = el("button", {
      class: `boss-slot ${char ? "filled" : ""}`,
      data: { slotIdx: String(idx) },
      "aria-label": `슬롯 ${idx + 1}`,
      onclick: () => removeSlot(idx),
    });
    slot.textContent = char || "□";
    d.slots.appendChild(slot);
  });
}

function renderPool() {
  const d = getDOM();
  clear(d.pool);
  // 정답 한자 + 1~2개 의미 거리 있는 디스트랙터 (보스는 정확한 4개로도 충분히 어려움)
  const correct = currentIdiom.hanja;
  const used = new Set(currentSlots.filter(Boolean));
  const distractors = pickBossDistractors(correct, 2);
  const pool = shuffle([...correct, ...distractors]);
  for (const char of pool) {
    const info = lookupHanja(char);
    const btn = el("button", {
      class: `boss-card ${used.has(char) ? "used" : ""}`,
      "aria-label": `${info.sound} ${info.meaning}`,
      onclick: () => placeInSlot(char),
    });
    btn.appendChild(el("span", { class: "boss-card-char", text: char }));
    btn.appendChild(el("span", { class: "boss-card-sound", text: info.sound }));
    btn.appendChild(el("span", { class: "boss-card-meaning", text: info.meaning }));
    d.pool.appendChild(btn);
  }
}

function pickBossDistractors(correctChars, count) {
  // 같은 사자성어 어휘 외에서 카테고리/난이도 비슷한 한자
  // 단순화: 자주 등장하는 한자 풀 중 정답에 없는 것 무작위
  const pool = ["山","水","火","木","日","月","天","上","下","中","前","後","東","西","南","北"];
  return shuffle(pool.filter(c => !correctChars.includes(c))).slice(0, count);
}

function placeInSlot(char) {
  // 이미 사용된 경우(=정확히 하나만 슬롯에 들어가야 하는데 이미 들어감) 무시
  // 단, 사자성어에는 같은 한자가 반복될 수 있음 (예: 백발백중 百發百中) → 그래서 카운트 비교
  const expectedCount = currentIdiom.hanja.filter(c => c === char).length;
  const placedCount = currentSlots.filter(c => c === char).length;
  if (placedCount >= expectedCount && expectedCount > 0) {
    toast("이미 충분히 배치했어요");
    return;
  }
  if (placedCount >= 1 && expectedCount === 0) {
    toast("이 한자는 사용하지 않아요");
    return;
  }
  // 빈 슬롯 찾기
  const emptyIdx = currentSlots.findIndex(c => c == null);
  if (emptyIdx === -1) {
    toast("슬롯이 다 찼어요");
    return;
  }
  currentSlots[emptyIdx] = char;
  renderSlots();
  renderPool();
  // 모두 채우면 자동 제출 옵션
}

function removeSlot(idx) {
  if (!currentSlots[idx]) return;
  currentSlots[idx] = null;
  renderSlots();
  renderPool();
}

function submitAnswer() {
  if (currentSlots.some(c => c == null)) {
    toast("모든 슬롯을 채워야 해요");
    return;
  }
  const correct = currentSlots.every((c, i) => c === currentIdiom.hanja[i]);
  if (correct) celebrate();
  else explainWrong();
}

function celebrate() {
  const card = el("div", { class: "boss-result correct" });
  card.appendChild(el("div", { class: "boss-result-emoji", text: "🎉" }));
  card.appendChild(el("h3", { text: "보스 통과!" }));
  card.appendChild(el("div", { class: "boss-result-word", text: `${currentIdiom.hanja.join("")} (${currentIdiom.word})` }));
  card.appendChild(el("div", { class: "boss-result-meaning", text: currentIdiom.meaning }));
  card.appendChild(el("div", { class: "boss-result-gateway", text: "✨ 7단계 사자성어 게임에 입장할 수 있어요!" }));
  const next = el("button", { class: "btn big", text: "결과 보기 →", onclick: () => {
    closeModal(overlay);
    onComplete && onComplete(true);
  } });
  card.appendChild(next);
  const overlay = showModal(card, { dismissible: false });
}

function explainWrong() {
  const correctStr = currentIdiom.hanja.join("");
  const userStr = currentSlots.join("");
  // 단순 피드백: 자리별 ✓ / ✗ 표시
  const slots = getDOM().slots.querySelectorAll(".boss-slot");
  slots.forEach((slot, i) => {
    slot.classList.add(currentSlots[i] === currentIdiom.hanja[i] ? "ok" : "no");
  });
  toast(`아쉬워요. 다시 한 번 도전해 보세요!`, { kind: "warn" });
  setTimeout(() => slots.forEach(s => s.classList.remove("ok", "no")), 800);
}
