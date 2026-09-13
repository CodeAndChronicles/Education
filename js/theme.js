/* =========================================================
   theme.js — منطق الوضع الليلي/النهاري فقط
   ========================================================= */
window.Theme = (function () {
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');

  function apply(mode) {
    if (mode === 'dark') {
      document.body.classList.add('dark');
      icon.setAttribute('icon', 'mdi:weather-night');
      label.textContent = 'Dark';
    } else {
      document.body.classList.remove('dark');
      icon.setAttribute('icon', 'mdi:weather-sunny');
      label.textContent = 'Light';
    }
  }

  function init() {
    apply(Storage.getTheme());
    btn.addEventListener('click', () => {
      const next = document.body.classList.contains('dark') ? 'light' : 'dark';
      Storage.setTheme(next);
      apply(next);
    });
  }

  return { init };
})();