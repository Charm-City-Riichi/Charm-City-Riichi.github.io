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
  var bigTiles = false;
  var showOtherDiscards = false;

  // ---- Game state ---------------------------------------------------------

  var state = null;

  // ---- Effective bank (accounts for visible opponent discards) -------------

  /** Return bank adjusted for opponent discards when that mode is active. */
  function getEffectiveBank() {
    if (!state) return {};
    if (!showOtherDiscards) return state.bank;

    var bank = {};
    for (var key in state.bank) {
      bank[key] = state.bank[key];
    }
    for (var op = 0; op < 3; op++) {
      for (var d = 0; d < state.opponentDiscards[op].length; d++) {
        var dk = state.opponentDiscards[op][d].suit + state.opponentDiscards[op][d].value;
        bank[dk] = (bank[dk] || 0) - 1;
      }
    }
    return bank;
  }

  /** Recompute currentEval with the effective bank. */
  function recomputeEval() {
    if (!state || !state.drawnTile) return;
    state.currentEval = ET.evaluateDiscards(state.hand, state.drawnTile, getEffectiveBank());
  }

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

    renderDebug();
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

  /**
   * Map a discard sequence index to (row, col) for each opponent's rotated pond.
   * Each opponent fills their pond left-to-right, 6 across, 3 rows from THEIR
   * perspective; we rotate that fill order to match their seating position.
   */
  var POND_PLACE = [
    // Index 0 = toimen (180°): 6-col × 3-row, reversed
    function (i) { return { row: 3 - Math.floor(i / 6), col: 6 - (i % 6) }; },
    // Index 1 = kamicha (90° CW): 3-col × 6-row, columns top-to-bottom, right-to-left
    function (i) { return { row: (i % 6) + 1, col: 3 - Math.floor(i / 6) }; },
    // Index 2 = shimocha (90° CCW): 3-col × 6-row, columns bottom-to-top, left-to-right
    function (i) { return { row: 6 - (i % 6), col: Math.floor(i / 6) + 1 }; }
  ];

  function renderOpponentDiscard(opIndex, tile) {
    var ids = ['et-pond-toimen', 'et-pond-kamicha', 'et-pond-shimocha'];
    var el = byId(ids[opIndex]);
    if (!el) return;

    var tileEl = ST.makeTileEl(tile);
    var seq = state.opponentDiscards[opIndex].length - 1;
    var pos = POND_PLACE[opIndex](seq);
    tileEl.style.gridRow = pos.row;
    tileEl.style.gridColumn = pos.col;
    el.appendChild(tileEl);
  }

  function clearAllPonds() {
    var pondEl = byId('et-pond');
    if (pondEl) pondEl.textContent = '';
    var ids = ['et-pond-toimen', 'et-pond-kamicha', 'et-pond-shimocha'];
    for (var i = 0; i < ids.length; i++) {
      var el = byId(ids[i]);
      if (el) el.textContent = '';
    }
  }

  function syncPondVisibility() {
    var pondEl = byId('et-pond');
    if (!pondEl) return;

    if (showOtherDiscards || showPond) {
      pondEl.classList.remove('ccr-hidden');
    } else {
      pondEl.classList.add('ccr-hidden');
    }
  }

  function syncPondsLayout() {
    var area = byId('et-ponds-area');
    var wrapToimen = byId('et-wrap-toimen');
    var wrapKamicha = byId('et-wrap-kamicha');
    var wrapShimocha = byId('et-wrap-shimocha');
    var pondEl = byId('et-pond');

    if (showOtherDiscards) {
      area.classList.add('et-ponds-cross');
      wrapToimen.classList.remove('ccr-hidden');
      wrapKamicha.classList.remove('ccr-hidden');
      wrapShimocha.classList.remove('ccr-hidden');
      // User's pond always visible in cross layout
      pondEl.classList.remove('ccr-hidden');
    } else {
      area.classList.remove('et-ponds-cross');
      wrapToimen.classList.add('ccr-hidden');
      wrapKamicha.classList.add('ccr-hidden');
      wrapShimocha.classList.add('ccr-hidden');
      syncPondVisibility();
    }
  }

  // ---- Opponent discard logic (near-optimal AI) ----------------------------

  /**
   * Choose a discard for an opponent using shanten-only evaluation.
   * 85% of the time picks among the best (lowest shanten) discards;
   * 15% picks from the top 3 tiers, introducing slight suboptimality.
   * Returns the index into hand14 of the tile to discard.
   */
  function opponentChooseDiscard(hand14) {
    var options = [];
    var seen = {};

    for (var i = 0; i < hand14.length; i++) {
      var key = hand14[i].suit + hand14[i].value;
      if (seen[key]) continue;
      seen[key] = true;

      // Build 13-tile hand without this tile
      var remaining = [];
      var removed = false;
      for (var j = 0; j < hand14.length; j++) {
        if (!removed && hand14[j].suit === hand14[i].suit && hand14[j].value === hand14[i].value) {
          removed = true;
          continue;
        }
        remaining.push(hand14[j]);
      }

      options.push({ key: key, shanten: ET.calculateShanten(remaining) });
    }

    options.sort(function (a, b) { return a.shanten - b.shanten; });

    var chosen;
    var bestShanten = options[0].shanten;

    if (Math.random() < 0.85 || options.length <= 1) {
      // Pick randomly among best (lowest shanten) options
      var best = [];
      for (var b = 0; b < options.length; b++) {
        if (options[b].shanten === bestShanten) best.push(options[b]);
      }
      chosen = best[Math.floor(Math.random() * best.length)];
    } else {
      // Pick from top 3 tiers (slight suboptimality)
      var top = options.slice(0, Math.min(3, options.length));
      chosen = top[Math.floor(Math.random() * top.length)];
    }

    // Find first matching tile in hand14
    for (var fi = 0; fi < hand14.length; fi++) {
      if (hand14[fi].suit + hand14[fi].value === chosen.key) return fi;
    }
    return 0;
  }

  // ---- Turn sequencing (delayed opponent discards) -------------------------

  /** Delay between each opponent's discard in ms (quick but perceptible). */
  var TURN_DELAY = 300;

  /** Whether we are currently waiting for the opponent turn sequence. */
  var awaitingOpponents = false;

  /** Process a single opponent's draw-and-discard. Returns true if it happened. */
  function processOneOpponent(op) {
    if (state.remainingDeck.length === 0) return false;

    var drawn = state.remainingDeck.shift();
    state.opponentHands[op].push(drawn);

    var idx = opponentChooseDiscard(state.opponentHands[op]);
    var discarded = state.opponentHands[op].splice(idx, 1)[0];
    state.opponentDiscards[op].push(discarded);

    renderOpponentDiscard(op, discarded);
    return true;
  }

  /**
   * Run opponent turns sequentially with delays, then draw the user's tile.
   * Counter-clockwise order: shimocha (right, op 2), toimen (across, op 0),
   * kamicha (left, op 1).
   * Calls `callback` when the full sequence is done.
   */
  function processOpponentTurnsDelayed(callback) {
    var order = [2, 0, 1]; // shimocha, toimen, kamicha
    var step = 0;

    function nextStep() {
      if (step < order.length) {
        var op = order[step];
        step++;
        processOneOpponent(op);
        setTimeout(nextStep, TURN_DELAY);
      } else {
        callback();
      }
    }

    // First opponent acts after a short delay following the user's discard
    setTimeout(nextStep, TURN_DELAY);
  }

  // ---- Discard handling ---------------------------------------------------

  function onTileClick(e) {
    if (!state || !state.currentEval || awaitingOpponents) return;

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

    // Add tile to user's pond
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

    // Process opponent turns and draw user's next tile
    state.hand = sortedNewHand;

    function afterOpponents() {
      // Check wall exhaustion after opponents draw
      if (state.remainingDeck.length === 0) {
        state.drawnTile = null;
        state.currentEval = null;
        endGame(false);
        return;
      }

      // Draw next tile for user
      var nextTile = state.remainingDeck.shift();
      var bankKey = nextTile.suit + nextTile.value;
      state.bank[bankKey] = (state.bank[bankKey] || 0) - 1;
      state.drawCount++;

      state.drawnTile = nextTile;

      // Pre-compute evaluation for next turn (using effective bank)
      state.currentEval = ET.evaluateDiscards(state.hand, state.drawnTile, getEffectiveBank());

      renderHand();
    }

    if (showOtherDiscards) {
      // Delayed sequence: disable interaction, show hand dimmed while opponents act
      state.drawnTile = null;
      state.currentEval = null;
      awaitingOpponents = true;
      byId('et-hand').textContent = '';
      byId('et-draw').textContent = '';

      var handArea = document.querySelector('.et-hand-area');
      if (handArea) handArea.classList.add('et-hand-waiting');
      (function () {
        var handEl = byId('et-hand');
        var sorted = sortedNewHand.slice().sort(ST.compareTiles);
        for (var i = 0; i < sorted.length; i++) {
          handEl.appendChild(ST.makeTileEl(sorted[i]));
        }
      })();

      processOpponentTurnsDelayed(function () {
        awaitingOpponents = false;
        var ha = document.querySelector('.et-hand-area');
        if (ha) ha.classList.remove('et-hand-waiting');
        afterOpponents();
      });
    } else {
      // Instant: process all opponent turns synchronously (no visible ponds)
      for (var op = 0; op < 3; op++) {
        processOneOpponent(op);
      }
      afterOpponents();
    }
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
        row.removeChild(handRow);
        showHandBtn.textContent = 'Show hand';
        return;
      }
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
    byId('et-hand').textContent = '';
    byId('et-draw').textContent = '';

    if (reachedTenpai && state.hand.length > 0) {
      var handEl = byId('et-hand');
      var sorted = state.hand.slice().sort(ST.compareTiles);
      for (var i = 0; i < sorted.length; i++) {
        handEl.appendChild(ST.makeTileEl(sorted[i]));
      }
    }

    var shantenEl = byId('et-shanten');
    if (shantenEl) shantenEl.classList.add('ccr-hidden');

    var logEl = byId('et-log');
    var legendEl = byId('et-log-legend');
    if (state.log.length > 0) {
      logEl.classList.remove('ccr-hidden');
      if (legendEl) legendEl.classList.remove('ccr-hidden');
    }

    var resultEl = byId('et-result');
    resultEl.textContent = '';
    resultEl.classList.remove('ccr-hidden');

    var title = document.createElement('div');
    title.className = 'et-result-title';
    if (reachedTenpai) {
      title.textContent = state.turnCount === 1 ? 'Incredible!' : 'Tenpai!';
    } else {
      title.textContent = 'Try again!';
    }
    resultEl.appendChild(title);

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
    byId('et-new-btn').classList.remove('ccr-hidden');
  }

  // ---- New hand -----------------------------------------------------------

  function newHand() {
    awaitingOpponents = false;
    var gen = ET.generateHand();

    state = {
      hand: gen.hand,
      drawnTile: gen.drawnTile,
      bank: gen.bank,
      remainingDeck: gen.remainingDeck,
      opponentHands: gen.opponentHands,
      opponentDiscards: [[], [], []],
      log: [],
      turnCount: 0,
      drawCount: 1,
      optimalCount: 0,
      totalUkeireLoss: 0,
      currentEval: null
    };

    // Pre-compute evaluation (using effective bank)
    state.currentEval = ET.evaluateDiscards(state.hand, state.drawnTile, getEffectiveBank());

    // Reset UI
    byId('et-log').textContent = '';
    byId('et-log').classList.add('ccr-hidden');
    var legendEl = byId('et-log-legend');
    if (legendEl) legendEl.classList.add('ccr-hidden');
    byId('et-result').textContent = '';
    byId('et-result').classList.add('ccr-hidden');
    byId('et-new-btn').classList.add('ccr-hidden');

    // Clear and sync all ponds
    clearAllPonds();
    syncPondsLayout();

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

    var bigCheckbox = byId('et-opt-big');
    if (bigCheckbox) {
      bigCheckbox.checked = bigTiles;
      bigCheckbox.addEventListener('change', function () {
        bigTiles = bigCheckbox.checked;
        var card = document.querySelector('.trainer-card');
        if (card) card.classList.toggle('et-big-tiles', bigTiles);
      });
    }

    var othersCheckbox = byId('et-opt-others');
    if (othersCheckbox) {
      othersCheckbox.checked = showOtherDiscards;
      othersCheckbox.addEventListener('change', function () {
        showOtherDiscards = othersCheckbox.checked;
        // When showing others, automatically show my pond too and lock the toggle
        if (showOtherDiscards) {
          showPond = true;
          if (pondCheckbox) {
            pondCheckbox.checked = true;
            pondCheckbox.disabled = true;
          }
        } else {
          if (pondCheckbox) pondCheckbox.disabled = false;
        }
        syncPondsLayout();
        // Recompute evaluation since effective bank changed
        recomputeEval();
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
