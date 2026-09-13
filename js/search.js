/* =========================================================
   search.js — بحث فوري داخل محتوى الـ Markdown
   - يستخدم SearchIndex للفهرس
   - يفتح الوحدة + المجموعة + الملف + يظلّل الكلمة
   - يوفر loadFileText كـ shared cache لبقية الملفات
   ========================================================= */
window.Search = (function () {

  const input = document.getElementById('globalSearchInput');
  const resultsEl = document.getElementById('searchResults');
  const clearBtn = document.getElementById('searchClearBtn');

  let onOpenAt = null;
  let mdIndex = [];
  let debounceTimer = null;
  let currentResults = [];
  let activeIndex = -1;

  const DEBOUNCE_MS = 180;

  // ✅ كاش محتوى الملفات (shared with ui-cards.js)
  const fileCache = new Map();

  function setOpenHandler(fn) { onOpenAt = fn; }
  function setMdIndex(idx) { mdIndex = idx; }

  /* ---------- loadFileText (shared) ---------- */
  async function loadFileText(path) {
    if (!path) return null;
    if (fileCache.has(path)) return fileCache.get(path);
    try {
      const res = await fetch(path);
      if (!res.ok) {
        fileCache.set(path, null);
        return null;
      }
      const text = await res.text();
      fileCache.set(path, text);
      return text;
    } catch (e) {
      fileCache.set(path, null);
      return null;
    }
  }

  /* ---------- Loading helpers ---------- */
  function showLoading() {
    resultsEl.innerHTML = `
      <div class="search-loading">
        <iconify-icon icon="mdi:loading"></iconify-icon>
        <div>جاري تجهيز الفهرس...</div>
      </div>`;
    resultsEl.classList.add('active');
  }

  function showEmpty(msg) {
    resultsEl.innerHTML = `<div class="search-empty">${msg}</div>`;
    resultsEl.classList.add('active');
  }

  function hideResults() {
    resultsEl.classList.remove('active');
    resultsEl.innerHTML = '';
    currentResults = [];
    activeIndex = -1;
  }

  /* ---------- Escape + Highlight ---------- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
  }

  /* ---------- Render results ---------- */
  function renderResults(list, query) {
    if (!list.length) {
      showEmpty(`لا توجد نتائج لـ "${escapeHtml(query)}"`);
      return;
    }

    resultsEl.innerHTML = list.map((r, i) => `
      <div class="search-result-item" data-index="${i}" role="button" tabindex="0">
        <div class="sr-path">
          <span class="sr-chip">Unit ${r.unit}</span>
          <span class="sr-chip">${escapeHtml(r.groupLabel)}</span>
          <span class="sr-chip">${escapeHtml(r.sectionLabel)}</span>
        </div>
        <div class="sr-word">${highlight(r.word, query)}</div>
        <div class="sr-line">${highlight(r.meaning, query)}</div>
      </div>
    `).join('') + `
      <div class="search-hint">
        <iconify-icon icon="mdi:information-outline"></iconify-icon>
        <span>اضغط Enter لفتح أول نتيجة · الأسهم للتنقل · Esc للإغلاق</span>
      </div>`;

    resultsEl.classList.add('active');
    currentResults = list;
    activeIndex = -1;

    resultsEl.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => openResult(parseInt(el.dataset.index, 10)));
      el.addEventListener('mouseenter', () => setActive(parseInt(el.dataset.index, 10)));
    });
  }

  function setActive(idx) {
    if (idx < 0 || idx >= currentResults.length) return;
    activeIndex = idx;
    resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
    const active = resultsEl.querySelector('.search-result-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function openResult(idx) {
    if (idx < 0 || idx >= currentResults.length) return;
    const r = currentResults[idx];
    if (!onOpenAt) return;

    const title = `Unit ${r.unit} · ${r.groupLabel} · ${r.sectionLabel}`;
    onOpenAt(r.filePath, title, {
      word: r.word,
      tableIdx: r.tableIdx,
      rowIdx: r.rowIdx,
      query: input.value.trim()
    });

    input.value = '';
    updateClearBtn();
    hideResults();
  }

  /* ---------- Search flow ---------- */
  async function ensureIndex() {
    if (SearchIndex.hasIndex()) return true;

    showLoading();

    try {
      const cached = await SearchIndex.loadCached();
      if (cached) return true;

      await SearchIndex.buildIndex(mdIndex, (processed, total) => {
        if (resultsEl.classList.contains('active')) {
          const pct = Math.round((processed / total) * 100);
          resultsEl.innerHTML = `
            <div class="search-loading">
              <iconify-icon icon="mdi:loading"></iconify-icon>
              <div>جاري فهرسة المحتوى... ${pct}%</div>
              <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:6px;">${processed} / ${total} ملف</div>
            </div>`;
        }
      });
      return true;
    } catch (e) {
      console.error(e);
      showEmpty('تعذّر تجهيز الفهرس. تحقق من اتصالك.');
      return false;
    }
  }

  async function performSearch(query) {
    const q = (query || '').trim();
    if (!q) { hideResults(); return; }

    const ok = await ensureIndex();
    if (!ok) return;

    const list = SearchIndex.query(q, 60);
    renderResults(list, q);
  }

  function scheduleSearch() {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    updateClearBtn();
    if (!q) { hideResults(); return; }
    debounceTimer = setTimeout(() => performSearch(q), DEBOUNCE_MS);
  }

  function updateClearBtn() {
    if (clearBtn) clearBtn.hidden = input.value.length === 0;
  }

  /* ---------- Keyboard ---------- */
  function handleKey(e) {
    if (e.key === 'Escape') {
      if (resultsEl.classList.contains('active')) {
        hideResults();
        input.blur();
      } else {
        input.value = '';
        updateClearBtn();
      }
      return;
    }
    if (!resultsEl.classList.contains('active')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openResult(activeIndex >= 0 ? activeIndex : 0);
    }
  }

  /* ---------- Global shortcuts ---------- */
  function bindGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === '/' && document.activeElement !== input
          && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------- Init ---------- */
  function init() {
    input.addEventListener('input', scheduleSearch);
    input.addEventListener('keydown', handleKey);
    input.addEventListener('focus', () => {
      if (input.value.trim()) scheduleSearch();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        updateClearBtn();
        hideResults();
        input.focus();
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-section')) hideResults();
    });

    bindGlobalShortcuts();
    updateClearBtn();
  }

  return {
    init,
    setOpenHandler,
    setMdIndex,
    performSearch,
    hideResults,
    loadFileText    // ✅ مضاف
  };
})();