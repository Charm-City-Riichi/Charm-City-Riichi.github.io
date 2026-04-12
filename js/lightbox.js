(function () {
  'use strict';

  function initLightbox(selector) {
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    if (!lb || !lbImg) return;

    var lastFocused = null;
    var currentContainer = null;
    var currentImgIndex = -1;
    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close image viewer');
    closeBtn.classList.add('lightbox-close');
    closeBtn.innerHTML = '&times;';
    lb.appendChild(closeBtn);

    function openLightbox(img, container) {
      lastFocused = document.activeElement;
      currentContainer = container;
      var images = Array.from(container ? container.querySelectorAll('img') : [img]);
      currentImgIndex = images.indexOf(img);
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lb.classList.add('active');
      lb.setAttribute('aria-hidden', 'false');
      closeBtn.focus();
    }

    function showNextImage() {
      if (!currentContainer || currentImgIndex < 0) return;
      var images = Array.from(currentContainer.querySelectorAll('img'));
      if (images.length === 0) return;
      currentImgIndex = (currentImgIndex + 1) % images.length;
      lbImg.src = images[currentImgIndex].src;
      lbImg.alt = images[currentImgIndex].alt;
    }

    function showPrevImage() {
      if (!currentContainer || currentImgIndex < 0) return;
      var images = Array.from(currentContainer.querySelectorAll('img'));
      if (images.length === 0) return;
      currentImgIndex = (currentImgIndex - 1 + images.length) % images.length;
      lbImg.src = images[currentImgIndex].src;
      lbImg.alt = images[currentImgIndex].alt;
    }

    function closeLightbox() {
      lb.classList.remove('active');
      lb.setAttribute('aria-hidden', 'true');
      lbImg.src = '';
      if (lastFocused) lastFocused.focus();
    }

    closeBtn.addEventListener('click', closeLightbox);

    document.querySelectorAll(selector).forEach(function (container) {
      container.addEventListener('click', function (e) {
        if (e.target.tagName !== 'IMG') return;
        openLightbox(e.target, container);
      });
    });

    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('active')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        showNextImage();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showPrevImage();
      }
      if (e.key === 'Tab') {
        var focusableElements = [lbImg, closeBtn].filter(function (el) {
          return el.offsetParent !== null;
        });
        if (focusableElements.length === 0) return;
        var currentFocus = document.activeElement;
        var currentIndex = focusableElements.indexOf(currentFocus);
        var nextIndex = (currentIndex + 1) % focusableElements.length;
        if (e.shiftKey) {
          nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
        }
        e.preventDefault();
        focusableElements[nextIndex].focus();
      }
    });
  }

  window.initLightbox = initLightbox;
})();
