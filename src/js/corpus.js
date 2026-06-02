// 지문 코퍼스 lazy-load + 메타 헬퍼

let manifestCache = null;
const fileCache = new Map(); // source filename -> corpora array

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`fetch failed: ${path} (${res.status})`);
  return res.json();
}

export async function loadManifest() {
  if (manifestCache) return manifestCache;
  manifestCache = await loadJSON("src/data/corpus/manifest.json");
  return manifestCache;
}

export async function loadCorpusFile(filename) {
  if (fileCache.has(filename)) return fileCache.get(filename);
  const data = await loadJSON(`src/data/corpus/${filename}`);
  fileCache.set(filename, data.corpora);
  return data.corpora;
}

export async function getCorpus(corpusId) {
  const m = await loadManifest();
  const meta = m.corpora.find(c => c.id === corpusId);
  if (!meta) throw new Error(`unknown corpus: ${corpusId}`);
  const corpora = await loadCorpusFile(meta.source);
  const corpus = corpora.find(c => c.id === corpusId);
  if (!corpus) throw new Error(`corpus body missing: ${corpusId}`);
  return { ...meta, ...corpus };
}

/**
 * 다음에 풀 지문 선택. completedSet 에 포함된 것은 후순위로.
 * grade / level 은 선택적 필터 — 통합 모드에서는 둘 다 생략해 전체 지문에서 고른다.
 * (manifest 순서가 곧 난이도 순서: 입문 → 중급 → 심화)
 */
export async function pickNextCorpus({ grade, level, completedSet } = {}) {
  const m = await loadManifest();
  const candidates = m.corpora.filter(c => (!grade || c.grade === grade) && (!level || c.level === level));
  if (candidates.length === 0) return null;
  const unfinished = candidates.filter(c => !completedSet.has(c.id));
  const pool = unfinished.length ? unfinished : candidates;
  return pool[0]; // 단순 정책: manifest 순서. SRL 도입 시 가중치 변경.
}

export async function listCorpora({ grade, level } = {}) {
  const m = await loadManifest();
  return m.corpora.filter(c => (!grade || c.grade === grade) && (!level || c.level === level));
}
