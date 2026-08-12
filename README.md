# factagora-legal-demo

Factagora API를 **한국 법률 인용 검증** 도메인에서 평가하는 독립 벤치마크.

프로젝트윤이 운영하는 [법률 절차 길잡이](https://github.com/yuneunmi814-cmyk/legal-navigator-mcp)의
사람 검증 코퍼스(판례 194 · 법령 258 · 주제 256)를 골드셋으로 쓴다.

> ⚠️ 이 저장소는 **공모전 본선 코드(legal-navigator-mcp)와 분리**되어 있다.
> 본선 서버는 무상태·외부 의존 0을 안정성 강점으로 삼고 있어, 외부 API 호출을 넣지 않는다.
> 여기서는 코퍼스를 **읽기만** 하고 본선 레포는 수정하지 않는다.

## 왜 이 벤치마크인가

사건번호는 실재 여부가 확정된 사실이다. 따라서 검증된 판례 코퍼스는 그대로
정답이 고정된 골드셋이 된다.

| 트랙 | 입력 | 정답 |
|---|---|---|
| 실재 인용 | 코퍼스에 수록된 사건번호 | `TRUE` |
| 허구 인용 | 형식만 그럴듯한 가짜 사건번호 | `FALSE` 또는 `UNCERTAIN` |

허구 인용을 `TRUE`로 판정하면 환각이고, 실재 인용을 못 찾으면 커버리지 공백이다.
둘을 나눠서 재는 것이 핵심 — 한쪽만 보면 "전부 UNCERTAIN"이라고 답하는 검증기가
만점을 받는다.

## 실행

```bash
node src/benchmark.mjs
```

키 없이 도는 드라이런. 보낼 요청과 로컬 검증기 채점 결과를 보여주고 크레딧을 쓰지 않는다.

```bash
FACTAGORA_API_KEY=fa_... node src/benchmark.mjs --live --limit 5
```

실제 호출. **Fact Checker는 호출당 2크레딧**이고 `--limit N`이면 실재 N + 허구 N건이므로
`N × 4` 크레딧이 든다. 가입 시 무료 100크레딧이 자동 발급되므로(카드 불필요)
`--limit 5`(20크레딧)로 시작할 것.

결과는 `data/benchmark-result.json`에 저장된다.

## 코퍼스 갱신

법률 길잡이 데이터가 바뀌면 다시 뽑는다. 본선 레포에는 파일을 만들지 않는다.

```bash
cd ~/Projects/legal-navigator-mcp && npx tsx ../factagora-legal-demo/scripts/export-corpus.mts
```

## 구성

- `src/factagora.mjs` — Fact Checker · Evidence Finder 클라이언트. 키는 환경변수에서만 읽는다.
- `src/benchmark.mjs` — 골드셋 구성 · 채점 · 리포트.
- `scripts/export-corpus.mts` — 법률 길잡이 코퍼스 → `data/corpus.json`.
- `data/corpus.json` — 추출된 코퍼스(생성물).
