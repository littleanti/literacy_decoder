// 응용 작문 미션 — 학습한 한자어로 짧은 문장 짓기 (키워드 매칭)

import { state } from "./state.js";
import { el, clear, showScreen, toast } from "./ui.js";

let dom = null;
function getDOM() {
  if (dom) return dom;
  dom = {
    screen: document.getElementById("composition-screen"),
  };
  return dom;
}

let currentWord = null;
let onDone = null;

/**
 * 응용 작문 미션 시작
 * @param {Object} corpus - 지문 객체
 * @param {Array<Object>} learnedWords - 학습한 단어 배열 (또는 맵)
 * @param {Function} done - 완료 콜백
 */
export function showCompositionMission(corpus, learnedWords, done) {
  // 지문 내 모든 답변 단어 수집
  const allAnswers = [];
  if (corpus.pages) {
    corpus.pages.forEach(page => {
      if (page.blanks) {
        page.blanks.forEach(blank => {
          allAnswers.push({
            word: blank.answer.word,
            hanja: blank.answer.hanja,
          });
        });
      }
    });
  }

  if (allAnswers.length === 0) {
    toast("작문할 단어가 없습니다.", { kind: "warn" });
    done && done();
    return;
  }

  // 랜덤으로 하나 선택
  currentWord = allAnswers[Math.floor(Math.random() * allAnswers.length)];
  onDone = done;

  state.ui.screen = "composition";
  showScreen("composition");
  render();
  bindEvents();
}

function render() {
  const d = getDOM();
  clear(d.screen);

  const wrap = el("div", { class: "composition-content" });

  // 제목
  wrap.appendChild(el("h2", { class: "composition-title", text: "오늘의 작문 미션" }));

  // 지시사항
  wrap.appendChild(el("p", { class: "composition-instruction", text: "다음 단어를 사용해 짧은 문장을 지어 보세요" }));

  // 목표 단어 카드
  const wordCard = el("div", { class: "composition-word-card" });
  const wordDisplay = el("div", { class: "composition-word-display" });
  wordDisplay.appendChild(el("span", { class: "composition-hangul", text: currentWord.word }));
  wordDisplay.appendChild(document.createTextNode(" "));
  wordDisplay.appendChild(el("span", { class: "composition-hanja", text: `(${currentWord.hanja})` }));
  wordCard.appendChild(wordDisplay);
  wrap.appendChild(wordCard);

  // 입력 영역
  const inputGroup = el("div", { class: "composition-input-group" });
  const textarea = el("textarea", {
    id: "composition-textarea",
    class: "composition-textarea",
    placeholder: "여기에 문장을 입력하세요. 최소 5글자 이상.",
    maxlength: "200",
  });
  inputGroup.appendChild(textarea);
  wrap.appendChild(inputGroup);

  // 글자 수 표시
  const charCount = el("div", { class: "composition-char-count", text: "0 / 200" });
  wrap.appendChild(charCount);

  // 버튼
  const buttons = el("div", { class: "composition-buttons" });
  const submitBtn = el("button", {
    class: "btn big",
    text: "제출",
    onclick: () => submitComposition(textarea, charCount),
  });
  const skipBtn = el("button", {
    class: "btn ghost",
    text: "건너뛰기",
    onclick: () => skipComposition(),
  });
  buttons.appendChild(submitBtn);
  buttons.appendChild(skipBtn);
  wrap.appendChild(buttons);

  d.screen.appendChild(wrap);

  // 글자 수 실시간 업데이트
  textarea.addEventListener("input", () => {
    charCount.textContent = `${textarea.value.length} / 200`;
  });

  // 포커스
  textarea.focus();
}

function bindEvents() {
  // 이미 render()에서 처리됨
}

function submitComposition(textarea, charCount) {
  const userText = textarea.value.trim();

  // 검증: 최소 5글자
  if (userText.length < 5) {
    toast("최소 5글자 이상 입력해 주세요.", { kind: "warn" });
    return;
  }

  // 키워드 매칭: 한글 또는 한자 포함 여부 확인
  const hasHangul = userText.includes(currentWord.word);
  const hasHanja = userText.includes(currentWord.hanja);
  const ok = hasHangul || hasHanja;

  // 시도 기록
  const attempt = {
    word: currentWord.word,
    hanja: currentWord.hanja,
    text: userText,
    ok: ok,
    ts: Date.now(),
  };
  state.session.compositionAttempts.push(attempt);

  // 결과 표시
  showResultModal(ok, userText);
}

function showResultModal(ok, userText) {
  const modal = el("div", { class: "composition-result-modal" });

  const message = el("div", { class: "composition-result-message" });
  if (ok) {
    message.appendChild(el("p", { class: "composition-result-success", text: "잘했어요! ✨" }));
    message.appendChild(el("p", { class: "composition-result-text", text: userText }));
  } else {
    message.appendChild(el("p", { class: "composition-result-try-again", text: "다시 한 번 시도해 보세요 💪" }));
    message.appendChild(el("p", { class: "composition-result-hint", text: `💡 힌트: 문장에 "${currentWord.word}" 또는 "${currentWord.hanja}"를 꼭 사용해야 해요.` }));
  }

  const button = el("button", {
    class: "btn big",
    text: ok ? "계속 →" : "다시 쓰기",
    onclick: () => {
      modal.remove();
      if (ok) {
        finishComposition();
      } else {
        document.getElementById("composition-textarea").focus();
        document.getElementById("composition-textarea").value = "";
      }
    },
  });
  message.appendChild(button);

  modal.appendChild(message);
  document.body.appendChild(modal);
}

function skipComposition() {
  if (confirm("작문을 건너뛸까요?")) {
    finishComposition();
  }
}

function finishComposition() {
  onDone && onDone();
}
