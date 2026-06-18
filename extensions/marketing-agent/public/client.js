const state = {
  page: 0,
  selectedCardIndex: null,
  searchResults: [],
  activeChannels: new Set(['naver']),
  resultsByChannel: {},
  activeResultTab: null,
  previewIndex: null,
};

// ── 엘리먼트 ──
const hero       = document.getElementById('hero');
const heroInput  = document.getElementById('hero-input');
const heroSend   = document.getElementById('hero-send');
const appEl      = document.getElementById('app');
const barInput   = document.getElementById('bar-input');
const searchBtn  = document.getElementById('search-btn');
const nextBtn    = document.getElementById('next-btn');
const refactorBtn= document.getElementById('refactor-btn');
const cardsGrid  = document.getElementById('cards-grid');
const sourceSection = document.getElementById('source-section');
const resultSection = document.getElementById('result-section');
const resultTabs = document.getElementById('result-tabs');
const resultContent = document.getElementById('result-content');
const thinkingEl = document.getElementById('thinking');
const thinkingText = document.getElementById('thinking-text');
const emptyState = document.getElementById('empty-state');
const selectedInfo = document.getElementById('selected-info');
const scrollArea = document.getElementById('scroll-area');

// ── 히어로 → 앱 전환 ──
function transitionToApp(query) {
  barInput.value = query;
  hero.classList.add('hidden');
  appEl.classList.add('visible');
}

window.goHome = function() {
  hero.classList.remove('hidden');
  appEl.classList.remove('visible');
  heroInput.value = '';
};

window.setHeroKeyword = function(kw) {
  heroInput.value = kw;
  heroInput.focus();
};

heroSend.addEventListener('click', () => {
  const q = heroInput.value.trim();
  if (!q) return;
  transitionToApp(q);
  doSearch(true, q);
});
heroInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') heroSend.click();
});

// ── 채널 토글 ──
const CHIP_CLASS = { naver:'active-naver', tistory:'active-tistory', instagram:'active-instagram', x:'active-x' };
window.toggleChannel = function(ch) {
  const chip = document.getElementById('chip-' + ch);
  if (state.activeChannels.has(ch)) {
    if (state.activeChannels.size === 1) { showToast('채널을 최소 1개 선택해야 합니다'); return; }
    state.activeChannels.delete(ch);
    chip?.classList.remove(CHIP_CLASS[ch]);
  } else {
    state.activeChannels.add(ch);
    chip?.classList.add(CHIP_CLASS[ch]);
  }
};

// ── 검색 ──
async function doSearch(resetPage = true, queryOverride = null) {
  const query = queryOverride || barInput.value.trim();
  if (!query) { showToast('키워드를 입력해주세요'); return; }
  if (resetPage) state.page = 0;

  setThinking(true, '네이버에서 실시간 검색 중...');
  searchBtn.disabled = true;
  emptyState.style.display = 'none';
  sourceSection.style.display = 'none';
  resultSection.style.display = 'none';
  // 개선④: 스켈레톤 로딩 표시
  document.getElementById('skeleton-section').style.display = 'block';

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, page: state.page }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '검색 실패');

    state.searchResults = data.results || [];
    document.getElementById('skeleton-section').style.display = 'none';
    if (!state.searchResults.length) {
      showToast('검색 결과가 없습니다. 다른 키워드를 시도해보세요.');
      emptyState.style.display = 'flex';
      return;
    }
    renderCards();
    sourceSection.style.display = 'block';
    nextBtn.disabled = false;
    scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    document.getElementById('skeleton-section').style.display = 'none';
    showToast('검색 오류: ' + err.message);
    emptyState.style.display = 'flex';
  } finally {
    setThinking(false);
    searchBtn.disabled = false;
  }
}

window.nextPage = function() {
  state.page += 1;
  doSearch(false);
};

