// 법률 길잡이(legal-navigator-mcp)의 검증된 코퍼스를 JSON으로 추출한다.
// 본선 레포는 읽기만 하고 어떤 파일도 수정하지 않는다.
//   실행: cd ~/Projects/legal-navigator-mcp && npx tsx ../factagora-legal-demo/scripts/export-corpus.mts

import { writeFileSync, mkdirSync } from "node:fs";
import { PRECEDENTS, STATUTES, PROCEDURES, TOPICS } from "/Users/piglet/Projects/legal-navigator-mcp/src/data/index.ts";

const OUT_DIR = "/Users/piglet/Projects/factagora-legal-demo/data";
const OUT = `${OUT_DIR}/corpus.json`;

const precedents: Array<{ topic: string; 법원: string; 사건번호: string; 요지: string }> = [];
for (const [topic, arr] of Object.entries(PRECEDENTS)) {
  for (const p of arr) precedents.push({ topic, ...p });
}

const corpus = {
  exportedAt: new Date().toISOString().slice(0, 10),
  source: "legal-navigator-mcp — 프로젝트윤이 사람 손으로 검증한 생활법률 코퍼스",
  counts: {
    precedents: precedents.length,
    statutes: STATUTES.length,
    topics: Object.keys(PROCEDURES).length,
  },
  precedents,
  statutes: STATUTES,
  topics: TOPICS.map((t) => ({ key: t.key, category: (t as { category?: string }).category })),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(corpus, null, 2));

console.log("내보냄:", OUT);
console.log("건수:", JSON.stringify(corpus.counts));
console.log("판례 샘플:", JSON.stringify(precedents[0]));
console.log("법령 샘플:", JSON.stringify(STATUTES[0]));
