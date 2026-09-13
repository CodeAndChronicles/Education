/* =========================================================
   app.js — نقطة التشغيل الرئيسية
   - Word controls (checkbox + copy) للـ word-cards
   - Group checkbox (تحديد المجموعة كاملة)
   - Accordion events
   - Progress counters
   - Open / Reset / Back
   ========================================================= */
(function () {
  "use strict";

  const MD_INDEX_URL = 'md.json';

  // ---------- DOM ----------
  const homePage = document.getElementById('homePage');
  const viewerPage = document.getElementById('viewerPage');
  const cardsList = document.getElementById('cardsList');
  const backBtn = document.getElementById('backBtn');
  const viewerTitleText = document.getElementById('viewerTitleText');
  const markdownContent = document.getElementById('markdownContent');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');
  const resetProgressBtn = document.getElementById('resetProgressBtn');
  const toast = document.getElementById('toast');

  // ---------- State ----------
  let mdIndex = [];
  let currentFileId = null;

  // ---------- Helpers ----------
  function showToast(msg, duration = 1800) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => toast.classList.remove('show'), duration);
  }

  async function copyRowText(word, translation) {
    const text = `${word} - ${translation}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied: ' + text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('Copied: ' + text); }
      catch { showToast('Copy failed'); }
      ta.remove();
    }
  }

  /* ============================================================
     Word controls — word-card version
     ============================================================ */
  function addWordControls(rootEl, fileId) {
    const cards = rootEl.querySelectorAll('.word-list .word-card');
    cards.forEach(card => {
      const wordId = `${fileId}_${card.dataset.wordSlug}`;
      card.dataset.wordId = wordId;
      card.dataset.fileId = fileId;

      const wordText = card.dataset.wordText || '';
      const transText = card.dataset.meaningText || '';
      const slot = card.querySelector('.word-controls-slot');
      if (!slot) return;

      const wrap = document.createElement('div');
      wrap.className = 'word-row-controls';

      const label = document.createElement('label');
      label.className = 'check-label';
      label.setAttribute('aria-label', 'Mark as saved');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Storage.isWordSaved(fileId, wordId);

      const customCheck = document.createElement('span');
      customCheck.className = 'custom-check';
      customCheck.innerHTML = '<iconify-icon icon="mdi:check-bold"></iconify-icon>';

      label.appendChild(checkbox);
      label.appendChild(customCheck);

      checkbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        Storage.setWordSaved(fileId, wordId, checked);
        card.classList.toggle('word-card-saved', checked);
        if (checked) {
          card.classList.add('row-saved');
          setTimeout(() => card.classList.remove('row-saved'), 400);
          showToast('Saved ✓');
        }
        updateGroupCounters(fileId);
        updateOverallProgress(fileId);
        UiCards.refreshCard(mdIndex.find(m => m.id === fileId));
      });

      const copyBtn = document.createElement('button');
      copyBtn.className = 'icon-btn';
      copyBtn.setAttribute('aria-label', 'Copy word');
      copyBtn.innerHTML = '<iconify-icon icon="mdi:content-copy"></iconify-icon>';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyRowText(wordText, transText);
      });

      wrap.appendChild(label);
      wrap.appendChild(copyBtn);
      slot.appendChild(wrap);

      card.classList.toggle('word-card-saved', checkbox.checked);
    });
  }

  /* ============================================================
     Accordion events (dynamic scrollHeight + guard for group checkbox)
     ============================================================ */
  function attachAccordionEvents() {
    markdownContent.querySelectorAll('.accordion-header').forEach(header => {
      const toggle = (e) => {
        if (e && e.target.closest('.group-check-label')) return;
        const content = header.nextElementSibling;
        const isOpen = header.classList.toggle('open');
        if (isOpen) {
          content.classList.add('open');
          content.style.maxHeight = content.scrollHeight + 'px';
        } else {
          content.classList.remove('open');
          content.style.maxHeight = '0px';
        }
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle(e);
        }
      });
    });
  }

  /* ============================================================
     Group checkboxes — تحديد المجموعة كاملة
     ============================================================ */
  function attachGroupCheckboxes(fileId) {
    markdownContent.querySelectorAll('.accordion-group').forEach(group => {
      const groupCb = group.querySelector('[data-group-toggle]');
      if (!groupCb) return;

      groupCb.addEventListener('change', (e) => {
        const checked = e.target.checked;
        group.querySelectorAll('.word-card[data-word-id]').forEach(card => {
          Storage.setWordSaved(fileId, card.dataset.wordId, checked);
          const cb = card.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = checked;
          card.classList.toggle('word-card-saved', checked);
        });
        showToast(checked ? 'تم تحديد المجموعة كاملة ✓' : 'تم إلغاء تحديد المجموعة');
        updateGroupCounters(fileId);
        updateOverallProgress(fileId);
        UiCards.refreshCard(mdIndex.find(m => m.id === fileId));
      });
    });
  }

  /* ============================================================
     Counters + progress
     ============================================================ */
  function updateGroupCounters(fileId) {
    markdownContent.querySelectorAll('.accordion-group').forEach(acc => {
      const counter = acc.querySelector('[data-counter]');
      const groupCb = acc.querySelector('[data-group-toggle]');
      const cards = acc.querySelectorAll('.word-card[data-word-id]');
      let saved = 0;
      cards.forEach(card => {
        if (Storage.isWordSaved(fileId, card.dataset.wordId)) saved++;
      });
      if (counter) counter.textContent = `${saved}/${cards.length}`;
      if (groupCb) {
        groupCb.checked = cards.length > 0 && saved === cards.length;
        groupCb.indeterminate = saved > 0 && saved < cards.length;
      }
    });
  }

  function updateOverallProgress(fileId) {
    const cards = markdownContent.querySelectorAll('.word-card[data-word-id]');
    const total = cards.length;
    let saved = 0;
    cards.forEach(card => {
      if (Storage.isWordSaved(fileId, card.dataset.wordId)) saved++;
    });
    progressText.textContent = `${saved} / ${total}`;
    progressFill.style.width = (total ? (saved / total) * 100 : 0) + '%';
  }

  /* ============================================================
     File viewer
     ============================================================ */
  async function openFile(fileId, filePath, title) {
    homePage.classList.add('hidden');
    viewerPage.classList.remove('hidden');
    viewerTitleText.textContent = title || fileId;
    currentFileId = fileId;

    // Skeleton
    markdownContent.innerHTML = `
      <div style="padding:20px;">
        <div class="skeleton-card" style="height:60px;margin-bottom:12px;"></div>
        <div class="skeleton-card" style="height:60px;margin-bottom:12px;"></div>
        <div class="skeleton-card" style="height:60px;"></div>
      </div>`;

    try {
      const mdText = await Search.loadFileText(filePath);
      if (!mdText) throw new Error('File not found');

      const fragment = Uimd.getRendered(filePath, mdText);

      markdownContent.innerHTML = '';
      while (fragment.firstChild) {
        markdownContent.appendChild(fragment.firstChild);
      }

      // Controls + group checkboxes + accordion events
      addWordControls(markdownContent, fileId);
      attachGroupCheckboxes(fileId);
      attachAccordionEvents();

      updateGroupCounters(fileId);
      updateOverallProgress(fileId);
    } catch (err) {
      console.error(err);
      markdownContent.innerHTML =
        `<div style="color:var(--danger);padding:20px;">⚠️ Could not load file: ${filePath}</div>`;
    }
  }

  /* ============================================================
     Expand / Collapse all
     ============================================================ */
  expandAllBtn.addEventListener('click', () => {
    markdownContent.querySelectorAll('.accordion-header').forEach(h => {
      if (!h.classList.contains('open')) {
        h.classList.add('open');
        const c = h.nextElementSibling;
        c.classList.add('open');
        requestAnimationFrame(() => { c.style.maxHeight = c.scrollHeight + 'px'; });
      }
    });
  });

  collapseAllBtn.addEventListener('click', () => {
    markdownContent.querySelectorAll('.accordion-header').forEach(h => {
      if (h.classList.contains('open')) {
        h.classList.remove('open');
        const c = h.nextElementSibling;
        c.classList.remove('open');
        c.style.maxHeight = '0px';
      }
    });
  });

  /* ============================================================
     Reset progress
     ============================================================ */
  resetProgressBtn.addEventListener('click', () => {
    if (!currentFileId) return;
    if (!confirm('هل أنت متأكد من مسح كل التقدم في هذا الملف؟')) return;

    Storage.resetFile(currentFileId);

    markdownContent.querySelectorAll('.word-card[data-word-id]').forEach(card => {
      const cb = card.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
      card.classList.remove('word-card-saved');
    });
    markdownContent.querySelectorAll('[data-group-toggle]').forEach(cb => {
      cb.checked = false;
      cb.indeterminate = false;
    });

    updateGroupCounters(currentFileId);
    updateOverallProgress(currentFileId);
    UiCards.refreshCard(mdIndex.find(m => m.id === currentFileId));
    showToast('تم مسح التقدم');
  });

  /* ============================================================
     Back button
     ============================================================ */
  backBtn.addEventListener('click', async () => {
    viewerPage.classList.add('hidden');
    homePage.classList.remove('hidden');
    currentFileId = null;

    await UiCards.refreshAll(mdIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ============================================================
     Resize → recalc accordion heights
     ============================================================ */
  window.addEventListener('resize', () => {
    markdownContent.querySelectorAll('.accordion-header.open').forEach(h => {
      const c = h.nextElementSibling;
      if (c) c.style.maxHeight = c.scrollHeight + 'px';
    });
  });

  /* ============================================================
     Init
     ============================================================ */
  async function loadIndex() {
    try {
      const res = await fetch(MD_INDEX_URL);
      if (!res.ok) throw new Error('Failed to load md.json');
      mdIndex = await res.json();
      window.__mdIndex = mdIndex;

      Search.setOpenFileHandler((fileId, filePath, title) => openFile(fileId, filePath, title));
      UiCards.renderCards(mdIndex, (id, path, title) => openFile(id, path, title));
    } catch (err) {
      console.error(err);
      cardsList.innerHTML =
        `<div class="loading" style="color:var(--danger);">⚠️ Could not load md.json.</div>`;
    }
  }

  function init() {
    Theme.init();
    Search.init();
    loadIndex();
  }

  init();
})();