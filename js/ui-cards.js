/* =========================================================
   ui-cards.js — نظام Cards Grid + Drill-down
   - renderUnitsGrid: شبكة الوحدات (Home)
   - renderGroupsGrid: شبكة المجموعات (Unit Page)
   - renderSectionsGrid: شبكة الأقسام (Group Page)
   - renderOverview: إحصائيات المنهج الكامل
   ========================================================= */
window.UiCards = (function () {

  const unitsGridEl    = document.getElementById('unitsGrid');
  const groupsGridEl   = document.getElementById('groupsGrid');
  const sectionsGridEl = document.getElementById('sectionsGrid');
  const overviewEl     = document.getElementById('curriculumOverview');

  const SECTION_META = {
    vocabulary:        { label: 'Vocabulary',          icon: 'mdi:book-alphabet',   color: 'var(--primary)' },
    synonyms_antonyms: { label: 'Synonyms & Antonyms',  icon: 'mdi:swap-horizontal', color: 'var(--info)' },
    idioms:            { label: 'Idioms',               icon: 'mdi:chat-outline',    color: 'var(--accent)' },
    derivatives:       { label: 'Derivatives',          icon: 'mdi:family-tree',     color: 'var(--warning)' }
  };
  const SECTION_ORDER = ['vocabulary', 'synonyms_antonyms', 'idioms', 'derivatives'];

  const state = {
    mdIndex: [],
    currentUnit: null,
    currentGroup: null
  };

  const wordCountCache = new Map();

  /* ---------- helpers ---------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getSectionCount(filePath) {
    if (wordCountCache.has(filePath)) return wordCountCache.get(filePath);

    const text = await Search.loadFileText(filePath);
    if (!text) {
      wordCountCache.set(filePath, null);
      return null;
    }
    try {
      const wrapper = Uimd.getRendered(filePath, text);
      const cards = wrapper.querySelectorAll('.word-list .word-card').length;
      const tableRows = wrapper.querySelectorAll('.accordion-content table tbody tr').length;
      const total = cards > 0 ? cards : tableRows;
      wordCountCache.set(filePath, total);
      return total;
    } catch (e) {
      console.error('[UiCards] getSectionCount failed for', filePath, e);
      wordCountCache.set(filePath, null);
      return null;
    }
  }

  async function getSectionSaved(filePath, total) {
    if (total === null || total === 0) return 0;
    return Storage.getFileStats(filePath).saved;
  }

  /* ============================================================
     OVERVIEW — إحصائيات المنهج الكامل
     ============================================================ */
  async function renderOverview(mdIndex) {
    if (!overviewEl) return;

    // اجمع إحصائيات كل الأقسام
    let totalAll = 0;
    let savedAll = 0;

    const tasks = [];
    mdIndex.forEach(unit => {
      (unit.groups || []).forEach(group => {
        SECTION_ORDER.forEach(key => {
          const path = group.sections ? group.sections[key] : null;
          if (!path) return;
          tasks.push((async () => {
            const total = await getSectionCount(path);
            if (total === null) return;
            const saved = Storage.getFileStats(path).saved;
            totalAll += total;
            savedAll += saved;
          })());
        });
      });
    });
    await Promise.all(tasks);

    const pct = totalAll > 0 ? Math.round((savedAll / totalAll) * 100) : 0;

    // آخر وحدة
    const lastUnit = Storage.getLastUnit();

    // عدد الوحدات الكلي
    const totalUnits = mdIndex.length;

    overviewEl.innerHTML = `
      <div class="overview-card" dir="auto">
        <div class="overview-stat">
          <span class="overview-stat-value">${totalAll}</span>
          <span class="overview-stat-label">إجمالي العناصر</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat-value">${savedAll}</span>
          <span class="overview-stat-label">تم حفظها</span>
        </div>
        <div class="overview-ring">
          <svg viewBox="0 0 80 80" class="ring-svg">
            <circle cx="40" cy="40" r="34" class="ring-bg"/>
            <circle cx="40" cy="40" r="34" class="ring-fill"
                    stroke-dasharray="${2 * Math.PI * 34}"
                    stroke-dashoffset="${2 * Math.PI * 34 * (1 - pct / 100)}"/>
          </svg>
          <div class="ring-text">${pct}%</div>
        </div>
        <div class="overview-stat">
          <span class="overview-stat-value">${lastUnit ? 'Unit ' + lastUnit : '—'}</span>
          <span class="overview-stat-label">آخر وحدة</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat-value">${totalUnits}</span>
          <span class="overview-stat-label">عدد الوحدات</span>
        </div>
      </div>
    `;
  }

  /* ============================================================
     UNITS GRID (Home)
     ============================================================ */
  async function renderUnitsGrid(mdIndex) {
    state.mdIndex = mdIndex;
    unitsGridEl.innerHTML = '';

    if (!mdIndex || !mdIndex.length) {
      unitsGridEl.innerHTML = `<div class="loading">لا توجد وحدات بعد.</div>`;
      return;
    }

    // كارت لكل وحدة
    unitsGridEl.innerHTML = mdIndex.map((unit, idx) => `
      <article class="grid-card unit-grid-card"
               tabindex="0"
               role="button"
               data-unit="${unit.unit}"
               style="animation-delay:${idx * 25}ms"
               dir="auto">
        <div class="grid-card-top">
          <div class="grid-card-icon">
            <iconify-icon icon="mdi:school-outline"></iconify-icon>
          </div>
          <span class="grid-card-badge" data-unit-badge>—</span>
        </div>
        <h3 class="grid-card-title">Unit ${unit.unit}</h3>
        <p class="grid-card-subtitle" data-unit-subtitle>جاري التحميل...</p>
        <div class="grid-card-progress">
          <div class="grid-card-progress-track">
            <div class="grid-card-progress-fill" data-unit-fill style="width:0%"></div>
          </div>
          <span class="grid-card-progress-text" data-unit-progress-text>0 / 0</span>
        </div>
      </article>
    `).join('');

    // event delegation
    unitsGridEl.onclick = (e) => {
      const card = e.target.closest('.unit-grid-card');
      if (!card) return;
      const unitNum = parseInt(card.dataset.unit, 10);
      const unit = state.mdIndex.find(u => u.unit === unitNum);
      if (unit) openUnit(unit);
    };
    unitsGridEl.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.unit-grid-card');
      if (!card) return;
      e.preventDefault();
      card.click();
    };

    // احسب الإحصائيات لكل وحدة
    mdIndex.forEach(unit => updateUnitCard(unit));
    renderOverview(mdIndex);
  }

  async function updateUnitCard(unit) {
    const card = unitsGridEl.querySelector(`.unit-grid-card[data-unit="${unit.unit}"]`);
    if (!card) return;

    let totalItems = 0;
    let savedItems = 0;
    let filesCount = 0;

    const tasks = [];
    (unit.groups || []).forEach(group => {
      SECTION_ORDER.forEach(key => {
        const path = group.sections ? group.sections[key] : null;
        if (!path) return;
        tasks.push((async () => {
          const total = await getSectionCount(path);
          if (total === null) return;
          totalItems += total;
          savedItems += Storage.getFileStats(path).saved;
          filesCount++;
        })());
      });
    });
    await Promise.all(tasks);

    const pct = totalItems > 0 ? Math.round((savedItems / totalItems) * 100) : 0;

    const badge = card.querySelector('[data-unit-badge]');
    const subtitle = card.querySelector('[data-unit-subtitle]');
    const fill = card.querySelector('[data-unit-fill]');
    const ptext = card.querySelector('[data-unit-progress-text]');

    if (badge) badge.textContent = totalItems > 0 ? pct + '%' : 'قريبًا';
    if (subtitle) {
      subtitle.textContent = totalItems === 0
        ? 'لا يوجد محتوى بعد'
        : `${filesCount} أقسام · ${totalItems} عنصر`;
    }
    if (fill) fill.style.width = pct + '%';
    if (ptext) ptext.textContent = `${savedItems} / ${totalItems}`;

    card.classList.toggle('complete', pct >= 100 && totalItems > 0);
  }

  /* ============================================================
     GROUPS GRID (Unit Page)
     ============================================================ */
  async function renderGroupsGrid(unit) {
    state.currentUnit = unit;
    groupsGridEl.innerHTML = '';

    const groups = unit.groups || [];
    if (!groups.length) {
      groupsGridEl.innerHTML = `<div class="loading">لا توجد مجموعات.</div>`;
      return;
    }

    groupsGridEl.innerHTML = groups.map((group, idx) => `
      <article class="grid-card group-grid-card"
               tabindex="0"
               role="button"
               data-group-id="${group.id}"
               style="animation-delay:${idx * 30}ms"
               dir="auto">
        <div class="grid-card-top">
          <div class="grid-card-icon">
            <iconify-icon icon="mdi:book-open-variant"></iconify-icon>
          </div>
          <span class="grid-card-badge" data-group-badge>—</span>
        </div>
        <h3 class="grid-card-title">${escapeHtml(group.label)}</h3>
        <p class="grid-card-subtitle" data-group-subtitle>جاري التحميل...</p>
        <div class="grid-card-progress">
          <div class="grid-card-progress-track">
            <div class="grid-card-progress-fill" data-group-fill style="width:0%"></div>
          </div>
          <span class="grid-card-progress-text" data-group-progress-text>0 / 0</span>
        </div>
      </article>
    `).join('');

    groupsGridEl.onclick = (e) => {
      const card = e.target.closest('.group-grid-card');
      if (!card) return;
      const groupId = card.dataset.groupId;
      const group = state.currentUnit.groups.find(g => g.id === groupId);
      if (group) openGroup(state.currentUnit, group);
    };
    groupsGridEl.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.group-grid-card');
      if (!card) return;
      e.preventDefault();
      card.click();
    };

    groups.forEach(group => updateGroupCard(group));
  }

  async function updateGroupCard(group) {
    const card = groupsGridEl.querySelector(`.group-grid-card[data-group-id="${group.id}"]`);
    if (!card) return;

    let totalItems = 0;
    let savedItems = 0;
    let filesCount = 0;

    const tasks = [];
    SECTION_ORDER.forEach(key => {
      const path = group.sections ? group.sections[key] : null;
      if (!path) return;
      tasks.push((async () => {
        const total = await getSectionCount(path);
        if (total === null) return;
        totalItems += total;
        savedItems += Storage.getFileStats(path).saved;
        filesCount++;
      })());
    });
    await Promise.all(tasks);

    const pct = totalItems > 0 ? Math.round((savedItems / totalItems) * 100) : 0;

    const badge = card.querySelector('[data-group-badge]');
    const subtitle = card.querySelector('[data-group-subtitle]');
    const fill = card.querySelector('[data-group-fill]');
    const ptext = card.querySelector('[data-group-progress-text]');

    if (badge) badge.textContent = totalItems > 0 ? pct + '%' : 'قريبًا';
    if (subtitle) {
      subtitle.textContent = totalItems === 0
        ? 'لا يوجد محتوى بعد'
        : `${filesCount} أقسام · ${totalItems} عنصر`;
    }
    if (fill) fill.style.width = pct + '%';
    if (ptext) ptext.textContent = `${savedItems} / ${totalItems}`;

    card.classList.toggle('complete', pct >= 100 && totalItems > 0);
  }

  /* ============================================================
     SECTIONS GRID (Group Page)
     ============================================================ */
  async function renderSectionsGrid(group) {
    state.currentGroup = group;
    sectionsGridEl.innerHTML = '';

    sectionsGridEl.innerHTML = SECTION_ORDER.map((key, idx) => {
      const meta = SECTION_META[key];
      const path = group.sections ? group.sections[key] : null;
      const exists = !!path;
      return `
        <article class="grid-card section-grid-card ${exists ? '' : 'missing'}"
                 tabindex="${exists ? '0' : '-1'}"
                 role="button"
                 data-section-key="${key}"
                 data-section-path="${path || ''}"
                 style="animation-delay:${idx * 30}ms"
                 dir="auto">
          <div class="grid-card-top">
            <div class="grid-card-icon" style="background: ${meta.color}22; color: ${meta.color};">
              <iconify-icon icon="${meta.icon}"></iconify-icon>
            </div>
            <span class="grid-card-badge" data-section-badge>—</span>
          </div>
          <h3 class="grid-card-title">${meta.label}</h3>
          <p class="grid-card-subtitle" data-section-subtitle>${exists ? 'جاري التحميل...' : 'قريبًا'}</p>
          <div class="grid-card-progress">
            <div class="grid-card-progress-track">
              <div class="grid-card-progress-fill" data-section-fill style="width:0%; background: ${meta.color};"></div>
            </div>
            <span class="grid-card-progress-text" data-section-progress-text>0 / 0</span>
          </div>
        </article>
      `;
    }).join('');

    sectionsGridEl.onclick = (e) => {
      const card = e.target.closest('.section-grid-card');
      if (!card || card.classList.contains('missing')) return;
      const path = card.dataset.sectionPath;
      const key = card.dataset.sectionKey;
      if (!path) return;
      openSectionFromCard(path, key);
    };
    sectionsGridEl.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.section-grid-card');
      if (!card || card.classList.contains('missing')) return;
      e.preventDefault();
      card.click();
    };

    // عدّادات
    SECTION_ORDER.forEach(key => updateSectionCard(group, key));
  }

  async function updateSectionCard(group, key) {
    const meta = SECTION_META[key];
    const card = sectionsGridEl.querySelector(`.section-grid-card[data-section-key="${key}"]`);
    if (!card) return;

    const path = group.sections ? group.sections[key] : null;
    if (!path) return;

    const total = await getSectionCount(path);
    const badge = card.querySelector('[data-section-badge]');
    const subtitle = card.querySelector('[data-section-subtitle]');
    const fill = card.querySelector('[data-section-fill]');
    const ptext = card.querySelector('[data-section-progress-text]');

    if (total === null) {
      card.classList.add('missing');
      card.setAttribute('tabindex', '-1');
      if (badge) badge.textContent = 'قريبًا';
      if (subtitle) subtitle.textContent = 'لم يُضف بعد';
      return;
    }

    const saved = Storage.getFileStats(path).saved;
    const pct = total > 0 ? Math.round((saved / total) * 100) : 0;

    if (badge) badge.textContent = pct + '%';
    if (subtitle) subtitle.textContent = `${total} عنصر`;
    if (fill) fill.style.width = pct + '%';
    if (ptext) ptext.textContent = `${saved} / ${total}`;

    card.classList.toggle('complete', pct >= 100 && total > 0);
  }

  /* ============================================================
     Hooks (يتم تعيينها من app.js)
     ============================================================ */
  let onOpenUnit = null;
  let onOpenGroup = null;
  let onOpenSection = null;

  function setHandlers(h) {
    if (h.openUnit) onOpenUnit = h.openUnit;
    if (h.openGroup) onOpenGroup = h.openGroup;
    if (h.openSection) onOpenSection = h.openSection;
  }

  function openUnit(unit) { if (onOpenUnit) onOpenUnit(unit); }
  function openGroup(unit, group) { if (onOpenGroup) onOpenGroup(unit, group); }
  function openSectionFromCard(path, key) { if (onOpenSection) onOpenSection(path, key); }

  /* ============================================================
     Refresh (يُنادى من app.js)
     ============================================================ */
  async function refreshCounts() {
    if (state.mdIndex.length) {
      state.mdIndex.forEach(unit => updateUnitCard(unit));
      renderOverview(state.mdIndex);
    }
    if (state.currentUnit) {
      (state.currentUnit.groups || []).forEach(group => updateGroupCard(group));
    }
    if (state.currentGroup) {
      SECTION_ORDER.forEach(key => updateSectionCard(state.currentGroup, key));
    }
  }

  return {
    renderUnitsGrid,
    renderGroupsGrid,
    renderSectionsGrid,
    refreshCounts,
    setHandlers,
    getState: () => state
  };
})();