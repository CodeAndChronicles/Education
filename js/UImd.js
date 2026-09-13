/* =========================================================
   Uimd.js — محرك عرض Markdown ثابت
   - Parse (marked)
   - Emoji → iconify (🟢 / 🟡 / 🔴 / 🔊)
   - Build accordions (Forward + Build pass) داخل grid wrapper
   - Group checkbox في هيدر كل مجموعة
   - تحويل جداول الكلمات إلى word-cards
   - Cache DOM الناتج
   ========================================================= */
window.Uimd = (function () {

  const renderedCache = new Map(); // filePath -> HTMLElement (fragment wrapper)

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

  /* ---------- Accordion building (Forward + Build pass) ---------- */
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

    // Rebuild
    while (container.firstChild) container.removeChild(container.firstChild);

    rootNodes.forEach(n => container.appendChild(n));

    if (sections.length) {
      const gridWrap = document.createElement('div');
      gridWrap.className = 'accordion-groups-grid';

      sections.forEach(section => {
        const acc = document.createElement('div');
        acc.className = 'accordion-group';

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

  /* ---------- Transform word tables → word cards ---------- */
  function transformWordTables(container) {
    const tables = container.querySelectorAll('.accordion-content table');
    tables.forEach((table, tableIndex) => {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const list = document.createElement('div');
      list.className = 'word-list';

      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 2) return;

        let idx = 0;
        let statusHtml = '';
        if (cells.length >= 3) {
          statusHtml = cells[0].innerHTML.trim();
          idx = 1;
        }

        const wordHtml = cells[idx] ? cells[idx].innerHTML.trim() : '';
        const wordText = cells[idx] ? cells[idx].textContent.trim() : '';
        const meaningHtml = cells[idx + 1] ? cells[idx + 1].innerHTML.trim() : '';
        const meaningText = cells[idx + 1] ? cells[idx + 1].textContent.trim() : '';
        const exampleHtml = cells[idx + 2] ? cells[idx + 2].innerHTML.trim() : '';
        if (!wordText) return;

        const slug = wordText.replace(/\s+/g, '_').toLowerCase();
        const card = document.createElement('div');
        card.className = 'word-card';
        card.dataset.wordSlug = `t${tableIndex}_r${rowIndex}_${slug}`;
        card.dataset.wordText = wordText;
        card.dataset.meaningText = meaningText;

        card.innerHTML = `
          ${statusHtml ? `<span class="word-status">${statusHtml}</span>` : ''}
          <div class="word-main">
            <div class="word-en">${wordHtml}</div>
            <div class="word-ar">${meaningHtml}</div>
            ${exampleHtml && exampleHtml !== '-' ? `<div class="word-example">${exampleHtml}</div>` : ''}
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