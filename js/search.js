/* =========================================================
   search.js — البحث الشامل (متوازي بـ Promise.all)
   ========================================================= */
window.Search = (function () {

  const input = document.getElementById('globalSearchInput');
  const btn = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');

  let lastQuery = '';
  const fileCache = new Map(); // filePath -> markdown text
  let onOpenFile = null; // callback

  function setOpenFileHandler(fn) { onOpenFile = fn; }

  async function loadFileText(path) {
    if (fileCache.has(path)) return fileCache.get(path);
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const text = await res.text();
      fileCache.set(path, text);
      return text;
    } catch (e) {
      return null;
    }
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function showSpinner() {
    results.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--text-secondary);">
        <iconify-icon icon="mdi:loading" style="animation:spin 1s linear infinite;font-size:1.8rem;color:var(--primary);"></iconify-icon>
        <div style="margin-top:8px;">جاري البحث...</div>
      </div>`;
    results.classList.add('active');
  }

  function hide() {
    results.classList.remove('active');
    results.innerHTML = '';
  }

  async function perform(query) {
    query = (query || '').trim().toLowerCase();
    if (!query) { hide(); return; }
    lastQuery = query;
    showSpinner();

    const filesToSearch = window.__mdIndex || [];

    // تحميل متوازي
    const loaded = await Promise.all(
      filesToSearch.map(async item => {
        const text = await loadFileText(item.file);
        return { item, text };
      })
    );

    // تجاهل الاستعلام لو المستخدم غيّر البحث في الأثناء
    if (lastQuery !== query) return;

    const matched = [];
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');

    loaded.forEach(({ item, text }) => {
      if (!text) return;
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query)) {
          matched.push({
            fileId: item.id,
            fileTitle: item.title,
            filePath: item.file,
            line: line.replace(regex, '<mark>$1</mark>')
          });
        }
      });
    });

    renderResults(matched, query);
  }

  function renderResults(matched, query) {
    if (!matched.length) {
      results.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-secondary);">لا توجد نتائج لـ "${query}"</div>`;
      results.classList.add('active');
      return;
    }
    results.innerHTML = matched.slice(0, 100).map((r, i) => `
      <div class="search-result-item" data-index="${i}">
        <div class="file-title">
          <iconify-icon icon="mdi:file-document-outline"></iconify-icon>
          ${r.fileTitle}
        </div>
        <div class="match-line">${r.line}</div>
      </div>
    `).join('');
    results.classList.add('active');

    results.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const r = matched[parseInt(el.dataset.index, 10)];
        if (r && onOpenFile) {
          onOpenFile(r.fileId, r.filePath, r.fileTitle);
          hide();
          input.value = '';
        }
      });
    });
  }

  function init() {
    btn.addEventListener('click', () => perform(input.value));
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') perform(input.value);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-section')) hide();
    });
  }

  return { init, perform, setOpenFileHandler, loadFileText, getCache: () => fileCache };
})();