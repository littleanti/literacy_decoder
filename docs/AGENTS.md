<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-25 | Updated: 2026-04-25 -->

# docs

## Purpose
6단계 문해력 해독기 게임의 기획 / 설계 / 개발 계획 문서. 실제 코드에는 영향을 주지 않으며, 상위 `../AGENTS.md`를 PRD/TRD/PLAN 세 문서로 분해한 결과물이다 (1단계 `1_chosung_quiz/docs/` 컨벤션 준수).

## Key Files

| File | Description |
|------|-------------|
| `PRD.md` | 제품 요구사항 문서. 타겟 / 시나리오 / 기능(P0-P2) / 성공 지표 / 범위 제한 |
| `TRD.md` | 기술 설계 문서. 스택, 모듈 구조, 데이터 스키마, 핵심 알고리즘. **§8에 수동 테스트 체크리스트** 포함 |
| `PLAN.md` | 개발 계획 (Phase 0 ~ Phase 6) + 인접 단계(4 / 5 / 7) 통합 체크리스트 |

## Cross-Stage Integration

본 게임은 7단계 학습 로드맵의 6번째 단계로, 다음 인접 단계와 데이터 / 스키마 호환을 유지한다:

| 인접 단계 | 통합 방향 | 상세 |
|---|---|---|
| `../../4_morpheme_detective/` | 한자 마스터 DB | 본 단계 Phase 0이 출발점 스키마 제안 |
| `../../5_vocabulary_tree/` | IndexedDB 진척도 / SRL 스케줄 | 호환 가능 스키마 |
| `../../7_four-character_idiom_crossword/` | 사자성어 데이터 import, 게이트웨이 | 보스 스테이지 통과 → 7단계 진입 권한 |

## For AI Agents

### Working In This Directory
- 코드 변경과 무관하게 문서만 업데이트하는 것은 자유롭게 가능
- 수동 테스트 체크리스트는 `TRD.md` §8을 기준으로 한다
- 자동화 테스트 런너 없음 — 새 기능 추가 시 TRD §8에 체크리스트 항목도 추가 권장
- 새로운 Phase 추가 시 `PLAN.md`의 마일스톤 표 + 해당 Phase 섹션 동시 업데이트
- 데이터 스키마 변경은 5 / 7단계와의 호환 영향을 PLAN 마지막 절(Cross-Stage 통합 체크리스트)에 반영
- **시리즈 공통 UI**: `TRD.md §11 홈·설정·완료 화면 디자인 시스템`과 `PLAN.md` 디자인 일관성 체크리스트에 start/end-screen 규격이 명시됨.

### Document Conventions
- 한국어 본문, 영어 식별자 / 코드
- 표는 GitHub-flavored Markdown
- 코드 블록은 언어 명시 (`js`, `jsonc`, `css`, `html`)
- Phase 체크박스는 `- [ ]` / `- [x]` 형식

<!-- MANUAL: -->
