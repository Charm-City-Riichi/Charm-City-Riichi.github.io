(function () {
  'use strict';

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  // Keyboard-accessible Events dropdown
  var dropdown = document.querySelector('.main-nav .dropdown');
  if (!dropdown) return;

  var trigger = dropdown.querySelector(':scope > a');
  var menu = dropdown.querySelector('.dropdown-menu');
  if (!trigger || !menu) return;

  var items = menu.querySelectorAll('a');

  function openDropdown() {
    dropdown.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
      if (items.length) items[0].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Allow Enter to navigate to events.html (default link behavior)
      // Space toggles the dropdown
      if (e.key === ' ') {
        e.preventDefault();
        if (dropdown.classList.contains('open')) {
          closeDropdown();
        } else {
          openDropdown();
          if (items.length) items[0].focus();
        }
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  items.forEach(function (item, i) {
    item.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (i < items.length - 1) items[i + 1].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (i > 0) items[i - 1].focus();
        else trigger.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
        trigger.focus();
      }
    });
  });

  // Close dropdown when focus leaves it entirely
  dropdown.addEventListener('focusout', function (e) {
    if (!dropdown.contains(e.relatedTarget)) {
      closeDropdown();
    }
  });
})();
