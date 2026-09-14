/* =========================================================
   UImd.js — محرك عرض Markdown ثابت
   - Parse (marked)
   - Emoji → iconify (🟢 / 🟡 / 🔴)
   - Build accordions داخل grid wrapper
   - تحويل جداول الكلمات إلى word-cards (يقرأ كل الأعمدة ديناميكيًا)
   - Cache DOM الناتج
   ========================================================= */
window.Uimd = (function () {

  const renderedCache = new Map();

  /* ---------- Emoji replacement ---------- */
  function replaceEmojisInTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text) return;
      const newHtml = text
        .replace(/🟢/g, '<iconify-icon icon="mdi:circle" style="color:var(--success);font-size:1.1em;vertical-align:middle;"></iconify-icon>')
        .replace(/🟡/g, '<iconify-icon icon="mdi:circle" style="color:var(--warning);font-size:1.1em;vertical-align:middle;"></iconify-icon>')
        .replace(/🔴/g, '<iconify-icon icon="mdi:circle" style="color:var(--danger);font-size:1.1em;vertical-align:middle;"></iconify-icon>');
      if (newHtml !== text) {
        const span = document.createElement('span');
        span.innerHTML = newHtml;
        node.parentNode.replaceChild(span, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
      Array.from(node.childNodes).forEach(replaceEmojisInTextNodes);
    }
  }

  /* ---------- Accordion building ---------- */
  function buildAccordions(container) {
    const children = Array.from(container.children);
    const sections = [];
    const rootNodes = [];
    let current = null;

    children.forEach(el => {
      const tag = el.tagName;
      if (tag === 'H3') {
        if (current) sections.push(current);
        current = { heading: el.textContent.trim(), nodes: [] };
      } else if (tag === 'H1' || tag === 'H2') {
        if (current) { sections.push(current); current = null; }
        rootNodes.push(el);
      } else {
        if (current) current.nodes.push(el);
        else rootNodes.push(el);
      }
    });
    if (current) sections.push(current);

    while (container.firstChild) container.removeChild(container.firstChild);
    rootNodes.forEach(n => container.appendChild(n));

    if (sections.length) {
      const gridWrap = document.createElement('div');
      gridWrap.className = 'accordion-groups-grid';
      gridWrap.setAttribute('dir', 'ltr');

      sections.forEach(section => {
        const acc = document.createElement('div');
        acc.className = 'accordion-group';
        acc.setAttribute('dir', 'auto');

        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.innerHTML = `
          <span class="accordion-meta-left">
            <label class="check-label group-check-label" data-group-check>
              <input type="checkbox" data-group-toggle aria-label="تحديد المجموعة كاملة">
              <span class="custom-check"><iconify-icon icon="mdi:check-bold"></iconify-icon></span>
            </label>
            <span class="accordion-title">${section.heading}</span>
          </span>
          <span class="accordion-meta">
            <span class="group-counter" data-counter>0/0</span>
            <iconify-icon icon="mdi:chevron-down"></iconify-icon>
          </span>
        `;

        const content = document.createElement('div');
        content.className = 'accordion-content';
        section.nodes.forEach(n => content.appendChild(n));

        acc.appendChild(header);
        acc.appendChild(content);
        gridWrap.appendChild(acc);
      });

      container.appendChild(gridWrap);
    }
  }

  /* ---------- ✅ Transform word tables → word cards (dynamic columns) ---------- */
  function transformWordTables(container) {
    const tables = container.querySelectorAll('.accordion-content table');

    tables.forEach((table, tableIndex) => {
      // حماية: لازم يكون فيه أيقونة صعوبة
      const hasStatusIcon = !!table.querySelector('tbody tr td iconify-icon[icon="mdi:circle"]');
      if (!hasStatusIcon) return;

      // اقرأ عناوين الأعمدة من thead
      const headRow = table.querySelector('thead tr');
      const headerCells = headRow ? Array.from(headRow.querySelectorAll('th')) : [];

      // ابني قائمة بعناوين الأعمدة (بعد استثناء عمود الحالة الأول لو فاضي)
      const columnLabels = headerCells.map(th => th.textContent.trim());

      // لو العمود الأول فاضي (عمود الحالة)، سيب الـ label بتاعه فاضي
      // نتخطى أول عمود لو هو حالة (fاضي header أو أول header فيه أيقونة)
      let dataStartIdx = 0;
      // لو أول label فاضي، يبقى العمود الأول هو الحالة
      if (columnLabels[0] === '' || /^\s*$/.test(columnLabels[0])) {
        dataStartIdx = 1;
      }

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const list = document.createElement('div');
      list.className = 'word-list';
      list.setAttribute('dir', 'ltr');

      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 2) return;

        // استخرج الحالة (لو موجودة) + باقي الأعمدة
        let statusHtml = '';
        let dataCells = cells;

        // لو الخلية الأولى فيها أيقونة دايرة → هي الحالة
        const firstCellHasIcon = cells[0].querySelector('iconify-icon[icon="mdi:circle"]');
        if (firstCellHasIcon) {
          statusHtml = cells[0].innerHTML.trim();
          dataCells = cells.slice(1);
        }

        // لو مفيش كلمة، تخطى
        if (!dataCells.length) return;
        const primaryText = dataCells[0] ? dataCells[0].textContent.trim() : '';
        if (!primaryText) return;

        // ابني الكارت
        const slug = primaryText.replace(/\s+/g, '_').toLowerCase();
        const card = document.createElement('div');
        card.className = 'word-card';
        card.setAttribute('dir', 'auto');
        card.dataset.wordSlug = `t${tableIndex}_r${rowIndex}_${slug}`;
        card.dataset.wordText = primaryText;
        // المعنى بيبقى العمود اللي بعده
        card.dataset.meaningText = dataCells[1] ? dataCells[1].textContent.trim() : '';

        // ابني الأعمدة الإضافية كـ rows
        // العمود الأول (dataCells[0]) = الكلمة الأساسية (primary)
        // باقي الأعمدة = labeled rows
        const primaryHtml = dataCells[0].innerHTML.trim();

        const extraRowsHtml = [];
        for (let i = 1; i < dataCells.length; i++) {
          const cellHtml = dataCells[i].innerHTML.trim();
          const cellText = dataCells[i].textContent.trim();
          if (!cellText) continue;

          // ابحث عن الـ label المناسب من columnLabels
          // dataCells[i] corresponds to (dataStartIdx + i) in original header
          let label = '';
          const originalIdx = dataStartIdx + i;
          if (columnLabels[originalIdx]) {
            label = columnLabels[originalIdx];
          }

          // لو مفيش label، اعرض بدون
          const labelHtml = label ? `<span class="field-label">${label}:</span> ` : '';
          extraRowsHtml.push(
            `<div class="word-field"><span class="word-field-label">${labelHtml}</span><span class="word-field-value">${cellHtml}</span></div>`
          );
        }

        card.innerHTML = `
          ${statusHtml ? `<span class="word-status">${statusHtml}</span>` : ''}
          <div class="word-main">
            <div class="word-en">${primaryHtml}</div>
            ${extraRowsHtml.join('')}
          </div>
          <div class="word-controls-slot"></div>
        `;
        list.appendChild(card);
      });

      table.replaceWith(list);
    });
  }

  /* ---------- Parse ---------- */
  function parse(mdText) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = marked.parse(mdText);

    replaceEmojisInTextNodes(wrapper);
    buildAccordions(wrapper);
    transformWordTables(wrapper);

    return wrapper;
  }

  /* ---------- Public API ---------- */
  function getRendered(filePath, mdText) {
    let cached = renderedCache.get(filePath);
    if (!cached) {
      cached = parse(mdText);
      renderedCache.set(filePath, cached);
    }
    return cached.cloneNode(true);
  }

  function invalidate(filePath) {
    if (filePath) renderedCache.delete(filePath);
    else renderedCache.clear();
  }

  return { getRendered, invalidate };
})();