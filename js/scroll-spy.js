(function () {
  'use strict';

  var toc = document.querySelector('.htp-toc');
  if (!toc) return;

  var links = toc.querySelectorAll('a[href^="#"]');
  var sections = [];

  links.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) sections.push({ el: section, link: link });
  });

  if (!sections.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var match = sections.find(function (s) { return s.el === entry.target; });
      if (!match) return;
      if (entry.isIntersecting) {
        links.forEach(function (l) { l.classList.remove('active'); });
        match.link.classList.add('active');
      }
    });
  }, {
    rootMargin: '-60px 0px -60% 0px',
    threshold: 0
  });

  sections.forEach(function (s) { observer.observe(s.el); });
})();
