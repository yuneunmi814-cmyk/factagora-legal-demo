// Factagora API 최소 클라이언트.
// 문서: https://docs.factagora.com  ·  인증: Authorization: Bearer fa_...
// 키는 환경변수 FACTAGORA_API_KEY 로만 읽는다(코드·저장소에 넣지 않음).

const BASE = "https://api.factagora.com/api/v1";
const TIMEOUT_MS = 30_000;

export function apiKey() {
  return process.env.FACTAGORA_API_KEY || null;
}

export function hasKey() {
  return !!apiKey();
}

async function post(path, body) {
  const key = apiKey();
  if (!key) throw new Error("FACTAGORA_API_KEY 미설정");
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const elapsedMs = Date.now() - started;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Factagora ${path} ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.elapsedMs = elapsedMs;
    throw err;
  }
  const json = await res.json();
  return { ...json, _elapsedMs: elapsedMs };
}

/** 주장의 진위 판정. 2 크레딧/호출. verdict: TRUE | FALSE | UNCERTAIN */
export function factCheck({ claim, language = "korean", limit = 5 }) {
  return post("/fact-checker", { claim, language, limit });
}

/** 주장에 대한 근거 소스 수집(신뢰도·스탠스 포함). 2 크레딧/호출. */
export function findEvidence({ claim, limit = 5, language = "korean", country = "KR" }) {
  return post("/evidence-finder", { claim, limit, language, country });
}

/** 키가 없을 때 실제로 보낼 요청을 보여주는 드라이런 표현. */
export function dryRunRequest(path, body) {
  return [
    `POST ${BASE}${path}`,
    `Authorization: Bearer fa_… (FACTAGORA_API_KEY)`,
    `Content-Type: application/json`,
    ``,
    JSON.stringify(body, null, 2),
  ].join("\n");
}
