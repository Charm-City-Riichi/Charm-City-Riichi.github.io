(function () {
  'use strict';

  function initLightbox(selector) {
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    if (!lb || !lbImg) return;

    var lastFocused = null;

    function openLightbox(img) {
      lastFocused = document.activeElement;
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lb.classList.add('active');
      lb.setAttribute('aria-hidden', 'false');
      lb.focus();
    }

    function closeLightbox() {
      lb.classList.remove('active');
      lb.setAttribute('aria-hidden', 'true');
      lbImg.src = '';
      if (lastFocused) lastFocused.focus();
    }

    document.querySelectorAll(selector).forEach(function (container) {
      container.addEventListener('click', function (e) {
        if (e.target.tagName !== 'IMG') return;
        openLightbox(e.target);
      });
    });

    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  window.initLightbox = initLightbox;
})();
