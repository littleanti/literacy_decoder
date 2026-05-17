// 핵심 게임 루프 — 지문 + 빈칸 + 채점 + 어원 풀이

import { state, resetSession } from "./state.js";
import { el, clear, showScreen, toast, showModal, closeModal } from "./ui.js";
import { parsePageText, shuffle } from "./utils.js";
import { buildMorphemeDock, cardLabel } from "./morpheme.js";
import { saveProgress, saveSession, saveHanjaMastery, getHanjaMastery, markBossPassed } from "./storage.js";
import { SRL_INTERVALS_MS } from "./config.js";
import { lookupBoss } from "../data/idioms.js";
import { startBoss } from "./boss.js";
import { speakPassage, speakWord } from "./tts.js";
import { showEndScreen } from "./end.js";

// DOM refs (lazy)
let dom = null;
function getDOM() {
  if (dom) return dom;
  dom = {
    screen:       document.getElementById("read-screen"),
    title:        document.getElementById("read-title"),
    progressText: document.getElementById("read-progress-text"),
    progressFill: document.getElementById("read-progress-fill"),
    pageBody:     document.getElementById("read-page-body"),
    pageIndicator:document.getElementById("read-page-indicator"),
    prevBtn:      document.getElementById("read-prev-btn"),
    nextBtn:      document.getElementById("read-next-btn"),
    quitBtn:      document.getElementById("read-quit-btn"),
    ttsBtn:       document.getElementById("read-tts-btn"),
    dock:         document.getElementById("morpheme-dock"),
    dockCards:    document.getElementById("morpheme-dock-cards"),
  };
  return dom;
}

export async function startReading(corpus) {
  resetSession();
  state.session.corpusId = corpus.id;
  state.session.startedAt = Date.now();
  state.session.pageStartedAt = Date.now();
  state.session.bossPending = corpus.boss || null;
  state.ui.screen = "read";

  // 모든 페이지의 빈칸을 단일 리스트로 (각 빈칸에 page 인덱스 부여)
  state.session.blanks = [];
  corpus.pages.forEach((p, pageIdx) => {
    (p.blanks || []).forEach(b => state.session.blanks.push({ ...b, page: pageIdx, filled: false, placedChars: [] }));
  });

  state.corpus = corpus;
  showScreen("read");
  bindReadingEvents();
  renderPage(0);
}

function bindReadingEvents() {
  const d = getDOM();
  if (d._bound) return;
  d._bound = true;
  d.quitBtn.addEventListener("click", () => {
    if (confirm("정말 종료할까요? 진행도는 자동 저장됩니다.")) endReadingEarly();
  });
  d.prevBtn.addEventListener("click", () => navigatePage(state.session.page - 1));
  d.nextBtn.addEventListener("click", () => navigatePage(state.session.page + 1));
  d.ttsBtn.addEventListener("click", () => {
    const corpus = state.corpus;
    const text = corpus.pages[state.session.page].text.replace(/\[(B\d+)\]/g, "음음");
    speakPassage(text);
  });
  // 키보드 좌우 화살표 (PC)
  document.addEventListener("keydown", (ev) => {
    if (state.ui.screen !== "read") return;
    if (ev.key === "ArrowLeft")  navigatePage(state.session.page - 1);
    if (ev.key === "ArrowRight") navigatePage(state.session.page + 1);
  });
  // 모바일 좌우 스와이프
  let touchStartX = null;
  d.pageBody.addEventListener("touchstart", (ev) => {
    if (ev.touches.length !== 1) return;
    touchStartX = ev.touches[0].clientX;
  }, { passive: true });
  d.pageBody.addEventListener("touchend", (ev) => {
    if (touchStartX == null) return;
    const dx = (ev.changedTouches[0].clientX) - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 50) return;
    if (dx > 0) navigatePage(state.session.page - 1);
    else navigatePage(state.session.page + 1);
  });
}

function navigatePage(newIdx) {
  const corpus = state.corpus;
  if (!corpus) return;
  if (newIdx < 0 || newIdx >= corpus.pages.length) return;
  // 현재 페이지의 모든 빈칸이 채워졌는지 검증 (단, 페이지를 미리 보기 위한 prev는 허용)
  if (newIdx > state.session.page) {
    const blanksOnPage = state.session.blanks.filter(b => b.page === state.session.page);
    if (blanksOnPage.some(b => !b.filled)) {
      toast("빈칸을 모두 채워야 다음 페이지로 갈 수 있어요!");
      return;
    }
  }
  renderPage(newIdx);
}

