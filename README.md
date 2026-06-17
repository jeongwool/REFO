# REFO-V3 — 마케팅 콘텐츠 리팩토링 에이전트

> 기존 콘텐츠를 네이버 블로그 · 티스토리 · 인스타그램 · X(트위터) 수익형 콘텐츠로 즉시 변환하는 Pi 프레임워크 기반 AI 에이전트

---

## 1. 프로젝트 소개

**REFO-V3**는 트렌드에 뒤처진 마케팅 콘텐츠나 블로그 글을 실시간으로 수집·분석하여, 각 마케팅 채널의 특성에 맞는 수익형 콘텐츠로 재창작(Refactoring)하는 **Pi 프레임워크 기반 지능형 마케팅 에이전트**입니다.

키워드를 입력하면 **네이버 검색 API**를 통해 관련 소스를 실시간으로 수집하고, **Ollama(Qwen)** 모델이 채널별 최적 톤앤매너로 콘텐츠를 변환합니다. ChatGPT 스타일의 직관적인 Web UI를 통해 누구나 원클릭으로 멀티채널 콘텐츠를 생성할 수 있습니다.

---

## 2. 사용한 기술 스택

| 구분 | 기술 |
|------|------|
| **Agent Framework** | Pi Framework (`@earendil-works/pi-coding-agent`) |
| **Frontend (Web UI)** | Vanilla JS, HTML5, CSS3 |
| **Backend** | Node.js, Express |
| **MCP Server** | TypeScript, `@modelcontextprotocol/sdk` |
| **검색 API** | 네이버 검색 Open API |
| **AI 모델** | Ollama (`qwen2.5:3b`) |

---

## 3. Pi / Skill / MCP / Pi Extension 활용 설명

### Pi Framework
`@earendil-works/pi-coding-agent` SDK를 활용하여 에이전트 루프를 구성합니다. `pi-config.json`에 MCP 서버와 Extension, Skill을 등록하고, `--provider ollama --model qwen2.5:3b` 옵션으로 로컬 LLM과 연결합니다.

### Skill (`skills/content-refactor/`)
`content-refactor.skill` 및 `SKILL.md`에 채널별 전문 지식을 정의합니다. 에이전트가 작업 순서(검색 → 소스 선택 → 채널별 리팩토링 → 결과 전달)를 일관되게 수행하도록 절차와 규칙을 주입합니다.

- **네이버 블로그**: 검색 키워드 자연 배치, H2 소제목 3개 이상, 독자 공감 톤
- **티스토리**: 구글 SEO 최적화, H2/H3 목차 구조, 정보성 중심
- **인스타그램**: 첫 줄 후킹, 이모지 배치, 해시태그 7~10개
- **X (Twitter)**: 숫자 스레드 분절(1/ 2/ 3/), 200자 이내 임팩트 트윗

### MCP (`mcp-servers/search-server/`)
`@modelcontextprotocol/sdk`로 구현한 커스텀 MCP 서버입니다. **네이버 검색 Open API**를 래핑한 `search_web` 도구를 제공하며, 5개씩 슬라이싱하는 페이징 메커니즘이 내장되어 있습니다. `server.js`가 stdio child process로 MCP 서버를 호출하여 JSON-RPC 프로토콜로 통신합니다.

```
server.js  →  MCP child process (stdio)  →  네이버 검색 API
```

### Pi Extension (`extensions/marketing-agent/`)
`manifest.json` 기반의 Pi Extension 규격으로 Web UI를 제공합니다. `search_content`, `refactor_content` 두 가지 도구를 `pi.registerTool()`로 등록하고, 브라우저에서 `pi.callTool` / `pi.chat`으로 에이전트와 실시간 통신합니다.

---

## 4. 주요 기능

1. **실시간 소스 검색** — 키워드 입력 시 네이버 검색 API로 관련 글 5개를 즉시 수집
2. **소스 미리보기** — 선택 전 제목·요약·URL을 모달로 확인 가능
3. **다음 결과 보기** — 마음에 드는 소스가 없으면 `다음 5개` 버튼으로 페이지 넘김
4. **멀티채널 동시 변환** — 네이버 블로그 · 티스토리 · 인스타그램 · X 중 복수 선택하여 동시 생성
5. **채널별 최적화 콘텐츠** — 각 플랫폼 특성에 맞는 톤앤매너 · 구조 · 분량으로 자동 변환
6. **마크다운 렌더링** — 결과를 마크다운으로 파싱하여 제목 · 리스트 · 굵게 등 시각적으로 표시
7. **원클릭 복사** — 마크다운 기호 없이 깔끔한 텍스트로 클립보드 복사

---

## 5. 설치 방법

### 사전 요구사항
- Node.js 18 이상
- [Ollama](https://ollama.com) 설치 및 실행
- 네이버 검색 Open API 키 ([발급 링크](https://developers.naver.com))

### 설치

```bash
# 1. 저장소 클론
git clone https://github.com/YOUR_USERNAME/refo-v3.git
cd refo-v3

# 2. 루트 패키지 설치
npm install

# 3. MCP 서버 패키지 설치
cd mcp-servers/search-server
npm install
cd ../..
```

### 환경변수 설정

루트에 `.env` 파일을 생성하고 아래 내용을 입력합니다.

```env
OLLAMA_MODEL=qwen2.5:3b
NAVER_CLIENT_ID=발급받은_Client_ID
NAVER_CLIENT_SECRET=발급받은_Client_Secret
```

---

## 6. 실행 방법

### Step 1 — Ollama 실행

```bash
ollama serve
ollama pull qwen2.5:3b
```

### Step 2 — MCP 서버 빌드

```bash
npm run build
```

### Step 3 — 에이전트 서버 실행

```bash
npm start
```

브라우저에서 `http://localhost:3001` 접속

---

## 7. 실행 화면 또는 스크린샷

### 초기 화면 — 중앙 검색 입력창
키워드를 입력하거나 추천 칩을 클릭하면 검색이 시작됩니다.

![alt text](image.png)

### 소스 수집 화면 — 검색 결과 카드
네이버 API에서 수집한 소스 5개가 카드로 표시됩니다. 미리보기 버튼으로 내용을 확인하고 소스를 선택합니다.

![alt text](image-1.png)

### 리팩토링 결과 화면 — 채널별 탭
선택한 채널별로 변환된 콘텐츠가 탭으로 구분되어 표시됩니다. 복사 버튼으로 즉시 사용할 수 있습니다.

![alt text](image-2.png)
![alt text](image-3.png)
---

## 프로젝트 구조

```
REFO-V3/
├── extensions/marketing-agent/
│   ├── public/
│   │   ├── index.html          # Web UI
│   │   └── client.js           # 프론트엔드 로직
│   ├── src/index.js            # Extension 진입점
│   ├── manifest.json           # Pi Extension 규격
│   └── marketing-agent.ts      # Pi 도구 등록
├── mcp-servers/search-server/
│   ├── index.ts                # MCP 서버 (네이버 검색 API)
│   ├── package.json
│   └── tsconfig.json
├── skills/content-refactor/
│   ├── content-refactor.skill  # 에이전트 Skill
│   └── SKILL.md                # 채널별 리팩토링 규칙
├── server.js                   # Express 백엔드
├── package.json
├── pi-config.json              # Pi 에이전트 설정
├── .mcp.json                   # MCP 서버 등록
└── .env                        # 환경변수 (gitignore)
```