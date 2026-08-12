// Factagora Fact Checker를 한국 법률 인용 도메인에서 벤치마크한다.
//
// 왜 이 벤치마크인가:
//   법률 길잡이는 사람이 검증한 판례 194건·법령 258건을 들고 있다. 사건번호가 실재하는지가
//   확정되어 있으므로, "실재 인용 → TRUE"와 "지어낸 인용 → FALSE/UNCERTAIN"이 정답으로
//   고정된 골드셋이 된다. 뉴스 코퍼스 기반 검증기가 이 도메인에서 어디까지 되는지 측정한다.
//
//   실행(키 없이 드라이런):  node src/benchmark.mjs
//   실행(실호출, 크레딧 소모): FACTAGORA_API_KEY=fa_... node src/benchmark.mjs --live --limit 5
//
//   크레딧: Fact Checker 2크레딧/호출. --limit N 이면 (실재 N + 허구 N) × 2 크레딧.
//   무료 가입 크레딧이 100이므로 --limit 5(20크레딧)로 시작할 것.

import { readFileSync } from "node:fs";
import { factCheck, dryRunRequest, hasKey } from "./factagora.mjs";

const CORPUS = JSON.parse(
  readFileSync(new URL("../data/corpus.json", import.meta.url), "utf8"),
);

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const LIMIT = Number(args[args.indexOf("--limit") + 1]) || 5;

