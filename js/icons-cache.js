/* =========================================================
   icons-cache.js — كاش محلي لأيقونات Iconify
   الهدف: تحميل الأيقونات مرة واحدة، وبعدها تشتغل offline
   - Iconify بيخزن الأيقونات في localStorage/IndexedDB تلقائيًا.
   - الملف ده بيـ preload الأيقونات الأساسية عشان أول فتح يبقى سريع.
   ========================================================= */
(function () {
  "use strict";

  const PRELOAD_KEY = 'ee_icons_preloaded_v1';

  // الأيقونات الأساسية اللي بتستخدمها الواجهة
  const ICONS_TO_PRELOAD = [
    'mdi:book-open-page-variant',
    'mdi:book-open-variant',
    'mdi:book-alphabet',
    'mdi:school-outline',
    'mdi:file-document-outline',
    'mdi:magnify',
    'mdi:weather-sunny',
    'mdi:weather-night',
    'mdi:chevron-right',
    'mdi:chevron-down',
    'mdi:arrow-left',
    'mdi:check-bold',
    'mdi:check-circle',
    'mdi:content-copy',
    'mdi:cog-outline',
    'mdi:calendar',
    'mdi:format-list-numbered',
    'mdi:progress-check',
    'mdi:unfold-more-horizontal',
    'mdi:unfold-less-horizontal',
    'mdi:delete-sweep-outline',
    'mdi:swap-horizontal',
    'mdi:chat-outline',
    'mdi:family-tree',
    'mdi:clock-outline',
    'mdi:lock-outline',
    'mdi:circle',
    'mdi:loading',
    'mdi:lightbulb-off-outline',
    'mdi:lightbulb-on-outline',
    'mdi:help-circle'
  ];

  async function preload() {
    // لو اتعمل قبل كده، متعملش تاني
    if (localStorage.getItem(PRELOAD_KEY) === 'true') return;

    // نستخدم Iconify API لتحميل الأيقونات دفعة واحدة
    // الـ iconify-icon بتعمل ده تلقائيًا، بس إحنا بنسرّع العملية
    if (typeof window.IconifyIcon === 'undefined' && typeof customElements !== 'undefined') {
      // استنى الـ custom element يتسجل
      await customElements.whenDefined('iconify-icon').catch(() => {});
    }

    try {
      // نجبر Iconify يحمل الأيقونات عن طريق إنشاء عناصر مخفية
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.width = '0';
      container.style.height = '0';
      container.style.overflow = 'hidden';
      container.style.pointerEvents = 'none';
      container.setAttribute('aria-hidden', 'true');

      ICONS_TO_PRELOAD.forEach(name => {
        const el = document.createElement('iconify-icon');
        el.setAttribute('icon', name);
        container.appendChild(el);
      });

      document.body.appendChild(container);

      // انتظر شوية لحد ما Iconify يحمل الأيقونات
      await new Promise(r => setTimeout(r, 1500));
      container.remove();

      // علّم إننا حمّلنا
      localStorage.setItem(PRELOAD_KEY, 'true');

      console.log('[icons-cache] Preloaded', ICONS_TO_PRELOAD.length, 'icons.');
    } catch (e) {
      console.warn('[icons-cache] Preload failed:', e);
    }
  }

  // شغل الـ preload بعد ما الصفحة تحمل
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preload);
  } else {
    preload();
  }
})();