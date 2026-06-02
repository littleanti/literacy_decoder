// 한자 도감 — 마스터 DB의 한자를 전부 펼쳐 보여 준다 (잠금 없음).
// 급수 필터(전체 / 8급 / 7급 / 6급 / 5급 / 고급) + 한자 카드를 누르면
// 그 한자로 만든 어휘(지문 빈칸 + 사자성어)가 상세로 펼쳐진다.
// 5단계(`5_vocabulary_tree`)의 도감을 본 게임 데이터·디자인에 맞춰 이식.

import { HANJA } from "../data/hanja.js";
import { BOSS_IDIOMS } from "../data/idioms.js";
import { state } from "./state.js";
import { settings } from "./storage.js";
import { loadManifest, loadCorpusFile } from "./corpus.js";
import { el, clear, showScreen, showModal, closeModal } from "./ui.js";

const FILTER_KEY = "ld_dogam_filter";

const FILTERS = [
  { key: "all", label: "전체",  match: () => true },
  { key: "8",   label: "8급",  match: (g) => g === "8급" },
  { key: "7",   label: "7급",  match: (g) => g === "7급" },
  { key: "6",   label: "6급",  match: (g) => g === "6급" },
  { key: "5",   label: "5급",  match: (g) => g === "5급" },
  { key: "adv", label: "고급",  match: (g) => !["8급", "7급", "6급", "5급"].includes(g) },
];

// 급수 정렬 가중치 (높을수록 쉬운 한자 → 앞에 배치)
const GRADE_RANK = {
  "8급": 8, "7급": 7, "6급": 6, "5급": 5,
  "준4급": 4.5, "4급": 4, "준3급": 3.5, "3급": 3, "2급": 2, "1급": 1,
};
function gradeRank(g) { return GRADE_RANK[g] ?? 0; }

// 한자 → 어휘 인덱스 (lazy, 1회 빌드 후 캐시)
let wordIndex = null;

