# NEIS 프록시 설정 가이드

SPORTS·EDU 대시보드(index.html)의 **급식·시간표·학사일정**은 교육부 NEIS Open API에서 데이터를 가져옵니다.
인증키가 노출되지 않도록 `proxy-worker.js`(Cloudflare Worker)를 중계 서버로 사용합니다.

> ⚠️ **인증키는 절대 index.html 이나 저장소 코드에 직접 넣지 마세요.** 아래 절차대로 Worker의 Secret 에만 넣습니다.

---

## 1단계. NEIS 인증키 발급

1. [NEIS Open API 포털](https://open.neis.go.kr) 접속 후 회원가입 / 로그인
2. 상단 메뉴에서 **인증키 신청(활용신청)** 진행
3. 발급된 **인증키(KEY)** 를 복사해 둡니다. (이 값은 본인만 보관하세요)

> 계정 생성·로그인·키 발급은 개인정보가 포함되므로 반드시 본인이 직접 진행해야 합니다.

---

## 2단계. Cloudflare Worker 배포

### 방법 A) 대시보드에서 (가장 쉬움)
1. [Cloudflare 대시보드](https://dash.cloudflare.com) 로그인 → **Workers & Pages** → **Create** → **Create Worker**
2. 기본 코드 대신 이 저장소의 `proxy-worker.js` 내용을 붙여넣고 **Deploy**
3. 배포된 Worker의 **Settings → Variables and Secrets** 로 이동
4. **Add** → 타입을 **Secret** 으로 선택 → 이름 `NEIS_KEY`, 값에 1단계에서 발급받은 인증키 입력 → 저장
5. 다시 배포(**Deploy**)하면 `https://이름.계정.workers.dev` 형태의 주소가 생깁니다.

### 방법 B) Wrangler CLI 사용
```bash
npm install -g wrangler
wrangler login
# proxy-worker.js 가 있는 폴더에서:
wrangler deploy proxy-worker.js --name sport-edu-proxy
wrangler secret put NEIS_KEY   # 프롬프트에 인증키 입력
```

---

## 3단계. index.html 에 프록시 주소 입력

`index.html` 상단 스크립트에서 아래 줄을 찾아,

```js
const PROXY = ""; // 프록시 배포 후 URL 입력
```

배포된 Worker 주소로 바꿉니다. (끝에 슬래시 `/` 없이)

```js
const PROXY = "https://sport-edu-proxy.본인계정.workers.dev";
```

저장·커밋하면 로그인 화면에서 학교를 검색·선택한 뒤 급식·시간표·학사일정이 실제로 표시됩니다.

---

## 동작 확인

브라우저 주소창에서 아래처럼 직접 호출해 JSON 이 오면 정상입니다.

```
https://sport-edu-proxy.본인계정.workers.dev/schoolInfo?SCHUL_NM=해밀고
```

| 기능 | NEIS 엔드포인트 |
| --- | --- |
| 학교 검색 | schoolInfo |
| 급식 | mealServiceDietInfo |
| 시간표(고/중/초) | hisTimetable / misTimetable / elsTimetable |
| 학사일정 | SchoolSchedule |

---

## 보안 메모

- 인증키는 Worker Secret(`NEIS_KEY`)에만 저장됩니다. 브라우저·저장소에는 노출되지 않습니다.
- 배포 후에는 `proxy-worker.js` 의 `Access-Control-Allow-Origin` 값을 `"*"` 대신 본인 사이트 주소(예: GitHub Pages 주소)로 제한하면 더 안전합니다.
- 날씨·미세먼지는 NEIS 와 별개로 기상청/에어코리아 등의 별도 API 키가 필요하며, 추후 같은 방식(프록시)으로 추가할 수 있습니다.