// ── 카드 렌더링 ──
function renderCards() {
  state.selectedCardIndex = null;
  refactorBtn.disabled = true;
  selectedInfo.textContent = '카드를 클릭하거나 미리보기로 확인 후 선택하세요';
  cardsGrid.innerHTML = '';

  state.searchResults.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="card-num">0${i + 1}</div>
      <div class="card-body">
        <div class="card-title">${escHtml(item.title || '제목 없음')}</div>
        <div class="card-desc">${escHtml(item.description || '설명 없음')}</div>
        <div class="card-url">${escHtml(item.url || '')}</div>
      </div>
      <div class="card-right">
        <span class="card-check">✓</span>
        <button class="btn-preview" onclick="openPreview(event,${i})">미리보기</button>
      </div>
    `;
    card.addEventListener('click', e => {
      if (e.target.classList.contains('btn-preview')) return;
      selectCard(i);
    });
    cardsGrid.appendChild(card);
  });
}

function selectCard(index) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.card[data-index="${index}"]`)?.classList.add('selected');
  state.selectedCardIndex = index;
  const title = state.searchResults[index]?.title || '';
  selectedInfo.innerHTML = `선택됨: <strong>${escHtml(title.slice(0,48))}${title.length>48?'…':''}</strong>`;
  refactorBtn.disabled = false;
}

