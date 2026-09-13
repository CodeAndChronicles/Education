/* =========================================================
   ui-cards.js — Unit cards كبيرة مريحة (V1 style)
   - كل كارت فيه: badge رقم الوحدة + عنوان + subtitle + counter
   - progress bar تحت كل كارت
   - sections مع اسم الملف
   ========================================================= */
window.UiCards = (function () {

  const treeEl = document.getElementById('unitsTree');

  const SECTION_LABELS = {
    vocabulary:        'Vocabulary',
    synonyms_antonyms: 'Synonyms & Antonyms',
    idioms:            'Idioms',
    derivatives:       'Derivatives'
  };

  const SECTION_ICONS = {
    vocabulary:        'mdi:book-alphabet',
    synonyms_antonyms: 'mdi:swap-horizontal',
    idioms:            'mdi:chat-outline',
    derivatives:       'mdi:family-tree'
  };

  const SECTION_ORDER = ['vocabulary', 'synonyms_antonyms', 'idioms', 'derivatives'];

  const wordCountCache = new Map();

  /* ---------- helpers ---------- */
  function basename(path) {
    if (!path) return '';
    return path.split('/').pop();
  }

  function fileExt(path) {
    const name = basename(path);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
  }

  async function getSectionCount(filePath) {
    if (wordCountCache.has(filePath)) return wordCountCache.get(filePath);
    const text = await Search.loadFileText(filePath);
    if (!text) {
      wordCountCache.set(filePath, null);
      return null;
    }
    const wrapper = Uimd.getRendered(filePath, text);
    const cards = wrapper.querySelectorAll('.word-list .word-card').length;
    const tableRows = wrapper.querySelectorAll('.accordion-content table tbody tr').length;
    const total = cards > 0 ? cards : tableRows;
    wordCountCache.set(filePath, total);
    return total;
  }

  /* ---------- render tree ---------- */
  async function renderTree(mdIndex, onOpenSection) {
    treeEl.innerHTML = '';

    if (!mdIndex || !mdIndex.length) {
      treeEl.innerHTML = `<div class="loading">لا توجد وحدات بعد.</div>`;
      return;
    }

    const unitsHtml = mdIndex.map((unit, uIdx) => {
      const groupsHtml = (unit.groups || []).map(group => {
        const sectionsHtml = SECTION_ORDER.map(key => {
          const path = group.sections ? group.sections[key] : null;
          if (!path) return '';
          const label = SECTION_LABELS[key] || key;
          const icon = SECTION_ICONS[key] || 'mdi:file-document-outline';
          const sectionId = `${group.id}-${key}`;
          const fileName = basename(path);
          const ext = fileExt(path);

          return `
            <div class="section-row"
                 data-section-id="${sectionId}"
                 data-section-path="${path}"
                 data-section-key="${key}"
                 data-section-label="${label}"
                 data-group-id="${group.id}"
                 data-unit="${unit.unit}"
                 tabindex="0"
                 role="button">
              <div class="section-icon">
                <iconify-icon icon="${icon}"></iconify-icon>
              </div>
              <div class="section-info">
                <div class="section-title">${label}</div>
                <div class="section-meta">
                  <span data-section-count><iconify-icon icon="mdi:format-list-numbered"></iconify-icon> ...</span>
                </div>
                <div class="section-filename">${fileName}</div>
              </div>
              <div class="section-status" data-section-status></div>
              <div class="section-arrow">
                <iconify-icon icon="mdi:chevron-right"></iconify-icon>
              </div>
            </div>
          `;
        }).join('');

        const groupItemCount = SECTION_ORDER
          .filter(k => group.sections && group.sections[k])
          .length;

        return `
          <div class="group-block" data-group-id="${group.id}">
            <div class="group-header" role="button" tabindex="0">
              <span class="group-label">
                <iconify-icon icon="mdi:book-open-variant"></iconify-icon>
                ${group.label}
              </span>
              <span class="group-meta">
                <span class="group-counter-mini">${groupItemCount} أقسام</span>
                <iconify-icon class="group-chevron" icon="mdi:chevron-down"></iconify-icon>
              </span>
            </div>
            <div class="group-content">
              ${sectionsHtml || '<div class="section-empty">Content coming soon</div>'}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="unit-block" data-unit="${unit.unit}" style="animation-delay:${uIdx * 25}ms">
          <div class="unit-header" role="button" tabindex="0">
            <div class="unit-main">
              <div class="unit-badge">${unit.unit}</div>
              <div class="unit-text">
                <div class="unit-label">Unit ${unit.unit}</div>
                <div class="unit-subtitle" data-unit-subtitle>جاري التحميل...</div>
              </div>
            </div>
            <div class="unit-meta">
              <span class="unit-counter" data-unit-counter>
                <iconify-icon icon="mdi:format-list-numbered"></iconify-icon>
                <span data-unit-counter-text>—</span>
              </span>
              <iconify-icon class="unit-chevron" icon="mdi:chevron-down"></iconify-icon>
            </div>
          </div>
          <div class="unit-progress-wrap">
            <div class="unit-progress-track">
              <div class="unit-progress-fill" data-unit-fill></div>
            </div>
            <div class="unit-progress-label">
              <span data-unit-saved>0 عنصر محفوظ</span>
              <span data-unit-pct>0%</span>
            </div>
          </div>
          <div class="unit-content">
            ${groupsHtml}
          </div>
        </div>
      `;
    }).join('');

    treeEl.innerHTML = unitsHtml;

    bindTreeEvents(onOpenSection);
    loadAllSectionCounts(mdIndex);
  }

  /* ---------- events ---------- */
  function bindTreeEvents(onOpenSection) {
    treeEl.querySelectorAll('.unit-header').forEach(h => {
      const toggle = () => {
        const content = h.parentElement.querySelector('.unit-content');
        const open = h.classList.toggle('open');
        content.classList.toggle('open', open);
      };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    treeEl.querySelectorAll('.group-header').forEach(h => {
      const toggle = () => {
        const content = h.nextElementSibling;
        const open = h.classList.toggle('open');
        content.classList.toggle('open', open);
      };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    treeEl.querySelectorAll('.section-row').forEach(row => {
      const open = () => {
        const path = row.dataset.sectionPath;
        const label = row.dataset.sectionLabel;
        const unit = row.dataset.unit;
        const groupId = row.dataset.groupId;
        const title = `Unit ${unit} · ${groupId} · ${label}`;
        onOpenSection(path, title);
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  /* ---------- counters ---------- */
  async function loadAllSectionCounts(mdIndex) {
    const tasks = [];
    mdIndex.forEach(unit => {
      (unit.groups || []).forEach(group => {
        SECTION_ORDER.forEach(key => {
          const path = group.sections ? group.sections[key] : null;
          if (!path) return;
          tasks.push(updateSectionCount(path));
        });
      });
    });
    await Promise.all(tasks);
    updateAllUnitProgress(mdIndex);
  }

  async function updateSectionCount(path) {
    const row = treeEl.querySelector(`.section-row[data-section-path="${path}"]`);
    if (!row) return;

    const countEl = row.querySelector('[data-section-count]');
    const statusEl = row.querySelector('[data-section-status]');
    const total = await getSectionCount(path);

    if (total === null) {
      row.classList.add('section-missing');
      if (countEl) countEl.innerHTML = `<iconify-icon icon="mdi:clock-outline"></iconify-icon> قريبًا`;
      if (statusEl) statusEl.innerHTML = `<iconify-icon icon="mdi:lock-outline" style="color:var(--text-tertiary);"></iconify-icon>`;
      return;
    }

    if (countEl) countEl.innerHTML = `<iconify-icon icon="mdi:format-list-numbered"></iconify-icon> ${total} عنصر`;

    const saved = Storage.getFileStats(path).saved;
    const pct = total > 0 ? Math.round((saved / total) * 100) : 0;

    if (pct >= 100) {
      row.classList.add('section-complete');
      if (statusEl) statusEl.innerHTML = `<iconify-icon icon="mdi:check-circle" style="color:var(--success);font-size:1.5rem;"></iconify-icon>`;
    } else if (saved > 0) {
      if (statusEl) statusEl.innerHTML = `<span style="font-size:0.85rem;color:var(--primary);font-weight:800;">${pct}%</span>`;
    }
  }

  function updateAllUnitProgress(mdIndex) {
    mdIndex.forEach(unit => {
      const block = treeEl.querySelector(`.unit-block[data-unit="${unit.unit}"]`);
      if (!block) return;

      let totalItems = 0;
      let savedItems = 0;
      let filesCount = 0;

      (unit.groups || []).forEach(group => {
        SECTION_ORDER.forEach(key => {
          const path = group.sections ? group.sections[key] : null;
          if (!path) return;
          const cached = wordCountCache.get(path);
          if (cached === null || cached === undefined) return;
          totalItems += cached;
          savedItems += Storage.getFileStats(path).saved;
          filesCount++;
        });
      });

      const pct = totalItems > 0 ? Math.round((savedItems / totalItems) * 100) : 0;
      const fill = block.querySelector('[data-unit-fill]');
      const pctEl = block.querySelector('[data-unit-pct]');
      const savedEl = block.querySelector('[data-unit-saved]');
      const counterText = block.querySelector('[data-unit-counter-text]');
      const subtitle = block.querySelector('[data-unit-subtitle]');

      if (fill) fill.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (savedEl) savedEl.textContent = `${savedItems} من ${totalItems} عنصر`;
      if (counterText) {
        counterText.textContent = totalItems === 0 ? 'قريبًا' : `${totalItems} عنصر`;
      }
      if (subtitle) {
        subtitle.textContent = totalItems === 0
          ? 'لا يوجد محتوى بعد'
          : `${filesCount} أقسام · ${totalItems} عنصر`;
      }

      // شارة إكمال
      block.classList.toggle('unit-complete', pct >= 100 && totalItems > 0);
    });
  }

  async function refreshAll(mdIndex) {
    wordCountCache.clear();
    await loadAllSectionCounts(mdIndex);
  }

  return { renderTree, refreshAll };
})();