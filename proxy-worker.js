/**
 * SPORTS·EDU - NEIS API 프록시 (Cloudflare Worker)
 * ------------------------------------------------------------------
 * 역할:
 *   1) 브라우저 -> 이 Worker -> NEIS Open API 로 요청을 중계
 *   2) NEIS 인증키(KEY)를 코드가 아닌 Worker Secret 에 숨겨 유출 방지
 *   3) 응답에 CORS 헤더를 붙여 GitHub Pages 등 정적 사이트에서 호출 가능
 *
 * 배포 후: index.html 의  const PROXY = "";  값에
 *          이 Worker 주소(예: https://sport-edu-proxy.xxx.workers.dev)를 넣으세요.
 *
 * 필요한 Secret:  a8514d2424554abc8a77d3d3e785b81e  (open.neis.go.kr 에서 발급받은 인증키)
 *   설정 방법:  wrangler secret put NEIS_KEY
 *              또는 Cloudflare 대시보드 > Worker > Settings > Variables 에서 추가
 * ------------------------------------------------------------------
 */

// 프록시가 중계를 허용할 NEIS 엔드포인트 화이트리스트 (오남용 방지)
const ALLOWED = new Set([
  "schoolInfo",            // 학교 검색
  "mealServiceDietInfo",   // 급식
  "hisTimetable",          // 고등학교 시간표
  "misTimetable",          // 중학교 시간표
  "elsTimetable",          // 초등학교 시간표
  "SchoolSchedule"         // 학사일정
]);

const NEIS_BASE = "https://open.neis.go.kr/hub/";

// CORS 헤더. 배포 후 특정 도메인만 허용하려면 "*" 를 본인 사이트 주소로 바꾸세요.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    // 프리플라이트(OPTIONS) 처리
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET") {
      return json({ error: "GET 요청만 허용됩니다." }, 405);
    }

    const url = new URL(request.url);
    // 경로 형식:  /<endpoint>?<params>   예) /schoolInfo?SCHUL_NM=해밀고
    const endpoint = url.pathname.replace(/^\/+/, "").split("/")[0];

    if (!endpoint) {
      return json({ error: "엔드포인트가 없습니다.", allowed: [...ALLOWED] }, 400);
    }
    if (!ALLOWED.has(endpoint)) {
      return json({ error: "허용되지 않은 엔드포인트입니다: " + endpoint, allowed: [...ALLOWED] }, 400);
    }
    if (!env.NEIS_KEY) {
      return json({ error: "서버에 NEIS_KEY Secret 이 설정되지 않았습니다." }, 500);
    }

    // 클라이언트가 보낸 쿼리 파라미터를 그대로 전달 + 인증키/포맷 주입
    const params = new URLSearchParams(url.search);
    params.set("KEY", env.NEIS_KEY);
    if (!params.has("Type")) params.set("Type", "json");
    if (!params.has("pIndex")) params.set("pIndex", "1");
    if (!params.has("pSize")) params.set("pSize", "100");

    const target = NEIS_BASE + endpoint + "?" + params.toString();

    try {
      const upstream = await fetch(target, {
        headers: { "Accept": "application/json" },
        cf: { cacheTtl: 300, cacheEverything: true } // 5분 캐시로 호출량 절감
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300"
        }
      });
    } catch (e) {
      return json({ error: "NEIS 요청 실패", detail: String(e) }, 502);
    }
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" }
  });
}