function renderPage(pageIdx) {
  const d = getDOM();
  const corpus = state.corpus;
  const page = corpus.pages[pageIdx];
  state.session.page = pageIdx;
  state.session.pageStartedAt = Date.now();
  state.session.activeBlankId = null;

  d.title.textContent = corpus.title;
  d.pageIndicator.textContent = `${pageIdx + 1} / ${corpus.pages.length}`;
  const totalBlanks = state.session.blanks.length;
  const filledBlanks = state.session.blanks.filter(b => b.filled).length;
  d.progressText.textContent = `빈칸 ${filledBlanks} / ${totalBlanks}`;
  d.progressFill.style.width = `${totalBlanks ? Math.round(100 * filledBlanks / totalBlanks) : 0}%`;
  d.prevBtn.disabled = pageIdx === 0;
  d.nextBtn.textContent = (pageIdx === corpus.pages.length - 1) ? "마무리 →" : "다음 →";

  // 본문 렌더 (textContent 안전)
  clear(d.pageBody);
  const segs = parsePageText(page.text);
  const blankRefs = new Map(state.session.blanks.map(b => [b.id, b]));

  for (const seg of segs) {
    if (seg.type === "text") {
      d.pageBody.appendChild(document.createTextNode(seg.text));
    } else {
      const blank = blankRefs.get(seg.blankId);
      if (!blank) continue;
      const span = el("span", {
        class: `blank ${blank.filled ? "filled" : ""}`,
        data: { blankId: blank.id },
        tabindex: "0",
        role: "button",
        "aria-label": `빈칸 ${blank.id}`,
        onclick: () => activateBlank(blank.id),
      });
      renderBlankContents(span, blank);
      d.pageBody.appendChild(span);
    }
  }

  // 첫 번째 미완료 빈칸 자동 활성화
  const firstUnfilled = state.session.blanks.find(b => b.page === pageIdx && !b.filled);
  if (firstUnfilled) activateBlank(firstUnfilled.id);
  else renderDock(null);

  // 마지막 페이지 + 모두 채워짐 → 보스 또는 종료
  if (pageIdx === corpus.pages.length - 1) maybeFinish();
}

function renderBlankContents(span, blank) {
  clear(span);
  const chars = blank.answer.hanja.length;
  if (blank.filled) {
    // 정답: 단어 + 루비
    const word = blank.answer.word;
    const wordChars = [...word];
    const hanjaChars = [...blank.answer.hanja];
    for (let i = 0; i < wordChars.length; i++) {
      const ruby = el("ruby");
      ruby.appendChild(document.createTextNode(hanjaChars[i] || wordChars[i]));
      const rt = el("rt", { text: wordChars[i] });
      ruby.appendChild(rt);
      span.appendChild(ruby);
    }
    span.classList.add("filled");
    span.classList.remove("active");
    return;
  }
  // 미완료: □ × N
  for (let i = 0; i < chars; i++) {
    const slot = el("span", { class: "blank-char", data: { slot: String(i), blankId: blank.id } });
    const placed = blank.placedChars[i];
    if (placed) slot.textContent = placed;
    else slot.textContent = "□";
    span.appendChild(slot);
  }
  if (blank.id === state.session.activeBlankId) span.classList.add("active");
}

function activateBlank(blankId) {
  const blank = state.session.blanks.find(b => b.id === blankId);
  if (!blank || blank.filled) return;
  state.session.activeBlankId = blankId;
  // 활성 빈칸 시각 갱신
  document.querySelectorAll(".blank").forEach(el => {
    el.classList.toggle("active", el.dataset.blankId === blankId);
  });
  renderDock(blank);
}

function renderDock(blank) {
  const d = getDOM();
  clear(d.dockCards);
  if (!blank) {
    d.dock.classList.remove("expanded");
    return;
  }
  d.dock.classList.add("expanded");

  const cards = buildMorphemeDock(blank);
  const level = state.corpus.level || "intro";

  for (const card of cards) {
    const labelText = cardLabel(card, level);
    const btn = el("button", {
      class: "morpheme-card",
      data: { char: card.char, cardId: card.cardId },
      draggable: "true",
      "aria-label": `${card.sound} ${card.meaning}`,
    });
    // 카드 텍스트 구조: 한자 (큰), 음 (중간), 뜻 (작은)
    const charEl = el("span", { class: "morpheme-char", text: card.char });
    btn.appendChild(charEl);
    if (level !== "advanced") {
      const soundEl = el("span", { class: "morpheme-sound", text: card.sound });
      btn.appendChild(soundEl);
    }
    if (level === "intro") {
      const meaningEl = el("span", { class: "morpheme-meaning", text: card.meaning });
      btn.appendChild(meaningEl);
    }
    btn.addEventListener("click", () => placeCharOnActiveBlank(card.char));
    btn.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", card.char);
      ev.dataTransfer.effectAllowed = "move";
      btn.classList.add("dragging");
    });
    btn.addEventListener("dragend", () => btn.classList.remove("dragging"));
    d.dockCards.appendChild(btn);
  }

  // 빈칸 drop 영역 활성화
  attachDropTargets();
}

