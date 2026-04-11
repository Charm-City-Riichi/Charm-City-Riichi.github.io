(function () {
  'use strict';

  var NAV_HTML =
    '<header class="site-header">' +
      '<div class="header-inner">' +
        '<a href="/" class="site-logo">Charm City Riichi</a>' +
        '<button class="nav-toggle" aria-label="Toggle navigation"><span></span></button>' +
        '<ul class="main-nav">' +
          '<li><a href="/">Home</a></li>' +
          '<li class="dropdown">' +
            '<a href="/events.html" aria-haspopup="true" aria-expanded="false">Events</a>' +
            '<ul class="dropdown-menu">' +
              '<li><a href="/events/weekly-meet-ups.html">Weekly Meet-Ups</a></li>' +
              '<li><a href="/events/one-day-events.html">One-Day Events</a></li>' +
              '<li><a href="/events/ccro.html">CCRO \'26</a></li>' +
            '</ul>' +
          '</li>' +
          '<li class="dropdown">' +
            '<a href="/how-to-play/" aria-haspopup="true" aria-expanded="false">How to Play</a>' +
            '<ul class="dropdown-menu">' +
              '<li><a href="/how-to-play/getting-started.html">Getting Started</a></li>' +
              '<li><a href="/how-to-play/detailed-guide.html">Detailed Guide</a></li>' +
              '<li><a href="/how-to-play/strategy.html">Strategy</a></li>' +
              '<li><a href="/how-to-play/3-player.html">3-Player Rules</a></li>' +
            '</ul>' +
          '</li>' +
          '<li class="dropdown">' +
            '<a href="/scoring.html" aria-haspopup="true" aria-expanded="false">Scoring</a>' +
            '<ul class="dropdown-menu">' +
              '<li><a href="/scoring/calculator.html">Calculator</a></li>' +
            '</ul>' +
          '</li>' +
          '<li class="dropdown">' +
            '<a href="/practice/" aria-haspopup="true" aria-expanded="false">Practice</a>' +
            '<ul class="dropdown-menu">' +
              '<li><a href="/practice/efficiency.html">Efficiency Trainer</a></li>' +
              '<li><a href="/practice/waits.html">Waits Trainer</a></li>' +
              '<li><a href="/practice/scoring.html">Score Trainer</a></li>' +
            '</ul>' +
          '</li>' +
          '<li><a href="/play-online.html">Play Online</a></li>' +
          '<li><a href="/contact.html">Contact</a></li>' +
        '</ul>' +
      '</div>' +
    '</header>';

  var placeholder = document.getElementById('site-nav');
  if (placeholder) {
    placeholder.outerHTML = NAV_HTML;
  }

  // Set active link based on current path
  var path = window.location.pathname;
  var links = document.querySelectorAll('.main-nav a');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    if (href === '#') { continue; }
    var isHome = href === '/';
    var matches = isHome ? path === '/' : path === href || path.indexOf(href.replace(/\.html$/, '')) === 0;
    if (matches) {
      links[i].classList.add('active');
    }
  }
})();
