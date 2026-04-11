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

    // Add log entry
    state.log.push({
      turn: state.turnCount,
      tile: discardedTile,
      ukeire: classification.chosenUkeire,
      color: classification.color,
      bestTile: classification.bestTile,
      bestUkeire: classification.bestUkeire,
      tiedTiles: classification.tiedTiles,
      shanten: resultingShanten
    });
    renderLogEntry(state.log[state.log.length - 1]);

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

    // Check tenpai
    if (resultingShanten <= 0) {
      state.hand = newHand.sort(ST.compareTiles);
      state.drawnTile = null;
      state.currentEval = null;
      endGame(true);
      return;
    }

    // Check wall exhaustion
    if (state.drawCount >= 30) {
      state.hand = newHand.sort(ST.compareTiles);
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

    state.hand = newHand.sort(ST.compareTiles);
    state.drawnTile = nextTile;

    // Pre-compute evaluation for next turn
    state.currentEval = ET.evaluateDiscards(state.hand, state.drawnTile, state.bank);

    renderHand();
  }

  // ---- Discard log --------------------------------------------------------

  function renderLogEntry(entry) {
    var logEl = byId('et-log');
    logEl.classList.remove('ccr-hidden');

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

    logEl.insertBefore(row, logEl.firstChild);
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
    byId('et-result').textContent = '';
    byId('et-result').classList.add('ccr-hidden');
    byId('et-new-btn').classList.add('ccr-hidden');

    renderHand();
  }

  // ---- Event wiring -------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    var newBtn = byId('et-new-btn');
    if (newBtn) newBtn.addEventListener('click', newHand);
    newHand();
  });

})(window.EfficiencyTrainer || (window.EfficiencyTrainer = {}));
