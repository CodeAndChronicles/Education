/* =========================================================
   search-index.js — بناء فهرس البحث من ملفات Markdown
   - يحمّل كل ملفات md مرة واحدة
   - يستخرج كل صف/عنصر مع بياناته
   - يخزن الفهرس في الذاكرة + IndexedDB
   - ✅ Cache Busting عبر CONTENT_VERSION
   ========================================================= */
window.SearchIndex = (function () {

  const DB_NAME = 'ee_search_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'index';

  /* ✅ زوّد الرقم ده يدويًا مع كل تحديث لملفات Files/*.md
        ده بيجبر كل المستخدمين يعيدوا بناء فهرس البحث تلقائيًا */
  const CONTENT_VERSION = 2;
  const INDEX_KEY = `full_index_v${CONTENT_VERSION}`;

  let memoryIndex = null;
  let buildPromise = null;
  let dbPromise = null;

  /* ---------- IndexedDB helpers ---------- */
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function dbGet(key) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function dbSet(key, value) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  async function dbClear() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(INDEX_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  /* ---------- Extract entries from a markdown file ---------- */
  function extractEntries(mdText, filePath, unit, group, section) {
    const entries = [];

    let html;
    try {
      html = marked.parse(mdText);
    } catch (e) {
      return entries;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const tables = tempDiv.querySelectorAll('table');
    tables.forEach((table, tableIdx) => {
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach((row, rowIdx) => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 2) return;

        let idx = 0;
        let statusText = '';
        if (cells.length >= 3) {
          statusText = cells[0].textContent.trim();
          idx = 1;
        }

        const wordText = cells[idx] ? cells[idx].textContent.trim() : '';
        const meaningText = cells[idx + 1] ? cells[idx + 1].textContent.trim() : '';
        const exampleText = cells[idx + 2] ? cells[idx + 2].textContent.trim() : '';
        if (!wordText) return;

        entries.push({
          word: wordText,
          meaning: meaningText,
          example: exampleText,
          status: statusText,
          filePath,
          unit: unit,
          groupId: group.id,
          groupLabel: group.label,
          section: section.key,
          sectionLabel: section.label,
          tableIdx,
          rowIdx
        });
      });
    });

    return entries;
  }

  /* ---------- Build index from mdIndex ---------- */
  async function buildIndex(mdIndex, onProgress) {
    if (buildPromise) return buildPromise;

    buildPromise = (async () => {
      const SECTION_ORDER = ['vocabulary', 'synonyms_antonyms', 'idioms', 'derivatives'];
      const SECTION_LABELS = {
        vocabulary:        'Vocabulary',
        synonyms_antonyms: 'Synonyms & Antonyms',
        idioms:            'Idioms',
        derivatives:       'Derivatives'
      };

      const entries = [];
      let processed = 0;
      let total = 0;

      mdIndex.forEach(unit => {
        (unit.groups || []).forEach(group => {
          SECTION_ORDER.forEach(key => {
            if (group.sections && group.sections[key]) total++;
          });
        });
      });

      const tasks = [];
      mdIndex.forEach(unit => {
        (unit.groups || []).forEach(group => {
          SECTION_ORDER.forEach(key => {
            const path = group.sections ? group.sections[key] : null;
            if (!path) return;
            tasks.push({ unit, group, key, path });
          });
        });
      });

      const BATCH = 6;
      for (let i = 0; i < tasks.length; i += BATCH) {
        const batch = tasks.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async t => {
            try {
              const res = await fetch(t.path);
              if (!res.ok) return null;
              const text = await res.text();
              return { ...t, text };
            } catch (e) {
              return null;
            }
          })
        );

        results.forEach(r => {
          if (!r) return;
          const fileEntries = extractEntries(r.text, r.path, r.unit, r.group, {
            key: r.key,
            label: SECTION_LABELS[r.key] || r.key
          });
          entries.push(...fileEntries);
        });

        processed += batch.length;
        if (onProgress) onProgress(processed, total);
      }

      memoryIndex = {
        entries,
        builtAt: Date.now(),
        totalFiles: total,
        totalEntries: entries.length,
        version: CONTENT_VERSION
      };

      await dbSet(INDEX_KEY, memoryIndex);

      return memoryIndex;
    })();

    try {
      return await buildPromise;
    } finally {
      buildPromise = null;
    }
  }

  /* ---------- Load cached index from IndexedDB ---------- */
  async function loadCached() {
    if (memoryIndex) return memoryIndex;
    const cached = await dbGet(INDEX_KEY);
    if (cached && cached.entries) {
      memoryIndex = cached;
      return memoryIndex;
    }
    return null;
  }

  /* ---------- Get index (memory → DB → build) ---------- */
  async function getIndex(mdIndex, onProgress) {
    if (memoryIndex) return memoryIndex;

    const cached = await loadCached();
    if (cached) return cached;

    return buildIndex(mdIndex, onProgress);
  }

  /* ---------- Query ---------- */
  function query(q, limit = 60) {
    if (!memoryIndex || !q) return [];
    const term = q.trim().toLowerCase();
    if (!term) return [];

    const results = [];
    for (const e of memoryIndex.entries) {
      const word = e.word.toLowerCase();
      const meaning = e.meaning.toLowerCase();
      const example = (e.example || '').toLowerCase();

      let score = 0;
      let matchType = '';

      if (word === term) { score = 100; matchType = 'exact-word'; }
      else if (word.startsWith(term)) { score = 80; matchType = 'start-word'; }
      else if (word.includes(term)) { score = 60; matchType = 'in-word'; }
      else if (meaning.includes(term)) { score = 40; matchType = 'in-meaning'; }
      else if (example.includes(term)) { score = 20; matchType = 'in-example'; }
      else continue;

      results.push({ ...e, score, matchType });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /* ---------- Clear ---------- */
  async function clear() {
    memoryIndex = null;
    await dbClear();
  }

  function hasIndex() {
    return !!memoryIndex;
  }

  function getStats() {
    if (!memoryIndex) return null;
    return {
      totalEntries: memoryIndex.totalEntries,
      totalFiles: memoryIndex.totalFiles,
      builtAt: memoryIndex.builtAt,
      version: memoryIndex.version
    };
  }

  return {
    getIndex,
    buildIndex,
    loadCached,
    query,
    clear,
    hasIndex,
    getStats
  };
})();