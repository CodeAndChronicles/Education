/* =========================================================
   storage.js — كل التعامل مع localStorage
   شكل التخزين:
     ee_progress_<fileId> = JSON { [wordId]: true }
     ee_theme = 'dark' | 'light'
   ========================================================= */
window.Storage = (function () {
  const PROGRESS_PREFIX = 'ee_progress_';
  const THEME_KEY = 'ee_theme';

  // in-memory cache عشان نقلل قراءات localStorage
  const progressCache = new Map(); // fileId -> object

  function readProgress(fileId) {
    if (progressCache.has(fileId)) return progressCache.get(fileId);
    let data = {};
    try {
      const raw = localStorage.getItem(PROGRESS_PREFIX + fileId);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      console.warn('storage: corrupt progress for', fileId, e);
      data = {};
    }
    progressCache.set(fileId, data);
    return data;
  }

  function writeProgress(fileId, data) {
    progressCache.set(fileId, data);
    try {
      localStorage.setItem(PROGRESS_PREFIX + fileId, JSON.stringify(data));
    } catch (e) {
      console.error('storage: write failed', e);
    }
  }

  function isWordSaved(fileId, wordId) {
    return readProgress(fileId)[wordId] === true;
  }

  function setWordSaved(fileId, wordId, saved) {
    const data = readProgress(fileId);
    if (saved) data[wordId] = true;
    else delete data[wordId];
    writeProgress(fileId, data);
  }

  function getFileStats(fileId) {
    const data = readProgress(fileId);
    return { saved: Object.keys(data).length };
  }

  function resetFile(fileId) {
    progressCache.delete(fileId);
    localStorage.removeItem(PROGRESS_PREFIX + fileId);
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  }
  function setTheme(t) {
    localStorage.setItem(THEME_KEY, t);
  }

  return {
    isWordSaved,
    setWordSaved,
    getFileStats,
    resetFile,
    getTheme,
    setTheme
  };
})();