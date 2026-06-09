> [!IMPORTANT]
> **이 저장소는 [`hangul_game`](https://github.com/littleanti/hangul_game) 모노레포로 통합되었습니다.**
> 앞으로 모든 개발·유지보수는 모노레포에서 진행되며, 이 저장소는 보관(archive)용입니다.
> 🎮 통합 플레이 사이트: https://littleanti.github.io/hangul_game/

# 📖 문해력 해독기 (Literacy Decoder)

> 초등 고학년 학습자가 흥미로운 지문 속 빈칸(미지 한자어)을 **문맥 단서 + 형태소 지식**으로 해독하며 직독직해를 자동화하는 웹 기반 학습 게임.

7단계 한글 학습 로드맵의 **6단계** (`5_vocabulary_tree` → `6_literacy_decoder` → `7_four-character_idiom_crossword`).

## 빠른 실행

```bash
npm run dev
# → http://localhost:4326
```

빌드 단계가 없습니다. 정적 파일을 그대로 호스팅하거나 `npx http-server .` 만으로 실행됩니다.

## 핵심 기능

- 학년별 (초5·초6) 지문 코퍼스 — 입문 / 중급 / 심화 3단계 난이도
- 빈칸(한자어) 추론 — 문맥 + 형태소 단서로 해독
- 형태소 도크 — 정답 + 디스트랙터(학습한 한자만) 카드 매칭
- 어원 풀이 팝업 — 정답 후 한자 분해 설명
- 사자성어 보스 스테이지 — 7단계 게이트웨이
- 학습 기록 대시보드 — 누적 어휘 / 정답률 / 읽기 속도 (Vanilla SVG)
- SRL 망각 곡선 — 1·3·7·14·30일 복습 큐
- TTS 지문 낭독 (Web Speech API)
- 루비 텍스트 + 한자 long-press 툴팁
- 폰트 크기 조절 (16 / 18 / 22px), 다크 모드, PWA

## 기술 스택

| 레이어 | 선택 |
|---|---|
| 언어 | Vanilla JavaScript (ES2022, ES Modules) |
| CSS | Vanilla CSS + CSS Variables (1단계 토큰 계승) |
| 폰트 | Google Fonts (Jua, Gowun Dodum) |
| 저장소 | IndexedDB (자체 래퍼) + localStorage |
| TTS | Web Speech API |

## 문서

- `docs/PRD.md` — 제품 요구사항
- `docs/TRD.md` — 기술 요구사항
- `docs/PLAN.md` — 개발 계획 및 진행 상태
- `AGENTS.md` — AI 에이전트 가이드
