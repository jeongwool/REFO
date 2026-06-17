import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'extensions/marketing-agent/public')));

// ── SQLite 초기화 ─────────────────────────────
const db = new Database(path.join(__dirname, 'history.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword     TEXT NOT NULL,
    source_title TEXT,
    source_url  TEXT,
    channels    TEXT,
    result      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── MCP 검색 서버 호출 (stdio transport) ─────────────────
async function callMcpSearch(query, page = 0) {
  return new Promise((resolve, reject) => {
    const mcpPath = path.join(__dirname, 'mcp-servers/search-server/dist/index.js');
    const child = spawn('node', [mcpPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    let buffer = '', errorOutput = '', settled = false;

    function done(val) { if (settled) return; settled = true; child.kill(); resolve(val); }
    function fail(msg) { if (settled) return; settled = true; child.kill(); reject(new Error(msg)); }

    child.stderr.on('data', d => { errorOutput += d.toString(); });
    child.stdout.on('data', d => {
      buffer += d.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const msg = JSON.parse(t);
          if (msg.id === 1 && msg.result) {
            child.stdin.write(JSON.stringify({ jsonrpc:'2.0', method:'notifications/initialized', params:{} }) + '\n');
            child.stdin.write(JSON.stringify({ jsonrpc:'2.0', id:2, method:'tools/call', params:{ name:'search_web', arguments:{ query, page } } }) + '\n');
          }
          if (msg.id === 2) {
            if (msg.error) fail('MCP 도구 오류: ' + JSON.stringify(msg.error));
            else { try { done(JSON.parse(msg.result?.content?.[0]?.text || '[]')); } catch { done([]); } }
          }
        } catch {}
      }
    });
    child.on('close', () => { if (!settled) fail('MCP 응답 파싱 실패: ' + (errorOutput || '응답 없음')); });
    child.on('error', e => fail('MCP 프로세스 오류: ' + e.message));
    child.stdin.write(JSON.stringify({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2024-11-05', capabilities:{}, clientInfo:{ name:'refo-server', version:'1.0.0' } } }) + '\n');
    setTimeout(() => fail('MCP 서버 타임아웃 (15s)'), 15000);
  });
}

// ── Ollama 호출 ───────────────────────────────
async function callOllama(prompt) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'qwen2.5:3b', prompt, stream: false })
  });
  if (!res.ok) throw new Error(`Ollama 서버 오류: ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

// ── API: 검색 ─────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { query, page = 0 } = req.body;
  if (!query) return res.status(400).json({ error: '키워드가 없습니다' });
  try {
    const raw = await callMcpSearch(query, page);
    const results = (Array.isArray(raw) ? raw : []).map(r => ({
      title:       r.title       || r.t || '제목 없음',
      description: r.description || r.excerpt || r.snippet || r.body || '',
      url:         r.url         || r.href || ''
    })).filter(r => r.url);
    res.json({ results });
  } catch (err) {
    console.error('[MCP 검색 오류]', err.message);
    res.status(500).json({ error: 'MCP 검색 오류: ' + err.message });
  }
});

// ── API: 리팩토링 ─────────────────────────────
app.post('/api/refactor', async (req, res) => {
  const { source, channels } = req.body;
  if (!source || !channels?.length) return res.status(400).json({ error: '소스 또는 채널이 없습니다' });

  const channelPrompts = {
    naver: `너는 월 수익 300만원 이상 버는 네이버 블로그 파워블로거야. 아래 소스를 참고해서 독자가 끝까지 읽고 싶은 네이버 블로그 글을 써줘.

톤앤매너:
- 친근하고 따뜻한 말투로, 독자에게 직접 말 걸듯이 써 (예: "혹시 이런 경험 있으세요?", "저도 처음엔 몰랐는데요!")
- 느낌표(!)와 물음표(?)를 자연스럽게 섞어서 생동감 있게
- 딱딱한 정보 나열 말고, 독자 고민을 먼저 공감한 다음 해결책 제시하는 흐름으로

구조 규칙:
- 제목: 숫자나 질문 형식으로 클릭을 부르는 제목 (예: "치킨 고를 때 이것만 보세요!")
- 도입부: 독자 공감 → 이 글 읽으면 뭐가 좋은지 한 줄로
- ## 소제목 3개 이상, 각 섹션마다 독자 질문 하나씩 포함
- 구체적인 수치, 실제 사례, 꿀팁 위주로
- 마무리: "오늘 알려드린 내용 도움이 됐나요? 댓글로 알려주세요! 😊" 식의 참여 유도
- 분량 700자 이상, 마크다운 형식`,

    tistory: `너는 구글 애드센스로 월 수익을 올리는 티스토리 블로그 전문가야. 아래 소스를 참고해서 검색 상위 노출되고 체류시간도 긴 티스토리 포스팅을 써줘.

톤앤매너:
- 네이버 블로그보다 조금 더 정보성이 강하되, 여전히 친근하게
- "~해보셨나요?", "알고 계셨나요?" 같은 독자 참여 문장 자주 활용
- 느낌표로 포인트 강조, 중요한 정보는 볼드 처리 힌트 남기기

구조 규칙:
- 제목: 검색 의도 + 궁금증 유발 (예: "치킨 브랜드 비교, 결국 이게 답이었다!")
- 목차(## 4개 이상)로 구조화, 각 섹션 시작은 독자 질문으로
- 핵심 정보는 리스트와 문단 교차로 가독성 확보
- 중간중간 "잠깐! 이것도 알아두세요 💡" 같은 팁 박스 느낌 포함
- 결론: 핵심 요약 + "여러분의 생각은 어떤가요?" 마무리
- 분량 800자 이상, 마크다운 형식`,

    instagram: `너는 팔로워 50만 인플루언서 전담 인스타그램 콘텐츠 마케터야. 아래 소스로 저장율, 공유율 다 잡는 인스타 캡션을 써줘.

톤앤매너:
- 첫 줄에서 무조건 멈추게 만들어야 해. 숫자 + 충격 or 공감 질문으로 시작
- 이모지 적극 활용 (각 줄마다 1~2개), 전체적으로 밝고 에너지 넘치게
- "저장해두면 나중에 후회 안 해요!🔖" 같은 자연스러운 CTA 필수

구조 규칙:
- 1줄: 후킹 (예: "치킨 고를 때 이거 모르면 손해예요! 🍗")
- 2~6줄: 핵심 꿀팁 3~4가지, 줄바꿈으로 템포감 있게
- 7줄: 저장/공유 유도 CTA
- 8줄: 관련 해시태그 7~10개
- 전체 줄바꿈 많이 써서 숨 쉬는 느낌으로`,

    x: `너는 X(트위터)에서 팔로워 10만을 모은 바이럴 콘텐츠 전문가야. 아래 소스로 리트윗과 북마크가 터지는 스레드를 써줘.

톤앤매너:
- 전문가처럼 핵심만 짧게, 근데 "이거 진짜임?" 하는 신뢰감도 함께
- 첫 트윗은 무조건 멈추게 해야 해. 반전, 숫자, 강한 주장 중 하나로 시작
- 각 트윗은 그 자체로 완결되는 한 문장 느낌

구조 규칙:
- 1/: 충격적이거나 반전 있는 첫 트윗 (느낌표 필수!)
- 2~4/: 핵심 꿀팁 or 인사이트, 트윗당 150자 이내, 간결하게
- 5/: "이 스레드 유용했다면 RT 한 번만! 🙏 팔로우하면 이런 정보 매일 드려요 ✨"
- 각 트윗 번호 형식: 1/ 2/ 3/ 로 구분`
  };

  const results = {};
  try {
    for (const channel of channels) {
      const guide = channelPrompts[channel] || channel;
      const prompt = `${guide}\n\n[원본 소스]\n제목: ${source.title}\n내용: ${source.description || ''}\nURL: ${source.url}\n\n위 소스를 참고해서 지금 바로 완성된 콘텐츠만 출력해. 설명이나 메타 코멘트 없이 콘텐츠 본문만.`;
      results[channel] = await callOllama(prompt);
    }

    const channelLabel = { naver:'네이버 블로그', tistory:'티스토리', instagram:'인스타그램', x:'X (Twitter)' };
    const combined = channels.map(ch => `=== ${channelLabel[ch] || ch} ===\n${results[ch]}`).join('\n\n');

    // ── 히스토리 저장 ──
    db.prepare(`
      INSERT INTO history (keyword, source_title, source_url, channels, result)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      source.title?.slice(0, 100) || '키워드 없음',
      source.title || '',
      source.url   || '',
      channels.join(','),
      combined
    );

    res.json({ result: combined });
  } catch (err) {
    console.error('[리팩토링 오류]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: 히스토리 목록 ────────────────────────
app.get('/api/history', (req, res) => {
  const rows = db.prepare(`
    SELECT id, keyword, source_title, source_url, channels, created_at
    FROM history
    ORDER BY created_at DESC
    LIMIT 50
  `).all();
  res.json({ history: rows });
});

// ── API: 히스토리 상세 ────────────────────────
app.get('/api/history/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM history WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '없음' });
  res.json({ item: row });
});

// ── API: 히스토리 삭제 ────────────────────────
app.delete('/api/history/:id', (req, res) => {
  db.prepare('DELETE FROM history WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✦ REFO-V3 서버 실행 중 → http://localhost:${PORT}`);
  console.log(`✦ MCP 검색 서버: mcp-servers/search-server/dist/index.js`);
  console.log(`✦ SQLite 히스토리: history.db`);
  console.log(`✦ Ollama 모델: ${process.env.OLLAMA_MODEL || 'qwen2.5:3b'}\n`);
});