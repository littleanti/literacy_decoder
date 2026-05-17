// 학습 기록 대시보드 — Vanilla SVG 차트

import { state } from "./state.js";
import { el, clear, showScreen } from "./ui.js";
import { listProgressByUser, listHanjaMastery, listSessions, exportAll, importAll } from "./storage.js";

export async function showDashboard() {
  state.ui.screen = "dashboard";
  showScreen("dashboard");
  const root = document.getElementById("dashboard-body");
  clear(root);

  const userId = state.user.id;
  const [progress, mastery, sessions] = await Promise.all([
    listProgressByUser(userId),
    listHanjaMastery(userId),
    listSessions(userId),
  ]);

  // 누적 카운터
  const counters = el("div", { class: "dash-counters" });
  counters.appendChild(counterCard("📖", "완독 지문", progress.filter(p => !p.partial && p.completedAt).length));
  counters.appendChild(counterCard("🔠", "학습 한자",  mastery.length));
  counters.appendChild(counterCard("🐉", "통과 보스",  state.progress.bossesPassed.size));
  counters.appendChild(counterCard("📝", "학습 어휘",  state.progress.learnedWords.size));
  root.appendChild(counters);

  // 정답률 곡선 (최근 10개 지문)
  root.appendChild(sectionTitle("정답률 곡선"));
  root.appendChild(renderAccuracyChart(progress));

  // 읽기 속도 (주차별 chars/min)
  root.appendChild(sectionTitle("주차별 읽기 속도 (자/분)"));
  root.appendChild(renderReadingSpeedChart(sessions));

  // 자주 틀린 한자 Top 10
  root.appendChild(sectionTitle("자주 틀린 한자 Top 10"));
  root.appendChild(renderTopMistakes(mastery));

  // Export / Import 버튼
  const tools = el("div", { class: "dash-tools" });
  tools.appendChild(el("button", { class: "btn small", text: "데이터 내보내기", onclick: async () => {
    const data = await exportAll(userId);
    downloadJSON(data, `literacy-decoder-${userId.slice(0, 8)}.json`);
  }}));
  tools.appendChild(el("button", { class: "btn small ghost", text: "데이터 불러오기", onclick: () => triggerImport() }));
  root.appendChild(tools);
}

function counterCard(emoji, label, value) {
  const card = el("div", { class: "dash-counter" });
  card.appendChild(el("div", { class: "dash-counter-emoji", text: emoji }));
  card.appendChild(el("div", { class: "dash-counter-value", text: String(value) }));
  card.appendChild(el("div", { class: "dash-counter-label", text: label }));
  return card;
}

function sectionTitle(text) {
  return el("h3", { class: "dash-section-title", text });
}

function renderAccuracyChart(progress) {
  const completed = progress.filter(p => !p.partial && p.completedAt)
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-10);
  if (completed.length === 0) return el("div", { class: "dash-empty", text: "아직 완독한 지문이 없어요. 지문을 1편 읽어 보세요!" });

  const width = 320, height = 140, pad = 24;
  const xs = completed.map((_, i) => pad + (i * (width - 2 * pad)) / Math.max(1, completed.length - 1));
  const ys = completed.map(p => height - pad - p.accuracy * (height - 2 * pad));

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "dash-chart" });
  // 축
  svg.appendChild(svgEl("line", { x1: pad, y1: height - pad, x2: width - pad, y2: height - pad, stroke: "#ccc" }));
  svg.appendChild(svgEl("line", { x1: pad, y1: pad, x2: pad, y2: height - pad, stroke: "#ccc" }));
  // 라인
  const d = xs.map((x, i) => (i === 0 ? "M" : "L") + ` ${x} ${ys[i]}`).join(" ");
  svg.appendChild(svgEl("path", { d, fill: "none", stroke: "var(--coral)", "stroke-width": "2.5" }));
  // 점
  xs.forEach((x, i) => svg.appendChild(svgEl("circle", { cx: x, cy: ys[i], r: 4, fill: "var(--coral)" })));
  return svg;
}

function renderReadingSpeedChart(sessions) {
  if (sessions.length === 0) return el("div", { class: "dash-empty", text: "아직 읽기 기록이 없어요." });
  // 주차별 그룹 (epoch / 7 days)
  const weekMs = 7 * 86400000;
  const buckets = new Map();
  for (const s of sessions) {
    const week = Math.floor(s.startedAt / weekMs);
    if (!buckets.has(week)) buckets.set(week, { chars: 0, ms: 0 });
    const b = buckets.get(week);
    b.chars += s.charsRead || 0;
    b.ms += s.elapsedMs || 0;
  }
  const weeks = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-6);
  const data = weeks.map(([_, b]) => b.ms > 0 ? Math.round(b.chars / (b.ms / 60000)) : 0);

  const width = 320, height = 140, pad = 24;
  const max = Math.max(...data, 100);
  const barW = (width - 2 * pad) / Math.max(1, data.length) - 6;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "dash-chart" });
  svg.appendChild(svgEl("line", { x1: pad, y1: height - pad, x2: width - pad, y2: height - pad, stroke: "#ccc" }));
  data.forEach((v, i) => {
    const x = pad + i * ((width - 2 * pad) / Math.max(1, data.length));
    const h = (v / max) * (height - 2 * pad);
    svg.appendChild(svgEl("rect", { x, y: height - pad - h, width: barW, height: h, fill: "var(--mint)", rx: 4 }));
    const label = svgEl("text", { x: x + barW / 2, y: height - pad + 14, "text-anchor": "middle", "font-size": "10", fill: "var(--navy)" });
    label.textContent = String(v);
    svg.appendChild(label);
  });
  return svg;
}

function renderTopMistakes(mastery) {
  const ranked = [...mastery]
    .filter(m => m.exposureCount > 0)
    .map(m => ({ ...m, errRate: 1 - (m.correctCount / m.exposureCount) }))
    .sort((a, b) => b.errRate - a.errRate)
    .slice(0, 10);

  if (ranked.length === 0) return el("div", { class: "dash-empty", text: "아직 한자 학습 기록이 부족해요." });

  const list = el("div", { class: "dash-mistake-list" });
  for (const m of ranked) {
    const row = el("div", { class: "dash-mistake-row" });
    row.appendChild(el("span", { class: "dash-mistake-char", text: m.hanja }));
    row.appendChild(el("span", { class: "dash-mistake-meta", text: `정답률 ${Math.round((1 - m.errRate) * 100)}% (${m.correctCount}/${m.exposureCount})` }));
    list.appendChild(row);
  }
  return list;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await importAll(data);
      alert("불러오기 완료. 새로고침하세요.");
    } catch (e) {
      alert(`불러오기 실패: ${e.message}`);
    }
  };
  input.click();
}
