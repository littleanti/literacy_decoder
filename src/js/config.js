// 전역 상수 — 스토리지 키, 페이지네이션 한도, 난이도 임계값 등
export const APP_VERSION = "0.6.0";

export const STORAGE_KEYS = {
  USER_ID: "ld_user_id",
  GRADE: "ld_grade",
  FONT_SIZE: "ld_font_size",
  DARK_MODE: "ld_dark_mode",
  LAST_CORPUS: "ld_last_corpus",
  PARENT_PIN: "ld_parent_pin_hash",
};

export const IDB_NAME = "literacy-decoder";
export const IDB_VERSION = 1;
export const IDB_STORES = {
  USERS: "users",
  PROGRESS: "progress",
  HANJA_MASTERY: "hanjaMastery",
  BOSS_PASSED: "bossPassed",
  SESSIONS: "sessions",
};

export const PAGINATION = {
  PHONE_MAX_PAGE_CHARS: 200,
  PHONE_BREAKPOINT_PX: 600,
  TABLET_BREAKPOINT_PX: 768,
};

export const DIFFICULTY = {
  INTRO_MIN_CHARS: 0,
  INTRO_MAX_CHARS: 200,
  MID_MIN_CHARS: 201,
  MID_MAX_CHARS: 500,
  ADVANCED_MIN_CHARS: 501,
};

export const FONT_SIZES = [16, 18, 22];

export const SRL_INTERVALS_MS = [1, 3, 7, 14, 30].map(d => d * 86400000);

export const DOCK_DISTRACTOR_TOTAL = 6;
