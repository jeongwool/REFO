/**
 * marketing-agent.ts — Pi Extension: 마케팅 콘텐츠 리팩토링 도구
 * =============================================================================
 *
 * pi 코어(에이전트 루프·세션·LLM 호출)는 pi가 제공하고,
 * 우리는 도구 2개만 등록합니다.
 *
 *   search_content  : DuckDuckGo로 키워드 관련 콘텐츠 검색 (MCP 서버 경유)
 *   refactor_content: 검색된 소스를 채널별로 SEO 최적화 리팩토링
 *
 * 실행:
 *   pi -e extensions/marketing-agent.ts --skill skills/content-refactor -p "월드컵 관련 콘텐츠 검색해서 SEO 블로그로 리팩토링해줘"
 */
 
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

/** content 헬퍼 */
function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], details: {}, isError };
}
 
export default function (pi: ExtensionAPI) {
 
  // ── 도구 1: 웹 검색 ────────────────────────────────────────────────
  pi.registerTool({
    name: "search_content",
    label: "Search Content",
    description: "키워드로 관련 블로그/웹페이지를 검색한다. 리팩토링할 소스를 찾을 때 사용한다.",
    parameters: Type.Object({
      query: Type.String({ description: "검색 키워드. 예: '월드컵 2022 하이라이트'" }),
      page: Type.Optional(Type.Number({ description: "페이지 번호 (기본값 0, 5개씩 슬라이싱)" })),
    }),
    execute: async (_id, params) => {
      try {
        const res = await fetch("http://localhost:3000/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: params.query, page: params.page ?? 0 }),
        });
        if (!res.ok) throw new Error(`검색 서버 오류: ${res.status}`);
        const data = await res.json() as { results: Array<{ title: string; description: string; url: string }> };
        if (!data.results?.length) return textResult("검색 결과가 없습니다.");
 
        const formatted = data.results
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\n${r.url}`)
          .join("\n\n");
        return textResult(formatted);
      } catch (e: any) {
        return textResult(`[도구 오류] ${e.message}`, true);
      }
    },
  });
 
  // ── 도구 2: 콘텐츠 리팩토링 ────────────────────────────────────────
  pi.registerTool({
    name: "refactor_content",
    label: "Refactor Content",
    description: "원본 콘텐츠를 SEO 블로그 / 인스타그램 / X(트위터) 채널에 맞게 리팩토링한다.",
    parameters: Type.Object({
      title: Type.String({ description: "원본 콘텐츠 제목" }),
      description: Type.String({ description: "원본 콘텐츠 내용 요약" }),
      url: Type.String({ description: "원본 콘텐츠 URL" }),
      channels: Type.Array(
        Type.Union([
          Type.Literal("blog"),
          Type.Literal("instagram"),
          Type.Literal("x"),
        ]),
        { description: "변환할 채널 목록. 예: ['blog', 'instagram']" }
      ),
    }),
    execute: async (_id, params) => {
      try {
        const res = await fetch("http://localhost:3000/api/refactor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: { title: params.title, description: params.description, url: params.url },
            channels: params.channels,
          }),
        });
        if (!res.ok) throw new Error(`리팩토링 서버 오류: ${res.status}`);
        const data = await res.json() as { result: string };
        return textResult(data.result);
      } catch (e: any) {
        return textResult(`[도구 오류] ${e.message}`, true);
      }
    },
  });
}
 