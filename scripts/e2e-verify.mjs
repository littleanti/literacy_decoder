// Headless E2E verification for literacy-decoder.
// Run: LD_LIBRARY_PATH=/tmp/libs/extract/usr/lib/x86_64-linux-gnu node scripts/e2e-verify.mjs
// Exits 0 if all stories pass, 1 otherwise. Prints PRD-style verdict.

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const HOST = 'http://localhost:3006';
const PRD_PATH = '.omc/prd.json';

const results = {};

function mark(id, passes, detail) {
  results[id] = { passes, detail };
  console.log(`${passes ? '✅' : '❌'} ${id}: ${detail}`);
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['-y', 'http-server', '.', '-p', '3006', '-s'], { stdio: 'pipe' });
    let resolved = false;
    proc.stdout.on('data', (b) => {
      const s = b.toString();
      if (!resolved && (s.includes('Available on:') || s.includes('Starting up') || s.includes('Hit CTRL'))) {
        resolved = true;
        setTimeout(() => resolve(proc), 800);
      }
    });
    proc.stderr.on('data', (b) => process.stderr.write('[server] ' + b.toString()));
    setTimeout(() => { if (!resolved) { resolved = true; resolve(proc); } }, 3500);
    proc.on('error', reject);
  });
}

const server = await startServer();
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  const consoleErrs = [];
  const pageErrs = [];
  const failedReq = [];
  const responses = new Map();

  page.on('pageerror', (e) => pageErrs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('requestfailed', (r) => failedReq.push({ url: r.url(), reason: r.failure()?.errorText }));
  page.on('response', (r) => responses.set(new URL(r.url()).pathname, r.status()));

  await page.setViewport({ width: 412, height: 800 });

  // ===== US-001: Bootstrap =====
  const res = await page.goto(HOST + '/', { waitUntil: 'networkidle0', timeout: 20000 });
  const title = await page.title();
  await new Promise(r => setTimeout(r, 800));
  const usHttp = res?.status() === 200;
  const usTitle = title === '📖 문해력 해독기';
  const usErrs = pageErrs.length === 0;
  mark('US-001',
    usHttp && usTitle && usErrs,
    `http=${res?.status()} title="${title}" pageErrs=${pageErrs.length}${pageErrs.length ? ' ' + JSON.stringify(pageErrs) : ''}`);

  // ===== US-002: Static assets (initial-load shell + lazy corpus via fetch) =====
  const initialExpected = [
    '/', '/src/css/tokens.css', '/src/css/base.css', '/src/css/components.css',
    '/src/css/screens.css', '/src/css/reading.css', '/src/css/responsive.css',
    '/src/js/main.js', '/src/js/state.js', '/src/js/config.js', '/src/js/utils.js',
    '/src/js/storage.js', '/src/js/ui.js', '/src/js/corpus.js', '/src/js/reading.js',
    '/src/js/morpheme.js', '/src/js/end.js', '/src/js/tts.js', '/src/js/boss.js',
    '/src/js/dashboard.js', '/src/js/composition.js', '/src/js/install-prompt.js',
    '/src/data/hanja.js', '/src/data/idioms.js',
    '/manifest.json', '/favicon.svg',
  ];
  const lazyExpected = ['/src/data/corpus/manifest.json', '/src/data/corpus/grade5.json'];
  const lazyChecks = await page.evaluate(async (paths) => {
    const out = [];
    for (const p of paths) {
      try { const r = await fetch(p); out.push({ p, status: r.status }); }
      catch (e) { out.push({ p, error: e.message }); }
    }
    return out;
  }, lazyExpected);

  const missing = [];
  for (const p of initialExpected) {
    const status = responses.get(p);
    if (status === undefined) missing.push(p + ' (no request)');
    else if (status >= 400) missing.push(p + ' = ' + status);
  }
  for (const c of lazyChecks) {
    if (c.error || c.status !== 200) missing.push(`${c.p} = ${c.status || c.error}`);
  }
  mark('US-002',
    missing.length === 0 && failedReq.length === 0,
    missing.length || failedReq.length
      ? `missing/bad: ${JSON.stringify(missing.slice(0, 5))} failedReqs=${JSON.stringify(failedReq.slice(0, 3))}`
      : `${responses.size} responses, lazy=${lazyChecks.length}×200, no 4xx/5xx, no requestfailed`);

  // ===== US-003: Start screen =====
  const startUI = await page.evaluate(() => {
    const ss = document.getElementById('start-screen');
    const h1 = ss?.querySelector('h1')?.textContent || '';
    const g5 = document.getElementById('grade5-btn');
    const g6 = document.getElementById('grade6-btn');
    const playBtn = document.getElementById('start-play-btn');
    const summary = document.getElementById('start-progress-summary');
    return {
      active: ss?.classList.contains('active'),
      h1,
      g5Visible: g5 && g5.offsetParent !== null,
      g6Visible: g6 && g6.offsetParent !== null,
      activeChip: g5?.classList.contains('active') || g6?.classList.contains('active'),
      playEnabled: playBtn && !playBtn.disabled,
      summaryText: summary?.textContent || '',
    };
  });
  mark('US-003',
    startUI.active && startUI.h1.includes('문해력 해독기') &&
    startUI.g5Visible && startUI.g6Visible && startUI.activeChip &&
    startUI.playEnabled && startUI.summaryText.includes('학습한 한자'),
    JSON.stringify(startUI));

  // ===== US-004: Core loop =====
  await page.click('#start-play-btn');
  await page.waitForFunction(() => document.getElementById('read-screen')?.classList.contains('active'), { timeout: 5000 });

  // Wait for state.session.blanks to be populated before reading it (defensive against lazy init)
  await page.waitForFunction(async () => {
    try {
      const mod = await import('/src/js/state.js');
      return Array.isArray(mod.state?.session?.blanks) && mod.state.session.blanks.length > 0;
    } catch { return false; }
  }, { timeout: 5000 });

  const readMeta = await page.evaluate(() => ({
    title: document.getElementById('read-title')?.textContent || '',
    blanks: document.querySelectorAll('.blank').length,
    cards: document.querySelectorAll('.morpheme-card').length,
    activeBlanks: document.querySelectorAll('.blank.active').length,
  }));

  // Helper: fill the currently active blank using state to identify the answer
  async function fillActiveBlank() {
    return await page.evaluate(async () => {
      const mod = await import('/src/js/state.js');
      const activeId = mod.state.session.activeBlankId;
      if (!activeId) return { ok: false, why: 'no activeBlankId' };
      const blank = mod.state.session.blanks.find(b => b.id === activeId);
      if (!blank) return { ok: false, why: 'no blank in state' };
      const expected = blank.answer.hanja.split('');
      const cardByChar = new Map();
      for (const c of [...document.querySelectorAll('.morpheme-card')]) cardByChar.set(c.dataset.char, c);
      for (const ch of expected) {
        const card = cardByChar.get(ch);
        if (!card) return { ok: false, why: `card for ${ch} missing` };
        card.click();
        await new Promise(r => setTimeout(r, 60));
      }
      return { ok: true, word: blank.answer.word, hanja: blank.answer.hanja };
    });
  }

  // Fill the first blank, observe etymology modal
  const fillResult = await fillActiveBlank();
  await new Promise(r => setTimeout(r, 900));
  const afterFill = await page.evaluate(() => ({
    modalShown: document.querySelectorAll('.modal-overlay').length > 0,
    filledBlanks: document.querySelectorAll('.blank.filled').length,
    rubyCount: document.querySelectorAll('.blank ruby').length,
  }));

  mark('US-004',
    readMeta.blanks > 0 && readMeta.cards > 0 && fillResult.ok &&
    afterFill.filledBlanks > 0,
    `readMeta=${JSON.stringify(readMeta)} fill=${JSON.stringify(fillResult)} after=${JSON.stringify(afterFill)}`);

  // ===== US-005: End screen + composition =====
  // Close any open modal first
  await page.evaluate(() => {
    const ov = document.querySelector('.modal-overlay');
    if (ov) ov.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Fill ALL remaining blanks across all pages (corpus-format-agnostic).
  // Loops: while session has unfilled blanks, fill active blank or advance page until done.
  let safety = 30;
  while (safety-- > 0) {
    const status = await page.evaluate(async () => {
      const mod = await import('/src/js/state.js');
      const ses = mod.state.session;
      const remaining = ses.blanks.filter(b => !b.filled).length;
      const currentPageRemaining = ses.blanks.filter(b => !b.filled && b.page === ses.page).length;
      return { remaining, currentPageRemaining, page: ses.page };
    });
    if (status.remaining === 0) break;
    if (status.currentPageRemaining === 0) {
      // Advance page
      await page.evaluate(() => document.getElementById('read-next-btn')?.click());
      await new Promise(r => setTimeout(r, 400));
      continue;
    }
    // Make sure modal is closed
    await page.evaluate(() => document.querySelector('.modal-overlay')?.click());
    await new Promise(r => setTimeout(r, 200));
    const r = await fillActiveBlank();
    if (!r.ok) { console.warn('[e2e] fillActive failed:', r.why); break; }
    await new Promise(r => setTimeout(r, 800));
  }

  // Click finish (last-page next button now triggers finishReading)
  await page.evaluate(() => document.querySelector('.modal-overlay')?.click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => document.getElementById('read-next-btn')?.click());
  await page.waitForFunction(() => document.getElementById('end-screen')?.classList.contains('active'), { timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  const endMeta = await page.evaluate(() => {
    const endActive = document.getElementById('end-screen')?.classList.contains('active');
    const buttons = [...document.querySelectorAll('#end-screen .btn')].map(b => b.textContent.trim());
    return { endActive, buttons };
  });
  // Click 작문 미션
  await page.evaluate(() => {
    [...document.querySelectorAll('#end-screen .btn')].find(b => b.textContent.includes('작문'))?.click();
  });
  await new Promise(r => setTimeout(r, 700));
  const compMeta = await page.evaluate(() => {
    const compActive = document.getElementById('composition-screen')?.classList.contains('active');
    const ta = document.getElementById('composition-textarea');
    const wordCard = document.querySelector('.composition-word-card');
    return { compActive, hasTextarea: !!ta, wordText: wordCard?.textContent || '' };
  });
  // Type a valid sentence
  if (compMeta.hasTextarea) {
    await page.type('#composition-textarea', '오늘 농부 농부 농부 농부 농부가 들에 나가 일을 했어요.');
    // Submit
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#composition-screen .btn')].find(b => b.textContent.includes('제출'));
      btn?.click();
    });
    await new Promise(r => setTimeout(r, 500));
  }
  const compResult = await page.evaluate(() => {
    const modal = document.querySelector('.composition-result-modal');
    return {
      modalShown: !!modal,
      successText: modal?.querySelector('.composition-result-success')?.textContent || '',
      tryAgain: modal?.querySelector('.composition-result-try-again')?.textContent || '',
    };
  });
  mark('US-005',
    endMeta.endActive &&
    endMeta.buttons.some(b => b.includes('다음 지문')) &&
    endMeta.buttons.some(b => b.includes('작문')) &&
    compMeta.compActive && compMeta.hasTextarea &&
    compResult.modalShown,
    `end=${JSON.stringify(endMeta)} comp=${JSON.stringify(compMeta)} result=${JSON.stringify(compResult)}`);

  // ===== US-006: PWA =====
  const manifestRes = await page.evaluate(async () => {
    const r = await fetch('/manifest.json');
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  const swRes = await page.evaluate(async () => {
    const r = await fetch('/sw.js');
    return { status: r.status };
  });
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      return { supported: true, hasRegistration: !!reg, scope: reg?.scope, active: !!reg?.active };
    } catch (e) {
      return { supported: true, error: e.message };
    }
  });
  const swErrs = consoleErrs.filter(e => /service.?worker/i.test(e));
  mark('US-006',
    manifestRes.status === 200 && manifestRes.body?.name === '문해력 해독기' &&
    manifestRes.body?.theme_color === '#FF7757' &&
    swRes.status === 200 &&
    swErrs.length === 0,
    `manifest=${manifestRes.status} sw=${swRes.status} swState=${JSON.stringify(swState)} swErrs=${swErrs.length}`);

  console.log('\n=== console errors (' + consoleErrs.length + ') ===');
  consoleErrs.slice(0, 5).forEach(e => console.log('  - ' + e));
  console.log('=== page errors (' + pageErrs.length + ') ===');
  pageErrs.slice(0, 5).forEach(e => console.log('  - ' + e));
} finally {
  await browser.close();
  server.kill();
}

// Write results into prd.json
const prd = JSON.parse(readFileSync(PRD_PATH, 'utf8'));
for (const story of prd.stories) {
  const r = results[story.id];
  if (r) story.passes = r.passes;
}
writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2) + '\n');

const passed = Object.values(results).every(r => r.passes);
console.log('\n=== Verdict: ' + (passed ? '✅ ALL PASS' : '❌ SOME FAIL') + ' ===');
for (const [id, r] of Object.entries(results)) {
  console.log(`${r.passes ? '✅' : '❌'} ${id}`);
}
process.exit(passed ? 0 : 1);
