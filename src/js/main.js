// 진입점 — 라우팅 + 사용자 부트스트랩

import { state } from "./state.js";
import { settings } from "./storage.js";
import { saveUser, getUser, listProgressByUser, listHanjaMastery, listBossesPassed } from "./storage.js";
import { uuid } from "./utils.js";
import { FONT_SIZES, STORAGE_KEYS } from "./config.js";
import { el, showScreen, applyFontSize, applyDarkMode, toast } from "./ui.js";
import { loadManifest, pickNextCorpus, getCorpus } from "./corpus.js";
import { startReading } from "./reading.js";
import { showDashboard } from "./dashboard.js";
import { showCollection } from "./collection.js";
import "./install-prompt.js";

async function bootstrap() {
  // 1) 사용자 부트스트랩 (UUID 없으면 생성)
  let userId = settings.get(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = uuid();
    settings.set(STORAGE_KEYS.USER_ID, userId);
  }
  state.user.id = userId;

  // fontSize / dark (학년 구분 없는 통합 모드)
  const storedFs = parseInt(settings.get(STORAGE_KEYS.FONT_SIZE, "18"), 10);
  state.user.fontSize = FONT_SIZES.includes(storedFs) ? storedFs : 18;
  state.user.darkMode = settings.get(STORAGE_KEYS.DARK_MODE) === "1";

  applyFontSize(state.user.fontSize);
  applyDarkMode(state.user.darkMode);

  // 2) IndexedDB 진척도 로드
  let user = await getUser(userId);
  if (!user) {
    user = { id: userId, grade: state.user.grade, createdAt: Date.now() };
    await saveUser(user);
  }
  const [progress, mastery, bosses] = await Promise.all([
    listProgressByUser(userId),
    listHanjaMastery(userId),
    listBossesPassed(userId),
  ]);
  for (const p of progress) if (!p.partial && p.completedAt) state.progress.completedCorpusIds.add(p.corpusId);
  for (const m of mastery) state.progress.learnedHanja.set(m.hanja, m);
  for (const b of bosses) state.progress.bossesPassed.add(b.idiomId);

  // 3) 시작 화면 렌더
  renderStartScreen();
  bindGlobalEvents();
}

function renderStartScreen() {
  const root = document.getElementById("start-screen");
  root.querySelector(".start-emoji").textContent = "📖";
  const last = settings.get(STORAGE_KEYS.LAST_CORPUS);
  const hasContinue = !!last && !state.progress.completedCorpusIds.has(last);

  document.getElementById("start-continue-btn").style.display = hasContinue ? "" : "none";
  document.getElementById("start-progress-summary").textContent =
    `학습한 한자 ${state.progress.learnedHanja.size}자 · 통과 보스 ${state.progress.bossesPassed.size}편`;
}

function bindGlobalEvents() {
  document.getElementById("start-play-btn").addEventListener("click", async () => {
    const meta = await pickNextCorpus({
      completedSet: state.progress.completedCorpusIds,
    });
    if (!meta) {
      toast("모든 지문을 완료했어요! 🎓");
      return;
    }
    const corpus = await getCorpus(meta.id);
    settings.set(STORAGE_KEYS.LAST_CORPUS, corpus.id);
    startReading(corpus);
  });

  document.getElementById("start-continue-btn").addEventListener("click", async () => {
    const last = settings.get(STORAGE_KEYS.LAST_CORPUS);
    if (!last) return;
    const corpus = await getCorpus(last);
    startReading(corpus);
  });

  document.getElementById("start-dashboard-btn").addEventListener("click", () => {
    showDashboard();
  });

  document.getElementById("start-collection-btn").addEventListener("click", () => {
    showCollection();
  });

  document.getElementById("start-settings-btn").addEventListener("click", () => {
    showScreen("settings");
    state.ui.screen = "settings";
  });

  // 설정 화면
  const fontRadios = document.querySelectorAll('input[name="font-size"]');
  fontRadios.forEach(r => {
    r.checked = parseInt(r.value, 10) === state.user.fontSize;
    r.addEventListener("change", () => {
      state.user.fontSize = parseInt(r.value, 10);
      settings.set(STORAGE_KEYS.FONT_SIZE, String(state.user.fontSize));
      applyFontSize(state.user.fontSize);
    });
  });
  const darkToggle = document.getElementById("dark-toggle");
  darkToggle.classList.toggle("on", state.user.darkMode);
  darkToggle.addEventListener("click", () => {
    state.user.darkMode = !state.user.darkMode;
    settings.set(STORAGE_KEYS.DARK_MODE, state.user.darkMode ? "1" : "0");
    applyDarkMode(state.user.darkMode);
    darkToggle.classList.toggle("on", state.user.darkMode);
  });
  document.getElementById("settings-back-btn").addEventListener("click", () => {
    showScreen("start");
    state.ui.screen = "start";
  });

  document.getElementById("dashboard-back-btn").addEventListener("click", () => {
    showScreen("start");
    state.ui.screen = "start";
  });

  document.getElementById("collection-back-btn").addEventListener("click", () => {
    showScreen("start");
    state.ui.screen = "start";
  });
}

bootstrap().catch(err => {
  console.error("[main] bootstrap failed", err);
  document.body.innerHTML = `<pre style="padding:20px;color:#c00">초기화 실패: ${err.message}</pre>`;
});

// PWA — 서비스 워커 등록 (GitHub Pages 호환 위해 상대 경로)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn("[main] SW registration failed", err);
    });
  });
}
