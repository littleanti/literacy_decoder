// PWA 설치 프롬프트 — beforeinstallprompt 이벤트 처리

import { toast } from './ui.js';

let installPromptEvent = null;

// beforeinstallprompt 캐싱
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  installPromptEvent = ev;
});

// app installed 감지
window.addEventListener('appinstalled', () => {
  installPromptEvent = null;
  console.log('[install-prompt] app installed');
});

// 사용자 명시적 호출 (예: 설정 화면에서 "홈 화면 추가" 버튼)
export function showInstallPrompt() {
  if (!installPromptEvent) {
    toast('이미 설치되었거나 설치 불가합니다', { kind: 'info' });
    return;
  }

  // 토스트로 프롬프트 안내
  const layer = document.getElementById('toast-layer');
  if (!layer) return;

  const toast_el = document.createElement('div');
  toast_el.className = 'toast install-prompt-toast';

  const message = document.createElement('div');
  message.textContent = '홈 화면에 추가하시겠어요?';

  const button = document.createElement('button');
  button.className = 'install-prompt-button';
  button.textContent = '설치';
  button.onclick = async () => {
    installPromptEvent.prompt();
    const outcome = await installPromptEvent.userChoice;
    if (outcome.outcome === 'accepted') {
      installPromptEvent = null;
      toast('설치되었습니다!', { kind: 'success' });
    }
    toast_el.classList.remove('show');
    toast_el.addEventListener('transitionend', () => toast_el.remove(), { once: true });
  };

  toast_el.appendChild(message);
  toast_el.appendChild(button);
  layer.appendChild(toast_el);
  requestAnimationFrame(() => toast_el.classList.add('show'));

  // 자동 닫기 (10초)
  setTimeout(() => {
    if (toast_el.parentNode) {
      toast_el.classList.remove('show');
      toast_el.addEventListener('transitionend', () => toast_el.remove(), { once: true });
    }
  }, 10000);
}
