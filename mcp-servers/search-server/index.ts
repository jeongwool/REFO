import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID     || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

const server = new Server(
  { name: "search-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function searchNaver(query: string, page: number = 0): Promise<Array<{title: string; description: string; url: string}>> {
  const start = page * 5 + 1; // 네이버 API는 1부터 시작
  const params = new URLSearchParams({
    query,
    display: '5',
    start:   String(start),
    sort:    'sim',
  });

  const res = await fetch(`https://openapi.naver.com/v1/search/webkr.json?${params}`, {
    headers: {
      'X-Naver-Client-Id':     NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
    }
  });

  if (!res.ok) throw new Error(`네이버 API 오류: ${res.status}`);

  const data = await res.json() as { items: Array<{title: string; description: string; link: string}> };

  return (data.items || []).map(item => ({
    title:       item.title.replace(/<[^>]*>/g, ''),       // HTML 태그 제거
    description: item.description.replace(/<[^>]*>/g, ''),
    url:         item.link,
  }));
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "search_web",
    description: "키워드로 웹 검색 (네이버 검색 API)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string",  description: "검색 키워드" },
        page:  { type: "number", description: "페이지 번호 (0부터 시작)" }
      },
      required: ["query"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_web") {
    const args = (request.params.arguments || {}) as { query: string; page?: number };
    const results = await searchNaver(args.query, args.page ?? 0);
    return {
      content: [{ type: "text", text: JSON.stringify(results) }]
    };
  }
  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Search Server (Naver) running on stdio");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});