// ── 미리보기 모달 ──
window.openPreview = function(e, index) {
  e.stopPropagation();
  const item = state.searchResults[index];
  if (!item) return;
  state.previewIndex = index;
  document.getElementById('modal-title').textContent = item.title || '제목 없음';
  document.getElementById('modal-url').textContent   = item.url || '';
  document.getElementById('modal-href').href         = item.url || '#';
  const body = document.getElementById('modal-body');
  body.innerHTML = item.description
    ? `<p style="color:var(--text-muted);line-height:1.85">${escHtml(item.description)}</p>`
    : `<p style="color:var(--text-dim);font-style:italic">본문 요약 정보가 없습니다.<br/>원문 열기로 확인해 보세요.</p>`;
  document.getElementById('overlay').classList.add('open');
};
document.getElementById('modal-sel').addEventListener('click', () => {
  if (state.previewIndex !== null) { selectCard(state.previewIndex); closeModal(); showToast('소스 선택됨 ✓'); }
});
window.closeModal = () => document.getElementById('overlay').classList.remove('open');
window.closeModalBg = e => { if (e.target === document.getElementById('overlay')) closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── 리팩토링 ──
async function doRefactor() {
  if (state.selectedCardIndex === null) return;
  const source   = state.searchResults[state.selectedCardIndex];
  const channels = [...state.activeChannels];
  setThinking(true, `${channels.map(chLabel).join(', ')} 채널로 변환 중... (잠시 기다려주세요)`);
  refactorBtn.disabled = true;

  try {
    const res = await fetch('/api/refactor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, channels }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '변환 실패');
    renderResult(data.result, channels);
    resultSection.style.display = 'block';
    setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth' }), 50);
  } catch (err) {
    showToast('변환 오류: ' + err.message);
  } finally {
    setThinking(false);
    refactorBtn.disabled = false;
  }
}

// ── 결과 렌더링 ──
const TAB_ICON = {
  naver:     '<span class="rtab-ico naver">N</span>',
  tistory:   '<span class="rtab-ico tistory">T</span>',
  instagram: `<span class="rtab-ico instagram"><svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></span>`,
  x:         `<span class="rtab-ico x-tw"><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span>`,
};

// ── 마크다운 → HTML 변환 ──
function mdToHtml(md) {
  return md
    // 제목 ##, ###, ####
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 굵게
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 기울임
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 리스트 (- 또는 *)
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // 빈 줄 → 문단 구분
    .replace(/\n{2,}/g, '</p><p>')
    // 단일 줄바꿈
    .replace(/\n/g, '<br/>')
    // 전체 p 태그 감싸기
    .replace(/^(?!<[hul])(.+)/, '<p>$1')
    + '</p>';
}

function renderResult(text, channels) {
  state.resultsByChannel = {};
  if (channels.length === 1) {
    state.resultsByChannel[channels[0]] = text.trim();
  } else {
    channels.forEach(ch => {
      const lbl = chLabel(ch);
      const m = text.match(new RegExp(`===\\s*${lbl}\\s*===([\\s\\S]*?)(?====|$)`, 'i'));
      state.resultsByChannel[ch] = m ? m[1].trim() : text.trim();
    });
  }
  resultTabs.innerHTML = '';
  channels.forEach((ch, i) => {
    const tab = document.createElement('div');
    tab.className = 'rtab' + (i === 0 ? ' active' : '');
    tab.innerHTML = `${TAB_ICON[ch] || ''} ${chLabel(ch)}`;
    tab.onclick = () => {
      document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeResultTab = ch;
      resultContent.innerHTML = mdToHtml(state.resultsByChannel[ch] || '');
    };
    resultTabs.appendChild(tab);
  });
  state.activeResultTab = channels[0];
  resultContent.innerHTML = mdToHtml(state.resultsByChannel[channels[0]] || '');
}

window.copyResult = function() {
  // 복사는 원본 텍스트(마크다운 없이)로
  const raw = state.resultsByChannel[state.activeResultTab] || '';
  const plain = raw
    .replace(/^#{1,4} /gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*] /gm, '• ');
  navigator.clipboard.writeText(plain).then(() => showToast('클립보드에 복사됐습니다 ✓'));
};

// ── 유틸 ──
function setThinking(v, text = '') {
  thinkingEl.classList.toggle('show', v);
  if (text) thinkingText.textContent = text;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function chLabel(ch) {
  return { naver:'네이버 블로그', tistory:'티스토리', instagram:'인스타그램', x:'X (Twitter)' }[ch] || ch;
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

searchBtn.addEventListener('click', () => doSearch(true));
barInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(true); });
// ── 히스토리 ──────────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    renderHistory(data.history || []);
  } catch (err) {
    console.error('히스토리 로드 실패:', err);
  }
}

function renderHistory(items) {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '<div class="history-empty">아직 기록이 없어요</div>';
    return;
  }

  list.innerHTML = items.map(item => {
    const date = new Date(item.created_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const channels = (item.channels || '').split(',').map(ch => ({
      naver:'N', tistory:'T', instagram:'I', x:'X'
    }[ch] || ch)).join(' · ');
    return `
      <div class="history-item" onclick="loadHistoryItem(${item.id})">
        <div class="history-item-title">${escHtml(item.source_title || item.keyword || '제목 없음')}</div>
        <div class="history-item-meta">
          <span class="history-channels">${channels}</span>
          <span class="history-date">${date}</span>
        </div>
        <button class="history-del" onclick="deleteHistory(event, ${item.id})">✕</button>
      </div>
    `;
  }).join('');
}

window.loadHistoryItem = async function(id) {
  try {
    const res = await fetch(`/api/history/${id}`);
    const data = await res.json();
    const item = data.item;
    if (!item) return;

    // 앱 화면으로 전환
    hero.classList.add('hidden');
    appEl.classList.add('visible');
    barInput.value = item.source_title || '';

    // 히스토리 패널 닫기
    closeHistoryPanel();

    // 결과 바로 렌더링
    const channels = (item.channels || 'naver').split(',');
    renderResult(item.result, channels);
    resultSection.style.display = 'block';
    sourceSection.style.display = 'none';
    emptyState.style.display = 'none';
    setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth' }), 50);
    showToast('히스토리를 불러왔습니다 ✓');
  } catch (err) {
    showToast('불러오기 실패: ' + err.message);
  }
};

window.deleteHistory = async function(e, id) {
  e.stopPropagation();
  await fetch(`/api/history/${id}`, { method: 'DELETE' });
  loadHistory();
  showToast('삭제됐습니다');
};

window.openHistoryPanel = function() {
  document.getElementById('history-panel').classList.add('open');
  loadHistory();
};

window.closeHistoryPanel = function() {
  document.getElementById('history-panel').classList.remove('open');
};

// ── 사이드바 히스토리 버튼 ──
document.getElementById('sidebar-history')?.addEventListener('click', openHistoryPanel);