function attachDropTargets() {
  document.querySelectorAll(".blank").forEach(span => {
    if (span.dataset.dropBound === "1") return;
    span.dataset.dropBound = "1";
    span.addEventListener("dragover", ev => { ev.preventDefault(); span.classList.add("drag-over"); });
    span.addEventListener("dragleave", () => span.classList.remove("drag-over"));
    span.addEventListener("drop", ev => {
      ev.preventDefault();
      span.classList.remove("drag-over");
      const char = ev.dataTransfer.getData("text/plain");
      const id = span.dataset.blankId;
      activateBlank(id);
      placeCharOnActiveBlank(char);
    });
  });
}

function placeCharOnActiveBlank(char) {
  const blank = state.session.blanks.find(b => b.id === state.session.activeBlankId);
  if (!blank || blank.filled) return;
  const expected = blank.answer.hanja.length;
  if (blank.placedChars.length >= expected) return;
  blank.placedChars.push(char);
  state.session.perPagePlacedChars.push({ blankId: blank.id, char, ts: Date.now() });
  // 슬롯 갱신
  const slot = document.querySelector(`.blank[data-blank-id="${blank.id}"] .blank-char[data-slot="${blank.placedChars.length - 1}"]`);
  if (slot) {
    slot.textContent = char;
    slot.classList.add("placed");
  }
  if (blank.placedChars.length === expected) {
    checkAnswer(blank);
  }
}

async function checkAnswer(blank) {
  const userWord = blank.placedChars.join("");
  const isCorrect = userWord === blank.answer.hanja;
  if (isCorrect) {
    blank.filled = true;
    state.session.correctCount++;
    showEtymology(blank);
    // SRL 성공 기록
    for (const ch of blank.answer.hanja) await recordHanjaResult(ch, true);
    // 단어 학습 기록
    state.progress.learnedWords.set(blank.answer.word, {
      firstSeenAt: state.progress.learnedWords.get(blank.answer.word)?.firstSeenAt || Date.now(),
      masteryLevel: (state.progress.learnedWords.get(blank.answer.word)?.masteryLevel || 0) + 1,
    });
    // 다음 빈칸 자동 활성화
    const nextOnPage = state.session.blanks.find(b => b.page === state.session.page && !b.filled);
    if (nextOnPage) {
      setTimeout(() => activateBlank(nextOnPage.id), 800);
    } else {
      state.session.activeBlankId = null;
      renderDock(null);
    }
    // 빈칸 다시 그리기 (루비 등장)
    rerenderBlank(blank);
    updateProgressUI();
  } else {
    state.session.wrongCount++;
    showWrongFeedback(blank);
    // 카드 원위치
    blank.placedChars = [];
    for (const ch of blank.answer.hanja) await recordHanjaResult(ch, false);
    setTimeout(() => rerenderBlank(blank), 500);
  }
}

function rerenderBlank(blank) {
  const span = document.querySelector(`.blank[data-blank-id="${blank.id}"]`);
  if (!span) return;
  renderBlankContents(span, blank);
}

function updateProgressUI() {
  const d = getDOM();
  const total = state.session.blanks.length;
  const filled = state.session.blanks.filter(b => b.filled).length;
  d.progressText.textContent = `빈칸 ${filled} / ${total}`;
  d.progressFill.style.width = `${total ? Math.round(100 * filled / total) : 0}%`;
  // 모든 빈칸 채워졌고 마지막 페이지면 다음 = 마무리
  if (state.session.page === state.corpus.pages.length - 1) maybeFinish();
}

function showWrongFeedback(blank) {
  const slots = document.querySelectorAll(`.blank[data-blank-id="${blank.id}"] .blank-char`);
  const expected = blank.answer.hanja.split("");
  slots.forEach((slot, i) => {
    const ok = blank.placedChars[i] === expected[i];
    slot.classList.add(ok ? "ok" : "no");
  });
  toast("아쉬워요! 다시 시도해 보세요", { kind: "warn" });
  setTimeout(() => slots.forEach(s => s.classList.remove("ok", "no", "placed")), 600);
}