// ── 골드셋 구성 ────────────────────────────────────────────────────────────
// 코퍼스에서 고르게 뽑기 위해 균등 간격 샘플링(무작위 X — 실행마다 결과가 바뀌면 비교가 안 됨).
function evenSample(arr, n) {
  if (arr.length <= n) return arr.slice();
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// 실재 인용: 코퍼스에 수록되어 사건번호가 확인된 판례.
const real = evenSample(CORPUS.precedents, LIMIT).map((p) => ({
  kind: "실재",
  citation: `${p.법원} ${p.사건번호}`,
  topic: p.topic,
  claim: `대한민국 ${p.법원} ${p.사건번호} 판결은 실재하는 판례다.`,
  expected: "TRUE",
  요지: p.요지.slice(0, 80),
}));

// 허구 인용 — 두 종류로 나눈다. 대조군의 '정답'이 얼마나 단단한지가 다르기 때문이다.
//
//  ① 미래연도(hard): 사건번호 앞자리는 접수 연도다. 오늘이 2026-08이므로 2028년 이후
//     접수 사건은 존재할 수 없다. 정답이 논리적으로 확정된다 — 반박 불가능한 대조군.
//  ② 미수록(soft): 형식은 그럴듯하나 우리 코퍼스에 없는 번호. 한국 법원은 연간 수십만 건을
//     처리하므로 "코퍼스에 없다 ≠ 존재하지 않는다". 정답이 약하므로 별도 집계하고,
//     리포트에서도 이 한계를 그대로 표시한다.
const 실재사건번호 = new Set(CORPUS.precedents.map((p) => p.사건번호.replace(/\s|\(.*?\)/g, "")));
const half = Math.ceil(LIMIT / 2);

const fakeFuture = Array.from({ length: half }, (_, i) => {
  const 사건번호 = `${2028 + i}다${10000 + i * 3137}`;
  return {
    kind: "미래연도",
    citation: `대법원 ${사건번호}`,
    topic: "-",
    claim: `대한민국 대법원 ${사건번호} 판결은 실재하는 판례다.`,
    expected: "NOT_TRUE",
    요지: "(미래 접수연도 — 오늘 기준 존재 불가)",
  };
});

const fakePlausible = [];
for (let i = 0; fakePlausible.length < LIMIT - half && i < 500; i++) {
  const 사건번호 = `${2015 + (i % 10)}다${String(100000 + i * 7919).slice(0, 6)}`;
  if (실재사건번호.has(사건번호)) continue;
  fakePlausible.push({
    kind: "미수록",
    citation: `대법원 ${사건번호}`,
    topic: "-",
    claim: `대한민국 대법원 ${사건번호} 판결은 실재하는 판례다.`,
    expected: "NOT_TRUE",
    요지: "(코퍼스 미수록 — 실재 여부는 미확인)",
  });
}

const fake = [...fakeFuture, ...fakePlausible];

const goldset = [...real, ...fake];

// ── 로컬 검증기(법률 길잡이 verify_citation과 동일한 원리) ────────────────
function localVerify(citation) {
  const nq = citation.replace(/\s|\(.*?\)/g, "");
  for (const p of CORPUS.precedents) {
    const core = p.사건번호.replace(/\s|\(.*?\)/g, "").split(",")[0];
    if (core && nq.includes(core)) return { verdict: "TRUE", source: `수록확인 (주제: ${p.topic})` };
  }
  return { verdict: "UNVERIFIED", source: "미수록 — 공식 조회 안내(law.go.kr·casenote.kr)" };
}

function graded(expected, verdict) {
  if (expected === "TRUE") return verdict === "TRUE";
  return verdict === "FALSE" || verdict === "UNCERTAIN"; // 허구는 TRUE만 아니면 정답
}

// ── 실행 ───────────────────────────────────────────────────────────────────
console.log("═".repeat(74));
console.log("Factagora Fact Checker × 한국 법률 인용 벤치마크");
console.log(`코퍼스: ${CORPUS.source}`);
console.log(`        판례 ${CORPUS.counts.precedents} · 법령 ${CORPUS.counts.statutes} · 주제 ${CORPUS.counts.topics} (기준일 ${CORPUS.exportedAt})`);
console.log(`골드셋: 실재 인용 ${real.length} + 허구 인용 ${fake.length} = ${goldset.length}건`);
console.log("═".repeat(74));

if (!LIVE || !hasKey()) {
  console.log();
  console.log(hasKey()
    ? "드라이런(--live 를 붙이면 실제 호출). 크레딧 소모 없음."
    : "드라이런 — FACTAGORA_API_KEY 가 없습니다. 크레딧 소모 없음.");
  console.log("factagora.com 가입 시 무료 100크레딧이 자동 발급됩니다(카드 불필요).");
  console.log();
  console.log("─ 보낼 요청 예시 ─".padEnd(74, "─"));
  console.log(dryRunRequest("/fact-checker", { claim: goldset[0].claim, language: "korean", limit: 5 }));
  console.log();
  console.log("─ 로컬 검증기(법률 길잡이)만 먼저 채점 ─".padEnd(70, "─"));
  let localOk = 0;
  for (const item of goldset) {
    const l = localVerify(item.citation);
    const ok = item.expected === "TRUE" ? l.verdict === "TRUE" : l.verdict !== "TRUE";
    if (ok) localOk++;
    console.log(`${ok ? "✅" : "❌"} [${item.kind}] ${item.citation.padEnd(28)} → ${l.verdict}`);
  }
  console.log();
  console.log(`로컬 정확도: ${localOk}/${goldset.length} (${Math.round((localOk / goldset.length) * 100)}%)`);
  console.log(`예상 크레딧(실호출 시): ${goldset.length * 2}`);
  process.exit(0);
}

const rows = [];
for (const item of goldset) {
  const local = localVerify(item.citation);
  let fa;
  try {
    const r = await factCheck({ claim: item.claim, language: "korean", limit: 5 });
    fa = {
      verdict: r.verdict,
      confidence: r.confidence,
      summary: (r.summary || "").replace(/\s+/g, " ").slice(0, 110),
      ms: r.meta?.executionTimeMs ?? r._elapsedMs,
      sources: (r.sources || []).length,
    };
  } catch (e) {
    fa = { verdict: "ERROR", confidence: 0, summary: String(e.message).slice(0, 110), ms: e.elapsedMs ?? 0, sources: 0 };
  }
  rows.push({ ...item, local, fa });
  const ok = graded(item.expected, fa.verdict);
  console.log(`${ok ? "✅" : "❌"} [${item.kind}] ${item.citation}`);
  console.log(`    Factagora: ${fa.verdict} (conf ${fa.confidence}, ${fa.ms}ms, 소스 ${fa.sources})`);
  console.log(`    로컬     : ${local.verdict}`);
  if (fa.summary) console.log(`    요약     : ${fa.summary}`);
}

const faOk = rows.filter((r) => graded(r.expected, r.fa.verdict)).length;
const localOk = rows.filter((r) => (r.expected === "TRUE" ? r.local.verdict === "TRUE" : r.local.verdict !== "TRUE")).length;
const avgMs = Math.round(rows.reduce((s, r) => s + (r.fa.ms || 0), 0) / rows.length);
const byKind = (k) => {
  const g = rows.filter((r) => r.kind === k);
  return { ok: g.filter((r) => graded(r.expected, r.fa.verdict)).length, n: g.length };
};
const 실재 = byKind("실재"), 미래 = byKind("미래연도"), 미수록 = byKind("미수록");

// 오탐(허구를 TRUE로 확정)의 근거 소스 수 — 실패 원인 진단용.
const 오탐 = rows.filter((r) => r.expected === "NOT_TRUE" && r.fa.verdict === "TRUE");
const 정탐hedge = rows.filter((r) => r.expected === "NOT_TRUE" && r.fa.verdict !== "TRUE");
const avgSrc = (a) => (a.length ? (a.reduce((s, r) => s + r.fa.sources, 0) / a.length).toFixed(1) : "-");
const avgConf = (a) => (a.length ? (a.reduce((s, r) => s + r.fa.confidence, 0) / a.length).toFixed(2) : "-");

console.log();
console.log("═".repeat(74));
console.log("결과");
console.log(`  Factagora Fact Checker : ${faOk}/${rows.length} (${Math.round((faOk / rows.length) * 100)}%)`);
console.log(`    ├ 실재 인용을 TRUE로        : ${실재.ok}/${실재.n}`);
console.log(`    ├ 미래연도(존재 불가) 차단  : ${미래.ok}/${미래.n}   ← 정답이 논리적으로 확정된 대조군`);
console.log(`    └ 미수록 번호 차단          : ${미수록.ok}/${미수록.n}   ← 실재 여부 미확인(참고용)`);
console.log(`  로컬 검증기(수작업 코퍼스): ${localOk}/${rows.length} (${Math.round((localOk / rows.length) * 100)}%)`);
console.log(`  평균 응답: ${avgMs}ms · 소모 크레딧: ${rows.length * 2}`);
console.log("─".repeat(74));
console.log("실패 패턴 진단");
console.log(`  존재하지 않는 인용을 TRUE로 확정: ${오탐.length}건 · 평균 소스 ${avgSrc(오탐)}개 · 평균 confidence ${avgConf(오탐)}`);
console.log(`  올바르게 유보(FALSE/UNCERTAIN) : ${정탐hedge.length}건 · 평균 소스 ${avgSrc(정탐hedge)}개 · 평균 confidence ${avgConf(정탐hedge)}`);
console.log("  → 소스를 못 찾으면 유보하지만, 사건번호 '형식'에 관한 일반 문서를 찾으면");
console.log("     그것을 개별 사건 존재의 근거로 오인하는 경향(class→instance 치환).");
console.log("═".repeat(74));

const outPath = new URL("../data/benchmark-result.json", import.meta.url);
const { writeFileSync } = await import("node:fs");
writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), rows, summary: { faOk, localOk, total: rows.length, avgMs } }, null, 2));
console.log(`상세 결과 저장: ${outPath.pathname}`);
