// 게임 완료 화면 — 1_chosung_quiz 디자인 시스템 계승

import { state } from "./state.js";
import { el, clear, showScreen } from "./ui.js";
import { pickNextCorpus, getCorpus } from "./corpus.js";
import { showCompositionMission } from "./composition.js";

export function showEndScreen({ corpus, accuracy, elapsed, bossId, bossPassed }) {
  state.ui.screen = "end";
  showScreen("end");
  const root = document.getElementById("end-screen");
  clear(root);

  const wrap = el("div", { class: "end-screen" });
  wrap.appendChild(el("h2", { text: "🎉 학습 완료!" }));
  wrap.appendChild(el("div", { class: "celebration-emojis", text: "📖 ✨ 🌟" }));
  const acc = Math.round(accuracy * 100);
  const chars = corpus.charCount || 0;
  const minutes = (elapsed / 60000).toFixed(1);
  const charsPerMin = elapsed > 0 ? Math.round(chars / (elapsed / 60000)) : 0;

  const score = el("div", { class: "final-score" });
  score.appendChild(document.createTextNode("정답률 "));
  score.appendChild(el("span", { class: "num", text: `${acc}%` }));
  wrap.appendChild(score);

  const msg = el("div", { class: "end-message" });
  msg.appendChild(document.createTextNode(`「${corpus.title}」을 ${minutes}분 만에 읽었어요. (분당 ${charsPerMin}자)`));
  wrap.appendChild(msg);

  if (bossId) {
    const gate = el("div", { class: bossPassed ? "boss-result-banner pass" : "boss-result-banner fail" });
    gate.textContent = bossPassed
      ? `🐉 ${bossId} 보스 통과! 7단계 사자성어 게임 권한 획득.`
      : `🐉 ${bossId} 보스 도전 — 다음 기회에 다시 만나요.`;
    wrap.appendChild(gate);
  }

  const buttons = el("div", { class: "end-buttons" });
  buttons.appendChild(el("button", { class: "btn", text: "다음 지문 →", onclick: () => nextCorpus() }));
  buttons.appendChild(el("button", { class: "btn mint", text: "✍ 작문 미션 (선택)", onclick: () => {
    startCompositionFromEnd(corpus, { corpus, accuracy, elapsed, bossId, bossPassed });
  }}));
  buttons.appendChild(el("button", { class: "btn ghost", text: "시작 화면", onclick: () => {
    showScreen("start");
    state.ui.screen = "start";
  }}));
  wrap.appendChild(buttons);

  root.appendChild(wrap);
}

async function nextCorpus() {
  const meta = await pickNextCorpus({ completedSet: state.progress.completedCorpusIds });
  if (!meta) {
    showScreen("start");
    state.ui.screen = "start";
    return;
  }
  const corpus = await getCorpus(meta.id);
  const { startReading } = await import("./reading.js");
  startReading(corpus);
}

function startCompositionFromEnd(corpus, endScreenArgs) {
  showCompositionMission(corpus, state.progress.learnedWords, () => {
    // 작문 미션 완료 후 종료 화면 복귀
    showEndScreen(endScreenArgs);
  });
}