async function buildWordIndex() {
  if (wordIndex) return wordIndex;
  const index = new Map(); // char -> [{ text, hanja, gloss, kind }]
  const seen = new Set();   // `${char}|${text}` 중복 방지

  const add = (char, entry) => {
    const dedupeKey = `${char}|${entry.text}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (!index.has(char)) index.set(char, []);
    index.get(char).push(entry);
  };

  // 1) 지문 코퍼스 빈칸 → 한자어
  try {
    const manifest = await loadManifest();
    const sources = [...new Set(manifest.corpora.map((c) => c.source))];
    const files = await Promise.all(sources.map((s) => loadCorpusFile(s)));
    for (const corpora of files) {
      for (const corpus of corpora) {
        for (const page of corpus.pages || []) {
          for (const blank of page.blanks || []) {
            const word = blank.answer?.word;
            const hanja = blank.answer?.hanja;
            if (!word || !hanja) continue;
            const gloss = (blank.etymology || []).map((e) => e.meaning).join(" + ");
            for (const char of hanja) add(char, { text: word, hanja, gloss, kind: "word" });
          }
        }
      }
    }
  } catch (err) {
    console.warn("[collection] 코퍼스 인덱스 빌드 실패", err);
  }

  // 2) 사자성어 보스 → 4글자 어휘
  for (const idiom of BOSS_IDIOMS) {
    const hanja = idiom.hanja.join("");
    for (const char of idiom.hanja) {
      add(char, { text: idiom.word, hanja, gloss: idiom.meaning, kind: "idiom" });
    }
  }

  wordIndex = index;
  return index;
}

function getFilter() {
  const f = settings.get(FILTER_KEY, "all");
  return FILTERS.some((x) => x.key === f) ? f : "all";
}

function hanjaEntries(filterKey) {
  const filter = FILTERS.find((f) => f.key === filterKey) || FILTERS[0];
  return Object.entries(HANJA)
    .filter(([, info]) => filter.match(info.grade))
    .map(([char, info]) => ({ char, ...info }))
    .sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || a.strokes - b.strokes);
}

export async function showCollection() {
  state.ui.screen = "collection";
  showScreen("collection");
  await buildWordIndex();
  draw(getFilter());
}

function draw(filterKey) {
  const root = document.getElementById("collection-body");
  if (!root) return;
  clear(root);

  const list = hanjaEntries(filterKey);

  // 안내 문구
  const sub = el("p", { class: "dogam-sub" },
    "한자 ", el("strong", { text: String(list.length) }), "자 · 글자를 누르면 어휘가 펼쳐져요");
  root.appendChild(sub);

  // 급수 필터 칩
  const filterBar = el("div", { class: "dogam-filter", role: "tablist", aria: { label: "급수 필터" } });
  for (const f of FILTERS) {
    const active = f.key === filterKey;
    filterBar.appendChild(el("button", {
      class: `dogam-chip ${active ? "active" : ""}`,
      role: "tab",
      aria: { selected: String(active) },
      text: f.label,
      onclick: () => {
        if (f.key === getFilter()) return;
        settings.set(FILTER_KEY, f.key);
        draw(f.key);
      },
    }));
  }
  root.appendChild(filterBar);

  // 한자 그리드
  const grid = el("div", { class: "dogam-grid", role: "list" });
  for (const h of list) {
    const learned = state.progress.learnedHanja.has(h.char);
    const card = el("button", {
      class: `dogam-card ${learned ? "learned" : ""}`,
      role: "listitem",
      aria: { label: `${h.meaning} ${h.sound} ${h.grade}` },
      onclick: () => openDetail(h.char),
    },
      el("span", { class: "dogam-glyph hanja", text: h.char }),
      el("span", { class: "dogam-read", text: `${h.meaning} ${h.sound}` }),
      el("span", { class: "dogam-grade", text: h.grade }),
    );
    if (learned) card.appendChild(el("span", { class: "dogam-learned-badge", text: "✓", aria: { hidden: "true" } }));
    grid.appendChild(card);
  }
  root.appendChild(grid);
}

function openDetail(char) {
  const info = HANJA[char];
  if (!info) return;
  const words = wordIndex?.get(char) || [];

  const content = el("div", { class: "dogam-detail-card" });

  // 닫기
  const overlayRef = {};
  content.appendChild(el("button", {
    class: "dogam-detail-close", aria: { label: "닫기" }, text: "✕",
    onclick: () => overlayRef.overlay && closeModal(overlayRef.overlay),
  }));

  // 헤드: 큰 글자 + 음/뜻 + 메타
  const head = el("div", { class: "dogam-detail-head" });
  head.appendChild(el("span", { class: "dogam-detail-glyph hanja", text: char }));
  const headInfo = el("div", { class: "dogam-detail-info" });
  headInfo.appendChild(el("div", { class: "dogam-detail-read", text: `${info.meaning} ${info.sound}` }));
  headInfo.appendChild(el("div", { class: "dogam-detail-meta", text: `${info.grade} · ${info.strokes}획 · ${info.category}` }));
  head.appendChild(headInfo);
  content.appendChild(head);

  // 어휘 목록
  content.appendChild(el("div", { class: "dogam-detail-label" },
    "이 한자로 만든 어휘 ", el("strong", { text: String(words.length) })));

  const wordWrap = el("div", { class: "dogam-detail-words" });
  if (words.length) {
    for (const w of words) {
      const row = el("div", { class: `dogam-word ${w.kind === "idiom" ? "idiom" : ""}` });
      const textWrap = el("span", { class: "dogam-word-text" }, w.text);
      if (w.hanja) textWrap.appendChild(el("span", { class: "dogam-word-hanja hanja", text: ` ${w.hanja}` }));
      row.appendChild(textWrap);
      if (w.gloss) row.appendChild(el("span", { class: "dogam-word-mean", text: w.gloss }));
      wordWrap.appendChild(row);
    }
  } else {
    wordWrap.appendChild(el("div", { class: "dogam-empty", text: "아직 지문·사자성어에 등장하지 않은 한자예요" }));
  }
  content.appendChild(wordWrap);

  overlayRef.overlay = showModal(content);
}
