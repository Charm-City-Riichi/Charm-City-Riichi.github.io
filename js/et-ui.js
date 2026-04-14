/* Efficiency Trainer — UI
 *
 * Renders the 13+1 hand display, handles tile click discards,
 * manages the discard log, and shows the end-of-game result screen.
 *
 * Depends on: st-core.js, st-ui.js (makeTileEl, sortTilesForDisplay),
 *             et-shanten.js, et-core.js
 */
(function (ET) {
  'use strict';

  var ST = window.ScoreTrainer;

  function byId(id) { return document.getElementById(id); }

  // ---- Notation helper (for debug display) --------------------------------

  /** Convert a sorted tile array to compact notation, e.g. "123m456p11z" */
  function tilesToNotation(tiles) {
    var sorted = tiles.slice().sort(ST.compareTiles);
    var groups = { m: [], p: [], s: [], z: [] };
    for (var i = 0; i < sorted.length; i++) {
      groups[sorted[i].suit].push(sorted[i].value);
    }
    var out = '';
    var suits = ['m', 'p', 's', 'z'];
    for (var si = 0; si < suits.length; si++) {
      var g = groups[suits[si]];
      if (g.length > 0) {
        out += g.join('') + suits[si];
      }
    }
    return out;
  }

  // ---- Toggle state (persists across hands) -------------------------------

  var showLog = true;
  var showPond = false;
  var showShanten = false;

  // ---- Game state ---------------------------------------------------------

  var state = null; // { hand, drawnTile, bank, remainingDeck, log, turnCount, drawCount, optimalCount, totalUkeireLoss, currentEval }

  // ---- Hand rendering -----------------------------------------------------

  function renderHand() {
    var handEl = byId('et-hand');
    var drawEl = byId('et-draw');
    handEl.textContent = '';
    drawEl.textContent = '';

    // 13 sorted tiles on the left
    var sorted = state.hand.slice().sort(ST.compareTiles);
    for (var i = 0; i < sorted.length; i++) {
      var wrap = document.createElement('span');
      wrap.className = 'et-hand-tile';
      wrap.dataset.suit = sorted[i].suit;
      wrap.dataset.value = String(sorted[i].value);
      wrap.dataset.source = 'hand';
      wrap.dataset.index = String(i);
      wrap.appendChild(ST.makeTileEl(sorted[i]));
      wrap.addEventListener('click', onTileClick);
      handEl.appendChild(wrap);
    }

    // Drawn tile on the right
    var drawWrap = document.createElement('span');
    drawWrap.className = 'et-hand-tile';
    drawWrap.dataset.suit = state.drawnTile.suit;
    drawWrap.dataset.value = String(state.drawnTile.value);
    drawWrap.dataset.source = 'draw';
    drawWrap.appendChild(ST.makeTileEl(state.drawnTile));
    drawWrap.addEventListener('click', onTileClick);
    drawEl.appendChild(drawWrap);

    // Debug display: hand notation + shanten for external verification
    renderDebug();

    // Update shanten display
    renderShanten();
  }

  function renderDebug() {
    var debugEl = byId('et-debug');
    if (!debugEl || !state) return;

    var all14 = state.hand.concat([state.drawnTile]);
    var notation14 = tilesToNotation(all14);
    var shanten14 = ET.calculateShanten(all14);

    var notation13 = tilesToNotation(state.hand);
    var shanten13 = ET.calculateShanten(state.hand);

    debugEl.textContent = '14 tiles: ' + notation14 + ' (shanten ' + shanten14 + ')' +
      '  |  13 tiles: ' + notation13 + ' (shanten ' + shanten13 + ')';
  }

  // ---- Shanten display ----------------------------------------------------

  function renderShanten() {
    var shantenEl = byId('et-shanten');
    if (!shantenEl || !state) return;

    if (!showShanten) {
      shantenEl.classList.add('ccr-hidden');
      return;
    }

    var all14 = state.hand.concat(state.drawnTile ? [state.drawnTile] : []);
    var shanten = ET.calculateShanten(all14);
    shantenEl.textContent = 'Shanten: ' + shanten;
    shantenEl.classList.remove('ccr-hidden');
  }

  // ---- Pond rendering -----------------------------------------------------

  function renderPondTile(tile) {
    var pondEl = byId('et-pond');
    if (!pondEl) return;
    pondEl.appendChild(ST.makeTileEl(tile));
  }

  function clearPond() {
    var pondEl = byId('et-pond');
    if (pondEl) pondEl.textContent = '';
  }

  function syncPondVisibility() {
    var pondEl = byId('et-pond');
    if (!pondEl) return;
    if (showPond) {
      pondEl.classList.remove('ccr-hidden');
    } else {
      pondEl.classList.add('ccr-hidden');
    }
  }

  // ---- Discard handling ---------------------------------------------------

  function onTileClick(e) {
    if (!state || !state.currentEval) return;

    var wrap = e.currentTarget;
    var suit = wrap.dataset.suit;
    var value = parseInt(wrap.dataset.value, 10);
    var key = suit + value;

    processDiscard(key, ST.tile(suit, value, false));
  }

  function processDiscard(key, discardedTile) {
    var evaluation = state.currentEval;
    var classification = ET.classifyDiscard(key, evaluation);

    state.turnCount++;

    // Track stats
    if (classification.color === 'green') {
      state.optimalCount++;
    }
    state.totalUkeireLoss += classification.ukeireLoss;

    // Get shanten of resulting 13-tile hand
    var chosenInfo = evaluation.lookup[key];
    var resultingShanten = chosenInfo.shanten;

    // Remove discarded tile from the combined 14
    var all14 = state.hand.concat([state.drawnTile]);
    var newHand = [];
    var removed = false;
    for (var i = 0; i < all14.length; i++) {
      if (!removed && all14[i].suit === discardedTile.suit && all14[i].value === discardedTile.value) {
        removed = true;
        continue;
      }
      newHand.push(all14[i]);
    }
    var sortedNewHand = newHand.sort(ST.compareTiles);

    // Add log entry (includes hand snapshot for "show hand" feature)
    state.log.push({
      turn: state.turnCount,
      tile: discardedTile,
      ukeire: classification.chosenUkeire,
      color: classification.color,
      bestTile: classification.bestTile,
      bestUkeire: classification.bestUkeire,
      tiedTiles: classification.tiedTiles,
      shanten: resultingShanten,
      handAfter: sortedNewHand.slice()
    });
    renderLogEntry(state.log[state.log.length - 1]);

    // Add tile to pond
    renderPondTile(discardedTile);

    // Check tenpai
    if (resultingShanten <= 0) {
      state.hand = sortedNewHand;
      state.drawnTile = null;
      state.currentEval = null;
      endGame(true);
      return;
    }

    // Check wall exhaustion
    if (state.drawCount >= 18) {
      state.hand = sortedNewHand;
      state.drawnTile = null;
      state.currentEval = null;
      endGame(false);
      return;
    }

    // Draw next tile
    var nextTile = state.remainingDeck.shift();
    var bankKey = nextTile.suit + nextTile.value;
    state.bank[bankKey] = (state.bank[bankKey] || 0) - 1;
    state.drawCount++;

    state.hand = sortedNewHand;
    state.drawnTile = nextTile;

    // Pre-compute evaluation for next turn
    state.currentEval = ET.evaluateDiscards(state.hand, state.drawnTile, state.bank);

    renderHand();
  }

  // ---- Discard log --------------------------------------------------------

  function renderLogEntry(entry) {
    var logEl = byId('et-log');
    var legendEl = byId('et-log-legend');

    // Only show log/legend if toggle is on
    if (showLog) {
      logEl.classList.remove('ccr-hidden');
      if (legendEl) legendEl.classList.remove('ccr-hidden');
    }

    var row = document.createElement('div');
    row.className = 'et-log-entry et-log-entry--' + entry.color;

    // Turn number
    var turnLabel = document.createElement('span');
    turnLabel.className = 'et-log-turn';
    turnLabel.textContent = String(entry.turn) + '.';
    row.appendChild(turnLabel);

    // Discarded tile image
    row.appendChild(ST.makeTileEl(entry.tile));

    // Arrow + ukeire
    var ukeireLabel = document.createElement('span');
    ukeireLabel.className = 'et-log-ukeire';
    ukeireLabel.textContent = '\u2192 ' + entry.ukeire + ' ukeire';
    row.appendChild(ukeireLabel);

    // For green: show other equally-good tiles (if any)
    if (entry.color === 'green' && entry.tiedTiles && entry.tiedTiles.length > 0) {
      var alsoLabel = document.createElement('span');
      alsoLabel.className = 'et-log-best';
      alsoLabel.textContent = 'Also best: ';
      row.appendChild(alsoLabel);
      for (var t = 0; t < entry.tiedTiles.length; t++) {
        row.appendChild(ST.makeTileEl(entry.tiedTiles[t]));
      }
    }

    // For yellow/red: show best option
    if (entry.color !== 'green') {
      var bestLabel = document.createElement('span');
      bestLabel.className = 'et-log-best';
      bestLabel.textContent = 'Best: ';
      row.appendChild(bestLabel);
      row.appendChild(ST.makeTileEl(entry.bestTile));
      var bestUkeire = document.createElement('span');
      bestUkeire.className = 'et-log-best';
      bestUkeire.textContent = '\u2192 ' + entry.bestUkeire;
      row.appendChild(bestUkeire);
    }

    // "Show hand" button
    var showHandBtn = document.createElement('button');
    showHandBtn.className = 'et-log-show-hand';
    showHandBtn.textContent = 'Show hand';
    showHandBtn.addEventListener('click', function () {
      var handRow = row.querySelector('.et-log-hand');
      if (handRow) {
        // Toggle: remove if already visible
        row.removeChild(handRow);
        showHandBtn.textContent = 'Show hand';
        return;
      }
      // Build hand snapshot row
      handRow = document.createElement('div');
      handRow.className = 'et-log-hand';
      for (var h = 0; h < entry.handAfter.length; h++) {
        handRow.appendChild(ST.makeTileEl(entry.handAfter[h]));
      }
      row.appendChild(handRow);
      showHandBtn.textContent = 'Hide hand';
    });
    row.appendChild(showHandBtn);

    logEl.insertBefore(row, logEl.firstChild);
  }

  /** Re-render all log entries (used when toggling log back on mid-game) */
  function rebuildLog() {
    var logEl = byId('et-log');
    logEl.textContent = '';
    for (var i = 0; i < state.log.length; i++) {
      renderLogEntry(state.log[i]);
    }
  }

  function syncLogVisibility() {
    var logEl = byId('et-log');
    var legendEl = byId('et-log-legend');
    if (showLog && state && state.log.length > 0) {
      logEl.classList.remove('ccr-hidden');
      if (legendEl) legendEl.classList.remove('ccr-hidden');
    } else {
      logEl.classList.add('ccr-hidden');
      if (legendEl) legendEl.classList.add('ccr-hidden');
    }
  }

  // ---- End game -----------------------------------------------------------

  function endGame(reachedTenpai) {
    // Hide hand interaction
    byId('et-hand').textContent = '';
    byId('et-draw').textContent = '';

    // Show remaining sorted hand if tenpai
    if (reachedTenpai && state.hand.length > 0) {
      var handEl = byId('et-hand');
      var sorted = state.hand.slice().sort(ST.compareTiles);
      for (var i = 0; i < sorted.length; i++) {
        handEl.appendChild(ST.makeTileEl(sorted[i]));
      }
    }

    // Hide shanten on game end
    var shantenEl = byId('et-shanten');
    if (shantenEl) shantenEl.classList.add('ccr-hidden');

    // Always show log on game end so user can review
    var logEl = byId('et-log');
    var legendEl = byId('et-log-legend');
    if (state.log.length > 0) {
      logEl.classList.remove('ccr-hidden');
      if (legendEl) legendEl.classList.remove('ccr-hidden');
    }

    var resultEl = byId('et-result');
    resultEl.textContent = '';
    resultEl.classList.remove('ccr-hidden');

    // Title
    var title = document.createElement('div');
    title.className = 'et-result-title';
    if (reachedTenpai) {
      title.textContent = state.turnCount === 1 ? 'Incredible!' : 'Tenpai!';
    } else {
      title.textContent = 'Try again!';
    }
    resultEl.appendChild(title);

    // Stats
    var statsWrap = document.createElement('div');
    statsWrap.className = 'et-result-stats';

    var stepsLine = document.createElement('div');
    stepsLine.className = 'et-stat';
    stepsLine.textContent = 'Discards: ' + state.turnCount;
    statsWrap.appendChild(stepsLine);

    if (state.turnCount > 0) {
      var pct = Math.round((state.optimalCount / state.turnCount) * 100);
      var optLine = document.createElement('div');
      optLine.className = 'et-stat';
      optLine.textContent = 'Optimal discards: ' + state.optimalCount + '/' + state.turnCount + ' (' + pct + '%)';
      statsWrap.appendChild(optLine);

      var lossLine = document.createElement('div');
      lossLine.className = 'et-stat';
      lossLine.textContent = 'Total ukeire lost: ' + state.totalUkeireLoss;
      statsWrap.appendChild(lossLine);

      // Rating
      var rating = document.createElement('div');
      rating.className = 'et-stat et-stat--rating';
      if (state.turnCount === 1 && reachedTenpai) {
        rating.textContent = 'Dealt tenpai on first cut!';
      } else if (pct >= 90) {
        rating.textContent = 'Excellent!';
      } else if (pct >= 70) {
        rating.textContent = 'Good!';
      } else if (pct >= 50) {
        rating.textContent = 'Decent';
      } else {
        rating.textContent = 'Keep practicing!';
      }
      statsWrap.appendChild(rating);
    }

    resultEl.appendChild(statsWrap);

    // Show new hand button
    byId('et-new-btn').classList.remove('ccr-hidden');
  }

  // ---- New hand -----------------------------------------------------------

  function newHand() {
    var gen = ET.generateHand();

    state = {
      hand: gen.hand,
      drawnTile: gen.drawnTile,
      bank: gen.bank,
      remainingDeck: gen.remainingDeck,
      log: [],
      turnCount: 0,
      drawCount: 1,
      optimalCount: 0,
      totalUkeireLoss: 0,
      currentEval: null
    };

    // Pre-compute evaluation
    state.currentEval = ET.evaluateDiscards(state.hand, state.drawnTile, state.bank);

    // Reset UI
    byId('et-log').textContent = '';
    byId('et-log').classList.add('ccr-hidden');
    var legendEl = byId('et-log-legend');
    if (legendEl) legendEl.classList.add('ccr-hidden');
    byId('et-result').textContent = '';
    byId('et-result').classList.add('ccr-hidden');
    byId('et-new-btn').classList.add('ccr-hidden');

    // Clear and sync pond
    clearPond();
    syncPondVisibility();

    renderHand();
  }

  // ---- Toggle wiring ------------------------------------------------------

  function wireToggles() {
    var logCheckbox = byId('et-opt-log');
    var pondCheckbox = byId('et-opt-pond');
    var shantenCheckbox = byId('et-opt-shanten');

    if (logCheckbox) {
      logCheckbox.checked = showLog;
      logCheckbox.addEventListener('change', function () {
        showLog = logCheckbox.checked;
        if (showLog && state && state.log.length > 0) {
          // Rebuild log in case entries were added while hidden
          rebuildLog();
        }
        syncLogVisibility();
      });
    }

    if (pondCheckbox) {
      pondCheckbox.checked = showPond;
      pondCheckbox.addEventListener('change', function () {
        showPond = pondCheckbox.checked;
        syncPondVisibility();
      });
    }

    if (shantenCheckbox) {
      shantenCheckbox.checked = showShanten;
      shantenCheckbox.addEventListener('change', function () {
        showShanten = shantenCheckbox.checked;
        renderShanten();
      });
    }
  }

  // ---- Event wiring -------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    var newBtn = byId('et-new-btn');
    if (newBtn) newBtn.addEventListener('click', newHand);
    wireToggles();
    newHand();
  });

})(window.EfficiencyTrainer || (window.EfficiencyTrainer = {}));
