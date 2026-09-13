/* =========================================================
   app.js — نقطة التشغيل الرئيسية
   + Wake Lock + openSectionAt (للبحث)
   ========================================================= */
(function () {
  "use strict";

  const MD_INDEX_URL = 'md.json';

  // ---------- DOM ----------
  const homePage = document.getElementById('homePage');
  const viewerPage = document.getElementById('viewerPage');
  const unitsTree = document.getElementById('unitsTree');
  const backBtn = document.getElementById('backBtn');
  const viewerTitleText = document.getElementById('viewerTitleText');
  const markdownContent = document.getElementById('markdownContent');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');
  const resetProgressBtn = document.getElementById('resetProgressBtn');
  const toast = document.getElementById('toast');
  const wakeToggle = document.getElementById('wakeToggle');
  const wakeIcon = document.getElementById('wakeIcon');
  const wakeLabel = document.getElementById('wakeLabel');
  const topBar = document.getElementById('topBar');

  // ---------- State ----------
  let mdIndex = [];
  let currentSectionPath = null;
  let currentSectionId = null;

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
     WAKE LOCK
     ============================================================ */
  const WakeLock = (function () {
    const STORAGE_KEY = 'ee_wake_lock';
    let wakeLock = null;
    let enabled = false;
    let retryTimer = null;

    async function request() {
      if (!('wakeLock' in navigator)) return false;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          if (enabled) scheduleReacquire();
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    function scheduleReacquire() {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(async () => {
        if (enabled && document.visibilityState === 'visible') {
          const ok = await request();
          if (!ok) scheduleReacquire();
        }
      }, 2000);
    }

    async function enable() {
      enabled = true;
      localStorage.setItem(STORAGE_KEY, 'true');
      updateUI();
      const ok = await request();
      if (!ok) {
        const onFirstTouch = async () => {
          document.removeEventListener('click', onFirstTouch);
          document.removeEventListener('touchstart', onFirstTouch);
          await request();
        };
        document.addEventListener('click', onFirstTouch, { once: true });
        document.addEventListener('touchstart', onFirstTouch, { once: true });
      }
    }

    function disable() {
      enabled = false;
      localStorage.setItem(STORAGE_KEY, 'false');
      updateUI();
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
      clearTimeout(retryTimer);
    }

    function updateUI() {
      if (enabled) {
        wakeToggle.classList.add('active');
        wakeIcon.setAttribute('icon', 'mdi:lightbulb-on-outline');
        wakeLabel.textContent = 'شاشة مضيئة';
      } else {
        wakeToggle.classList.remove('active');
        wakeIcon.setAttribute('icon', 'mdi:lightbulb-off-outline');
        wakeLabel.textContent = 'شاشة مضيئة';
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (enabled && document.visibilityState === 'visible') request();
    });

    window.addEventListener('beforeunload', () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    });

    function init() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'true') {
        enabled = true;
        updateUI();
        request().then(ok => {
          if (!ok) {
            const onFirst = async () => {
              document.removeEventListener('click', onFirst);
              document.removeEventListener('touchstart', onFirst);
              if (enabled) await request();
            };
            document.addEventListener('click', onFirst, { once: true });
            document.addEventListener('touchstart', onFirst, { once: true });
          }
        });
      } else {
        enabled = false;
        updateUI();
      }

      wakeToggle.addEventListener('click', () => {
        if (enabled) disable();
        else enable();
      });
    }

    return { init };
  })();

  /* ============================================================
     Word controls
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
        }
        updateGroupCounters(fileId);
        updateOverallProgress(fileId);
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
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
      });
    });
  }

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
        updateGroupCounters(fileId);
        updateOverallProgress(fileId);
      });
    });
  }

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
     Search highlight
     ============================================================ */
  function highlightMatchInViewer(info) {
    if (!info || !info.word) return;

    const target = info.word.toLowerCase().trim();
    const cards = markdownContent.querySelectorAll('.word-card[data-word-id]');
    let found = null;

    // 1) جرّب تطابق مباشر على data-word-text
    for (const card of cards) {
      const wt = (card.dataset.wordText || '').toLowerCase().trim();
      if (wt === target) { found = card; break; }
    }
    // 2) تطابق جزئي
    if (!found) {
      for (const card of cards) {
        const wt = (card.dataset.wordText || '').toLowerCase();
        if (wt.includes(target)) { found = card; break; }
      }
    }

    if (!found) return;

    // افتح الأكورديونات الأب
    let parent = found.parentElement;
    while (parent && parent !== markdownContent) {
      if (parent.classList && parent.classList.contains('accordion-content')) {
        // افتح
        parent.classList.add('open');
        const header = parent.previousElementSibling;
        if (header && header.classList) header.classList.add('open');
        // ارتفاع
        parent.style.maxHeight = 'none';
      }
      parent = parent.parentElement;
    }

    // ظلّل الكارت
    found.classList.add('search-highlight');
    setTimeout(() => {
      found.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);

    // شيل التظليل بعد شوية
    setTimeout(() => {
      found.classList.remove('search-highlight');
    }, 4500);
  }

  /* ============================================================
     Open section
     ============================================================ */
  async function openSection(sectionPath, title, searchInfo) {
    homePage.classList.add('hidden');
    viewerPage.classList.remove('hidden');
    viewerTitleText.textContent = title || sectionPath;
    currentSectionPath = sectionPath;
    currentSectionId = sectionPath;

    markdownContent.innerHTML = `
      <div style="padding:20px;">
        <div class="skeleton-card" style="height:70px;margin-bottom:12px;"></div>
        <div class="skeleton-card" style="height:70px;margin-bottom:12px;"></div>
        <div class="skeleton-card" style="height:70px;"></div>
      </div>`;

    try {
      const mdText = await Search.loadFileText(sectionPath);
      if (!mdText) throw new Error('File not found');

      const fragment = Uimd.getRendered(sectionPath, mdText);

      markdownContent.innerHTML = '';
      while (fragment.firstChild) {
        markdownContent.appendChild(fragment.firstChild);
      }

      addWordControls(markdownContent, currentSectionId);
      attachGroupCheckboxes(currentSectionId);
      attachAccordionEvents();

      updateGroupCounters(currentSectionId);
      updateOverallProgress(currentSectionId);

      // لو جاي من البحث، ظلّل الكلمة المطلوبة
      if (searchInfo) {
        setTimeout(() => highlightMatchInViewer(searchInfo), 120);
      }
    } catch (err) {
      console.error(err);
      markdownContent.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-secondary);">
          <iconify-icon icon="mdi:clock-outline" style="font-size:3rem;color:var(--primary);"></iconify-icon>
          <h2 style="margin:16px 0 8px;color:var(--primary);">Content coming soon</h2>
          <p>هذا القسم لم يُضف بعد. تابعنا قريبًا.</p>
        </div>`;
    }
  }

  /* ============================================================
     Expand / Collapse
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
    if (!currentSectionId) return;
    if (!confirm('هل أنت متأكد من مسح كل التقدم في هذا القسم؟')) return;

    Storage.resetFile(currentSectionId);

    markdownContent.querySelectorAll('.word-card[data-word-id]').forEach(card => {
      const cb = card.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
      card.classList.remove('word-card-saved');
    });
    markdownContent.querySelectorAll('[data-group-toggle]').forEach(cb => {
      cb.checked = false;
      cb.indeterminate = false;
    });

    updateGroupCounters(currentSectionId);
    updateOverallProgress(currentSectionId);
    showToast('تم مسح التقدم');
  });

  /* ============================================================
     Back button
     ============================================================ */
  backBtn.addEventListener('click', async () => {
    viewerPage.classList.add('hidden');
    homePage.classList.remove('hidden');
    currentSectionId = null;
    currentSectionPath = null;

    await UiCards.refreshAll(mdIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ============================================================
     Resize
     ============================================================ */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      markdownContent.querySelectorAll('.accordion-header.open').forEach(h => {
        const c = h.nextElementSibling;
        if (c) c.style.maxHeight = c.scrollHeight + 'px';
      });
    }, 120);
  });

  /* ============================================================
     Top bar shadow on scroll
     ============================================================ */
  window.addEventListener('scroll', () => {
    if (!topBar) return;
    topBar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  /* ============================================================
     Init
     ============================================================ */
  async function loadIndex() {
    try {
      const res = await fetch(MD_INDEX_URL);
      if (!res.ok) throw new Error('Failed to load md.json');
      mdIndex = await res.json();

      // سجّل الـ mdIndex للبحث
      Search.setMdIndex(mdIndex);
      Search.setOpenHandler((path, title, info) => openSection(path, title, info));

      // ابنِ الشجرة
      await UiCards.renderTree(mdIndex, (path, title) => openSection(path, title));

      // ابدأ ببناء فهرس البحث في الخلفية (بدون ما يعطّل الواجهة)
      setTimeout(() => {
        SearchIndex.getIndex(mdIndex).catch(e => console.warn('Index build failed', e));
      }, 800);
    } catch (err) {
      console.error(err);
      unitsTree.innerHTML =
        `<div class="loading" style="color:var(--danger);">⚠️ Could not load md.json.</div>`;
    }
  }

  function init() {
    Theme.init();
    Search.init();
    WakeLock.init();
    loadIndex();
  }

  init();
})();