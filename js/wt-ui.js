/* Waits Trainer — UI
 *
 * Renders the 13-tile hand, manages the 9-tile clickable answer selector,
 * and handles the check / new-hand flow.
 *
 * Depends on: st-core.js, st-ui.js (for makeTileEl), wt-solver.js, wt-generator.js
 */
(function (WT) {
  'use strict';

  var ST = window.ScoreTrainer;

  function byId(id) { return document.getElementById(id); }

  var SUIT_LABEL = { m: 'Man', p: 'Pin', s: 'Sou' };

  // Current hand state
  var currentHand = null;   // { suit, tiles[13], waits[] }
  var checked = false;

  // ----- Hand rendering ----------------------------------------------------

  function renderHand(hand) {
    var el = byId('wt-hand');
    el.textContent = '';
    for (var i = 0; i < hand.tiles.length; i++) {
      el.appendChild(ST.makeTileEl(hand.tiles[i]));
    }
  }

  // ----- Selector rendering ------------------------------------------------

  function buildSelector(suit) {
    var selector = byId('wt-tile-selector');
    selector.textContent = '';
    selector.className = 'wt-tile-selector';

    for (var v = 1; v <= 9; v++) {
      var wrapper = document.createElement('span');
      wrapper.className = 'wt-answer-tile';
      wrapper.dataset.value = String(v);

      var tileObj = ST.tile(suit, v, false);
      wrapper.appendChild(ST.makeTileEl(tileObj));

      var label = document.createElement('span');
      label.className = 'wt-answer-tile-label';
      label.textContent = String(v);
      wrapper.appendChild(label);

      wrapper.addEventListener('click', onTileClick);
      selector.appendChild(wrapper);
    }
  }

  function onTileClick(e) {
    if (checked) return;
    var wrapper = e.currentTarget;
    if (wrapper.classList.contains('wt-answer-tile--selected')) {
      wrapper.classList.remove('wt-answer-tile--selected');
    } else {
      wrapper.classList.add('wt-answer-tile--selected');
    }
  }

  // ----- Check answer ------------------------------------------------------

  function checkAnswer() {
    if (!currentHand || checked) return;
    checked = true;

    var waitsSet = {};
    for (var i = 0; i < currentHand.waits.length; i++) {
      waitsSet[currentHand.waits[i]] = true;
    }
    var phantomSet = currentHand.phantomWaits || {};

    var selector = byId('wt-tile-selector');
    selector.classList.add('wt-checked');

    var tiles = selector.querySelectorAll('.wt-answer-tile');
    var wrong = 0, missed = 0;

    for (var j = 0; j < tiles.length; j++) {
      var el = tiles[j];
      var val = parseInt(el.dataset.value, 10);
      var isWait = !!waitsSet[val];
      var isPhantom = !!phantomSet[val];
      var isSelected = el.classList.contains('wt-answer-tile--selected');

      el.classList.remove('wt-answer-tile--selected');

      if (isPhantom) {
        // Phantom: mathematically valid but physically impossible — show regardless,
        // don't count toward missed or wrong either way
        el.classList.add('wt-answer-tile--phantom');
      } else if (isWait && isSelected) {
        el.classList.add('wt-answer-tile--correct');
      } else if (isSelected && !isWait) {
        el.classList.add('wt-answer-tile--wrong');
        wrong++;
      } else if (isWait && !isSelected) {
        el.classList.add('wt-answer-tile--missed');
        missed++;
      }
    }

    // Verdict text
    var verdict = byId('wt-verdict');
    verdict.className = 'wt-verdict';
    if (wrong === 0 && missed === 0) {
      verdict.textContent = 'Correct!';
      verdict.classList.add('wt-verdict--perfect');
    } else {
      var parts = [];
      if (missed > 0) parts.push(missed === 1 ? '1 missed' : missed + ' missed');
      if (wrong > 0) parts.push(wrong === 1 ? '1 wrong' : wrong + ' wrong');
      verdict.textContent = parts.join(', ');
      verdict.classList.add(wrong > 0 ? 'wt-verdict--wrong' : 'wt-verdict--partial');
    }

    byId('wt-result').classList.remove('ccr-hidden');
    byId('wt-check-btn').classList.add('ccr-hidden');
    byId('wt-new-btn').classList.remove('ccr-hidden');
  }

  // ----- New hand ----------------------------------------------------------

  function newHand() {
    checked = false;
    currentHand = WT.generateWaitsHand();

    renderHand(currentHand);
    buildSelector(currentHand.suit);

    // Reset suit label
    var suitLabel = byId('wt-suit-label');
    if (suitLabel) suitLabel.textContent = SUIT_LABEL[currentHand.suit] || currentHand.suit;

    // Reset result area
    byId('wt-result').classList.add('ccr-hidden');
    byId('wt-verdict').textContent = '';
    byId('wt-verdict').className = 'wt-verdict';

    // Reset buttons
    byId('wt-check-btn').classList.remove('ccr-hidden');
    byId('wt-new-btn').classList.add('ccr-hidden');
  }

  // ----- Event wiring ------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    var checkBtn = byId('wt-check-btn');
    var newBtn   = byId('wt-new-btn');
    if (checkBtn) checkBtn.addEventListener('click', checkAnswer);
    if (newBtn)   newBtn.addEventListener('click', newHand);
    newHand();
  });

})(window.WaitTrainer || (window.WaitTrainer = {}));
