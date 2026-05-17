// IndexedDB 래퍼 + localStorage 래퍼.
// 5단계와 호환 가능한 스키마. private browsing / quota 초과 시 메모리 폴백.

import { IDB_NAME, IDB_VERSION, IDB_STORES, STORAGE_KEYS } from "./config.js";

let dbPromise = null;
let memoryFallback = null;

function initMemoryFallback() {
  if (memoryFallback) return memoryFallback;
  memoryFallback = {
    users: new Map(),
    progress: new Map(),       // key: userId|corpusId
    hanjaMastery: new Map(),   // key: userId|hanja
    bossPassed: new Map(),     // key: userId|idiomId
    sessions: [],              // ++id, ordered
  };
  return memoryFallback;
}

function openDB() {
  if (dbPromise) return dbPromise;
  if (!("indexedDB" in globalThis)) {
    dbPromise = Promise.resolve(null);
    initMemoryFallback();
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (_e) {
      initMemoryFallback();
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORES.USERS)) {
        const s = db.createObjectStore(IDB_STORES.USERS, { keyPath: "id" });
        s.createIndex("grade", "grade");
      }
      if (!db.objectStoreNames.contains(IDB_STORES.PROGRESS)) {
        const s = db.createObjectStore(IDB_STORES.PROGRESS, { keyPath: ["userId", "corpusId"] });
        s.createIndex("userId", "userId");
        s.createIndex("completedAt", "completedAt");
      }
      if (!db.objectStoreNames.contains(IDB_STORES.HANJA_MASTERY)) {
        const s = db.createObjectStore(IDB_STORES.HANJA_MASTERY, { keyPath: ["userId", "hanja"] });
        s.createIndex("userId", "userId");
        s.createIndex("nextReview", "nextReview");
      }
      if (!db.objectStoreNames.contains(IDB_STORES.BOSS_PASSED)) {
        const s = db.createObjectStore(IDB_STORES.BOSS_PASSED, { keyPath: ["userId", "idiomId"] });
        s.createIndex("userId", "userId");
      }
      if (!db.objectStoreNames.contains(IDB_STORES.SESSIONS)) {
        const s = db.createObjectStore(IDB_STORES.SESSIONS, { keyPath: "id", autoIncrement: true });
        s.createIndex("userId", "userId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn("[storage] IndexedDB unavailable, falling back to memory", req.error);
      initMemoryFallback();
      resolve(null);
    };
    req.onblocked = () => {
      console.warn("[storage] IndexedDB blocked, falling back to memory");
      initMemoryFallback();
      resolve(null);
    };
  });
  return dbPromise;
}

async function withStore(name, mode, fn) {
  const db = await openDB();
  if (!db) return fn({ memory: initMemoryFallback() });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    const out = fn({ store });
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function req2promise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ----- Users -----
export async function saveUser(user) {
  return withStore(IDB_STORES.USERS, "readwrite", ({ store, memory }) => {
    if (memory) { memory.users.set(user.id, user); return user; }
    return req2promise(store.put(user));
  });
}

export async function getUser(id) {
  return withStore(IDB_STORES.USERS, "readonly", async ({ store, memory }) => {
    if (memory) return memory.users.get(id) || null;
    return req2promise(store.get(id)).then(v => v || null);
  });
}

// ----- Progress -----
export async function saveProgress(entry) {
  return withStore(IDB_STORES.PROGRESS, "readwrite", ({ store, memory }) => {
    if (memory) { memory.progress.set(`${entry.userId}|${entry.corpusId}`, entry); return entry; }
    return req2promise(store.put(entry));
  });
}

export async function listProgressByUser(userId) {
  return withStore(IDB_STORES.PROGRESS, "readonly", async ({ store, memory }) => {
    if (memory) return [...memory.progress.values()].filter(p => p.userId === userId);
    const idx = store.index("userId");
    return req2promise(idx.getAll(userId));
  });
}

// ----- Hanja mastery (SRL) -----
export async function saveHanjaMastery(entry) {
  return withStore(IDB_STORES.HANJA_MASTERY, "readwrite", ({ store, memory }) => {
    if (memory) { memory.hanjaMastery.set(`${entry.userId}|${entry.hanja}`, entry); return entry; }
    return req2promise(store.put(entry));
  });
}

export async function getHanjaMastery(userId, hanja) {
  return withStore(IDB_STORES.HANJA_MASTERY, "readonly", async ({ store, memory }) => {
    if (memory) return memory.hanjaMastery.get(`${userId}|${hanja}`) || null;
    return req2promise(store.get([userId, hanja])).then(v => v || null);
  });
}

export async function listHanjaMastery(userId) {
  return withStore(IDB_STORES.HANJA_MASTERY, "readonly", async ({ store, memory }) => {
    if (memory) return [...memory.hanjaMastery.values()].filter(p => p.userId === userId);
    const idx = store.index("userId");
    return req2promise(idx.getAll(userId));
  });
}

// ----- Boss passed (7단계 게이트웨이) -----
export async function markBossPassed(userId, idiomId) {
  const entry = { userId, idiomId, passedAt: Date.now() };
  return withStore(IDB_STORES.BOSS_PASSED, "readwrite", ({ store, memory }) => {
    if (memory) { memory.bossPassed.set(`${userId}|${idiomId}`, entry); return entry; }
    return req2promise(store.put(entry));
  });
}

export async function listBossesPassed(userId) {
  return withStore(IDB_STORES.BOSS_PASSED, "readonly", async ({ store, memory }) => {
    if (memory) return [...memory.bossPassed.values()].filter(p => p.userId === userId);
    const idx = store.index("userId");
    return req2promise(idx.getAll(userId));
  });
}

// ----- Sessions (읽기 속도 측정용) -----
export async function saveSession(session) {
  return withStore(IDB_STORES.SESSIONS, "readwrite", ({ store, memory }) => {
    if (memory) {
      const id = memory.sessions.length + 1;
      const withId = { ...session, id };
      memory.sessions.push(withId);
      return withId;
    }
    return req2promise(store.put(session));
  });
}

export async function listSessions(userId) {
  return withStore(IDB_STORES.SESSIONS, "readonly", async ({ store, memory }) => {
    if (memory) return memory.sessions.filter(s => s.userId === userId);
    const idx = store.index("userId");
    return req2promise(idx.getAll(userId));
  });
}

// ----- Export / Import (학부모 백업용) -----
export async function exportAll(userId) {
  const [user, progress, hanjaMastery, bossPassed, sessions] = await Promise.all([
    getUser(userId),
    listProgressByUser(userId),
    listHanjaMastery(userId),
    listBossesPassed(userId),
    listSessions(userId),
  ]);
  return { exportedAt: Date.now(), schemaVersion: IDB_VERSION, user, progress, hanjaMastery, bossPassed, sessions };
}

export async function importAll(payload) {
  if (payload?.user) await saveUser(payload.user);
  for (const p of payload?.progress || []) await saveProgress(p);
  for (const h of payload?.hanjaMastery || []) await saveHanjaMastery(h);
  for (const b of payload?.bossPassed || []) await markBossPassed(b.userId, b.idiomId);
  for (const s of payload?.sessions || []) await saveSession(s);
}

// ----- localStorage 래퍼 (설정 / 마지막 진행 위치) -----
export const settings = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* private browsing */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* private browsing */ }
  },
  KEYS: STORAGE_KEYS,
};
