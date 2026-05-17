#!/usr/bin/env node
// scripts/build-corpus.js — {{단어:漢字}} 마커 문법으로 작성된 raw 텍스트를
// 런타임 JSON (pages[].text + blanks[]) 형식으로 빌드.
//
// 사용:
//   node scripts/build-corpus.js --in raw/g5-006.txt --out src/data/corpus/g5-006.json
//
// raw 텍스트 헤더:
//   ---
//   id: g5-006
//   title: ...
//   grade: 5
//   level: intro
//   pageBreak: \n\n     (선택, 페이지 구분자)
//   ---
//   본문...
//
// 본 게임은 사전에 모든 corpus JSON이 채워져 있어서 본 스크립트는 추후
// 코퍼스 확장 시에만 필요. Phase 0 산출물로 명세만 정의.

import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";

function parseArgs() {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, "")] = argv[i + 1];
  }
  return args;
}

function splitFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\n/)) {
    const [k, ...rest] = line.split(":");
    if (!k) continue;
    meta[k.trim()] = rest.join(":").trim();
  }
  return { meta, body: m[2] };
}

function buildBlanks(body) {
  const blanks = [];
  let idx = 1;
  const text = body.replace(/\{\{([^:]+):([^}]+)\}\}/g, (_, word, hanja) => {
    const id = `B${idx++}`;
    blanks.push({
      id,
      answer: { word, hanja },
      etymology: [...hanja].map(ch => ({ char: ch, sound: "?", meaning: "?" })),
      morphemeHints: [...hanja],
      contextClues: [],
    });
    return `[${id}]`;
  });
  return { text, blanks };
}

function splitPages(text, blanks, breaker = /\n\n+/) {
  const segments = text.split(breaker).map(s => s.trim()).filter(Boolean);
  return segments.map(seg => {
    const ids = [...seg.matchAll(/\[(B\d+)\]/g)].map(m => m[1]);
    const pageBlanks = blanks.filter(b => ids.includes(b.id));
    return { text: seg, blanks: pageBlanks };
  });
}

function main() {
  const args = parseArgs();
  if (!args.in || !args.out) {
    console.error("Usage: build-corpus.js --in raw.txt --out out.json");
    exit(2);
  }
  const raw = readFileSync(args.in, "utf-8");
  const { meta, body } = splitFrontMatter(raw);
  const { text, blanks } = buildBlanks(body);
  const pages = splitPages(text, blanks);
  const corpus = {
    id: meta.id || "untitled",
    title: meta.title || "",
    grade: Number(meta.grade) || 5,
    level: meta.level || "intro",
    charCount: body.replace(/\{\{[^}]+\}\}/g, "").length,
    estimatedReadingMs: Math.round((body.length / 300) * 60000),
    pages,
    boss: meta.boss || null,
  };
  writeFileSync(args.out, JSON.stringify({ version: 1, corpora: [corpus] }, null, 2));
  console.log(`[build-corpus] wrote ${args.out} (${corpus.charCount} chars, ${blanks.length} blanks)`);
}

main();
