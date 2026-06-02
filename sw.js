// Service Worker — 앱 셸 캐싱 + offline fallback

const CACHE_VERSION = 'literacy-decoder-v4';
const CACHE_URLS = [
  // 앱 진입점
  './',
  'index.html',

  // CSS
  'src/css/tokens.css',
  'src/css/base.css',
  'src/css/components.css',
  'src/css/screens.css',
  'src/css/reading.css',
  'src/css/collection.css',
  'src/css/responsive.css',

  // 핵심 JS
  'src/js/main.js',
  'src/js/state.js',
  'src/js/config.js',
  'src/js/utils.js',
  'src/js/storage.js',
  'src/js/ui.js',

  // 게임 로직
  'src/js/corpus.js',
  'src/js/reading.js',
  'src/js/morpheme.js',
  'src/js/end.js',
  'src/js/tts.js',
  'src/js/boss.js',
  'src/js/dashboard.js',
  'src/js/collection.js',
  'src/js/composition.js',
  'src/js/install-prompt.js',

  // 데이터
  'src/data/hanja.js',
  'src/data/idioms.js',
  'src/data/corpus/manifest.json',
  'src/data/corpus/grade5.json',
  'src/data/corpus/grade6.json',

  // 자산
  'favicon.svg',
  'manifest.json',
];

// 설치 — 앱 셸 pre-cache
// addAll 은 한 항목이라도 실패하면 전체 트랜잭션이 실패하므로 개별 add 로 graceful 처리
self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(
        CACHE_URLS.map((url) => cache.add(url).catch((err) => {
          console.warn('[sw] precache failed:', url, err.message);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

// 활성화 — 이전 캐시 버전 정리
self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
    .then(() => self.clients.claim())
  );
});

// fetch — cache-first (get 요청만), network fallback
self.addEventListener('fetch', (ev) => {
  const { request } = ev;

  // POST 등 non-GET: 네트워크만 (캐싱 안함)
  if (request.method !== 'GET') {
    return;
  }

  // 크로스 오리진: 캐싱 안함 (Google Fonts 등)
  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    return;
  }

  // 같은 오리진 GET: cache-first
  ev.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) return response;
        return fetch(request).then((res) => {
          // 성공한 네트워크 응답은 캐시에 저장 (선택적)
          if (res && res.status === 200) {
            const cloned = res.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return res;
        });
      })
      .catch(() => {
        // offline: 캐시된 응답 반환, 없으면 offline 페이지
        return caches.match('index.html');
      })
  );
});