function showEtymology(blank) {
  // Phase 4에서 강화되는 모달 — 본 Phase 1에선 토스트로 핵심만
  // (Phase 4 가 같은 함수를 확장)
  const lines = blank.etymology.map(e => `${e.sound}(${e.char}: ${e.meaning})`).join(" + ");
  const arrow = ` → ${blank.answer.word}`;
  // 모달 등장 (Phase 4 호환)
  const card = el("div", { class: "etymology-card" });
  card.appendChild(el("h3", { class: "etymology-word", text: `${blank.answer.hanja}  (${blank.answer.word})` }));
  const grid = el("div", { class: "etymology-grid" });
  for (const e of blank.etymology) {
    const c = el("div", { class: "etymology-morph" });
    c.appendChild(el("div", { class: "etymology-char", text: e.char }));
    c.appendChild(el("div", { class: "etymology-sound", text: e.sound }));
    c.appendChild(el("div", { class: "etymology-meaning", text: e.meaning }));
    grid.appendChild(c);
  }
  card.appendChild(grid);
  card.appendChild(el("div", { class: "etymology-explain", text: lines + arrow }));
  const closeBtn = el("button", { class: "btn small", text: "닫기", onclick: () => closeModal(overlay) });
  card.appendChild(closeBtn);
  const overlay = showModal(card);
  // 한자 음 발음 (Phase 4 — TTS click on each char)
  card.querySelectorAll(".etymology-char").forEach(charEl => {
    charEl.addEventListener("click", () => speakWord(charEl.textContent, { lang: "ko-KR" }));
  });
  // 자동 닫힘
  setTimeout(() => { if (overlay.isConnected) closeModal(overlay); }, 4500);
}

async function recordHanjaResult(char, ok) {
  const userId = state.user.id;
  const prev = (await getHanjaMastery(userId, char)) || { userId, hanja: char, exposureCount: 0, correctCount: 0, consecutiveCorrect: 0, nextReview: 0 };
  prev.exposureCount += 1;
  if (ok) {
    prev.correctCount += 1;
    prev.consecutiveCorrect = (prev.consecutiveCorrect || 0) + 1;
  } else {
    prev.consecutiveCorrect = 0;
  }
  const idx = Math.min(prev.consecutiveCorrect, SRL_INTERVALS_MS.length - 1);
  prev.nextReview = Date.now() + SRL_INTERVALS_MS[idx];
  await saveHanjaMastery(prev);
  // 메모리 progress 도 동기화
  state.progress.learnedHanja.set(char, prev);
}

function maybeFinish() {
  const allFilled = state.session.blanks.every(b => b.filled);
  if (!allFilled) return;
  // 마지막 페이지 + 모두 채워진 상태에서 자동 진입
  const d = getDOM();
  d.nextBtn.textContent = "마무리 →";
  d.nextBtn.disabled = false;
  d.nextBtn.onclick = () => finishReading();
}

async function finishReading() {
  const corpus = state.corpus;
  const total = state.session.correctCount + state.session.wrongCount;
  const accuracy = total ? state.session.correctCount / total : 0;
  const elapsed = Date.now() - state.session.startedAt;
  await saveProgress({
    userId: state.user.id,
    corpusId: corpus.id,
    completedAt: Date.now(),
    accuracy,
    correctCount: state.session.correctCount,
    wrongCount: state.session.wrongCount,
    elapsedMs: elapsed,
  });
  await saveSession({
    userId: state.user.id,
    corpusId: corpus.id,
    startedAt: state.session.startedAt,
    elapsedMs: elapsed,
    charsRead: corpus.charCount,
    accuracy,
  });
  state.progress.completedCorpusIds.add(corpus.id);

  // 보스 진입
  if (state.session.bossPending) {
    const idiom = lookupBoss(state.session.bossPending);
    if (idiom) {
      state.session.inBoss = true;
      startBoss(idiom, async (passed) => {
        if (passed) {
          await markBossPassed(state.user.id, idiom.id);
          state.progress.bossesPassed.add(idiom.id);
        }
        showEndScreen({ corpus, accuracy, elapsed, bossId: idiom.id, bossPassed: passed });
      });
      return;
    }
  }
  showEndScreen({ corpus, accuracy, elapsed });
}

async function endReadingEarly() {
  // 진행도만 저장 후 시작 화면
  await saveProgress({
    userId: state.user.id,
    corpusId: state.corpus.id,
    completedAt: 0,
    accuracy: 0,
    correctCount: state.session.correctCount,
    wrongCount: state.session.wrongCount,
    elapsedMs: Date.now() - state.session.startedAt,
    partial: true,
  });
  state.ui.screen = "start";
  showScreen("start");
}
