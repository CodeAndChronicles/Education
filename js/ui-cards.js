/* =========================================================
   ui-cards.js — بناء كروت الصفحة الرئيسية + progress لكل كارت
   ========================================================= */
window.UiCards = (function () {

  const cardsList = document.getElementById('cardsList');

  function iconForItem(item) {
    const t = (item.title || '').toLowerCase();
    if (t.includes('vocab') || t.includes('unit')) return 'mdi:book-alphabet';
    if (t.includes('grammar')) return 'mdi:spellcheck';
    if (t.includes('reading')) return 'mdi:book-open-variant';
    return 'mdi:file-document-outline';
  }

  function renderCards(mdIndex, onOpen) {
    if (!mdIndex.length) {
      cardsList.innerHTML = `<div class="loading">No files available yet.</div>`;
      return;
    }

    cardsList.innerHTML = mdIndex.map(item => `
      <div class="card" dir="auto" data-id="${item.id}" data-file="${item.file}" data-title="${item.title}">
        <div class="card-icon">
          <iconify-icon icon="${iconForItem(item)}"></iconify-icon>
        </div>
        <div class="card-info">
          <div class="card-title">${item.title}</div>
          <div class="card-meta">
            <span><iconify-icon icon="mdi:calendar"></iconify-icon> ${item.date || '—'}</span>
            <span class="card-word-count" data-word-count><iconify-icon icon="mdi:format-list-numbered"></iconify-icon> ...</span>
          </div>
        </div>
        <div class="card-progress" data-card-progress>
          <div class="card-progress-info">
            <span>التقدم</span>
            <span data-card-pct>0%</span>
          </div>
          <div class="card-progress-bar">
            <div class="card-progress-fill" data-card-fill></div>
          </div>
        </div>
        <div class="card-arrow">
          <iconify-icon icon="mdi:chevron-right"></iconify-icon>
        </div>
        <div class="card-complete-badge hidden" data-complete-badge>
          <iconify-icon icon="mdi:check-circle"></iconify-icon>
        </div>
      </div>
    `).join('');

    cardsList.setAttribute('dir', 'ltr');

    cardsList.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        onOpen(card.dataset.id, card.dataset.file, card.dataset.title);
      });
    });

    mdIndex.forEach(item => refreshCard(item));
  }

  /* ---- عدد الكلمات من الـ word-cards بعد المعالجة الكاملة ---- */
  function countWordsInMd(mdText, filePath) {
    const wrapper = Uimd.getRendered(filePath || '__count__', mdText);
    return wrapper.querySelectorAll('.word-list .word-card').length;
  }

  const wordCountCache = new Map();

  async function getWordCount(item) {
    if (wordCountCache.has(item.id)) return wordCountCache.get(item.id);
    const text = await Search.loadFileText(item.file);
    if (!text) return 0;
    const count = countWordsInMd(text, item.file);
    wordCountCache.set(item.id, count);
    return count;
  }

  async function refreshCard(item) {
    if (!item) return;
    const total = await getWordCount(item);
    const saved = Storage.getFileStats(item.id).saved;
    updateCardUI(item.id, saved, total);
  }

  function updateCardUI(fileId, saved, total) {
    const card = cardsList.querySelector(`.card[data-id="${fileId}"]`);
    if (!card) return;

    const pct = total > 0 ? Math.round((saved / total) * 100) : 0;

    const countEl = card.querySelector('[data-word-count]');
    if (countEl) countEl.innerHTML = `<iconify-icon icon="mdi:format-list-numbered"></iconify-icon> ${total} كلمة`;

    const pctEl = card.querySelector('[data-card-pct]');
    if (pctEl) pctEl.textContent = pct + '%';

    const fill = card.querySelector('[data-card-fill]');
    if (fill) fill.style.width = pct + '%';

    const badge = card.querySelector('[data-complete-badge]');
    if (badge) badge.classList.toggle('hidden', pct < 100);
  }

  async function refreshAll(mdIndex) {
    await Promise.all(mdIndex.map(item => refreshCard(item)));
  }

  return { renderCards, refreshCard, refreshAll };
})();